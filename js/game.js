/* Sono Sim — contrôleur du jeu : concert (scènes, spectacle, notes), atelier libre, panneaux. */
(function (root) {
  'use strict';
  const D = root.SonoData;
  const E = root.SonoEngine;
  const S = root.SonoState;
  const U = root.SonoUI;
  const A = root.SonoAudio;
  const Stage = root.SonoStage;
  const Mixer = root.SonoMixer;
  const h = U.h;
  const $ = (id) => document.getElementById(id);
  const AUX_COL = ['var(--aux1)', 'var(--aux2)', 'var(--aux3)', 'var(--aux4)'];
  const TICK = 50;

  const G = {
    states: { concert: null, atelier: null },
    state: null,
    view: 'concert',
    ui: { help: true, layer: 'main', sel: null, armed: null, selCh: null, sideTab: 'scene' },
    fx: { larsenOn: false, ampDb: -80, freq: 1000, spk: null, micUid: null, needs: [], loop: null, levels: [], aud: null, ringT: 0, clipT: 0 },
    show: null,
    frame: 0,
    stageDirty: true,
    sideDirty: true,
    best: {},

    // ------------------------------------------------------------ Démarrage
    boot() {
      this.best = U.store.get('best', {});
      this.ui.help = U.store.get('help', true);
      $('opt-help').checked = this.ui.help;
      document.body.classList.toggle('expert', !this.ui.help);

      this.states.concert = S.newState('concert');
      S.loadScene(this.states.concert, 0);
      this.states.atelier = this.makeAtelier();
      this.state = this.states.concert;
      this.silence();

      Stage.init($('stage'), this);
      Mixer.init($('console'), this);

      document.querySelectorAll('.tabs [data-view]').forEach(b => b.addEventListener('click', () => this.switchView(b.dataset.view)));
      document.querySelectorAll('.side-tabs [data-tab]').forEach(b => b.addEventListener('click', () => this.setSideTab(b.dataset.tab)));
      $('opt-help').addEventListener('change', (e) => {
        this.ui.help = e.target.checked;
        U.store.set('help', this.ui.help);
        document.body.classList.toggle('expert', !this.ui.help);
        this.stageDirty = true; this.sideDirty = true;
      });
      $('btn-sound').addEventListener('click', () => this.toggleSound());
      $('vol').addEventListener('input', (e) => A.setVolume(parseFloat(e.target.value)));
      $('scene-select').addEventListener('change', (e) => this.gotoScene(parseInt(e.target.value, 10)));
      $('btn-phase').addEventListener('click', () => this.phaseAction());
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          if (!$('modal').hidden && this.state.phase !== 'debrief') return;
          if (Mixer.geqOpen != null) { Mixer.closeGeq(); return; }
          this.disarm(); this.select(null);
        }
      });

      this.renderSceneSelect();
      this.renderAll();
      if (root.SonoLearn) root.SonoLearn.init(this);
      setInterval(() => this.tick(), TICK);
      const hash = (location.hash || '').replace('#', '');
      if (['atelier', 'oreille', 'quiz', 'fiches'].includes(hash)) this.switchView(hash);
      else this.openBrief();
    },

    makeAtelier() {
      const st = S.newState('atelier');
      st.sources = [
        S.makeSource({ id: 'voix', type: 'voix', name: 'Chanteur', x: 4.2, y: 3.6 }),
        S.makeSource({ id: 'guitare_folk', type: 'guitare_folk', name: 'Guitariste', x: 6.0, y: 3.4 })
      ];
      const m1 = S.addMic(st, 'sm58', 'voix').mic;
      const m2 = S.addMic(st, 'km184', 'guitare_folk').mic;
      const c0 = st.channels[m1.ch], c1 = st.channels[m2.ch];
      c0.gain = 44; c0.hpf = true; c0.fader = -2; c0.sends[0] = -6;
      c1.gain = 42; c1.phantom = true; c1.hpf = true; c1.fader = -6; c1.sends[0] = -14;
      S.addWedge(st, 4.2, 4.5, 0);
      return st;
    },

    switchView(v) {
      this.view = v;
      document.querySelectorAll('.tabs [data-view]').forEach(b => {
        b.classList.toggle('on', b.dataset.view === v);
        b.setAttribute('aria-selected', String(b.dataset.view === v));
      });
      const sim = v === 'concert' || v === 'atelier';
      $('view-sim').hidden = !sim;
      ['oreille', 'quiz', 'fiches'].forEach(k => { $('view-' + k).hidden = v !== k; });
      if (sim) {
        if (this.show && this.state.mode !== v) this.abortShow();
        this.state = this.states[v];
        this.ui.sel = null; this.ui.armed = null; this.ui.selCh = null;
        document.body.dataset.mode = v;
        this.renderSceneSelect();
        this.renderAll();
      } else {
        this.fx.ampDb = -80;
        document.body.classList.remove('larsen');
        A.setFeedback(1000, 0);
        if (root.SonoLearn) root.SonoLearn.show(v);
      }
      if (this.ui.armed) this.disarm();
      if (v !== 'oreille' && root.SonoLearn) root.SonoLearn.stopEar();
    },

    toggleSound() {
      const btn = $('btn-sound');
      if (!A.ctx) {
        A.init();
        btn.classList.add('on');
        btn.textContent = 'Son activé';
        btn.setAttribute('aria-pressed', 'true');
        return;
      }
      const on = !A.enabled;
      A.setEnabled(on);
      btn.classList.toggle('on', on);
      btn.textContent = on ? 'Son activé' : 'Son coupé';
      btn.setAttribute('aria-pressed', String(on));
    },

    // ------------------------------------------------------------ État / actions
    scene() { return this.state.mode === 'concert' ? D.SCENES[this.state.sceneIdx] : null; },
    canEdit() { return this.state.phase !== 'show'; },

    say(msg, kind, ms) { U.toast($('toasts'), msg, kind, ms); },

    changed(what, i) {
      if (what === 'gain' && this.live && this.live.trGain && i === this.ui.selCh) this.live.trGain.setValue(this.state.channels[i].gain);
      if (what === 'phantom' || what === 'mute' || what === 'hpf') this.sideDirty = true;
      if (this.ui.sideTab === 'tranche' && what !== 'fader' && what !== 'gain') this.sideDirty = true;
    },

    stageChanged(final) {
      this.stageDirty = true;
      if (final) this.sideDirty = true;
    },

    arm(kind, type) {
      if (!this.canEdit()) { this.say('Pendant le spectacle, on ne touche plus au plateau !', 'warn'); return; }
      if (this.ui.armed && this.ui.armed.kind === kind && this.ui.armed.type === type) { this.disarm(); return; }
      this.ui.armed = { kind, type };
      const label = kind === 'mic' ? 'Clique sur le musicien qui reçoit ce micro.'
        : kind === 'wedge' ? 'Clique sur la scène pour poser le retour (devant le musicien).'
          : 'Clique sur la scène pour placer le musicien.';
      $('armed-hint').hidden = false;
      $('armed-text').textContent = label;
      document.body.classList.add('armed');
      this.sideDirty = true; this.stageDirty = true;
    },
    disarm() {
      this.ui.armed = null;
      $('armed-hint').hidden = true;
      document.body.classList.remove('armed');
      this.sideDirty = true; this.stageDirty = true;
    },

    attachMic(type, srcId) {
      const r = S.addMic(this.state, type, srcId);
      if (r.error) { this.say(r.error, 'warn'); return; }
      const src = E.findSource(this.state, srcId);
      const [sc, note] = D.suitability(src.type, type);
      if (this.ui.help) this.say((sc >= 3 ? 'Bon choix. ' : sc === 2 ? 'Ça passe. ' : 'Hmm… ') + note, sc >= 2 ? 'ok' : 'warn', 6500);
      if (D.MICS[type].phantom && this.ui.help) this.say('Voie ' + (r.mic.ch + 1) + ' : pense à activer le 48 V.', 'info');
      if (S.stock(this.state, type) <= 0 || !this.state.unlimited) this.disarm();
      this.ui.sel = { kind: 'mic', id: r.mic.uid };
      this.ui.selCh = r.mic.ch;
      Mixer.refresh();
      this.stageChanged(true);
      this.renderInspector();
    },

    placeWedge(x, y) {
      const r = S.addWedge(this.state, x, y);
      if (r.error) { this.say(r.error, 'warn'); return; }
      this.aimWedge(r.wedge);
      this.disarm();
      this.ui.sel = { kind: 'wedge', id: r.wedge.uid };
      if (this.ui.help) this.say('Retour posé sur la sortie « Retour ' + (r.wedge.bus + 1) + ' ». Sur la console, choisis RETOUR ' + (r.wedge.bus + 1) + ' pour régler ce qu’il diffuse.', 'info', 6500);
      this.stageChanged(true);
      this.renderInspector();
    },

    aimWedge(w) {
      let best = null, bd = Infinity;
      for (const s of this.state.sources) {
        const d = Math.hypot(s.x - w.x, s.y - w.y);
        if (d < bd) { bd = d; best = s; }
      }
      if (best && bd > 0.05) w.angle = Math.atan2(best.y - w.y, best.x - w.x);
    },

    placeSource(type, x, y) {
      const st = this.state;
      let n = 1;
      while (st.sources.some(s => s.id === type + (n > 1 ? n : ''))) n++;
      const id = type + (n > 1 ? n : '');
      const src = S.makeSource({ id, type, name: D.SOURCES[type].name + (n > 1 ? ' ' + n : ''), x, y });
      st.sources.push(src);
      this.disarm();
      this.ui.sel = { kind: 'source', id };
      this.stageChanged(true);
      this.renderInspector();
    },

    removeSource(id) {
      const st = this.state;
      st.sources = st.sources.filter(s => s.id !== id);
      this.select(null);
      Mixer.refresh();
      this.stageChanged(true);
    },

    select(kind, id) {
      this.ui.sel = kind ? { kind, id } : null;
      if (kind === 'mic') {
        const m = this.state.mics.find(x => x.uid === id);
        if (m) { this.ui.selCh = m.ch; Mixer.refresh(); if (this.ui.sideTab === 'tranche') this.sideDirty = true; }
      }
      this.stageDirty = true;
      this.renderInspector();
    },

    selectChannel(i) {
      this.ui.selCh = i;
      const m = this.state.mics.find(x => x.ch === i);
      if (m) this.ui.sel = { kind: 'mic', id: m.uid };
      Mixer.refresh();
      this.setSideTab('tranche');
      this.stageDirty = true;
      this.renderInspector();
    },

    setSideTab(t) {
      this.ui.sideTab = t;
      document.querySelectorAll('.side-tabs [data-tab]').forEach(b => {
        b.classList.toggle('on', b.dataset.tab === t);
        b.setAttribute('aria-selected', String(b.dataset.tab === t));
      });
      this.sideDirty = true;
    },

    silence() {
      for (const s of this.state.sources) { s.playing = false; }
    },

    // ------------------------------------------------------------ Navigation concert
    renderSceneSelect() {
      const sel = $('scene-select');
      sel.innerHTML = '';
      if (this.state.mode !== 'concert') {
        sel.hidden = true;
        $('scene-title').textContent = 'Atelier libre';
        $('scene-sub').textContent = 'Matériel illimité, aucun chrono : expérimente.';
        return;
      }
      sel.hidden = false;
      D.SCENES.forEach((sc, i) => {
        const b = this.best[sc.id];
        const o = h('option', { value: String(i) }, (i + 1) + '. ' + sc.title + (b != null ? '  (' + b + '/100)' : ''));
        if (i === this.state.sceneIdx) o.selected = true;
        sel.appendChild(o);
      });
      const sc = this.scene();
      $('scene-title').textContent = sc.title;
      $('scene-sub').textContent = sc.subtitle;
    },

    gotoScene(idx) {
      if (this.show) this.abortShow();
      const st = this.state;
      S.loadScene(st, idx);
      st.phase = 'prep';
      this.silence();
      this.ui.sel = null;
      this.renderSceneSelect();
      this.renderAll();
      this.openBrief();
    },

    phaseAction() {
      const st = this.state;
      if (st.mode !== 'concert') return;
      if (st.phase === 'show') this.abortShow();
      else this.startShow();
    },

    // ------------------------------------------------------------ Modales
    openModal(content) {
      const m = $('modal');
      const box = $('modal-box');
      box.innerHTML = '';
      box.appendChild(content);
      m.hidden = false;
      const f = box.querySelector('button.primary');
      if (f) f.focus();
    },
    closeModal() { $('modal').hidden = true; },

    openBrief() {
      const sc = this.scene();
      if (!sc) return;
      const idx = this.state.sceneIdx;
      const needs = sc.needs.map(n => {
        const who = sc.sources.find(s => s.id === n.who);
        const wants = n.wants.map(w => (sc.sources.find(s => s.id === w) || {}).name || w).join(' + ');
        return h('li', null, h('b', null, who ? who.name : n.who), ' veut entendre : ' + wants);
      });
      const content = h('div', { class: 'brief' },
        h('div', { class: 'brief-eyebrow' }, 'Plateau ' + (idx + 1) + ' sur ' + D.SCENES.length + ' · ' + sc.dur + ' s de spectacle'),
        h('h2', null, sc.title),
        h('p', { class: 'brief-text' }, sc.brief),
        h('div', { class: 'brief-cols' },
          h('div', null, h('h4', null, 'Sur scène'), h('ul', null, sc.sources.map(s => h('li', null, h('b', null, s.name), ' · ' + D.SOURCES[s.type].name)))),
          h('div', null, h('h4', null, 'Retours demandés'), needs.length ? h('ul', null, needs) : h('p', { class: 'muted' }, 'Aucun.'))),
        this.ui.help ? h('div', { class: 'brief-hints' }, h('h4', null, 'Conseils du frangin'), h('ul', null, sc.hints.map(t => h('li', null, t)))) : null,
        h('div', { class: 'brief-steps' },
          h('span', null, 'Pose les micros et les retours'), h('span', null, 'Fais jouer chaque musicien et règle tes gains'), h('span', null, 'Lève le rideau')),
        h('div', { class: 'modal-actions' },
          h('button', { class: 'primary', onclick: () => { this.closeModal(); this.setSideTab(this.state.mics.length ? 'scene' : 'valise'); } }, 'Préparer le plateau')));
      this.openModal(content);
    },

    // ------------------------------------------------------------ Spectacle
    startShow() {
      const st = this.state;
      const sc = this.scene();
      this.disarm();
      st.phase = 'show';
      for (const s of st.sources) { s.playing = true; s.lvlOffset = 0; s.distOffset = 0; s.aim = null; s.x = s.home.x; s.y = s.home.y; }
      this.show = {
        t: 0, dur: sc.dur, fired: new Set(), ends: [], log: [], reqDelta: {},
        acc: { ticks: 0, gainGood: 0, gainTot: 0, clip: {}, low: {}, dead: {}, larsenT: 0, ringT: 0, larsenBands: {}, larsenCh: {},
          mixOk: 0, mixTot: 0, mixErr: {}, leqOk: 0, over: 0, leqSum: 0, needsOk: 0, needsTot: 0, needsMiss: {} }
      };
      this.ui.sel = null;
      this.say('Rideau ! Le spectacle commence.', 'ok');
      A.applause(2.5);
      this.renderAll();
    },

    abortShow() {
      if (!this.show) return;
      this.resetSources();
      this.show = null;
      this.state.phase = 'prep';
      this.silence();
      this.fx.ampDb = -80;
      A.setFeedback(1000, 0);
      this.say('Spectacle interrompu.', 'info');
      this.renderAll();
    },

    resetSources() {
      for (const s of this.state.sources) { s.lvlOffset = 0; s.distOffset = 0; s.aim = null; s.x = s.home.x; s.y = s.home.y; }
    },

    runEvents(dt) {
      const sh = this.show;
      const st = this.state;
      const sc = this.scene();
      sh.t += dt;
      sc.events.forEach((ev, i) => {
        if (sh.fired.has(i) || sh.t < ev.t) return;
        sh.fired.add(i);
        const src = ev.source ? E.findSource(st, ev.source) : null;
        if (ev.type === 'distance' && src) src.distOffset += ev.delta;
        if (ev.type === 'level' && src) src.lvlOffset += ev.delta;
        if (ev.type === 'move' && src) { src.x = ev.to.x; src.y = ev.to.y; }
        if (ev.type === 'aim' && src) src.aim = ev.target;
        if (ev.type === 'request') sh.reqDelta[ev.who] = (sh.reqDelta[ev.who] || 0) + ev.delta;
        sh.ends.push({ at: ev.t + ev.dur, ev });
        sh.log.unshift({ t: ev.t, msg: ev.msg });
        this.say(ev.msg, 'event', 7000);
        this.stageDirty = true; this.sideDirty = true;
      });
      sh.ends = sh.ends.filter(x => {
        if (sh.t < x.at) return true;
        const ev = x.ev;
        const src = ev.source ? E.findSource(st, ev.source) : null;
        if (ev.type === 'distance' && src) src.distOffset -= ev.delta;
        if (ev.type === 'level' && src) src.lvlOffset -= ev.delta;
        if (ev.type === 'move' && src) { src.x = src.home.x; src.y = src.home.y; }
        if (ev.type === 'aim' && src) src.aim = null;
        if (ev.type === 'request') sh.reqDelta[ev.who] -= ev.delta;
        this.stageDirty = true;
        return false;
      });
    },

    accumulate(dt, levels, aud, needs) {
      const sh = this.show;
      const acc = sh.acc;
      const st = this.state;
      const sc = this.scene();
      acc.ticks++;
      for (const L of levels) {
        if (!L.mic) continue;
        const src = E.findSource(st, L.mic.sourceId);
        if (!src || !src.playing) continue;
        const ch = st.channels[L.ch];
        if (ch.mute) continue;
        acc.gainTot++;
        if (!L.alive) { acc.dead[L.ch] = (acc.dead[L.ch] || 0) + 1; continue; }
        if (L.peak > -0.5) acc.clip[L.ch] = (acc.clip[L.ch] || 0) + 1;
        else if (L.peak < -30) acc.low[L.ch] = (acc.low[L.ch] || 0) + 1;
        else acc.gainGood++;
      }
      if (this.fx.larsenOn) {
        acc.larsenT += dt;
        const b = this.fx.band;
        acc.larsenBands[b] = (acc.larsenBands[b] || 0) + dt;
        if (this.fx.ch >= 0) acc.larsenCh[this.fx.ch] = (acc.larsenCh[this.fx.ch] || 0) + dt;
        if (this.fx.spk && this.fx.spk !== 'L' && this.fx.spk !== 'R') acc.larsenWedgeT = (acc.larsenWedgeT || 0) + dt;
      } else if (this.fx.loop && this.fx.loop.worst.db > -3) acc.ringT += dt;
      const ref = aud.perSrc[sc.targets.ref];
      for (const id in sc.targets.mix) {
        const p = aud.perSrc[id];
        if (!p || !ref) continue;
        const [t, tol] = sc.targets.mix[id];
        const rel = p.total - ref.total;
        acc.mixTot++;
        if (Math.abs(rel - t) <= tol) acc.mixOk++;
        const e = acc.mixErr[id] || (acc.mixErr[id] = { sum: 0, n: 0 });
        e.sum += rel - t; e.n++;
      }
      const leq = this.fx.leq;
      acc.leqSum += leq;
      if (leq >= sc.targets.leq[0] && leq <= sc.targets.leq[1]) acc.leqOk++;
      if (leq > D.LIMITS.leqA) acc.over++;
      for (const n of needs) {
        acc.needsTot++;
        if (n.ok) acc.needsOk++;
        else acc.needsMiss[n.who] = (acc.needsMiss[n.who] || 0) + 1;
      }
    },

    endShow() {
      const st = this.state;
      const sc = this.scene();
      const acc = this.show.acc;
      const dt = TICK / 1000;
      const levels = this.fx.levels;
      const place = E.evaluatePlacement(st);
      const issues = E.auditPractices(st, levels);
      const chName = (i) => {
        const m = st.mics.find(x => x.ch === i);
        const src = m ? E.findSource(st, m.sourceId) : null;
        return 'voie ' + (i + 1) + (src ? ' (' + src.name + ')' : '');
      };
      const scores = [];
      const tips = [];
      const placeScore = place.length ? Math.round(place.reduce((a, p) => a + p.score, 0) / place.length * 100) : 100;
      scores.push({ k: 'Micros', v: placeScore, w: 15 });
      for (const p of place) if (p.score < 0.99) tips.push(p.note);

      let gainScore = acc.gainTot ? acc.gainGood / acc.gainTot * 100 : 100;
      for (const ch in acc.dead) tips.push('Pas de son sur la ' + chName(+ch) + ' : le micro (ou la DI active) a besoin du 48 V.');
      for (const ch in acc.clip) if (acc.clip[ch] * dt > 1) tips.push('La ' + chName(+ch) + ' a saturé pendant ' + Math.round(acc.clip[ch] * dt) + ' s : baisse le gain (pas le fader).');
      for (const ch in acc.low) if (acc.low[ch] * dt > 3) tips.push('La ' + chName(+ch) + ' arrivait trop faible : monte le gain pour que les crêtes atteignent −10 à −6 dBFS.');
      scores.push({ k: 'Gains', v: Math.round(gainScore), w: 15 });

      const larsenScore = Math.max(0, Math.round(100 - acc.larsenT * 15 - acc.ringT * 2));
      if (acc.larsenT > 0) {
        let topB = 0, tb = 0;
        for (const b in acc.larsenBands) if (acc.larsenBands[b] > tb) { tb = acc.larsenBands[b]; topB = +b; }
        let topC = -1, tc = 0;
        for (const c in acc.larsenCh) if (acc.larsenCh[c] > tc) { tc = acc.larsenCh[c]; topC = +c; }
        const viaWedge = (acc.larsenWedgeT || 0) > acc.larsenT / 2;
        tips.push('Larsen pendant ' + acc.larsenT.toFixed(1).replace('.', ',') + ' s, surtout vers ' + U.fmtHz(D.BANDS[topB]) + (topC >= 0 ? ', sur la ' + chName(topC) : '') + '. ' + (viaWedge
          ? 'Il bouclait par un retour : le fader façade n’y change rien. Coupe la voie (MUTE) ou baisse son envoi, puis creuse cette bande sur l’EQ graphique du retour.'
          : 'Baisse le fader tout de suite, puis creuse cette bande sur l’EQ graphique de la façade.'));
      } else if (acc.ringT > 3) {
        tips.push('Pas de larsen, mais le système « sonnait » pendant ' + Math.round(acc.ringT) + ' s. Garde au moins 3 dB de marge.');
      }
      scores.push({ k: 'Larsen', v: larsenScore, w: 25 });

      const mixScore = acc.mixTot ? Math.round(acc.mixOk / acc.mixTot * 100) : 100;
      for (const id in acc.mixErr) {
        const e = acc.mixErr[id];
        const avg = e.sum / e.n;
        const tol = sc.targets.mix[id][1];
        const src = E.findSource(st, id);
        if (Math.abs(avg) > tol) tips.push((src ? src.name : id) + ' était en moyenne ' + (avg > 0 ? 'trop fort' : 'trop faible') + ' de ' + Math.abs(avg).toFixed(0) + ' dB dans le public.');
      }
      if (sc.targets.mix && Object.keys(sc.targets.mix).length) scores.push({ k: 'Équilibre', v: mixScore, w: 20 });

      let leqScore = Math.round(acc.leqOk / Math.max(1, acc.ticks) * 100);
      if (acc.over) { leqScore = Math.max(0, leqScore - 40); tips.push('Tu as dépassé ' + D.LIMITS.leqA + ' dB : c’est la limite légale, et il y a des enfants dans la salle.'); }
      const leqAvg = acc.leqSum / Math.max(1, acc.ticks);
      if (leqAvg < sc.targets.leq[0] || leqAvg > sc.targets.leq[1]) tips.push('Niveau moyen au public : ' + Math.round(leqAvg) + ' dB. Visé : ' + sc.targets.leq[0] + ' à ' + sc.targets.leq[1] + ' dB.');
      scores.push({ k: 'Volume', v: leqScore, w: 10 });

      if (sc.needs.length) {
        const nScore = acc.needsTot ? Math.round(acc.needsOk / acc.needsTot * 100) : 100;
        for (const who in acc.needsMiss) {
          if (acc.needsMiss[who] / Math.max(1, acc.ticks) > 0.25) {
            const src = E.findSource(st, who);
            const n = sc.needs.find(x => x.who === who);
            tips.push((src ? src.name : who) + ' ne s’entendait pas assez dans son retour (il faut : ' + n.wants.map(w => (E.findSource(st, w) || {}).name || w).join(', ') + ').');
          }
        }
        scores.push({ k: 'Retours', v: nScore, w: 10 });
      }
      const practice = Math.max(0, 100 - issues.length * 15);
      for (const i of issues) tips.push(i.text);
      scores.push({ k: 'Bonnes pratiques', v: practice, w: 5 });

      const wsum = scores.reduce((a, s) => a + s.w, 0);
      const total = Math.round(scores.reduce((a, s) => a + s.v * s.w, 0) / wsum);
      const prev = this.best[sc.id];
      if (prev == null || total > prev) { this.best[sc.id] = total; U.store.set('best', this.best); }

      this.resetSources();
      this.show = null;
      st.phase = 'prep';
      this.silence();
      this.fx.ampDb = -80;
      A.setFeedback(1000, 0);
      A.applause(total >= 60 ? 4 : 2);
      this.renderSceneSelect();
      this.renderAll();
      this.openDebrief(sc, total, scores, tips, prev);
    },

    openDebrief(sc, total, scores, tips, prev) {
      const idx = this.state.sceneIdx;
      const verdict = total >= 85 ? 'Le public n’a rien remarqué : c’est exactement ça, un bon son.'
        : total >= 65 ? 'Pas mal du tout. Quelques détails à corriger.'
          : total >= 40 ? 'Le spectacle est passé, mais la salle a souffert par moments.'
            : 'Aïe. On reprend calmement, un réglage à la fois.';
      const hasNext = idx < D.SCENES.length - 1;
      const content = h('div', { class: 'debrief' },
        h('div', { class: 'brief-eyebrow' }, 'Fin du plateau ' + (idx + 1) + ' · ' + sc.title),
        h('div', { class: 'score-big' }, h('span', { class: 'score-num' }, String(total)), h('span', { class: 'score-of' }, '/100')),
        h('p', { class: 'brief-text' }, verdict + (prev != null ? ' (meilleur score précédent : ' + prev + ')' : '')),
        h('div', { class: 'score-rows' }, scores.map(s => h('div', { class: 'score-row' },
          h('span', { class: 'score-k' }, s.k),
          h('span', { class: 'score-bar' }, h('i', { style: 'width:' + s.v + '%', class: s.v >= 75 ? 'g' : s.v >= 45 ? 'y' : 'r' })),
          h('span', { class: 'score-v' }, String(s.v))))),
        tips.length ? h('div', { class: 'brief-hints' }, h('h4', null, 'À retravailler'), h('ul', null, tips.slice(0, 8).map(t => h('li', null, t)))) : h('p', { class: 'muted' }, 'Rien à signaler. Bravo !'),
        h('div', { class: 'modal-actions' },
          h('button', { class: 'ghost', onclick: () => this.closeModal() }, 'Revoir mes réglages'),
          h('button', { class: hasNext ? 'ghost' : 'primary', onclick: () => { this.closeModal(); this.startShow(); } }, 'Rejouer'),
          hasNext ? h('button', { class: 'primary', onclick: () => { this.closeModal(); this.gotoScene(idx + 1); } }, 'Plateau suivant') : null));
      this.openModal(content);
    },

    // ------------------------------------------------------------ Boucle de simulation
    tick() {
      if (this.view !== 'concert' && this.view !== 'atelier') return;
      const st = this.state;
      const now = performance.now();
      const dt = TICK / 1000;
      this.frame++;
      const t = now / 1000;
      for (const s of st.sources) {
        if (s._ph == null) s._ph = Math.random() * 10;
        const base = 2 * Math.sin(t * 0.9 + s._ph) + 1.2 * Math.sin(t * 2.7 + s._ph * 2) + (Math.random() - 0.5) * 1.5 - 1;
        s.dyn = base;
      }
      if (this.show) this.runEvents(dt);

      const levels = E.computeLevels(st);
      const loop = E.computeLoop(st);
      const aud = E.computeAudience(st, levels);
      const sc = this.scene();
      const needs = E.checkNeeds(st, levels, sc ? sc.needs : [], this.show ? this.show.reqDelta : {});
      this.fx.levels = levels; this.fx.loop = loop; this.fx.aud = aud; this.fx.needs = needs;

      // larsen
      const w = loop.worst;
      const fx = this.fx;
      const anyPlaying = st.sources.some(s => s.playing !== false);
      if (w.db > 0) fx.ampDb = Math.min(0, fx.ampDb + (w.db + 2) * 14 * dt);
      else fx.ampDb = Math.max(-80, fx.ampDb - 45 * dt);
      const wasOn = fx.larsenOn;
      if (w.db > 0 || fx.ampDb > -45) {
        fx.band = w.band; fx.ch = w.ch;
        const m = st.mics.find(x => x.ch === w.ch);
        fx.micUid = m ? m.uid : null; fx.spk = w.spk;
        fx.freq = D.BANDS[w.band] * (1 + (((w.band * 37) % 10) - 5) / 140);
      }
      fx.larsenOn = fx.ampDb > -45;
      if (fx.larsenOn !== wasOn) {
        this.stageDirty = true;
        document.body.classList.toggle('larsen', fx.larsenOn);
        if (fx.larsenOn) {
          const viaWedge = fx.spk && fx.spk !== 'L' && fx.spk !== 'R';
          const wd = viaWedge ? st.wedges.find(x => x.uid === fx.spk) : null;
          if (this.ui.help) this.say('LARSEN vers ' + U.fmtHz(D.BANDS[fx.band]) + ' ! ' + (wd
            ? 'Ça boucle par le retour ' + (wd.bus + 1) + ' : coupe la voie ' + (fx.ch + 1) + ' (MUTE) ou baisse son envoi vers ce retour. Le fader façade n’y peut rien.'
            : 'Baisse vite le fader de la voie ' + (fx.ch + 1) + ' (ou coupe-la).'), 'danger', 5500);
          else this.say('Ça siffle !', 'danger', 3000);
        }
      }
      A.setFeedback(fx.freq, fx.ampDb > -60 ? Math.pow(10, fx.ampDb / 30) : 0);
      if (!fx.larsenOn && w.db > -4 && anyPlaying && now > fx.ringT) {
        A.ring(fx.freq || D.BANDS[w.band], 0.12 + (w.db + 4) * 0.07, 0.5 + (w.db + 4) * 0.35);
        fx.ringT = now + 1500 + Math.random() * 2500;
      }
      if (levels.some(L => L.alive && L.peak > 0 && L.src && L.src.playing) && now - fx.clipT > 350) {
        A.crackle(0.6); fx.clipT = now;
      }
      fx.leq = fx.larsenOn ? E.dbAdd(aud.leq, 100 + fx.ampDb * 0.8) : aud.leq;

      if (this.show) {
        this.accumulate(dt, levels, aud, needs);
        if (this.show.t >= this.show.dur) { this.endShow(); return; }
      }

      Mixer.update(levels, now);
      Mixer.updateGeqRisk(loop);
      if (this.show && this.frame % 4 === 0) this.stageDirty = true;
      if (this.frame % 10 === 0) this.stageDirty = true;
      if (this.stageDirty) { Stage.render(); this.stageDirty = false; }
      if (this.sideDirty) { this.renderSide(); this.sideDirty = false; }
      if (this.frame % 2 === 0) this.updateSideLive();
      this.updateHud();
    },

    // ------------------------------------------------------------ Rendu
    renderAll() {
      this.refreshPoses();
      Mixer.refresh();
      Stage.render();
      this.renderSide();
      this.renderInspector();
      this.updateHud();
      document.body.dataset.phase = this.state.phase;
      document.body.dataset.mode = this.state.mode;
    },

    refreshPoses() { for (const m of this.state.mics) E.micPose(this.state, m); },

    updateHud() {
      const st = this.state;
      document.body.dataset.phase = st.phase;
      const btn = $('btn-phase');
      btn.hidden = st.mode !== 'concert';
      btn.textContent = st.phase === 'show' ? 'Arrêter le spectacle' : 'Lever le rideau';
      btn.classList.toggle('stop', st.phase === 'show');
      $('phase-pill').textContent = st.mode === 'atelier' ? 'Atelier' : st.phase === 'show' ? 'Spectacle' : 'Préparation';
      const bar = $('show-progress');
      if (this.show) {
        bar.hidden = false;
        bar.firstChild.style.width = (this.show.t / this.show.dur * 100) + '%';
        $('show-time').textContent = Math.max(0, Math.ceil(this.show.dur - this.show.t)) + ' s';
      } else { bar.hidden = true; $('show-time').textContent = ''; }
      const leq = this.fx.leq;
      $('spl-val').textContent = leq > 20 ? Math.round(leq) : '—';
      const sc = this.scene();
      const spl = $('spl');
      spl.classList.remove('lo', 'ok', 'hi', 'max');
      if (leq > D.LIMITS.leqA) spl.classList.add('max');
      else if (sc && leq > 20) spl.classList.add(leq < sc.targets.leq[0] ? 'lo' : leq > sc.targets.leq[1] ? 'hi' : 'ok');
      $('larsen-led').classList.toggle('on', this.fx.larsenOn);
    },

    // ------------------------------------------------------------ Panneau latéral
    renderSide() {
      const body = $('side-body');
      body.innerHTML = '';
      this.live = {};
      const t = this.ui.sideTab;
      if (t === 'scene') body.appendChild(this.state.mode === 'concert' ? this.panelScene() : this.panelAtelier());
      else if (t === 'valise') body.appendChild(this.panelValise());
      else if (t === 'tranche') body.appendChild(this.panelTranche());
      else if (t === 'analyse') body.appendChild(this.panelAnalyse());
    },

    musicianRow(s) {
      const st = this.state;
      const def = D.SOURCES[s.type];
      const mics = st.mics.filter(m => m.sourceId === s.id);
      const playBtn = h('button', {
        class: 'play-btn' + (s.playing ? ' on' : ''), 'aria-pressed': String(!!s.playing), disabled: st.phase === 'show' ? true : null,
        onclick: () => { s.playing = !s.playing; this.sideDirty = true; this.stageDirty = true; }
      }, s.playing ? 'Joue' : 'Silence');
      const micTxt = mics.length ? mics.map(m => 'V' + (m.ch + 1) + ' ' + D.MICS[m.type].short).join(' · ') : 'aucun micro';
      return h('li', { class: 'mus-row' + (mics.length ? '' : ' nomic') },
        h('div', { class: 'mus-main' }, h('b', null, s.name), h('span', { class: 'mus-type' }, def.name + ' · ' + micTxt)),
        playBtn);
    },

    panelScene() {
      const st = this.state;
      const sc = this.scene();
      const wrap = h('div', { class: 'panel' });
      if (this.show) {
        wrap.appendChild(h('h3', null, 'Spectacle en cours'));
        wrap.appendChild(h('p', { class: 'muted' }, 'Garde les mains sur les faders. Réagis aux événements : on ne touche plus au plateau.'));
        wrap.appendChild(h('ul', { class: 'mus-list' }, st.sources.map(s => this.musicianRow(s))));
        wrap.appendChild(h('h4', null, 'Ce qui se passe'));
        const log = h('ol', { class: 'event-log' });
        for (const e of this.show.log) log.appendChild(h('li', null, h('span', { class: 'ev-t' }, Math.round(e.t) + ' s'), e.msg));
        if (!this.show.log.length) log.appendChild(h('li', { class: 'muted' }, 'Pour l’instant, tout va bien.'));
        wrap.appendChild(log);
        return wrap;
      }
      wrap.appendChild(h('h3', null, sc.title));
      wrap.appendChild(h('p', { class: 'muted' }, sc.brief));
      wrap.appendChild(h('div', { class: 'row-between' },
        h('h4', null, 'Balance : fais jouer les musiciens'),
        h('button', { class: 'btn-text', onclick: () => { const all = st.sources.every(s => s.playing); st.sources.forEach(s => { s.playing = !all; }); this.sideDirty = true; this.stageDirty = true; } }, st.sources.every(s => s.playing) ? 'Tout le monde se tait' : 'Tout le monde joue')));
      wrap.appendChild(h('ul', { class: 'mus-list' }, st.sources.map(s => this.musicianRow(s))));
      if (sc.needs.length) {
        wrap.appendChild(h('h4', null, 'Retours'));
        const ul = h('ul', { class: 'need-list' });
        for (const n of this.fx.needs) {
          const who = E.findSource(st, n.who);
          const txt = n.ok ? 'entend ce qu’il faut' : n.reason ? n.reason : 'il manque : ' + n.missing.map(w => (E.findSource(st, w) || {}).name || w).join(', ');
          ul.appendChild(h('li', { class: n.ok ? 'ok' : 'ko' }, h('b', null, who ? who.name : n.who), ' · ' + txt));
        }
        wrap.appendChild(ul);
        this.live.needs = ul;
      }
      if (this.ui.help) wrap.appendChild(h('div', { class: 'hint-box' }, h('h4', null, 'Conseils'), h('ul', null, sc.hints.map(x => h('li', null, x)))));
      wrap.appendChild(h('div', { class: 'panel-actions' },
        h('button', { class: 'btn-text', onclick: () => this.openBrief() }, 'Relire le brief'),
        h('button', { class: 'primary', onclick: () => this.startShow() }, 'Lever le rideau')));
      return wrap;
    },

    panelAtelier() {
      const st = this.state;
      const wrap = h('div', { class: 'panel' });
      wrap.appendChild(h('h3', null, 'Ton plateau'));
      wrap.appendChild(h('p', { class: 'muted' }, 'Ajoute des musiciens, déplace-les, change de micro, et regarde comment bouge la marge avant larsen dans l’onglet Analyse.'));
      if (st.sources.length) wrap.appendChild(h('ul', { class: 'mus-list' }, st.sources.map(s => this.musicianRow(s))));
      else wrap.appendChild(h('p', { class: 'muted' }, 'La scène est vide. Choisis un musicien ci-dessous.'));
      wrap.appendChild(h('h4', null, 'Ajouter un musicien'));
      const grid = h('div', { class: 'chip-grid' });
      for (const type of D.SOURCE_ORDER) {
        const armed = this.ui.armed && this.ui.armed.kind === 'source' && this.ui.armed.type === type;
        grid.appendChild(h('button', { class: 'chip' + (armed ? ' on' : ''), onclick: () => this.arm('source', type) }, D.SOURCES[type].name));
      }
      wrap.appendChild(grid);
      wrap.appendChild(h('div', { class: 'panel-actions' },
        h('button', { class: 'btn-text', onclick: () => { this.states.atelier = this.makeAtelier(); this.state = this.states.atelier; this.renderAll(); } }, 'Revenir à l’exemple'),
        h('button', { class: 'btn-text', onclick: () => { st.sources = []; st.mics = []; st.wedges = []; st.channels = st.channels.map(() => S.newChannel()); this.renderAll(); } }, 'Tout vider')));
      return wrap;
    },

    panelValise() {
      const st = this.state;
      const wrap = h('div', { class: 'panel' });
      wrap.appendChild(h('h3', null, st.unlimited ? 'Matériel (illimité)' : 'La valise de l’école'));
      wrap.appendChild(h('p', { class: 'muted' }, 'Choisis un micro, puis clique sur le musicien. Les micros restent en place d’un plateau à l’autre, comme en vrai.'));
      const list = h('ul', { class: 'case-list' });
      for (const type of D.MIC_ORDER) {
        const def = D.MICS[type];
        const left = S.stock(st, type);
        const armed = this.ui.armed && this.ui.armed.kind === 'mic' && this.ui.armed.type === type;
        list.appendChild(h('li', null, h('button', {
          class: 'case-item' + (armed ? ' on' : '') + (left <= 0 ? ' out' : ''), disabled: left <= 0 || !this.canEdit() ? true : null,
          onclick: () => this.arm('mic', type)
        },
        h('span', { class: 'case-short k-' + def.kind }, def.short),
        h('span', { class: 'case-main' }, h('b', null, def.name), h('span', { class: 'case-model' }, def.model + (def.phantom ? ' · 48 V' : '') + (def.kind !== 'di' ? ' · ' + D.PATTERNS[def.pattern].label.toLowerCase() : ''))),
        h('span', { class: 'case-count' }, left === Infinity ? '∞' : '×' + left))));
      }
      const wl = S.stock(st, 'wedge');
      const armedW = this.ui.armed && this.ui.armed.kind === 'wedge';
      list.appendChild(h('li', null, h('button', {
        class: 'case-item wedge-item' + (armedW ? ' on' : '') + (wl <= 0 ? ' out' : ''), disabled: wl <= 0 || !this.canEdit() ? true : null,
        onclick: () => this.arm('wedge')
      }, h('span', { class: 'case-short k-wedge' }, 'RET'), h('span', { class: 'case-main' }, h('b', null, 'Retour de scène'), h('span', { class: 'case-model' }, 'enceinte au sol, face au musicien')), h('span', { class: 'case-count' }, wl === Infinity ? '∞' : '×' + wl))));
      wrap.appendChild(list);
      const selDef = this.ui.armed && this.ui.armed.kind === 'mic' ? D.MICS[this.ui.armed.type] : null;
      if (selDef) wrap.appendChild(h('div', { class: 'hint-box' }, h('h4', null, selDef.name), h('p', null, selDef.desc)));
      if (this.canEdit()) {
        wrap.appendChild(h('div', { class: 'panel-actions' }, h('button', {
          class: 'btn-text', onclick: () => {
            st.mics.slice().forEach(m => S.removeMic(st, m.uid));
            st.wedges = [];
            this.select(null); Mixer.refresh(); this.stageChanged(true);
          }
        }, 'Tout ranger dans la valise')));
      }
      return wrap;
    },

    panelTranche() {
      const st = this.state;
      const i = this.ui.selCh;
      const wrap = h('div', { class: 'panel tranche' });
      if (i == null) {
        wrap.appendChild(h('h3', null, 'Tranche de console'));
        wrap.appendChild(h('p', { class: 'muted' }, 'Appuie sur SEL sous une voie de la console (ou clique sur un micro) pour régler son égaliseur et ses envois vers les retours.'));
        return wrap;
      }
      const ch = st.channels[i];
      const mic = st.mics.find(m => m.ch === i);
      const src = mic ? E.findSource(st, mic.sourceId) : null;
      const def = mic ? D.MICS[mic.type] : null;
      wrap.appendChild(h('div', { class: 'tr-head' },
        h('span', { class: 'ch-badge' }, String(i + 1)),
        h('div', null, h('h3', null, src ? src.name : mic ? D.MICS[mic.type].short + ' sans musicien' : 'Voie vide'),
          h('span', { class: 'muted' }, def ? def.name + ' · ' + def.model : 'Aucun micro branché'))));
      if (!mic) return wrap;
      const chg = (what) => { this.changed(what, i); Mixer.refreshStrip(i); this.drawEq(); };
      const row1 = h('div', { class: 'tr-row' });
      const b48 = h('button', { class: 'btn btn-48' + (ch.phantom ? ' on' : ''), 'aria-pressed': String(ch.phantom), onclick: () => { ch.phantom = !ch.phantom; chg('phantom'); this.sideDirty = true; } }, '48V');
      const bh = h('button', { class: 'btn btn-hpf' + (ch.hpf ? ' on' : ''), 'aria-pressed': String(ch.hpf), onclick: () => { ch.hpf = !ch.hpf; chg('hpf'); this.sideDirty = true; } }, 'HPF');
      const gain = U.knob({ label: 'GAIN', min: 0, max: 60, value: ch.gain, def: 20, step: 0.5, fmt: v => Math.round(v) + ' dB', onInput: v => { ch.gain = v; Mixer.refreshStrip(i); } });
      const hpfF = U.knob({ label: 'COUPE-BAS', min: 20, max: 400, value: ch.hpfFreq, log: true, def: 100, step: 1, fmt: v => Math.round(v) + ' Hz', onInput: v => { ch.hpfFreq = v; this.drawEq(); } });
      this.live.trGain = gain;
      row1.append(h('div', { class: 'tr-btns' }, b48, bh), gain, hpfF);
      wrap.appendChild(row1);
      wrap.appendChild(h('h4', null, 'Égaliseur'));
      const eqSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      eqSvg.setAttribute('class', 'eq-curve'); eqSvg.setAttribute('viewBox', '0 0 300 90');
      eqSvg.setAttribute('role', 'img'); eqSvg.setAttribute('aria-label', 'Courbe de l’égaliseur');
      this.live.eqSvg = eqSvg;
      wrap.appendChild(eqSvg);
      const row2 = h('div', { class: 'tr-row eq' },
        U.knob({ label: 'GRAVES', min: -15, max: 15, value: ch.low, def: 0, step: 0.5, fmt: v => U.fmtDb(v, 0), onInput: v => { ch.low = v; this.drawEq(); } }),
        U.knob({ label: 'MÉDIUM', min: -15, max: 15, value: ch.midG, def: 0, step: 0.5, fmt: v => U.fmtDb(v, 0), onInput: v => { ch.midG = v; this.drawEq(); } }),
        U.knob({ label: 'FRÉQ.', min: 200, max: 8000, value: ch.midF, log: true, def: 1000, step: 10, fmt: v => U.fmtHz(v), onInput: v => { ch.midF = v; this.drawEq(); } }),
        U.knob({ label: 'AIGUS', min: -15, max: 15, value: ch.high, def: 0, step: 0.5, fmt: v => U.fmtDb(v, 0), onInput: v => { ch.high = v; this.drawEq(); } }));
      wrap.appendChild(row2);
      wrap.appendChild(h('h4', null, 'Envois vers les retours (pré-fader)'));
      const row3 = h('div', { class: 'tr-row sends' });
      for (let k = 0; k < 4; k++) {
        row3.appendChild(U.knob({
          label: 'RET ' + (k + 1), min: -60, max: 10, value: Math.max(-60, ch.sends[k]), def: -60, step: 0.5, color: AUX_COL[k],
          fmt: v => v <= -59.9 ? '−∞' : U.fmtDb(v, 0),
          onInput: v => { ch.sends[k] = v <= -59.9 ? E.NEG : v; Mixer.refreshStrip(i); }
        }));
      }
      wrap.appendChild(row3);
      const info = h('div', { class: 'tr-info' });
      this.live.trInfo = info;
      wrap.appendChild(info);
      if (src && this.ui.help) {
        const stDef = D.SOURCES[src.type];
        wrap.appendChild(h('div', { class: 'hint-box' }, h('h4', null, stDef.name),
          h('p', null, stDef.tip),
          h('p', { class: 'muted' }, 'Coupe-bas conseillé : ' + (stDef.hpf ? stDef.hpf + ' Hz' : 'aucun') + (def.kind !== 'di' && !stDef.electric ? ' · distance idéale : ' + stDef.dist[0] + ' à ' + stDef.dist[1] + ' cm' : ''))));
      }
      setTimeout(() => this.drawEq(), 0);
      return wrap;
    },

    drawEq() {
      const svg = this.live && this.live.eqSvg;
      if (!svg || this.ui.selCh == null) return;
      const ch = this.state.channels[this.ui.selCh];
      const NSs = 'http://www.w3.org/2000/svg';
      while (svg.firstChild) svg.firstChild.remove();
      const W = 300, H = 90;
      const fx = (f) => Math.log(f / 20) / Math.log(1000) * W;
      const fy = (db) => H / 2 - db / 18 * (H / 2 - 6);
      const mk = (tag, a) => { const e = document.createElementNS(NSs, tag); for (const k in a) e.setAttribute(k, a[k]); return e; };
      for (const g of [100, 1000, 10000]) {
        svg.appendChild(mk('line', { x1: fx(g), x2: fx(g), y1: 0, y2: H, class: 'eq-grid' }));
        const t = mk('text', { x: fx(g) + 3, y: H - 4, class: 'eq-lbl' }); t.textContent = g >= 1000 ? (g / 1000) + 'k' : String(g); svg.appendChild(t);
      }
      svg.appendChild(mk('line', { x1: 0, x2: W, y1: fy(0), y2: fy(0), class: 'eq-zero' }));
      let d = '';
      for (let i = 0; i <= 120; i++) {
        const f = 20 * Math.pow(1000, i / 120);
        const db = Math.max(-18, Math.min(18, E.chFilterDb(ch, f)));
        d += (i ? 'L' : 'M') + fx(f).toFixed(1) + ' ' + fy(db).toFixed(1);
      }
      svg.appendChild(mk('path', { d: d + 'L' + W + ' ' + H + 'L0 ' + H + 'Z', class: 'eq-fill' }));
      svg.appendChild(mk('path', { d, class: 'eq-line' }));
    },

    panelAnalyse() {
      const wrap = h('div', { class: 'panel analyse' });
      const help = this.ui.help;
      wrap.appendChild(h('h3', null, help ? 'Analyse' : 'Sonomètre'));
      if (!help) {
        wrap.appendChild(h('p', { class: 'muted' }, 'Mode expert : pas d’analyseur, comme en vrai. Fie-toi à tes oreilles (active le son) et au sonomètre en haut de la scène. Repasse en mode Aide pour voir les courbes.'));
        return wrap;
      }
      wrap.appendChild(h('h4', null, 'Marge avant larsen, par fréquence'));
      wrap.appendChild(h('p', { class: 'muted small' }, 'Chaque barre est le gain de la boucle micro → enceinte → micro. Quand une barre touche 0 dB, ça siffle à cette fréquence.'));
      const NSs = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NSs, 'svg');
      svg.setAttribute('viewBox', '0 0 300 130'); svg.setAttribute('class', 'loop-chart');
      svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Gain de boucle par bande de fréquence');
      const mk = (tag, a) => { const e = document.createElementNS(NSs, tag); for (const k in a) e.setAttribute(k, a[k]); return e; };
      const y = (db) => 10 + (0 - db) / 30 * 100; // 0 dB à y=10, −30 dB à y=110
      for (const g of [0, -10, -20, -30]) {
        svg.appendChild(mk('line', { x1: 30, x2: 298, y1: y(g), y2: y(g), class: g === 0 ? 'lc-zero' : 'lc-grid' }));
        const t = mk('text', { x: 26, y: y(g) + 3, class: 'lc-lbl', 'text-anchor': 'end' }); t.textContent = g === 0 ? '0 dB' : String(g).replace('-', '−'); svg.appendChild(t);
      }
      const bars = [];
      const bw = 268 / D.BANDS.length;
      D.BANDS.forEach((f, b) => {
        const r = mk('rect', { x: 30 + b * bw + 2, width: bw - 4, y: 110, height: 0, class: 'lc-bar' });
        bars.push(r); svg.appendChild(r);
        const t = mk('text', { x: 30 + b * bw + bw / 2, y: 124, class: 'lc-lbl', 'text-anchor': 'middle' }); t.textContent = D.BAND_LABELS[b]; svg.appendChild(t);
      });
      wrap.appendChild(svg);
      const margin = h('p', { class: 'margin-line' });
      wrap.appendChild(margin);
      this.live.loop = { bars, y, margin };

      wrap.appendChild(h('h4', null, 'Ce qu’entend le public'));
      wrap.appendChild(h('p', { class: 'muted small' }, 'Son direct des instruments + façade, mesuré à la régie. La zone claire est l’objectif du plateau.'));
      const bal = h('div', { class: 'balance' });
      wrap.appendChild(bal);
      this.live.bal = bal;
      this.live.balRows = null;
      return wrap;
    },

    updateSideLive() {
      const L = this.live || {};
      const fx = this.fx;
      if (L.loop && fx.loop) {
        const { bars, y, margin } = L.loop;
        fx.loop.sys.forEach((g, b) => {
          const v = Math.max(-30, Math.min(3, g));
          const top = y(v);
          bars[b].setAttribute('y', Math.min(top, 110));
          bars[b].setAttribute('height', Math.max(0, 110 - top));
          bars[b].setAttribute('class', 'lc-bar ' + (g > -3 ? 'r' : g > -8 ? 'y' : 'g'));
        });
        const w = fx.loop.worst;
        if (w.db <= E.NEG + 1) margin.textContent = 'Aucun micro ouvert vers une enceinte : pas de risque de larsen.';
        else {
          const spk = E.speakerList(this.state).find(s => s.id === w.spk);
          margin.innerHTML = '';
          margin.append('Marge : ', h('b', { class: w.db > -3 ? 'txt-r' : w.db > -8 ? 'txt-y' : 'txt-g' }, (-w.db).toFixed(1) + ' dB'),
            ' · point faible ' + U.fmtHz(D.BANDS[w.band]) + ' · voie ' + (w.ch + 1) + (spk ? ' → ' + spk.name : ''));
        }
      }
      if (L.bal && fx.aud) this.updateBalance(L.bal);
      if (L.trInfo && this.ui.selCh != null) {
        const i = this.ui.selCh;
        const lv = fx.levels[i];
        const pc = fx.loop ? fx.loop.perCh.find(p => p.ch === i) : null;
        let mg = '—';
        if (pc) { const mx = Math.max(...pc.g); mg = (-mx).toFixed(1) + ' dB'; }
        L.trInfo.innerHTML = '';
        const crest = lv && lv.alive ? lv.peak : E.NEG;
        const state = !lv || !lv.mic ? '' : !lv.alive ? 'pas de signal (' + lv.reason + ')' : !lv.src || !lv.src.playing ? 'le musicien ne joue pas' : crest > 0 ? 'SATURE : baisse le gain' : crest < -30 ? 'trop faible : monte le gain' : crest > -3 ? 'un peu chaud' : 'bon niveau';
        L.trInfo.append(
          h('div', null, h('span', { class: 'muted' }, 'Crêtes '), h('b', null, crest > E.NEG + 1 ? U.fmtDb(crest) + ' dBFS' : '—'), h('span', { class: 'muted' }, ' · ' + state)),
          this.ui.help ? h('div', null, h('span', { class: 'muted' }, 'Marge avant larsen de cette voie '), h('b', null, mg)) : null);
      }
      if (L.needs && this.frame % 10 === 0 && this.ui.sideTab === 'scene' && !this.show && this.needsChanged()) this.sideDirty = true;
    },

    needsChanged() {
      const sig = this.fx.needs.map(n => n.ok ? 1 : 0).join('');
      if (sig !== this._needSig) { this._needSig = sig; return true; }
      return false;
    },

    updateBalance(el) {
      const st = this.state;
      const sc = this.scene();
      const aud = this.fx.aud;
      const ids = st.sources.map(s => s.id);
      if (!this.live.balRows || this.live.balIds !== ids.join()) {
        el.innerHTML = '';
        this.live.balIds = ids.join();
        this.live.balRows = {};
        const scale = h('div', { class: 'bal-scale' }, h('span', null, '50'), h('span', null, '70'), h('span', null, '90'), h('span', null, '110 dB'));
        for (const s of st.sources) {
          const zone = h('i', { class: 'bal-zone' });
          const pa = h('i', { class: 'bal-pa' });
          const ac = h('i', { class: 'bal-ac' });
          const v = h('span', { class: 'bal-v' });
          el.appendChild(h('div', { class: 'bal-row' }, h('span', { class: 'bal-name' }, s.name), h('span', { class: 'bal-track' }, zone, pa, ac), v));
          this.live.balRows[s.id] = { zone, pa, ac, v };
        }
        el.appendChild(scale);
        el.appendChild(h('div', { class: 'bal-legend' }, h('span', null, h('i', { class: 'bal-ac' }), 'son direct'), h('span', null, h('i', { class: 'bal-pa' }), 'avec la façade'), sc ? h('span', null, h('i', { class: 'bal-zone' }), 'objectif') : null));
      }
      const pos = (db) => Math.max(0, Math.min(100, (db - 50) / 60 * 100));
      const ref = sc ? aud.perSrc[sc.targets.ref] : null;
      for (const s of st.sources) {
        const r = this.live.balRows[s.id];
        const p = aud.perSrc[s.id];
        if (!r || !p) continue;
        r.ac.style.width = pos(p.acoustic) + '%';
        r.pa.style.width = pos(p.total) + '%';
        r.v.textContent = p.total > 20 ? Math.round(p.total) : '—';
        if (sc && ref && ref.total > 20) {
          let lo, hi;
          if (s.id === sc.targets.ref) { lo = sc.targets.leq[0] - 3; hi = sc.targets.leq[1]; }
          else if (sc.targets.mix[s.id]) { const [t, tol] = sc.targets.mix[s.id]; lo = ref.total + t - tol; hi = ref.total + t + tol; }
          if (lo != null) { r.zone.hidden = false; r.zone.style.left = pos(lo) + '%'; r.zone.style.width = Math.max(1, pos(hi) - pos(lo)) + '%'; }
          else r.zone.hidden = true;
        } else r.zone.hidden = true;
      }
    },

    // ------------------------------------------------------------ Inspecteur (sur la scène)
    renderInspector() {
      const box = $('inspector');
      box.innerHTML = '';
      const sel = this.ui.sel;
      const st = this.state;
      if (!sel) { box.hidden = true; return; }
      const close = h('button', { class: 'insp-close', 'aria-label': 'Fermer', onclick: () => this.select(null) }, '×');
      let content = null;
      if (sel.kind === 'mic') {
        const mic = st.mics.find(m => m.uid === sel.id);
        if (!mic) { box.hidden = true; return; }
        const def = D.MICS[mic.type];
        const src = E.findSource(st, mic.sourceId);
        const stDef = src ? D.SOURCES[src.type] : null;
        const [sc, note] = src ? D.suitability(src.type, mic.type) : [null, ''];
        content = h('div', null,
          h('div', { class: 'insp-eyebrow' }, 'Voie ' + (mic.ch + 1) + ' · ' + def.model),
          h('h4', null, def.name + (src ? ' → ' + src.name : ' (sans musicien)')),
          this.ui.help && src ? h('p', { class: 'insp-note ' + (sc >= 3 ? 'g' : sc === 2 ? 'y' : 'r') }, h('b', null, ['Inadapté', 'Bof', 'Correct', 'Idéal'][sc] + ' · '), note) : null,
          !src ? h('p', { class: 'insp-note r' }, 'Ce micro est resté sur scène sans musicien. S’il est ouvert, il capte la salle et rapproche le larsen : coupe sa voie ou range-le.') : null);
        if (src && def.kind !== 'di' && !stDef.electric && this.canEdit()) {
          const out = h('output', null, mic.dist + ' cm');
          const range = h('input', { type: 'range', id: 'insp-dist', min: '1', max: '250', step: '1', value: String(mic.dist), 'aria-label': 'Distance à la source' });
          range.addEventListener('input', () => { mic.dist = parseInt(range.value, 10); out.textContent = mic.dist + ' cm'; this.stageDirty = true; });
          content.appendChild(h('label', { class: 'insp-range', for: 'insp-dist' }, h('span', null, 'Distance à la source'), out));
          content.appendChild(range);
          if (this.ui.help) content.appendChild(h('p', { class: 'muted small' }, 'Idéal : ' + stDef.dist[0] + ' à ' + stDef.dist[1] + ' cm. Chaque fois que la distance double, le micro capte 6 dB de moins.'));
        }
        content.appendChild(h('div', { class: 'insp-actions' },
          h('button', { class: 'btn-text strong', onclick: () => this.selectChannel(mic.ch) }, 'Régler la voie ' + (mic.ch + 1)),
          this.canEdit() ? h('button', { class: 'btn-text danger', onclick: () => { S.removeMic(st, mic.uid); this.select(null); Mixer.refresh(); this.stageChanged(true); } }, 'Retirer') : null));
      } else if (sel.kind === 'wedge') {
        const w = st.wedges.find(x => x.uid === sel.id);
        if (!w) { box.hidden = true; return; }
        const busRow = h('div', { class: 'bus-row', role: 'group', 'aria-label': 'Sortie de console' });
        for (let k = 0; k < 4; k++) {
          busRow.appendChild(h('button', {
            class: 'bus-btn' + (w.bus === k ? ' on' : ''), style: '--bus:' + AUX_COL[k], 'aria-pressed': String(w.bus === k),
            onclick: () => { w.bus = k; this.stageChanged(true); this.renderInspector(); }
          }, 'Retour ' + (k + 1)));
        }
        const rot = (d) => { w.angle += d * Math.PI / 180; this.stageChanged(true); };
        content = h('div', null,
          h('div', { class: 'insp-eyebrow' }, 'Retour de scène'),
          h('h4', null, 'Branché sur la sortie « Retour ' + (w.bus + 1) + ' »'),
          busRow,
          this.canEdit() ? h('div', { class: 'insp-actions' },
            h('button', { class: 'btn-text', onclick: () => rot(-15), 'aria-label': 'Tourner à gauche' }, '↺ 15°'),
            h('button', { class: 'btn-text', onclick: () => rot(15), 'aria-label': 'Tourner à droite' }, '↻ 15°'),
            h('button', { class: 'btn-text', onclick: () => { this.aimWedge(w); this.stageChanged(true); } }, 'Viser le musicien'),
            h('button', { class: 'btn-text danger', onclick: () => { S.removeWedge(st, w.uid); this.select(null); this.stageChanged(true); } }, 'Retirer')) : null,
          this.ui.help ? h('p', { class: 'muted small' }, 'Glisse le retour pour le déplacer. Il doit viser le musicien… et tomber dans la zone sourde de son micro (le creux de la forme dessinée autour du micro).') : null);
      } else if (sel.kind === 'source') {
        const src = st.sources.find(x => x.id === sel.id);
        if (!src) { box.hidden = true; return; }
        const def = D.SOURCES[src.type];
        const mics = st.mics.filter(m => m.sourceId === src.id);
        content = h('div', null,
          h('div', { class: 'insp-eyebrow' }, def.name),
          h('h4', null, src.name),
          this.ui.help ? h('p', { class: 'insp-note' }, def.tip) : null,
          h('p', { class: 'muted small' }, mics.length ? 'Repris par : ' + mics.map(m => 'voie ' + (m.ch + 1) + ' (' + D.MICS[m.type].model + ')').join(', ') : 'Pas encore de micro. Ouvre la valise et choisis-en un.'),
          h('div', { class: 'insp-actions' },
            st.phase !== 'show' ? h('button', { class: 'btn-text strong', onclick: () => { src.playing = !src.playing; this.sideDirty = true; this.stageDirty = true; this.renderInspector(); } }, src.playing ? 'Faire taire' : 'Faire jouer') : null,
            this.canEdit() ? h('button', { class: 'btn-text', onclick: () => { this.setSideTab('valise'); } }, 'Ajouter un micro') : null,
            st.mode === 'atelier' ? h('button', { class: 'btn-text', onclick: () => { src.facing += Math.PI / 4; this.stageChanged(true); } }, 'Tourner') : null,
            st.mode === 'atelier' ? h('button', { class: 'btn-text danger', onclick: () => this.removeSource(src.id) }, 'Retirer') : null));
      } else if (sel.kind === 'main') {
        content = h('div', null,
          h('div', { class: 'insp-eyebrow' }, 'Enceinte de façade'),
          h('h4', null, 'La sono du public'),
          h('p', { class: 'insp-note' }, 'Elle diffuse vers la salle. Derrière elle, le son est plus faible (surtout dans les aigus) : c’est pour ça qu’on garde les micros derrière la façade, jamais devant.'));
      }
      box.append(close, content);
      box.hidden = false;
    }
  };

  root.SonoGame = G;
  document.addEventListener('DOMContentLoaded', () => G.boot());
})(this);
