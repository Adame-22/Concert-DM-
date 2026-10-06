/* Sono Sim — apprendre : fiches, quiz, entraînement d’oreille. */
(function (root) {
  'use strict';
  const D = root.SonoData;
  const U = root.SonoUI;
  const A = root.SonoAudio;
  const h = U.h;
  const $ = (id) => document.getElementById(id);

  // ------------------------------------------------------------ Diagrammes polaires
  function polarSvg(pattern, opts) {
    opts = opts || {};
    const p = D.PATTERNS[pattern];
    const R = 60, cx = 80, cy = 78;
    let d = '';
    for (let i = 0; i <= 120; i++) {
      const t = i / 120 * Math.PI * 2;
      const r = Math.abs(p.a + (1 - p.a) * Math.cos(t)) * R;
      // l’avant du micro vers le haut
      const x = cx + Math.sin(t) * r, y = cy - Math.cos(t) * r;
      d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    let wedges = '';
    const nulls = pattern === 'cardio' ? [180] : pattern === 'super' ? [126, 234] : pattern === 'hyper' ? [110, 250] : [];
    for (const a of nulls) {
      const t = a * Math.PI / 180;
      const x = cx + Math.sin(t) * 70, y = cy - Math.cos(t) * 70;
      wedges += '<g transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + (a + 180) + ')"><rect x="-11" y="-6" width="22" height="12" rx="2" class="pw"/></g>';
    }
    return '<svg viewBox="0 0 160 160" class="polar-fig" role="img" aria-label="Directivité ' + p.label + '">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="60" class="pg"/><circle cx="' + cx + '" cy="' + cy + '" r="30" class="pg"/>' +
      '<line x1="' + cx + '" y1="10" x2="' + cx + '" y2="146" class="pg"/><line x1="12" y1="' + cy + '" x2="148" y2="' + cy + '" class="pg"/>' +
      '<path d="' + d + 'Z" class="pp"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="5" class="pm"/>' +
      '<text x="' + cx + '" y="8" class="pt" text-anchor="middle">bouche ↑</text>' + wedges +
      (opts.caption ? '<text x="' + cx + '" y="158" class="pt" text-anchor="middle">' + opts.caption + '</text>' : '') +
      '</svg>';
  }

  function micTable() {
    let rows = '';
    for (const id of D.SOURCE_ORDER) {
      const s = D.SOURCES[id];
      const best = [], ok = [];
      for (const m of D.MIC_ORDER) {
        const v = D.suitability(id, m)[0];
        if (v === 3) best.push(D.MICS[m].model);
        else if (v === 2) ok.push(D.MICS[m].model);
      }
      const dist = s.electric ? 'DI' : s.dist[0] + '–' + s.dist[1] + ' cm';
      rows += '<tr><th scope="row">' + s.name + '</th><td>' + best.join('<br>') + '</td><td class="muted">' + (ok.join(', ') || '—') + '</td><td class="num">' + dist + '</td><td class="num">' + (s.hpf ? s.hpf + ' Hz' : 'non') + '</td></tr>';
    }
    return '<div class="table-wrap"><table class="mic-table"><thead><tr><th>Source</th><th>Idéal</th><th>Ça dépanne</th><th>Distance</th><th>Coupe-bas</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  const FICHES = [
    {
      id: 'chaine', title: 'La chaîne du son',
      html: () => '<p>Le son fait toujours le même voyage. Quand quelque chose ne marche pas, on remonte la chaîne dans l’ordre, du musicien vers l’enceinte.</p>' +
        '<ol class="chain">' +
        '<li><b>Source</b><span>voix, instrument</span></li>' +
        '<li><b>Micro ou DI</b><span>transforme le son en signal électrique</span></li>' +
        '<li><b>Câble XLR</b><span>jusqu’au boîtier de scène (le « multipaire »)</span></li>' +
        '<li><b>Gain</b><span>préampli de la voie : adapte le niveau d’entrée</span></li>' +
        '<li><b>Coupe-bas, EQ</b><span>on nettoie et on sculpte le son</span></li>' +
        '<li><b>Fader</b><span>le niveau dans le mix</span></li>' +
        '<li><b>Bus</b><span>façade (public) ou retour (musiciens)</span></li>' +
        '<li><b>Enceintes</b><span>amplifiées : on les allume en dernier</span></li></ol>' +
        '<p>Les envois vers les retours partent en général <b>avant</b> le fader (pré-fader) : le musicien garde son mix, même quand tu bouges la façade.</p>'
    },
    {
      id: 'micros', title: 'Dynamique, statique, DI',
      html: () => '<div class="cards3">' +
        '<div><h4>Dynamique</h4><p>Une membrane collée à une bobine. Robuste, n’a pas besoin de courant, encaisse les fortes pressions. Peu sensible : il faut l’approcher de la source.</p><p class="muted">Chant (58), caisse claire et ampli (57), grosse caisse (52).</p></div>' +
        '<div><h4>Statique (à condensateur)</h4><p>Très sensible et détaillé, capte bien à distance. A besoin de l’<b>alimentation fantôme 48 V</b> envoyée par la console. Plus exposé au larsen.</p><p class="muted">Chorale, piano, overheads, guitare folk, cordes, pupitre.</p></div>' +
        '<div><h4>DI (boîte de direct)</h4><p>Pas un micro : elle reçoit la sortie d’un clavier, d’une basse ou d’une guitare à capteur, et la transforme en signal micro symétrique. Une DI active demande le 48 V.</p><p class="muted">Pas de micro = pas de larsen sur cette voie.</p></div></div>' +
        '<p class="callout">Brancher ou débrancher un micro ? Fader baissé et 48 V coupé d’abord, sinon gros « clac » dans les enceintes.</p>'
    },
    {
      id: 'directivite', title: 'Directivités et placement des retours',
      html: () => '<p>Un micro n’entend pas pareil dans toutes les directions. Sa <b>zone sourde</b> est l’endroit où l’on place le retour : c’est le meilleur anti-larsen gratuit.</p>' +
        '<div class="polars-grid">' +
        '<figure>' + polarSvg('omni') + '<figcaption><b>Omni</b>Entend tout autour. Aucune zone sourde. Serre-tête, micros de surface.</figcaption></figure>' +
        '<figure>' + polarSvg('cardio') + '<figcaption><b>Cardioïde</b>Sourd pile à l’arrière : un retour face au chanteur. SM58, SM57.</figcaption></figure>' +
        '<figure>' + polarSvg('super') + '<figcaption><b>Supercardioïde</b>Plus serré, avec un petit lobe à l’arrière : deux retours en V, à ±55° de l’arrière. Beta 58, Beta 52.</figcaption></figure>' +
        '<figure>' + polarSvg('hyper') + '<figcaption><b>Hypercardioïde</b>Encore plus serré, lobe arrière plus grand : retours bien sur les côtés.</figcaption></figure>' +
        '</div><p class="callout">Un chanteur qui tient son micro par la grille bouche les ouïes arrière : le micro devient presque omni. Larsen garanti.</p>'
    },
    {
      id: 'larsen', title: 'Le larsen',
      html: () => '<p>Le micro capte l’enceinte, la console amplifie, l’enceinte rediffuse, le micro recapte… Si, à une fréquence, ce qui revient dans le micro est plus fort que ce qui en est parti, la boucle s’emballe : ça siffle (aigus, souvent des retours) ou ça ronfle (graves, souvent la salle).</p>' +
        '<h4>Le réflexe</h4><p class="callout">Baisse immédiatement le fader de la voie en cause, ou le master. On réfléchit après.</p>' +
        '<h4>Gagner de la marge, dans l’ordre</h4><ol class="rules">' +
        '<li><b>Rapprocher la source du micro.</b> 2 fois plus près = 6 dB de gagnés. C’est la règle numéro un.</li>' +
        '<li><b>Viser la zone sourde.</b> Retours derrière un cardioïde, en V pour un supercardioïde.</li>' +
        '<li><b>Micros derrière la façade.</b> Jamais un micro devant une enceinte du public.</li>' +
        '<li><b>Couper les micros qui ne servent pas.</b> Deux micros ouverts au lieu d’un : 3 dB de marge perdus.</li>' +
        '<li><b>Coupe-bas sur tout ce qui n’est pas basse ou grosse caisse.</b></li>' +
        '<li><b>Égaliser le système.</b> Sur l’EQ graphique, creuser de 3 à 6 dB la bande qui siffle en premier.</li>' +
        '<li><b>Baisser un peu.</b> Un petit concert n’a pas besoin d’être fort.</li></ol>' +
        '<h4>Repérer la fréquence</h4><p>À l’oreille : un sifflement aigu vers 2-4 kHz, un « ouuu » médium vers 500 Hz-1 kHz, un ronflement vers 125-250 Hz. Entraîne-toi dans l’onglet Oreille.</p>'
    },
    {
      id: 'gain', title: 'Régler un gain, pas à pas',
      html: () => '<ol class="rules">' +
        '<li>Fader de la voie en bas, gain au minimum.</li>' +
        '<li>48 V si c’est un statique ou une DI active.</li>' +
        '<li>Demande au musicien de jouer <b>son passage le plus fort</b>, pas un petit « un, deux ».</li>' +
        '<li>Monte le gain jusqu’à ce que les crêtes atteignent environ <b>−10 à −6 dBFS</b> (les LED jaunes s’allument parfois, jamais la rouge).</li>' +
        '<li>Coupe-bas, EQ si besoin.</li>' +
        '<li>Alors seulement, monte le fader pour placer l’instrument dans le mix.</li></ol>' +
        '<p class="callout">LED rouge = saturation au préampli. On baisse le <b>gain</b>, pas le fader : le fader agit après la saturation.</p>' +
        '<p>Batterie et percussions ont un très gros écart entre moyenne et crêtes : règle-les sur les coups les plus forts.</p>'
    },
    {
      id: 'choix', title: 'Quel micro pour quoi',
      html: () => '<p>Tableau tiré du simulateur. Les modèles cités sont les plus courants : si ton matériel est d’une autre marque, cherche l’équivalent (dynamique, statique, directivité).</p>' + micTable()
    },
    {
      id: 'patch', title: 'Le patch et le conducteur',
      html: () => '<p><b>Le patch</b>, c’est qui est branché où. Chaque micro part en câble XLR jusqu’au <b>boîtier de scène</b>. La prise 1 du boîtier arrive sur la voie 1 de la console, la prise 2 sur la voie 2, et ainsi de suite. Les micros sans fil n’ont pas de câble : c’est leur récepteur qui est branché au boîtier.</p>' +
        '<p class="callout">Si un micro arrive sur la mauvaise voie, il prend les réglages de cette voie : le 48 V, le gain, l’égaliseur… d’un autre instrument. Le line check sert à vérifier ça avant que le public entre.</p>' +
        '<p><b>Le conducteur</b>, c’est le déroulé du morceau ou de la soirée : qui joue, quand. On le garde sous les yeux pendant le concert pour anticiper :</p><ol class="rules">' +
        '<li>Ouvre la voie d’un musicien <b>juste avant</b> qu’il commence (un solo, une prise de parole).</li>' +
        '<li>Coupe-la quand il a fini : un micro ouvert pour rien capte la salle et rapproche le larsen.</li>' +
        '<li>Note sur ta feuille les moments délicats : la chanteuse qui descend dans le public, le pont a cappella, les applaudissements.</li></ol>'
    },
    {
      id: 'retours', title: 'Les retours',
      html: () => '<p>Les retours permettent aux musiciens de s’entendre. Chaque sortie « Retour » de la console a son propre mix.</p><ol class="rules">' +
        '<li>Demande à chacun <b>ce qu’il veut entendre</b> : souvent sa propre voix, et l’instrument qui donne le tempo ou la note.</li>' +
        '<li>Le moins possible dans les retours : chaque dB ajouté rapproche le larsen et salit la façade.</li>' +
        '<li>Sur la console : sélectionne le mix « Retour N », les faders deviennent les envois vers ce retour.</li>' +
        '<li>Un musicien qui montre son retour du doigt, c’est « plus de moi ». Un pouce vers le bas : « moins ».</li>' +
        '<li>Égalise le retour à part (EQ graphique du retour), souvent un creux vers 2-3 kHz.</li></ol>'
    },
    {
      id: 'jourj', title: 'Check-list du jour J', checklist: true,
      items: [
        'Plan de scène et liste des voies (patch) imprimés, scotchés à la console',
        'Piles neuves dans les micros sans fil et les DI qui en ont, piles de rechange',
        'Gaffer et marqueur : chaque voie étiquetée sur la console',
        'Câbles scotchés au sol dans les passages',
        'Allumage : console d’abord, enceintes en dernier (extinction : l’inverse)',
        'Line check : chaque micro sonne sur la bonne voie',
        'Balance de chaque musicien, puis tous ensemble',
        'Égalisation du système : monter doucement jusqu’au début du larsen, creuser la bande, recommencer',
        'Faders des voies inutilisées en bas et voies coupées',
        'Sonomètre (une appli suffit) : viser 80-90 dB à la régie, jamais au-dessus de 102 dB(A)',
        'Bouchons d’oreille pour toi et les musiciens qui en veulent',
        'Pendant le concert : main près du fader chant, yeux sur la scène'
      ]
    },
    {
      id: 'glossaire', title: 'Glossaire',
      html: () => {
        const g = [
          ['Façade', 'Enceintes tournées vers le public.'], ['Retour', 'Enceinte (souvent au sol, « wedge ») pour qu’un musicien s’entende.'],
          ['Jardin / Cour', 'Gauche / droite de la scène, vues depuis le public.'], ['Lointain', 'Le fond de la scène.'],
          ['Gain', 'Préamplification d’entrée d’une voie.'], ['Fader', 'Potentiomètre rectiligne de niveau.'],
          ['dBFS', 'Niveau numérique : 0 dBFS est le maximum absolu, au-delà ça sature.'], ['Unity (0 dB)', 'Position du fader qui ne change pas le niveau.'],
          ['HPF / coupe-bas', 'Filtre qui enlève le grave sous une fréquence.'], ['EQ graphique', 'Égaliseur à bandes fixes, sur une sortie (façade, retour).'],
          ['48 V / fantôme', 'Alimentation envoyée par la console aux micros statiques et DI actives.'], ['DI', 'Boîte de direct : adapte un instrument électrique à une entrée micro.'],
          ['XLR', 'Connecteur à 3 broches des micros, symétrique.'], ['Multipaire', 'Gros câble qui regroupe toutes les voies entre scène et régie.'],
          ['Patch', 'Qui est branché sur quelle voie.'], ['Pré-fader / post-fader', 'Un envoi pris avant ou après le fader de la voie.'],
          ['PFL / Solo', 'Écouter une voie seule au casque, sans toucher au son de la salle.'], ['Larsen', 'Boucle micro → enceinte → micro qui s’emballe.'],
          ['Line check', 'Vérifier que chaque micro arrive sur la bonne voie.'], ['Balance', 'Réglage des gains et du mix avec les musiciens.'],
          ['Crête', 'Pointe de niveau la plus forte d’un son.'], ['Effet de proximité', 'Plus un micro directionnel est proche, plus il renforce le grave.']
        ];
        return '<dl class="glossary">' + g.map(([t, d]) => '<dt>' + t + '</dt><dd>' + d + '</dd>').join('') + '</dl>';
      }
    }
  ];

  const L = {
    game: null, built: {},
    init(game) { this.game = game; },
    show(v) {
      if (v === 'fiches') this.renderFiches();
      if (v === 'quiz' && !this.built.quiz) { this.startQuiz(); this.built.quiz = true; }
      if (v === 'oreille' && !this.built.oreille) { this.renderEar(); this.built.oreille = true; }
    },

    // ------------------------------------------------------------ Fiches
    renderFiches() {
      const el = $('view-fiches');
      if (this.built.fiches) return;
      this.built.fiches = true;
      el.innerHTML = '';
      const nav = h('nav', { class: 'fiche-nav', 'aria-label': 'Fiches' });
      const body = h('div', { class: 'fiche-body' });
      const checks = U.store.get('checklist', {});
      FICHES.forEach((f, i) => {
        nav.appendChild(h('a', { href: '#fiche-' + f.id, class: 'fiche-link', onclick: (e) => { e.preventDefault(); $('fiche-' + f.id).scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, h('span', { class: 'fiche-n' }, String(i + 1)), f.title));
        const sec = h('section', { class: 'fiche', id: 'fiche-' + f.id }, h('h2', null, f.title));
        if (f.checklist) {
          const ul = h('ul', { class: 'checklist' });
          f.items.forEach((it, k) => {
            const id = 'chk-' + k;
            const cb = h('input', { type: 'checkbox', id });
            cb.checked = !!checks[k];
            cb.addEventListener('change', () => { checks[k] = cb.checked; U.store.set('checklist', checks); });
            ul.appendChild(h('li', null, cb, h('label', { for: id }, it)));
          });
          sec.appendChild(ul);
        } else {
          const c = h('div', { class: 'fiche-content' });
          c.innerHTML = f.html();
          sec.appendChild(c);
        }
        body.appendChild(sec);
      });
      el.append(h('div', { class: 'learn-head' }, h('h1', null, 'Fiches'), h('p', null, 'L’essentiel pour tenir la console d’un concert. À relire la veille.')), h('div', { class: 'fiche-layout' }, nav, body));
    },

    // ------------------------------------------------------------ Quiz
    startQuiz() {
      const qs = D.QUIZ.map((q, i) => ({ q, i, order: shuffle(q.a.map((_, k) => k)) }));
      this.quiz = { list: shuffle(qs).slice(0, 12), pos: 0, score: 0, answered: false };
      this.renderQuiz();
    },
    renderQuiz() {
      const el = $('view-quiz');
      el.innerHTML = '';
      const Q = this.quiz;
      const head = h('div', { class: 'learn-head' }, h('h1', null, 'Quiz'), h('p', null, '12 questions tirées au hasard. Chaque réponse est expliquée.'));
      if (Q.pos >= Q.list.length) {
        const best = U.store.get('quizBest', 0);
        if (Q.score > best) U.store.set('quizBest', Q.score);
        el.append(head, h('div', { class: 'quiz-card done' },
          h('div', { class: 'score-big' }, h('span', { class: 'score-num' }, String(Q.score)), h('span', { class: 'score-of' }, '/' + Q.list.length)),
          h('p', null, Q.score >= 10 ? 'Le frangin peut partir tranquille à la maternité.' : Q.score >= 7 ? 'Solide. Relis les fiches sur ce qui a coincé.' : 'Les fiches t’attendent, puis retente ta chance.'),
          h('p', { class: 'muted' }, 'Meilleur score : ' + Math.max(best, Q.score) + '/' + Q.list.length),
          h('div', { class: 'modal-actions' }, h('button', { class: 'primary', onclick: () => this.startQuiz() }, 'Nouveau quiz'))));
        return;
      }
      const it = Q.list[Q.pos];
      const card = h('div', { class: 'quiz-card' },
        h('div', { class: 'brief-eyebrow' }, 'Question ' + (Q.pos + 1) + ' / ' + Q.list.length + ' · score ' + Q.score),
        h('h2', null, it.q.q));
      const answers = h('div', { class: 'quiz-answers' });
      const why = h('p', { class: 'quiz-why', hidden: true });
      const next = h('button', { class: 'primary', hidden: true, onclick: () => { Q.pos++; Q.answered = false; this.renderQuiz(); } }, Q.pos + 1 < Q.list.length ? 'Question suivante' : 'Voir mon score');
      it.order.forEach((k) => {
        const b = h('button', { class: 'quiz-a' }, it.q.a[k]);
        b.addEventListener('click', () => {
          if (Q.answered) return;
          Q.answered = true;
          const good = k === it.q.ok;
          if (good) Q.score++;
          answers.querySelectorAll('button').forEach((x, j) => {
            x.disabled = true;
            if (it.order[j] === it.q.ok) x.classList.add('good');
          });
          if (!good) b.classList.add('bad');
          why.hidden = false;
          why.textContent = (good ? 'Exact. ' : 'Raté. ') + it.q.why;
          next.hidden = false;
          next.focus();
        });
        answers.appendChild(b);
      });
      card.append(answers, why, h('div', { class: 'modal-actions' }, next));
      el.append(head, card);
    },

    // ------------------------------------------------------------ Oreille
    renderEar() {
      const el = $('view-oreille');
      el.innerHTML = '';
      const levels = {
        facile: [1, 4, 7, 10],
        moyen: [1, 3, 5, 7, 9, 11],
        difficile: D.BANDS.map((_, i) => i)
      };
      const st = this.ear = { mode: 'trouver', level: 'facile', bands: levels.facile, target: null, streak: 0, score: 0, tries: 0, handle: null, t0: 0, timer: null };
      const head = h('div', { class: 'learn-head' }, h('h1', null, 'Oreille'),
        h('p', null, 'Le bon ingé son reconnaît la fréquence d’un larsen à l’oreille et sait quelle bande creuser. Ça s’entraîne. Active le son (en haut), volume raisonnable.'));
      const modeRow = h('div', { class: 'seg', role: 'group', 'aria-label': 'Exercice' });
      const lvlRow = h('div', { class: 'seg', role: 'group', 'aria-label': 'Difficulté' });
      const mk = (row, val, label, key) => {
        const b = h('button', { class: 'seg-btn', 'aria-pressed': 'false' }, label);
        b.addEventListener('click', () => {
          st[key] = val;
          if (key === 'level') st.bands = levels[val];
          row.querySelectorAll('button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
          this.stopEar(); st.target = null; renderBands(); status('Appuie sur « ' + (st.mode === 'trouver' ? 'Écouter' : 'Lancer le larsen') + ' ».');
          go.textContent = st.mode === 'trouver' ? 'Écouter' : 'Lancer le larsen';
        });
        if (st[key] === val) { b.classList.add('on'); b.setAttribute('aria-pressed', 'true'); }
        row.appendChild(b);
      };
      mk(modeRow, 'trouver', 'Reconnaître la fréquence', 'mode');
      mk(modeRow, 'eteindre', 'Éteindre le larsen', 'mode');
      mk(modeRow, 'decouvrir', 'Écouter les bandes', 'mode');
      mk(lvlRow, 'facile', 'Facile · 4 bandes', 'level');
      mk(lvlRow, 'moyen', 'Moyen · 6 bandes', 'level');
      mk(lvlRow, 'difficile', 'Difficile · 12 bandes', 'level');

      const msg = h('p', { class: 'ear-status', 'aria-live': 'polite' }, 'Choisis un exercice, puis appuie sur « Écouter ».');
      const status = (t, cls) => { msg.textContent = t; msg.className = 'ear-status ' + (cls || ''); };
      const scoreEl = h('div', { class: 'ear-score' });
      const paintScore = () => { scoreEl.innerHTML = ''; scoreEl.append(h('span', null, 'Score ', h('b', null, String(st.score))), h('span', null, 'Série ', h('b', null, String(st.streak)))); };
      paintScore();
      const bandsEl = h('div', { class: 'ear-bands' });
      const go = h('button', { class: 'primary' }, 'Écouter');
      const need = () => {
        if (!A.ctx) { this.game.toggleSound(); }
        return !!A.ctx;
      };
      const pick = () => st.bands[Math.floor(Math.random() * st.bands.length)];
      const freqOf = (b) => D.BANDS[b] * (1 + (Math.random() - 0.5) * 0.06);

      const renderBands = () => {
        bandsEl.innerHTML = '';
        st.bands.forEach((b) => {
          const btn = h('button', { class: 'ear-band' }, h('span', { class: 'ear-f' }, D.BAND_LABELS[b]), h('span', { class: 'ear-u' }, D.BANDS[b] >= 1000 ? 'kHz' : 'Hz'));
          btn.addEventListener('click', () => answer(b, btn));
          bandsEl.appendChild(btn);
        });
      };
      const answer = (b, btn) => {
        if (st.mode === 'decouvrir') {
          if (!need()) return;
          this.stopEar();
          st.handle = A.tone(D.BANDS[b], 1.6, { amp: 0.3 });
          status(U.fmtHz(D.BANDS[b]) + ' : ' + describe(D.BANDS[b]));
          return;
        }
        if (st.target == null) { status('Lance d’abord un son.', 'warn'); return; }
        const dist = Math.abs(st.bands.indexOf(b) - st.bands.indexOf(st.target));
        if (st.mode === 'trouver') {
          if (dist === 0) {
            st.score += 10; st.streak++;
            btn.classList.add('good');
            status('Oui ! C’était ' + U.fmtHz(D.BANDS[st.target]) + '. ' + describe(D.BANDS[st.target]), 'ok');
          } else {
            st.streak = 0;
            if (dist === 1) st.score += 3;
            btn.classList.add('bad');
            const good = Array.from(bandsEl.children)[st.bands.indexOf(st.target)];
            if (good) good.classList.add('good');
            status((dist === 1 ? 'Presque : ' : 'Non : ') + 'c’était ' + U.fmtHz(D.BANDS[st.target]) + '. ' + describe(D.BANDS[st.target]), dist === 1 ? 'warn' : 'ko');
          }
          st.target = null;
          paintScore();
        } else if (st.mode === 'eteindre') {
          if (dist === 0) {
            const t = (performance.now() - st.t0) / 1000;
            this.stopEar();
            const pts = Math.max(2, Math.round(20 - t * 3));
            st.score += pts; st.streak++;
            btn.classList.add('good');
            status('Larsen éteint en ' + t.toFixed(1).replace('.', ',') + ' s (+' + pts + '). C’était ' + U.fmtHz(D.BANDS[st.target]) + '.', 'ok');
            st.target = null;
          } else {
            btn.classList.add('bad');
            setTimeout(() => btn.classList.remove('bad'), 500);
            status('Pas cette bande… ça siffle toujours !', 'ko');
          }
          paintScore();
        }
      };
      go.addEventListener('click', () => {
        if (!need()) return;
        this.stopEar();
        bandsEl.querySelectorAll('.good,.bad').forEach(x => x.classList.remove('good', 'bad'));
        if (st.mode === 'decouvrir') { status('Clique sur une bande pour l’entendre.'); return; }
        if (st.target == null || st.mode === 'eteindre') st.target = pick();
        const f = freqOf(st.target);
        if (st.mode === 'trouver') {
          st.handle = A.tone(f, 1.8, { amp: 0.3 });
          status('Quelle bande ? (rappuie sur Écouter pour réentendre le même son)');
        } else {
          st.t0 = performance.now();
          st.handle = A.tone(f, 6, { amp: 0.32, grow: true });
          status('Ça monte ! Clique vite sur la bande à creuser.', 'warn');
          st.timer = setTimeout(() => {
            if (st.target != null) {
              status('Trop tard : la salle se bouche les oreilles. C’était ' + U.fmtHz(D.BANDS[st.target]) + '.', 'ko');
              st.streak = 0; st.target = null; paintScore();
              this.stopEar();
            }
          }, 6000);
        }
      });
      renderBands();
      el.append(head, h('div', { class: 'ear-card' },
        h('div', { class: 'ear-controls' }, modeRow, lvlRow),
        h('div', { class: 'ear-main' }, go, scoreEl), msg, bandsEl,
        h('p', { class: 'muted small' }, 'Astuce : les bandes sont celles de l’EQ graphique de la console du simulateur. En vrai, un EQ de façade en a souvent 31.')));
    },
    stopEar() {
      const st = this.ear;
      if (!st) return;
      if (st.handle) { st.handle.stop(); st.handle = null; }
      if (st.timer) { clearTimeout(st.timer); st.timer = null; }
    }
  };

  function describe(f) {
    if (f <= 100) return 'Grave profond : un ronflement qu’on sent plus qu’on n’entend.';
    if (f <= 250) return 'Grave : le « ronron » d’une salle qui boume.';
    if (f <= 630) return 'Bas-médium : un « ouuu » sourd, la boîte.';
    if (f <= 1600) return 'Médium : un « iii » nasal, la zone de la voix.';
    if (f <= 4000) return 'Haut-médium : le sifflement typique d’un retour.';
    return 'Aigu : un sifflement perçant.';
  }
  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  root.SonoLearn = L;
})(this);
