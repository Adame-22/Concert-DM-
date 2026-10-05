/* Sono Sim — moteur physique.
 * Fonctions pures : à partir de l’état (scène, micros, retours, console),
 * calcule les niveaux d’entrée, le gain de boucle par bande (larsen),
 * le niveau entendu par le public et la satisfaction des musiciens. */
(function (root) {
  'use strict';
  const D = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.SonoData;
  const BANDS = D.BANDS;
  const NB = BANDS.length;
  const V = D.VENUE;
  const NEG = -120;

  const log10 = Math.log10;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function dbSum(list) {
    let s = 0;
    for (const d of list) if (d > NEG) s += Math.pow(10, d / 10);
    return s > 0 ? 10 * log10(s) : NEG;
  }
  function dbAdd(a, b) { return dbSum([a, b]); }

  // ------------------------------------------------------------ Faders
  // Loi de fader type console : position 0..1 → dB
  const FADER_PTS = [[0, NEG], [0.04, -70], [0.1, -50], [0.25, -30], [0.5, -10], [0.75, 0], [1, 10]];
  function faderToDb(p) {
    if (p <= 0) return NEG;
    for (let i = 1; i < FADER_PTS.length; i++) {
      const [p1, d1] = FADER_PTS[i];
      const [p0, d0] = FADER_PTS[i - 1];
      if (p <= p1) return d0 + (d1 - d0) * (p - p0) / (p1 - p0);
    }
    return 10;
  }
  function dbToFader(db) {
    if (db <= NEG) return 0;
    for (let i = 1; i < FADER_PTS.length; i++) {
      const [p1, d1] = FADER_PTS[i];
      const [p0, d0] = FADER_PTS[i - 1];
      if (db <= d1) return p0 + (p1 - p0) * (db - d0) / (d1 - d0);
    }
    return 1;
  }

  // ------------------------------------------------------------ Filtres de voie
  function hpfDb(f, on, fc) {
    if (!on) return 0;
    return -10 * log10(1 + Math.pow(fc / f, 4)); // 12 dB/octave
  }
  function eqDb(ch, f) {
    const low = ch.low * (1 / (1 + Math.pow(f / 100, 2)));
    const high = ch.high * (1 / (1 + Math.pow(10000 / f, 2)));
    const oct = Math.log2(f / ch.midF);
    const mid = ch.midG / (1 + Math.pow(oct / 0.5, 2));
    return low + mid + high;
  }
  function chFilterDb(ch, f) { return hpfDb(f, ch.hpf, ch.hpfFreq) + eqDb(ch, f); }

  // ------------------------------------------------------------ Polarités
  function polarFloor(f) {
    if (f <= 100) return -8;
    if (f <= 250) return -12;
    if (f <= 630) return -16;
    if (f <= 4000) return -20;
    return -16;
  }
  function polarRaw(pattern, cosT) {
    const p = D.PATTERNS[pattern];
    if (!p || p.a === 1) return 0;
    const r = Math.abs(p.a + (1 - p.a) * cosT);
    return r > 1e-4 ? 20 * log10(r) : -80;
  }
  function polarDb(pattern, cosT, f) {
    const p = D.PATTERNS[pattern];
    if (!p || p.a === 1) return 0;
    return Math.max(polarRaw(pattern, cosT), polarFloor(f));
  }
  function diffuseDb(pattern, f) {
    const p = D.PATTERNS[pattern];
    if (!p || p.a === 1) return 0;
    const k = f <= 160 ? 0.4 : f <= 400 ? 0.7 : 1;
    return p.diffuse * k;
  }
  function spkDirDb(cosP, bi) { return -V.spkDir[bi] * (1 - cosP) / 2; }

  // ------------------------------------------------------------ Géométrie
  function vec(a, b) { return [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; }
  function norm(v) { return Math.hypot(v[0], v[1], v[2]); }
  function unit(v) { const n = norm(v) || 1; return [v[0] / n, v[1] / n, v[2] / n]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

  function findSource(state, id) {
    for (const s of state.sources) if (s.id === id) return s;
    return null;
  }

  function wedgeAxis(w) {
    const c = Math.cos(40 * Math.PI / 180);
    return [Math.cos(w.angle) * c, Math.sin(w.angle) * c, Math.sin(40 * Math.PI / 180)];
  }
  function speakerList(state) {
    const out = [];
    for (const m of V.mains) {
      out.push({ kind: 'main', id: m.id, name: m.name, pos: [m.x, m.y, m.z], axis: [Math.cos(m.angle), Math.sin(m.angle), 0], bus: 'main' });
    }
    for (const w of state.wedges) {
      out.push({ kind: 'wedge', id: w.uid, name: 'Retour ' + (w.bus + 1), pos: [w.x, w.y, 0.3], axis: wedgeAxis(w), bus: w.bus });
    }
    return out;
  }

  function nearestSpeaker(state, pos, kind) {
    let best = null, bd = Infinity;
    for (const s of speakerList(state)) {
      if (kind && s.kind !== kind) continue;
      const d = Math.hypot(s.pos[0] - pos[0], s.pos[1] - pos[1]);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  // Position et axe d’un micro. Le micro est devant la source (côté où elle regarde),
  // son axe pointe vers la source.
  function micPose(state, mic) {
    const def = D.MICS[mic.type];
    const src = findSource(state, mic.sourceId);
    if (!src) {
      return { x: mic.x, y: mic.y, z: mic.z || 1.2, axis: mic.axis || [0, -1, 0], src: null, dist: 1, di: def.kind === 'di' };
    }
    const st = D.SOURCES[src.type];
    const fx = Math.cos(src.facing), fy = Math.sin(src.facing);
    const distCm = Math.max(1, mic.dist + (src.distOffset || 0));
    const dm = distCm / 100;
    // décalage latéral (perpendiculaire à la direction du regard)
    const lx = -fy, ly = fx;
    const x = src.x + fx * dm + lx * (mic.lat || 0);
    const y = src.y + fy * dm + ly * (mic.lat || 0);
    const z = st.height;
    const tilt = (st.tilt || 0) * Math.PI / 180;
    let axis;
    if (st.tilt <= -89) axis = [0, 0, -1];
    else axis = [-fx * Math.cos(tilt), -fy * Math.cos(tilt), Math.sin(tilt)];
    let px = x, py = y, pz = z;
    if (src.aim) {
      // micro tenu au bout du bras, le long du corps, grille vers l’enceinte
      const sp = nearestSpeaker(state, [x, y, z], src.aim === 'wedge' ? 'wedge' : 'main') || nearestSpeaker(state, [x, y, z], 'main');
      if (sp) {
        pz = Math.max(0.8, z - 0.6);
        const d0 = unit(vec([x, y, pz], sp.pos));
        px = x + d0[0] * 0.25; py = y + d0[1] * 0.25;
        axis = unit(vec([px, py, pz], sp.pos));
      }
    }
    // mémorise la dernière position connue (si la source quitte la scène)
    mic.x = px; mic.y = py; mic.z = pz; mic.axis = axis;
    return { x: px, y: py, z: pz, axis, src, dist: dm, di: def.kind === 'di' };
  }

  // ------------------------------------------------------------ Niveaux d’entrée
  function micAlive(ch, def) {
    if (def.phantom && !ch.phantom) return false;
    return true;
  }

  // Niveau moyen d’une source à cet instant (dB SPL à 1 m)
  function srcLevel(src) {
    if (!src || src.playing === false) return NEG;
    const st = D.SOURCES[src.type];
    return st.level + (src.dyn || 0) + (src.lvlOffset || 0);
  }

  function hpfLoss(st, ch) {
    if (!ch.hpf) return 0;
    return -10 * log10(1 + Math.pow(ch.hpfFreq / (st.body * 1.4), 4));
  }

  function computeLevels(state) {
    const res = [];
    const playing = state.sources.filter(s => s.playing !== false);
    for (let i = 0; i < state.channels.length; i++) {
      const ch = state.channels[i];
      const mic = state.mics.find(m => m.ch === i);
      const r = { ch: i, mic: mic || null, src: null, alive: false, reason: '', avg: NEG, peak: NEG, crest: 12 };
      if (!mic) { r.reason = 'vide'; res.push(r); continue; }
      const def = D.MICS[mic.type];
      const pose = micPose(state, mic);
      r.pose = pose;
      r.src = pose.src;
      if (!micAlive(ch, def)) { r.reason = def.kind === 'di' ? 'DI active sans 48 V' : 'pas de 48 V'; res.push(r); continue; }
      r.alive = true;
      let dbu = NEG;
      let crest = 12;
      if (def.kind === 'di') {
        const st = pose.src ? D.SOURCES[pose.src.type] : null;
        if (st && st.line != null && pose.src.playing !== false) {
          dbu = st.line + (pose.src.dyn || 0) + (pose.src.lvlOffset || 0) - 20;
          crest = st.crest;
          if (mic.type === 'di_pass' && pose.src.type === 'basse') dbu -= 2;
        } else if (st && st.line == null) {
          r.reason = 'pas de sortie';
        }
      } else {
        const mp = [pose.x, pose.y, pose.z];
        const parts = [];
        for (const s of playing) {
          const st = D.SOURCES[s.type];
          const lvl = srcLevel(s);
          let d, cosT;
          if (s === pose.src) {
            d = Math.max(0.02, pose.dist);
            cosT = st.tilt <= -89 ? 1 : Math.cos((mic.off || 0) * Math.PI / 180);
            if (s.aim) { d = Math.max(d, 0.5); cosT = 0.3; }
            if (st.electric) { parts.push(lvl - 20 * log10(Math.max(d, 0.3)) + polarRaw(def.pattern, cosT)); continue; }
          } else {
            const sp = [s.x, s.y, st.height];
            const v = vec(mp, sp);
            d = Math.max(0.3, norm(v));
            cosT = dot(pose.axis, unit(v));
          }
          parts.push(lvl - 20 * log10(d) + Math.max(polarRaw(def.pattern, cosT), -20));
          if (s === pose.src) crest = st.crest;
        }
        const spl = dbSum(parts);
        dbu = spl > NEG ? spl - 94 + def.sens : NEG;
      }
      if (dbu > NEG) {
        const st = pose.src ? D.SOURCES[pose.src.type] : null;
        const loss = st ? hpfLoss(st, ch) : 0;
        r.avg = dbu + ch.gain - 18 + loss;
        r.peak = r.avg + crest;
        r.crest = crest;
      }
      res.push(r);
    }
    return res;
  }

  // ------------------------------------------------------------ Larsen
  // Gain de boucle par bande, pour tout le système et par voie.
  function computeLoop(state) {
    const spks = speakerList(state);
    const sys = new Array(NB).fill(NEG);
    const sysParts = BANDS.map(() => []);
    const perCh = [];
    let worst = { db: NEG, band: 0, ch: -1, spk: null };
    for (let i = 0; i < state.channels.length; i++) {
      const ch = state.channels[i];
      const mic = state.mics.find(m => m.ch === i);
      if (!mic || ch.mute) continue;
      const def = D.MICS[mic.type];
      if (def.kind === 'di' || !micAlive(ch, def)) continue;
      const pose = micPose(state, mic);
      const mp = [pose.x, pose.y, pose.z];
      const g = new Array(NB).fill(NEG);
      const bandParts = BANDS.map(() => []);
      const bySpk = {};
      for (const sp of spks) {
        let busDb;
        let geq;
        if (sp.bus === 'main') {
          if (state.main.mute) continue;
          busDb = ch.fader + state.main.fader;
          geq = state.main.geq;
        } else {
          const ax = state.aux[sp.bus];
          if (!ax || ax.mute) continue;
          busDb = ch.sends[sp.bus] + ax.fader;
          geq = ax.geq;
        }
        if (busDb < -90) continue;
        const K = sp.kind === 'main' ? V.mainK : V.wedgeK;
        const resp = sp.kind === 'main' ? V.mainResp : V.wedgeResp;
        const v = vec(mp, sp.pos);
        const d = Math.max(0.3, norm(v));
        const u = unit(v);
        const cosMic = dot(pose.axis, u);
        const cosSpk = dot(sp.axis, [-u[0], -u[1], -u[2]]);
        let spkTot = NEG;
        for (let b = 0; b < NB; b++) {
          const f = BANDS[b];
          const elec = def.sens - 94 + ch.gain + chFilterDb(ch, f) + def.resp[b] + busDb + geq[b] + K + resp[b];
          const direct = elec - 20 * log10(d) + polarDb(def.pattern, cosMic, f) + spkDirDb(cosSpk, b);
          const rev = elec + V.roomRev[b] + diffuseDb(def.pattern, f) - (sp.kind === 'wedge' ? 4 : 0);
          const tot = dbAdd(direct, rev);
          bandParts[b].push(tot);
          if (tot > spkTot) spkTot = tot;
          // mémorise la contribution dominante
          if (tot > (bySpk[sp.id] || NEG)) bySpk[sp.id] = tot;
        }
      }
      for (let b = 0; b < NB; b++) {
        g[b] = dbSum(bandParts[b]);
        sysParts[b].push(g[b]);
      }
      let topSpk = null, topDb = NEG;
      for (const k in bySpk) if (bySpk[k] > topDb) { topDb = bySpk[k]; topSpk = k; }
      perCh.push({ ch: i, g, topSpk });
    }
    for (let b = 0; b < NB; b++) sys[b] = dbSum(sysParts[b]);
    let maxB = 0;
    for (let b = 1; b < NB; b++) if (sys[b] > sys[maxB]) maxB = b;
    worst.db = sys[maxB];
    worst.band = maxB;
    let bestCh = null;
    for (const p of perCh) if (!bestCh || p.g[maxB] > bestCh.g[maxB]) bestCh = p;
    if (bestCh) { worst.ch = bestCh.ch; worst.spk = bestCh.topSpk; }
    return { sys, perCh, worst };
  }

  // ------------------------------------------------------------ Ce qu’entend le public
  let _audAtt = null;
  function audienceAtt() {
    if (_audAtt == null) {
      const a = [V.audience.x, V.audience.y, 1.2];
      _audAtt = dbSum(V.mains.map(m => -20 * log10(norm(vec([m.x, m.y, m.z], a)))));
    }
    return _audAtt;
  }

  function computeAudience(state, levels) {
    const perSrc = {};
    const a = [V.audience.x, V.audience.y, 1.2];
    for (const s of state.sources) {
      const st = D.SOURCES[s.type];
      const lvl = srcLevel(s);
      const parts = [];
      if (lvl > NEG) {
        const d = norm(vec([s.x, s.y, st.height], a));
        const acoustic = st.electric ? lvl - 20 * log10(d) - 6 : lvl - 20 * log10(d) + 2;
        parts.push(acoustic);
        perSrc[s.id] = { acoustic, pa: NEG, total: NEG };
      } else {
        perSrc[s.id] = { acoustic: NEG, pa: NEG, total: NEG };
      }
      perSrc[s.id].parts = parts;
    }
    if (!state.main.mute) {
      for (const L of levels) {
        if (!L.alive || L.avg <= NEG || !L.src) continue;
        const ch = state.channels[L.ch];
        if (ch.mute) continue;
        const dbu = L.avg + 18 + ch.fader + state.main.fader;
        const spl = dbu + V.mainK + audienceAtt();
        const p = perSrc[L.src.id];
        if (p) { p.parts.push(spl); p.pa = dbAdd(p.pa, spl); }
      }
    }
    const all = [];
    for (const id in perSrc) {
      perSrc[id].total = dbSum(perSrc[id].parts);
      delete perSrc[id].parts;
      all.push(perSrc[id].total);
    }
    return { perSrc, leq: dbSum(all) };
  }

  // ------------------------------------------------------------ Équilibre du mix
  // Compare les sources qui jouent. La référence est celle qui a la cible la plus haute
  // (le chant s’il chante, sinon l’instrument le plus en avant à ce moment-là).
  function mixCheck(scene, state, aud) {
    if (!scene || !scene.targets) return [];
    const tg = Object.assign({}, scene.targets.mix);
    tg[scene.targets.ref] = [0, 0];
    const cands = [];
    for (const id in tg) {
      const src = findSource(state, id);
      const p = aud.perSrc[id];
      if (!src || src.playing === false || !p || p.total <= NEG + 1) continue;
      cands.push({ id, t: tg[id][0], tol: tg[id][1], total: p.total });
    }
    if (cands.length < 2) return [];
    cands.sort((a, b) => b.t - a.t);
    const ref = cands[0];
    return cands.slice(1).map(c => {
      const rel = c.total - ref.total;
      const expected = c.t - ref.t;
      const tol = Math.max(c.tol, ref.tol);
      return { id: c.id, ref: ref.id, rel, expected, tol, err: rel - expected, ok: Math.abs(rel - expected) <= tol };
    });
  }

  // ------------------------------------------------------------ Retours : chaque musicien s’entend-il ?
  // Signal requis dans le retour (dBFS moyen) pour qu’un musicien s’entende
  const NEED_DB = -32;
  function checkNeeds(state, levels, needs, reqDelta) {
    const out = [];
    for (const n of needs || []) {
      const who = findSource(state, n.who);
      if (!who) continue;
      const st = D.SOURCES[who.type];
      const extra = (reqDelta && reqDelta[n.who]) || 0;
      // retours qui « visent » ce musicien
      const wedges = state.wedges.filter(w => {
        const dx = who.x - w.x, dy = who.y - w.y;
        const d = Math.hypot(dx, dy);
        if (d > 3) return false;
        if (d < 0.2) return true;
        const c = (Math.cos(w.angle) * dx + Math.sin(w.angle) * dy) / d;
        return c > Math.cos(55 * Math.PI / 180);
      });
      const missing = [];
      let ok = wedges.length > 0;
      const reason = ok ? '' : 'aucun retour dirigé vers ' + (who.name || st.name);
      if (ok) {
        for (const wantId of n.wants) {
          let best = NEG;
          for (const w of wedges) {
            const ax = state.aux[w.bus];
            if (ax.mute) continue;
            for (const L of levels) {
              if (!L.alive || !L.src || L.src.id !== wantId || L.avg <= NEG) continue;
              const ch = state.channels[L.ch];
              if (ch.mute) continue;
              const lv = L.avg + ch.sends[w.bus] + ax.fader;
              if (lv > best) best = lv;
            }
          }
          if (best < NEED_DB + extra) missing.push(wantId);
        }
        ok = missing.length === 0;
      }
      out.push({ who: n.who, ok, missing, reason, hasWedge: wedges.length > 0 });
    }
    return out;
  }

  // ------------------------------------------------------------ Choix et placement des micros
  function evaluatePlacement(state) {
    const out = [];
    for (const s of state.sources) {
      const st = D.SOURCES[s.type];
      const mics = state.mics.filter(m => m.sourceId === s.id);
      if (!mics.length) {
        out.push({ src: s.id, score: 0, best: null, note: (s.name || st.name) + ' n’est pas repris(e) : aucun micro ni DI.' });
        continue;
      }
      let best = null;
      for (const m of mics) {
        const [sc, note] = D.suitability(s.type, m.type);
        let distOk = true;
        const def = D.MICS[m.type];
        if (def.kind !== 'di' && !st.electric) {
          distOk = m.dist >= st.dist[0] * 0.6 && m.dist <= st.dist[1] * 1.5;
        }
        const val = sc / 3 * (distOk ? 1 : 0.6);
        if (!best || val > best.val) best = { val, sc, note, mic: m, distOk };
      }
      let note = best.note;
      if (!best.distOk) note += ' Distance à revoir : idéalement ' + st.dist[0] + ' à ' + st.dist[1] + ' cm.';
      out.push({ src: s.id, score: best.val, best: best.mic.type, sc: best.sc, distOk: best.distOk, note });
    }
    return out;
  }

  // Conseils de bonnes pratiques (statique)
  function auditPractices(state, levels) {
    const issues = [];
    for (const L of levels) {
      const ch = state.channels[L.ch];
      if (!L.mic) continue;
      const def = D.MICS[L.mic.type];
      const label = 'Voie ' + (L.ch + 1);
      if (!L.src && !ch.mute && ch.fader > -90) {
        issues.push({ ch: L.ch, kind: 'open-orphan', text: label + ' : micro sans musicien laissé ouvert. Coupe-le (MUTE).' });
      }
      if (def.phantom && !ch.phantom) {
        issues.push({ ch: L.ch, kind: 'phantom', text: label + ' : ' + def.name + ' sans 48 V, il ne peut pas fonctionner.' });
      }
      if (L.src) {
        const st = D.SOURCES[L.src.type];
        if (st.hpf >= 80 && !ch.hpf) issues.push({ ch: L.ch, kind: 'hpf-off', text: label + ' (' + st.name + ') : active le coupe-bas vers ' + st.hpf + ' Hz.' });
        if (st.hpf === 0 && ch.hpf && ch.hpfFreq > 60) issues.push({ ch: L.ch, kind: 'hpf-bass', text: label + ' (' + st.name + ') : le coupe-bas enlève le grave dont cet instrument a besoin.' });
      }
    }
    return issues;
  }

  const api = {
    NEG, BANDS, NB, dbSum, dbAdd, clamp, faderToDb, dbToFader, hpfDb, eqDb, chFilterDb,
    polarRaw, polarDb, micPose, speakerList, computeLevels, computeLoop, computeAudience,
    checkNeeds, mixCheck, evaluatePlacement, auditPractices, findSource, audienceAtt, NEED_DB
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SonoEngine = api;
})(this);
