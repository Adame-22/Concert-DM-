/* Sono Sim — le parcours : apprendre la sono en mini-leçons ludiques, pensées pour le téléphone.
 * Une notion à la fois, de gros boutons, Jérôme et Marc qui guident, des étoiles à gagner.
 * Les leçons sur le larsen utilisent le vrai moteur physique (engine.js). */
(function (root) {
  'use strict';
  const D = root.SonoData;
  const E = root.SonoEngine;
  const S = root.SonoState;
  const U = root.SonoUI;
  const A = root.SonoAudio;
  const Salle = root.SonoSalle;
  const Mu = () => (root.SonoMusic && A.ctx && A.enabled ? root.SonoMusic : null);
  const h = U.h;
  const $ = (id) => document.getElementById(id);

  // ------------------------------------------------------------ Bonhommes des mini-scènes
  const LK = {
    ines: { shirt: '#3d8b6e', hair: '#1f1712', skin: '#8d5a3b', style: 'curly' },
    jade: { shirt: '#d97a2b', hair: '#5a3220', skin: '#c98e66', style: 'long', kid: true },
    christine: { shirt: '#7a3b5e', hair: '#3b2a20', skin: '#f1c9a5', style: 'bun' },
    lucie: { shirt: '#ea829f', hair: '#5a3220', skin: '#f1c9a5', style: 'long' },
    guitare: { shirt: '#3d6b5c', hair: '#3b2a20', skin: '#e8b48f', style: 'short' },
    zoe: { shirt: '#5e60ce', hair: '#2b1b14', skin: '#e8b48f', style: 'bun' },
    sam: { shirt: '#222831', hair: '#1f1712', skin: '#c98e66', style: 'short' },
    tom: { shirt: '#26313f', hair: '#e0c068', skin: '#f1c9a5', style: 'long' }
  };
  const KIDS = [
    { shirt: '#2b3a67', hair: '#3b2a20', skin: '#f1c9a5', style: 'short', kid: true },
    { shirt: '#2b3a67', hair: '#1f1712', skin: '#8d5a3b', style: 'curly', kid: true },
    { shirt: '#2b3a67', hair: '#c79a4b', skin: '#e8b48f', style: 'long', kid: true },
    { shirt: '#2b3a67', hair: '#5a3220', skin: '#c98e66', style: 'bun', kid: true },
    { shirt: '#2b3a67', hair: '#1f1712', skin: '#6b4129', style: 'short', kid: true }
  ];

  // Une mini-scène : fond de théâtre + personnages. cast: [{x (0..1), look, pose, sing, prop}]
  function drawScene(ctx, W, H, t, spec, playing) {
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.72);
    g.addColorStop(0, '#16080a'); g.addColorStop(1, '#3a1218');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.72);
    for (let i = 0; i < 14; i++) {
      const x0 = W * i / 14;
      const gg = ctx.createLinearGradient(x0, 0, x0 + W / 14, 0);
      gg.addColorStop(0, 'rgba(0,0,0,0.35)'); gg.addColorStop(0.5, 'rgba(255,255,255,0.03)'); gg.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = gg; ctx.fillRect(x0, 0, W / 14 + 0.5, H * 0.72);
    }
    const fg = ctx.createLinearGradient(0, H * 0.72, 0, H);
    fg.addColorStop(0, '#2a221e'); fg.addColorStop(1, '#3d312a');
    ctx.fillStyle = fg; ctx.fillRect(0, H * 0.72, W, H * 0.28);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = playing ? 0.18 : 0.08;
    const sp = ctx.createRadialGradient(W / 2, H * 0.85, 0, W / 2, H * 0.85, W * 0.45);
    sp.addColorStop(0, '#ffe0b0'); sp.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sp; ctx.beginPath(); ctx.ellipse(W / 2, H * 0.85, W * 0.45, H * 0.14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    const k = H * 0.42;
    const feet = H * 0.9;
    for (const c of spec.cast || []) {
      const on = typeof c.on === 'function' ? c.on(t) : (c.on == null ? playing : c.on);
      const x = c.x * W;
      if (c.prop === 'choir') {
        for (let r = 0; r < 2; r++) {
          for (let i = 0; i < 6; i++) {
            const kx = x + (i - 2.5) * k * 0.32 + (r ? k * 0.16 : 0);
            Salle.puppet(ctx, t + i * 0.4, kx, feet - k * (r ? 0.05 : 0.25), k * (r ? 0.82 : 0.74), KIDS[(i + r * 2) % 5],
              { mouth: on ? 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(t * 7 + i)) : 0, arms: 'rest' });
          }
        }
        continue;
      }
      const lvl = 0.6 + 0.4 * Math.sin(t * 2 + c.x * 10);
      const pose = Object.assign({ arms: 'rest', mouth: 0 }, c.pose || {});
      if (c.sing && on) pose.mouth = 0.3 + 0.7 * lvl * (0.5 + 0.5 * Math.sin(t * 9 + c.x * 5));
      if (pose.arms === 'guitar' && !on) pose.arms = 'hold';
      if (pose.arms === 'keys' && !on) pose.arms = 'rest';
      if (pose.arms === 'drums' && !on) pose.arms = 'rest';
      if (c.prop === 'kick') {
        Salle.puppet(ctx, t, x, feet - k * 0.18, k * 0.9, c.look, Object.assign(pose, { seated: true }));
        Salle.prop(ctx, t, 'kick', x, feet, k, on);
      } else if (c.prop === 'keyboard') {
        Salle.puppet(ctx, t, x, feet, k, c.look, pose);
        Salle.prop(ctx, t, 'keyboard', x, feet, k, on);
      } else if (c.prop === 'piano') {
        Salle.puppet(ctx, t, x, feet - k * 0.02, k, c.look, Object.assign(pose, { seated: true }));
        Salle.prop(ctx, t, 'piano', x, feet, k * 0.9, on);
      } else if (c.prop === 'amp') {
        Salle.prop(ctx, t, 'amp', x + k * 0.45, feet - k * 0.05, k * 0.9, on);
        Salle.puppet(ctx, t, x, feet, k, c.look, pose);
      } else if (c.prop === 'lectern') {
        Salle.puppet(ctx, t, x, feet - k * 0.04, k, c.look, Object.assign(pose, { arms: 'lectern' }));
        ctx.fillStyle = '#5a3a22';
        ctx.beginPath(); ctx.moveTo(x - k * 0.3, feet - k * 1.1); ctx.lineTo(x + k * 0.3, feet - k * 1.1); ctx.lineTo(x + k * 0.22, feet); ctx.lineTo(x - k * 0.22, feet); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#202227'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x + k * 0.1, feet - k * 1.1); ctx.quadraticCurveTo(x + k * 0.2, feet - k * 1.35, x + k * 0.04, feet - k * 1.4); ctx.stroke();
      } else {
        Salle.puppet(ctx, t, x, feet, k * (c.scale || 1), c.look, pose);
      }
      if (on && c.notes !== false) {
        ctx.fillStyle = '#f2a53a';
        ctx.font = Math.round(k * 0.2) + 'px Barlow, sans-serif';
        const ph = (t * 0.7 + c.x * 3) % 1;
        ctx.globalAlpha = 1 - ph;
        ctx.fillText(ph < 0.5 ? '♪' : '♫', x + k * 0.2 + Math.sin(ph * 6) * 6, feet - k * (1.75 + ph * 0.5));
        ctx.globalAlpha = 1;
      }
      if (c.label) {
        ctx.fillStyle = 'rgba(223,226,218,0.85)';
        ctx.font = '500 ' + Math.max(11, Math.round(k * 0.11)) + 'px Barlow, sans-serif';
        ctx.textAlign = 'center'; ctx.fillText(c.label, x, H - 4); ctx.textAlign = 'left';
      }
    }
  }

  // ------------------------------------------------------------ Pictos de micros (SVG)
  const ICONS = {
    sm58: '<rect x="27" y="30" width="10" height="28" rx="4" fill="#202226"/><circle cx="32" cy="22" r="11" fill="#b9bec6"/><path d="M24 20h16M24 24h16M26 16h12" stroke="#8a9099" stroke-width="1.5"/>',
    beta52: '<rect x="27" y="38" width="10" height="20" rx="4" fill="#202226"/><ellipse cx="32" cy="24" rx="15" ry="16" fill="#3a3f47"/><path d="M20 20h24M19 26h26M21 32h22" stroke="#6b717b" stroke-width="1.5"/>',
    km184: '<rect x="27" y="8" width="10" height="50" rx="5" fill="#c3c8cf"/><rect x="27" y="8" width="10" height="12" rx="5" fill="#8a9099"/>',
    c414: '<rect x="20" y="8" width="24" height="32" rx="6" fill="#c3c8cf"/><path d="M22 16h20M22 22h20M22 28h20" stroke="#8a9099" stroke-width="1.5"/><rect x="28" y="40" width="8" height="18" fill="#6b717b"/>',
    col: '<rect x="18" y="50" width="28" height="8" rx="2" fill="#5a3a22"/><path d="M32 50 C32 30 44 26 40 12" stroke="#202227" stroke-width="3" fill="none"/><circle cx="40" cy="11" r="4" fill="#9aa0a8"/>',
    pzm: '<ellipse cx="32" cy="46" rx="24" ry="7" fill="#8a9099"/><circle cx="32" cy="43" r="4" fill="#3a3f47"/>',
    di: '<rect x="14" y="22" width="36" height="24" rx="4" fill="#3b6e8f"/><text x="32" y="39" font-size="13" font-family="Barlow Condensed, sans-serif" font-weight="700" fill="#fff" text-anchor="middle">DI</text><path d="M50 34h10" stroke="#202226" stroke-width="4"/>',
    sm57: '<rect x="28" y="22" width="8" height="36" rx="3" fill="#202226"/><rect x="27" y="8" width="10" height="16" rx="3" fill="#6b717b"/>',
    none: '<path d="M18 18l28 28M46 18L18 46" stroke="#ff5040" stroke-width="5" stroke-linecap="round"/>',
    sm58x8: '<g transform="translate(-14 0) scale(.8)"><rect x="27" y="30" width="10" height="28" rx="4" fill="#202226"/><circle cx="32" cy="22" r="11" fill="#b9bec6"/></g><g transform="translate(14 0) scale(.8)"><rect x="27" y="30" width="10" height="28" rx="4" fill="#202226"/><circle cx="32" cy="22" r="11" fill="#b9bec6"/></g>'
  };
  function icon(name) {
    const span = h('span', { class: 'pc-icon', 'aria-hidden': 'true' });
    span.innerHTML = '<svg viewBox="0 0 64 64">' + (ICONS[name] || '') + '</svg>';
    return span;
  }

  // ------------------------------------------------------------ Modèle physique pour les leçons de larsen
  function wedgeState(micType, angleDeg, send) {
    const st = S.newState('atelier');
    st.sources = [S.makeSource({ id: 'voix', type: 'voix', name: 'Inès', x: 5, y: 3 })];
    const m = S.addMic(st, micType, 'voix').mic;
    const c = st.channels[m.ch];
    c.gain = 45; c.hpf = true; c.sends[0] = send || 0;
    E.micPose(st, m);
    const a = angleDeg * Math.PI / 180;
    const w = S.addWedge(st, m.x + Math.sin(a) * 1.2, m.y - Math.cos(a) * 1.2, 0).wedge;
    w.angle = Math.atan2(3 - w.y, 5 - w.x);
    return { st, ch: c };
  }
  function marginFor(micType, angleDeg, send) {
    return -E.computeLoop(wedgeState(micType, angleDeg, send).st).worst.db;
  }

  // ------------------------------------------------------------ Les leçons
  const LESSONS = [
    {
      id: 'micros', title: 'Le bon micro', sub: 'Chaque source a son micro', who: 'marc',
      hello: 'Premier réflexe d’un ingé son : donner à chacun le bon micro. Je te montre qui monte sur scène, tu choisis.',
      steps: [
        { type: 'choice', who: 'marc', text: 'Inès va chanter. Quel micro tu lui donnes ?', scene: { cast: [{ x: 0.5, look: LK.ines, pose: { arms: 'rest' }, sing: true, label: 'Inès' }] },
          options: [
            { icon: 'sm58', label: 'Micro chant', sub: 'dynamique, type SM58', ok: true, why: 'Le SM58 est fait pour la voix : solide, et il entend surtout ce qu’il y a devant lui. Parfait pour chanter tout près.' },
            { icon: 'beta52', label: 'Micro grosse caisse', sub: 'type Beta 52', why: 'Il est fait pour les sons très graves. La voix sortirait étouffée.' },
            { icon: 'pzm', label: 'Micro posé au sol', sub: 'type PZM', why: 'Trop loin de la bouche : il capterait surtout la salle.' }
          ] },
        { type: 'choice', who: 'marc', text: 'La chorale : vingt enfants sur les gradins. On fait comment ?', scene: { cast: [{ x: 0.5, prop: 'choir', label: 'La chorale' }] },
          options: [
            { icon: 'km184', label: 'Deux statiques au-dessus', sub: 'à 1-1,5 m devant le chœur', ok: true, why: 'Les micros statiques sont sensibles : ils captent bien un groupe à distance. Deux suffisent pour vingt enfants.' },
            { icon: 'sm58', label: 'Un micro chant à 2 m', sub: 'type SM58', why: 'Un micro dynamique de chant a besoin d’une bouche à quelques centimètres. À 2 m, il ne capte presque rien.' },
            { icon: 'sm58x8', label: 'Un micro par enfant', sub: '20 micros chant', why: 'Vingt micros ouverts, c’est vingt chances de larsen, et la console n’a pas assez de voies.' }
          ] },
        { type: 'choice', who: 'marc', text: 'Zoé joue du piano numérique. Comment on récupère son son ?', scene: { cast: [{ x: 0.5, look: LK.zoe, prop: 'keyboard', pose: { arms: 'keys' }, label: 'Zoé' }] },
          options: [
            { icon: 'di', label: 'Une boîte de direct (DI)', sub: 'branchée sur la sortie du clavier', ok: true, why: 'Un clavier a une sortie électrique : la DI la transforme en signal micro. Pas de micro, donc pas de larsen sur cette voie.' },
            { icon: 'sm58', label: 'Un micro devant le clavier', sub: 'devant son petit haut-parleur', why: 'Ça sonnerait mal et ça ajouterait un micro ouvert pour rien.' },
            { icon: 'none', label: 'Rien du tout', sub: 'il s’entend déjà', why: 'Un piano numérique ne fait presque pas de bruit tout seul : sans DI, le public ne l’entend pas.' }
          ] },
        { type: 'choice', who: 'marc', text: 'Sam joue de la batterie. Pour la grosse caisse ?', scene: { cast: [{ x: 0.5, look: LK.sam, prop: 'kick', pose: { arms: 'drums' }, label: 'Sam' }] },
          options: [
            { icon: 'beta52', label: 'Micro grosse caisse', sub: 'type Beta 52, dans l’ouverture', ok: true, why: 'Grosse membrane, fait pour le grave et les coups très forts.' },
            { icon: 'km184', label: 'Statique crayon', sub: 'type KM184', why: 'Trop fragile pour cette pression, et pas fait pour le grave.' },
            { icon: 'col', label: 'Col de cygne', sub: 'micro de pupitre', why: 'Fait pour la parole : la grosse caisse sonnerait toute petite.' }
          ] },
        { type: 'choice', who: 'marc', text: 'Christine fait son discours au pupitre.', scene: { cast: [{ x: 0.5, look: LK.christine, prop: 'lectern', sing: true, label: 'Christine' }] },
          options: [
            { icon: 'col', label: 'Col de cygne', sub: 'fixé au pupitre', ok: true, why: 'Discret, orientable vers la bouche, fait pour la parole. Il a besoin du 48 V.' },
            { icon: 'c414', label: 'Statique de studio', sub: 'type C414', why: 'Superbe en studio, mais à 30 cm d’une voix douce il faudrait tellement de gain que le larsen arriverait vite.' },
            { icon: 'beta52', label: 'Micro grosse caisse', sub: 'type Beta 52', why: 'La voix de Christine sonnerait sourde et lointaine.' }
          ] }
      ]
    },
    {
      id: 'branche', title: 'Brancher et allumer', sub: 'Le patch et le 48 V', who: 'jerome',
      hello: 'Un micro, ça se branche quelque part, et parfois ça a besoin de courant. Si tu comprends ça, tu sauras pourquoi « ça ne marche pas ».',
      steps: [
        { type: 'patch', who: 'jerome', text: 'Le micro d’Inès est branché sur la prise 3 du boîtier de scène. Touche la voie de la console où tu vas régler sa voix.', answer: 2 },
        { type: 'strip', who: 'jerome', text: 'Tu as branché le statique de la chorale… et aucun son ne sort. Quel bouton tu appuies ?', answer: '48V',
          buttons: { '48V': 'Oui ! Un micro statique a besoin d’être alimenté : la console lui envoie 48 volts dans le câble. Le voilà qui marche.', HPF: 'Le coupe-bas enlève des graves, il n’allume rien.', MUTE: 'MUTE coupe la voie. Là, elle est déjà muette…', SEL: 'SEL sert juste à afficher les réglages de la voie.' } },
        { type: 'choice', who: 'jerome', text: 'Et le micro chant d’Inès (un dynamique), il a besoin du 48 V ?', scene: { cast: [{ x: 0.5, look: LK.ines, sing: true, label: 'Inès' }] },
          options: [
            { label: 'Non', sub: 'un dynamique marche tout seul', ok: true, why: 'Un micro dynamique produit son signal tout seul. Le 48 V ne l’abîme pas, mais il ne sert à rien.' },
            { label: 'Oui', sub: 'tous les micros en ont besoin', why: 'Seuls les statiques (et les DI actives) en ont besoin.' }
          ] },
        { type: 'choice', who: 'jerome', text: 'Avant le concert, on allume tout. Dans quel ordre ?',
          options: [
            { label: 'La console, puis les enceintes', sub: 'et l’inverse pour éteindre', ok: true, why: 'Les enceintes en dernier : sinon elles reçoivent le « boum » d’allumage de la console.' },
            { label: 'Les enceintes, puis la console', why: 'Les enceintes prendraient le « boum » d’allumage en pleine figure.' }
          ] }
      ]
    },
    {
      id: 'gain', title: 'Le gain', sub: 'Ni trop faible, ni saturé', who: 'marc',
      hello: 'Le gain, c’est le premier bouton en haut de chaque voie. Il règle la force du signal qui entre dans la console. Trop bas, ça souffle. Trop haut, ça sature.',
      steps: [
        { type: 'gain', who: 'marc', text: 'Inès chante. Tourne le gain pour que les LED montent dans le vert et le jaune, sans jamais toucher le rouge. Tiens 3 secondes.', src: { base: -64, crest: 12, wobble: 3 }, start: 20, mtype: 'voix',
          scene: { cast: [{ x: 0.5, look: LK.ines, pose: { arms: 'mic' }, sing: true, label: 'Inès' }] } },
        { type: 'gain', who: 'marc', text: 'Sam tape sur la grosse caisse. Les coups font des crêtes très fortes : règle sur les coups, pas sur la moyenne.', src: { base: -54, crest: 18, wobble: 2, hits: true }, start: 56, mtype: 'gc',
          scene: { cast: [{ x: 0.5, look: LK.sam, prop: 'kick', pose: { arms: 'drums' }, label: 'Sam' }] } },
        { type: 'gain', who: 'marc', text: 'Jade est timide et chante tout doucement. Il va falloir plus de gain.', src: { base: -72, crest: 12, wobble: 3 }, start: 25, mtype: 'soliste',
          scene: { cast: [{ x: 0.5, look: LK.jade, pose: { arms: 'mic' }, sing: true, label: 'Jade' }] } },
        { type: 'choice', who: 'marc', text: 'Pendant le concert, la LED rouge de la voie d’Inès s’allume. Tu fais quoi ?',
          options: [
            { label: 'Je baisse le gain', ok: true, why: 'La saturation se fait à l’entrée de la console. Le fader agit après : le baisser ne l’enlève pas.' },
            { label: 'Je baisse le fader', why: 'Le son reste saturé, juste moins fort. C’est le gain qu’il faut baisser.' },
            { label: 'Rien, c’est normal', why: 'Rouge = saturation = son abîmé. On corrige.' }
          ] }
      ]
    },
    {
      id: 'retours', title: 'Placer les retours', sub: 'La zone sourde du micro', who: 'jerome',
      hello: 'Un micro n’entend pas pareil dans toutes les directions. Le retour se place là où le micro est sourd. Je calcule la marge avant larsen pour chaque position que tu essaies.',
      steps: [
        { type: 'wedge', who: 'jerome', mic: 'sm58', text: 'Inès chante dans un micro cardioïde (SM58). Où poses-tu son retour ? Essaie, regarde la marge.', spots: [180, 125, 90, 0] },
        { type: 'wedge', who: 'jerome', mic: 'beta58', text: 'Maintenant un supercardioïde (Beta 58). Sa zone sourde n’est plus pile derrière. Trouve la meilleure place.', spots: [180, 125, 90, 0] },
        { type: 'choice', who: 'jerome', text: 'Léa tient son micro par la grille, la main autour de la boule. Ça change quoi ?',
          options: [
            { label: 'Le micro entend partout', sub: 'larsen plus facile', ok: true, why: 'Les petits trous à l’arrière de la grille font la directivité. Main dessus : le micro devient presque omnidirectionnel.' },
            { label: 'Rien du tout', why: 'Ça change beaucoup : le micro perd sa zone sourde.' },
            { label: 'Le son est plus clair', why: 'C’est l’inverse : son étouffé et larsen plus facile.' }
          ] }
      ]
    },
    {
      id: 'larsen', title: 'Le larsen', sub: 'Trouver la limite, et l’éteindre', who: 'jerome',
      hello: 'Le larsen, c’est le micro qui entend l’enceinte, qui renvoie dans le micro… et ça s’emballe. Tu vas chercher la limite toi-même. Monte le son (bouton en haut), mais pas trop fort.',
      steps: [
        { type: 'sendmax', who: 'jerome', text: 'Inès veut s’entendre fort dans son retour. Monte l’envoi le plus haut possible… sans larsen. Puis valide.' },
        { type: 'ring', who: 'jerome', text: 'Le retour commence à siffler. Écoute, et touche la bande à creuser sur l’égaliseur.', bands: [3, 6, 8, 10] },
        { type: 'choice', who: 'jerome', text: 'En plein concert, ça siffle fort. Ton premier réflexe ?',
          options: [
            { label: 'Baisser le fader ou couper la voie', ok: true, why: 'D’abord faire cesser le bruit. On cherche la cause ensuite.' },
            { label: 'Chercher la fréquence à l’égaliseur', why: 'Pendant ce temps, toute la salle souffre. D’abord couper, ensuite chercher.' },
            { label: 'Débrancher l’enceinte', why: 'Trop lent, et tu coupes tout le son.' }
          ] }
      ]
    },
    {
      id: 'conducteur', title: 'Le bon moment', sub: 'Ouvrir et couper les micros', who: 'lucie',
      hello: 'Pendant un morceau, tout le monde ne joue pas en même temps. Ouvre la voie de celui qui joue, coupe celle de celui qui se tait. Je te préviens avant chaque changement.',
      steps: [
        { type: 'mute', who: 'lucie', dur: 32, text: 'Suis le morceau : touche une voie pour l’ouvrir (verte) ou la couper (rouge).',
          players: [
            { id: 'voix', name: 'Inès', look: LK.ines, sing: true, pose: { arms: 'mic' }, mtype: 'voix' },
            { id: 'guit', name: 'Guitare', look: LK.guitare, pose: { arms: 'guitar', instr: 'acoustic' }, mtype: 'guitare_folk' },
            { id: 'jade', name: 'Jade', look: LK.jade, sing: true, pose: { arms: 'mic' }, mtype: 'soliste' }
          ],
          cues: [
            { t: 0, label: 'Intro guitare', plays: ['guit'] },
            { t: 6, label: 'Couplet', plays: ['voix', 'guit'] },
            { t: 14, label: 'Solo de Jade', plays: ['jade', 'guit'] },
            { t: 21, label: 'Refrain à deux voix', plays: ['voix', 'jade', 'guit'] },
            { t: 28, label: 'Fin a cappella', plays: ['voix'] }
          ] }
      ]
    },
    {
      id: 'mix', title: 'Le mélange', sub: 'Tout le monde à sa place', who: 'marc',
      hello: 'Le mix, c’est l’équilibre : que le public entende les paroles, sans que les instruments disparaissent. Et pas trop fort, il y a des enfants dans la salle.',
      steps: [
        { type: 'mix', who: 'marc', text: 'Inès chante avec la guitare. Règle les deux faders pour que le public soit content, et tiens 3 secondes.',
          chans: [{ id: 'voix', name: 'Chant', look: LK.ines, sing: true, pose: { arms: 'mic' }, ac: 58, start: -30, mtype: 'voix' }, { id: 'guit', name: 'Guitare', look: LK.guitare, pose: { arms: 'guitar', instr: 'acoustic' }, ac: 56, start: -2, mtype: 'guitare_folk' }],
          rule: { lead: 'voix', min: 3, max: 9, leq: [76, 90] } },
        { type: 'mix', who: 'marc', text: 'Le groupe rock : la batterie s’entend déjà fort sans micro. Fais passer la voix de Léa par-dessus.',
          chans: [{ id: 'voix', name: 'Chant', look: { shirt: '#c2185b', hair: '#7b2d8b', skin: '#f1c9a5', style: 'long' }, sing: true, pose: { arms: 'mic' }, ac: 60, start: -12, mtype: 'voix' }, { id: 'drums', name: 'Batterie', look: LK.sam, prop: 'kick', pose: { arms: 'drums' }, ac: 86, start: 0, mtypes: ['gc', 'cc', 'oh'] }],
          rule: { lead: 'voix', min: 2, max: 8, leq: [86, 97] }, pa: 90 }
      ]
    }
  ];

  const P = {
    game: null, raf: 0, lesson: null, step: 0, mistakes: 0, tries: 0, cleanup: null,

    init(game) { this.game = game; },
    progress() { return U.store.get('parcours', {}); },
    save(id, stars) {
      const p = this.progress();
      if (!p[id] || stars > p[id]) p[id] = stars;
      U.store.set('parcours', p);
    },

    show() {
      if (this.lesson) this.renderStep(); else this.renderMap();
    },
    stopAnim() {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
      if (this.cleanup) { this.cleanup(); this.cleanup = null; }
      if (A.ctx) A.setFeedback(1000, 0);
      if (root.SonoMusic) root.SonoMusic.silence();
    },
    leave() { this.stopAnim(); },

    // ------------------------------------------------------------ La carte du parcours
    renderMap() {
      this.stopAnim();
      this.lesson = null;
      const el = $('view-parcours');
      el.innerHTML = '';
      const prog = this.progress();
      const done = LESSONS.filter(l => prog[l.id]).length;
      const total = LESSONS.reduce((a, l) => a + (prog[l.id] || 0), 0);
      el.appendChild(h('div', { class: 'pc-head' },
        h('h1', null, 'Apprendre en jouant'),
        h('p', null, LESSONS.length + ' petites leçons de 2 minutes, une notion à la fois. Ensuite, le concert t’attend.'),
        h('div', { class: 'pc-score' }, h('span', null, done + '/' + LESSONS.length + ' leçons'), h('span', { class: 'pc-stars-total' }, '★ ' + total + '/' + LESSONS.length * 3))));
      el.appendChild(this.line('jerome', done === 0 ? 'Salut ! Marc et moi, on t’apprend la sono avant le concert. Commence par la première leçon, on y va doucement.' : done < LESSONS.length ? 'Bien avancé ! On continue ?' : 'Tu as tout vu. Direction le concert : c’est l’épreuve finale !'));
      const path = h('ol', { class: 'pc-path' });
      LESSONS.forEach((l, i) => {
        const stars = prog[l.id] || 0;
        const open = i === 0 || prog[LESSONS[i - 1].id];
        const next = open && !stars;
        const b = h('button', { class: 'pc-node' + (stars ? ' done' : '') + (next ? ' next' : '') + (open ? '' : ' locked'), 'aria-label': l.title + (open ? '' : ' (verrouillée)') },
          h('span', { class: 'pc-num' }, String(i + 1)),
          h('span', { class: 'pc-node-main' }, h('b', null, l.title), h('span', null, l.sub)),
          h('span', { class: 'pc-node-stars', 'aria-label': stars + ' étoiles sur 3' }, [0, 1, 2].map(k => h('i', { class: k < stars ? 'on' : '' }, '★'))));
        b.addEventListener('click', () => {
          if (!open) { U.toast(this.toastBox(), 'Termine d’abord « ' + LESSONS[i - 1].title + ' ».', 'info', 2500); return; }
          this.start(l);
        });
        path.appendChild(h('li', null, b));
      });
      const last = h('li', null, h('button', { class: 'pc-node final' + (done === LESSONS.length ? ' next' : ''), onclick: () => this.game.switchView('concert') },
        h('span', { class: 'pc-num' }, '★'),
        h('span', { class: 'pc-node-main' }, h('b', null, 'Le concert'), h('span', null, 'L’épreuve finale, sur grand écran de préférence'))));
      path.appendChild(last);
      el.appendChild(path);
      el.appendChild(h('div', { class: 'pc-toasts', id: 'pc-toasts', 'aria-live': 'polite' }));
    },
    toastBox() { return $('pc-toasts') || $('toasts'); },

    line(who, text) {
      const p = D.PEOPLE[who];
      return h('div', { class: 'pc-line' }, U.avatar(p, 'lg'), h('div', { class: 'pc-bubble' }, h('b', { class: 'said-who', style: '--c:' + p.color }, p.name), h('p', null, text)));
    },

    // ------------------------------------------------------------ Une leçon
    start(lesson) {
      if (!A.ctx) { try { A.init(); this.game.syncSoundButton(); } catch (e) { /* son indisponible */ } }
      this.lesson = lesson;
      this.step = -1;
      this.mistakes = 0;
      this.renderStep();
    },

    renderStep() {
      this.stopAnim();
      const L = this.lesson;
      const el = $('view-parcours');
      el.innerHTML = '';
      const n = L.steps.length;
      const top = h('div', { class: 'pc-top' },
        h('button', { class: 'pc-close', 'aria-label': 'Quitter la leçon', onclick: () => this.renderMap() }, '×'),
        h('div', { class: 'pc-dots', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(n), 'aria-valuenow': String(Math.max(0, this.step)) },
          Array.from({ length: n }, (_, i) => h('i', { class: i < this.step ? 'done' : i === this.step ? 'cur' : '' }))),
        h('span', { class: 'pc-title' }, L.title));
      el.appendChild(top);
      if (this.step < 0) {
        el.appendChild(h('div', { class: 'pc-card' },
          h('h2', null, L.title),
          this.line(L.who, L.hello),
          h('button', { class: 'primary pc-go', onclick: () => { this.step = 0; this.renderStep(); } }, 'C’est parti')));
        return;
      }
      if (this.step >= n) { this.finish(); return; }
      const st = L.steps[this.step];
      this.tries = 0;
      const card = h('div', { class: 'pc-card' });
      card.appendChild(this.line(st.who || L.who, st.text));
      el.appendChild(card);
      const fn = this['step_' + st.type];
      fn.call(this, st, card);
      el.appendChild(h('div', { class: 'pc-toasts', id: 'pc-toasts', 'aria-live': 'polite' }));
    },

    // bandeau de résultat en bas (comme un jeu)
    feedback(ok, text, onNext) {
      const old = document.querySelector('.pc-feedback');
      if (old) old.remove();
      const box = h('div', { class: 'pc-feedback ' + (ok ? 'ok' : 'ko'), role: 'status' },
        h('div', { class: 'pc-fb-main' }, h('b', null, ok ? pick(['Bien joué !', 'Exactement !', 'Parfait !', 'Bravo !']) : 'Pas tout à fait…'), h('p', null, text)),
        ok ? h('button', { class: 'primary', onclick: () => { box.remove(); onNext(); } }, 'Continuer') : h('button', { class: 'ghost', onclick: () => box.remove() }, 'Réessayer'));
      $('view-parcours').appendChild(box);
      const b = box.querySelector('button');
      if (b) b.focus();
      if (!ok) this.mistakes++;
    },
    next() { this.step++; this.renderStep(); },

    finish() {
      const L = this.lesson;
      const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
      const had = this.progress()[L.id] || 0;
      this.save(L.id, stars);
      if (root.SonoProfil) {
        if (stars > had) root.SonoProfil.add((stars - had) * 40 + (had ? 0 : 20), 'leçon « ' + L.title + ' »');
        if (LESSONS.every(l => this.progress()[l.id])) root.SonoProfil.award('parcours');
      }
      const idx = LESSONS.indexOf(L);
      const nextL = LESSONS[idx + 1];
      const el = $('view-parcours');
      el.appendChild(h('div', { class: 'pc-card pc-end' },
        h('div', { class: 'pc-big-stars', 'aria-label': stars + ' étoiles sur 3' }, [0, 1, 2].map(k => h('i', { class: k < stars ? 'on' : '' }, '★'))),
        h('h2', null, 'Leçon terminée'),
        this.line(L.who, stars === 3 ? 'Sans faute ! Tu as compris le principe.' : stars === 2 ? 'Très bien. Quelques hésitations, c’est normal au début.' : 'C’est rentré, même si ça a été laborieux. Tu peux la refaire pour gagner des étoiles.'),
        h('div', { class: 'modal-actions' },
          h('button', { class: 'ghost', onclick: () => this.start(L) }, 'Refaire'),
          nextL ? h('button', { class: 'primary', onclick: () => this.start(nextL) }, 'Leçon suivante') : h('button', { class: 'primary', onclick: () => this.game.switchView('concert') }, 'Aller au concert'),
          h('button', { class: 'btn-text', onclick: () => this.renderMap() }, 'Retour au parcours'))));
      if (A.ctx && A.enabled) A.applause(stars === 3 ? 3 : 1.5);
    },

    // une mini-scène animée
    sceneCanvas(spec, playingFn) {
      const cv = h('canvas', { class: 'pc-scene', role: 'img', 'aria-label': 'La scène' });
      const draw = (ts) => {
        const W = cv.clientWidth || 320, H = cv.clientHeight || 200;
        const dpr = Math.min(2, root.devicePixelRatio || 1);
        if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
        const ctx = cv.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const t = ts / 1000;
        drawScene(ctx, W, H, t, spec, playingFn ? playingFn(t) : true);
        if (spec.overlay) spec.overlay(ctx, W, H, t);
        this.raf = requestAnimationFrame(draw);
      };
      this.raf = requestAnimationFrame(draw);
      return cv;
    },

    // ------------------------------------------------------------ Types d’étapes
    step_choice(st, card) {
      if (st.scene) card.appendChild(this.sceneCanvas(st.scene));
      const grid = h('div', { class: 'pc-options' + (st.options.some(o => o.icon) ? ' with-icons' : '') });
      st.options.forEach(o => {
        const b = h('button', { class: 'pc-opt' }, o.icon ? icon(o.icon) : null, h('span', { class: 'pc-opt-main' }, h('b', null, o.label), o.sub ? h('span', null, o.sub) : null));
        b.addEventListener('click', () => {
          if (o.ok) {
            b.classList.add('good');
            grid.querySelectorAll('button').forEach(x => { x.disabled = true; });
            this.feedback(true, o.why, () => this.next());
          } else {
            b.classList.add('bad'); b.disabled = true;
            this.feedback(false, o.why);
          }
        });
        grid.appendChild(b);
      });
      card.appendChild(grid);
    },

    step_patch(st, card) {
      const box = h('div', { class: 'pc-box' }, h('span', { class: 'pc-box-label' }, 'Boîtier de scène'),
        h('div', { class: 'pc-sockets' }, Array.from({ length: 8 }, (_, i) => h('i', { class: i === st.answer ? 'used' : '' }, String(i + 1)))));
      const cable = h('div', { class: 'pc-cable' }, h('span', null, 'câble du micro d’Inès → prise ' + (st.answer + 1)));
      const consoleRow = h('div', { class: 'pc-console' });
      for (let i = 0; i < 8; i++) {
        const b = h('button', { class: 'pc-strip' }, h('span', { class: 'pc-strip-n' }, String(i + 1)), h('span', { class: 'pc-strip-tape' }, ''), h('span', { class: 'pc-strip-fader' }));
        b.addEventListener('click', () => {
          if (i === st.answer) {
            b.classList.add('good');
            b.querySelector('.pc-strip-tape').textContent = 'INÈS';
            this.feedback(true, 'La prise 3 du boîtier arrive sur la voie 3 de la console. Tu écris « INÈS » sur un bout de gaffer au-dessus de la voie 3 : c’est le patch.', () => this.next());
          } else {
            b.classList.add('bad');
            setTimeout(() => b.classList.remove('bad'), 600);
            this.feedback(false, 'La voie ' + (i + 1) + ' reçoit la prise ' + (i + 1) + '. Le micro d’Inès est sur la prise 3.');
          }
        });
        consoleRow.appendChild(b);
      }
      card.append(box, cable, h('span', { class: 'pc-hint' }, 'La console'), consoleRow);
    },

    step_strip(st, card) {
      const meter = h('div', { class: 'pc-meter' }, Array.from({ length: 12 }, (_, i) => h('i', { class: i >= 10 ? 'r' : i >= 8 ? 'y' : 'g' })));
      const btns = h('div', { class: 'pc-strip-btns' });
      let solved = false;
      for (const key of Object.keys(st.buttons)) {
        const b = h('button', { class: 'pc-hw pc-hw-' + key.toLowerCase() }, key);
        b.addEventListener('click', () => {
          if (solved) return;
          if (key === st.answer) {
            solved = true;
            b.classList.add('on');
            let n = 0;
            const segs = meter.querySelectorAll('i');
            const tick = () => {
              const lvl = 6 + Math.round(Math.random() * 2);
              segs.forEach((s, i) => s.classList.toggle('on', i < lvl));
              if (++n < 60 && document.body.contains(meter)) setTimeout(tick, 90);
            };
            tick();
            this.feedback(true, st.buttons[key], () => this.next());
          } else {
            b.classList.add('bad'); setTimeout(() => b.classList.remove('bad'), 600);
            this.feedback(false, st.buttons[key]);
          }
        });
        btns.appendChild(b);
      }
      card.appendChild(h('div', { class: 'pc-strip-big' }, h('span', { class: 'pc-strip-tape big' }, 'CHORALE'), btns, meter));
    },

    step_gain(st, card) {
      card.appendChild(this.sceneCanvas(st.scene));
      const segs = 16;
      const DB = (i) => -48 + i * 3; // LED i s’allume au-dessus de ce niveau
      const meter = h('div', { class: 'pc-meter wide' }, Array.from({ length: segs }, (_, i) => h('i', { class: DB(i) >= -3 ? 'r' : DB(i) >= -12 ? 'y' : 'g' })));
      const scale = h('div', { class: 'pc-meter-scale' }, h('span', null, 'trop faible'), h('span', null, 'bien'), h('span', null, 'sature'));
      const ring = h('div', { class: 'pc-hold' }, h('i'));
      const out = h('output', { class: 'pc-gain-val' }, st.start + ' dB');
      const slider = h('input', { type: 'range', min: '0', max: '60', step: '1', value: String(st.start), class: 'pc-slider', 'aria-label': 'Gain' });
      const msg = h('p', { class: 'pc-live' }, 'Tourne le gain…');
      card.append(h('div', { class: 'pc-gain-row' }, h('span', { class: 'pc-knob-label' }, 'GAIN'), slider, out), meter, scale, h('div', { class: 'pc-hold-row' }, ring, msg));
      slider.addEventListener('input', () => { out.textContent = slider.value + ' dB'; });
      let held = 0, last = performance.now(), done = false, clipT = 0, low = 0;
      const loop = () => {
        if (!document.body.contains(meter)) return;
        const now = performance.now();
        const dt = Math.min(0.1, (now - last) / 1000); last = now;
        const t = now / 1000;
        const wob = Math.sin(t * 2.1) * st.src.wobble + Math.sin(t * 5.3) * 1.2;
        const hit = st.src.hits ? (Math.sin(t * 6.5) > 0.6 ? 0 : -10) : 0;
        const peak = st.src.base + +slider.value + wob + hit + st.src.crest - 12;
        meter.querySelectorAll('i').forEach((s, i) => s.classList.toggle('on', peak >= DB(i)));
        const mu = Mu();
        if (mu && (!this._mt || now - this._mt > 90)) { this._mt = now; mu.direct([{ id: 'g', type: st.src.mtype || 'voix', db: Math.max(-40, Math.min(2, peak + 2)), peak }], st.src.mtype === 'gc' ? 'rock' : 'duo'); }
        if (!done) {
          if (peak > 0) {
            clipT = now; held = Math.max(0, held - 1.5);
            msg.textContent = 'Ça sature ! Baisse le gain.'; msg.className = 'pc-live r';
            if (A.ctx && A.enabled && Math.random() < 0.3) A.crackle(0.5);
          } else if (peak < -24) {
            low += dt; held = Math.max(0, held - dt);
            msg.textContent = 'Trop faible : monte le gain.'; msg.className = 'pc-live b';
          } else if (now - clipT > 400) {
            held += dt;
            msg.textContent = 'Bien ! Tiens comme ça…'; msg.className = 'pc-live g';
          }
          ring.style.setProperty('--p', Math.min(1, held / 3));
          if (held >= 3) {
            done = true;
            slider.disabled = true;
            this.feedback(true, 'Gain à ' + slider.value + ' dB : les crêtes restent dans le jaune sans toucher le rouge. ' + (st.src.hits ? 'Sur une batterie, on règle sur les coups les plus forts.' : st.src.base < -68 ? 'Une voix douce demande plus de gain… et donc plus de risque de larsen. Mieux vaut lui demander de chanter près du micro.' : 'C’est le bon réglage de départ.'), () => this.next());
          }
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    },

    step_wedge(st, card) {
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '-150 -142 300 268');
      svg.setAttribute('class', 'pc-plan');
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', 'Vue de dessus : la chanteuse, son micro et les places possibles pour le retour');
      const pat = D.PATTERNS[D.MICS[st.mic].pattern];
      let d = '';
      for (let i = 0; i <= 90; i++) {
        const t = i / 90 * Math.PI * 2;
        const r = Math.abs(pat.a + (1 - pat.a) * Math.cos(t)) * 70;
        const x = Math.sin(t) * r, y = -Math.cos(t) * r;
        d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      }
      // l’avant du micro est vers le haut (vers la chanteuse)
      svg.innerHTML = '<text x="-140" y="-126" class="pc-plan-lbl">LOINTAIN ↑</text>' +
        '<text x="140" y="120" class="pc-plan-lbl" text-anchor="end">PUBLIC ↓</text>' +
        '<path d="' + d + 'Z" class="pc-polar"/>' +
        '<circle cx="0" cy="-34" r="20" class="pc-singer"/><text x="0" y="-29" class="pc-plan-t" text-anchor="middle">Inès</text>' +
        '<line x1="0" y1="0" x2="0" y2="-12" class="pc-mic-axis"/><circle cx="0" cy="0" r="7" class="pc-mic"/>';
      const labels = 'ABCD';
      const gauge = h('div', { class: 'pc-gauge' }, h('div', { class: 'pc-gauge-bar' }, h('i')), h('p', { class: 'pc-live' }, 'Touche une place A, B, C ou D.'));
      const margins = st.spots.map(a => marginFor(st.mic, a, 0));
      const best = Math.max(...margins);
      let found = false;
      st.spots.forEach((a, i) => {
        const rad = a * Math.PI / 180;
        const x = Math.sin(rad) * 95, y = -Math.cos(rad) * 95;
        const g = document.createElementNS(NS, 'g');
        g.setAttribute('class', 'pc-spot');
        g.setAttribute('tabindex', '0');
        g.setAttribute('role', 'button');
        g.setAttribute('aria-label', 'Place ' + labels[i]);
        g.innerHTML = '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="19"/><text x="' + x.toFixed(1) + '" y="' + (y + 6).toFixed(1) + '" text-anchor="middle">' + labels[i] + '</text>';
        const choose = () => {
          if (found) return;
          svg.querySelectorAll('.pc-spot').forEach(s => s.classList.remove('sel'));
          g.classList.add('sel');
          const m = margins[i];
          const bar = gauge.querySelector('i');
          bar.style.width = Math.max(4, Math.min(100, m / 16 * 100)) + '%';
          bar.className = m > 10 ? 'g' : m > 4 ? 'y' : 'r';
          gauge.querySelector('p').textContent = 'Place ' + labels[i] + ' : marge avant larsen ' + m.toFixed(0) + ' dB' + (m <= 1 ? ' : ça siffle !' : '');
          if (m >= best - 0.5) {
            found = true;
            this.feedback(true, st.mic === 'sm58'
              ? 'Pile derrière le micro, face à Inès : c’est la zone sourde d’un cardioïde. ' + m.toFixed(0) + ' dB de marge, le meilleur placement.'
              : 'Un supercardioïde est sourd vers 125°, pas pile derrière. Avec deux retours, on les met en V de chaque côté. ' + m.toFixed(0) + ' dB de marge.', () => this.next());
          } else {
            this.feedback(false, 'Marge de ' + m.toFixed(0) + ' dB seulement. Regarde la forme orange autour du micro : c’est ce qu’il entend. Le retour doit être dans un creux.');
            if (m <= 1 && A.ctx && A.enabled) A.ring(2500, 0.5, 1.2);
          }
        };
        g.addEventListener('click', choose);
        g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
        svg.appendChild(g);
      });
      card.append(svg, h('p', { class: 'pc-legend' }, h('span', { class: 'pc-legend-polar' }), ' ce que le micro entend (vue de dessus)'), gauge);
    },

    step_sendmax(st, card) {
      const base = marginFor('sm58', 180, 0); // marge à 0 dB d’envoi
      let larsen = false, amp = -80;
      const spec = {
        cast: [{ x: 0.5, look: LK.ines, pose: { arms: 'mic' }, sing: true, label: 'Inès' }],
        overlay: (ctx, W, H, t) => {
          // le retour au sol et ses ondes
          const lv = Math.max(0, Math.min(1, (+slider.value + 30) / 45));
          ctx.fillStyle = larsen ? '#ff5040' : '#2c3038';
          ctx.beginPath(); ctx.moveTo(W * 0.42, H * 0.97); ctx.lineTo(W * 0.58, H * 0.97); ctx.lineTo(W * 0.56, H * 0.88); ctx.lineTo(W * 0.44, H * 0.9); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = larsen ? '#ff5040' : '#58aee0';
          for (let i = 0; i < 3; i++) {
            const ph = (t * 1.4 + i / 3) % 1;
            ctx.globalAlpha = lv * (1 - ph); ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(W * 0.5, H * 0.9, 12 + ph * H * 0.35, Math.PI * 1.25, Math.PI * 1.75); ctx.stroke();
          }
          ctx.globalAlpha = 1;
          if (larsen) { ctx.fillStyle = 'rgba(255,80,64,' + (0.2 + 0.1 * Math.sin(t * 30)) + ')'; ctx.fillRect(0, 0, W, H); }
        }
      };
      card.appendChild(this.sceneCanvas(spec));
      const out = h('output', { class: 'pc-gain-val' }, '−20 dB');
      const slider = h('input', { type: 'range', min: '-30', max: '20', step: '1', value: '-20', class: 'pc-slider', 'aria-label': 'Envoi vers le retour' });
      const bar = h('div', { class: 'pc-gauge' }, h('div', { class: 'pc-gauge-bar risk' }, h('i')), h('p', { class: 'pc-live' }, 'Monte doucement…'));
      const ok = h('button', { class: 'primary' }, 'C’est mon réglage');
      card.append(h('div', { class: 'pc-gain-row' }, h('span', { class: 'pc-knob-label' }, 'RETOUR'), slider, out), bar, h('div', { class: 'pc-actions' }, ok));
      const update = () => {
        const v = +slider.value;
        out.textContent = (v > 0 ? '+' : '') + String(v).replace('-', '−') + ' dB';
        const m = base - v;
        larsen = m <= 0;
        const i = bar.querySelector('i');
        i.style.width = Math.max(3, Math.min(100, (1 - m / 20) * 100)) + '%';
        i.className = m <= 0 ? 'r' : m < 4 ? 'y' : 'g';
        bar.querySelector('p').textContent = larsen ? 'LARSEN ! Redescends vite.' : m < 3 ? 'Ça commence à sonner… tout près de la limite.' : m < 8 ? 'Ça monte. Encore un peu ?' : 'Inès voudrait s’entendre plus fort.';
        bar.querySelector('p').className = 'pc-live ' + (larsen ? 'r' : m < 3 ? 'y' : '');
      };
      slider.addEventListener('input', update);
      update();
      let ringT = 0;
      const tick = () => {
        if (!document.body.contains(slider)) return;
        const m = base - +slider.value;
        amp = m <= 0 ? Math.min(0, amp + (2 - m) * 0.8) : Math.max(-80, amp - 3);
        if (A.ctx) A.setFeedback(2500 * 1.01, amp > -60 ? Math.pow(10, amp / 30) * 0.7 : 0);
        const mu = Mu();
        if (mu && (!this._mt || now0() - this._mt > 200)) { this._mt = now0(); mu.direct([{ id: 'v', type: 'voix', db: -6 }], 'duo'); }
        const now = performance.now();
        if (m > 0 && m < 3 && now > ringT && A.ctx && A.enabled) { A.ring(2525, 0.15 + (3 - m) * 0.08, 0.6); ringT = now + 1800; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      this.cleanup = () => { if (A.ctx) A.setFeedback(1000, 0); };
      ok.addEventListener('click', () => {
        const m = base - +slider.value;
        if (m <= 0) { this.feedback(false, 'Tu es en plein larsen ! Redescends jusqu’à ce que ça s’arrête, puis encore un peu.'); return; }
        if (m > 7) { this.feedback(false, 'Tu as encore ' + m.toFixed(0) + ' dB de marge : Inès peut s’entendre plus fort. Monte jusqu’à entendre (ou voir) que ça commence à sonner, puis redescends un peu.'); return; }
        this.feedback(true, 'Marge de ' + m.toFixed(0) + ' dB : le plus fort possible, avec une petite sécurité. En vrai on garde 3 à 6 dB, parce que la chanteuse bouge et la salle se remplit.', () => this.next());
      });
    },

    step_ring(st, card) {
      const target = st.bands[Math.floor(Math.random() * st.bands.length)];
      const listen = h('button', { class: 'ghost' }, 'Écouter le sifflement');
      const nosound = h('button', { class: 'btn-text' }, 'Je n’ai pas de son');
      const hint = h('p', { class: 'pc-live' }, '');
      let handle = null;
      const play = () => {
        if (!A.ctx) { this.game.toggleSound(); }
        if (handle) handle.stop();
        handle = A.tone(D.BANDS[target], 1.8, { amp: 0.3 });
      };
      listen.addEventListener('click', play);
      nosound.addEventListener('click', () => { hint.textContent = 'L’analyseur montre la bande qui monte en rouge : ' + D.BAND_LABELS[target] + ' Hz. En vrai, c’est l’oreille qui le trouve.'; hint.className = 'pc-live y'; });
      const row = h('div', { class: 'pc-bands' });
      st.bands.forEach(b => {
        const btn = h('button', { class: 'pc-band' }, h('i'), h('b', null, D.BAND_LABELS[b]), h('span', null, D.BANDS[b] >= 1000 ? 'kHz' : 'Hz'));
        btn.addEventListener('click', () => {
          if (b === target) {
            btn.classList.add('good');
            if (handle) handle.stop();
            this.feedback(true, 'C’était bien vers ' + U.fmtHz(D.BANDS[b]) + '. On creuse cette bande de 3 à 6 dB sur l’égaliseur graphique du retour : il siffle moins vite, et Inès garde son retour.', () => this.next());
          } else {
            btn.classList.add('bad'); setTimeout(() => btn.classList.remove('bad'), 600);
            const higher = D.BANDS[target] > D.BANDS[b];
            this.feedback(false, 'Pas cette bande. Le sifflement est plus ' + (higher ? 'aigu' : 'grave') + '. Réécoute.');
          }
        });
        row.appendChild(btn);
      });
      card.append(h('div', { class: 'pc-actions' }, listen, nosound), row, hint);
      this.cleanup = () => { if (handle) handle.stop(); };
      setTimeout(play, 300);
    },

    step_mute(st, card) {
      const open = {};
      st.players.forEach(p => { open[p.id] = false; });
      let t0 = null, correct = 0, total = 0, done = false, lastCue = -1, warned = -1;
      const cueAt = (t) => { let c = st.cues[0], i = 0; st.cues.forEach((x, k) => { if (t >= x.t) { c = x; i = k; } }); return { c, i }; };
      const tNow = () => t0 == null ? 0 : (performance.now() - t0) / 1000;
      const spec = {
        cast: st.players.map((p, i) => ({
          x: (i + 1) / (st.players.length + 1), look: p.look, pose: p.pose, sing: p.sing, label: p.name,
          on: () => t0 != null && cueAt(tNow()).c.plays.includes(p.id)
        })),
        overlay: (ctx, W, H) => {
          // le public : content si les bonnes voies sont ouvertes
          if (t0 == null) return;
          const { c } = cueAt(tNow());
          const bad = st.players.filter(p => c.plays.includes(p.id) !== open[p.id]).length;
          ctx.font = '600 13px Barlow, sans-serif';
          ctx.fillStyle = bad ? '#ebc54a' : '#5bcb6d';
          ctx.fillText(bad ? 'Le public : « hein ? »' : 'Le public : ça sonne !', 10, 20);
        }
      };
      const cv = this.sceneCanvas(spec);
      const tl = h('div', { class: 'pc-timeline' }, st.cues.map((c, i) => {
        const end = st.cues[i + 1] ? st.cues[i + 1].t : st.dur;
        return h('div', { class: 'pc-tl-seg', style: 'flex-grow:' + (end - c.t) }, c.label);
      }), h('i', { class: 'pc-tl-cursor' }));
      const pads = h('div', { class: 'pc-pads' });
      const padEls = {};
      st.players.forEach((p, i) => {
        const b = h('button', { class: 'pc-pad', 'aria-pressed': 'false' }, h('span', { class: 'pc-pad-n' }, 'Voie ' + (i + 1)), h('b', null, p.name), h('span', { class: 'pc-pad-state' }, 'COUPÉE'));
        b.addEventListener('click', () => {
          open[p.id] = !open[p.id];
          b.classList.toggle('on', open[p.id]);
          b.setAttribute('aria-pressed', String(open[p.id]));
          b.querySelector('.pc-pad-state').textContent = open[p.id] ? 'OUVERTE' : 'COUPÉE';
        });
        padEls[p.id] = b;
        pads.appendChild(b);
      });
      const startBtn = h('button', { class: 'primary' }, 'Lancer le morceau');
      const score = h('p', { class: 'pc-live' }, 'Toutes les voies sont coupées. Prêt ?');
      card.append(cv, tl, pads, h('div', { class: 'pc-actions' }, startBtn), score);
      const loop = () => {
        if (!document.body.contains(tl) || done) return;
        const t = tNow();
        const { c, i } = cueAt(t);
        tl.querySelector('.pc-tl-cursor').style.left = Math.min(100, t / st.dur * 100) + '%';
        tl.querySelectorAll('.pc-tl-seg').forEach((s, k) => { s.classList.toggle('on', k === i); });
        if (i !== lastCue) { lastCue = i; }
        const nxt = st.cues[i + 1];
        if (nxt && t > nxt.t - 2.5 && warned !== i + 1) {
          warned = i + 1;
          const toOpen = nxt.plays.filter(id => !c.plays.includes(id)).map(id => st.players.find(p => p.id === id).name);
          const toClose = c.plays.filter(id => !nxt.plays.includes(id)).map(id => st.players.find(p => p.id === id).name);
          const parts = [];
          if (toOpen.length) parts.push('ouvre ' + toOpen.join(' et '));
          if (toClose.length) parts.push('coupe ' + toClose.join(' et '));
          U.toast(this.toastBox(), 'Dans 2 s : ' + nxt.label + (parts.length ? ' · ' + parts.join(', ') : ''), 'cue', 2600, D.PEOPLE.lucie);
        }
        const mu = Mu();
        if (mu) mu.direct(st.players.map(p => ({ id: p.id, type: p.mtype, playing: c.plays.includes(p.id), db: open[p.id] ? -4 : -26 })), 'duo');
        for (const p of st.players) {
          total++;
          if (c.plays.includes(p.id) === open[p.id]) correct++;
          padEls[p.id].classList.toggle('want', c.plays.includes(p.id) !== open[p.id]);
        }
        score.textContent = 'Justesse : ' + Math.round(correct / Math.max(1, total) * 100) + ' %';
        if (t >= st.dur) {
          done = true;
          const pct = Math.round(correct / Math.max(1, total) * 100);
          if (pct >= 75) {
            if (pct < 90) this.mistakes++;
            this.feedback(true, pct + ' % du temps, les bonnes voies étaient ouvertes. Un micro ouvert pour rien capte la salle et rapproche le larsen ; un micro fermé au mauvais moment, et le public n’entend pas.', () => this.next());
          } else {
            this.feedback(false, 'Seulement ' + pct + ' %. Écoute les annonces de Lucie : elle te prévient 2 secondes avant chaque changement. Relance le morceau.');
            startBtn.disabled = false; startBtn.textContent = 'Relancer le morceau';
          }
          return;
        }
        requestAnimationFrame(loop);
      };
      startBtn.addEventListener('click', () => {
        t0 = performance.now(); correct = 0; total = 0; done = false; lastCue = -1; warned = -1;
        startBtn.disabled = true;
        requestAnimationFrame(loop);
      });
    },

    step_mix(st, card) {
      const vals = {};
      st.chans.forEach(c => { vals[c.id] = c.start; });
      const levels = () => {
        const out = {};
        let sum = 0;
        for (const c of st.chans) {
          const pa = vals[c.id] <= -59 ? -120 : (st.pa || 80) + vals[c.id];
          const tot = 10 * Math.log10(Math.pow(10, c.ac / 10) + Math.pow(10, pa / 10));
          out[c.id] = tot; sum += Math.pow(10, tot / 10);
        }
        out.leq = 10 * Math.log10(sum);
        return out;
      };
      const judge = () => {
        const L = levels();
        const lead = L[st.rule.lead];
        const other = st.chans.find(c => c.id !== st.rule.lead);
        const diff = lead - L[other.id];
        if (L.leq > st.rule.leq[1]) return { ok: false, face: 'loud', text: 'Trop fort ! Il y a des enfants dans la salle : baisse un peu tout.' };
        if (L.leq < st.rule.leq[0]) return { ok: false, face: 'quiet', text: 'On n’entend rien au fond de la salle : monte un peu.' };
        if (diff < st.rule.min) return { ok: false, face: 'quiet', text: 'On ne comprend pas les paroles : ' + other.name.toLowerCase() + ' couvre le chant.' };
        if (diff > st.rule.max) return { ok: false, face: 'meh', text: 'On n’entend plus ' + (other.name === 'Batterie' ? 'la batterie' : 'la guitare') + ' : le chant est tout seul.' };
        return { ok: true, face: 'happy', text: 'Le public adore : on comprend les paroles et la musique est là.' };
      };
      let verdict = judge();
      const spec = {
        cast: st.chans.map((c, i) => ({ x: (i + 1) / (st.chans.length + 1), look: c.look, pose: c.pose, sing: c.sing, prop: c.prop, label: c.name })),
        overlay: (ctx, W, H, t) => {
          // un visage de spectateur qui réagit
          const x = W - 34, y = 34, r = 22;
          ctx.fillStyle = verdict.face === 'happy' ? '#5bcb6d' : verdict.face === 'loud' ? '#ff5040' : '#ebc54a';
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#13161a';
          ctx.beginPath(); ctx.arc(x - 7, y - 5, 2.5, 0, Math.PI * 2); ctx.arc(x + 7, y - 5, 2.5, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#13161a'; ctx.lineWidth = 2.5;
          ctx.beginPath();
          if (verdict.face === 'happy') ctx.arc(x, y + 2, 9, 0.2, Math.PI - 0.2);
          else if (verdict.face === 'loud') { ctx.moveTo(x - 8, y + 10); ctx.lineTo(x - 3, y + 6); ctx.lineTo(x + 2, y + 10); ctx.lineTo(x + 8, y + 6); }
          else { ctx.moveTo(x - 8, y + 9); ctx.lineTo(x + 8, y + 9); }
          ctx.stroke();
          if (verdict.face === 'loud') { ctx.fillStyle = '#7a5a46'; ctx.beginPath(); ctx.arc(x - r - 3, y, 5, 0, Math.PI * 2); ctx.arc(x + r + 3, y, 5, 0, Math.PI * 2); ctx.fill(); }
          void t;
        }
      };
      card.appendChild(this.sceneCanvas(spec));
      const msg = h('p', { class: 'pc-live' }, '');
      const ring = h('div', { class: 'pc-hold' }, h('i'));
      const faders = h('div', { class: 'pc-faders' });
      st.chans.forEach(c => {
        const out = h('output', { class: 'pc-gain-val' }, '');
        const s = h('input', { type: 'range', min: '-60', max: '10', step: '1', value: String(c.start), class: 'pc-slider', 'aria-label': 'Fader ' + c.name });
        const show = () => { out.textContent = +s.value <= -59 ? '−∞' : (+s.value > 0 ? '+' : '') + String(s.value).replace('-', '−') + ' dB'; };
        s.addEventListener('input', () => { vals[c.id] = +s.value; show(); });
        show();
        faders.appendChild(h('div', { class: 'pc-gain-row' }, h('span', { class: 'pc-knob-label' }, c.name.toUpperCase()), s, out));
      });
      card.append(faders, h('div', { class: 'pc-hold-row' }, ring, msg));
      let held = 0, last = performance.now(), done = false;
      const loop = () => {
        if (!document.body.contains(faders) || done) return;
        const now = performance.now();
        const dt = Math.min(0.1, (now - last) / 1000); last = now;
        verdict = judge();
        const mu = Mu();
        if (mu) {
          const Lv = levels();
          const list = [];
          for (const c of st.chans) for (const ty of (c.mtypes || [c.mtype])) list.push({ id: c.id + ty, type: ty, db: Math.max(-40, (Lv[c.id] - 88) * 0.9 - 4) });
          mu.direct(list, st.chans.some(c => c.prop === 'kick') ? 'rock' : 'duo');
        }
        msg.textContent = verdict.text; msg.className = 'pc-live ' + (verdict.ok ? 'g' : 'y');
        held = verdict.ok ? held + dt : Math.max(0, held - dt * 2);
        ring.style.setProperty('--p', Math.min(1, held / 3));
        if (held >= 3) {
          done = true;
          faders.querySelectorAll('input').forEach(x => { x.disabled = true; });
          this.feedback(true, st.chans.some(c => c.prop === 'kick')
            ? 'La batterie s’entend déjà toute seule : il suffit de très peu de façade dessus. C’est la voix qu’il faut porter.'
            : 'Le chant devant, la guitare juste derrière, et un volume confortable pour une salle avec des enfants.', () => this.next());
          return;
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
  };

  function now0() { return performance.now(); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  P.LESSONS = LESSONS;
  P.icon = icon;
  P.marginFor = marginFor;
  root.SonoParcours = P;
})(this);
