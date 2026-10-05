/* Sono Sim — plan de scène (SVG) : musiciens, micros, retours, façade. */
(function (root) {
  'use strict';
  const D = root.SonoData;
  const E = root.SonoEngine;
  const NS = 'http://www.w3.org/2000/svg';
  const VB = { x: -1.5, y: -0.75, w: 13, h: 7.95 };
  const AUX_COL = ['var(--aux1)', 'var(--aux2)', 'var(--aux3)', 'var(--aux4)'];

  function s(tag, attrs, ...kids) {
    const el = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] != null && attrs[k] !== false) el.setAttribute(k, attrs[k]);
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
    }
    return el;
  }
  const f = (n) => Math.round(n * 1000) / 1000;

  function polarPath(pattern, ax, ay, cx, cy, scale) {
    const p = D.PATTERNS[pattern];
    if (!p) return '';
    const base = Math.atan2(ay, ax);
    let d = '';
    for (let i = 0; i <= 72; i++) {
      const t = i / 72 * Math.PI * 2;
      const r = Math.abs(p.a + (1 - p.a) * Math.cos(t)) * scale;
      const x = cx + Math.cos(base + t) * r, y = cy + Math.sin(base + t) * r;
      d += (i ? 'L' : 'M') + f(x) + ' ' + f(y);
    }
    return d + 'Z';
  }

  const Stage = {
    svg: null, game: null, drag: null,

    init(svg, game) {
      this.svg = svg;
      this.game = game;
      svg.setAttribute('viewBox', [VB.x, VB.y, VB.w, VB.h].join(' '));
      svg.addEventListener('pointerdown', (e) => this.onDown(e));
      svg.addEventListener('pointermove', (e) => this.onMove(e));
      svg.addEventListener('pointerup', (e) => this.onUp(e));
      svg.addEventListener('pointercancel', (e) => this.onUp(e));
    },

    toWorld(e) {
      const pt = this.svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const m = this.svg.getScreenCTM();
      if (!m) return { x: 0, y: 0 };
      const w = pt.matrixTransform(m.inverse());
      return { x: w.x, y: w.y };
    },

    onDown(e) {
      const G = this.game;
      const w = this.toWorld(e);
      const t = e.target.closest('[data-kind]');
      const kind = t ? t.getAttribute('data-kind') : null;
      const id = t ? t.getAttribute('data-id') : null;
      const armed = G.ui.armed;
      if (armed) {
        if (armed.kind === 'mic') {
          if (kind === 'source') G.attachMic(armed.type, id);
          else G.say('Clique sur un musicien pour lui poser ce micro.', 'info');
        } else if (armed.kind === 'wedge') {
          if (w.y < 5.6 && w.x > -0.5 && w.x < 10.5) G.placeWedge(w.x, w.y);
          else G.say('Pose le retour sur la scène.', 'info');
        } else if (armed.kind === 'source') {
          if (w.y < 5.2 && w.x > 0 && w.x < 10) G.placeSource(armed.type, w.x, w.y);
          else G.say('Place le musicien sur la scène.', 'info');
        }
        return;
      }
      if (kind === 'wedge') {
        G.select('wedge', id);
        if (G.canEdit()) { this.startDrag(e, 'wedge', id, w); }
      } else if (kind === 'source') {
        G.select('source', id);
        if (G.state.mode === 'atelier' && G.canEdit()) this.startDrag(e, 'source', id, w);
      } else if (kind === 'mic') {
        G.select('mic', id);
      } else if (kind === 'main') {
        G.select('main', id);
      } else {
        G.select(null);
      }
    },

    startDrag(e, kind, id, w) {
      const G = this.game;
      const obj = kind === 'wedge' ? G.state.wedges.find(x => x.uid === id) : G.state.sources.find(x => x.id === id);
      if (!obj) return;
      this.svg.setPointerCapture(e.pointerId);
      this.drag = { kind, obj, dx: obj.x - w.x, dy: obj.y - w.y, moved: false };
    },

    onMove(e) {
      if (!this.drag) return;
      const w = this.toWorld(e);
      const d = this.drag;
      const lim = d.kind === 'wedge' ? { x0: -0.3, x1: 10.3, y0: 0.2, y1: 5.4 } : { x0: 0.3, x1: 9.7, y0: 0.3, y1: 4.8 };
      d.obj.x = Math.max(lim.x0, Math.min(lim.x1, w.x + d.dx));
      d.obj.y = Math.max(lim.y0, Math.min(lim.y1, w.y + d.dy));
      if (d.kind === 'source') d.obj.home = { x: d.obj.x, y: d.obj.y };
      d.moved = true;
      this.game.stageChanged();
    },

    onUp() {
      if (this.drag && this.drag.moved) this.game.stageChanged(true);
      this.drag = null;
    },

    render() {
      const G = this.game;
      const st = G.state;
      const ui = G.ui;
      const svg = this.svg;
      while (svg.firstChild) svg.firstChild.remove();

      // ---- public
      const pub = s('g', { class: 'pub' });
      pub.appendChild(s('rect', { x: -1.4, y: 5.35, width: 12.8, height: 1.8, class: 'pub-floor' }));
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 17; c++) {
          pub.appendChild(s('circle', { cx: f(0.2 + c * 0.6 + (r % 2) * 0.3), cy: f(6.15 + r * 0.4), r: 0.09, class: 'seat' }));
        }
      }
      pub.appendChild(s('text', { x: 5, y: 7.02, class: 'plan-label pub-label', 'text-anchor': 'middle' }, 'PUBLIC · régie à 10 m ↓'));
      svg.appendChild(pub);

      // ---- plateau
      const stage = s('g', { class: 'plateau' });
      stage.appendChild(s('rect', { x: 0, y: 0, width: 10, height: 5, rx: 0.06, class: 'floor' }));
      for (let x = 1; x < 10; x++) stage.appendChild(s('line', { x1: x, y1: 0, x2: x, y2: 5, class: 'grid' }));
      for (let y = 1; y < 5; y++) stage.appendChild(s('line', { x1: 0, y1: y, x2: 10, y2: y, class: 'grid' }));
      stage.appendChild(s('line', { x1: 0, y1: 5, x2: 10, y2: 5, class: 'nez' }));
      stage.appendChild(s('text', { x: 5, y: -0.25, class: 'plan-label', 'text-anchor': 'middle' }, 'LOINTAIN'));
      stage.appendChild(s('text', { x: -0.55, y: 2.5, class: 'plan-label side', transform: 'rotate(-90 -0.55 2.5)', 'text-anchor': 'middle' }, 'JARDIN'));
      stage.appendChild(s('text', { x: 10.55, y: 2.5, class: 'plan-label side', transform: 'rotate(90 10.55 2.5)', 'text-anchor': 'middle' }, 'COUR'));
      stage.appendChild(s('text', { x: 9.9, y: 0.28, class: 'plan-scale', 'text-anchor': 'end' }, 'quadrillage : 1 m'));
      svg.appendChild(stage);

      const larsen = G.fx.larsenOn ? G.fx : null;

      // ---- façade
      for (const m of D.VENUE.mains) {
        const g = s('g', { 'data-kind': 'main', 'data-id': m.id, class: 'spk main' + (larsen && larsen.spk === m.id ? ' hot' : '') });
        g.appendChild(s('rect', { x: m.x - 0.38, y: m.y - 0.28, width: 0.76, height: 0.56, rx: 0.06, class: 'box' }));
        g.appendChild(s('circle', { cx: m.x, cy: m.y + 0.04, r: 0.17, class: 'cone' }));
        g.appendChild(s('text', { x: m.x, y: m.y - 0.4, class: 'spk-label', 'text-anchor': 'middle' }, m.id === 'L' ? 'FAÇADE J' : 'FAÇADE C'));
        svg.appendChild(g);
      }

      // ---- directivités (aide)
      if (ui.help) {
        const pg = s('g', { class: 'polars' });
        for (const mic of st.mics) {
          const def = D.MICS[mic.type];
          if (def.kind === 'di' || mic.axis == null) continue;
          const ax = mic.axis[0], ay = mic.axis[1];
          if (Math.hypot(ax, ay) < 0.3) continue;
          const sel = ui.sel && ui.sel.kind === 'mic' && ui.sel.id === mic.uid;
          pg.appendChild(s('path', { d: polarPath(def.pattern, ax, ay, mic.x, mic.y, sel ? 1.3 : 0.8), class: 'polar' + (sel ? ' sel' : '') }));
        }
        svg.appendChild(pg);
      }

      // ---- retours
      for (const w of st.wedges) {
        const deg = w.angle * 180 / Math.PI;
        const sel = ui.sel && ui.sel.kind === 'wedge' && ui.sel.id === w.uid;
        const g = s('g', {
          'data-kind': 'wedge', 'data-id': w.uid,
          class: 'spk wedge' + (sel ? ' sel' : '') + (larsen && larsen.spk === w.uid ? ' hot' : ''),
          transform: 'translate(' + f(w.x) + ' ' + f(w.y) + ') rotate(' + f(deg) + ')',
          style: '--bus:' + AUX_COL[w.bus]
        });
        // face avant orientée vers +x local
        g.appendChild(s('path', { d: 'M -0.22 -0.42 L 0.2 -0.32 L 0.2 0.32 L -0.22 0.42 Z', class: 'box' }));
        g.appendChild(s('line', { x1: 0.2, y1: -0.3, x2: 0.2, y2: 0.3, class: 'face' }));
        g.appendChild(s('path', { d: 'M 0.32 -0.12 L 0.5 0 L 0.32 0.12', class: 'dir' }));
        g.appendChild(s('text', { x: 0, y: 0.1, class: 'wedge-num', transform: 'rotate(' + f(-deg) + ')', 'text-anchor': 'middle' }, String(w.bus + 1)));
        svg.appendChild(g);
      }

      // ---- musiciens
      const needs = G.fx.needs || [];
      for (const src of st.sources) {
        const def = D.SOURCES[src.type];
        const sel = ui.sel && ui.sel.kind === 'source' && ui.sel.id === src.id;
        const g = s('g', { 'data-kind': 'source', 'data-id': src.id, class: 'src' + (src.playing !== false ? ' playing' : '') + (sel ? ' sel' : '') + (ui.armed && ui.armed.kind === 'mic' ? ' target' : '') });
        if (def.wide) {
          const wdt = def.wide;
          g.appendChild(s('rect', { x: f(src.x - wdt / 2), y: f(src.y - 0.45), width: wdt, height: 0.9, rx: 0.4, class: 'body' }));
          for (let i = 0; i < 9; i++) {
            g.appendChild(s('circle', { cx: f(src.x - wdt / 2 + 0.35 + i * (wdt - 0.7) / 8), cy: f(src.y + (i % 2 ? 0.15 : -0.15)), r: 0.11, class: 'kid' }));
          }
        } else {
          g.appendChild(s('circle', { cx: f(src.x), cy: f(src.y), r: 0.36, class: 'body' }));
          if (src.playing !== false) g.appendChild(s('circle', { cx: f(src.x), cy: f(src.y), r: 0.36, class: 'pulse' }));
          // regard
          const fx = Math.cos(src.facing), fy = Math.sin(src.facing);
          g.appendChild(s('line', { x1: f(src.x + fx * 0.22), y1: f(src.y + fy * 0.22), x2: f(src.x + fx * 0.36), y2: f(src.y + fy * 0.36), class: 'face' }));
        }
        g.appendChild(s('text', { x: f(src.x), y: f(src.y + 0.07), class: 'src-short', 'text-anchor': 'middle' }, def.short.length > 7 ? def.short.slice(0, 6) + '.' : def.short));
        g.appendChild(s('text', { x: f(src.x), y: f(src.y + (def.wide ? 0.78 : 0.68)), class: 'src-name', 'text-anchor': 'middle' }, src.name));
        const need = needs.find(n => n.who === src.id);
        if (need && !need.ok && (ui.help || G.state.phase === 'show')) {
          const by = src.y - (def.wide ? 0.75 : 0.62);
          g.appendChild(s('g', { class: 'bubble' },
            s('circle', { cx: f(src.x + 0.32), cy: f(by), r: 0.2 }),
            s('text', { x: f(src.x + 0.32), y: f(by + 0.09), 'text-anchor': 'middle' }, '?')));
        }
        svg.appendChild(g);
      }

      // ---- micros
      for (const mic of st.mics) {
        const def = D.MICS[mic.type];
        const sel = ui.sel && ui.sel.kind === 'mic' && ui.sel.id === mic.uid;
        const orphan = !E.findSource(st, mic.sourceId);
        const hot = larsen && larsen.micUid === mic.uid;
        const g = s('g', { 'data-kind': 'mic', 'data-id': mic.uid, class: 'mic k-' + def.kind + (sel ? ' sel' : '') + (orphan ? ' orphan' : '') + (hot ? ' hot' : '') });
        const x = mic.x, y = mic.y;
        if (def.kind === 'di') {
          const src = E.findSource(st, mic.sourceId);
          const dx = src ? src.x + 0.45 : x, dy = src ? src.y + 0.3 : y;
          g.appendChild(s('rect', { x: f(dx - 0.13), y: f(dy - 0.1), width: 0.26, height: 0.2, rx: 0.03, class: 'di' }));
          g.appendChild(s('text', { x: f(dx), y: f(dy + 0.05), class: 'mic-ch', 'text-anchor': 'middle' }, String(mic.ch + 1)));
        } else {
          const ax = mic.axis ? mic.axis[0] : 0, ay = mic.axis ? mic.axis[1] : -1;
          const n = Math.hypot(ax, ay) || 1;
          if (n > 0.3) g.appendChild(s('line', { x1: f(x), y1: f(y), x2: f(x + ax / n * 0.32), y2: f(y + ay / n * 0.32), class: 'axis' }));
          g.appendChild(s('circle', { cx: f(x), cy: f(y), r: 0.14, class: 'head' }));
          g.appendChild(s('text', { x: f(x), y: f(y + 0.055), class: 'mic-ch', 'text-anchor': 'middle' }, String(mic.ch + 1)));
        }
        svg.appendChild(g);
      }

      // ---- larsen
      if (larsen) {
        const lm = st.mics.find(m => m.uid === larsen.micUid);
        if (lm) svg.appendChild(s('circle', { cx: f(lm.x), cy: f(lm.y), r: 0.5, class: 'larsen-ring' }));
      }
    }
  };

  root.SonoStage = Stage;
})(this);
