/* Sono Sim — fonctionne sans réseau (le jour J, la salle n’a pas toujours de wifi). */
const CACHE = 'sonosim-v4';
const FILES = ['./', './index.html', './css/style.css', './manifest.webmanifest', './icon.svg',
  './js/data.js', './js/engine.js', './js/state.js', './js/audio.js', './js/music.js', './js/ui.js', './js/stage.js',
  './js/salle.js', './js/parcours.js', './js/mixer.js', './js/learn.js', './js/questions.js', './js/quiz.js', './js/coach.js', './js/game.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // réseau d’abord (mises à jour), cache si pas de réseau
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
