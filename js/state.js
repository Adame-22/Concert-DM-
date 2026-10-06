/* Sono Sim — état du jeu : création, voies de console, ajout de micros et retours. */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const D = isNode ? require('./data.js') : root.SonoData;
  const E = isNode ? require('./engine.js') : root.SonoEngine;

  const NCH = 48; // une console 48 voies
  const NAUX = 4;
  let uidSeq = 1;
  const uid = (p) => p + (uidSeq++);

  function newChannel() {
    return {
      gain: 20, phantom: false, hpf: false, hpfFreq: 100,
      low: 0, midF: 1000, midG: 0, high: 0,
      fader: E.NEG, mute: false, sends: new Array(NAUX).fill(E.NEG)
    };
  }
  function newBus(fader) { return { fader, mute: false, geq: new Array(D.BANDS.length).fill(0) }; }

  function newState(mode) {
    return {
      mode: mode || 'concert',
      sceneIdx: 0,
      phase: 'prep',
      sources: [],
      mics: [],
      wedges: [],
      channels: Array.from({ length: NCH }, newChannel),
      main: newBus(0),
      aux: Array.from({ length: NAUX }, () => newBus(0)),
      inventory: Object.assign({}, D.INVENTORY),
      unlimited: mode === 'atelier'
    };
  }

  function makeSource(def) {
    return {
      id: def.id, type: def.type, name: def.name || D.SOURCES[def.type].name,
      x: def.x, y: def.y, home: { x: def.x, y: def.y },
      facing: def.facing != null ? def.facing : Math.PI / 2,
      playing: true, dyn: 0, lvlOffset: 0, distOffset: 0, aim: null,
      look: def.look || null
    };
  }

  function loadScene(state, idx) {
    const sc = D.SCENES[idx];
    state.sceneIdx = idx;
    state.sources = sc.sources.map(makeSource);
    return sc;
  }

  function stock(state, type) {
    if (state.unlimited) return Infinity;
    const used = type === 'wedge' ? state.wedges.length : state.mics.filter(m => m.type === type).length;
    return (state.inventory[type] || 0) - used;
  }

  function freeChannel(state) {
    for (let i = 0; i < state.channels.length; i++) if (!state.mics.some(m => m.ch === i)) return i;
    return -1;
  }

  function addMic(state, type, sourceId) {
    if (stock(state, type) <= 0) return { error: 'Plus de ' + D.MICS[type].name.toLowerCase() + ' dans la valise.' };
    const ch = freeChannel(state);
    if (ch < 0) return { error: 'Toutes les voies de la console sont occupées.' };
    const src = E.findSource(state, sourceId);
    const st = src ? D.SOURCES[src.type] : null;
    const siblings = state.mics.filter(m => m.sourceId === sourceId).length;
    let lat = 0;
    if (st && st.wide) lat = [-1, 1, 0, -2, 2][siblings] || 0;
    else if (siblings) lat = siblings % 2 ? 0.25 : -0.25;
    const mic = {
      uid: uid('m'), type, sourceId, ch,
      dist: st ? (D.MICS[type].kind === 'di' ? 0 : st.defDist || 10) : 10,
      lat, off: 0, x: src ? src.x : 5, y: src ? src.y : 3
    };
    state.mics.push(mic);
    // une voie qui reçoit un nouveau micro repart de réglages neutres
    state.channels[ch] = newChannel();
    return { mic };
  }

  function removeMic(state, micUid) {
    const i = state.mics.findIndex(m => m.uid === micUid);
    if (i >= 0) {
      const ch = state.mics[i].ch;
      state.mics.splice(i, 1);
      state.channels[ch] = newChannel();
    }
  }

  function addWedge(state, x, y, bus) {
    if (stock(state, 'wedge') <= 0) return { error: 'Plus de retours disponibles.' };
    const used = new Set(state.wedges.map(w => w.bus));
    let b = bus;
    if (b == null) { b = 0; while (used.has(b) && b < NAUX - 1) b++; }
    const w = { uid: uid('w'), x, y, angle: -Math.PI / 2, bus: b };
    state.wedges.push(w);
    return { wedge: w };
  }

  function removeWedge(state, wUid) {
    state.wedges = state.wedges.filter(w => w.uid !== wUid);
  }

  const api = { NCH, NAUX, newChannel, newBus, newState, makeSource, loadScene, stock, addMic, removeMic, addWedge, removeWedge, freeChannel };
  if (isNode) module.exports = api;
  else root.SonoState = api;
})(this);
