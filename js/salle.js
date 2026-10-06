/* Sono Sim — vue salle : la scène vue depuis la régie, en temps réel.
 * Bonhommes qui entrent, jouent, se taisent et réagissent ; technicien qui pose les micros
 * et tire les câbles jusqu’au boîtier de scène ; retours et façade qui « soufflent » ;
 * public qui réagit au son. Purement visuel : toute la physique reste dans engine.js. */
(function (root) {
  'use strict';
  const D = root.SonoData;
  const E = root.SonoEngine;

  const SZ = 0.8;                       // hauteur du plateau (m)
  const CAM = { y: 15.5, z: 6 };        // la régie, au fond de la salle, surélevée
  const BOX = { x: 0.45, y: 4.55 };     // boîtier de scène, côté jardin
  const WING_X = { L: -1.7, R: 11.7 };
  const AUX = ['#58aee0', '#bb86e6', '#5ccaa9', '#ea829f'];
  const AMBER = '#f2a53a';
  const RED = '#ff5040';
  const TAPE = '#ebe4cd';
  const INK = '#1e1c19';
  const F_LABEL = '"Barlow Condensed", "Arial Narrow", sans-serif';
  const F_TAPE = '"Permanent Marker", "Comic Sans MS", cursive';
  const F_BODY = 'Barlow, "Segoe UI", system-ui, sans-serif';
  let REDUCED = false;
  try { REDUCED = root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ignore */ }

  // ------------------------------------------------------------ Petits utilitaires
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0); }
  function rnd(seed) { let s = seed || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  const SKINS = ['#f1c9a5', '#e8b48f', '#c98e66', '#8d5a3b', '#6b4129'];
  const HAIRS = ['#1f1712', '#3b2a20', '#5a3220', '#c79a4b', '#e0c068', '#9a9a9a', '#7b2d8b'];
  const SHIRTS = ['#b8452f', '#3d8b6e', '#2f4f6f', '#d97a2b', '#5e60ce', '#c2185b', '#4a6741', '#26313f', '#7a3b5e'];
  const STYLES = ['short', 'long', 'bun', 'curly', 'short'];
  function lookFor(id, kid) {
    const r = rnd(hash(id));
    const pick = (a) => a[Math.floor(r() * a.length)];
    return { shirt: pick(SHIRTS), hair: pick(HAIRS.slice(0, 6)), skin: pick(SKINS), style: pick(STYLES), kid: !!kid };
  }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
    return 'rgb(' + c(n >> 16) + ',' + c((n >> 8) & 255) + ',' + c(n & 255) + ')';
  }
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  const Salle = {
    canvas: null, ctx: null, game: null,
    W: 800, H: 450, dpr: 1, f: 600, cx: 400, cy: 0,
    t: 0, last: 0, visible: true,
    stateRef: null, sceneKey: '',
    chars: {}, ghosts: [],
    known: new Set(), placed: new Set(), cable: {},
    crew: null, queue: [],
    notes: [], hits: [], seats: [],
    drag: null, autoBubbles: {},

    init(canvas, game) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.game = game;
      const r = rnd(7);
      for (const [row, y] of [[0, 6.55], [1, 7.35], [2, 8.15]].map((a) => a)) {
        for (let x = -0.9 + (row % 2) * 0.31; x < 10.9; x += 0.62) {
          const kid = r() < 0.3;
          this.seats.push({ x: x + (r() - 0.5) * 0.08, y, kid, row, phase: r() * 6.28,
            hair: shade(HAIRS[Math.floor(r() * 5)], 0.45), shirt: shade(SHIRTS[Math.floor(r() * SHIRTS.length)], 0.32), react: r() });
        }
      }
      const ro = new ResizeObserver(() => this.resize());
      ro.observe(canvas.parentElement);
      this.resize();
      canvas.addEventListener('pointerdown', (e) => this.onDown(e));
      canvas.addEventListener('pointermove', (e) => this.onMove(e));
      canvas.addEventListener('pointerup', () => this.onUp());
      canvas.addEventListener('pointercancel', () => this.onUp());
      const loop = (ts) => { this.frame(ts); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    },

    resize() {
      const box = this.canvas.parentElement;
      const W = Math.max(280, box.clientWidth);
      const maxH = Math.max(240, Math.round(root.innerHeight * 0.64));
      const H = Math.min(Math.round(W * (W < 640 ? 0.85 : 0.58)), maxH);
      this.dpr = Math.min(2, root.devicePixelRatio || 1);
      this.canvas.width = Math.round(W * this.dpr);
      this.canvas.height = Math.round(H * this.dpr);
      this.canvas.style.height = H + 'px';
      this.W = W; this.H = H;
      // cadrage : 10 m de plateau sur ~80 % de la largeur, du haut du rideau jusqu’au 2e rang du public
      const narrow = W < 640;
      const fW = (narrow ? 1.3 : 0.86) * W * (CAM.y - 5) / 10;
      const top = (CAM.z - (SZ + 4.0)) / (CAM.y + 0.3);
      const row1 = (CAM.z - 0.55) / (CAM.y - 6.55);
      const fH = (H - 8) / (row1 - top);
      this.f = Math.min(fW, fH);
      this.cx = W / 2;
      this.cy = H - 8 - row1 * this.f;
    },

    P(x, y, z) {
      const d = Math.max(0.5, CAM.y - y);
      const k = this.f / d;
      return [this.cx + (x - 5) * k, this.cy + (CAM.z - z) * k, k];
    },
    unproject(sx, sy, z) {
      const dy = sy - this.cy;
      if (dy <= 1) return null;
      const d = this.f * (CAM.z - z) / dy;
      return { x: 5 + (sx - this.cx) * d / this.f, y: CAM.y - d };
    },

    // ------------------------------------------------------------ Synchronisation avec l’état du jeu
    finishInstalls() {
      for (const t of this.queue) { this.placed.add(t.uid); this.cable[t.uid] = 1; }
      if (this.crew) { this.placed.add(this.crew.task.uid); this.cable[this.crew.task.uid] = 1; }
      this.queue = []; this.crew = null;
    },

    queueInstall(kind, uid) {
      this.known.add(uid);
      this.queue.push({ kind, uid });
    },

    sync() {
      const G = this.game;
      const st = G.state;
      if (st !== this.stateRef) {
        // nouvel état (changement de mode) : tout en place, sans animation
        this.stateRef = st;
        this.chars = {}; this.ghosts = []; this.queue = []; this.crew = null;
        this.known = new Set(); this.placed = new Set(); this.cable = {};
        for (const m of st.mics) { this.known.add(m.uid); this.placed.add(m.uid); this.cable[m.uid] = 1; }
        for (const w of st.wedges) { this.known.add(w.uid); this.placed.add(w.uid); this.cable[w.uid] = 1; }
        for (const s of st.sources) this.chars[this.charKey(s)] = this.newChar(s, false);
        this.sceneKey = st.mode + st.sceneIdx;
        return;
      }
      // objets ajoutés sans animation demandée
      for (const m of st.mics) if (!this.known.has(m.uid)) { this.known.add(m.uid); this.placed.add(m.uid); this.cable[m.uid] = 1; }
      for (const w of st.wedges) if (!this.known.has(w.uid)) { this.known.add(w.uid); this.placed.add(w.uid); this.cable[w.uid] = 1; }
      // musiciens : entrées / sorties
      const keys = new Set();
      for (const s of st.sources) {
        const k = this.charKey(s);
        keys.add(k);
        if (!this.chars[k]) this.chars[k] = this.newChar(s, true);
        this.chars[k].src = s;
      }
      for (const k in this.chars) {
        if (!keys.has(k)) {
          const c = this.chars[k];
          c.leaving = true;
          c.tx = c.x < 5 ? WING_X.L : WING_X.R;
          c.ty = c.y;
          this.ghosts.push(c);
          delete this.chars[k];
        }
      }
    },

    charKey(s) { return s.id + '|' + s.name; },
    newChar(s, enter) {
      const st = D.SOURCES[s.type];
      const look = s.look || lookFor(s.id + s.name, s.type === 'soliste');
      const fromX = s.x < 5 ? WING_X.L : WING_X.R;
      return {
        src: s, look, type: s.type, name: s.name,
        x: enter ? fromX : s.x, y: s.y, walking: false, leaving: false,
        phase: (hash(s.id) % 628) / 100, wide: st.wide || 0, step: 0
      };
    },

    // ------------------------------------------------------------ Boucle d’animation
    frame(ts) {
      const dt = Math.min(0.05, (ts - (this.last || ts)) / 1000);
      this.last = ts;
      this.t += dt;
      const G = this.game;
      if (!G || !G.state || G.ui.stageView !== 'salle' || this.canvas.offsetParent === null) return;
      this.sync();
      this.update(dt);
      this.draw();
    },

    update(dt) {
      const G = this.game;
      // déplacements des musiciens
      const walk = (c, speed) => {
        const dx = c.tx - c.x, dy = c.ty - c.y;
        const d = Math.hypot(dx, dy);
        if (d < 0.02) { c.x = c.tx; c.y = c.ty; c.walking = false; return true; }
        const s = Math.min(d, speed * dt);
        c.x += dx / d * s; c.y += dy / d * s;
        c.walking = true; c.step += dt * 9;
        return false;
      };
      for (const k in this.chars) {
        const c = this.chars[k];
        c.tx = c.src.x; c.ty = c.src.y;
        walk(c, 2.6);
      }
      this.ghosts = this.ghosts.filter(c => !walk(c, 3));
      // le technicien
      this.updateCrew(dt);
      // notes de musique
      if (!REDUCED) {
        for (const k in this.chars) {
          const c = this.chars[k];
          const s = c.src;
          if (!s.playing || c.walking) continue;
          const rate = c.wide ? 3 : 1.2;
          if (Math.random() < rate * dt) {
            const h = this.headZ(c) + 0.25;
            this.notes.push({ x: c.x + (c.wide ? (Math.random() - 0.5) * c.wide : (Math.random() - 0.5) * 0.3), y: c.y, z: h, life: 0, g: Math.random() < 0.5 ? '♪' : '♫', sway: Math.random() * 6 });
          }
        }
      }
      this.notes = this.notes.filter(n => { n.life += dt; n.z += dt * 0.55; return n.life < 1.8; });
      // bulles automatiques : musicien qui ne s’entend pas pendant le spectacle
      if (G.show) {
        for (const n of G.fx.needs || []) {
          const who = E.findSource(G.state, n.who);
          if (n.ok || !who || !who.playing) continue;
          const last = this.autoBubbles[n.who] || -99;
          if (this.t - last > 9) {
            this.autoBubbles[n.who] = this.t;
            G.bubble(n.who, n.hasWedge ? 'Pas assez dans mon retour !' : 'Il me faut un retour !', 3, 'need');
          }
        }
      }
    },

    updateCrew(dt) {
      if (!this.crew && this.queue.length) {
        const task = this.queue.shift();
        this.crew = { x: WING_X.L + 0.4, y: 3.6, task, phase: 'go', step: 0 };
      }
      const c = this.crew;
      if (!c) return;
      const speed = this.queue.length > 1 ? 7 : 4.2;
      const target = c.phase === 'back' ? null : this.taskTarget(c.task);
      if (!target && c.phase !== 'back') c.phase = 'back';
      let tx, ty;
      if (c.phase === 'go') { tx = target.x; ty = target.y; }
      else if (c.phase === 'cable') { tx = BOX.x + 0.3; ty = BOX.y - 0.15; }
      else { tx = WING_X.L; ty = 3.6; }
      const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
      if (d < 0.05) {
        if (c.phase === 'go') {
          this.placed.add(c.task.uid);
          c.phase = target.wireless ? 'back' : 'cable';
          c.from = { x: c.x, y: c.y };
          if (target.wireless) this.cable[c.task.uid] = 1;
        } else if (c.phase === 'cable') {
          this.cable[c.task.uid] = 1;
          if (this.queue.length) { c.task = this.queue.shift(); c.phase = 'go'; c.from = null; }
          else c.phase = 'back';
        } else {
          this.crew = null;
        }
        return;
      }
      const s = Math.min(d, speed * dt);
      c.x += dx / d * s; c.y += dy / d * s; c.step += dt * 10;
      if (c.phase === 'cable' && c.from) {
        const tot = Math.hypot(BOX.x + 0.3 - c.from.x, BOX.y - 0.15 - c.from.y) || 1;
        this.cable[c.task.uid] = Math.max(0, Math.min(1, 1 - d / tot));
      }
    },

    taskTarget(task) {
      const st = this.game.state;
      if (task.kind === 'box') return { x: BOX.x + 0.3, y: BOX.y - 0.1, wireless: true };
      if (task.kind === 'wedge') {
        const w = st.wedges.find(x => x.uid === task.uid);
        return w ? { x: w.x, y: w.y + 0.35 } : null;
      }
      const m = st.mics.find(x => x.uid === task.uid);
      if (!m) return null;
      const base = this.micBase(m);
      return base ? { x: base.x, y: base.y + 0.25, wireless: base.wireless } : null;
    },

    // point au sol d’où part le câble d’un micro
    micBase(m) {
      const st = this.game.state;
      const def = D.MICS[m.type];
      const src = E.findSource(st, m.sourceId);
      if (def.kind === 'di') {
        const c = src ? this.chars[this.charKey(src)] : null;
        const sx = c ? c.x : m.x, sy = c ? c.y : m.y;
        return { x: sx + 0.5, y: sy + 0.3, di: true };
      }
      if (def.hf) {
        const c = src ? this.chars[this.charKey(src)] : null;
        return { x: c ? c.x : m.x, y: c ? c.y : m.y, wireless: true };
      }
      if (m.type === 'col' && src) return { x: src.x, y: src.y + 0.45 };
      return { x: m.x, y: m.y };
    },

    floorZ(y) { return y > 5.15 ? 0 : SZ; },

    headZ(c) {
      const kid = c.look && c.look.kid;
      const seated = ['piano', 'gc', 'cajon'].includes(c.type);
      const fz = this.floorZ(c.y);
      if (c.wide) return fz + 1.9;
      return fz + (seated ? 1.25 : (kid ? 1.25 : 1.68));
    },

    // ------------------------------------------------------------ Dessin
    draw() {
      const ctx = this.ctx;
      const G = this.game;
      const st = G.state;
      const show = st.phase === 'show' || st.mode === 'atelier';
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.W, this.H);
      this.hits = [];
      const fx = G.fx;
      const shake = fx.larsenOn && !REDUCED ? (Math.random() - 0.5) * 3 : 0;
      ctx.save();
      ctx.translate(shake, 0);

      this.drawRoom(show);
      this.drawFloor(show);
      this.drawCables();
      this.drawStageBox();

      // objets du plateau, triés par profondeur
      const items = [];
      const front = [];
      for (const k in this.chars) (this.chars[k].y > 5.15 ? front : items).push({ y: this.chars[k].y, f: () => this.drawChar(this.chars[k]) });
      for (const c of this.ghosts) items.push({ y: c.y, f: () => this.drawChar(c) });
      for (const m of st.mics) if (this.placed.has(m.uid)) {
        const def = D.MICS[m.type];
        if (def.hf || m.type === 'col') continue;
        const base = this.micBase(m);
        items.push({ y: (base ? base.y : m.y) + 0.02, f: () => this.drawMic(m) });
      }
      for (const w of st.wedges) if (this.placed.has(w.uid)) items.push({ y: w.y, f: () => this.drawWedge(w) });
      if (this.crew) items.push({ y: this.crew.y, f: () => this.drawCrew(this.crew) });
      items.sort((a, b) => a.y - b.y);
      for (const it of items) it.f();

      this.drawWaves();
      this.drawNotes();
      this.drawLarsen();
      this.drawStageFront();
      this.drawMains();
      this.drawAudience(show);
      for (const it of front) it.f();
      this.drawBubbles();
      this.drawTags();
      ctx.restore();

      if (fx.larsenOn) {
        const g = ctx.createRadialGradient(this.W / 2, this.H / 2, this.H * 0.3, this.W / 2, this.H / 2, this.W * 0.7);
        g.addColorStop(0, 'rgba(255,80,64,0)');
        g.addColorStop(1, 'rgba(255,80,64,' + (0.22 + 0.12 * Math.sin(this.t * 30)) + ')');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, this.W, this.H);
      }
    },

    drawRoom(show) {
      const ctx = this.ctx;
      // fond de salle
      ctx.fillStyle = '#0c0d10';
      ctx.fillRect(0, 0, this.W, this.H);
      // rideau de fond (plis)
      const a = this.P(-1.5, -0.3, SZ + 4.6), b = this.P(11.5, -0.3, SZ);
      const curtain = ctx.createLinearGradient(0, a[1], 0, b[1]);
      curtain.addColorStop(0, '#16080a');
      curtain.addColorStop(1, show ? '#3a1218' : '#24141a');
      ctx.fillStyle = curtain;
      ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
      const folds = 26;
      for (let i = 0; i < folds; i++) {
        const x0 = a[0] + (b[0] - a[0]) * i / folds;
        const g = ctx.createLinearGradient(x0, 0, x0 + (b[0] - a[0]) / folds, 0);
        g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0.03)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
        ctx.fillStyle = g;
        ctx.fillRect(x0, a[1], (b[0] - a[0]) / folds + 0.5, b[1] - a[1]);
      }
      // pendrillons (coulisses)
      for (const side of [-1, 1]) {
        for (const yy of [0.6, 2.6]) {
          const x0 = side < 0 ? -1.6 : 10.4, x1 = side < 0 ? -0.35 : 11.65;
          const p0 = this.P(x0, yy, SZ + 4.8), p1 = this.P(x1, yy, SZ);
          ctx.fillStyle = '#100c10';
          ctx.fillRect(Math.min(p0[0], p1[0]), p0[1], Math.abs(p1[0] - p0[0]), p1[1] - p0[1]);
        }
      }
      // perche et projecteurs
      const t0 = this.P(-1, 1.5, SZ + 4.7), t1 = this.P(11, 1.5, SZ + 4.7);
      ctx.strokeStyle = '#2c3038'; ctx.lineWidth = Math.max(2, t0[2] * 0.06);
      ctx.beginPath(); ctx.moveTo(t0[0], t0[1]); ctx.lineTo(t1[0], t1[1]); ctx.stroke();
      const cols = show ? ['#ff9b3d', '#6aa8ff', '#ff5fa2', '#ffd36a', '#6aa8ff', '#ff9b3d'] : ['#fff3dc', '#fff3dc', '#fff3dc', '#fff3dc', '#fff3dc', '#fff3dc'];
      for (let i = 0; i < 6; i++) {
        const lx = 0.9 + i * 1.65;
        const p = this.P(lx, 1.5, SZ + 4.6);
        ctx.fillStyle = '#1b1e24';
        rr(ctx, p[0] - p[2] * 0.12, p[1], p[2] * 0.24, p[2] * 0.3, 2); ctx.fill();
        ctx.fillStyle = cols[i];
        ctx.globalAlpha = show ? 0.9 : 0.6;
        ctx.beginPath(); ctx.arc(p[0], p[1] + p[2] * 0.3, p[2] * 0.07, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    },

    drawFloor(show) {
      const ctx = this.ctx;
      const c = [this.P(0, 0, SZ), this.P(10, 0, SZ), this.P(10, 5, SZ), this.P(0, 5, SZ)];
      ctx.beginPath();
      ctx.moveTo(c[0][0], c[0][1]); ctx.lineTo(c[1][0], c[1][1]); ctx.lineTo(c[2][0], c[2][1]); ctx.lineTo(c[3][0], c[3][1]);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, c[0][1], 0, c[3][1]);
      g.addColorStop(0, '#231d1a'); g.addColorStop(1, '#3a2f29');
      ctx.fillStyle = g; ctx.fill();
      // lattes
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
      for (let x = 0.5; x < 10; x += 0.5) {
        const p0 = this.P(x, 0, SZ), p1 = this.P(x, 5, SZ);
        ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
      }
      // lumières sur le plateau
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const spots = show
        ? [[2.2, 3, '#ff9b3d'], [5, 3.5, '#ffe0b0'], [7.8, 3, '#6aa8ff'], [5, 1.4, '#ff5fa2']]
        : [[2.5, 2.5, '#fff3dc'], [7.5, 2.5, '#fff3dc']];
      spots.forEach(([x, y, col], i) => {
        const sway = show && !REDUCED ? Math.sin(this.t * 0.5 + i) * 0.6 : 0;
        const p = this.P(x + sway, y, SZ);
        const r = p[2] * (show ? 2.0 : 3.2);
        const gg = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
        gg.addColorStop(0, col); gg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = show ? 0.22 : 0.09;
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.ellipse(p[0], p[1], r, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();
      ctx.globalAlpha = 1;
      // nez de scène
      const n0 = this.P(0, 5, SZ), n1 = this.P(10, 5, SZ);
      ctx.strokeStyle = 'rgba(242,165,58,0.55)'; ctx.setLineDash([6, 5]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(n0[0], n0[1]); ctx.lineTo(n1[0], n1[1]); ctx.stroke();
      ctx.setLineDash([]);
      // repères jardin / cour
      ctx.font = '600 ' + Math.max(10, n0[2] * 0.16) + 'px ' + F_LABEL;
      ctx.fillStyle = 'rgba(223,226,218,0.35)';
      ctx.textAlign = 'left';
      ctx.fillText('JARDIN', this.P(0.1, 0.2, SZ)[0], this.P(0.1, 0.2, SZ)[1] + 12);
      ctx.textAlign = 'right';
      ctx.fillText('COUR', this.P(9.9, 0.2, SZ)[0], this.P(9.9, 0.2, SZ)[1] + 12);
      ctx.textAlign = 'left';
    },

    drawStageFront() {
      const ctx = this.ctx;
      const a = this.P(0, 5, SZ), b = this.P(10, 5, 0);
      ctx.fillStyle = '#15120f';
      ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(a[0], a[1], b[0] - a[0], 2);
      // sol de la salle
      const c0 = this.P(-3, 5, 0), c1 = this.P(13, 5, 0);
      ctx.fillStyle = '#101216';
      ctx.fillRect(0, c0[1], this.W, this.H - c0[1]);
      void c1;
      // multipaire : du boîtier vers la régie
      const m0 = this.P(BOX.x + 0.1, 5, SZ), m1 = this.P(BOX.x + 0.1, 5, 0), m2 = this.P(1.6, 9.5, 0);
      ctx.strokeStyle = '#050607'; ctx.lineWidth = Math.max(3, m1[2] * 0.07);
      ctx.beginPath(); ctx.moveTo(m0[0], m0[1]); ctx.lineTo(m1[0], m1[1]); ctx.quadraticCurveTo(m1[0], m2[1] - 20, m2[0], m2[1]); ctx.stroke();
    },

    drawStageBox() {
      const ctx = this.ctx;
      const G = this.game;
      const p = this.P(BOX.x, BOX.y, SZ);
      const k = p[2];
      const w = 0.95 * k, h = 0.34 * k;
      const x = p[0] - w / 2, y = p[1] - h;
      ctx.fillStyle = '#2a2f37';
      rr(ctx, x, y, w, h, 3); ctx.fill();
      ctx.strokeStyle = '#4a515c'; ctx.lineWidth = 1; ctx.stroke();
      const used = new Set(G.state.mics.map(m => m.ch));
      const selCh = G.ui.selCh;
      for (let i = 0; i < 48; i++) {
        const [sx, sy] = this.socketPos(i);
        ctx.fillStyle = used.has(i) ? (selCh === i && Math.sin(this.t * 10) > 0 ? AMBER : '#5bcb6d') : '#0b0d0f';
        ctx.beginPath(); ctx.arc(sx, sy, Math.max(1, k * 0.014), 0, Math.PI * 2); ctx.fill();
      }
      ctx.font = '600 ' + Math.max(9, k * 0.13) + 'px ' + F_LABEL;
      ctx.fillStyle = 'rgba(223,226,218,0.75)';
      ctx.textAlign = 'center';
      ctx.fillText('BOÎTIER DE SCÈNE', p[0], y - 4);
      ctx.textAlign = 'left';
      this.hits.push({ kind: 'stagebox', id: 'box', x0: x - 4, y0: y - 16, x1: x + w + 4, y1: y + h + 4 });
    },

    socketPos(ch) {
      const p = this.P(BOX.x, BOX.y, SZ);
      const k = p[2];
      const w = 0.95 * k, h = 0.34 * k;
      const x = p[0] - w / 2, y = p[1] - h;
      const col = ch % 16, row = Math.floor(ch / 16);
      return [x + w * (0.05 + col * 0.06), y + h * (0.25 + row * 0.27)];
    },

    drawCables() {
      const ctx = this.ctx;
      const G = this.game;
      const st = G.state;
      const selMic = G.ui.sel && G.ui.sel.kind === 'mic' ? G.ui.sel.id : null;
      const drawPath = (from, prog, toSock, hi, color) => {
        if (prog <= 0) return;
        const pts = [];
        const n = 16;
        const cxp = (from.x + BOX.x) / 2, cyp = Math.max(from.y, BOX.y) + 0.35;
        for (let i = 0; i <= n * prog; i++) {
          const t = i / n;
          const x = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * cxp + t * t * BOX.x;
          const y = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * cyp + t * t * BOX.y;
          pts.push(this.P(x, y, SZ));
        }
        if (prog >= 1 && toSock) pts.push([toSock[0], toSock[1], pts[pts.length - 1][2]]);
        ctx.strokeStyle = hi ? AMBER : color;
        ctx.lineWidth = Math.max(1.2, pts[0][2] * (hi ? 0.035 : 0.022));
        ctx.beginPath();
        pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
        ctx.stroke();
      };
      for (const m of st.mics) {
        if (!this.placed.has(m.uid)) continue;
        const base = this.micBase(m);
        if (!base) continue;
        if (base.wireless) {
          // ondes radio vers le récepteur, au boîtier
          const a = this.P(base.x, base.y, SZ + 1.2), b = this.socketPos(m.ch);
          const ph = (this.t * 1.5) % 1;
          ctx.strokeStyle = selMic === m.uid ? AMBER : 'rgba(88,174,224,0.55)';
          ctx.setLineDash([3, 5]); ctx.lineDashOffset = -ph * 16; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo((a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 30, b[0], b[1]); ctx.stroke();
          ctx.setLineDash([]); ctx.lineDashOffset = 0;
          continue;
        }
        drawPath(base, this.cable[m.uid] == null ? 1 : this.cable[m.uid], this.socketPos(m.ch), selMic === m.uid, '#0a0b0d');
      }
      for (const w of st.wedges) {
        if (!this.placed.has(w.uid)) continue;
        const sel = G.ui.sel && G.ui.sel.kind === 'wedge' && G.ui.sel.id === w.uid;
        drawPath({ x: w.x, y: w.y + 0.1 }, this.cable[w.uid] == null ? 1 : this.cable[w.uid], null, sel, 'rgba(10,11,13,0.9)');
      }
      // câble en cours de déroulage
      const c = this.crew;
      if (c && c.phase === 'cable' && c.from) {
        const p0 = this.P(c.from.x, c.from.y - 0.25, SZ), p1 = this.P(c.x, c.y, SZ);
        ctx.strokeStyle = '#0a0b0d'; ctx.lineWidth = Math.max(1.2, p0[2] * 0.022);
        ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
      }
    },

    // ------------------------------------------------------------ Bonhommes
    drawChar(c) {
      const G = this.game;
      const s = c.src;
      const fx = G.fx;
      const type = c.type;
      const playing = s.playing !== false && !c.leaving && !c.walking;
      const sel = G.ui.sel && G.ui.sel.kind === 'source' && G.ui.sel.id === s.id;
      const cringe = fx.larsenOn && !c.leaving;
      const lvl = playing ? Math.max(0, Math.min(1, ((s.dyn || 0) + 4) / 6)) : 0;
      const p = this.P(c.x, c.y, this.floorZ(c.y));
      const k = p[2];
      const ctx = this.ctx;
      const box = { x0: p[0], y0: p[1], x1: p[0], y1: p[1] };
      const grow = (x, y) => { box.x0 = Math.min(box.x0, x); box.x1 = Math.max(box.x1, x); box.y0 = Math.min(box.y0, y); box.y1 = Math.max(box.y1, y); };
      // ombre
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(p[0], p[1], k * (c.wide ? c.wide / 2 + 0.2 : 0.32), k * 0.07, 0, 0, Math.PI * 2); ctx.fill();
      if (sel) {
        ctx.strokeStyle = AMBER; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(p[0], p[1], k * (c.wide ? c.wide / 2 + 0.3 : 0.42), k * 0.1, 0, 0, Math.PI * 2); ctx.stroke();
      }
      if (G.ui.armed && G.ui.armed.kind === 'mic' && !c.leaving) {
        ctx.strokeStyle = 'rgba(242,165,58,' + (0.5 + 0.4 * Math.sin(this.t * 6)) + ')'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.ellipse(p[0], p[1], k * (c.wide ? c.wide / 2 + 0.3 : 0.45), k * 0.11, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
      const t = this.t + c.phase;
      const pose = { mouth: playing && this.sings(type) ? 0.3 + 0.7 * lvl * (0.5 + 0.5 * Math.sin(t * 9)) : 0, cringe, walking: c.walking, step: c.step };
      const hasHF = G.state.mics.some(m => m.sourceId === s.id && D.MICS[m.type].hf && m.type !== 'headset' && this.placed.has(m.uid));
      const hasHeadset = G.state.mics.some(m => m.sourceId === s.id && m.type === 'headset' && this.placed.has(m.uid));
      const bubble = (G.fx.bubbles || []).find(b => b.who === s.id);
      const pointing = bubble && bubble.kind === 'need';

      if (c.wide) {
        this.drawChoir(c, p, playing, lvl, cringe, grow);
      } else if (type === 'piano') {
        this.drawPerson(p[0] - k * 0.05, p[1] - k * 0.02, k, c.look, Object.assign(pose, { seated: true, arms: playing ? 'keys' : 'rest' }), t, grow);
        this.drawPiano(p, k, grow);
      } else if (type === 'gc' || type === 'cc' || type === 'oh') {
        if (type === 'gc') {
          this.drawPerson(p[0], this.P(c.x, c.y - 0.45, SZ)[1], this.P(c.x, c.y - 0.45, SZ)[2], c.look, Object.assign(pose, { seated: true, arms: playing ? 'drums' : 'rest' }), t, grow);
          this.drawKick(p, k, grow, playing, t);
        } else if (type === 'cc') this.drawSnare(p, k, grow, playing, t);
        else this.drawCymbals(p, k, grow, playing, t);
      } else if (type === 'guitare_elec') {
        this.drawAmp(p[0], p[1], k, grow, playing, lvl);
        const gp = this.P(c.x - 0.75, c.y + 0.35, SZ);
        this.drawPerson(gp[0], gp[1], gp[2], c.look, Object.assign(pose, { arms: playing ? 'guitar' : 'hold', instr: 'electric' }), t, grow);
      } else if (type === 'basse') {
        const ap = this.P(c.x + 0.55, c.y - 0.35, SZ);
        this.drawAmp(ap[0], ap[1], ap[2] * 0.85, grow, playing, lvl);
        this.drawPerson(p[0], p[1], k, c.look, Object.assign(pose, { arms: playing ? 'guitar' : 'hold', instr: 'bass' }), t, grow);
      } else if (type === 'clavier') {
        this.drawPerson(p[0], p[1] - k * 0.02, k, c.look, Object.assign(pose, { arms: playing ? 'keys' : 'rest' }), t, grow);
        this.drawKeyboard(p, k, grow);
      } else if (type === 'cajon') {
        this.drawCajon(p, k, grow);
        this.drawPerson(p[0], p[1], k, c.look, Object.assign(pose, { seated: true, arms: playing ? 'cajon' : 'rest', sitZ: 0.48 }), t, grow);
      } else if (type === 'parole') {
        this.drawPerson(p[0], p[1] - k * 0.05, k, c.look, Object.assign(pose, { arms: cringe ? 'ears' : 'lectern' }), t, grow);
        this.drawLectern(c, p, k, grow);
      } else {
        let arms = 'rest';
        if (pointing) arms = 'point';
        else if (s.aim) arms = 'aim';
        else if (hasHF) arms = 'mic';
        else if (type === 'guitare_folk') arms = playing ? 'guitar' : 'hold';
        else if (type === 'violon') arms = 'violin';
        else if (['saxo', 'trompette', 'flute'].includes(type)) arms = 'wind';
        const instr = type === 'guitare_folk' ? 'acoustic' : type === 'violon' ? 'violin' : type === 'saxo' ? 'sax' : type === 'trompette' ? 'trumpet' : type === 'flute' ? 'flute' : null;
        this.drawPerson(p[0], p[1], k, c.look, Object.assign(pose, { arms, instr, hf: hasHF, headset: hasHeadset }), t, grow);
      }
      // nom sous le musicien
      if (!c.leaving && (sel || (G.ui.help && type !== 'cc' && type !== 'oh'))) {
        ctx.font = '500 ' + Math.max(9, Math.min(14, k * 0.15)) + 'px ' + F_BODY;
        ctx.textAlign = 'center';
        ctx.fillStyle = playing ? 'rgba(223,226,218,0.95)' : 'rgba(149,156,165,0.9)';
        ctx.fillText(s.name, p[0], p[1] + k * 0.2 + 6);
        ctx.textAlign = 'left';
      }
      // musicien qui joue mais qu’on n’entend pas (voie coupée)
      if (G.show && (G.fx.unheard || []).includes(s.id)) {
        const hz = this.P(c.x, c.y, this.headZ(c) + 0.45);
        this.drawBadge(hz[0] + k * 0.25, hz[1], k, 'COUPÉ', RED);
      }
      if (!c.leaving) this.hits.push({ kind: 'source', id: s.id, x0: box.x0 - 4, y0: box.y0 - 4, x1: box.x1 + 4, y1: p[1] + 6 });
    },

    sings(type) { return ['voix', 'soliste', 'parole', 'chorale'].includes(type); },

    drawBadge(x, y, k, text, col) {
      const ctx = this.ctx;
      ctx.font = '700 ' + Math.max(9, k * 0.12) + 'px ' + F_LABEL;
      const w = ctx.measureText(text).width + 8;
      ctx.fillStyle = col;
      rr(ctx, x, y - 8, w, 15, 3); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(text, x + 4, y + 3);
    },

    // Un bonhomme vu de face. (px, py) : pieds. k : pixels par mètre.
    drawPerson(px, py, k, look, pose, t, grow) {
      const ctx = this.ctx;
      look = look || { shirt: '#5a6270', hair: '#2b1b14', skin: '#e8b48f', style: 'short' };
      const kid = !!look.kid;
      const sc = kid ? 0.76 : 1;
      const u = k * sc;
      const seated = pose.seated;
      const Mu = root.SonoMusic;
      const active = pose.mouth > 0.05 || ['guitar', 'keys', 'drums', 'cajon', 'violin', 'wind'].includes(pose.arms);
      const beat = Mu && Mu.playing ? Mu.beat : (t * 1.6) % 1;
      const dance = active && !REDUCED ? Math.pow(Math.abs(Math.sin(beat * Math.PI)), 2) * 0.025 : 0;
      const breathe = Math.sin(t * 2.1) * 0.006;
      const bob = (pose.walking ? Math.abs(Math.sin(pose.step)) * 0.035 : 0) + dance;
      const sway = active && !REDUCED ? Math.sin(beat * Math.PI * 2) * 0.012 : 0;
      const hipZ = seated ? (pose.sitZ || 0.55) / sc : 0.74;
      const shZ = hipZ + 0.5 + breathe;
      const headZ = shZ + 0.1;
      const Y = (z) => py - (z + bob) * u;
      const X = (x) => px + (x + sway * (z0(x))) * u;
      function z0() { return 1; }
      const skin = look.skin, shirt = look.shirt;
      const dark = shade(shirt, 0.62), light = shade(shirt, 1.18);
      const pants = look.pants || '#262b36';
      const ol = 'rgba(10,10,14,0.55)';
      const lw = Math.max(1, u * 0.012);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      // jambes + chaussures
      if (!seated) {
        const sw = pose.walking ? Math.sin(pose.step) * 0.12 : 0;
        const leg = (x0, x1) => {
          ctx.strokeStyle = ol; ctx.lineWidth = Math.max(3, u * 0.135);
          ctx.beginPath(); ctx.moveTo(X(x0), Y(hipZ)); ctx.lineTo(X(x1), Y(0.07)); ctx.stroke();
          ctx.strokeStyle = pants; ctx.lineWidth = Math.max(2, u * 0.11);
          ctx.beginPath(); ctx.moveTo(X(x0), Y(hipZ)); ctx.lineTo(X(x1), Y(0.07)); ctx.stroke();
          ctx.fillStyle = '#15171c';
          ctx.beginPath(); ctx.ellipse(X(x1 + (x1 < 0 ? -0.02 : 0.02)), Y(0.035), u * 0.075, u * 0.04, 0, 0, Math.PI * 2); ctx.fill();
        };
        leg(-0.07, -0.085 + sw); leg(0.07, 0.085 - sw);
      }
      // bras (derrière, pour certaines poses ils passent devant : on dessine après le torse)
      const sh = [[X(-0.155), Y(shZ - 0.06)], [X(0.155), Y(shZ - 0.06)]];
      const arm = (s, ex, ez, hx, hz) => {
        const e = [X(ex), Y(ez)], hnd = [X(hx), Y(hz)];
        ctx.strokeStyle = ol; ctx.lineWidth = Math.max(3, u * 0.105);
        ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(e[0], e[1]); ctx.lineTo(hnd[0], hnd[1]); ctx.stroke();
        ctx.strokeStyle = shirt; ctx.lineWidth = Math.max(2, u * 0.085);
        ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(e[0], e[1]); ctx.stroke();
        ctx.strokeStyle = skin; ctx.lineWidth = Math.max(1.8, u * 0.068);
        ctx.beginPath(); ctx.moveTo(e[0], e[1]); ctx.lineTo(hnd[0], hnd[1]); ctx.stroke();
        ctx.fillStyle = skin; ctx.strokeStyle = ol; ctx.lineWidth = lw;
        ctx.beginPath(); ctx.arc(hnd[0], hnd[1], Math.max(1.8, u * 0.048), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        return hnd;
      };
      // torse : épaules arrondies, ombré
      const tw = 0.19, bw = 0.155;
      ctx.beginPath();
      ctx.moveTo(X(-bw), Y(hipZ - 0.04));
      ctx.lineTo(X(-tw), Y(shZ - 0.1));
      ctx.quadraticCurveTo(X(-tw), Y(shZ + 0.02), X(-0.08), Y(shZ + 0.02));
      ctx.lineTo(X(0.08), Y(shZ + 0.02));
      ctx.quadraticCurveTo(X(tw), Y(shZ + 0.02), X(tw), Y(shZ - 0.1));
      ctx.lineTo(X(bw), Y(hipZ - 0.04));
      ctx.quadraticCurveTo(X(0), Y(hipZ - 0.08), X(-bw), Y(hipZ - 0.04));
      ctx.closePath();
      const tg = ctx.createLinearGradient(X(-tw), Y(shZ), X(tw), Y(hipZ));
      tg.addColorStop(0, light); tg.addColorStop(0.55, shirt); tg.addColorStop(1, dark);
      ctx.fillStyle = tg; ctx.fill();
      ctx.strokeStyle = ol; ctx.lineWidth = lw; ctx.stroke();
      // col
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.moveTo(X(-0.055), Y(shZ + 0.02)); ctx.lineTo(X(0), Y(shZ - 0.06)); ctx.lineTo(X(0.055), Y(shZ + 0.02)); ctx.closePath(); ctx.fill();
      // cou
      ctx.fillStyle = shade(skin, 0.85);
      ctx.fillRect(X(-0.04), Y(headZ + 0.02), 0.08 * u, 0.1 * u);

      const a = pose.cringe ? 'ears' : pose.arms;
      const osc = Math.sin(t * 10);
      let mouthHand = null;
      if (pose.instr === 'acoustic' || pose.instr === 'electric' || pose.instr === 'bass') this.drawGuitar(X, Y, u, pose.instr, hipZ);
      if (a === 'ears') {
        arm(sh[0], -0.3, shZ + 0.02, -0.17, headZ + 0.12); arm(sh[1], 0.3, shZ + 0.02, 0.17, headZ + 0.12);
      } else if (a === 'mic') {
        arm(sh[0], -0.23, hipZ + 0.22, -0.21, hipZ + 0.04);
        mouthHand = arm(sh[1], 0.22, shZ - 0.28, 0.07, headZ - 0.03);
      } else if (a === 'aim') {
        arm(sh[0], -0.23, hipZ + 0.22, -0.21, hipZ + 0.04);
        mouthHand = arm(sh[1], 0.26, shZ - 0.32, 0.31, hipZ - 0.1);
      } else if (a === 'point') {
        arm(sh[0], -0.23, hipZ + 0.22, -0.21, hipZ + 0.04);
        arm(sh[1], 0.32, shZ - 0.1, 0.47, hipZ - 0.05);
      } else if (a === 'guitar') {
        arm(sh[0], -0.25, shZ - 0.2, 0.29, hipZ + 0.33);
        arm(sh[1], 0.21, shZ - 0.28, -0.04, hipZ + 0.1 + osc * 0.06);
      } else if (a === 'hold') {
        arm(sh[0], -0.25, shZ - 0.2, 0.27, hipZ + 0.3);
        arm(sh[1], 0.21, shZ - 0.3, -0.02, hipZ + 0.12);
      } else if (a === 'keys') {
        arm(sh[0], -0.23, shZ - 0.28, -0.19 + osc * 0.02, shZ - 0.42);
        arm(sh[1], 0.23, shZ - 0.28, 0.19 - osc * 0.02, shZ - 0.42 + Math.cos(t * 11) * 0.02);
      } else if (a === 'drums') {
        const h1 = arm(sh[0], -0.29, shZ - 0.2, -0.33, shZ - 0.2 + Math.max(0, osc) * 0.3);
        const h2 = arm(sh[1], 0.29, shZ - 0.2, 0.33, shZ - 0.2 + Math.max(0, -osc) * 0.3);
        ctx.strokeStyle = '#e2cfa4'; ctx.lineWidth = Math.max(1.4, u * 0.028);
        for (const [hh, d] of [[h1, -1], [h2, 1]]) { ctx.beginPath(); ctx.moveTo(hh[0], hh[1]); ctx.lineTo(hh[0] + d * u * 0.12, hh[1] - u * 0.3); ctx.stroke(); }
      } else if (a === 'cajon') {
        arm(sh[0], -0.23, shZ - 0.3, -0.08, hipZ - 0.05 + Math.max(0, osc) * 0.08);
        arm(sh[1], 0.23, shZ - 0.3, 0.08, hipZ - 0.05 + Math.max(0, -osc) * 0.08);
      } else if (a === 'lectern') {
        arm(sh[0], -0.23, shZ - 0.3, -0.14, shZ - 0.4);
        arm(sh[1], 0.23, shZ - 0.3, 0.14, shZ - 0.4);
      } else if (a === 'violin') {
        ctx.fillStyle = '#8a4b22'; ctx.beginPath(); ctx.ellipse(X(-0.11), Y(shZ + 0.02), u * 0.13, u * 0.065, -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#3a2412'; ctx.lineWidth = Math.max(1.5, u * 0.02); ctx.beginPath(); ctx.moveTo(X(-0.02), Y(shZ + 0.04)); ctx.lineTo(X(-0.36), Y(shZ - 0.06)); ctx.stroke();
        arm(sh[0], -0.27, shZ - 0.05, -0.32, shZ - 0.04);
        const hb = arm(sh[1], 0.3, shZ - 0.1 + osc * 0.05, 0.05 + osc * 0.15, shZ - 0.03);
        ctx.strokeStyle = '#d9c39a'; ctx.lineWidth = Math.max(1, u * 0.012);
        ctx.beginPath(); ctx.moveTo(hb[0] - u * 0.3, hb[1] - u * 0.06); ctx.lineTo(hb[0] + u * 0.2, hb[1] + u * 0.04); ctx.stroke();
      } else if (a === 'wind') {
        ctx.strokeStyle = pose.instr === 'flute' ? '#c8ccd2' : '#d8b04a'; ctx.lineWidth = Math.max(2, u * 0.05);
        ctx.beginPath();
        if (pose.instr === 'flute') { ctx.moveTo(X(-0.02), Y(headZ + 0.03)); ctx.lineTo(X(0.58), Y(headZ - 0.07)); }
        else if (pose.instr === 'trumpet') { ctx.moveTo(X(0), Y(headZ + 0.03)); ctx.lineTo(X(0), Y(headZ - 0.32)); ctx.lineTo(X(0.1), Y(headZ - 0.37)); }
        else { ctx.moveTo(X(0), Y(headZ + 0.03)); ctx.lineTo(X(0.02), Y(hipZ + 0.05)); ctx.quadraticCurveTo(X(0.05), Y(hipZ - 0.08), X(0.16), Y(hipZ + 0.05)); }
        ctx.stroke();
        arm(sh[0], -0.21, shZ - 0.22, 0.06, headZ - 0.06);
        arm(sh[1], 0.22, shZ - 0.22, 0.24, headZ - 0.09);
      } else {
        arm(sh[0], -0.23, hipZ + 0.22, -0.21, hipZ + 0.04);
        arm(sh[1], 0.23, hipZ + 0.22, 0.21, hipZ + 0.04);
      }
      if (mouthHand) {
        ctx.save();
        ctx.translate(mouthHand[0], mouthHand[1]);
        ctx.rotate(a === 'aim' ? 2.6 : -0.5);
        ctx.fillStyle = '#1a1c20'; rr(ctx, -u * 0.022, -u * 0.02, u * 0.044, u * 0.18, u * 0.018); ctx.fill();
        const gg = ctx.createRadialGradient(-u * 0.012, -u * 0.06, 0, 0, -u * 0.045, u * 0.045);
        gg.addColorStop(0, '#eef1f5'); gg.addColorStop(1, '#8a9099');
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, -u * 0.045, u * 0.045, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      // ---- tête
      const hx = X(0), hy = Y(headZ + 0.12);
      const hr = 0.15 * u;
      const hair = look.hair, hairL = shade(hair, 1.5);
      ctx.fillStyle = hair;
      if (look.style === 'long') { ctx.beginPath(); ctx.ellipse(hx - hr * 0.88, hy + hr * 0.45, hr * 0.36, hr * 1.05, 0.08, 0, Math.PI * 2); ctx.ellipse(hx + hr * 0.88, hy + hr * 0.45, hr * 0.36, hr * 1.05, -0.08, 0, Math.PI * 2); ctx.fill(); }
      if (look.style === 'curly') { for (let i = 0; i < 9; i++) { const an = Math.PI * 0.95 + i * Math.PI / 7.2; ctx.beginPath(); ctx.arc(hx + Math.cos(an) * hr * 1.02, hy + Math.sin(an) * hr * 0.98, hr * 0.38, 0, Math.PI * 2); ctx.fill(); } }
      // oreilles
      ctx.fillStyle = shade(skin, 0.92);
      ctx.beginPath(); ctx.arc(hx - hr * 0.98, hy + hr * 0.1, hr * 0.2, 0, Math.PI * 2); ctx.arc(hx + hr * 0.98, hy + hr * 0.1, hr * 0.2, 0, Math.PI * 2); ctx.fill();
      // visage
      const fg = ctx.createRadialGradient(hx - hr * 0.35, hy - hr * 0.4, hr * 0.1, hx, hy, hr * 1.1);
      fg.addColorStop(0, shade(skin, 1.08)); fg.addColorStop(1, shade(skin, 0.9));
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.ellipse(hx, hy, hr, hr * 1.04, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = ol; ctx.lineWidth = lw; ctx.stroke();
      // cheveux (dessus)
      ctx.fillStyle = hair;
      if (look.style === 'bald') {
        ctx.beginPath(); ctx.arc(hx - hr * 0.88, hy - hr * 0.05, hr * 0.28, 0, Math.PI * 2); ctx.arc(hx + hr * 0.88, hy - hr * 0.05, hr * 0.28, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(hx - hr * 1.02, hy + hr * 0.05);
        ctx.quadraticCurveTo(hx - hr * 1.1, hy - hr * 1.15, hx, hy - hr * 1.12);
        ctx.quadraticCurveTo(hx + hr * 1.1, hy - hr * 1.15, hx + hr * 1.02, hy + hr * 0.05);
        ctx.quadraticCurveTo(hx + hr * 0.6, hy - hr * 0.55, hx + hr * 0.05, hy - hr * 0.5);
        ctx.quadraticCurveTo(hx - hr * 0.5, hy - hr * 0.45, hx - hr * 1.02, hy + hr * 0.05);
        ctx.fill();
        ctx.strokeStyle = hairL; ctx.lineWidth = Math.max(1, hr * 0.12); ctx.globalAlpha = 0.35;
        ctx.beginPath(); ctx.arc(hx - hr * 0.1, hy - hr * 0.35, hr * 0.62, Math.PI * 1.15, Math.PI * 1.55); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (look.style === 'bun') { ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(hx, hy - hr * 1.18, hr * 0.4, 0, Math.PI * 2); ctx.fill(); }
      // yeux
      const blink = (Math.sin(t * 0.9 + px * 0.01) > 0.985);
      const ey = hy + hr * 0.02, ex = hr * 0.38;
      if (pose.cringe) {
        ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.2, hr * 0.12);
        for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hx + d * ex - hr * 0.16, ey - hr * 0.12); ctx.lineTo(hx + d * ex + d * hr * 0.06, ey); ctx.lineTo(hx + d * ex - hr * 0.16, ey + hr * 0.12); ctx.stroke(); }
      } else if (blink || hr < 4) {
        ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, hr * 0.1);
        for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hx + d * ex - hr * 0.12, ey); ctx.lineTo(hx + d * ex + hr * 0.12, ey); ctx.stroke(); }
      } else {
        for (const d of [-1, 1]) {
          ctx.fillStyle = '#fbf8f2'; ctx.beginPath(); ctx.ellipse(hx + d * ex, ey, hr * 0.17, hr * 0.21, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#22180f'; ctx.beginPath(); ctx.arc(hx + d * ex + hr * 0.02, ey + hr * 0.03, hr * 0.11, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx + d * ex + hr * 0.06, ey - hr * 0.03, hr * 0.04, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = shade(hair, 0.9); ctx.lineWidth = Math.max(1, hr * 0.08);
        const lift = pose.mouth > 0.3 ? hr * 0.06 : 0;
        for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hx + d * ex - hr * 0.15, ey - hr * 0.32 - lift); ctx.quadraticCurveTo(hx + d * ex, ey - hr * 0.4 - lift, hx + d * ex + hr * 0.15, ey - hr * 0.3 - lift); ctx.stroke(); }
      }
      // joues
      ctx.fillStyle = 'rgba(232,110,110,0.22)';
      ctx.beginPath(); ctx.ellipse(hx - hr * 0.55, hy + hr * 0.38, hr * 0.17, hr * 0.1, 0, 0, Math.PI * 2); ctx.ellipse(hx + hr * 0.55, hy + hr * 0.38, hr * 0.17, hr * 0.1, 0, 0, Math.PI * 2); ctx.fill();
      // bouche
      const my = hy + hr * 0.55;
      if (pose.cringe) {
        ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, hr * 0.09);
        ctx.beginPath(); ctx.moveTo(hx - hr * 0.35, my);
        for (let i = 1; i <= 4; i++) ctx.lineTo(hx - hr * 0.35 + i * hr * 0.175, my + (i % 2 ? -1 : 1) * hr * 0.08);
        ctx.stroke();
      } else if (pose.mouth > 0.05) {
        ctx.fillStyle = '#5b1f1a';
        ctx.beginPath(); ctx.ellipse(hx, my, hr * 0.2, hr * (0.08 + 0.2 * pose.mouth), 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d9645b';
        ctx.beginPath(); ctx.ellipse(hx, my + hr * (0.04 + 0.12 * pose.mouth), hr * 0.12, hr * 0.06, 0, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.strokeStyle = shade(skin, 0.45); ctx.lineWidth = Math.max(1, hr * 0.08);
        ctx.beginPath(); ctx.arc(hx, my - hr * 0.15, hr * 0.22, 0.45, Math.PI - 0.45); ctx.stroke();
      }
      if (pose.headset) {
        ctx.strokeStyle = '#d9d9d9'; ctx.lineWidth = Math.max(1, u * 0.012);
        ctx.beginPath(); ctx.moveTo(hx + hr, hy - hr * 0.1); ctx.quadraticCurveTo(hx + hr * 0.9, hy + hr * 0.7, hx + hr * 0.25, hy + hr * 0.55); ctx.stroke();
      }
      grow(X(-0.38), Y(headZ + 0.34)); grow(X(0.38), Y(0));
      return { headX: hx, headY: hy };
    },

    drawGuitar(X, Y, u, kind, hipZ) {
      const ctx = this.ctx;
      const cz = hipZ + 0.12;
      ctx.save();
      if (kind === 'acoustic') {
        ctx.fillStyle = '#c58b4c';
        ctx.beginPath(); ctx.ellipse(X(-0.05), Y(cz), u * 0.17, u * 0.14, -0.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(X(0.1), Y(cz + 0.12), u * 0.12, u * 0.1, -0.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2a1a0e'; ctx.beginPath(); ctx.arc(X(0.03), Y(cz + 0.05), u * 0.04, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = kind === 'bass' ? '#e0e0e0' : '#b3261e';
        ctx.beginPath(); ctx.ellipse(X(-0.02), Y(cz), u * 0.13, u * 0.11, -0.4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = '#5b3a1e'; ctx.lineWidth = Math.max(2, u * 0.035);
      const len = kind === 'bass' ? 0.62 : 0.48;
      ctx.beginPath(); ctx.moveTo(X(0.05), Y(cz + 0.08)); ctx.lineTo(X(0.05 + len * 0.8), Y(cz + 0.08 + len * 0.5)); ctx.stroke();
      ctx.restore();
    },

    drawChoir(c, p, playing, lvl, cringe, grow) {
      const ctx = this.ctx;
      const s = c.src;
      const wide = c.wide;
      const r0 = rnd(hash(s.id + s.name));
      const rows = [{ y: c.y - 0.85, z: 0.44, n: 9 }, { y: c.y - 0.35, z: 0.22, n: 9 }];
      for (const row of rows) {
        // marche du gradin : dessus puis face avant
        const x0 = c.x - wide / 2 - 0.15, x1 = c.x + wide / 2 + 0.15;
        const t0 = this.P(x0, row.y - 0.25, SZ + row.z), t1 = this.P(x1, row.y + 0.25, SZ + row.z), f1 = this.P(x1, row.y + 0.25, SZ);
        ctx.fillStyle = '#3a3f48'; ctx.fillRect(t0[0], t0[1], t1[0] - t0[0], t1[1] - t0[1]);
        ctx.fillStyle = '#262a31'; ctx.fillRect(this.P(x0, row.y + 0.25, SZ)[0], t1[1], f1[0] - this.P(x0, row.y + 0.25, SZ)[0], f1[1] - t1[1]);
        for (let i = 0; i < row.n; i++) {
          const x = c.x - wide / 2 + 0.25 + i * (wide - 0.5) / (row.n - 1) + (row.y > c.y - 0.5 ? 0.12 : 0);
          const pp = this.P(x, row.y, SZ + row.z);
          const look = { shirt: '#2b3a67', hair: HAIRS[Math.floor(r0() * 6)], skin: SKINS[Math.floor(r0() * 5)], style: STYLES[Math.floor(r0() * 5)], kid: true };
          const t = this.t + i * 0.37;
          this.drawPerson(pp[0], pp[1], pp[2], look, { mouth: playing ? 0.3 + 0.6 * lvl * (0.5 + 0.5 * Math.sin(this.t * 7 + i * 0.2)) : 0, cringe, arms: 'rest' }, t, grow);
          // col de l’aube
          ctx.fillStyle = '#f2e6c4';
          ctx.beginPath(); ctx.arc(pp[0], pp[1] - pp[2] * 0.74 * 1.45, pp[2] * 0.05, 0, Math.PI); ctx.fill();
        }
      }
      grow(p[0] - p[2] * wide / 2, p[1]); grow(p[0] + p[2] * wide / 2, p[1]);
    },

    drawPiano(p, k, grow) {
      const ctx = this.ctx;
      const w = 1.5 * k, h = 1.0 * k;
      const x = p[0] - w / 2, y = p[1] - h + k * 0.15;
      ctx.fillStyle = '#1b1210';
      rr(ctx, x, y, w, h, 4); ctx.fill();
      ctx.fillStyle = '#2c1e19'; ctx.fillRect(x + 4, y + 4, w - 8, k * 0.2);
      ctx.fillStyle = '#e9e4d8'; ctx.fillRect(x + w * 0.08, y + k * 0.32, w * 0.84, k * 0.06);
      ctx.fillStyle = '#100a09';
      for (let i = 0; i < 18; i++) ctx.fillRect(x + w * 0.1 + i * w * 0.045, y + k * 0.32, Math.max(1, w * 0.012), k * 0.035);
      // pieds
      ctx.fillStyle = '#0f0a09'; ctx.fillRect(x + 6, y + h - 2, 6, k * 0.15); ctx.fillRect(x + w - 12, y + h - 2, 6, k * 0.15);
      grow(x, y); grow(x + w, y + h);
    },

    drawKeyboard(p, k, grow) {
      const ctx = this.ctx;
      const w = 1.2 * k, z = 0.95 * k;
      const x = p[0] - w / 2, y = p[1] - z + k * 0.2;
      ctx.strokeStyle = '#3a3f47'; ctx.lineWidth = Math.max(2, k * 0.03);
      ctx.beginPath(); ctx.moveTo(x + w * 0.2, y + k * 0.1); ctx.lineTo(x + w * 0.8, p[1] + k * 0.2); ctx.moveTo(x + w * 0.8, y + k * 0.1); ctx.lineTo(x + w * 0.2, p[1] + k * 0.2); ctx.stroke();
      ctx.fillStyle = '#121418'; rr(ctx, x, y - k * 0.06, w, k * 0.12, 3); ctx.fill();
      ctx.fillStyle = '#e9e4d8'; ctx.fillRect(x + w * 0.05, y - k * 0.01, w * 0.9, k * 0.04);
      grow(x, y - k * 0.1); grow(x + w, p[1]);
    },

    drawKick(p, k, grow, playing, t) {
      const ctx = this.ctx;
      const r = 0.3 * k;
      const cy = p[1] - r - k * 0.02;
      const hit = playing && Math.sin(t * 10) > 0.85 ? 1.03 : 1;
      // toms
      ctx.fillStyle = '#8b1e2d';
      ctx.beginPath(); ctx.ellipse(p[0] - r * 0.6, cy - r * 1.3, r * 0.42, r * 0.32, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(p[0] + r * 0.6, cy - r * 1.3, r * 0.42, r * 0.32, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8b1e2d';
      ctx.beginPath(); ctx.arc(p[0], cy, r * hit, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ebe6da';
      ctx.beginPath(); ctx.arc(p[0], cy, r * 0.86 * hit, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1e1c19';
      ctx.font = '700 ' + Math.max(8, r * 0.55) + 'px ' + F_LABEL;
      ctx.textAlign = 'center'; ctx.fillText('DM', p[0], cy + r * 0.18); ctx.textAlign = 'left';
      ctx.fillStyle = '#2a1b14'; ctx.beginPath(); ctx.arc(p[0] + r * 0.35, cy + r * 0.35, r * 0.17, 0, Math.PI * 2); ctx.fill();
      grow(p[0] - r * 1.1, cy - r * 1.7); grow(p[0] + r * 1.1, p[1]);
    },

    drawSnare(p, k, grow, playing, t) {
      const ctx = this.ctx;
      const z = 0.62 * k, r = 0.18 * k;
      ctx.strokeStyle = '#6b717b'; ctx.lineWidth = Math.max(1.5, k * 0.02);
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], p[1] - z); ctx.stroke();
      ctx.fillStyle = '#c4c8ce'; ctx.fillRect(p[0] - r, p[1] - z - k * 0.12, r * 2, k * 0.12);
      ctx.fillStyle = playing && Math.sin(t * 10 + 1.5) > 0.8 ? '#ffffff' : '#ebe6da';
      ctx.beginPath(); ctx.ellipse(p[0], p[1] - z - k * 0.12, r, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      // charleston
      ctx.beginPath(); ctx.moveTo(p[0] - r * 2, p[1]); ctx.lineTo(p[0] - r * 2, p[1] - z - k * 0.3); ctx.stroke();
      ctx.fillStyle = '#d4a93a'; ctx.beginPath(); ctx.ellipse(p[0] - r * 2, p[1] - z - k * 0.3, r * 1.1, r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
      grow(p[0] - r * 3.2, p[1] - z - k * 0.4); grow(p[0] + r, p[1]);
    },

    drawCymbals(p, k, grow, playing, t) {
      const ctx = this.ctx;
      ctx.strokeStyle = '#6b717b'; ctx.lineWidth = Math.max(1.5, k * 0.02);
      for (const [dx, z, rr0] of [[-0.75, 1.45, 0.32], [0.8, 1.35, 0.36]]) {
        const x = p[0] + dx * k;
        ctx.beginPath(); ctx.moveTo(x, p[1]); ctx.lineTo(x, p[1] - z * k); ctx.stroke();
        const wob = playing ? Math.sin(t * 9 + dx) * 0.08 : 0;
        ctx.fillStyle = '#d4a93a';
        ctx.beginPath(); ctx.ellipse(x, p[1] - z * k, rr0 * k, rr0 * k * 0.2, wob, 0, Math.PI * 2); ctx.fill();
      }
      grow(p[0] - 1.1 * k, p[1] - 1.55 * k); grow(p[0] + 1.2 * k, p[1]);
    },

    drawAmp(x, y, k, grow, playing, lvl) {
      const ctx = this.ctx;
      const w = 0.62 * k, h = 0.66 * k;
      ctx.fillStyle = '#16171a'; rr(ctx, x - w / 2, y - h, w, h, 3); ctx.fill();
      ctx.fillStyle = '#2b2620'; ctx.fillRect(x - w / 2 + 3, y - h + h * 0.22, w - 6, h * 0.72);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
      for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x - w / 2 + 3, y - h + h * 0.22 + i * h * 0.12); ctx.lineTo(x + w / 2 - 3, y - h + h * 0.22 + i * h * 0.12); ctx.stroke(); }
      ctx.fillStyle = playing ? 'rgba(242,165,58,' + (0.5 + lvl * 0.5) + ')' : '#5a4a30';
      ctx.beginPath(); ctx.arc(x + w * 0.3, y - h + h * 0.11, Math.max(1.5, k * 0.025), 0, Math.PI * 2); ctx.fill();
      grow(x - w / 2, y - h); grow(x + w / 2, y);
    },

    drawCajon(p, k, grow) {
      const ctx = this.ctx;
      const w = 0.34 * k, h = 0.48 * k;
      ctx.fillStyle = '#b07a43'; rr(ctx, p[0] - w / 2, p[1] - h, w, h, 3); ctx.fill();
      ctx.fillStyle = '#2a1a0e'; ctx.beginPath(); ctx.arc(p[0], p[1] - h * 0.45, w * 0.18, 0, Math.PI * 2); ctx.fill();
      grow(p[0] - w / 2, p[1] - h); grow(p[0] + w / 2, p[1]);
    },

    drawLectern(c, p, k, grow) {
      const ctx = this.ctx;
      const G = this.game;
      const w0 = 0.6 * k, w1 = 0.45 * k, h = 1.12 * k;
      const fy = p[1] + k * 0.05;
      ctx.fillStyle = '#5a3a22';
      ctx.beginPath();
      ctx.moveTo(p[0] - w0 / 2, fy - h); ctx.lineTo(p[0] + w0 / 2, fy - h); ctx.lineTo(p[0] + w1 / 2, fy); ctx.lineTo(p[0] - w1 / 2, fy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6e4a2c'; ctx.fillRect(p[0] - w0 / 2 - 2, fy - h - 4, w0 + 4, 6);
      ctx.fillStyle = '#e9e4d8'; ctx.fillRect(p[0] - w0 * 0.3, fy - h - 6, w0 * 0.45, 3);
      // col de cygne
      const mic = G.state.mics.find(m => m.sourceId === c.src.id && m.type === 'col' && this.placed.has(m.uid));
      if (mic) {
        const sel = G.ui.sel && G.ui.sel.kind === 'mic' && G.ui.sel.id === mic.uid;
        const near = c.src.distOffset > 0 ? 0.6 : 1;
        ctx.strokeStyle = sel ? AMBER : '#202227'; ctx.lineWidth = Math.max(1.5, k * 0.025);
        const hx = p[0] + w0 * 0.15, hy = fy - h - 2;
        const ex = p[0] + k * 0.05, ey = fy - h - k * 0.32 * near;
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(hx + k * 0.12, ey + k * 0.05, ex, ey); ctx.stroke();
        ctx.fillStyle = '#9aa0a8'; ctx.beginPath(); ctx.arc(ex, ey, Math.max(1.6, k * 0.025), 0, Math.PI * 2); ctx.fill();
        this.tagQueue.push({ x: ex + k * 0.08, y: ey - k * 0.05, k, ch: mic.ch, uid: mic.uid, sel });
        this.hits.push({ kind: 'mic', id: mic.uid, x0: ex - 10, y0: ey - 10, x1: hx + 10, y1: hy + 10 });
      }
      grow(p[0] - w0 / 2, fy - h); grow(p[0] + w0 / 2, fy);
    },

    // ------------------------------------------------------------ Micros, retours, technicien
    drawMic(m) {
      const ctx = this.ctx;
      const G = this.game;
      const def = D.MICS[m.type];
      const sel = G.ui.sel && G.ui.sel.kind === 'mic' && G.ui.sel.id === m.uid;
      const hot = G.fx.larsenOn && G.fx.micUid === m.uid;
      const base = this.micBase(m);
      if (def.kind === 'di') {
        const p = this.P(base.x, base.y, SZ);
        const k = p[2];
        ctx.fillStyle = sel ? AMBER : '#3b6e8f';
        rr(ctx, p[0] - k * 0.12, p[1] - k * 0.1, k * 0.24, k * 0.1, 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '700 ' + Math.max(7, k * 0.07) + 'px ' + F_LABEL;
        ctx.textAlign = 'center'; ctx.fillText(m.type === 'di_act' ? 'DI+' : 'DI', p[0], p[1] - k * 0.025); ctx.textAlign = 'left';
        this.tagQueue.push({ x: p[0] + k * 0.15, y: p[1] - k * 0.12, k, ch: m.ch, uid: m.uid, sel });
        this.hits.push({ kind: 'mic', id: m.uid, x0: p[0] - k * 0.16, y0: p[1] - k * 0.16, x1: p[0] + k * 0.16, y1: p[1] + 4 });
        return;
      }
      if (m.type === 'pzm') {
        const p = this.P(m.x, m.y, SZ);
        const k = p[2];
        ctx.fillStyle = sel ? AMBER : '#8a9099';
        ctx.beginPath(); ctx.ellipse(p[0], p[1], k * 0.14, k * 0.035, 0, 0, Math.PI * 2); ctx.fill();
        this.tagQueue.push({ x: p[0] + k * 0.16, y: p[1] - k * 0.06, k, ch: m.ch, uid: m.uid, sel });
        this.hits.push({ kind: 'mic', id: m.uid, x0: p[0] - k * 0.18, y0: p[1] - k * 0.1, x1: p[0] + k * 0.18, y1: p[1] + 4 });
        return;
      }
      const head = this.P(m.x, m.y, SZ + (m.z || 1.2));
      const foot = this.P(m.x, m.y, SZ);
      const k = foot[2];
      const vertical = m.axis && Math.abs(m.axis[2]) > 0.9;
      // pied de micro
      ctx.strokeStyle = sel ? AMBER : '#3c414a';
      ctx.lineWidth = Math.max(1.5, k * 0.022);
      const poleTop = vertical ? this.P(m.x + 0.45, m.y, SZ + (m.z || 2) + 0.15) : this.P(m.x, m.y, SZ + Math.max(0.2, (m.z || 1.2) - 0.12));
      const poleFoot = vertical ? this.P(m.x + 0.45, m.y, SZ) : foot;
      ctx.beginPath();
      ctx.moveTo(poleFoot[0] - k * 0.12, poleFoot[1] + k * 0.02); ctx.lineTo(poleFoot[0], poleFoot[1] - k * 0.05); ctx.lineTo(poleFoot[0] + k * 0.12, poleFoot[1] + k * 0.02);
      ctx.moveTo(poleFoot[0], poleFoot[1] - k * 0.05); ctx.lineTo(poleTop[0], poleTop[1]); ctx.lineTo(head[0], head[1]);
      ctx.stroke();
      // capsule orientée selon l’axe
      const ax = m.axis || [0, -1, 0];
      const tip = this.P(m.x + ax[0] * 0.12, m.y + ax[1] * 0.12, SZ + (m.z || 1.2) + ax[2] * 0.12);
      let dx = tip[0] - head[0], dy = tip[1] - head[1];
      const dl = Math.hypot(dx, dy);
      if (dl < 0.5) { dx = 0; dy = -1; } else { dx /= dl; dy /= dl; }
      const ang = Math.atan2(dy, dx);
      ctx.save();
      ctx.translate(head[0], head[1]); ctx.rotate(ang);
      const L = k * (m.type === 'beta52' ? 0.2 : m.type === 'c414' ? 0.18 : 0.16);
      const Wd = k * (m.type === 'beta52' ? 0.08 : m.type === 'c414' ? 0.06 : 0.035);
      ctx.fillStyle = hot ? RED : def.kind === 'cond' ? '#c3c8cf' : '#202226';
      rr(ctx, -L * 0.6, -Wd / 2, L, Wd, Wd / 2); ctx.fill();
      if (m.type === 'sm58' || m.type === 'beta58') { ctx.fillStyle = '#b9bec6'; ctx.beginPath(); ctx.arc(L * 0.4, 0, Wd * 1.05, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      if (sel) { ctx.strokeStyle = AMBER; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(head[0], head[1], k * 0.16, 0, Math.PI * 2); ctx.stroke(); }
      this.tagQueue.push({ x: head[0] + k * 0.12, y: head[1] - k * 0.12, k, ch: m.ch, uid: m.uid, sel });
      this.hits.push({ kind: 'mic', id: m.uid, x0: Math.min(head[0], poleFoot[0]) - k * 0.15, y0: head[1] - k * 0.18, x1: Math.max(head[0], poleFoot[0]) + k * 0.15, y1: poleFoot[1] + 4 });
    },

    wedgeCorners(w) {
      const ca = Math.cos(w.angle), sa = Math.sin(w.angle);
      const pt = (u, v, h) => this.P(w.x + u * ca - v * sa, w.y + u * sa + v * ca, SZ + h);
      return {
        bb: [pt(-0.22, -0.35, 0), pt(-0.22, 0.35, 0)],
        bt: [pt(-0.22, -0.35, 0.42), pt(-0.22, 0.35, 0.42)],
        fb: [pt(0.22, -0.35, 0), pt(0.22, 0.35, 0)],
        ft: [pt(0.22, -0.35, 0.14), pt(0.22, 0.35, 0.14)],
        face: pt(0.05, 0, 0.3), aim: pt(1.1, 0, 0.9)
      };
    },

    drawWedge(w) {
      const ctx = this.ctx;
      const G = this.game;
      const c = this.wedgeCorners(w);
      const col = AUX[w.bus];
      const sel = G.ui.sel && G.ui.sel.kind === 'wedge' && G.ui.sel.id === w.uid;
      const hot = G.fx.larsenOn && G.fx.spk === w.uid;
      const quad = (a, b, cc, d, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(cc[0], cc[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill(); };
      // côtés + dos + face inclinée (grille)
      quad(c.bb[0], c.bt[0], c.ft[0], c.fb[0], '#15171b');
      quad(c.bb[1], c.bt[1], c.ft[1], c.fb[1], '#15171b');
      quad(c.bb[0], c.bb[1], c.bt[1], c.bt[0], '#1f2228');
      quad(c.fb[0], c.fb[1], c.ft[1], c.ft[0], '#1f2228');
      quad(c.bt[0], c.bt[1], c.ft[1], c.ft[0], hot ? RED : '#2c3038');
      ctx.strokeStyle = sel ? AMBER : col; ctx.lineWidth = sel ? 3 : 2;
      ctx.beginPath(); ctx.moveTo(c.bt[0][0], c.bt[0][1]); ctx.lineTo(c.bt[1][0], c.bt[1][1]); ctx.stroke();
      const k = this.P(w.x, w.y, SZ)[2];
      ctx.fillStyle = col; ctx.font = '700 ' + Math.max(9, k * 0.16) + 'px ' + F_LABEL;
      ctx.textAlign = 'center';
      const mid = [(c.bt[0][0] + c.bt[1][0]) / 2, (c.bt[0][1] + c.bt[1][1]) / 2];
      ctx.fillText('R' + (w.bus + 1), mid[0], mid[1] - 4);
      ctx.textAlign = 'left';
      const xs = [c.bb[0][0], c.bb[1][0], c.fb[0][0], c.fb[1][0], c.bt[0][0], c.bt[1][0]];
      const ys = [c.bb[0][1], c.bb[1][1], c.fb[0][1], c.fb[1][1], c.bt[0][1], c.bt[1][1]];
      this.hits.push({ kind: 'wedge', id: w.uid, x0: Math.min(...xs) - 4, y0: Math.min(...ys) - 14, x1: Math.max(...xs) + 4, y1: Math.max(...ys) + 4 });
    },

    drawCrew(c) {
      const p = this.P(c.x, c.y, SZ);
      const look = { shirt: '#0d0e10', hair: '#2b1b14', skin: '#c98e66', style: 'short' };
      this.drawPerson(p[0], p[1], p[2], look, { arms: 'hold', walking: true, step: c.step }, this.t, () => {});
      const ctx = this.ctx;
      const k = p[2];
      ctx.fillStyle = '#ebe4cd'; ctx.font = '700 ' + Math.max(7, k * 0.08) + 'px ' + F_LABEL;
      ctx.textAlign = 'center'; ctx.fillText('CREW', p[0], p[1] - k * 1.15); ctx.textAlign = 'left';
      if (c.phase === 'go') {
        // ce qu’il porte
        ctx.fillStyle = c.task.kind === 'wedge' ? '#2c3038' : '#9aa0a8';
        if (c.task.kind === 'wedge') { rr(ctx, p[0] - k * 0.3, p[1] - k * 1.05, k * 0.6, k * 0.28, 3); ctx.fill(); }
        else { ctx.strokeStyle = '#6b717b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p[0] + k * 0.25, p[1] - k * 0.2); ctx.lineTo(p[0] + k * 0.25, p[1] - k * 1.3); ctx.stroke(); ctx.beginPath(); ctx.arc(p[0] + k * 0.25, p[1] - k * 1.32, k * 0.05, 0, Math.PI * 2); ctx.fill(); }
      }
    },

    // ------------------------------------------------------------ Son qui sort des enceintes
    busLevel(bus) {
      const ob = this.game.fx.busOut;
      if (!ob) return 0;
      const db = bus === 'main' ? ob.main : ob.aux[bus];
      return Math.max(0, Math.min(1, (db + 45) / 40));
    },

    drawWaves() {
      const ctx = this.ctx;
      const G = this.game;
      for (const w of G.state.wedges) {
        if (!this.placed.has(w.uid)) continue;
        const lv = this.busLevel(w.bus);
        if (lv <= 0.02) continue;
        const c = this.wedgeCorners(w);
        const ang = Math.atan2(c.aim[1] - c.face[1], c.aim[0] - c.face[0]);
        const k = this.P(w.x, w.y, SZ)[2];
        for (let i = 0; i < 3; i++) {
          const ph = ((this.t * 1.4 + i / 3) % 1);
          ctx.strokeStyle = AUX[w.bus];
          ctx.globalAlpha = lv * (1 - ph) * 0.8;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(c.face[0], c.face[1], k * (0.15 + ph * 0.7), ang - 0.55, ang + 0.55); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    },

    drawMains() {
      const ctx = this.ctx;
      const G = this.game;
      const lv = G.state.main.mute ? 0 : this.busLevel('main');
      for (const m of D.VENUE.mains) {
        const foot = this.P(m.x, m.y, 0), top = this.P(m.x, m.y, 2.75), mid = this.P(m.x, m.y, 1.75);
        const k = foot[2];
        const hot = G.fx.larsenOn && G.fx.spk === m.id;
        ctx.strokeStyle = '#2a2e35'; ctx.lineWidth = Math.max(2, k * 0.04);
        ctx.beginPath(); ctx.moveTo(foot[0] - k * 0.35, foot[1]); ctx.lineTo(mid[0], mid[1]); ctx.lineTo(foot[0] + k * 0.35, foot[1]); ctx.moveTo(foot[0], foot[1]); ctx.lineTo(mid[0], mid[1]); ctx.stroke();
        const w = 0.6 * k, h = top[1] - mid[1];
        ctx.fillStyle = '#0b0c0e'; rr(ctx, top[0] - w / 2, top[1], w, mid[1] - top[1], 4); ctx.fill();
        ctx.strokeStyle = hot ? RED : '#3a3f47'; ctx.lineWidth = hot ? 3 : 1.5; ctx.stroke();
        const pulse = 1 + lv * 0.06 * Math.sin(this.t * 18);
        ctx.fillStyle = '#1c1f24';
        ctx.beginPath(); ctx.arc(top[0], top[1] - h * 0.62, w * 0.34 * pulse, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2c3038'; ctx.beginPath(); ctx.arc(top[0], top[1] - h * 0.62, w * 0.12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1c1f24'; rr(ctx, top[0] - w * 0.3, top[1] - h * 0.24, w * 0.6, h * 0.12, 3); ctx.fill();
        ctx.fillStyle = 'rgba(223,226,218,0.6)'; ctx.font = '600 ' + Math.max(8, k * 0.12) + 'px ' + F_LABEL;
        ctx.textAlign = 'center'; ctx.fillText(m.id === 'L' ? 'FAÇADE J' : 'FAÇADE C', top[0], top[1] - 5); ctx.textAlign = 'left';
        // ondes vers le public
        if (lv > 0.02) {
          for (let i = 0; i < 3; i++) {
            const ph = ((this.t * 1.1 + i / 3) % 1);
            ctx.strokeStyle = AMBER;
            ctx.globalAlpha = lv * (1 - ph) * 0.55;
            ctx.lineWidth = 2;
            const dir = m.id === 'L' ? 0.35 : -0.35;
            ctx.beginPath(); ctx.arc(top[0], top[1] - h * 0.5, w * (0.6 + ph * 2.2), Math.PI / 2 + dir - 0.7, Math.PI / 2 + dir + 0.7); ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
        this.hits.push({ kind: 'main', id: m.id, x0: top[0] - w / 2, y0: top[1] - 14, x1: top[0] + w / 2, y1: mid[1] });
      }
    },

    drawLarsen() {
      const ctx = this.ctx;
      const G = this.game;
      const fx = G.fx;
      const loop = fx.loop;
      const ringing = !fx.larsenOn && loop && loop.worst.db > -3;
      if (!fx.larsenOn && !ringing) return;
      const m = G.state.mics.find(x => x.uid === fx.micUid);
      if (!m) return;
      const mp = this.P(m.x, m.y, SZ + (m.z || 1.2));
      let sp = null;
      const w = G.state.wedges.find(x => x.uid === fx.spk);
      if (w) sp = this.wedgeCorners(w).face;
      else {
        const mm = D.VENUE.mains.find(x => x.id === fx.spk);
        if (mm) { const p = this.P(mm.x, mm.y, 2.4); sp = p; }
      }
      const k = mp[2];
      const a = fx.larsenOn ? 0.9 : 0.35 + 0.25 * Math.sin(this.t * 8);
      ctx.strokeStyle = fx.larsenOn ? RED : AMBER;
      for (let i = 0; i < 3; i++) {
        const ph = ((this.t * (fx.larsenOn ? 3 : 1.5) + i / 3) % 1);
        ctx.globalAlpha = a * (1 - ph);
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(mp[0], mp[1], k * (0.15 + ph * 0.6), 0, Math.PI * 2); ctx.stroke();
        if (sp) { ctx.beginPath(); ctx.arc(sp[0], sp[1], k * (0.2 + ph * 0.8), 0, Math.PI * 2); ctx.stroke(); }
      }
      if (sp && fx.larsenOn) {
        // la boucle : un zigzag qui va de l’enceinte au micro
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 2;
        ctx.beginPath();
        const n = 18;
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          const x = sp[0] + (mp[0] - sp[0]) * t, y = sp[1] + (mp[1] - sp[1]) * t - Math.sin(t * Math.PI) * 30;
          const j = (i % 2 ? 1 : -1) * 5 * Math.sin(this.t * 40 + i);
          i ? ctx.lineTo(x + j, y - j) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },

    drawNotes() {
      const ctx = this.ctx;
      for (const n of this.notes) {
        const p = this.P(n.x + Math.sin(n.life * 3 + n.sway) * 0.12, n.y, n.z);
        ctx.globalAlpha = Math.max(0, 1 - n.life / 1.8) * 0.85;
        ctx.fillStyle = AMBER;
        ctx.font = Math.max(10, p[2] * 0.22) + 'px ' + F_BODY;
        ctx.fillText(n.g, p[0], p[1]);
      }
      ctx.globalAlpha = 1;
    },

    // ------------------------------------------------------------ Le public (vu de dos)
    drawAudience(show) {
      const ctx = this.ctx;
      const G = this.game;
      const mood = G.fx.mood ? G.fx.mood.kind : 'empty';
      for (const s of this.seats) {
        const p = this.P(s.x, s.y, 0);
        const k = p[2];
        // dossier de siège
        ctx.fillStyle = '#16181c';
        rr(ctx, p[0] - k * 0.23, p[1] - k * 0.9, k * 0.46, k * 0.42, k * 0.06); ctx.fill();
        if (!show && mood !== 'clap') continue;
        const kid = s.kid;
        const hz = kid ? 1.0 : 1.18;
        let bobY = 0, bobX = 0;
        const react = s.react;
        let hands = null;
        if (mood === 'larsen') { hands = 'ears'; bobX = Math.sin(this.t * 25 + s.phase) * 0.015; }
        else if (mood === 'loud' && react < 0.55) hands = 'ears';
        else if (mood === 'quiet' && react < 0.45) hands = 'cup';
        else if (mood === 'clap') hands = 'clap';
        else if (mood === 'happy' && !REDUCED) bobY = Math.abs(Math.sin(this.t * 4.2 + s.phase * 0.2)) * 0.035;
        else if (mood === 'ok' && !REDUCED) bobY = Math.abs(Math.sin(this.t * 2 + s.phase)) * 0.012;
        const lean = mood === 'quiet' && react < 0.45 ? -0.04 : 0;
        const hx = p[0] + (bobX + lean * 0.3) * k * 5, hy = p[1] - (hz + bobY) * k;
        ctx.fillStyle = s.shirt;
        ctx.beginPath(); ctx.ellipse(p[0], p[1] - (hz - 0.3) * k, k * (kid ? 0.17 : 0.22), k * 0.16, 0, Math.PI, 0); ctx.fill();
        ctx.fillRect(p[0] - k * (kid ? 0.17 : 0.22), p[1] - (hz - 0.3) * k, k * (kid ? 0.34 : 0.44), k * 0.25);
        ctx.fillStyle = s.hair;
        ctx.beginPath(); ctx.arc(hx, hy, k * (kid ? 0.1 : 0.12), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,220,180,0.08)';
        ctx.beginPath(); ctx.arc(hx, hy - k * 0.04, k * (kid ? 0.07 : 0.085), Math.PI, 0); ctx.fill();
        if (hands) {
          ctx.fillStyle = '#7a5a46';
          const hr = k * 0.045;
          if (hands === 'ears') { ctx.beginPath(); ctx.arc(hx - k * 0.13, hy, hr, 0, Math.PI * 2); ctx.arc(hx + k * 0.13, hy, hr, 0, Math.PI * 2); ctx.fill(); }
          else if (hands === 'cup') { ctx.beginPath(); ctx.arc(hx + k * 0.14, hy - k * 0.02, hr * 1.2, 0, Math.PI * 2); ctx.fill(); }
          else if (hands === 'clap') {
            const c = Math.sin(this.t * 16 + s.phase) * k * 0.05;
            ctx.beginPath(); ctx.arc(hx - k * 0.06 - c, hy - k * 0.22, hr, 0, Math.PI * 2); ctx.arc(hx + k * 0.06 + c, hy - k * 0.22, hr, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
      if (!show && mood !== 'clap') {
        const a = this.P(5, 5, SZ), b = this.P(5, 5, 0);
        ctx.fillStyle = 'rgba(149,156,165,0.75)';
        ctx.font = '600 ' + Math.max(10, Math.min(16, (b[1] - a[1]) * 0.5, this.W / 34)) + 'px ' + F_LABEL;
        ctx.textAlign = 'center';
        ctx.fillText(this.W < 640 ? 'SALLE VIDE · BALANCE' : 'SALLE VIDE · BALANCE AVANT L’OUVERTURE DES PORTES', a[0], (a[1] + b[1]) / 2 + 5);
        ctx.textAlign = 'left';
      }
    },

    drawBubbles() {
      const ctx = this.ctx;
      const G = this.game;
      const now = performance.now();
      for (const b of G.fx.bubbles || []) {
        if (b.until < now) continue;
        const src = E.findSource(G.state, b.who);
        if (!src) continue;
        const c = this.chars[this.charKey(src)];
        if (!c) continue;
        const p = this.P(c.x, c.y, this.headZ(c) + 0.35);
        const fs = Math.max(11, Math.min(15, p[2] * 0.15));
        ctx.font = '600 ' + fs + 'px ' + F_BODY;
        const w = ctx.measureText(b.text).width + 16, h = fs + 12;
        const x = Math.max(4, Math.min(this.W - w - 4, p[0] - w / 2)), y = p[1] - h - 8;
        ctx.fillStyle = b.kind === 'need' ? '#ebc54a' : '#f4f1e8';
        rr(ctx, x, y, w, h, 8); ctx.fill();
        ctx.beginPath(); ctx.moveTo(p[0] - 6, y + h - 1); ctx.lineTo(p[0], y + h + 8); ctx.lineTo(p[0] + 6, y + h - 1); ctx.fill();
        ctx.fillStyle = INK;
        ctx.fillText(b.text, x + 8, y + h - 8);
      }
    },

    // étiquettes de gaffer avec le numéro de voie, dessinées par-dessus tout
    tagQueue: [],
    drawTags() {
      const ctx = this.ctx;
      const G = this.game;
      for (const tg of this.tagQueue) {
        const fs = Math.max(9, Math.min(13, tg.k * 0.12));
        ctx.font = fs + 'px ' + F_TAPE;
        const txt = String(tg.ch + 1);
        const w = ctx.measureText(txt).width + 8;
        const ch = G.state.channels[tg.ch];
        ctx.fillStyle = tg.sel ? AMBER : TAPE;
        ctx.save(); ctx.translate(tg.x, tg.y); ctx.rotate(-0.06);
        ctx.fillRect(0, -fs, w, fs + 4);
        ctx.fillStyle = INK; ctx.fillText(txt, 4, 0);
        if (ch && ch.mute) { ctx.strokeStyle = RED; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-2, -fs - 2); ctx.lineTo(w + 2, 6); ctx.stroke(); }
        ctx.restore();
        // ce qui cloche sur cette voie, visible directement sur scène
        const L = (G.fx.levels || [])[tg.ch];
        if (L && L.mic && L.mic.uid === tg.uid) {
          let warn = null;
          if (!L.alive && /48/.test(L.reason)) warn = 'PAS DE 48 V';
          else if (L.alive && L.src && L.src.playing && L.peak > 0) warn = 'SATURE';
          if (warn && (warn !== 'SATURE' || Math.sin(this.t * 12) > -0.3)) this.drawBadge(tg.x + w + 4, tg.y - fs / 2, tg.k, warn, RED);
        }
      }
      this.tagQueue = [];
    },

    // ------------------------------------------------------------ Dessin réutilisable (mini-scènes du parcours)
    // Dessine dans un autre canvas avec les mêmes bonhommes et instruments.
    withCtx(ctx, t, fn) {
      const saveCtx = this.ctx, saveT = this.t;
      this.ctx = ctx; this.t = t;
      try { fn(); } finally { this.ctx = saveCtx; this.t = saveT; }
    },
    puppet(ctx, t, x, y, k, look, pose) {
      this.withCtx(ctx, t, () => this.drawPerson(x, y, k, look, pose, t, () => {}));
    },
    prop(ctx, t, kind, x, y, k, playing) {
      const g = () => {};
      this.withCtx(ctx, t, () => {
        if (kind === 'kick') this.drawKick([x, y, k], k, g, playing, t);
        else if (kind === 'piano') this.drawPiano([x, y, k], k, g);
        else if (kind === 'keyboard') this.drawKeyboard([x, y, k], k, g);
        else if (kind === 'amp') this.drawAmp(x, y, k, g, playing, 0.8);
        else if (kind === 'cymbals') this.drawCymbals([x, y, k], k, g, playing, t);
      });
    },

    // ------------------------------------------------------------ Interactions
    pick(sx, sy) {
      for (let i = this.hits.length - 1; i >= 0; i--) {
        const h = this.hits[i];
        if (sx >= h.x0 && sx <= h.x1 && sy >= h.y0 && sy <= h.y1) return h;
      }
      return null;
    },
    local(e) {
      const r = this.canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    },

    onDown(e) {
      const G = this.game;
      const [sx, sy] = this.local(e);
      const hit = this.pick(sx, sy);
      const floor = this.unproject(sx, sy, SZ);
      const armed = G.ui.armed;
      if (armed) {
        if (armed.kind === 'mic') {
          if (hit && hit.kind === 'source') G.attachMic(armed.type, hit.id);
          else G.say('Clique sur un musicien pour lui poser ce micro.', 'info');
        } else if (armed.kind === 'wedge') {
          if (floor && floor.y < 5.4 && floor.y > 0 && floor.x > -0.4 && floor.x < 10.4) G.placeWedge(floor.x, floor.y);
          else G.say('Pose le retour sur la scène.', 'info');
        } else if (armed.kind === 'source') {
          if (floor && floor.y < 5 && floor.y > 0.3 && floor.x > 0.3 && floor.x < 9.7) G.placeSource(armed.type, floor.x, floor.y);
          else G.say('Place le musicien sur la scène.', 'info');
        }
        return;
      }
      if (!hit) { G.select(null); return; }
      if (hit.kind === 'stagebox') { G.setSideTab('patch'); G.say('Le boîtier de scène : chaque prise envoie son micro vers la voie du même numéro sur la console.', 'info', 6000); return; }
      G.select(hit.kind, hit.id);
      if (!G.canEdit() || !floor) return;
      if (hit.kind === 'wedge') {
        const w = G.state.wedges.find(x => x.uid === hit.id);
        if (w) { this.canvas.setPointerCapture(e.pointerId); this.drag = { obj: w, dx: w.x - floor.x, dy: w.y - floor.y, kind: 'wedge' }; }
      } else if (hit.kind === 'source' && G.state.mode === 'atelier') {
        const s = G.state.sources.find(x => x.id === hit.id);
        if (s) { this.canvas.setPointerCapture(e.pointerId); this.drag = { obj: s, dx: s.x - floor.x, dy: s.y - floor.y, kind: 'source' }; }
      }
    },

    onMove(e) {
      const [sx, sy] = this.local(e);
      if (!this.drag) {
        const hit = this.pick(sx, sy);
        this.canvas.style.cursor = this.game.ui.armed ? 'crosshair' : hit ? 'pointer' : 'default';
        return;
      }
      const floor = this.unproject(sx, sy, SZ);
      if (!floor) return;
      const d = this.drag;
      const lim = d.kind === 'wedge' ? { x0: -0.3, x1: 10.3, y0: 0.2, y1: 5.3 } : { x0: 0.3, x1: 9.7, y0: 0.3, y1: 4.8 };
      d.obj.x = Math.max(lim.x0, Math.min(lim.x1, floor.x + d.dx));
      d.obj.y = Math.max(lim.y0, Math.min(lim.y1, floor.y + d.dy));
      if (d.kind === 'source') { d.obj.home = { x: d.obj.x, y: d.obj.y }; const c = this.chars[this.charKey(d.obj)]; if (c) { c.x = d.obj.x; c.y = d.obj.y; } }
      d.moved = true;
      this.game.stageChanged();
    },

    onUp() {
      if (this.drag && this.drag.moved) this.game.stageChanged(true);
      this.drag = null;
    }
  };

  root.SonoSalle = Salle;
})(this);
