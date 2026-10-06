# Vidéo de présentation

La vidéo de présentation de Sono Sim (2 min 20, 1080p) est filmée directement dans l’appli :
le script ouvre l’appli dans un cadre d’ordinateur et de téléphone, joue les actions (poser un micro au pupitre,
lever le rideau, provoquer un larsen…), filme l’écran, compose une musique originale calée sur les plans, puis assemble le tout.

```
./outils/video/tourner.sh            # → outils/video/sono-sim-presentation.mp4
```

Il faut Node 18+, Playwright avec Chromium, et ffmpeg. Compter environ 5 minutes.

| Fichier | Rôle |
| --- | --- |
| `stage.html` | La mise en scène : titres, légendes, cadres ordinateur et téléphone, curseur, écrans de fin |
| `record.js` | Le scénario : ce qui se passe à l’écran, plan par plan, et le tournage |
| `music.html`, `music.js` | La musique de fond, synthétisée et calée sur les repères du tournage |
| `build.sh` | L’assemblage final avec ffmpeg |
| `fonts/` | Les polices de l’appli en local (Barlow, Barlow Condensed, JetBrains Mono : OFL ; Permanent Marker : Apache 2.0) |

Pour changer un texte, modifier les appels `P.cap(...)`, `P.problem(...)` et `P.lower(...)` dans `record.js`,
ou les écrans fixes (titre, bénéfices, fin) dans `stage.html`. `node outils/video/record.js --shots` (serveur lancé)
enregistre une capture de contrôle à chaque repère.
