/* Sono Sim — le coach : apprendre directement dans l’atelier et le concert.
 * - Projecteur : met en lumière un bouton ou un objet de la scène, avec une bulle de Jérôme ou Marc.
 * - Visite guidée de l’écran.
 * - Mode « Explique-moi » : on touche n’importe quoi, on apprend à quoi ça sert.
 * - Missions de l’atelier : une étape à la fois, validée automatiquement.
 * - Liste « Avant de lever le rideau » dans le concert, cochée en direct. */
(function (root) {
  'use strict';
  const D = root.SonoData;
  const E = root.SonoEngine;
  const S = root.SonoState;
  const U = root.SonoUI;
  const h = U.h;
  const $ = (id) => document.getElementById(id);

  // ------------------------------------------------------------ Le projecteur
  const Spot = {
    el: null, hole: null, bubble: null, target: null, raf: 0,
    show(target, who, text, opts) {
      opts = opts || {};
      this.hide();
      this.target = target;
      const p = D.PEOPLE[who || 'marc'];
      this.el = h('div', { class: 'spot', role: 'dialog', 'aria-live': 'polite' });
      this.hole = h('div', { class: 'spot-hole' + (opts.noDim ? ' nodim' : '') });
      const actions = h('div', { class: 'spot-actions' });
      if (opts.prev) actions.appendChild(h('button', { class: 'btn-text', onclick: opts.prev }, 'Précédent'));
      if (opts.skip) actions.appendChild(h('button', { class: 'btn-text', onclick: opts.skip }, opts.skipLabel || 'Quitter'));
      if (opts.next) actions.appendChild(h('button', { class: 'primary', onclick: opts.next }, opts.nextLabel || 'Suivant'));
      this.bubble = h('div', { class: 'spot-bubble' },
        h('div', { class: 'spot-head' }, U.avatar(p, 'lg'), h('div', null, h('b', { class: 'said-who', style: '--c:' + p.color }, p.name), opts.step ? h('span', { class: 'spot-step' }, opts.step) : null)),
        h('p', null, text), actions.children.length ? actions : null);
      this.el.append(this.hole, this.bubble);
      document.body.appendChild(this.el);
      const r0 = this.rect();
      if (r0 && opts.scroll !== false) {
        const el = typeof target === 'function' ? null : target;
        if (el && el.scrollIntoView && (r0.top < 60 || r0.bottom > root.innerHeight - 80)) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      const loop = () => { this.place(); this.raf = requestAnimationFrame(loop); };
      loop();
      const btn = this.bubble.querySelector('.primary');
      if (btn) btn.focus({ preventScroll: true });
    },
    rect() {
      const t = this.target;
      if (!t) return null;
      if (typeof t === 'function') return t();
      if (!document.body.contains(t)) return null;
      const r = t.getBoundingClientRect();
      if (!r.width && !r.height) return null;
      return r;
    },
    place() {
      if (!this.el) return;
      const r = this.rect();
      const pad = 6;
      const vw = root.innerWidth, vh = root.innerHeight;
      if (r) {
        this.hole.hidden = false;
        Object.assign(this.hole.style, { left: (r.left - pad) + 'px', top: (r.top - pad) + 'px', width: (r.width + pad * 2) + 'px', height: (r.height + pad * 2) + 'px' });
      } else this.hole.hidden = true;
      const bw = Math.min(360, vw - 24);
      const bh = this.bubble.offsetHeight || 140;
      let x, y;
      if (!r) { x = (vw - bw) / 2; y = vh * 0.3; }
      else {
        x = Math.max(12, Math.min(vw - bw - 12, r.left + r.width / 2 - bw / 2));
        y = r.bottom + 14;
        if (y + bh > vh - 80) y = r.top - bh - 14;
        if (y < 10) { y = Math.min(vh - bh - 80, r.bottom + 14); if (y < 10) y = 10; }
      }
      Object.assign(this.bubble.style, { left: x + 'px', top: y + 'px', width: bw + 'px' });
    },
    hide() {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
      if (this.el) this.el.remove();
      this.el = null; this.target = null;
    }
  };

  // un objet de la vue salle (musicien, micro, retour…) → rectangle à l’écran
  function salleRect(kind, id) {
    return () => {
      const Sa = root.SonoSalle;
      const cv = $('salle');
      if (!Sa || !cv || cv.hidden) return null;
      const hit = Sa.hits.find(x => x.kind === kind && (id == null || x.id === id));
      if (!hit) return null;
      const r = cv.getBoundingClientRect();
      return { left: r.left + hit.x0, top: r.top + hit.y0, right: r.left + hit.x1, bottom: r.top + hit.y1, width: hit.x1 - hit.x0, height: hit.y1 - hit.y0 };
    };
  }
  const q = (sel) => document.querySelector(sel);
  const strip = (ch, part) => q('.strip[data-ch="' + ch + '"] ' + (part || ''));

  // ------------------------------------------------------------ Explications de chaque élément
  const EXPLAIN = [
    ['.btn-48', 'jerome', 'Le 48 V (alimentation fantôme) envoie du courant dans le câble du micro. Indispensable pour les micros statiques et les DI actives, inutile pour un SM58. On le met fader baissé.'],
    ['.knob', 'marc', (el) => {
      const l = (el.querySelector('.knob-label') || {}).textContent || '';
      if (l === 'GAIN') return 'Le GAIN règle la force du signal qui entre dans la console. On le règle quand le musicien joue fort : les LED montent dans le jaune, jamais dans le rouge.';
      if (l.indexOf('RET') === 0) return 'Ce bouton envoie cette voie dans un retour (l’enceinte au sol d’un musicien). Plus tu montes, plus il s’entend… et plus le larsen approche.';
      if (l === 'COUPE-BAS') return 'La fréquence du coupe-bas : tout ce qui est plus grave est enlevé. 80-120 Hz pour une voix, rien pour une basse.';
      if (l === 'GRAVES' || l === 'MÉDIUM' || l === 'AIGUS' || l === 'FRÉQ.') return 'L’égaliseur : il monte ou baisse une zone du son. Graves = rondeur, médium = présence, aigus = brillance. On creuse plus souvent qu’on ne monte.';
      return 'Un bouton rotatif : glisse vers le haut ou le bas pour le tourner. Double-clic pour le remettre au milieu.';
    }],
    ['.btn-hpf', 'marc', 'HPF = coupe-bas. Il enlève le grave inutile (bruits de pied, de manipulation, larsen grave). Sur presque tout, sauf la basse et la grosse caisse.'],
    ['.btn-mute', 'jerome', 'MUTE coupe la voie d’un coup. Ton meilleur réflexe contre un larsen, et pour les micros des musiciens qui ne jouent pas.'],
    ['.btn-sel', 'marc', 'SEL ouvre les réglages détaillés de la voie (égaliseur, envois vers les retours) dans l’onglet Tranche.'],
    ['.btn-geq', 'jerome', 'L’égaliseur graphique de la sortie (façade ou retour). On y creuse la fréquence qui siffle en premier.'],
    ['.meter', 'marc', 'Le vu-mètre : le niveau qui entre dans la voie. Vert c’est bien, jaune c’est fort, rouge c’est saturé (on baisse le gain).'],
    ['.fader', 'marc', (el) => el.closest('.master') ? 'Le fader master : le volume général de la sortie choisie (façade ou retour).' : 'Le fader : le niveau de cette voie dans la sortie choisie en haut (façade ou retour). Le 0 est la position « neutre ».'],
    ['.scribble', 'marc', 'Le bout de gaffer : on écrit au marqueur qui est sur chaque voie. Indispensable pour ne pas chercher le jour J.'],
    ['.layer-btn', 'jerome', 'Choisis ce que règlent les faders : la FAÇADE (le public) ou un RETOUR (ce qu’entend un musicien sur scène).'],
    ['.bank-btn', 'marc', 'La console a 48 voies mais 16 faders : comme sur une console numérique, on passe d’une banque de 16 à l’autre.'],
    ['#spl', 'jerome', 'Le sonomètre : le niveau sonore au fond de la salle. Pour un petit concert, vise 80-90 dB. Jamais plus de 102.'],
    ['#mood', 'marc', 'La réaction du public : il adore, il n’entend pas, c’est trop fort, ou il se bouche les oreilles au larsen.'],
    ['#larsen-led', 'jerome', 'Ce témoin s’allume quand il y a du larsen. Si ça arrive : baisse ou coupe la voie tout de suite.'],
    ['#cue-bar', 'marc', 'Le conducteur : qui joue, et quand. Le trait rouge avance pendant le spectacle. Anticipe les entrées pour ouvrir les bonnes voies.'],
    ['#btn-phase', 'jerome', 'Quand tout est prêt, lève le rideau : le public entre et le spectacle commence. Les musiciens jouent selon le conducteur.'],
    ['.view-toggle', 'marc', 'Vue salle : la scène comme depuis la régie. Plan : la vue de dessus, plus technique, pour placer précisément.'],
    ['.case-item', 'marc', (el) => { const t = el.dataset.type; const d = t && D.MICS[t]; return d ? d.name + ' (' + d.model + ') : ' + d.desc : 'Un retour de scène : une enceinte au sol, face au musicien, pour qu’il s’entende.'; }],
    ['.side-tabs [data-tab]', 'marc', (el) => ({ scene: 'Scène : les musiciens, le conducteur et la liste des choses à faire.', valise: 'Valise : le matériel disponible. Choisis un micro, puis touche le musicien.', patch: 'Patch : quel micro est branché sur quelle prise du boîtier, donc sur quelle voie.', tranche: 'Tranche : tous les réglages d’une voie (égaliseur, envois aux retours).', analyse: 'Analyse : la marge avant larsen et ce qu’entend le public.' })[el.dataset.tab]],
    ['.play-btn', 'marc', 'Fais jouer ou taire ce musicien pendant la balance, pour régler sa voie tout seul.'],
    ['.mood', 'marc', 'La réaction du public.']
  ];
  function explainSalle(hit) {
    const G = root.SonoGame;
    if (hit.kind === 'source') {
      const s = E.findSource(G.state, hit.id);
      const st = s && D.SOURCES[s.type];
      return ['marc', (s ? s.name + ' · ' : '') + (st ? st.tip : '')];
    }
    if (hit.kind === 'mic') {
      const m = G.state.mics.find(x => x.uid === hit.id);
      const d = m && D.MICS[m.type];
      return ['marc', d ? 'Voie ' + (m.ch + 1) + ' : ' + d.name + ' (' + d.model + '). ' + d.desc : ''];
    }
    if (hit.kind === 'wedge') return ['jerome', 'Un retour : il diffuse ce que tu envoies sur sa sortie (Retour 1 à 4). Il doit viser le musicien et tomber dans la zone sourde de son micro.'];
    if (hit.kind === 'main') return ['jerome', 'Une enceinte de façade : le son du public. Les micros restent derrière elle, jamais devant.'];
    if (hit.kind === 'stagebox') return ['marc', 'Le boîtier de scène : chaque micro y est branché. La prise 1 arrive sur la voie 1 de la console, etc. Un gros câble (le multipaire) l’emmène jusqu’à la régie.'];
    return null;
  }

  // ------------------------------------------------------------ Les missions de l’atelier
  const peakOf = (G, ch) => { const L = G.fx.levels[ch]; return L && L.alive ? L.peak : -120; };
  const micOn = (G, srcId, kinds) => G.state.mics.find(m => m.sourceId === srcId && (!kinds || kinds.includes(D.MICS[m.type].kind)));
  const MISSIONS = [
    {
      id: 'premier', title: 'Ton premier son', who: 'marc',
      intro: 'Inès est seule sur scène. On va la faire entendre au public, étape par étape. Suis mes indications.',
      setup: (st) => { st.sources = [S.makeSource({ id: 'voix', type: 'voix', name: 'Inès', x: 5, y: 3.6, look: { shirt: '#3d8b6e', hair: '#1f1712', skin: '#8d5a3b', style: 'curly' } })]; st.sources[0].playing = false; },
      steps: [
        { text: 'Ouvre la valise : c’est là qu’est le matériel.', target: () => q('.side-tabs [data-tab=valise]'), done: (G) => G.ui.sideTab === 'valise' || !!micOn(G, 'voix') },
        { text: 'Choisis le micro chant (SM58).', target: () => q('.case-item[data-type=sm58]'), done: (G) => (G.ui.armed && G.ui.armed.type === 'sm58') || !!micOn(G, 'voix') },
        { text: 'Maintenant touche Inès sur la scène : le technicien lui apporte le micro et le branche.', target: () => salleRect('source', 'voix'), done: (G) => !!micOn(G, 'voix') },
        { text: 'Le micro arrive sur la voie 1 de la console. Fais chanter Inès pour avoir du signal.', target: () => q('.play-btn') || salleRect('source', 'voix'), before: (G) => G.setSideTab('scene'), done: (G) => G.state.sources[0].playing },
        { text: 'Tourne le GAIN de la voie 1 (glisse vers le haut) jusqu’à ce que les LED montent dans le jaune, sans rouge.', target: () => strip(0, '.knob'), done: (G) => { const p = peakOf(G, 0); return p > -12 && p < -0.5; }, why: 'Le gain adapte la force du signal : c’est toujours le premier réglage.' },
        { text: 'Active le coupe-bas (HPF) : il enlève le grave inutile d’une voix.', target: () => strip(0, '.btn-hpf'), done: (G) => G.state.channels[0].hpf },
        { text: 'Monte le fader de la voie 1 jusqu’à ce que le public l’entende bien (regarde le sonomètre : vers 80 dB).', target: () => strip(0, '.fader'), done: (G) => G.fx.leq > 74 && G.state.channels[0].fader > -40, why: 'Le fader règle le niveau dans la façade, donc ce qu’entend le public.' }
      ],
      outro: 'Bravo : micro, gain, coupe-bas, fader. C’est exactement l’ordre qu’on suit pour chaque musicien, le jour J aussi.'
    },
    {
      id: 'retour', title: 'Un retour pour Inès', who: 'jerome',
      intro: 'Inès ne s’entend pas sur scène. On lui pose un retour et on lui envoie sa voix, sans larsen.',
      setup: (st) => {
        st.sources = [S.makeSource({ id: 'voix', type: 'voix', name: 'Inès', x: 5, y: 3.6, look: { shirt: '#3d8b6e', hair: '#1f1712', skin: '#8d5a3b', style: 'curly' } })];
        const m = S.addMic(st, 'sm58', 'voix').mic; const c = st.channels[m.ch]; c.gain = 44; c.hpf = true; c.fader = -2;
      },
      steps: [
        { text: 'Dans la valise, prends un retour de scène.', target: () => q('.case-item[data-type=wedge]'), before: (G) => G.setSideTab('valise'), done: (G) => (G.ui.armed && G.ui.armed.kind === 'wedge') || G.state.wedges.length > 0 },
        { text: 'Pose-le sur la scène, juste devant Inès (entre elle et le public).', target: () => salleRect('source', 'voix'), done: (G) => G.state.wedges.length > 0 },
        { text: 'Sur la console, choisis RETOUR 1 : les faders règlent maintenant ce qui part dans ce retour.', target: () => q('.layer-btn[data-layer="0"]'), done: (G) => G.ui.layer === 0 },
        { text: 'Monte le fader de la voie 1 pour envoyer la voix d’Inès dans son retour.', target: () => strip(0, '.fader'), before: (G) => { G.state.sources[0].playing = true; }, done: (G) => G.state.channels[0].sends[0] > -20 },
        { text: 'Regarde l’onglet Analyse : la marge avant larsen doit rester au-dessus de 3 dB.', target: () => q('.side-tabs [data-tab=analyse]'), done: (G) => G.ui.sideTab === 'analyse' && G.fx.loop && G.fx.loop.worst.db < -3, why: 'Un retour bien placé, dans la zone sourde du micro, laisse beaucoup de marge.' }
      ],
      outro: 'Inès s’entend, et le retour est dans la zone sourde de son micro. Pense à revenir sur FAÇADE pour régler le public.'
    },
    {
      id: 'larsen', title: 'Provoquer un larsen (exprès)', who: 'jerome',
      intro: 'Pour savoir le stopper, il faut l’avoir entendu. Active le son, on va le provoquer, puis l’éteindre.',
      setup: (st) => {
        st.sources = [S.makeSource({ id: 'voix', type: 'voix', name: 'Inès', x: 5, y: 3.6, look: { shirt: '#3d8b6e', hair: '#1f1712', skin: '#8d5a3b', style: 'curly' } })];
        const m = S.addMic(st, 'sm58', 'voix').mic; const c = st.channels[m.ch]; c.gain = 44; c.hpf = true; c.fader = -2; c.sends[0] = -10;
        S.addWedge(st, 5, 4.5, 0);
      },
      steps: [
        { text: 'Choisis RETOUR 1 sur la console.', target: () => q('.layer-btn[data-layer="0"]'), done: (G) => G.ui.layer === 0 },
        { text: 'Monte doucement le fader de la voie 1… jusqu’à ce que ça siffle.', target: () => strip(0, '.fader'), done: (G) => G.fx.larsenOn },
        { text: 'Ça siffle ! Vite : appuie sur MUTE de la voie 1.', target: () => strip(0, '.btn-mute'), done: (G) => !G.fx.larsenOn && G.state.channels[0].mute, why: 'Le réflexe : couper d’abord, chercher ensuite.' },
        { text: 'Rouvre la voie (MUTE à nouveau), puis redescends le fader un peu sous la limite.', target: () => strip(0, '.btn-mute'), done: (G) => !G.state.channels[0].mute && G.fx.loop && G.fx.loop.worst.db < -3 }
      ],
      outro: 'Tu as entendu un larsen et tu l’as arrêté. En vrai, c’est exactement ça : couper, puis trouver la cause.'
    },
    {
      id: 'statique', title: 'Le micro qui ne marche pas', who: 'marc',
      intro: 'Le prof de guitare joue de la guitare folk. On lui met un micro statique… et il va falloir comprendre pourquoi rien ne sort.',
      setup: (st) => { st.sources = [S.makeSource({ id: 'guit', type: 'guitare_folk', name: 'Prof de guitare', x: 5, y: 3.5, look: { shirt: '#3d6b5c', hair: '#3b2a20', skin: '#e8b48f', style: 'short' } })]; st.sources[0].playing = true; },
      steps: [
        { text: 'Prends le statique petite membrane (KM184) dans la valise.', target: () => q('.case-item[data-type=km184]'), before: (G) => G.setSideTab('valise'), done: (G) => (G.ui.armed && G.ui.armed.type === 'km184') || !!micOn(G, 'guit') },
        { text: 'Pose-le sur le guitariste.', target: () => salleRect('source', 'guit'), done: (G) => !!micOn(G, 'guit') },
        { text: 'Monte le gain de la voie 1… Rien ne bouge sur le vu-mètre ! Quel bouton manque ? Indice : regarde en haut de la voie.', target: () => strip(0, '.knob'), done: (G) => G.state.channels[0].gain > 30 || G.state.channels[0].phantom },
        { text: 'Allume le 48 V : un micro statique a besoin de courant.', target: () => strip(0, '.btn-48'), done: (G) => G.state.channels[0].phantom },
        { text: 'Maintenant règle le gain dans le jaune.', target: () => strip(0, '.knob'), done: (G) => { const p = peakOf(G, 0); return p > -12 && p < -0.5; } }
      ],
      outro: 'Statique = 48 V. Le jour J, si un micro ne sort rien, c’est la première chose à vérifier.'
    },
    {
      id: 'melange', title: 'Le mélange', who: 'marc',
      intro: 'Inès et le prof de guitare jouent ensemble. Fais un mix où l’on comprend les paroles sans perdre la guitare.',
      setup: (st) => {
        st.sources = [
          S.makeSource({ id: 'voix', type: 'voix', name: 'Inès', x: 4.3, y: 3.6, look: { shirt: '#3d8b6e', hair: '#1f1712', skin: '#8d5a3b', style: 'curly' } }),
          S.makeSource({ id: 'guitare_folk', type: 'guitare_folk', name: 'Prof de guitare', x: 6, y: 3.5, look: { shirt: '#3d6b5c', hair: '#3b2a20', skin: '#e8b48f', style: 'short' } })];
        const m1 = S.addMic(st, 'sm58', 'voix').mic; const c1 = st.channels[m1.ch]; c1.gain = 44; c1.hpf = true; c1.fader = -30;
        const m2 = S.addMic(st, 'di_act', 'guitare_folk').mic; const c2 = st.channels[m2.ch]; c2.gain = 30; c2.phantom = true; c2.fader = 4;
        st.sources.forEach(s => { s.playing = true; });
      },
      steps: [
        { text: 'Regarde l’onglet Analyse, « Ce qu’entend le public » : la guitare couvre la voix.', target: () => q('.side-tabs [data-tab=analyse]'), done: (G) => G.ui.sideTab === 'analyse' },
        { text: 'Monte la voix (voie 1) et baisse un peu la guitare (voie 2) : la voix doit passer 3 à 9 dB devant.', target: () => strip(0, '.fader'), done: (G) => { const a = G.fx.aud && G.fx.aud.perSrc; if (!a || !a.voix || !a.guitare_folk) return false; const d = a.voix.total - a.guitare_folk.total; return d >= 3 && d <= 9 && G.fx.leq > 74 && G.fx.leq < 92; }, why: 'Les paroles passent avant tout. La guitare reste juste derrière.' }
      ],
      outro: 'C’est un mix ! Le public comprend les paroles, la guitare est là, et le volume reste raisonnable.'
    }
  ];

  // ------------------------------------------------------------ Liste « Avant de lever le rideau »
  function checklist(G) {
    G.coachMem = G.coachMem || {};
    const st = G.state;
    const sc = G.scene();
    if (!sc) return [];
    const items = [];
    for (const s of st.sources) {
      const def = D.SOURCES[s.type];
      if (s.type === 'cc' || s.type === 'oh') { if (!st.mics.some(m => m.sourceId === s.id)) items.push({ text: 'Un micro pour ' + s.name.toLowerCase(), ok: false, act: () => { G.setSideTab('valise'); return q('.case-item[data-type=' + (s.type === 'cc' ? 'sm57' : 'km184') + ']'); } }); continue; }
      const mics = st.mics.filter(m => m.sourceId === s.id);
      const best = mics.reduce((b, m) => Math.max(b, D.suitability(s.type, m.type)[0]), -1);
      items.push({ text: 'Un bon micro pour ' + s.name, ok: best >= 2, act: () => { G.setSideTab('valise'); return salleRect('source', s.id); } });
      for (const m of mics) {
        const ch = st.channels[m.ch];
        const md = D.MICS[m.type];
        if (md.phantom) items.push({ text: '48 V sur la voie ' + (m.ch + 1) + ' (' + s.name + ')', ok: ch.phantom, act: () => { Mixer().showChannel(m.ch); return strip(m.ch, '.btn-48'); } });
        const L = G.fx.levels[m.ch];
        items.push({ text: 'Gain réglé sur la voie ' + (m.ch + 1) + ' (fais jouer ' + s.name + ')', ok: !!(L && L.alive && L.peak > -16 && L.peak < 0) || !!G.coachMem[m.uid + 'g'], act: () => { Mixer().showChannel(m.ch); return strip(m.ch, '.knob'); } });
        if (L && L.alive && L.peak > -16 && L.peak < 0) G.coachMem[m.uid + 'g'] = true;
        if (def.hpf >= 80) items.push({ text: 'Coupe-bas sur la voie ' + (m.ch + 1), ok: ch.hpf, act: () => { Mixer().showChannel(m.ch); return strip(m.ch, '.btn-hpf'); } });
      }
    }
    for (const n of G.fx.needs || []) {
      const who = E.findSource(st, n.who);
      items.push({ text: 'Retour pour ' + (who ? who.name : n.who) + ' (' + n.wants.map(w => (E.findSource(st, w) || {}).name || w).join(', ') + ')', ok: n.ok, act: () => (n.hasWedge ? q('.layer-btn[data-layer="0"]') : (G.setSideTab('valise'), q('.case-item[data-type=wedge]'))) });
    }
    const orphan = st.mics.filter(m => !E.findSource(st, m.sourceId) && !st.channels[m.ch].mute);
    if (orphan.length) items.push({ text: 'Couper les micros sans musicien (voie ' + orphan.map(m => m.ch + 1).join(', ') + ')', ok: false, act: () => { Mixer().showChannel(orphan[0].ch); return strip(orphan[0].ch, '.btn-mute'); } });
    items.push({ text: 'Marge avant larsen d’au moins 3 dB', ok: !!(G.fx.loop && G.fx.loop.worst.db < -3), act: () => q('.side-tabs [data-tab=analyse]') });
    return items;
  }
  const Mixer = () => root.SonoMixer;

  // ------------------------------------------------------------ Le coach
  const Coach = {
    game: null, mission: null, stepIdx: 0, explain: false, tour: null,

    init(game) {
      this.game = game;
      game.coachMem = game.coachMem || {};
      $('btn-tour').addEventListener('click', () => this.startTour());
      $('btn-explain').addEventListener('click', () => this.toggleExplain());
      document.addEventListener('click', (e) => this.onExplainClick(e), true);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { this.stopTour(); if (this.explain) this.toggleExplain(false); } });
    },

    // ---- visite guidée de l’écran
    tourSteps() {
      const G = this.game;
      const concert = G.state.mode === 'concert';
      const steps = [
        { who: 'jerome', target: () => $('salle'), text: 'Voici la scène, vue depuis la régie, comme le jour J. Les musiciens jouent, le technicien installe, le public réagit.' },
        { who: 'marc', target: () => q('.side-tabs [data-tab=valise]'), text: 'La valise : choisis un micro ici, puis touche un musicien sur la scène.', before: () => G.setSideTab('valise') },
        { who: 'marc', target: () => q('.strip:not([hidden])'), text: 'Une voie de la console. De haut en bas : le 48 V, le GAIN, le coupe-bas, le vu-mètre, le fader, MUTE et SEL. Un micro = une voie.' },
        { who: 'jerome', target: () => q('.layer-bar'), text: 'Ici tu choisis ce que règlent les faders : le son du public (FAÇADE) ou celui d’un musicien sur scène (RETOUR).' },
        { who: 'jerome', target: () => $('spl'), text: 'Le sonomètre et la réaction du public : tu vois tout de suite si c’est trop fort, trop faible, ou si ça siffle.' },
        { who: 'marc', target: () => $('btn-explain'), text: 'Perdu ? Active « Explique-moi », puis touche n’importe quel bouton ou objet de la scène : je t’explique à quoi il sert.' }
      ];
      if (concert) {
        steps.splice(4, 0, { who: 'lucie', target: () => $('cue-bar'), text: 'Le conducteur : qui joue, et quand. Pendant le spectacle, je te préviens avant chaque changement.' });
        steps.push({ who: 'jerome', target: () => q('.checklist-coach') || q('.side-tabs [data-tab=scene]'), text: 'Et voici ta liste « Avant de lever le rideau » : elle se coche toute seule. Touche une ligne, je te montre où agir.', before: () => G.setSideTab('scene') });
      } else {
        steps.push({ who: 'marc', target: () => q('.missions') || q('.side-tabs [data-tab=scene]'), text: 'Dans l’atelier, lance une mission : je te guide pas à pas, et l’étape se valide quand tu as réussi.', before: () => G.setSideTab('scene') });
      }
      return steps;
    },
    startTour() {
      this.stopMission(true);
      if (this.explain) this.toggleExplain(false);
      this.tour = { steps: this.tourSteps(), i: 0 };
      this.showTourStep();
    },
    showTourStep() {
      const T = this.tour;
      if (!T) return;
      const s = T.steps[T.i];
      if (s.before) s.before();
      setTimeout(() => {
        const t = s.target();
        Spot.show(t, s.who, s.text, {
          step: (T.i + 1) + ' / ' + T.steps.length,
          next: () => { if (T.i + 1 < T.steps.length) { T.i++; this.showTourStep(); } else this.stopTour(true); },
          nextLabel: T.i + 1 < T.steps.length ? 'Suivant' : 'C’est parti !',
          prev: T.i > 0 ? () => { T.i--; this.showTourStep(); } : null,
          skip: () => this.stopTour()
        });
      }, 60);
    },
    stopTour(done) {
      if (!this.tour) return;
      this.tour = null;
      Spot.hide();
      U.store.set('tourDone', true);
      if (done && root.SonoProfil) root.SonoProfil.add(20, 'visite guidée');
    },
    offerTourIfNew() {
      if (U.store.get('tourDone', false) || this.tour || this.mission) return;
      setTimeout(() => { if (!document.querySelector('.modal:not([hidden])') && this.game.view !== 'parcours') this.startTour(); }, 600);
    },

    // ---- mode explication
    toggleExplain(force) {
      this.explain = force != null ? force : !this.explain;
      document.body.classList.toggle('explain', this.explain);
      const b = $('btn-explain');
      b.classList.toggle('on', this.explain);
      b.setAttribute('aria-pressed', String(this.explain));
      if (this.explain) {
        Spot.hide();
        U.toast($('toasts'), 'Mode Explique-moi : touche un bouton ou un objet de la scène. Touche « ? » pour sortir.', 'info', 4000, D.PEOPLE.marc);
      } else Spot.hide();
    },
    onExplainClick(e) {
      if (!this.explain) return;
      const t = e.target;
      if (t.closest('#btn-explain') || t.closest('.spot-bubble')) return;
      if (!t.closest('#view-sim')) return;
      let who = null, text = null, target = null;
      if (t.id === 'salle') {
        const r = t.getBoundingClientRect();
        const hit = root.SonoSalle.pick(e.clientX - r.left, e.clientY - r.top);
        if (hit) { const x = explainSalle(hit); if (x) { [who, text] = x; target = salleRect(hit.kind, hit.id); } }
        if (!text) { who = 'jerome'; text = 'La scène vue de la régie. Touche un musicien, un micro, un retour, une enceinte ou le boîtier de scène.'; target = t; }
      } else {
        for (const [sel, w, txt] of EXPLAIN) {
          const el = t.closest(sel);
          if (el) { who = w; text = typeof txt === 'function' ? txt(el) : txt; target = el; break; }
        }
      }
      if (!text) return;
      e.preventDefault(); e.stopPropagation();
      Spot.show(target, who, text, { next: () => Spot.hide(), nextLabel: 'Compris', noDim: true, scroll: false });
    },

    // ---- missions
    missionsEl() {
      const prog = U.store.get('missions', {});
      const wrap = h('div', { class: 'missions' }, h('h4', null, 'Missions guidées'));
      MISSIONS.forEach((m, i) => {
        const done = !!prog[m.id];
        const cur = this.mission && this.mission.id === m.id;
        wrap.appendChild(h('button', { class: 'mission' + (done ? ' done' : '') + (cur ? ' cur' : ''), onclick: () => this.startMission(m) },
          h('span', { class: 'mission-n' }, done ? '✓' : String(i + 1)),
          h('span', { class: 'mission-main' }, h('b', null, m.title), h('span', null, cur ? 'En cours : étape ' + (this.stepIdx + 1) + ' / ' + m.steps.length : m.intro))));
      });
      return wrap;
    },
    startMission(m) {
      const G = this.game;
      this.stopTour();
      if (this.explain) this.toggleExplain(false);
      if (G.view !== 'atelier') G.switchView('atelier');
      const st = S.newState('atelier');
      m.setup(st);
      G.states.atelier = st;
      G.state = st;
      G.ui.sel = null; G.ui.selCh = null; G.ui.armed = null;
      Mixer().setLayer('main'); Mixer().setBank(0);
      G.renderAll();
      this.mission = m;
      this.stepIdx = -1;
      G.sideDirty = true;
      Spot.show(() => null, m.who, m.intro, { next: () => { this.stepIdx = 0; this.showStep(); }, nextLabel: 'Commencer', skip: () => this.stopMission(), step: 'Mission · ' + m.title });
    },
    showStep() {
      const m = this.mission;
      if (!m) return;
      const s = m.steps[this.stepIdx];
      if (s.before) s.before(this.game);
      this.game.sideDirty = true;
      setTimeout(() => {
        if (!this.mission) return;
        Spot.show(s.target() || null, m.who, s.text, { noDim: true, skip: () => this.stopMission(), skipLabel: 'Arrêter', step: 'Étape ' + (this.stepIdx + 1) + ' / ' + m.steps.length });
      }, 80);
    },
    stopMission(silent) {
      if (!this.mission) return;
      this.mission = null;
      Spot.hide();
      this.game.sideDirty = true;
      if (!silent) U.toast($('toasts'), 'Mission arrêtée. Tu peux la reprendre dans l’onglet Scène.', 'info', 3000);
    },
    // appelé par la boucle du jeu
    update() {
      const G = this.game;
      const m = this.mission;
      if (m && this.stepIdx >= 0 && G.view === 'atelier') {
        const s = m.steps[this.stepIdx];
        // le projecteur suit sa cible (elle peut apparaître après un changement d’onglet)
        if (Spot.el && !Spot.rect()) { const t = s.target(); if (t) Spot.target = t; }
        if (s.done(G)) {
          if (s.why) U.toast($('toasts'), s.why, 'ok', 4500, D.PEOPLE[m.who]);
          else U.toast($('toasts'), pickOne(['Bien !', 'Parfait.', 'Exactement.', 'Bravo.']), 'ok', 1800, D.PEOPLE[m.who]);
          this.stepIdx++;
          if (this.stepIdx >= m.steps.length) {
            const prog = U.store.get('missions', {});
            const first = !prog[m.id];
            prog[m.id] = true; U.store.set('missions', prog);
            this.mission = null;
            Spot.show(() => null, m.who, m.outro, { next: () => Spot.hide(), nextLabel: 'Super !' });
            U.confetti(100);
            if (first && root.SonoProfil) root.SonoProfil.add(60, 'mission « ' + m.title + ' »');
            G.sideDirty = true;
          } else this.showStep();
        }
      }
    },

    checklistEl() {
      const G = this.game = this.game || root.SonoGame;
      const items = checklist(G);
      const okN = items.filter(i => i.ok).length;
      const wrap = h('div', { class: 'checklist-coach' },
        h('div', { class: 'row-between' }, h('h4', null, 'Avant de lever le rideau'), h('span', { class: 'cl-count' + (okN === items.length ? ' all' : '') }, okN + ' / ' + items.length)),
        h('div', { class: 'cl-bar' }, h('i', { style: 'width:' + Math.round(okN / Math.max(1, items.length) * 100) + '%' })));
      const ul = h('ul', { class: 'cl-list' });
      for (const it of items) {
        const b = h('button', { class: 'cl-item' + (it.ok ? ' ok' : '') }, h('span', { class: 'cl-tick', 'aria-hidden': 'true' }, it.ok ? '✓' : ''), h('span', null, it.text), it.ok ? null : h('span', { class: 'cl-show' }, 'Montrer'));
        b.addEventListener('click', () => {
          const t = it.act();
          setTimeout(() => Spot.show(typeof t === 'function' ? t : (t || null), 'marc', it.ok ? 'C’est fait, bravo.' : 'C’est ici. ' + it.text + '.', { next: () => Spot.hide(), nextLabel: 'OK', noDim: true }), 80);
        });
        ul.appendChild(h('li', null, b));
      }
      wrap.appendChild(ul);
      this._sig = items.map(i => i.ok ? 1 : 0).join('');
      return wrap;
    },
    checklistChanged() {
      this.game = this.game || root.SonoGame;
      if (!this.game.scene() || this.game.show) return false;
      const sig = checklist(this.game).map(i => i.ok ? 1 : 0).join('');
      return sig !== this._sig;
    }
  };
  function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }

  Coach.MISSIONS = MISSIONS;
  Coach.Spot = Spot;
  root.SonoCoach = Coach;
})(this);
