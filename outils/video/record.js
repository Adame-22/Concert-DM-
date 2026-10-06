// Tournage de la vidéo de présentation : pilote stage.html (mise en scène) et l’appli dans ses cadres,
// filme l’écran en continu (CDP screencast) et écrit frames/ + frames.txt (pour ffmpeg) + marks.json (repères de la musique).
// Lancer via ./tourner.sh (qui démarre le serveur local). `--shots` : captures de contrôle shot-*.png à chaque repère.
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/node-tools/node_modules/playwright'); } })();
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'frames');
const SHOTS = process.argv.includes('--shots'); // captures de contrôle seulement
const ROOT = 'http://localhost:8765/';           // serveur lancé à la racine du dépôt (voir tourner.sh)
const BASE = ROOT + 'outils/video/';

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT);
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, ignoreHTTPSErrors: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('sonosim.tourDone', 'true'); localStorage.setItem('sonosim.parcours', '{}'); } catch (e) {} });
  // polices : copie locale des Google Fonts (pas de dépendance au réseau pendant le tournage)
  const LOCAL_CSS = fs.readFileSync(path.join(__dirname, 'fonts', 'local.css'), 'utf8');
  await ctx.route(/fonts\.googleapis\.com/, (rt) => rt.fulfill({ status: 200, contentType: 'text/css', body: LOCAL_CSS }));
  await ctx.route(/fonts\.gstatic\.com/, (rt) => rt.abort());
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + 'stage.html');
  await p.evaluate(() => document.fonts.ready);
  const sleep = (ms) => p.waitForTimeout(ms);

  // ---------- préparation (hors caméra : le fondu noir est actif)
  await p.evaluate(() => { document.getElementById('app').src = '../../index.html#concert'; document.getElementById('phoneapp').src = '../../index.html#parcours'; });
  await sleep(2500);
  let app = p.frames().find(f => f.url().includes('index.html#concert'));
  const phone = p.frames().find(f => f.url().includes('index.html#parcours'));
  const FONTS = ['400 20px Barlow', '500 20px Barlow', '600 20px Barlow', '500 20px "Barlow Condensed"', '600 20px "Barlow Condensed"', '700 20px "Barlow Condensed"', '800 20px "Barlow Condensed"', '20px "Permanent Marker"', '400 20px "JetBrains Mono"', '600 20px "JetBrains Mono"'];
  const loadFonts = async (fr) => fr.evaluate(async (F) => { await Promise.all(F.map(f => document.fonts.load(f).catch(() => null))); await document.fonts.ready; return [...document.fonts].filter(f => f.status === 'error').length; }, FONTS);
  console.log('polices en erreur', await loadFonts(p.mainFrame()), await loadFonts(app), await loadFonts(phone));
  // outil de réglage automatique (même méthode que les tests du moteur)
  const helpers = () => {
    window.__setGain = (ch, target) => {
      const st = SonoGame.state;
      for (let k = 0; k < 3; k++) { const l = SonoEngine.computeLevels(st)[ch]; st.channels[ch].gain = Math.max(0, Math.min(60, st.channels[ch].gain + (target - l.avg))); }
    };
    window.__solveProfs = () => {
      const G = SonoGame, S = SonoState, st = G.state;
      [['km184', 'flute'], ['km184', 'violon'], ['c414', 'piano'], ['di_act', 'guitare_folk']].forEach(([t, s]) => S.addMic(st, t, s));
      st.sources.forEach(s => { s.playing = true; s.dyn = 0; });
      st.mics.forEach(m => { if (SonoData.MICS[m.type].phantom) st.channels[m.ch].phantom = true; st.channels[m.ch].hpf = true; });
      st.mics.forEach(m => window.__setGain(m.ch, -20));
      [-6, -6, -8, -8].forEach((f, k) => { st.channels[k].fader = f; });
      const w = S.addWedge(st, 3.8, 4.7, 0).wedge; w.angle = -Math.PI / 2;
      st.channels[2].sends[0] = -4;
      SonoSalle.finishInstalls && SonoSalle.finishInstalls();
      SonoMixer.refresh(); G.stageChanged(true);
    };
  };
  await app.evaluate(helpers);

  // image floutée de la salle pour le fond du « problème »
  await app.evaluate(() => { SonoGame.closeModal(); SonoGame.gotoScene(3); SonoGame.closeModal(); window.__solveProfs(); SonoGame.startShow(); });
  await p.evaluate(() => { P.layer('demo'); });
  await sleep(2500);
  await p.evaluate(() => { document.getElementById('fade').style.transition = 'none'; P.fade(false); });
  await sleep(200);
  await p.locator('#device .screen').screenshot({ path: path.join(__dirname, 'salle.jpg'), quality: 90, type: 'jpeg' });
  await p.evaluate(() => { P.fade(true); });
  await sleep(100);
  await p.evaluate(() => { document.getElementById('fade').style.transition = ''; });
  await p.evaluate(() => { P.layer(null); P.problemShot('salle.jpg'); });
  await app.goto(ROOT + 'index.html?prise=2#concert');
  await sleep(1500);
  await app.evaluate(helpers);
  await loadFonts(app);
  await sleep(500);

  // ---------- conversion de coordonnées : appli → page
  async function toPage(frameSel, pt) {
    const r = await p.evaluate((s) => { const e = document.querySelector(s).getBoundingClientRect(); return { l: e.left, t: e.top, w: e.width }; }, frameSel);
    const base = frameSel === '#app' ? 1440 : 390;
    const k = r.w / base;
    return { x: r.l + pt.x * k, y: r.t + pt.y * k };
  }
  async function elPt(frame, sel) {
    return frame.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
  }
  async function hitPt(kind, id) {
    return app.evaluate(([k, i]) => { const cv = document.getElementById('salle'); const h = SonoSalle.hits.find(x => x.kind === k && x.id === i); if (!h) return null; const r = cv.getBoundingClientRect(); return { x: r.left + (h.x0 + h.x1) / 2, y: r.top + (h.y0 + h.y1) / 2 }; }, [kind, id]);
  }
  async function moveTo(pt, finger, wait = 850) { await p.evaluate(([x, y, f]) => P.cursor(x, y, f), [pt.x, pt.y, !!finger]); await sleep(wait); }
  async function tapEl(frame, frameSel, sel, finger) {
    const pt = await elPt(frame, sel);
    if (!pt) { console.log('introuvable', sel); return; }
    await moveTo(await toPage(frameSel, pt), finger);
    await p.evaluate(() => P.click());
    await frame.evaluate((s) => document.querySelector(s).click(), sel);
  }
  const findOpt = (frame, sel, text) => frame.evaluate(([s, t]) => { const all = [...document.querySelectorAll(s)]; const i = all.findIndex(e => e.textContent.includes(t)); if (i >= 0) all[i].setAttribute('data-pick', '1'); return i; }, [sel, text]);

  // ---------- caméra
  const cdp = await ctx.newCDPSession(p);
  const frames = [];
  let t0 = null;
  cdp.on('Page.screencastFrame', (f) => {
    const t = f.metadata.timestamp; if (t0 == null) t0 = t;
    const file = 'f' + String(frames.length).padStart(5, '0') + '.jpg';
    fs.writeFileSync(path.join(OUT, file), Buffer.from(f.data, 'base64'));
    frames.push({ file, t: t - t0 });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  const marks = [];
  const mark = async (name) => { marks.push({ name, t: frames.length ? frames[frames.length - 1].t : 0 }); if (SHOTS) await p.screenshot({ path: path.join(__dirname, 'shot-' + name + '.png') }); };
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  await sleep(300);

  // 1. Titre
  await p.evaluate(() => { P.title(); P.fade(false); });
  await sleep(2600); await mark('titre'); await sleep(3600);

  // 2. Le problème
  await p.evaluate(() => { P.layer('problem'); P.problem('Un concert, ça se joue aussi <em>à la régie son.</em><small>Micros, retours, larsen : si le son ne suit pas, c’est toute la soirée qui en pâtit.</small>'); });
  await sleep(2200); await mark('probleme'); await sleep(3200);
  await p.evaluate(() => P.problem('Et le son, ça s’apprend <em>souvent sur le tas.</em><small>Le soir même, sans droit à l’erreur.</small>'));
  await sleep(5200);
  await p.evaluate(() => P.problem('Et si on pouvait <em>s’entraîner avant&nbsp;?</em><small>Sans matériel, sans salle, sans risque.</small>'));
  await sleep(4600);

  // 3. Le concert : le discours au pupitre (briefing fermé hors champ)
  await app.evaluate(() => { SonoGame.closeModal(); SonoGame.setSideTab('scene'); });
  await p.evaluate(() => { P.layer('demo'); P.cap('Le concert', 1, 'Un concert entier, <em>en répétition</em>', '<b>6 plateaux</b>, du discours d’ouverture au grand final : voix, chorale, piano, guitares, groupe rock.'); });
  await sleep(2400); await mark('brief'); await sleep(2600);
  await tapEl(app, '#app', '.side-tabs [data-tab="valise"]');
  await sleep(900);
  await p.evaluate(() => P.cap('Le concert', 1, 'Un discours au pupitre : <em>quel micro&nbsp;?</em>', 'On le choisit dans la valise, on désigne la personne : <b>le technicien l’installe sous tes yeux.</b>'));
  await sleep(1200);
  await tapEl(app, '#app', '.case-item[data-type="col"]');
  await sleep(700);
  await mark('arme');
  const chr = await hitPt('source', 'parole');
  if (chr) { await moveTo(await toPage('#app', chr)); await p.evaluate(() => P.click()); }
  await app.evaluate(() => SonoGame.attachMic('col', 'parole'));
  await sleep(1800); await mark('install'); await sleep(2200);
  // console : 48 V, puis réglages
  const chC = await app.evaluate(() => SonoGame.state.mics[0].ch);
  console.log('voie de Christine', chC + 1);
  await app.evaluate((c) => SonoMixer.showChannel(c), chC);
  await tapEl(app, '#app', `.strip[data-ch="${chC}"] .btn-48`);
  await sleep(700);
  await app.evaluate((c) => { const st = SonoGame.state; st.mics.forEach(m => { m.dist = 15; }); st.channels[c].hpf = true; st.sources.forEach(s => { s.playing = true; s.dyn = 0; }); window.__setGain(c, -20); st.channels[c].fader = -12; SonoMixer.refresh(); SonoGame.sideDirty = true; SonoGame.stageDirty = true; }, chC);
  await sleep(900);
  await tapEl(app, '#app', '#btn-phase');
  await p.evaluate(() => P.cap('Le concert', 1, 'Rideau&nbsp;! <em>La salle réagit</em> en direct', 'Le public, les musiciens, les mentors au talkie : <b>chaque réglage a un effet visible.</b>'));
  await moveTo({ x: 1700, y: 1150 }, false, 300);
  await sleep(2600); await mark('rideau'); await sleep(3200);

  // 4. Les profs, de près
  await app.evaluate(() => { SonoGame.abortShow(); SonoGame.closeModal(); SonoGame.state.mics.slice().forEach(m => SonoState.removeMic(SonoGame.state, m.uid)); SonoGame.gotoScene(3); SonoGame.closeModal(); window.__solveProfs(); SonoGame.startShow(); SonoGame.show.t = 37.5; SonoGame.show.fired.add(0); SonoGame.show.fired.add(1); document.getElementById('toasts').innerHTML = ''; });
  await p.evaluate(() => { P.capHide(true); P.device('translate(12px,-205px) scale(1.5)'); P.lower('Flûte, violon, guitare et piano : <b>chaque instrument a son micro</b>, chaque musicien son retour.'); });
  await sleep(3000); await mark('profs'); await sleep(4600);
  await p.evaluate(() => P.lower('Chaque morceau suit son <b>conducteur</b> : qui joue, quand ouvrir et couper chaque micro.'));
  await sleep(4400);

  // 5. Le larsen
  await p.evaluate(() => { P.lower(null); P.device(''); P.capHide(false); P.cap('Le larsen', 2, 'Le larsen, <em>comme en vrai</em>', 'Il dépend de la place des micros, des retours et des réglages. <b>On le provoque, puis on apprend à l’éviter.</b>'); });
  await sleep(1800);
  await app.evaluate(() => SonoMixer.showChannel(0));
  const fpt = await elPt(app, '.strip[data-ch="0"] .fader');
  await app.evaluate(() => { document.scrollingElement.scrollTo({ top: 0 }); });
  await moveTo({ x: 1700, y: 1150 }, false, 200);
  // on pousse le micro de la flûte vers le retour et on monte : ça siffle
  await app.evaluate(() => { const c = SonoGame.state.channels[0]; window.__bak = { gain: c.gain, fader: c.fader, sends: c.sends.slice() }; });
  for (let k = 0; k < 14; k++) {
    await app.evaluate((k) => { const st = SonoGame.state; const c = st.channels[0]; c.gain = Math.min(60, c.gain + 1.6); c.fader = Math.min(10, c.fader + 1.4); c.sends[0] = Math.min(10, c.sends[0] + 2); SonoMixer.refresh(); }, k);
    await sleep(160);
    if (await app.evaluate(() => SonoGame.fx.larsenOn)) break;
  }
  await sleep(1400); await mark('larsen'); await sleep(2600);
  await app.evaluate(() => { const st = SonoGame.state; const c = st.channels[0]; c.mute = true; SonoMixer.refresh(); });
  await p.evaluate(() => P.cap('Le larsen', 2, 'Couper, <em>puis comprendre</em>', 'Les mentors expliquent ce qui a sifflé, sur quelle fréquence, et comment le corriger.'));
  await sleep(1500);
  await app.evaluate(() => { const c = SonoGame.state.channels[0]; const b = window.__bak; c.gain = b.gain; c.fader = b.fader; c.sends = b.sends.slice(); c.mute = false; SonoMixer.refresh(); });
  await sleep(3600);

  // 6. La console 48 voies
  await app.evaluate(() => { SonoGame.abortShow(); SonoGame.closeModal(); document.getElementById('toasts').innerHTML = ''; });
  await p.evaluate(() => P.cap('La console', 3, 'Une vraie table <em>48 voies</em>', 'Gain, 48 V, coupe-bas, égaliseur, façade et <b>4 retours</b> : les mêmes gestes que le soir du concert.'));
  await app.evaluate(() => { const c = document.getElementById('console'); window.scrollTo({ top: c.getBoundingClientRect().top + window.scrollY - 60, behavior: 'smooth' }); });
  await sleep(1800); await mark('console');
  await tapEl(app, '#app', '.bank-bar .bank-btn:nth-child(3)'); await sleep(900);
  await tapEl(app, '#app', '.bank-bar .bank-btn:nth-child(4)'); await sleep(900);
  await tapEl(app, '#app', '.bank-bar .bank-btn:nth-child(2)'); await sleep(700);
  await tapEl(app, '#app', '.layer-btn[data-layer="0"]'); await sleep(1600);
  await tapEl(app, '#app', '.layer-btn[data-layer="main"]');
  await sleep(1200);

  // 7. Sur téléphone : les leçons
  await moveTo({ x: 1700, y: 1150 }, true, 200);
  await p.evaluate(() => { P.devShow(false); P.phoneShow(true); P.cap('Apprendre', 4, 'Dans la poche, <em>2 minutes par leçon</em>', '7 mini-leçons sur téléphone, une notion à la fois, avec deux mentors qui guident.', ['Choisir le bon micro', 'Brancher, et le piège du 48 V', 'Régler le gain', 'Placer les retours', 'Comprendre et stopper le larsen'], true); });
  await sleep(2400); await mark('lecons');
  await tapEl(phone, '#phoneapp', '.pc-node.next', true); await sleep(900);
  await tapEl(phone, '#phoneapp', '.pc-go', true); await sleep(1600);
  if (await findOpt(phone, '.pc-opt', 'Micro chant') >= 0) { await tapEl(phone, '#phoneapp', '.pc-opt[data-pick]', true); }
  await sleep(1600); await mark('lecon-ok'); await sleep(1600);

  // 8. Le quiz
  await phone.evaluate(() => { SonoGame.switchView('quiz'); window.scrollTo(0, 0); });
  await p.evaluate(() => P.cap('Le quiz', 5, 'Un quiz qui donne <em>envie de rejouer</em>', 'Niveaux, badges, défi chrono, survie… et l’<b>Oreille d’or</b> : reconnaître l’instrument qui manque ou la voix qui sature.', null, true));
  await sleep(1500);
  await tapEl(phone, '#phoneapp', '.qz-mode-rapide', true); await sleep(1400);
  const q = await phone.evaluate(() => { const q = SonoQuiz.current(); return { type: q.type, ok: q.ok, a: q.a }; });
  if (q.type === 'tf') await tapEl(phone, '#phoneapp', q.ok ? '.qz-tf.yes' : '.qz-tf.no', true);
  else if (q.type !== 'order') { const lab = typeof q.a[q.ok] === 'object' ? q.a[q.ok].label : q.a[q.ok]; await findOpt(phone, '.qz-a', lab); await tapEl(phone, '#phoneapp', '.qz-a[data-pick]', true); }
  await sleep(1500); await mark('quiz'); await sleep(2400);

  // 9. Le coach dans l'atelier
  await moveTo({ x: 1700, y: 1150 }, false, 200);
  await app.evaluate(() => { window.scrollTo(0, 0); SonoGame.switchView('atelier'); });
  await sleep(300);
  await app.evaluate(() => { SonoGame.setSideTab('scene'); SonoCoach.startMission(SonoCoach.MISSIONS[0]); });
  await p.evaluate(() => { P.phoneShow(false); P.devShow(true); P.cap('Le coach', 6, 'Jamais <em>seul</em> devant la table', 'Visite guidée, missions pas à pas, et le bouton <b style="white-space:nowrap">«&nbsp;Explique-moi&nbsp;»</b> : on touche, on comprend.'); });
  await sleep(1600);
  await tapEl(app, '#app', '.spot-bubble .primary');
  await sleep(1600); await mark('mission'); await sleep(900);
  await tapEl(app, '#app', '.side-tabs [data-tab="valise"]');
  await sleep(2200);
  await app.evaluate(() => { SonoCoach.stopMission && SonoCoach.stopMission(); });
  await tapEl(app, '#app', '#btn-explain'); await sleep(900);
  await app.evaluate(() => { const c = document.getElementById('console'); window.scrollTo({ top: c.getBoundingClientRect().top + window.scrollY - 140, behavior: 'smooth' }); });
  await sleep(1100);
  const b48 = await elPt(app, '.strip[data-ch="1"] .btn-48');
  await moveTo(await toPage('#app', b48)); await p.evaluate(() => P.click());
  await app.evaluate(() => { const e = document.querySelector('.strip[data-ch="1"] .btn-48'); const r = e.getBoundingClientRect(); e.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + 5, clientY: r.top + 5 })); });
  await sleep(1800); await mark('explique'); await sleep(2800);

  // 10. Ce que ça apporte
  await moveTo({ x: 1700, y: 1150 }, false, 200);
  await p.evaluate(() => P.benefits());
  await sleep(7400); await mark('benefices'); await sleep(4600);

  // 11. Fin
  await p.evaluate(() => P.outro());
  await sleep(3200); await mark('fin'); await sleep(3800);
  await p.evaluate(() => P.fade(true));
  await sleep(1400);

  await cdp.send('Page.stopScreencast');
  await sleep(300);
  const end = frames[frames.length - 1].t + 0.04;
  let txt = '';
  frames.forEach((f, i) => { const d = (i + 1 < frames.length ? frames[i + 1].t : end) - f.t; txt += `file '${path.join(OUT, f.file)}'\nduration ${Math.max(0.001, d).toFixed(4)}\n`; });
  txt += `file '${path.join(OUT, frames[frames.length - 1].file)}'\n`;
  fs.writeFileSync(path.join(__dirname, 'frames.txt'), txt);
  fs.writeFileSync(path.join(__dirname, 'marks.json'), JSON.stringify({ marks, duration: end }, null, 1));
  console.log('images', frames.length, 'durée', end.toFixed(1), 's, fps moyen', (frames.length / end).toFixed(1));
  console.log('erreurs', errs);
  await b.close();
})();
