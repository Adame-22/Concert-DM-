/* Sono Sim — le jeu de questions et le profil du joueur.
 * Modes : partie rapide, par thème, oreille d’or (questions à l’écoute), chrono, survie.
 * Points, combos, chrono par question, XP, niveaux, badges, révision des erreurs. */
(function (root) {
  'use strict';
  const D = root.SonoData;
  const U = root.SonoUI;
  const A = root.SonoAudio;
  const QB = root.SonoQuestions;
  const h = U.h;
  const $ = (id) => document.getElementById(id);

  // ------------------------------------------------------------ Le profil : XP, niveaux, badges
  const LEVELS = [
    [0, 'Stagiaire'], [150, 'Porteur de câbles'], [400, 'Roadie'], [800, 'Technicien plateau'],
    [1400, 'Technicien son'], [2200, 'Ingé son retours'], [3200, 'Ingé son façade'], [4500, 'Chef de régie']
  ];
  const BADGES = {
    premier: { name: 'Premier quiz', desc: 'Finir une partie de questions' },
    sansfaute: { name: 'Sans faute', desc: '10 sur 10 en partie rapide' },
    oreille: { name: 'Oreille d’or', desc: 'Sans faute en Oreille d’or' },
    survivant: { name: 'Survivant', desc: '15 bonnes réponses en Survie' },
    eclair: { name: 'Éclair', desc: '20 bonnes réponses au Chrono' },
    combo: { name: 'En feu', desc: 'Une série de 10 bonnes réponses' },
    parcours: { name: 'Diplômé', desc: 'Finir toutes les leçons' },
    concert: { name: 'Prêt pour le jour J', desc: '80/100 sur un plateau du concert' },
    zerolarsen: { name: 'Zéro larsen', desc: 'Un plateau entier sans le moindre larsen' },
    cablage: { name: 'Câbleur', desc: 'Réussir toutes les installations du câblage' }
  };
  const Profil = {
    data() { return Object.assign({ xp: 0, badges: [], best: {}, cats: {} }, U.store.get('profil', {})); },
    save(d) { U.store.set('profil', d); this.paint(); },
    level(xp) {
      let i = 0;
      while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1][0]) i++;
      const cur = LEVELS[i][0], next = LEVELS[i + 1] ? LEVELS[i + 1][0] : cur + 1500;
      return { n: i + 1, name: LEVELS[i][1], cur, next, p: Math.min(1, (xp - cur) / (next - cur)) };
    },
    add(n, why) {
      if (!n) return;
      const d = this.data();
      const before = this.level(d.xp).n;
      d.xp += Math.round(n);
      this.save(d);
      const L = this.level(d.xp);
      if (L.n > before) {
        U.toast(toastBox(), 'Niveau ' + L.n + ' : ' + L.name + ' !', 'ok', 4000, D.PEOPLE.jerome);
        U.confetti();
      } else if (why) {
        U.toast(toastBox(), '+' + Math.round(n) + ' XP · ' + why, 'info', 2200);
      }
    },
    award(id) {
      const d = this.data();
      if (d.badges.includes(id)) return false;
      d.badges.push(id);
      this.save(d);
      U.toast(toastBox(), 'Badge gagné : ' + BADGES[id].name + ' · ' + BADGES[id].desc, 'ok', 4500);
      return true;
    },
    best(mode, v) {
      const d = this.data();
      if (v != null && (d.best[mode] == null || v > d.best[mode])) { d.best[mode] = v; this.save(d); return true; }
      return false;
    },
    catStat(cat, ok) {
      const d = this.data();
      const c = d.cats[cat] || (d.cats[cat] = { ok: 0, n: 0 });
      c.n++; if (ok) c.ok++;
      this.save(d);
    },
    // petite pastille de niveau dans la barre du haut
    paint() {
      const el = $('level-chip');
      if (!el) return;
      const L = this.level(this.data().xp);
      el.innerHTML = '';
      el.append(h('span', { class: 'lv-n' }, String(L.n)), h('span', { class: 'lv-txt' }, h('b', null, L.name), h('i', { class: 'lv-bar' }, h('i', { style: 'width:' + Math.round(L.p * 100) + '%' }))));
      el.title = 'Niveau ' + L.n + ' · ' + this.data().xp + ' XP';
    }
  };
  function toastBox() { return ['cb-toasts', 'pc-toasts', 'qz-toasts', 'toasts'].map($).find(el => el && el.offsetParent !== null) || $('toasts'); }

  // ------------------------------------------------------------ Questions à l’écoute
  const Mu = () => root.SonoMusic;
  function soundReady() { return A.ctx && A.enabled; }
  function audioQuestion(kind, lvl) {
    if (kind === 'band') {
      const sets = lvl >= 3 ? [3, 5, 6, 8, 9, 10] : lvl === 2 ? [3, 6, 8, 10] : [3, 6, 10];
      const target = sets[Math.floor(Math.random() * sets.length)];
      return {
        cat: 'oreille', lvl, type: 'qcm', audio: true,
        q: 'Ça siffle ! Vers quelle fréquence ?', a: sets.map(b => U.fmtHz(D.BANDS[b])), ok: sets.indexOf(target),
        why: 'C’était ' + U.fmtHz(D.BANDS[target]) + '. Grave = ronflement de salle, médium = « ouuu », haut-médium = sifflement de retour.',
        play: () => { const hnd = A.tone(D.BANDS[target] * (1 + (Math.random() - 0.5) * 0.04), 1.8, { amp: 0.28 }); return () => hnd && hnd.stop(); }
      };
    }
    if (kind === 'mix') {
      const faults = [
        { label: 'La guitare couvre la voix', mix: { v: -16, g: 0 } },
        { label: 'On n’entend presque plus la guitare', mix: { v: 0, g: -30 } },
        { label: 'La voix sature', mix: { v: -2, g: -8, peak: 10 } },
        { label: 'Rien, c’est bien équilibré', mix: { v: 0, g: -7 } }
      ];
      const k = Math.floor(Math.random() * faults.length);
      return {
        cat: 'oreille', lvl, type: 'qcm', audio: true,
        q: 'Écoute ce mix d’Inès et de la guitare. Qu’est-ce qui ne va pas ?', a: faults.map(f => f.label), ok: k,
        why: faults[k].label + '. ' + (k === 0 ? 'Il faut baisser la guitare ou monter la voix : les paroles passent avant tout.' : k === 1 ? 'La guitare a disparu : remonte-la, juste derrière la voix.' : k === 2 ? 'Le son grésille sur les notes fortes : c’est le gain qu’il faut baisser.' : 'La voix devant, la guitare juste derrière : c’est ce qu’on veut.'),
        play: () => {
          const f = faults[k].mix;
          Mu().direct([{ id: 'v', type: 'voix', db: f.v, peak: f.peak || -8 }, { id: 'g', type: 'guitare_folk', db: f.g }], 'duo');
          return () => Mu().silence();
        }
      };
    }
    if (kind === 'missing') {
      const parts = [
        { label: 'La voix', ids: ['voix'] }, { label: 'La batterie', ids: ['gc', 'cc', 'oh'] },
        { label: 'La basse', ids: ['basse'] }, { label: 'La guitare', ids: ['guitare_elec'] }
      ];
      const k = Math.floor(Math.random() * parts.length);
      return {
        cat: 'oreille', lvl, type: 'qcm', audio: true,
        q: 'Le groupe rock joue. Quel instrument a disparu du mix ?', a: parts.map(p => p.label), ok: k,
        why: parts[k].label + ' manquait. Une voie coupée par erreur, ça arrive : on le repère à l’oreille avant de chercher sur la console.',
        play: () => {
          const all = { voix: -2, gc: -6, cc: -8, oh: -14, basse: -6, guitare_elec: -10 };
          Mu().direct(Object.keys(all).map(id => ({ id, type: id, db: all[id], playing: !parts[k].ids.includes(id) })), 'rock');
          return () => Mu().silence();
        }
      };
    }
    // saturation : vrai ou faux
    const sat = Math.random() < 0.5;
    return {
      cat: 'oreille', lvl, type: 'tf', audio: true,
      q: 'Écoute la voix d’Inès. Elle sature ?', ok: sat,
      why: sat ? 'Oui : ça grésille sur les notes fortes. On baisse le gain.' : 'Non, elle est propre : les crêtes restent sous 0 dBFS.',
      play: () => { Mu().direct([{ id: 'v', type: 'voix', db: -2, peak: sat ? 12 : -10 }], 'duo'); return () => Mu().silence(); }
    };
  }
  function audioSet(n) {
    const kinds = ['band', 'mix', 'missing', 'sat'];
    const out = [];
    for (let i = 0; i < n; i++) out.push(audioQuestion(kinds[i % kinds.length], 1 + Math.floor(i / 3)));
    return shuffle(out);
  }

  // ------------------------------------------------------------ Les modes
  const MODES = [
    { id: 'rapide', name: 'Partie rapide', desc: '10 questions, 20 secondes chacune', icon: 'bolt' },
    { id: 'theme', name: 'Par thème', desc: 'Micros, console, larsen, retours…', icon: 'grid' },
    { id: 'oreille', name: 'Oreille d’or', desc: 'Des questions à écouter (son nécessaire)', icon: 'ear' },
    { id: 'chrono', name: 'Chrono', desc: 'Un maximum de bonnes réponses en 60 secondes', icon: 'clock' },
    { id: 'survie', name: 'Survie', desc: '3 vies, ça devient de plus en plus dur', icon: 'heart' }
  ];
  const SVG = {
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    ear: '<path d="M7 9a5 5 0 1 1 10 0c0 3-3 4-3 7a3 3 0 0 1-6 0" fill="none" stroke-width="2.2"/><path d="M10 9a2 2 0 1 1 4 0" fill="none" stroke-width="2.2"/>',
    clock: '<circle cx="12" cy="13" r="8" fill="none" stroke-width="2.2"/><path d="M12 9v4l3 2M9 2h6" fill="none" stroke-width="2.2"/>',
    heart: '<path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z"/>'
  };
  function svgIcon(name, cls) {
    const s = h('span', { class: 'qz-ic ' + (cls || ''), 'aria-hidden': 'true' });
    s.innerHTML = '<svg viewBox="0 0 24 24">' + SVG[name] + '</svg>';
    return s;
  }

  const Q = {
    game: null, run: null, timer: 0, stopSound: null,

    init(game) { this.game = game; Profil.paint(); },
    show() { if (!this.run) this.renderHub(); },
    leave() { this.stopAll(); },
    stopAll() {
      if (this.timer) cancelAnimationFrame(this.timer);
      this.timer = 0;
      if (this.stopSound) { try { this.stopSound(); } catch (e) { /* ignore */ } this.stopSound = null; }
    },

    // ------------------------------------------------------------ L’accueil du quiz
    renderHub() {
      this.stopAll();
      this.run = null;
      const el = $('view-quiz');
      el.innerHTML = '';
      const d = Profil.data();
      const L = Profil.level(d.xp);
      el.appendChild(h('div', { class: 'qz-profile' },
        h('div', { class: 'qz-lv' }, h('span', null, String(L.n))),
        h('div', { class: 'qz-lv-main' },
          h('span', { class: 'qz-eyebrow' }, 'Niveau ' + L.n),
          h('b', null, L.name),
          h('div', { class: 'qz-xpbar' }, h('i', { style: 'width:' + Math.round(L.p * 100) + '%' })),
          h('span', { class: 'qz-xptxt' }, d.xp + ' XP · prochain niveau à ' + L.next))));
      el.appendChild(h('h1', { class: 'qz-title' }, 'Le jeu des questions'));
      const grid = h('div', { class: 'qz-modes' });
      for (const m of MODES) {
        const best = d.best[m.id];
        const b = h('button', { class: 'qz-mode qz-mode-' + m.id }, svgIcon(m.icon), h('span', { class: 'qz-mode-main' }, h('b', null, m.name), h('span', null, m.desc)), best != null ? h('span', { class: 'qz-best' }, 'record ' + best) : null);
        b.addEventListener('click', () => {
          if (m.id === 'theme') this.renderThemes();
          else this.start(m.id);
        });
        grid.appendChild(b);
      }
      el.appendChild(grid);
      el.appendChild(h('h2', { class: 'qz-sub' }, 'Tes badges'));
      const bg = h('div', { class: 'qz-badges' });
      for (const id in BADGES) {
        const got = d.badges.includes(id);
        bg.appendChild(h('div', { class: 'qz-badge' + (got ? ' got' : ''), title: BADGES[id].desc }, h('span', { class: 'qz-badge-medal' }, got ? '★' : '?'), h('b', null, BADGES[id].name), h('span', null, BADGES[id].desc)));
      }
      el.appendChild(bg);
      el.appendChild(h('div', { class: 'pc-toasts', id: 'qz-toasts', 'aria-live': 'polite' }));
    },

    renderThemes() {
      const el = $('view-quiz');
      el.innerHTML = '';
      const d = Profil.data();
      el.appendChild(h('div', { class: 'pc-top' }, h('button', { class: 'pc-close', 'aria-label': 'Retour', onclick: () => this.renderHub() }, '‹'), h('span', { class: 'pc-title' }, 'Par thème')));
      el.appendChild(h('h1', { class: 'qz-title' }, 'Choisis un thème'));
      const list = h('div', { class: 'qz-themes' });
      for (const id in QB.CATS) {
        const c = QB.CATS[id];
        const st = d.cats[id];
        const pct = st && st.n ? Math.round(st.ok / st.n * 100) : null;
        const n = id === 'oreille' ? 'à l’écoute' : QB.Q.filter(q => q.cat === id).length + ' questions';
        const b = h('button', { class: 'qz-theme', style: '--c:' + c.color },
          h('span', { class: 'qz-theme-dot' }),
          h('span', { class: 'qz-mode-main' }, h('b', null, c.name), h('span', null, n)),
          h('span', { class: 'qz-ring', style: '--p:' + (pct || 0) }, h('span', null, pct == null ? '—' : pct + '%')));
        b.addEventListener('click', () => this.start(id === 'oreille' ? 'oreille' : 'theme', id));
        list.appendChild(b);
      }
      el.appendChild(list);
    },

    // ------------------------------------------------------------ Une partie
    start(mode, cat) {
      if (!A.ctx) { try { A.init(); this.game.syncSoundButton(); } catch (e) { /* son indisponible */ } }
      let list;
      const bank = QB.Q.slice();
      if (mode === 'rapide') {
        list = shuffle(bank).slice(0, 10).sort((a, b) => a.lvl - b.lvl);
        if (soundReady()) list.splice(6, 1, audioQuestion(['mix', 'band', 'missing'][Math.floor(Math.random() * 3)], 2));
      } else if (mode === 'theme') list = shuffle(bank.filter(q => q.cat === cat)).slice(0, 8).sort((a, b) => a.lvl - b.lvl);
      else if (mode === 'oreille') list = audioSet(8);
      else if (mode === 'chrono') list = shuffle(bank.filter(q => q.type === 'tf' || q.type === 'qcm'));
      else list = [1, 2, 3].flatMap(l => shuffle(bank.filter(q => q.lvl === l)));
      this.run = {
        mode, cat, list, i: 0, score: 0, ok: 0, done: 0, streak: 0, bestStreak: 0, lives: 3, mistakes: [],
        t0: performance.now(), chronoEnd: mode === 'chrono' ? performance.now() + 60000 : 0
      };
      if (mode === 'oreille' && !soundReady()) { this.needSound(); return; }
      this.renderQuestion();
    },

    needSound() {
      const el = $('view-quiz');
      el.innerHTML = '';
      el.appendChild(h('div', { class: 'qz-card' },
        h('h2', null, 'Il faut le son'),
        h('p', null, 'L’Oreille d’or se joue à l’écoute. Monte le volume, désactive le mode silencieux du téléphone, puis active le son.'),
        h('div', { class: 'pc-actions' },
          h('button', { class: 'primary', onclick: () => { if (!A.ctx) A.init(); else A.setEnabled(true); this.game.syncSoundButton(); this.renderQuestion(); } }, 'Activer le son'),
          h('button', { class: 'ghost', onclick: () => this.renderHub() }, 'Retour'))));
    },

    current() { return this.run.list[this.run.i]; },

    renderQuestion() {
      this.stopAll();
      const R = this.run;
      if (!R) return;
      if (R.mode === 'chrono' && performance.now() > R.chronoEnd) { this.finish(); return; }
      if (R.i >= R.list.length || (R.mode === 'survie' && R.lives <= 0)) { this.finish(); return; }
      const q = this.current();
      const el = $('view-quiz');
      el.innerHTML = '';
      // barre du haut : quitter, progression, combo, vies
      const top = h('div', { class: 'qz-top' },
        h('button', { class: 'pc-close', 'aria-label': 'Quitter', onclick: () => { this.stopAll(); this.run = null; this.renderHub(); } }, '×'),
        R.mode === 'chrono' ? h('div', { class: 'qz-chrono' }, h('i', { id: 'qz-chrono-bar' }))
          : R.mode === 'survie' ? h('div', { class: 'qz-lives', 'aria-label': R.lives + ' vies' }, [0, 1, 2].map(k => svgIcon('heart', k < R.lives ? 'on' : '')))
            : h('div', { class: 'pc-dots' }, R.list.map((_, k) => h('i', { class: k < R.i ? 'done' : k === R.i ? 'cur' : '' }))),
        h('span', { class: 'qz-score' }, String(R.score)),
        R.streak >= 3 ? h('span', { class: 'qz-combo' }, '×' + mult(R.streak)) : null);
      el.appendChild(top);
      const c = QB.CATS[q.cat];
      const card = h('div', { class: 'qz-card', style: '--c:' + c.color });
      card.appendChild(h('div', { class: 'qz-meta' }, h('span', { class: 'qz-chip' }, c.name), h('span', { class: 'qz-lvl' }, '★'.repeat(q.lvl) + '☆'.repeat(3 - q.lvl))));
      card.appendChild(h('h2', { class: 'qz-q' }, q.q));
      // chrono par question (pas en mode chrono global)
      const perQ = R.mode === 'rapide' || R.mode === 'survie' || R.mode === 'theme';
      const limit = q.type === 'order' ? 35 : q.audio ? 30 : 20;
      const ring = perQ ? h('div', { class: 'qz-timer' }, h('span', { id: 'qz-time' }, String(limit))) : null;
      if (ring) card.appendChild(ring);
      if (q.audio) {
        const replay = h('button', { class: 'qz-play' }, svgIcon('ear'), 'Réécouter');
        replay.addEventListener('click', () => { if (this.stopSound) this.stopSound(); this.stopSound = q.play(); });
        card.appendChild(replay);
        setTimeout(() => { if (this.current() === q) this.stopSound = q.play(); }, 250);
      }
      const answers = h('div', { class: 'qz-answers' });
      card.appendChild(answers);
      el.appendChild(card);
      el.appendChild(h('div', { class: 'pc-toasts', id: 'qz-toasts', 'aria-live': 'polite' }));
      const t0 = performance.now();
      let answered = false;
      const answer = (ok, chosenLabel) => {
        if (answered) return;
        answered = true;
        const secs = (performance.now() - t0) / 1000;
        this.onAnswer(q, ok, perQ ? Math.max(0, limit - secs) : 0, chosenLabel);
      };
      if (q.type === 'tf') {
        answers.classList.add('tf');
        [[true, 'Vrai'], [false, 'Faux']].forEach(([v, lab]) => {
          const b = h('button', { class: 'qz-a qz-tf ' + (v ? 'yes' : 'no') }, lab);
          b.addEventListener('click', () => { mark(b, v === q.ok); if (v !== q.ok) answers.querySelectorAll('button')[q.ok ? 0 : 1].classList.add('good'); answer(v === q.ok, lab); });
          answers.appendChild(b);
        });
      } else if (q.type === 'order') {
        const picked = [];
        const shuffled = shuffle(q.items.map((t, k) => ({ t, k })));
        const list = h('div', { class: 'qz-order' });
        const reset = h('button', { class: 'btn-text' }, 'Recommencer');
        shuffled.forEach(it => {
          const b = h('button', { class: 'qz-a qz-ord' }, h('span', { class: 'qz-ord-n' }, ''), h('span', null, it.t));
          b.addEventListener('click', () => {
            if (b.disabled) return;
            picked.push(it.k); b.disabled = true; b.classList.add('picked');
            b.querySelector('.qz-ord-n').textContent = String(picked.length);
            if (picked.length === q.items.length) {
              const ok = picked.every((k, n) => k === n);
              list.querySelectorAll('button').forEach((x, n) => x.classList.add(shuffled[n].k === picked.indexOf(shuffled[n].k) ? 'good' : 'bad'));
              answer(ok, picked.map(k => q.items[k]).join(' → '));
            }
          });
          list.appendChild(b);
        });
        reset.addEventListener('click', () => { if (answered) return; picked.length = 0; list.querySelectorAll('button').forEach(x => { x.disabled = false; x.classList.remove('picked'); x.querySelector('.qz-ord-n').textContent = ''; }); });
        answers.append(h('p', { class: 'qz-hint' }, 'Touche les étapes dans l’ordre.'), list, reset);
      } else {
        const order = shuffle(q.a.map((_, k) => k));
        if (q.type === 'pic') answers.classList.add('pic');
        order.forEach(k => {
          const opt = q.a[k];
          const b = h('button', { class: 'qz-a' }, typeof opt === 'object' ? root.SonoParcours.icon(opt.icon) : null, h('span', null, typeof opt === 'object' ? opt.label : opt));
          b.addEventListener('click', () => {
            mark(b, k === q.ok);
            if (k !== q.ok) answers.querySelectorAll('button')[order.indexOf(q.ok)].classList.add('good');
            answer(k === q.ok, typeof opt === 'object' ? opt.label : opt);
          });
          answers.appendChild(b);
        });
      }
      function mark(b, ok) { b.classList.add(ok ? 'good' : 'bad'); answers.querySelectorAll('button').forEach(x => { x.disabled = true; }); }
      // horloge
      const tick = () => {
        if (answered || !this.run) return;
        const now = performance.now();
        if (R.mode === 'chrono') {
          const left = Math.max(0, R.chronoEnd - now);
          const bar = $('qz-chrono-bar');
          if (bar) bar.style.width = (left / 600) + '%';
          if (left <= 0) { answered = true; this.finish(); return; }
        } else if (perQ) {
          const left = Math.max(0, limit - (now - t0) / 1000);
          const tEl = $('qz-time');
          if (tEl) { tEl.textContent = String(Math.ceil(left)); ring.style.setProperty('--p', left / limit); ring.classList.toggle('hurry', left < 5); }
          if (left <= 0) {
            answers.querySelectorAll('button').forEach(x => { x.disabled = true; });
            if (q.type !== 'order') {
              const all = answers.querySelectorAll('.qz-a');
              if (q.type === 'tf') all[q.ok ? 0 : 1].classList.add('good');
            }
            answer(false, 'temps écoulé');
            return;
          }
        }
        this.timer = requestAnimationFrame(tick);
      };
      this.timer = requestAnimationFrame(tick);
    },

    onAnswer(q, ok, timeLeft, chosen) {
      const R = this.run;
      if (this.timer) cancelAnimationFrame(this.timer);
      R.done++;
      if (q.cat) Profil.catStat(q.cat, ok);
      let gained = 0;
      if (ok) {
        R.ok++; R.streak++; R.bestStreak = Math.max(R.bestStreak, R.streak);
        gained = Math.round((100 * q.lvl + timeLeft * 5) * mult(R.streak));
        R.score += gained;
        if (R.streak === 5 || R.streak === 10) U.confetti(R.streak === 10 ? 160 : 70);
        if (R.streak >= 10) Profil.award('combo');
      } else {
        R.streak = 0;
        if (R.mode === 'survie') R.lives--;
        R.mistakes.push({ q, chosen });
      }
      if (R.mode === 'chrono') { R.i++; setTimeout(() => this.renderQuestion(), ok ? 350 : 900); this.flash(ok, gained); return; }
      const box = h('div', { class: 'pc-feedback ' + (ok ? 'ok' : 'ko'), role: 'status' },
        h('div', { class: 'pc-fb-main' },
          h('b', null, ok ? (R.streak >= 3 ? 'Série de ' + R.streak + ' ! +' + gained : pickOne(['Bien joué !', 'Exact !', 'Bravo !']) + ' +' + gained) : (chosen === 'temps écoulé' ? 'Temps écoulé…' : 'Raté…')),
          h('p', null, q.why)),
        h('button', { class: 'primary', onclick: () => { box.remove(); if (this.stopSound) { this.stopSound(); this.stopSound = null; } R.i++; this.renderQuestion(); } }, R.mode === 'survie' && !ok && R.lives <= 0 ? 'Voir mon score' : 'Continuer'));
      $('view-quiz').appendChild(box);
      box.querySelector('button').focus();
      vibrate(ok ? 15 : [30, 40, 30]);
    },

    flash(ok, gained) {
      const f = h('div', { class: 'qz-flash ' + (ok ? 'ok' : 'ko') }, ok ? '+' + gained : '✗');
      document.body.appendChild(f);
      setTimeout(() => f.remove(), 700);
    },

    finish() {
      this.stopAll();
      const R = this.run;
      const el = $('view-quiz');
      el.innerHTML = '';
      const acc = R.done ? Math.round(R.ok / R.done * 100) : 0;
      const xp = Math.round(R.score / 10) + R.ok * 5;
      const record = Profil.best(R.mode, R.mode === 'chrono' || R.mode === 'survie' ? R.ok : R.score);
      Profil.award('premier');
      if (R.mode === 'rapide' && R.ok === R.list.length) Profil.award('sansfaute');
      if (R.mode === 'oreille' && R.ok === R.list.length) Profil.award('oreille');
      if (R.mode === 'survie' && R.ok >= 15) Profil.award('survivant');
      if (R.mode === 'chrono' && R.ok >= 20) Profil.award('eclair');
      const before = Profil.data().xp;
      Profil.add(xp);
      const L = Profil.level(before + xp);
      const verdict = acc >= 90 ? 'Impressionnant. Tu pourrais former Marc.' : acc >= 70 ? 'Solide ! Encore un peu et c’est parfait.' : acc >= 50 ? 'Pas mal. Regarde tes erreurs ci-dessous, c’est là qu’on progresse.' : 'On reprend tranquillement : les fiches et les leçons t’attendent.';
      const card = h('div', { class: 'qz-card qz-end' },
        h('span', { class: 'qz-eyebrow' }, MODES.find(m => m.id === R.mode).name + (R.cat ? ' · ' + QB.CATS[R.cat].name : '')),
        h('div', { class: 'qz-bigscore' }, h('b', null, String(R.score)), h('span', null, 'points')),
        h('div', { class: 'qz-stats' },
          h('div', null, h('b', null, R.ok + '/' + R.done), h('span', null, 'bonnes réponses')),
          h('div', null, h('b', null, acc + ' %'), h('span', null, 'de réussite')),
          h('div', null, h('b', null, '×' + mult(R.bestStreak)), h('span', null, 'meilleure série : ' + R.bestStreak))),
        record ? h('p', { class: 'qz-record' }, 'Nouveau record !') : null,
        h('div', { class: 'qz-xpgain' }, h('span', null, '+' + xp + ' XP'), h('div', { class: 'qz-xpbar' }, h('i', { style: 'width:' + Math.round(L.p * 100) + '%' })), h('span', null, 'Niveau ' + L.n + ' · ' + L.name)),
        root.SonoGame.line('jerome', verdict),
        h('div', { class: 'pc-actions' },
          h('button', { class: 'primary', onclick: () => this.start(R.mode, R.cat) }, 'Rejouer'),
          h('button', { class: 'ghost', onclick: () => { this.run = null; this.renderHub(); } }, 'Autres modes')));
      el.appendChild(card);
      if (R.mistakes.length) {
        el.appendChild(h('h2', { class: 'qz-sub' }, 'À revoir'));
        const list = h('ol', { class: 'qz-review' });
        for (const m of R.mistakes.slice(0, 12)) {
          const right = m.q.type === 'tf' ? (m.q.ok ? 'Vrai' : 'Faux') : m.q.type === 'order' ? m.q.items.join(' → ') : (typeof m.q.a[m.q.ok] === 'object' ? m.q.a[m.q.ok].label : m.q.a[m.q.ok]);
          list.appendChild(h('li', null, h('b', null, m.q.q), h('span', { class: 'qz-right' }, 'Réponse : ' + right), h('span', { class: 'muted' }, m.q.why)));
        }
        el.appendChild(list);
      }
      el.appendChild(h('div', { class: 'pc-toasts', id: 'qz-toasts', 'aria-live': 'polite' }));
      if (acc >= 70) U.confetti(acc >= 90 ? 180 : 90);
      if (A.ctx && A.enabled) A.applause(acc >= 70 ? 3 : 1.2);
      this.run = null;
    }
  };

  function mult(streak) { return streak >= 10 ? 3 : streak >= 6 ? 2 : streak >= 3 ? 1.5 : 1; }
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }
  function vibrate(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* non disponible */ } }

  root.SonoQuiz = Q;
  root.SonoProfil = Profil;
  Q.BADGES = BADGES;
})(this);
