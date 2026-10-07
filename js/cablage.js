/* Sono Sim — le câblage : on choisit un câble et on relie les bonnes prises, en suivant la fiche de patch.
 * Les branchements impossibles sont refusés tout de suite (avec l’explication) ; « Tester le son » envoie
 * le signal dans les câbles et Jérôme et Marc expliquent ce qui cloche. */
(function (root) {
  'use strict';

  // ------------------------------------------------------------ Les prises et les câbles
  const CONN = {
    xm: { name: 'XLR mâle', fam: 'xlr' },
    xf: { name: 'XLR femelle', fam: 'xlr' },
    jk: { name: 'jack', fam: 'jack' },
    sp: { name: 'speakON', fam: 'speakon' }
  };
  const CABLES = {
    xlr: { name: 'XLR', use: 'micros, DI, console → enceintes actives', color: '#58aee0', fits: ['xm', 'xf'] },
    jack: { name: 'Jack', use: 'clavier, guitare → DI', color: '#f2a53a', fits: ['jk'] },
    speakon: { name: 'SpeakON', use: 'ampli → enceinte passive', color: '#5ccaa9', fits: ['sp'] }
  };
  const ROLE = { mic: 'src', micS: 'src', keys: 'src', guitar: 'src', di: 'di', stagebox: 'stage', console: 'stage', amp: 'amp', spk: 'spk', wedge: 'spk', passive: 'spk' };
  const ROLE_COLOR = { src: '#f2a53a', di: '#bb86e6', stage: '#58aee0', amp: '#5ccaa9', spk: '#5bcb6d' };

  // ------------------------------------------------------------ Les appareils
  const port = (id, label, short, conn, dir) => ({ id, label, short, conn, dir });
  const micro = (id, name, col, kind) => ({ id, name, col, kind: kind || 'mic', ports: [port('out', 'Sortie', '', 'xm', 'out')] });
  const instrument = (id, name, col, kind) => ({ id, name, col, kind, ports: [port('out', 'Sortie', '', 'jk', 'out')] });
  const di = (id, name, col) => ({ id, name, col, kind: 'di', ports: [port('in', 'Entrée', 'In', 'jk', 'in'), port('out', 'Sortie', 'Out', 'xm', 'out')] });
  const stagebox = (id, n, col) => ({ id, name: 'Boîtier de scène', col, kind: 'stagebox', ports: Array.from({ length: n }, (_, i) => port('in' + (i + 1), 'Entrée ' + (i + 1), String(i + 1), 'xf', 'in')) });
  const OUTS = { L: ['Sortie G', 'G'], R: ['Sortie D', 'D'], A1: ['Aux 1', 'A1'], A2: ['Aux 2', 'A2'] };
  const desk = (id, col, o) => ({
    id, name: 'Console', col, kind: 'console', phantom: o.phantom,
    ports: Array.from({ length: o.ins || 0 }, (_, i) => port('in' + (i + 1), 'Entrée ' + (i + 1), String(i + 1), 'xf', 'in'))
      .concat(o.outs.map(k => port(k, OUTS[k][0], OUTS[k][1], 'xm', 'out')))
  });
  const speaker = (id, name, col, kind) => ({ id, name, col, kind: kind || 'spk', ports: [port('in', 'Entrée', '', 'xf', 'in')] });
  const passive = (id, name, col) => ({ id, name, col, kind: 'passive', ports: [port('in', 'Entrée', '', 'sp', 'in')] });
  const amp = (id, col) => ({ id, name: 'Ampli', col, kind: 'amp', ports: [port('inA', 'Entrée A', 'In A', 'xf', 'in'), port('inB', 'Entrée B', 'In B', 'xf', 'in'), port('outA', 'Sortie A', 'Out A', 'sp', 'out'), port('outB', 'Sortie B', 'Out B', 'sp', 'out')] });

  // ------------------------------------------------------------ Les installations
  const LEVELS = [
    {
      id: 'base', title: 'Un micro, deux enceintes', sub: 'Le chemin du son', who: 'jerome',
      intro: 'Le son va toujours d’une sortie vers une entrée. Ici, le micro entre dans la console, et la console sort vers les deux enceintes de façade. Elles sont actives : l’ampli est dedans. Choisis un câble, touche une prise, puis l’autre.',
      patch: [['Voie 1', 'Micro chant'], ['Sorties G / D', 'Façade gauche / droite']],
      cables: ['xlr', 'jack'],
      devices: [micro('mic', 'Micro chant', 0), desk('con', 1, { ins: 2, outs: ['L', 'R'], phantom: 2 }), speaker('fl', 'Façade gauche', 2), speaker('fr', 'Façade droite', 2)],
      links: [['mic.out', 'con.in1'], ['con.L', 'fl.in'], ['con.R', 'fr.in']],
      phantom: [],
      outro: 'C’est la base de tout : micro → console → enceintes. Une prise mâle, c’est une sortie ; une prise femelle, une entrée.'
    },
    {
      id: 'boitier', title: 'Le boîtier de scène', sub: 'Suivre la fiche de patch', who: 'marc',
      intro: 'Sur scène, on ne tire pas un câble par micro jusqu’à la régie : on branche dans le boîtier de scène, relié à la console par un seul gros câble, le multipaire. L’entrée 3 du boîtier arrive sur la voie 3 de la console.',
      patch: [['Voie 1', 'Micro chant'], ['Voie 2', 'Micro ampli guitare'], ['Voie 3', 'Micro statique (piano)'], ['Sorties G / D', 'Façade']],
      cables: ['xlr', 'jack'],
      devices: [micro('m1', 'Micro chant', 0), micro('m2', 'Micro ampli guitare', 0), micro('m3', 'Micro statique', 0, 'micS'), stagebox('sb', 6, 1),
        desk('con', 2, { outs: ['L', 'R'], phantom: 6 }), speaker('fl', 'Façade gauche', 3), speaker('fr', 'Façade droite', 3)],
      links: [['m1.out', 'sb.in1'], ['m2.out', 'sb.in2'], ['m3.out', 'sb.in3'], ['con.L', 'fl.in'], ['con.R', 'fr.in']],
      phantom: [[3, 'le micro statique']],
      outro: 'Tu as suivi la fiche de patch et pensé au 48 V : c’est exactement ce qu’on fait avant de toucher le moindre fader.'
    },
    {
      id: 'di', title: 'La DI : clavier et guitare', sub: 'Du jack vers l’XLR', who: 'marc',
      intro: 'Un clavier ou une guitare électro-acoustique sortent en jack, et le boîtier de scène n’a que des entrées XLR. On passe par une DI (boîte de direct) qui transforme le signal. Le clavier va dans la DI passive, la guitare dans la DI active, alimentée par le 48 V.',
      patch: [['Voie 1', 'Micro chant'], ['Voie 4', 'Clavier (DI passive)'], ['Voie 5', 'Guitare (DI active)'], ['Sorties G / D', 'Façade']],
      cables: ['xlr', 'jack'],
      devices: [micro('mic', 'Micro chant', 0), instrument('keys', 'Clavier', 0, 'keys'), instrument('gtr', 'Guitare électro', 0, 'guitar'),
        di('diP', 'DI passive', 1), di('diA', 'DI active', 1), stagebox('sb', 6, 2), desk('con', 3, { outs: ['L', 'R'], phantom: 6 }),
        speaker('fl', 'Façade gauche', 4), speaker('fr', 'Façade droite', 4)],
      links: [['mic.out', 'sb.in1'], ['keys.out', 'diP.in'], ['diP.out', 'sb.in4'], ['gtr.out', 'diA.in'], ['diA.out', 'sb.in5'], ['con.L', 'fl.in'], ['con.R', 'fr.in']],
      phantom: [[5, 'la DI active']],
      tips: { 'gtr.out': 'La guitare a un capteur piézo : elle a besoin de la DI active.', 'keys.out': 'Le clavier passe par la DI passive.' },
      outro: 'La DI, c’est le traducteur : jack d’un côté, XLR de l’autre. Et la DI active, comme un micro statique, a besoin du 48 V.'
    },
    {
      id: 'retours', title: 'Les retours', sub: 'Les sorties Aux', who: 'jerome',
      intro: 'Les musiciens ont besoin de s’entendre. Chaque retour reçoit son propre mélange, sur une sortie Aux de la console : Aux 1 pour la chanteuse, Aux 2 pour le guitariste. La façade, elle, reste sur les sorties G et D.',
      patch: [['Voie 1', 'Micro chant'], ['Sorties G / D', 'Façade'], ['Aux 1', 'Retour chanteuse'], ['Aux 2', 'Retour guitariste']],
      cables: ['xlr', 'jack'],
      devices: [micro('mic', 'Micro chant', 0), stagebox('sb', 4, 1), desk('con', 2, { outs: ['L', 'R', 'A1', 'A2'], phantom: 4 }),
        speaker('fl', 'Façade gauche', 3), speaker('fr', 'Façade droite', 3), speaker('w1', 'Retour chanteuse', 3, 'wedge'), speaker('w2', 'Retour guitariste', 3, 'wedge')],
      links: [['mic.out', 'sb.in1'], ['con.L', 'fl.in'], ['con.R', 'fr.in'], ['con.A1', 'w1.in'], ['con.A2', 'w2.in']],
      phantom: [],
      outro: 'La façade pour le public, les Aux pour les musiciens. Si tu inverses Aux 1 et Aux 2, chacun entend le mélange de l’autre.'
    },
    {
      id: 'ampli', title: 'Ampli et enceintes passives', sub: 'Le câble speakON', who: 'marc',
      intro: 'Ces enceintes-là sont passives : il n’y a pas d’ampli dedans. La console envoie le signal à l’ampli en XLR, puis l’ampli envoie la puissance aux enceintes en speakON. On ne branche jamais une enceinte passive directement sur la console.',
      patch: [['Voie 1', 'Micro chant'], ['Sortie G → Ampli A', 'Enceinte passive gauche'], ['Sortie D → Ampli B', 'Enceinte passive droite']],
      cables: ['xlr', 'jack', 'speakon'],
      devices: [micro('mic', 'Micro chant', 0), desk('con', 1, { ins: 2, outs: ['L', 'R'], phantom: 2 }), amp('amp', 2), passive('pl', 'Passive gauche', 3), passive('pr', 'Passive droite', 3)],
      links: [['mic.out', 'con.in1'], ['con.L', 'amp.inA'], ['con.R', 'amp.inB'], ['amp.outA', 'pl.in'], ['amp.outB', 'pr.in']],
      phantom: [],
      outro: 'Le signal faible voyage en XLR jusqu’à l’ampli, la puissance en speakON jusqu’aux enceintes. Le speakON se verrouille : il ne se débranche pas tout seul.'
    },
    {
      id: 'complet', title: 'L’installation complète', sub: 'De la scène aux enceintes', who: 'jerome',
      intro: 'Le grand jeu : quatre sources, deux DI, le boîtier de scène, la console, l’ampli, la façade passive et un retour. Suis la fiche de patch, et n’oublie pas le 48 V.',
      patch: [['Voie 1', 'Micro chant'], ['Voie 2', 'Micro statique'], ['Voie 3', 'Guitare (DI active)'], ['Voie 4', 'Clavier (DI passive)'], ['Sorties G / D', 'Ampli A / B → façade passive'], ['Aux 1', 'Retour']],
      cables: ['xlr', 'jack', 'speakon'],
      devices: [micro('mic', 'Micro chant', 0), micro('km', 'Micro statique', 0, 'micS'), instrument('gtr', 'Guitare électro', 0, 'guitar'), instrument('keys', 'Clavier', 0, 'keys'),
        di('diA', 'DI active', 1), di('diP', 'DI passive', 1), stagebox('sb', 8, 2), desk('con', 3, { outs: ['L', 'R', 'A1'], phantom: 8 }),
        amp('amp', 4), speaker('w1', 'Retour', 4, 'wedge'), passive('pl', 'Passive gauche', 5), passive('pr', 'Passive droite', 5)],
      links: [['mic.out', 'sb.in1'], ['km.out', 'sb.in2'], ['gtr.out', 'diA.in'], ['diA.out', 'sb.in3'], ['keys.out', 'diP.in'], ['diP.out', 'sb.in4'],
        ['con.L', 'amp.inA'], ['con.R', 'amp.inB'], ['amp.outA', 'pl.in'], ['amp.outB', 'pr.in'], ['con.A1', 'w1.in']],
      phantom: [[2, 'le micro statique'], [3, 'la DI active']],
      tips: { 'gtr.out': 'La guitare a un capteur piézo : elle a besoin de la DI active.', 'keys.out': 'Le clavier passe par la DI passive.' },
      outro: 'Installation complète, sans erreur de patch. En vrai, c’est exactement ça… avec des câbles qui pèsent un peu plus lourd.'
    }
  ];

  // ------------------------------------------------------------ Les règles (sans écran : testées sous Node)
  function findPort(lv, key) {
    const [d, p] = key.split('.');
    const dev = lv.devices.find(x => x.id === d);
    return dev ? { dev, port: dev.ports.find(x => x.id === p) } : { dev: null, port: null };
  }
  function nameOf(lv, key) {
    const { dev, port: p } = findPort(lv, key);
    return dev.ports.length === 1 ? dev.name : dev.name + ' · ' + p.label;
  }
  // un câble peut-il relier ces deux prises ? → null si oui, sinon l’explication
  function canLink(lv, cableId, k1, k2) {
    const cab = CABLES[cableId];
    const a = findPort(lv, k1), b = findPort(lv, k2);
    if (a.dev.id === b.dev.id) return 'Relie deux appareils différents.';
    for (const x of [a, b]) {
      if (cab.fits.includes(x.port.conn)) continue;
      return misfit(cableId, x.dev, x.port);
    }
    if (cableId === 'xlr' && a.port.conn === b.port.conn) {
      return a.port.conn === 'xf'
        ? 'Deux prises femelles, ce sont deux entrées. Le son part d’une sortie (prise mâle) et arrive dans une entrée (prise femelle).'
        : 'Deux prises mâles, ce sont deux sorties. Relie une sortie à une entrée.';
    }
    return null;
  }
  function misfit(cableId, dev, p) {
    const role = ROLE[dev.kind];
    if (cableId === 'jack' && CONN[p.conn].fam === 'xlr' && (dev.kind === 'stagebox' || dev.kind === 'console')) return 'Les entrées du ' + (dev.kind === 'console' ? 'la console' : 'boîtier') + ' sont en XLR. Un clavier ou une guitare passent d’abord par une DI.';
    if (cableId === 'speakon' && CONN[p.conn].fam === 'xlr' && role === 'spk') return 'Une enceinte active se branche en XLR : elle a son propre ampli. Le speakON, c’est pour les enceintes passives.';
    if (cableId === 'xlr' && p.conn === 'sp') return 'Prise speakON : une enceinte passive (ou la sortie de l’ampli) reçoit de la puissance, pas un signal XLR. Prends un câble speakON.';
    if (cableId === 'xlr' && p.conn === 'jk') return 'C’est une prise jack : prends un câble jack.';
    if (cableId === 'jack' && p.conn === 'xm' && role === 'src') return 'Un micro sort en XLR : prends un câble XLR.';
    if (cableId === 'jack' && p.conn === 'xm' && dev.kind === 'di') return 'La sortie de la DI est en XLR : c’est tout son intérêt. Prends un câble XLR.';
    return 'Un câble ' + CABLES[cableId].name + ' ne rentre pas dans une prise ' + CONN[p.conn].name + '.';
  }
  const same = (l, a, b) => (l[0] === a && l[1] === b) || (l[0] === b && l[1] === a);
  // le test son : liste des problèmes { who, text, keys }
  function check(lv, links, phantom, tries) {
    const issues = [];
    const used = new Set();
    links.forEach(l => { used.add(l[0]); used.add(l[1]); });
    for (const l of links) {
      if (lv.links.some(e => same(e, l[0], l[1]))) continue;
      const a = findPort(lv, l[0]).port, b = findPort(lv, l[1]).port;
      if (a.dir === b.dir) {
        issues.push({ who: 'jerome', keys: l, text: nameOf(lv, l[0]) + ' et ' + nameOf(lv, l[1]) + ' sont deux ' + (a.dir === 'in' ? 'entrées' : 'sorties') + ' : le son va toujours d’une sortie vers une entrée.' });
        continue;
      }
      const out = a.dir === 'out' ? l[0] : l[1], inp = a.dir === 'out' ? l[1] : l[0];
      const eOut = lv.links.find(e => e.includes(out)), eIn = lv.links.find(e => e.includes(inp));
      const tip = lv.tips && lv.tips[out] ? ' ' + lv.tips[out] : '';
      if (eOut) issues.push({ who: 'marc', keys: l, text: nameOf(lv, out) + ' n’est pas au bon endroit : d’après la fiche de patch, il va sur ' + nameOf(lv, eOut[0] === out ? eOut[1] : eOut[0]) + '.' + tip });
      else if (eIn) issues.push({ who: 'marc', keys: l, text: nameOf(lv, inp) + ' doit recevoir ' + nameOf(lv, eIn[0] === inp ? eIn[1] : eIn[0]) + ', pas ' + nameOf(lv, out) + '.' });
      else issues.push({ who: 'jerome', keys: l, text: 'Ce câble ne sert à rien ici : ' + nameOf(lv, out) + ' → ' + nameOf(lv, inp) + '.' });
    }
    for (const e of lv.links) {
      if (links.some(l => same(l, e[0], e[1])) || used.has(e[0]) || used.has(e[1])) continue;
      const out = findPort(lv, e[0]).port.dir === 'out' ? e[0] : e[1], inp = out === e[0] ? e[1] : e[0];
      issues.push({ who: 'jerome', keys: [out, inp], text: tries > 0 ? nameOf(lv, inp) + ' ne reçoit rien : il faut y brancher ' + nameOf(lv, out) + '.' : nameOf(lv, inp) + ' ne reçoit rien.' });
    }
    for (const [v, what] of lv.phantom) {
      if (phantom.has(v)) continue;
      issues.push({ who: 'marc', keys: [], ph: v, text: 'Voie ' + v + ' : ' + what + ' est bien branché, mais rien ne sort. Il lui faut le 48 V : allume le bouton 48V de la voie ' + v + ' sur la console.' });
    }
    return issues;
  }

  // ------------------------------------------------------------ L’écran
  const SVGNS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, parent) {
    const el = document.createElementNS(SVGNS, tag);
    for (const k in attrs || {}) if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }
  function wrap(text, max) {
    const words = text.split(' '); const lines = [''];
    for (const w of words) {
      const cur = lines[lines.length - 1];
      if ((cur + ' ' + w).trim().length > max && cur) lines.push(w); else lines[lines.length - 1] = (cur + ' ' + w).trim();
    }
    return lines.slice(0, 2);
  }

  // positions des appareils et des prises : en colonnes (écran large) ou en rangées (téléphone)
  function layout(lv, narrow) {
    const cols = Math.max(...lv.devices.map(d => d.col)) + 1;
    const boxes = lv.devices.map(d => ({ d, ins: d.ports.filter(p => p.dir === 'in'), outs: d.ports.filter(p => p.dir === 'out') }));
    const P = {}; let W, H;
    const phRows = (b) => b.d.phantom ? Math.ceil(b.d.phantom / Math.max(1, Math.floor((b.w - 16) / 27))) : 0;
    if (!narrow) {
      W = 1000; const colW = W / cols, PH = 30, HEAD = 42; const colH = [];
      for (let c = 0; c < cols; c++) {
        let y = 0;
        boxes.filter(b => b.d.col === c).forEach(b => {
          b.w = Math.min(colW - 54, 176);
          b.h = HEAD + Math.max(b.ins.length, b.outs.length, 1) * PH + (b.d.phantom ? 22 + phRows(b) * 26 : 0) + 8;
          b.y = y; y += b.h + 24;
        });
        colH[c] = y - 24;
      }
      H = Math.max(...colH) + 60;
      boxes.forEach(b => {
        b.x = b.d.col * colW + (colW - b.w) / 2; b.y += (H - colH[b.d.col]) / 2;
        b.ins.forEach((p, i) => { P[b.d.id + '.' + p.id] = { x: b.x, y: b.y + HEAD + i * PH + PH / 2, nx: -1, ny: 0, p, b }; });
        b.outs.forEach((p, i) => { P[b.d.id + '.' + p.id] = { x: b.x + b.w, y: b.y + HEAD + i * PH + PH / 2, nx: 1, ny: 0, p, b }; });
        b.phY = b.y + HEAD + Math.max(b.ins.length, b.outs.length, 1) * PH + 4;
      });
    } else {
      W = 400; let y = 28;
      for (let c = 0; c < cols; c++) {
        const row = boxes.filter(b => b.d.col === c); const n = row.length;
        const w = Math.min((W - 16 - (n - 1) * 12) / n, 300);
        let rowH = 0;
        row.forEach((b, i) => {
          b.w = w; b.x = (W - (n * w + (n - 1) * 12)) / 2 + i * (w + 12); b.y = y;
          b.h = (b.ins.length ? 26 : 12) + 34 + (b.d.phantom ? 22 + phRows(b) * 26 : 0) + (b.outs.length ? 26 : 12);
          rowH = Math.max(rowH, b.h);
        });
        row.forEach(b => {
          b.ins.forEach((p, i) => { P[b.d.id + '.' + p.id] = { x: b.x + (i + 0.5) * b.w / b.ins.length, y: b.y, nx: 0, ny: -1, p, b }; });
          b.outs.forEach((p, i) => { P[b.d.id + '.' + p.id] = { x: b.x + (i + 0.5) * b.w / b.outs.length, y: b.y + b.h, nx: 0, ny: 1, p, b }; });
          b.phY = b.y + (b.ins.length ? 26 : 12) + 34;
        });
        y += rowH + 62;
      }
      H = y - 34;
    }
    return { W, H, boxes, P, narrow };
  }
  function cablePath(P, a, b) {
    const A = P[a], B = P[b];
    const d = Math.max(46, Math.hypot(B.x - A.x, B.y - A.y) * 0.42);
    return 'M' + A.x + ' ' + A.y + ' C' + (A.x + A.nx * d) + ' ' + (A.y + A.ny * d) + ' ' + (B.x + B.nx * d) + ' ' + (B.y + B.ny * d) + ' ' + B.x + ' ' + B.y;
  }

  const Cablage = {
    LEVELS, CABLES, CONN, canLink, check,
    init(game) {
      this.game = game;
      root.addEventListener('resize', () => {
        if (this.game.view !== 'cablage' || !this.S) return;
        clearTimeout(this._rz); this._rz = setTimeout(() => this.drawBoard(), 150);
      });
    },
    U() { return root.SonoUI; },
    progress() { return this.U().store.get('cablage', {}); },
    show() { if (this.S) this.renderLevel(); else this.renderHub(); },
    leave() { cancelAnimationFrame(this._raf); },
    el() { return document.getElementById('view-cablage'); },
    toast(msg, kind, who) { const U = this.U(); U.toast(document.getElementById('cb-toasts'), msg, kind || 'warn', 4200, who ? root.SonoData.PEOPLE[who] : null); },

    // ---- la liste des installations
    renderHub() {
      this.S = null;
      const U = this.U(), h = U.h, prog = this.progress();
      const nextIdx = LEVELS.findIndex(l => !prog[l.id]);
      const el = this.el(); el.innerHTML = '';
      el.append(
        h('div', { class: 'cb-head' }, h('h1', null, 'Câblage'),
          h('p', null, 'Choisis un câble, touche une prise, puis l’autre. Suis la fiche de patch, puis lance le test son.')),
        h('div', { class: 'cb-legend' }, Object.keys(CABLES).map(k => h('span', { class: 'cb-chip', style: '--c:' + CABLES[k].color }, h('i'), h('b', null, CABLES[k].name), ' ' + CABLES[k].use))),
        h('div', { class: 'cb-list' }, LEVELS.map((L, i) => h('button', { class: 'cb-item' + (prog[L.id] ? ' done' : '') + (i === nextIdx ? ' next' : ''), onclick: () => this.start(i) },
          h('span', { class: 'cb-num' }, String(i + 1)),
          h('span', { class: 'cb-item-main' }, h('b', null, L.title), h('span', null, L.sub)),
          h('span', { class: 'cb-stars', 'aria-label': (prog[L.id] || 0) + ' étoiles sur 3' }, [1, 2, 3].map(n => h('i', { class: n <= (prog[L.id] || 0) ? 'on' : '' }, '★')))))),
        h('div', { id: 'cb-toasts', class: 'pc-toasts', 'aria-live': 'polite' }));
    },

    // ---- une installation
    start(i) {
      this.S = { i, lv: LEVELS[i], links: [], phantom: new Set(), tries: 0, armed: null, pending: null, issues: null, done: false };
      this.renderLevel();
      try { root.scrollTo(0, 0); } catch (e) { /* ignore */ }
    },
    renderLevel() {
      const U = this.U(), h = U.h, S = this.S, L = S.lv, D = root.SonoData;
      const el = this.el(); el.innerHTML = '';
      el.append(
        h('div', { class: 'cb-top' },
          h('button', { class: 'pc-close', 'aria-label': 'Retour aux installations', onclick: () => this.renderHub() }, '‹'),
          h('div', { class: 'cb-title' }, h('span', null, 'Installation ' + (S.i + 1) + ' / ' + LEVELS.length), h('b', null, L.title))),
        h('div', { class: 'cb-intro' },
          h('div', { class: 'said-line' }, U.avatar(D.PEOPLE[L.who]), h('div', { class: 'said-body' }, h('b', { class: 'said-who', style: '--c:' + D.PEOPLE[L.who].color }, D.PEOPLE[L.who].name), h('span', null, L.intro))),
          h('div', { class: 'cb-patch' }, h('h4', null, 'Fiche de patch'), h('table', null, L.patch.map(r => h('tr', null, h('th', null, r[0]), h('td', null, r[1])))))),
        h('div', { class: 'cb-board', id: 'cb-board' }),
        h('div', { class: 'cb-tray' },
          h('div', { class: 'cb-cables' }, L.cables.map(k => h('button', { class: 'cb-cable' + (S.armed === k ? ' on' : ''), style: '--c:' + CABLES[k].color, 'aria-pressed': String(S.armed === k), onclick: () => this.arm(k) },
            h('i'), h('span', null, h('b', null, CABLES[k].name), h('small', null, CABLES[k].use))))),
          h('p', { class: 'cb-hint', id: 'cb-hint' }),
          h('div', { class: 'cb-actions' },
            h('button', { class: 'ghost', onclick: () => this.start(S.i) }, 'Tout débrancher'),
            h('button', { class: 'primary', onclick: () => this.test() }, 'Tester le son'))),
        h('div', { class: 'cb-result', id: 'cb-result', hidden: true }),
        h('div', { id: 'cb-toasts', class: 'pc-toasts', 'aria-live': 'polite' }));
      this.drawBoard();
      this.paintHint();
    },
    paintHint() {
      const S = this.S, el = document.getElementById('cb-hint');
      if (!el) return;
      el.textContent = !S.armed ? 'Choisis un câble.'
        : S.pending ? 'Touche maintenant l’autre prise (ou la même pour annuler).'
          : 'Câble ' + CABLES[S.armed].name + ' en main : touche une prise. Touche un câble branché pour le retirer.';
      document.querySelectorAll('.cb-cable').forEach(b => { const on = b.textContent.startsWith(CABLES[S.armed] ? CABLES[S.armed].name : '#'); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    },
    arm(k) {
      this.S.armed = this.S.armed === k ? null : k;
      this.S.pending = null;
      this.drawBoard(); this.paintHint();
    },
    used(key) { return this.S.links.find(l => l[0] === key || l[1] === key); },
    // ce que l’aide fait briller : les prises où le câble en main peut aller
    canGo(key) {
      const S = this.S;
      if (!S.armed || this.used(key)) return false;
      const { port: p } = findPort(S.lv, key);
      if (!CABLES[S.armed].fits.includes(p.conn)) return false;
      if (S.pending) return key !== S.pending && !canLink(S.lv, S.armed, S.pending, key);
      return true;
    },
    tapPort(key) {
      const S = this.S;
      if (S.done) return;
      const A = root.SonoAudio;
      const busy = this.used(key);
      if (busy && !S.pending) { this.toast('Cette prise est déjà occupée : touche le câble pour le débrancher.', 'info'); return; }
      if (!S.armed) { this.toast('Choisis d’abord un câble, en bas.', 'info'); return; }
      const { dev, port: p } = findPort(S.lv, key);
      if (!S.pending) {
        if (!CABLES[S.armed].fits.includes(p.conn)) { this.toast(misfit(S.armed, dev, p), 'warn', 'marc'); return; }
        S.pending = key;
      } else if (S.pending === key) {
        S.pending = null;
      } else {
        if (busy) { this.toast('Cette prise est déjà occupée : touche le câble pour le débrancher.', 'info'); return; }
        const why = canLink(S.lv, S.armed, S.pending, key);
        if (why) { this.toast(why, 'warn', 'marc'); return; }
        const a = findPort(S.lv, S.pending).port.dir === 'out' ? S.pending : key;
        S.links.push([a, a === key ? S.pending : key, S.armed]);
        S.pending = null; S.issues = null;
        if (A && A.ctx && A.enabled) A.tone(1400, 0.06, { amp: 0.12 });
      }
      this.drawBoard(); this.paintHint();
    },
    unplug(i) {
      if (this.S.done) return;
      this.S.links.splice(i, 1); this.S.issues = null;
      this.drawBoard(); this.paintHint();
    },
    togglePhantom(v) {
      if (this.S.done) return;
      const ph = this.S.phantom;
      if (ph.has(v)) ph.delete(v); else ph.add(v);
      this.S.issues = null;
      this.drawBoard();
    },

    drawBoard() {
      const S = this.S, host = document.getElementById('cb-board');
      if (!S || !host) return;
      const help = !this.game || this.game.ui.help !== false;
      const narrow = (host.clientWidth || 800) < 640;
      const G = layout(S.lv, narrow);
      this.G = G;
      host.innerHTML = '';
      const svg = s('svg', { viewBox: '0 0 ' + G.W + ' ' + G.H, class: 'cb-svg' + (narrow ? ' narrow' : ''), role: 'application', 'aria-label': 'Plan de branchement' }, host);
      const bad = new Set(), badPh = new Set();
      (S.issues || []).forEach(it => { it.keys.forEach(k => bad.add(k)); if (it.ph) badPh.add(it.ph); });
      // appareils
      for (const b of G.boxes) {
        const role = ROLE[b.d.kind];
        const g = s('g', { class: 'cb-dev ' + role + (S.done && role === 'spk' ? ' live' : '') }, svg);
        s('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 10, class: 'cb-box' }, g);
        s('rect', { x: b.x, y: b.y, width: b.w, height: 5, rx: 2, fill: ROLE_COLOR[role] }, g);
        const lines = wrap(b.d.name, Math.max(8, Math.floor(b.w / 8)));
        const ty = narrow ? b.y + (b.ins.length ? 26 : 12) + 17 - (lines.length - 1) * 7 : b.y + 22 - (lines.length - 1) * 7;
        lines.forEach((ln, i) => { const t = s('text', { x: b.x + b.w / 2, y: ty + i * 15, class: 'cb-name' }, g); t.textContent = ln; });
        if (role === 'spk' && S.done) { const n = s('text', { x: b.x + b.w - 14, y: b.y + 20, class: 'cb-note' }, g); n.textContent = '♪'; }
        // libellés des prises
        for (const p of b.d.ports) {
          if (b.d.ports.length === 1) continue;
          const pp = G.P[b.d.id + '.' + p.id];
          const lab = narrow || b.w < 150 ? p.short : p.label;
          const t = s('text', { class: 'cb-plab', x: narrow ? pp.x : pp.x + (p.dir === 'in' ? 20 : -20), y: narrow ? pp.y + (p.dir === 'in' ? 20 : -12) : pp.y + 4, 'text-anchor': narrow ? 'middle' : (p.dir === 'in' ? 'start' : 'end') }, g);
          t.textContent = lab;
        }
        // boutons 48 V
        if (b.d.phantom) {
          const per = Math.max(1, Math.floor((b.w - 16) / 27));
          const t = s('text', { x: b.x + 10, y: b.phY + 12, class: 'cb-phlab' }, g); t.textContent = '48 V par voie';
          for (let v = 1; v <= b.d.phantom; v++) {
            const r = Math.floor((v - 1) / per), c = (v - 1) % per;
            const bx = b.x + 8 + c * 27, by = b.phY + 20 + r * 26;
            const on = S.phantom.has(v);
            const bg = s('g', { class: 'cb-ph' + (on ? ' on' : '') + (badPh.has(v) ? ' bad' : ''), 'data-ph': v, role: 'button', tabindex: 0, 'aria-pressed': String(on), 'aria-label': '48 V voie ' + v }, g);
            s('rect', { x: bx, y: by, width: 23, height: 21, rx: 4 }, bg);
            const tt = s('text', { x: bx + 11.5, y: by + 15 }, bg); tt.textContent = v;
          }
        }
      }
      // câbles
      S.links.forEach((l, i) => {
        const d = cablePath(G.P, l[0], l[1]);
        const isBad = (S.issues || []).some(it => it.keys.length === 2 && same(it.keys, l[0], l[1]));
        const g = s('g', { class: 'cb-link' + (isBad ? ' bad' : ''), 'data-link': i, role: 'button', 'aria-label': 'Débrancher ' + nameOf(S.lv, l[0]) + ' → ' + nameOf(S.lv, l[1]) }, svg);
        s('path', { d, class: 'cb-wire-shadow' }, g);
        s('path', { d, class: 'cb-wire', stroke: CABLES[l[2]].color, id: 'cbw-' + i }, g);
        s('path', { d, class: 'cb-wire-hit' }, g);
      });
      if (S.pending) s('path', { id: 'cb-rubber', class: 'cb-rubber', d: '', stroke: CABLES[S.armed].color }, svg);
      // prises
      for (const key in G.P) {
        const pp = G.P[key], p = pp.p, fam = CONN[p.conn].fam;
        const cls = ['cb-port', p.conn];
        if (this.used(key)) cls.push('used');
        if (S.pending === key) cls.push('sel');
        if (help && this.canGo(key)) cls.push('fit');
        if (bad.has(key)) cls.push('bad');
        const g = s('g', { class: cls.join(' '), 'data-port': key, role: 'button', tabindex: 0, 'aria-label': nameOf(S.lv, key) + ' (' + CONN[p.conn].name + ')' }, svg);
        s('circle', { cx: pp.x, cy: pp.y, r: 21, class: 'cb-hit' }, g);
        if (p.conn === 'sp') s('rect', { x: pp.x - 10, y: pp.y - 10, width: 20, height: 20, rx: 6, class: 'cb-face', stroke: CABLES[fam].color }, g);
        else s('circle', { cx: pp.x, cy: pp.y, r: 10.5, class: 'cb-face', stroke: CABLES[fam].color }, g);
        if (p.conn === 'xf' || p.conn === 'xm') {
          [[-4, -2.5], [4, -2.5], [0, 4]].forEach(([dx, dy]) => s('circle', { cx: pp.x + dx, cy: pp.y + dy, r: 1.9, class: p.conn === 'xm' ? 'cb-pin' : 'cb-hole' }, g));
        } else if (p.conn === 'jk') s('circle', { cx: pp.x, cy: pp.y, r: 3.2, class: 'cb-hole' }, g);
        else s('rect', { x: pp.x - 5, y: pp.y - 1.5, width: 10, height: 3, rx: 1.5, class: 'cb-hole' }, g);
      }
      // interactions
      svg.addEventListener('click', (e) => {
        const ph = e.target.closest('[data-ph]'); if (ph) { this.togglePhantom(+ph.dataset.ph); return; }
        const pt = e.target.closest('[data-port]'); if (pt) { this.tapPort(pt.dataset.port); return; }
        const ln = e.target.closest('[data-link]'); if (ln) { this.unplug(+ln.dataset.link); return; }
        if (S.pending) { S.pending = null; this.drawBoard(); this.paintHint(); }
      });
      svg.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const t = e.target.closest('[data-port],[data-ph]'); if (!t) return;
        e.preventDefault(); t.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      if (S.pending) {
        const A = G.P[S.pending];
        svg.addEventListener('pointermove', (e) => {
          const r = document.getElementById('cb-rubber'); if (!r) return;
          const m = svg.getScreenCTM(); if (!m) return;
          const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
          const d = Math.max(30, Math.hypot(q.x - A.x, q.y - A.y) * 0.4);
          r.setAttribute('d', 'M' + A.x + ' ' + A.y + ' C' + (A.x + A.nx * d) + ' ' + (A.y + A.ny * d) + ' ' + q.x + ' ' + q.y + ' ' + q.x + ' ' + q.y);
        });
      }
    },

    // ---- le test son
    test() {
      const S = this.S, U = this.U(), h = U.h, D = root.SonoData, A = root.SonoAudio;
      if (S.done) return;
      S.pending = null;
      const issues = check(S.lv, S.links.map(l => [l[0], l[1]]), S.phantom, S.tries);
      S.tries++;
      S.issues = issues;
      const box = document.getElementById('cb-result');
      box.hidden = false; box.innerHTML = '';
      if (!issues.length) {
        S.done = true;
        const stars = S.tries === 1 ? 3 : S.tries === 2 ? 2 : 1;
        const prog = this.progress(); const had = prog[S.lv.id] || 0;
        if (stars > had) { prog[S.lv.id] = stars; U.store.set('cablage', prog); }
        if (root.SonoProfil) {
          if (stars > had) root.SonoProfil.add((stars - had) * 25 + (had ? 0 : 20), 'câblage « ' + S.lv.title + ' »');
          if (LEVELS.every(l => this.progress()[l.id])) root.SonoProfil.award('cablage');
        }
        if (A && A.ctx && A.enabled) A.applause(2.2);
        U.confetti();
        const nxt = S.i + 1 < LEVELS.length ? S.i + 1 : null;
        box.className = 'cb-result ok';
        box.append(
          h('div', { class: 'cb-stars big' }, [1, 2, 3].map(n => h('i', { class: n <= stars ? 'on' : '' }, '★'))),
          h('h3', null, S.tries === 1 ? 'Ça sonne du premier coup !' : 'Ça sonne !'),
          h('div', { class: 'said-line' }, U.avatar(D.PEOPLE[S.lv.who]), h('div', { class: 'said-body' }, h('b', { class: 'said-who', style: '--c:' + D.PEOPLE[S.lv.who].color }, D.PEOPLE[S.lv.who].name), h('span', null, S.lv.outro))),
          h('div', { class: 'cb-actions' },
            h('button', { class: 'ghost', onclick: () => this.renderHub() }, 'Les installations'),
            nxt != null ? h('button', { class: 'primary', onclick: () => this.start(nxt) }, 'Installation suivante') : h('button', { class: 'primary', onclick: () => this.game.switchView('concert') }, 'Passer au concert')));
      } else {
        if (A && A.ctx && A.enabled) A.tone(55, 0.5, { amp: 0.18 });
        box.className = 'cb-result ko';
        const shown = issues.slice(0, 4);
        box.append(...[
          h('h3', null, issues.length === 1 ? 'Presque : un problème' : issues.length + ' problèmes'),
          h('ul', { class: 'said-list' }, shown.map(it => h('li', null, U.avatar(D.PEOPLE[it.who]), h('span', null, it.text)))),
          issues.length > shown.length ? h('p', { class: 'muted' }, 'Et ' + (issues.length - shown.length) + ' autre(s) : corrige déjà ceux-là.') : null,
          h('p', { class: 'muted' }, 'Ce qui cloche est en rouge sur le plan. Touche un câble pour le débrancher.')].filter(Boolean));
      }
      this.drawBoard();
      this.pulse(!issues.length);
      box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },
    // le signal qui voyage dans les câbles
    pulse(allGood) {
      cancelAnimationFrame(this._raf);
      const svg = document.querySelector('.cb-svg'); if (!svg) return;
      const bad = new Set((this.S.issues || []).filter(it => it.keys.length === 2).map(it => it.keys.join('|')));
      const dots = this.S.links.map((l, i) => {
        const path = document.getElementById('cbw-' + i); if (!path) return null;
        const isBad = bad.has(l[0] + '|' + l[1]) || bad.has(l[1] + '|' + l[0]);
        return { path, len: path.getTotalLength(), c: s('circle', { r: 6, class: 'cb-dot' + (isBad ? ' bad' : allGood ? ' good' : '') }, svg) };
      }).filter(Boolean);
      const t0 = performance.now(), DUR = 1300, REP = allGood ? 3 : 2;
      const step = (now) => {
        const k = (now - t0) / DUR;
        if (k >= REP) { dots.forEach(d => d.c.remove()); return; }
        const f = k % 1;
        dots.forEach(d => { const p = d.path.getPointAtLength(f * d.len); d.c.setAttribute('cx', p.x); d.c.setAttribute('cy', p.y); d.c.setAttribute('opacity', String(Math.min(1, 4 * Math.min(f, 1 - f) + 0.2))); });
        this._raf = requestAnimationFrame(step);
      };
      this._raf = requestAnimationFrame(step);
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = { LEVELS, CABLES, CONN, canLink, check };
  else root.SonoCablage = Cablage;
})(this);
