// Tests du moteur physique : `node --test tests/`
const test = require('node:test');
const assert = require('node:assert');
const D = require('../js/data.js');
const E = require('../js/engine.js');
const S = require('../js/state.js');

// Règle le gain d’une voie pour que son niveau moyen vise `target` dBFS
function setGain(st, ch, target) {
  for (let k = 0; k < 3; k++) {
    const l = E.computeLevels(st)[ch];
    st.channels[ch].gain = Math.max(0, Math.min(60, st.channels[ch].gain + (target - l.avg)));
  }
}
function setup(sceneIdx, plan) {
  const st = S.newState();
  S.loadScene(st, sceneIdx);
  for (const [mic, src] of plan) {
    const r = S.addMic(st, mic, src);
    assert.ok(r.mic, r.error);
    const c = st.channels[r.mic.ch];
    c.phantom = D.MICS[mic].phantom;
    const hpf = D.SOURCES[st.sources.find(s => s.id === src).type].hpf;
    if (hpf) { c.hpf = true; c.hpfFreq = hpf; }
    setGain(st, r.mic.ch, -20);
  }
  return st;
}

test('loi du fader : 0 dB aux trois quarts, −∞ en bas', () => {
  assert.strictEqual(E.faderToDb(0.75), 0);
  assert.strictEqual(E.faderToDb(0), E.NEG);
  for (const db of [-50, -30, -10, 0, 6]) assert.ok(Math.abs(E.faderToDb(E.dbToFader(db)) - db) < 1e-9);
});

test('directivités : cardioïde sourd à 180°, supercardioïde vers 126°', () => {
  assert.ok(E.polarRaw('cardio', -1) < -60);
  assert.ok(Math.abs(E.polarRaw('cardio', 1)) < 1e-9);
  assert.ok(E.polarRaw('super', Math.cos(126 * Math.PI / 180)) < -40);
  assert.ok(E.polarRaw('super', -1) > -13 && E.polarRaw('super', -1) < -10);
  assert.strictEqual(E.polarRaw('omni', -1), 0);
});

test('loi du carré inverse : doubler la distance fait perdre 6 dB', () => {
  const st = setup(2, [['sm58', 'voix']]);
  st.sources.forEach(s => { s.playing = true; s.dyn = 0; });
  st.sources.find(s => s.id === 'guitare_folk').playing = false;
  st.mics[0].dist = 5;
  const a = E.computeLevels(st)[0].avg;
  st.mics[0].dist = 10;
  const b = E.computeLevels(st)[0].avg;
  assert.ok(Math.abs(a - b - 6.02) < 0.3, `écart ${a - b}`);
});

test('un statique sans 48 V ne donne aucun signal', () => {
  const st = setup(1, [['km184', 'chorale']]);
  st.sources.forEach(s => { s.playing = true; });
  st.channels[0].phantom = false;
  const l = E.computeLevels(st)[0];
  assert.strictEqual(l.alive, false);
  assert.match(l.reason, /48 V/);
});

test('deux micros ouverts au lieu d’un : environ 3 dB de marge en moins', () => {
  const st = setup(1, [['km184', 'chorale'], ['km184', 'chorale']]);
  st.channels[0].fader = -15; st.channels[1].fader = -15;
  const both = E.computeLoop(st).worst.db;
  st.channels[1].mute = true;
  const one = E.computeLoop(st).worst.db;
  assert.ok(both - one > 2 && both - one < 4, `écart ${both - one}`);
});

test('le retour dans l’axe mort d’un cardioïde laisse plus de marge que sur le côté', () => {
  const st = setup(2, [['sm58', 'voix']]);
  st.channels[0].sends[0] = 0;
  const w = S.addWedge(st, 4.4, 4.6, 0).wedge;
  w.angle = -Math.PI / 2;
  const behind = E.computeLoop(st).worst.db;
  w.x = 5.6; w.y = 3.7; w.angle = Math.PI;
  const side = E.computeLoop(st).worst.db;
  assert.ok(side - behind > 4, `derrière ${behind}, côté ${side}`);
});

test('chaque plateau du concert a une solution sans larsen qui tient les objectifs, à chaque moment du conducteur', () => {
  const solutions = [
    { plan: [['col', 'parole']], fader: [-12], dist: { parole: 15 } },
    { plan: [['km184', 'chorale'], ['km184', 'chorale'], ['c414', 'piano'], ['sm58', 'soliste']], fader: [-15, -15, -15, -7], wedges: [[4.2, 3.4, 0]], sends: [[2, 0, -6]] },
    { plan: [['sm58', 'voix'], ['di_act', 'guitare_folk']], fader: [0, -4], wedges: [[4.4, 4.6, 0], [6.0, 4.4, 1]], sends: [[0, 0, -6], [1, 0, -10], [0, 1, -6]] },
    { plan: [['km184', 'flute'], ['km184', 'violon'], ['c414', 'piano'], ['di_act', 'guitare_folk']], fader: [-6, -6, -8, -8], wedges: [[3.8, 4.7, 0]], sends: [[2, 0, -4]] },
    { plan: [['hf58', 'voix'], ['beta52', 'gc'], ['sm57', 'cc'], ['km184', 'oh'], ['di_act', 'basse'], ['sm57', 'guitare_elec'], ['di_pass', 'clavier']],
      fader: [0, -8, -10, -14, -8, -12, -8], wedges: [[5, 4.7, 0], [2.4, 3.3, 1]], sends: [[0, 0, -8], [1, 1, 2]], gainTarget: { 1: -26, 2: -26 } },
    { plan: [['sm58', 'voix'], ['km184', 'chorale'], ['km184', 'chorale'], ['di_pass', 'clavier'], ['di_act', 'guitare_folk'], ['di_act', 'basse'], ['beta52', 'cajon']],
      fader: [0, -10, -10, -6, -8, -12, -12], wedges: [[5, 4.7, 0], [5, 2.0, 1]], sends: [[0, 0, -6], [3, 1, -4]] }
  ];
  D.SCENES.forEach((sc, i) => {
    const sol = solutions[i];
    const st = setup(i, sol.plan);
    if (sol.dist) for (const id in sol.dist) st.mics.filter(m => m.sourceId === id).forEach(m => { m.dist = sol.dist[id]; });
    st.sources.forEach(s => { s.playing = true; s.dyn = 0; });
    st.mics.forEach(m => setGain(st, m.ch, (sol.gainTarget && sol.gainTarget[m.ch]) || -20));
    sol.fader.forEach((f, k) => { st.channels[k].fader = f; });
    (sol.wedges || []).forEach(([x, y, bus]) => { const w = S.addWedge(st, x, y, bus).wedge; w.angle = -Math.PI / 2; });
    (sol.sends || []).forEach(([ch, bus, db]) => { st.channels[ch].sends[bus] = db; });
    const place = E.evaluatePlacement(st);
    for (const p of place) assert.ok(p.score >= 0.99, `${sc.id} : ${p.note}`);
    for (const cue of sc.cues) {
      st.sources.forEach(s => { s.playing = cue.plays.includes(s.id); });
      const levels = E.computeLevels(st);
      const loop = E.computeLoop(st);
      const aud = E.computeAudience(st, levels);
      const tag = `${sc.id} / ${cue.label}`;
      assert.ok(loop.worst.db < -3, `${tag} : marge insuffisante (${loop.worst.db.toFixed(1)} dB)`);
      if (cue.plays.includes(sc.targets.ref)) {
        assert.ok(aud.leq >= sc.targets.leq[0] && aud.leq <= sc.targets.leq[1], `${tag} : niveau ${aud.leq.toFixed(1)} hors cible`);
      }
      for (const m of E.mixCheck(sc, st, aud)) {
        assert.ok(m.ok, `${tag} : ${m.id} à ${m.rel.toFixed(1)} dB de ${m.ref} (cible ${m.expected}±${m.tol})`);
      }
      for (const L of levels) if (L.mic && L.src && L.src.playing) assert.ok(L.peak < 0, `${tag} : voie ${L.ch + 1} sature`);
    }
  });
});

test('conducteur : chaque plateau commence à 0 s et ses musiciens existent', () => {
  for (const sc of D.SCENES) {
    assert.strictEqual(sc.cues[0].t, 0, sc.id);
    const ids = new Set(sc.sources.map(s => s.id));
    for (const c of sc.cues) for (const id of c.plays) assert.ok(ids.has(id), `${sc.id} : ${id} inconnu`);
    for (let k = 1; k < sc.cues.length; k++) assert.ok(sc.cues[k].t > sc.cues[k - 1].t && sc.cues[k].t < sc.dur, sc.id);
    assert.strictEqual(D.cueAt(sc, sc.dur - 1).cue, sc.cues[sc.cues.length - 1]);
  }
});

test('un micro pointé vers son retour fait partir le larsen', () => {
  const st = setup(D.SCENES.findIndex(x => x.id === 'rock'), [['hf58', 'voix']]);
  st.channels[0].sends[0] = -2;
  S.addWedge(st, 5, 4.7, 0).wedge.angle = -Math.PI / 2;
  const before = E.computeLoop(st).worst.db;
  st.sources.find(s => s.id === 'voix').aim = 'wedge';
  const after = E.computeLoop(st).worst.db;
  assert.ok(before < -6, `avant ${before}`);
  assert.ok(after > 0, `après ${after}`);
});

test('chaque personne citée dans le concert existe, et chaque plateau a son intro et des conseils des mentors', () => {
  for (const sc of D.SCENES) {
    assert.ok(D.PEOPLE[sc.intro.who], sc.id + ' : intro');
    for (const h of sc.hints) assert.ok(['jerome', 'marc'].includes(h.who), sc.id + ' : conseil');
    for (const s of sc.sources) if (s.person) assert.ok(D.PEOPLE[s.person], sc.id + ' : ' + s.person);
    for (const e of sc.events) if (e.from) assert.ok(D.PEOPLE[e.from], sc.id + ' : ' + e.from);
  }
});
