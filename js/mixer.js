/* Sono Sim — console de mixage : 48 voies en 3 banques de 16, façade + 4 retours (« sends on fader »), EQ graphique. */
(function (root) {
  'use strict';
  const D = root.SonoData;
  const E = root.SonoEngine;
  const U = root.SonoUI;
  const h = U.h;
  const LAYERS = [
    { id: 'main', label: 'FAÇADE', cls: 'l-main' },
    { id: 0, label: 'RETOUR 1', cls: 'l-a1' },
    { id: 1, label: 'RETOUR 2', cls: 'l-a2' },
    { id: 2, label: 'RETOUR 3', cls: 'l-a3' },
    { id: 3, label: 'RETOUR 4', cls: 'l-a4' }
  ];

  const G0 = (m) => m.game;
  const Mixer = {
    root: null, game: null, strips: [], master: null, layerBtns: [],

    init(el, game) {
      this.root = el;
      this.game = game;
      el.innerHTML = '';
      const bar = h('div', { class: 'layer-bar', role: 'tablist', 'aria-label': 'Mix affiché sur les faders' },
        h('span', { class: 'layer-title' }, 'Les faders contrôlent :'));
      for (const L of LAYERS) {
        const b = h('button', { class: 'layer-btn ' + L.cls, role: 'tab', 'data-layer': String(L.id), onclick: () => this.setLayer(L.id) }, L.label);
        b._layer = L.id;
        this.layerBtns.push(b);
        bar.appendChild(b);
      }
      bar.appendChild(h('span', { class: 'layer-help', id: 'layer-help' }));
      // banques : comme sur une console numérique, 16 faders physiques pour 48 voies
      const banks = h('div', { class: 'bank-bar', role: 'tablist', 'aria-label': 'Banque de voies' }, h('span', { class: 'layer-title' }, 'Voies'));
      this.bankBtns = [0, 1, 2].map(k => {
        const b = h('button', { class: 'bank-btn', role: 'tab', onclick: () => this.setBank(k) }, (k * 16 + 1) + '–' + (k * 16 + 16));
        banks.appendChild(b);
        return b;
      });
      this.bank = 0;
      const deck = h('div', { class: 'deck' });
      const stripsWrap = h('div', { class: 'strips' });
      const n = G0(this).state.channels.length;
      for (let i = 0; i < n; i++) {
        const s = this.buildStrip(i);
        this.strips.push(s);
        stripsWrap.appendChild(s.el);
      }
      this.master = this.buildMaster();
      deck.append(stripsWrap, this.master.el);
      el.append(bar, banks, deck);
      this.setLayer('main');
      this.setBank(0);
    },

    setBank(k) {
      this.bank = k;
      this.bankBtns.forEach((b, i) => { b.classList.toggle('on', i === k); b.setAttribute('aria-selected', String(i === k)); });
      this.strips.forEach((s, i) => { s.el.hidden = Math.floor(i / 16) !== k; });
      this.paintBanks();
    },
    // un point sur la banque qui contient des voies utilisées
    paintBanks() {
      const st = this.game.state;
      if (!st || !this.bankBtns) return;
      this.bankBtns.forEach((b, k) => b.classList.toggle('used', st.mics.some(m => Math.floor(m.ch / 16) === k)));
    },
    showChannel(i) { if (Math.floor(i / 16) !== this.bank) this.setBank(Math.floor(i / 16)); },

    setLayer(id) {
      this.game.ui.layer = id;
      for (const b of this.layerBtns) b.classList.toggle('on', b._layer === id);
      this.root.dataset.layer = id === 'main' ? 'main' : 'a' + (id + 1);
      const help = document.getElementById('layer-help');
      if (help) help.textContent = id === 'main'
        ? 'Niveau de chaque voie dans les enceintes du public.'
        : 'Ce que chaque voie envoie dans le retour ' + (id + 1) + ' (pré-fader).';
      this.refresh();
    },

    buildStrip(i) {
      const G = this.game;
      const ch = () => G.state.channels[i];
      const el = h('div', { class: 'strip', 'data-ch': i });
      const num = h('div', { class: 'ch-num' }, String(i + 1));
      const tape = h('div', { class: 'tape scribble' }, '');
      const b48 = h('button', { class: 'btn btn-48', 'aria-pressed': 'false', title: 'Alimentation fantôme 48 V' }, '48V');
      b48.addEventListener('click', () => { ch().phantom = !ch().phantom; G.changed('phantom', i); this.refreshStrip(i); });
      const gain = U.knob({
        label: 'GAIN', min: 0, max: 60, value: 20, def: 20, step: 0.5, aria: 'Gain voie ' + (i + 1),
        fmt: (v) => Math.round(v) + ' dB', onInput: (v) => { ch().gain = v; G.changed('gain', i); }
      });
      const bhpf = h('button', { class: 'btn btn-hpf', 'aria-pressed': 'false', title: 'Coupe-bas (filtre passe-haut)' }, 'HPF');
      bhpf.addEventListener('click', () => { ch().hpf = !ch().hpf; G.changed('hpf', i); this.refreshStrip(i); });
      const meter = U.meter();
      const clip = h('i', { class: 'clip-led', title: 'Saturation' });
      const fader = U.fader({
        value: E.NEG, aria: 'Fader voie ' + (i + 1),
        onInput: (db) => {
          const L = G.ui.layer;
          if (L === 'main') ch().fader = db; else ch().sends[L] = db;
          val.textContent = U.fmtDb(db);
          G.changed('fader', i);
        }
      });
      const val = h('div', { class: 'fader-val' }, '−∞');
      const mute = h('button', { class: 'btn btn-mute', 'aria-pressed': 'false' }, 'MUTE');
      mute.addEventListener('click', () => { ch().mute = !ch().mute; G.changed('mute', i); this.refreshStrip(i); });
      const sel = h('button', { class: 'btn btn-sel' }, 'SEL');
      sel.addEventListener('click', () => G.selectChannel(i));
      const fz = h('div', { class: 'fader-zone' }, h('div', { class: 'meter-col' }, clip, meter), fader);
      el.append(h('div', { class: 'strip-head' }, num, tape), b48, gain, bhpf, fz, val, h('div', { class: 'strip-btns' }, mute, sel));
      return { el, tape, b48, gain, bhpf, meter, clip, fader, val, mute, sel, clipT: 0 };
    },

    buildMaster() {
      const G = this.game;
      const bus = () => G.ui.layer === 'main' ? G.state.main : G.state.aux[G.ui.layer];
      const el = h('div', { class: 'strip master' });
      const title = h('div', { class: 'tape scribble master-tape' }, 'FAÇADE');
      const meter = U.meter('wide');
      const fader = U.fader({
        value: 0, aria: 'Master',
        onInput: (db) => { bus().fader = db; val.textContent = U.fmtDb(db); G.changed('master'); }
      });
      const val = h('div', { class: 'fader-val' }, '0.0');
      const mute = h('button', { class: 'btn btn-mute', 'aria-pressed': 'false' }, 'MUTE');
      mute.addEventListener('click', () => { bus().mute = !bus().mute; G.changed('master'); this.refresh(); });
      const geq = h('button', { class: 'btn btn-geq' }, 'EQ GRAPH.');
      geq.addEventListener('click', () => this.openGeq());
      const fz = h('div', { class: 'fader-zone' }, h('div', { class: 'meter-col' }, meter), fader);
      el.append(h('div', { class: 'strip-head' }, h('div', { class: 'ch-num' }, 'MST'), title), fz, val, h('div', { class: 'strip-btns' }, mute, geq));
      return { el, title, meter, fader, val, mute, geq };
    },

    tapeLabel(i) {
      const G = this.game;
      const mic = G.state.mics.find(m => m.ch === i);
      if (!mic) return '';
      const src = E.findSource(G.state, mic.sourceId);
      if (src) return D.SOURCES[src.type].short;
      return D.MICS[mic.type].short + ' (libre)';
    },

    refreshStrip(i) {
      const G = this.game;
      const s = this.strips[i];
      const c = G.state.channels[i];
      const mic = G.state.mics.find(m => m.ch === i);
      s.el.classList.toggle('empty', !mic);
      s.el.classList.toggle('selected', G.ui.selCh === i);
      s.tape.textContent = this.tapeLabel(i);
      s.b48.classList.toggle('on', c.phantom); s.b48.setAttribute('aria-pressed', String(c.phantom));
      s.bhpf.classList.toggle('on', c.hpf); s.bhpf.setAttribute('aria-pressed', String(c.hpf));
      s.mute.classList.toggle('on', c.mute); s.mute.setAttribute('aria-pressed', String(c.mute));
      s.gain.setValue(c.gain);
      const db = G.ui.layer === 'main' ? c.fader : c.sends[G.ui.layer];
      s.fader.setValue(db);
      s.val.textContent = U.fmtDb(db);
    },

    refresh() {
      const G = this.game;
      if (!G.state) return;
      for (let i = 0; i < this.strips.length; i++) this.refreshStrip(i);
      this.paintBanks();
      const L = G.ui.layer;
      const bus = L === 'main' ? G.state.main : G.state.aux[L];
      this.master.title.textContent = L === 'main' ? 'FAÇADE' : 'RETOUR ' + (L + 1);
      this.master.fader.setValue(bus.fader);
      this.master.val.textContent = U.fmtDb(bus.fader);
      this.master.mute.classList.toggle('on', bus.mute);
      this.master.mute.setAttribute('aria-pressed', String(bus.mute));
      if (this.geqOpen != null) this.renderGeq();
    },

    update(levels, now) {
      const G = this.game;
      const parts = [];
      for (const L of levels) {
        const s = this.strips[L.ch];
        const c = G.state.channels[L.ch];
        const pk = L.alive ? L.peak + (Math.random() - 0.5) * 2 : E.NEG;
        s.meter.setLevel(pk, now);
        if (pk > 0) s.clipT = now;
        s.clip.classList.toggle('on', now - s.clipT < 1200);
        if (L.alive && L.avg > E.NEG && !c.mute) {
          const send = G.ui.layer === 'main' ? c.fader : c.sends[G.ui.layer];
          if (send > E.NEG + 1) parts.push(L.peak + send);
        }
      }
      const bus = G.ui.layer === 'main' ? G.state.main : G.state.aux[G.ui.layer];
      const out = bus.mute ? E.NEG : E.dbSum(parts) + bus.fader;
      this.master.meter.setLevel(out, now);
    },

    // ------------------------------------------------------------ EQ graphique
    openGeq() {
      this.geqOpen = this.game.ui.layer;
      this.renderGeq();
      document.getElementById('geq-sheet').hidden = false;
    },
    closeGeq() {
      this.geqOpen = null;
      document.getElementById('geq-sheet').hidden = true;
    },
    renderGeq() {
      const G = this.game;
      const L = this.geqOpen;
      const bus = L === 'main' ? G.state.main : G.state.aux[L];
      const sheet = document.getElementById('geq-sheet');
      sheet.innerHTML = '';
      const head = h('div', { class: 'sheet-head' },
        h('h3', null, 'EQ graphique · ' + (L === 'main' ? 'Façade' : 'Retour ' + (L + 1))),
        h('p', { class: 'sheet-sub' }, 'Creuse de 3 à 6 dB la bande qui siffle en premier : c’est ce qu’on appelle « égaliser le système ». Inutile de tout creuser, chaque coupe enlève aussi du son.'),
        h('div', { class: 'sheet-actions' },
          h('button', { class: 'btn-text', onclick: () => { bus.geq.fill(0); G.changed('geq'); this.renderGeq(); } }, 'Remettre à plat'),
          h('button', { class: 'btn-text strong', onclick: () => this.closeGeq() }, 'Fermer')));
      const row = h('div', { class: 'geq-row' });
      this.geqBars = [];
      D.BANDS.forEach((fq, b) => {
        const v = h('div', { class: 'geq-val' }, U.fmtDb(bus.geq[b], 0));
        const fd = U.fader({
          value: bus.geq[b], linear: { min: -12, max: 12 }, cls: 'geq', aria: 'Bande ' + D.BAND_LABELS[b] + ' Hz',
          onInput: (db) => { bus.geq[b] = db; v.textContent = U.fmtDb(db, 0); G.changed('geq'); }
        });
        const risk = h('div', { class: 'geq-risk' });
        this.geqBars.push(risk);
        row.appendChild(h('div', { class: 'geq-band' }, risk, fd, v, h('div', { class: 'geq-f' }, D.BAND_LABELS[b])));
      });
      sheet.append(head, row);
    },
    updateGeqRisk(loop) {
      if (this.geqOpen == null || !this.geqBars) return;
      const help = this.game.ui.help;
      this.geqBars.forEach((el, b) => {
        const g = loop.sys[b];
        el.hidden = !help;
        el.className = 'geq-risk ' + (g > -3 ? 'r' : g > -8 ? 'y' : 'g');
        el.style.setProperty('--h', Math.max(0.05, Math.min(1, (g + 30) / 30)));
        el.title = 'Marge avant larsen : ' + (g > E.NEG + 1 ? (-g).toFixed(1) + ' dB' : '∞');
      });
    }
  };

  root.SonoMixer = Mixer;
})(this);
