/* Sono Sim — audio (Web Audio) : larsen, résonances, saturation, applaudissements, sons d’entraînement.
 * Le volume est volontairement plafonné : un larsen simulé doit alerter, pas faire mal. */
(function (root) {
  'use strict';

  const A = {
    ctx: null, master: null, enabled: false, volume: 0.5,
    fb: null, noiseBuf: null
  };

  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return true; }
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return false;
    const ctx = new AC();
    A.ctx = ctx;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12; limiter.knee.value = 6; limiter.ratio.value = 12;
    limiter.attack.value = 0.003; limiter.release.value = 0.2;
    A.master = ctx.createGain();
    A.master.gain.value = A.volume * 0.5;
    A.master.connect(limiter); limiter.connect(ctx.destination);

    // bruit blanc réutilisable
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    A.noiseBuf = buf;

    // voix du larsen : sinus + un peu d’harmonique 2
    const o1 = ctx.createOscillator(); o1.type = 'sine';
    const o2 = ctx.createOscillator(); o2.type = 'sine';
    const g2 = ctx.createGain(); g2.gain.value = 0.12;
    const g = ctx.createGain(); g.gain.value = 0;
    o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(A.master);
    o1.frequency.value = 1000; o2.frequency.value = 2000;
    o1.start(); o2.start();
    A.fb = { o1, o2, g, freq: 1000 };
    A.enabled = true;
    return true;
  };

  A.setEnabled = function (on) {
    A.enabled = on;
    if (!A.ctx) return;
    A.master.gain.setTargetAtTime(on ? A.volume * 0.5 : 0, A.ctx.currentTime, 0.05);
  };

  A.setVolume = function (v) {
    A.volume = v;
    if (A.ctx && A.enabled) A.master.gain.setTargetAtTime(v * 0.5, A.ctx.currentTime, 0.05);
  };

  // amp : 0..1 (déjà mis à l’échelle par le jeu)
  A.setFeedback = function (freq, amp) {
    if (!A.ctx) return;
    const t = A.ctx.currentTime;
    if (Math.abs(freq - A.fb.freq) > 1) {
      A.fb.freq = freq;
      A.fb.o1.frequency.setTargetAtTime(freq, t, 0.02);
      A.fb.o2.frequency.setTargetAtTime(freq * 2, t, 0.02);
    }
    A.fb.g.gain.setTargetAtTime(Math.max(0, Math.min(1, amp)) * 0.6, t, 0.04);
  };

  // résonance brève (système proche du larsen : « ça sonne »)
  A.ring = function (freq, amp, decay) {
    if (!A.ctx || !A.enabled) return;
    const ctx = A.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp * 0.4, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (decay || 0.9));
    o.connect(g); g.connect(A.master);
    o.start(t); o.stop(t + (decay || 0.9) + 0.05);
  };

  // craquement de saturation
  A.crackle = function (amp) {
    if (!A.ctx || !A.enabled) return;
    const ctx = A.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = A.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    for (let i = 0; i < 6; i++) {
      const tt = t + i * 0.025 + Math.random() * 0.01;
      g.gain.setValueAtTime(amp * 0.25 * Math.random(), tt);
      g.gain.setValueAtTime(0, tt + 0.006);
    }
    s.connect(f); f.connect(g); g.connect(A.master);
    s.start(t, Math.random()); s.stop(t + 0.2);
  };

  // son pur pour l’entraînement d’oreille, avec une enveloppe de « résonance »
  A.tone = function (freq, dur, opts) {
    if (!A.ctx) return null;
    opts = opts || {};
    const ctx = A.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const g = ctx.createGain();
    const peak = opts.amp != null ? opts.amp : 0.35;
    g.gain.setValueAtTime(0.0001, t);
    if (opts.grow) {
      g.gain.exponentialRampToValueAtTime(peak, t + dur);
    } else {
      g.gain.exponentialRampToValueAtTime(peak, t + 0.05);
      g.gain.setValueAtTime(peak, t + dur - 0.15);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }
    o.connect(g); g.connect(A.master);
    o.start(t); o.stop(t + dur + 0.05);
    return {
      stop() {
        try {
          const n = ctx.currentTime;
          g.gain.cancelScheduledValues(n);
          g.gain.setTargetAtTime(0.0001, n, 0.03);
          o.stop(n + 0.2);
        } catch (e) { /* déjà arrêté */ }
      }
    };
  };

  // bruit rose filtré pour comparer : « voilà ce que fait cette bande »
  A.applause = function (dur) {
    if (!A.ctx || !A.enabled) return;
    const ctx = A.ctx, t0 = ctx.currentTime;
    const n = Math.floor(dur * 60);
    for (let i = 0; i < n; i++) {
      const t = t0 + Math.random() * dur;
      const s = ctx.createBufferSource(); s.buffer = A.noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass';
      f.frequency.value = 900 + Math.random() * 1800; f.Q.value = 1.2;
      const g = ctx.createGain();
      const env = Math.min(1, (t - t0) / 0.4) * Math.min(1, (t0 + dur - t) / 1.2);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18 * env, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      s.connect(f); f.connect(g); g.connect(A.master);
      s.start(t, Math.random() * 1.5); s.stop(t + 0.08);
    }
  };

  root.SonoAudio = A;
})(this);
