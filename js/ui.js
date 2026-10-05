/* Sono Sim — composants d’interface : boutons rotatifs, faders, petits utilitaires DOM. */
(function (root) {
  'use strict';
  const E = root.SonoEngine;

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (k === 'style') el.setAttribute('style', v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
    }
    return el;
  }

  function fmtDb(db, digits) {
    if (db <= E.NEG + 1) return '−∞';
    const v = db.toFixed(digits == null ? 1 : digits);
    return (db > 0.05 ? '+' : '') + v.replace('-', '−');
  }
  function fmtHz(f) {
    if (f >= 1000) return (f / 1000).toFixed(f % 1000 ? 1 : 0).replace('.', ',') + ' kHz';
    return Math.round(f) + ' Hz';
  }

  // ------------------------------------------------------------ Bouton rotatif
  // opts: {label, min, max, value, step, log, def, fmt, onInput, cls, color}
  function knob(opts) {
    const el = h('div', { class: 'knob ' + (opts.cls || ''), tabindex: '0', role: 'slider', 'aria-label': opts.aria || opts.label });
    const dial = h('div', { class: 'knob-dial' }, h('div', { class: 'knob-tick' }));
    if (opts.color) dial.style.setProperty('--knob-color', opts.color);
    const lab = h('div', { class: 'knob-label' }, opts.label);
    const val = h('div', { class: 'knob-val' });
    el.append(lab, dial, val);
    let v = opts.value;
    const toN = (x) => opts.log ? Math.log(x / opts.min) / Math.log(opts.max / opts.min) : (x - opts.min) / (opts.max - opts.min);
    const fromN = (n) => {
      n = Math.max(0, Math.min(1, n));
      let x = opts.log ? opts.min * Math.pow(opts.max / opts.min, n) : opts.min + n * (opts.max - opts.min);
      if (opts.step) x = Math.round(x / opts.step) * opts.step;
      return x;
    };
    function paint() {
      const n = toN(v);
      dial.style.setProperty('--rot', (-135 + n * 270) + 'deg');
      val.textContent = opts.fmt ? opts.fmt(v) : String(Math.round(v));
      el.setAttribute('aria-valuenow', String(Math.round(v * 10) / 10));
      el.setAttribute('aria-valuetext', val.textContent);
    }
    function set(x, fire) {
      v = Math.max(opts.min, Math.min(opts.max, x));
      paint();
      if (fire && opts.onInput) opts.onInput(v);
    }
    let drag = null;
    dial.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      dial.setPointerCapture(e.pointerId);
      drag = { y: e.clientY, n: toN(v) };
      el.classList.add('active');
    });
    dial.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const fine = e.shiftKey ? 0.25 : 1;
      set(fromN(drag.n + (drag.y - e.clientY) / 160 * fine), true);
    });
    const end = () => { drag = null; el.classList.remove('active'); };
    dial.addEventListener('pointerup', end);
    dial.addEventListener('pointercancel', end);
    dial.addEventListener('dblclick', () => { if (opts.def != null) set(opts.def, true); });
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      set(fromN(toN(v) + (e.deltaY < 0 ? 1 : -1) * 0.02), true);
    }, { passive: false });
    el.addEventListener('keydown', (e) => {
      const k = e.key;
      const d = (k === 'ArrowUp' || k === 'ArrowRight') ? 1 : (k === 'ArrowDown' || k === 'ArrowLeft') ? -1 : 0;
      if (d) { e.preventDefault(); set(fromN(toN(v) + d * (e.shiftKey ? 0.1 : 0.02)), true); }
    });
    paint();
    el.setValue = (x) => { if (!drag) set(x, false); };
    el.getValue = () => v;
    return el;
  }

  // ------------------------------------------------------------ Fader
  // opts: {value (dB), onInput(dB), linear: {min,max} pour un fader linéaire (EQ graphique), cls, aria}
  function fader(opts) {
    const el = h('div', { class: 'fader ' + (opts.cls || ''), tabindex: '0', role: 'slider', 'aria-label': opts.aria || 'Fader' });
    const track = h('div', { class: 'fader-track' });
    const marks = h('div', { class: 'fader-marks' });
    const cap = h('div', { class: 'fader-cap' });
    const rail = h('div', { class: 'fader-rail' }, cap);
    el.append(marks, track, rail);
    const lin = opts.linear;
    const toPos = (db) => lin ? (db - lin.min) / (lin.max - lin.min) : E.dbToFader(db);
    const fromPos = (p) => {
      p = Math.max(0, Math.min(1, p));
      if (lin) return Math.round((lin.min + p * (lin.max - lin.min)) * 2) / 2;
      return E.faderToDb(p);
    };
    const markList = lin ? [lin.max, lin.max / 2, 0, lin.min / 2, lin.min] : [10, 0, -10, -30, -50];
    for (const m of markList) {
      const t = h('span', { class: 'fader-mark' + (m === 0 ? ' unity' : '') }, (m > 0 ? '+' : '') + String(m).replace('-', '−'));
      t.style.bottom = (toPos(m) * 100) + '%';
      marks.appendChild(t);
    }
    let v = opts.value;
    function paint() {
      const p = toPos(v);
      cap.style.bottom = (p * 100) + '%';
      el.setAttribute('aria-valuetext', fmtDb(v, 1) + ' dB');
    }
    function set(db, fire) {
      v = db;
      paint();
      if (fire && opts.onInput) opts.onInput(v);
    }
    let drag = null;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      const r = track.getBoundingClientRect();
      const onCap = e.target === cap;
      drag = { y: e.clientY, p: toPos(v), h: r.height };
      if (!onCap) {
        const p = 1 - (e.clientY - r.top) / r.height;
        drag.p = p; set(fromPos(p), true);
      }
      el.classList.add('active');
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const fine = e.shiftKey ? 0.25 : 1;
      set(fromPos(drag.p + (drag.y - e.clientY) / drag.h * fine), true);
    });
    const end = () => { drag = null; el.classList.remove('active'); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('dblclick', () => set(lin ? 0 : 0, true));
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      set(fromPos(toPos(v) + (e.deltaY < 0 ? 1 : -1) * 0.015), true);
    }, { passive: false });
    el.addEventListener('keydown', (e) => {
      const k = e.key;
      const d = (k === 'ArrowUp' || k === 'ArrowRight') ? 1 : (k === 'ArrowDown' || k === 'ArrowLeft') ? -1 : 0;
      if (d) { e.preventDefault(); set(fromPos(toPos(v) + d * (e.shiftKey ? 0.06 : 0.015)), true); }
    });
    paint();
    el.setValue = (db) => { if (!drag) set(db, false); };
    return el;
  }

  // ------------------------------------------------------------ Vu-mètre à LED
  const SEGS = [-48, -42, -36, -30, -24, -20, -16, -12, -9, -6, -3, 0];
  function meter(cls) {
    const el = h('div', { class: 'meter ' + (cls || '') });
    for (let i = SEGS.length - 1; i >= 0; i--) {
      const s = SEGS[i];
      el.appendChild(h('i', { class: 'seg ' + (s >= 0 ? 'r' : s >= -9 ? 'y' : 'g'), 'data-db': s }));
    }
    const segs = Array.from(el.children).reverse();
    let hold = E.NEG, holdT = 0;
    el.setLevel = (peak, now) => {
      if (peak > hold || now - holdT > 900) { hold = peak; holdT = now; }
      for (let i = 0; i < segs.length; i++) {
        const s = SEGS[i];
        segs[i].classList.toggle('on', peak >= s);
        segs[i].classList.toggle('hold', !(peak >= s) && hold >= s && (i === segs.length - 1 || hold < SEGS[i + 1]));
      }
    };
    return el;
  }

  function toast(container, msg, kind, ms) {
    const t = h('div', { class: 'toast ' + (kind || '') }, msg);
    container.appendChild(t);
    while (container.children.length > 3) container.firstChild.remove();
    setTimeout(() => t.classList.add('out'), ms || 5200);
    setTimeout(() => t.remove(), (ms || 5200) + 400);
    return t;
  }

  const store = {
    get(k, d) { try { const v = localStorage.getItem('sonosim.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('sonosim.' + k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } }
  };

  root.SonoUI = { h, knob, fader, meter, toast, fmtDb, fmtHz, store, SEGS };
})(this);
