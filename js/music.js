/* Sono Sim — la musique : chaque musicien joue vraiment, et ce qu’on entend passe par la console.
 * Synthèse Web Audio (voix à formants, guitare Karplus-Strong, piano, basse, batterie, chorale…),
 * séquenceur à pas de double-croche, et pour chaque voie de console : gain → saturation →
 * coupe-bas → égaliseur 3 bandes → fader → façade → EQ graphique → salle (réverbération). */
(function (root) {
  'use strict';
  const A = root.SonoAudio;

  const SONGS = {
    // tempo, tonalité (midi de la tonique), grille d’accords (degrés), mode
    accueil: { bpm: 100, key: 60, prog: [[0, 'M'], [5, 'm'], [3, 'M'], [4, 'M']] },
    chorale: { bpm: 78, key: 65, prog: [[0, 'M'], [5, 'm'], [3, 'M'], [4, 'M']] },
    duo: { bpm: 92, key: 67, prog: [[0, 'M'], [4, 'M'], [5, 'm'], [3, 'M']] },
    profs: { bpm: 100, key: 62, prog: [[0, 'M'], [4, 'M'], [5, 'm'], [3, 'M']] },
    rock: { bpm: 124, key: 64, prog: [[0, 'm'], [5, 'M'], [2, 'M'], [6, 'M']], rock: true },
    final: { bpm: 104, key: 60, prog: [[0, 'M'], [4, 'M'], [5, 'm'], [3, 'M']] },
    atelier: { bpm: 96, key: 60, prog: [[0, 'M'], [5, 'm'], [3, 'M'], [4, 'M']] }
  };
  const MAJOR = [0, 2, 4, 5, 7, 9, 11];
  const MINOR = [0, 2, 3, 5, 7, 8, 10];
  const VOWELS = [[730, 1090, 2440], [570, 840, 2410], [270, 2290, 3010], [530, 1840, 2480], [300, 870, 2240]];

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const dbl = (db) => Math.pow(10, db / 20);

  const M = {
    ready: false, playing: false, song: SONGS.atelier, songId: 'atelier',
    tracks: {}, chains: {}, step: 0, nextTime: 0, timer: null,
    beat: 0, // phase du temps (0..1), pour faire danser les bonhommes
    ksCache: {},

    ensure() {
      if (this.ready) return true;
      if (!A.ctx) return false;
      const ctx = A.ctx;
      this.ctx = ctx;
      // salle : réverbération courte (convolution d’un bruit qui décroît)
      const len = Math.floor(ctx.sampleRate * 1.4);
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = ir.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
      }
      this.verb = ctx.createConvolver();
      this.verb.buffer = ir;
      this.verbGain = ctx.createGain(); this.verbGain.gain.value = 0.22;
      this.room = ctx.createGain();           // tout ce qu’entend le public
      this.out = ctx.createGain(); this.out.gain.value = 0.9;
      this.room.connect(this.out);
      this.room.connect(this.verbGain); this.verbGain.connect(this.verb); this.verb.connect(this.out);
      this.out.connect(A.master);
      // façade : bus + EQ graphique + fader master
      this.mainBus = ctx.createGain();
      this.geq = [63, 100, 160, 250, 400, 630, 1000, 1600, 2500, 4000, 6300, 10000].map((f) => {
        const b = ctx.createBiquadFilter(); b.type = 'peaking'; b.frequency.value = f; b.Q.value = 2.1; b.gain.value = 0; return b;
      });
      let n = this.mainBus;
      for (const b of this.geq) { n.connect(b); n = b; }
      this.mainOut = ctx.createGain();
      n.connect(this.mainOut); this.mainOut.connect(this.room);
      // courbe de saturation
      const curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 2.2) / Math.tanh(2.2); }
      this.clipCurve = curve;
      const fuzz = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; fuzz[i] = Math.tanh(x * 9) * 0.6; }
      this.fuzzCurve = fuzz;
      this.ready = true;
      return true;
    },

    setSong(id) {
      const s = SONGS[id] || SONGS.atelier;
      if (this.songId !== id) { this.songId = id; this.song = s; this.step = 0; }
    },

    start() {
      if (!this.ensure() || this.playing) return;
      this.playing = true;
      this.nextTime = this.ctx.currentTime + 0.08;
      this.t0 = this.nextTime;
      this.timer = setInterval(() => this.schedule(), 25);
    },
    stop() {
      this.playing = false;
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      for (const id in this.tracks) this.tracks[id].vol.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    },

    // ------------------------------------------------------------ Pistes (un musicien = une piste)
    track(id, type) {
      let t = this.tracks[id];
      if (t && t.type === type) return t;
      if (t) this.dropTrack(id);
      const ctx = this.ctx;
      const src = ctx.createGain();        // la sortie de l’instrument
      const vol = ctx.createGain();        // joue / se tait
      vol.gain.value = 0;
      let head = src;
      if (type === 'guitare_elec') {       // la disto de l’ampli fait partie de l’instrument
        const sh = ctx.createWaveShaper(); sh.curve = this.fuzzCurve;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
        src.connect(sh); sh.connect(lp); head = lp;
      }
      head.connect(vol);
      const dry = ctx.createGain(); dry.gain.value = 0;  // le son direct, sans sono
      vol.connect(dry); dry.connect(this.room);
      t = { id, type, src, vol, dry, playing: false, phase: Math.random() * 4 };
      this.tracks[id] = t;
      return t;
    },
    dropTrack(id) {
      const t = this.tracks[id];
      if (!t) return;
      try { t.vol.disconnect(); t.dry.disconnect(); } catch (e) { /* déjà débranché */ }
      for (const k in this.chains) if (this.chains[k].trackId === id) this.dropChain(k);
      delete this.tracks[id];
    },

    // une voie de console branchée sur une piste
    chain(key, trackId) {
      let c = this.chains[key];
      if (c && c.trackId === trackId) return c;
      if (c) this.dropChain(key);
      const ctx = this.ctx;
      const pre = ctx.createGain();
      const sh = ctx.createWaveShaper(); sh.curve = this.clipCurve; sh.oversample = '2x';
      const post = ctx.createGain();
      const hpf = ctx.createBiquadFilter(); hpf.type = 'highpass'; hpf.Q.value = 0.7; hpf.frequency.value = 10;
      const ls = ctx.createBiquadFilter(); ls.type = 'lowshelf'; ls.frequency.value = 100;
      const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.Q.value = 1.4;
      const hs = ctx.createBiquadFilter(); hs.type = 'highshelf'; hs.frequency.value = 10000;
      const fader = ctx.createGain(); fader.gain.value = 0;
      this.tracks[trackId].vol.connect(pre);
      pre.connect(sh); sh.connect(post); post.connect(hpf); hpf.connect(ls); ls.connect(pk); pk.connect(hs); hs.connect(fader);
      fader.connect(this.mainBus);
      c = { trackId, pre, post, hpf, ls, pk, hs, fader };
      this.chains[key] = c;
      return c;
    },
    dropChain(key) {
      const c = this.chains[key];
      if (!c) return;
      try { this.tracks[c.trackId] && this.tracks[c.trackId].vol.disconnect(c.pre); } catch (e) { /* ignore */ }
      try { c.fader.disconnect(); } catch (e) { /* ignore */ }
      delete this.chains[key];
    },

    // ------------------------------------------------------------ Synchronisation avec la simulation
    // Ce que tu entends = ce qu’entend le public à la régie, d’après le moteur physique.
    syncSim(state, levels, aud, sceneId, E) {
      if (!this.ensure()) return;
      const ctx = this.ctx, now = ctx.currentTime;
      this.setSong(sceneId || 'atelier');
      const keep = new Set();
      const anyPlaying = state.sources.some(s => s.playing);
      if (anyPlaying && !this.playing) this.start();
      if (!anyPlaying && this.playing) this.stop();
      const leq = Math.max(55, aud.leq);
      // volume perçu : on garde les écarts entre instruments, on comprime le niveau global
      const G = dbl((leq - 88) * 0.35) * 0.55;
      for (const s of state.sources) {
        keep.add(s.id);
        const t = this.track(s.id, s.type);
        t.playing = s.playing !== false;
        t.level = s.lvlOffset || 0;
        t.vol.gain.setTargetAtTime(t.playing ? dbl(t.level * 0.6) : 0, now, 0.05);
        const p = aud.perSrc[s.id];
        const ac = p ? p.acoustic : -120;
        t.dry.gain.setTargetAtTime(ac > -100 ? dbl(ac - leq) * G : 0, now, 0.08);
      }
      for (const id in this.tracks) if (!keep.has(id)) this.dropTrack(id);
      // les voies de la console
      const used = new Set();
      const main = state.main;
      for (const L of levels) {
        if (!L.mic || !L.src) continue;
        const key = 'ch' + L.ch;
        const t = this.tracks[L.src.id];
        if (!t) continue;
        used.add(key);
        const c = this.chain(key, L.src.id);
        const ch = state.channels[L.ch];
        let pa = -120;
        if (L.alive && !ch.mute && !main.mute && L.avg > -100) {
          pa = L.avg + 18 + ch.fader + main.fader + 102 + (E ? E.audienceAtt() : -16);
        }
        // saturation : on attaque le « préampli » d’autant plus fort que les crêtes dépassent 0 dBFS
        const over = L.alive ? L.peak : -60;
        const drive = dbl(Math.min(18, over + 2));
        c.pre.gain.setTargetAtTime(drive * 1.6, now, 0.03);
        c.post.gain.setTargetAtTime(1 / Math.max(0.3, drive * 1.6 * 0.9), now, 0.03);
        c.hpf.frequency.setTargetAtTime(ch.hpf ? ch.hpfFreq : 10, now, 0.03);
        c.ls.gain.setTargetAtTime(ch.low, now, 0.03);
        c.pk.frequency.setTargetAtTime(ch.midF, now, 0.03);
        c.pk.gain.setTargetAtTime(ch.midG, now, 0.03);
        c.hs.gain.setTargetAtTime(ch.high, now, 0.03);
        // le niveau absolu est déjà compté dans pa : le fader de la chaîne transporte tout
        c.fader.gain.setTargetAtTime(pa > -100 ? dbl(pa - leq) * G : 0, now, 0.05);
      }
      for (const k in this.chains) if (!used.has(k)) this.dropChain(k);
      main.geq.forEach((g, i) => this.geq[i].gain.setTargetAtTime(g, now, 0.05));
      this.mainOut.gain.setTargetAtTime(1, now, 0.05);
    },

    // Mode leçon : on fixe directement le volume (dB) et la saturation de quelques musiciens.
    direct(list, songId) {
      if (!this.ensure()) return;
      const now = this.ctx.currentTime;
      this.setSong(songId || 'duo');
      const keep = new Set();
      for (const d of list) {
        keep.add(d.id);
        const t = this.track(d.id, d.type);
        t.playing = d.playing !== false;
        t.vol.gain.setTargetAtTime(t.playing ? 1 : 0, now, 0.04);
        const key = 'l_' + d.id;
        const c = this.chain(key, d.id);
        const drive = dbl(Math.min(18, (d.peak == null ? -10 : d.peak) + 2));
        c.pre.gain.setTargetAtTime(drive * 1.6, now, 0.03);
        c.post.gain.setTargetAtTime(1 / Math.max(0.3, drive * 1.6 * 0.9), now, 0.03);
        c.hpf.frequency.setTargetAtTime(10, now, 0.03);
        c.fader.gain.setTargetAtTime(d.db <= -60 ? 0 : dbl(d.db) * 0.55, now, 0.05);
        t.dry.gain.setTargetAtTime(0, now, 0.05);
      }
      for (const id in this.tracks) if (!keep.has(id)) this.dropTrack(id);
      for (const k in this.chains) if (k.indexOf('l_') !== 0) this.dropChain(k);
      this.geq.forEach(b => b.gain.setTargetAtTime(0, now, 0.05));
      if (list.some(d => d.playing !== false)) this.start(); else this.stop();
    },
    silence() {
      if (!this.ready) return;
      this.stop();
      for (const id in this.tracks) this.dropTrack(id);
    },

    // ------------------------------------------------------------ Le séquenceur
    schedule() {
      const ctx = this.ctx;
      const s = this.song;
      const stepDur = 60 / s.bpm / 4;
      while (this.nextTime < ctx.currentTime + 0.12) {
        const st = this.step;
        const bar = Math.floor(st / 16), pos = st % 16;
        const ch = s.prog[bar % s.prog.length];
        for (const id in this.tracks) {
          const t = this.tracks[id];
          if (t.playing) this.play(t, pos, bar, ch, this.nextTime, stepDur);
        }
        this.step++;
        this.nextTime += stepDur;
      }
      this.beat = (((ctx.currentTime - this.t0) / (stepDur * 4)) % 1 + 1) % 1;
    },

    chordNotes(ch, base) {
      const s = this.song;
      const scale = s.rock ? MINOR : MAJOR;
      const deg = ch[0];
      const root = s.key + scale[deg % 7] + (deg >= 7 ? 12 : 0);
      const third = ch[1] === 'm' ? 3 : 4;
      const r = base + ((root - base) % 12 + 12) % 12;
      return [r, r + third, r + 7];
    },
    melodyNote(bar, pos, ch) {
      // une mélodie qui revient toutes les 4 mesures, sur les notes de l’accord
      const seed = ((bar % 4) * 31 + pos * 7) % 13;
      const tones = this.chordNotes(ch, 64);
      const pick = [0, 1, 2, 1, 2, 0, 1, 2, 2, 1, 0, 2, 1][seed];
      return tones[pick] + (seed === 5 ? 2 : 0);
    },

    play(t, pos, bar, ch, time, sd) {
      const g = t.src;
      const ty = t.type;
      const on8 = pos % 2 === 0, on4 = pos % 4 === 0;
      const rock = this.song.rock;
      switch (ty) {
        case 'voix': case 'soliste': {
          if (pos % 4 === 0 || pos === 6 || pos === 14) {
            const n = this.melodyNote(bar, pos, ch) + (ty === 'soliste' ? 12 : 0);
            const len = pos === 12 ? sd * 4 : sd * (pos % 4 === 0 ? 3.6 : 1.8);
            this.voice(g, mtof(n), time, len, VOWELS[(bar + pos) % 5], ty === 'soliste' ? 1.12 : 1, 0.3);
          }
          break;
        }
        case 'chorale': {
          if (pos === 0 || pos === 8) {
            const tones = this.chordNotes(ch, 64);
            for (let i = 0; i < 3; i++) this.voice(g, mtof(tones[i] + 12), time + i * 0.01, sd * 7.6, VOWELS[1], 1.15, 0.12, 6 + i * 3);
          }
          break;
        }
        case 'parole': {
          if (Math.random() < 0.75 && !(bar % 4 === 3 && pos > 8)) {
            const f = 170 * (1 + (Math.random() - 0.5) * 0.25) * (pos < 4 ? 1.1 : 1);
            this.voice(g, f, time, sd * (0.6 + Math.random() * 0.6), VOWELS[Math.floor(Math.random() * 5)], 1.05, 0.32, 0, true);
          }
          break;
        }
        case 'guitare_folk': {
          const pat = [0, 3, 6, 8, 10, 12, 14];
          if (pat.includes(pos)) {
            const tones = this.chordNotes(ch, 52);
            const down = pos % 4 !== 2;
            const notes = [tones[0] - 12, tones[0], tones[1], tones[2], tones[0] + 12];
            notes.forEach((n, i) => this.pluck(g, n, time + (down ? i : notes.length - i) * 0.012, 0.14 * (pos === 0 ? 1 : 0.7)));
          }
          break;
        }
        case 'guitare_elec': {
          if (rock ? on8 : on4) {
            const r = this.chordNotes(ch, 40)[0];
            [r, r + 7, r + 12].forEach((n, i) => this.pluck(g, n, time + i * 0.006, 0.1, 0.99));
          }
          break;
        }
        case 'piano': {
          if (pos === 0 || pos === 8) { const tones = this.chordNotes(ch, 55); tones.forEach((n, i) => this.piano(g, n, time + i * 0.01, 0.1, 2.2)); this.piano(g, tones[0] - 12, time, 0.12, 2.4); }
          if (pos === 4 || pos === 12) { const tones = this.chordNotes(ch, 67); this.piano(g, tones[(bar + pos) % 3], time, 0.07, 1.2); }
          break;
        }
        case 'clavier': {
          if (pos === 0 || pos === 6 || pos === 10) { const tones = this.chordNotes(ch, 57); tones.forEach((n) => this.epiano(g, n, time, 0.07, 1.4)); }
          break;
        }
        case 'basse': {
          if (pos === 0 || pos === 6 || pos === 8 || (rock && on8)) {
            const r = this.chordNotes(ch, 36)[0];
            this.bass(g, r + (pos === 6 && !rock ? 7 : 0), time, sd * (rock ? 1.8 : 2.6), 0.32);
          }
          break;
        }
        case 'gc': if (pos === 0 || pos === 8 || (rock && pos === 10)) this.kick(g, time, 0.9); break;
        case 'cc': if (pos === 4 || pos === 12) this.snare(g, time, 0.55); break;
        case 'oh': if (on8) this.hat(g, time, pos === 0 && bar % 2 === 0 ? 0.35 : 0.12, pos === 0 && bar % 2 === 0); break;
        case 'cajon': {
          if (pos === 0 || pos === 10) this.kick(g, time, 0.5, 110);
          if (pos === 4 || pos === 12) this.snare(g, time, 0.3, true);
          if (pos % 2 === 1 && Math.random() < 0.4) this.snare(g, time, 0.08, true);
          break;
        }
        case 'flute': if (pos === 0 || pos === 8 || pos === 12) this.flute(g, mtof(this.melodyNote(bar + 1, pos, ch) + 12), time, sd * (pos === 12 ? 3.6 : 7.4), 0.16); break;
        case 'violon': if (pos === 0 || pos === 8) this.violin(g, mtof(this.melodyNote(bar + 2, pos, ch)), time, sd * 7.8, 0.13); break;
        case 'saxo': case 'trompette': if (on4) this.violin(g, mtof(this.melodyNote(bar, pos, ch)), time, sd * 3.6, 0.12, true); break;
        default: break;
      }
    },

    // ------------------------------------------------------------ Instruments
    env(gain, t, a, peak, d, sus, rel, len) {
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(peak, t + a);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sus), t + a + d);
      gain.gain.setValueAtTime(Math.max(0.0001, peak * sus), t + Math.max(a + d, len));
      gain.gain.exponentialRampToValueAtTime(0.0001, t + len + rel);
    },

    voice(out, f, t, len, vowel, fmul, amp, detune, speech) {
      const ctx = this.ctx;
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
      o1.type = 'sawtooth'; o2.type = 'sawtooth';
      o1.frequency.value = f; o2.frequency.value = f;
      o1.detune.value = -6 - (detune || 0); o2.detune.value = 6 + (detune || 0);
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 5.2; lg.gain.value = speech ? 0 : f * 0.012;
      lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
      if (speech) { o1.frequency.setValueAtTime(f * 1.08, t); o1.frequency.linearRampToValueAtTime(f * 0.9, t + len); o2.frequency.setValueAtTime(f * 1.08, t); o2.frequency.linearRampToValueAtTime(f * 0.9, t + len); }
      const mix = ctx.createGain(); mix.gain.value = 0.5;
      o1.connect(mix); o2.connect(mix);
      const g = ctx.createGain();
      const amps = [1, 0.5, 0.25];
      vowel.forEach((fv, i) => {
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fv * (fmul || 1); bp.Q.value = 9;
        const bg = ctx.createGain(); bg.gain.value = amps[i] * 3;
        mix.connect(bp); bp.connect(bg); bg.connect(g);
      });
      this.env(g, t, speech ? 0.02 : 0.06, amp, 0.1, 0.8, speech ? 0.05 : 0.15, len);
      g.connect(out);
      const end = t + len + 0.3;
      [o1, o2, lfo].forEach(o => { o.start(t); o.stop(end); });
    },

    ks(midi, decay) {
      const key = midi + ':' + (decay || 0.996);
      if (this.ksCache[key]) return this.ksCache[key];
      const ctx = this.ctx, sr = ctx.sampleRate;
      const len = Math.floor(sr * 1.8);
      const buf = ctx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      const N = Math.max(2, Math.round(sr / mtof(midi)));
      for (let i = 0; i < N; i++) d[i] = Math.random() * 2 - 1;
      const k = decay || 0.996;
      for (let i = N; i < len; i++) d[i] = k * 0.5 * (d[i - N] + d[i - N + 1]);
      this.ksCache[key] = buf;
      return buf;
    },
    pluck(out, midi, t, amp, decay) {
      const ctx = this.ctx;
      const s = ctx.createBufferSource(); s.buffer = this.ks(midi, decay);
      const g = ctx.createGain(); g.gain.value = amp;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200;
      s.connect(lp); lp.connect(g); g.connect(out);
      s.start(t); s.stop(t + 1.8);
    },
    piano(out, midi, t, amp, len) {
      const ctx = this.ctx, f = mtof(midi);
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator();
      o.type = 'triangle'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 2.001; o3.type = 'sine'; o3.frequency.value = f * 3.003;
      const g = ctx.createGain(), g2 = ctx.createGain(), g3 = ctx.createGain();
      g2.gain.value = 0.35; g3.gain.value = 0.12;
      o.connect(g); o2.connect(g2); g2.connect(g); o3.connect(g3); g3.connect(g);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + 0.006);
      g.gain.exponentialRampToValueAtTime(amp * 0.25, t + 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      g.connect(out);
      [o, o2, o3].forEach(x => { x.start(t); x.stop(t + len + 0.05); });
    },
    epiano(out, midi, t, amp, len) {
      const ctx = this.ctx, f = mtof(midi);
      const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain();
      car.frequency.value = f; mod.frequency.value = f; mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(f * 0.1, t + 0.6);
      mod.connect(mg); mg.connect(car.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      car.connect(g); g.connect(out);
      [car, mod].forEach(x => { x.start(t); x.stop(t + len + 0.05); });
    },
    bass(out, midi, t, len, amp) {
      const ctx = this.ctx, f = mtof(midi);
      const o = ctx.createOscillator(), s = ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = f; s.type = 'sine'; s.frequency.value = f;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(260, t + 0.25);
      const g = ctx.createGain();
      o.connect(lp); s.connect(g); lp.connect(g);
      this.env(g, t, 0.008, amp, 0.2, 0.6, 0.08, len);
      g.connect(out);
      [o, s].forEach(x => { x.start(t); x.stop(t + len + 0.2); });
    },
    kick(out, t, amp, f0) {
      const ctx = this.ctx;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(f0 || 150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(amp, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.4);
      const n = ctx.createBufferSource(); n.buffer = A.noiseBuf;
      const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 3000;
      const ng = ctx.createGain(); ng.gain.setValueAtTime(amp * 0.15, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
      n.connect(hp); hp.connect(ng); ng.connect(out); n.start(t, Math.random()); n.stop(t + 0.03);
    },
    snare(out, t, amp, slap) {
      const ctx = this.ctx;
      const n = ctx.createBufferSource(); n.buffer = A.noiseBuf;
      const bp = ctx.createBiquadFilter(); bp.type = slap ? 'bandpass' : 'highpass'; bp.frequency.value = slap ? 2200 : 1400;
      const g = ctx.createGain(); g.gain.setValueAtTime(amp, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (slap ? 0.08 : 0.18));
      n.connect(bp); bp.connect(g); g.connect(out); n.start(t, Math.random()); n.stop(t + 0.2);
      if (!slap) {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
        og.gain.setValueAtTime(amp * 0.6, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
        o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.12);
      }
    },
    hat(out, t, amp, crash) {
      const ctx = this.ctx;
      const n = ctx.createBufferSource(); n.buffer = A.noiseBuf;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = crash ? 5000 : 7500;
      const g = ctx.createGain(); g.gain.setValueAtTime(amp, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (crash ? 1.2 : 0.05));
      n.connect(hp); hp.connect(g); g.connect(out); n.start(t, Math.random()); n.stop(t + (crash ? 1.3 : 0.08));
    },
    flute(out, f, t, len, amp) {
      const ctx = this.ctx;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5; lg.gain.value = f * 0.008;
      lfo.connect(lg); lg.connect(o.frequency);
      const g = ctx.createGain();
      this.env(g, t, 0.08, amp, 0.1, 0.85, 0.12, len);
      o.connect(g); g.connect(out);
      const n = ctx.createBufferSource(); n.buffer = A.noiseBuf;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 3;
      const ng = ctx.createGain(); this.env(ng, t, 0.05, amp * 0.25, 0.1, 0.5, 0.1, len);
      n.connect(bp); bp.connect(ng); ng.connect(out);
      [o, lfo].forEach(x => { x.start(t); x.stop(t + len + 0.2); });
      n.start(t, Math.random()); n.stop(t + len + 0.2);
    },
    violin(out, f, t, len, amp, brass) {
      const ctx = this.ctx;
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.5;
      lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.01, t + 0.4);
      lfo.connect(lg); lg.connect(o.frequency);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = brass ? 2200 : 3200;
      const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = brass ? 1200 : 2600; pk.gain.value = 6;
      const g = ctx.createGain();
      this.env(g, t, brass ? 0.04 : 0.15, amp, 0.2, 0.8, 0.2, len);
      o.connect(lp); lp.connect(pk); pk.connect(g); g.connect(out);
      [o, lfo].forEach(x => { x.start(t); x.stop(t + len + 0.3); });
    }
  };

  root.SonoMusic = M;
})(this);
