// Rend la musique calée sur les repères du tournage → music.wav
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/node-tools/node_modules/playwright'); } })();
const fs = require('fs'), path = require('path');
(async () => {
  const M = JSON.parse(fs.readFileSync(path.join(__dirname, 'marks.json')));
  const at = (n) => M.marks.find(m => m.name === n).t;
  const sec = { problem: at('probleme') - 2.2, demo: at('brief') - 2.4, benefits: at('benefices') - 7.4, outro: at('fin') - 3.2, end: M.duration };
  console.log(sec);
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('http://localhost:8765/outils/video/music.html');
  const r = await p.evaluate((s) => render(s), sec);
  fs.writeFileSync(path.join(__dirname, 'music.wav'), Buffer.from(r.b64, 'base64'));
  console.log('pic', r.peak.toFixed(2));
  await b.close();
})();
