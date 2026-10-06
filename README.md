# Sono Sim

Simulateur pédagogique pour apprendre à sonoriser un concert : choisir et placer les micros,
régler les gains, placer les retours, éviter le larsen, équilibrer le mix pour le public.

## Lancer

Aucune installation : ouvre `index.html` dans Chrome, Firefox, Safari ou Edge (double-clic).
Clique sur **Activer le son** en haut pour entendre les larsens, les saturations et les exercices d’oreille.

Sur téléphone, commence par l’onglet **Apprendre**. Le concert complet (console 48 voies, vue salle) est fait pour un ordinateur ou une tablette.

## Ce qu’il y a dedans

| Onglet | À quoi ça sert |
| --- | --- |
| **Apprendre** | Le point de départ, pensé pour le téléphone : 7 mini-leçons de 2 minutes, une notion à la fois (le bon micro, brancher et le 48 V, le gain, placer les retours, le larsen, ouvrir et couper au bon moment, le mélange). Gros boutons, Jérôme et Marc qui guident, des étoiles à gagner. Le larsen et les retours y sont calculés avec le vrai moteur physique. |
| **Le concert** | Les 6 plateaux de la soirée : mot d’accueil, chorale + soliste + piano, duo folk, morceau des profs (flûte, violon, guitare, piano), atelier rock, grand final. Pour chacun : tu poses les micros et les retours, tu fais jouer les musiciens pour régler tes gains, puis tu lèves le rideau. Chaque morceau suit un **conducteur** (intro guitare seule, solo de la soliste, pont a cappella…) : à toi d’ouvrir et de couper les bonnes voies au bon moment. Pendant le spectacle il se passe des choses (la chanteuse descend dans le public, le micro pointe vers le retour, une enfant intimidée recule…). À la fin : une note sur 100 et la liste de ce qu’il faut retravailler. |
| **Quiz** | Le jeu des questions : partie rapide (chrono par question, combos), par thème (micros, console, larsen, retours, scène, jour J), Oreille d’or (questions à l’écoute : quel instrument a disparu, la voix sature-t-elle, quelle fréquence siffle, qu’est-ce qui cloche dans ce mix), Chrono 60 s et Survie à 3 vies. XP, niveaux (de Stagiaire à Chef de régie), badges et révision des erreurs. |
| **Atelier libre** | Matériel illimité, pas de chrono. Cinq **missions guidées** (premier micro, premier retour, provoquer puis maîtriser un larsen, le piège du 48 V, mélanger deux sources) : Jérôme ou Marc éclairent l’endroit où cliquer, et la mission avance toute seule quand c’est fait. Ensuite, ajoute n’importe quel instrument et regarde l’effet de chaque réglage sur la marge avant larsen. |
| **Fiches** | La chaîne du son, dynamique / statique / DI, directivités, larsen, gain pas à pas, quel micro pour quoi, retours, check-list du jour J, glossaire. |

### Le son

Chaque musicien joue vraiment (voix, chorale, guitare, piano, clavier, basse, batterie, cajón, flûte, violon…), synthétisé dans le navigateur. Ce que tu entends, c’est ce qu’entend le public à la régie : le son direct des instruments plus la façade, après le gain (la saturation s’entend), le coupe-bas, l’égaliseur, les faders, les mutes et l’EQ graphique. Le larsen siffle pour de vrai.

### Hors ligne et sur l’écran d’accueil

Une fois en ligne (Vercel), le site s’installe comme une appli sur le téléphone (« Ajouter à l’écran d’accueil ») et fonctionne sans réseau, pratique dans une salle sans wifi.

### Les gens du concert

- **Jérôme** et **Marc**, les mentors : ils te parlent au talkie pendant la partie (conseils, alertes larsen) et font le débrief.
- **Christine**, la directrice : elle ouvre la soirée au pupitre et annonce le final.
- **Lucie**, directrice adjointe et prof de piano : elle gère le déroulé, te prévient avant chaque changement, et joue du piano (chorale, morceau des profs) et du clavier (final).
- **Les profs de guitare, de flûte traversière et de violon** : ils accompagnent les élèves et jouent leur propre morceau.

Les prénoms et les rôles sont dans `PEOPLE` (`js/data.js`) : il suffit de les modifier pour donner leur prénom aux profs.

### La vue salle

La scène est vue depuis la régie, en temps réel : les musiciens entrent et sortent entre les plateaux, jouent
quand le conducteur le dit et se taisent sinon. Quand tu choisis un micro dans la valise, un technicien l’apporte,
le pose et tire le câble jusqu’au **boîtier de scène** (la prise N arrive sur la voie N de la console ; l’onglet
**Patch** permet de rebrancher). Les retours et la façade envoient des ondes à la mesure de ce que tu leur envoies,
les musiciens réclament leur retour, le public bat la mesure, se penche quand il n’entend pas, se bouche les
oreilles quand c’est trop fort… et tout le monde grimace au larsen. Le bouton **Plan** affiche la vue technique de dessus.

Le bouton **Aide** (en haut) bascule entre le mode apprentissage (analyseur de larsen, zones cibles, conseils)
et le mode expert (seulement le sonomètre et tes oreilles, comme en vrai).

## Comment ça marche (le modèle physique)

Tout est dans `js/engine.js`. C’est simplifié, mais chaque phénomène suit la vraie physique :

- **Niveau capté** = niveau de la source − 20·log(distance) + directivité du micro + sensibilité (dBV/Pa) + gain du préampli.
  Doubler la distance fait perdre 6 dB.
- **Directivité** : r(θ) = a + (1 − a)·cos θ (omni, cardioïde, supercardioïde, hypercardioïde), avec un plancher
  qui dépend de la fréquence (un micro est moins directif dans le grave).
- **Larsen** : pour chaque micro ouvert et chaque enceinte (façade et retours), on calcule le gain de la boucle
  micro → console → enceinte → micro sur 12 bandes de fréquence : son direct (distance en 3D, directivité du micro
  et de l’enceinte) + champ réverbéré de la salle. Les boucles s’additionnent : deux micros ouverts = 3 dB de marge en moins.
  Au-dessus de 0 dB à une fréquence, le larsen démarre et monte.
- **Ce qu’entend le public** : son direct des instruments + façade, au niveau de la régie.
- **Retours** : un musicien s’entend si un retour le vise et reçoit assez de ce qu’il a demandé.

Les valeurs (niveaux des instruments, sensibilités, salle) sont des ordres de grandeur réalistes.
Le simulateur ne remplace pas la formation sur le vrai matériel : il sert à comprendre **pourquoi** on fait les choses.

## L’adapter au vrai concert

Tout se règle dans `js/data.js` :

- `INVENTORY` : remplace par la liste réelle de ton matériel (combien de 58, de statiques, de DI, de retours…).
- `SCENES` : le vrai programme de la soirée (qui joue, où sur scène, le conducteur de chaque morceau, ce que chacun veut dans son retour, les événements, l’apparence des bonhommes).
- `VENUE` : position des enceintes de façade, distance de la régie, réverbération de la salle.
- `MICS` / `SOURCES` : ajouter un micro ou un instrument.

### Apprendre en jouant (Concert et Atelier)

- **Visite** : au premier passage, Jérôme fait le tour de l’écran en 7 étapes (la scène, la valise, la console, ce que règlent les faders, le témoin de larsen…). Relançable avec le bouton « Visite ».
- **Explique-moi** : active-le, puis touche n’importe quel bouton, réglage ou bonhomme : on t’explique à quoi il sert, sans rien modifier.
- **Ta check-list** (onglet Scène du concert) : ce qu’il reste à faire pour le plateau en cours (micro de chaque musicien, 48 V, gains, retours demandés, conducteur). Toucher une ligne montre où agir.

## Organisation du code

```
index.html        page unique
css/style.css     styles
js/data.js        micros, instruments, salle, scènes, quiz
js/engine.js      modèle physique (fonctions pures, testées)
js/state.js       état du jeu (voies, micros, retours)
js/audio.js       sons (Web Audio) : larsen, saturation, applaudissements, exercices
js/music.js       la musique : synthèse des instruments, séquenceur, chaîne de console audio
js/ui.js          composants : boutons rotatifs, faders, vu-mètres
js/stage.js       plan de scène vu de dessus (SVG)
js/salle.js       vue salle animée (canvas) : bonhommes, technicien, câbles, public
js/mixer.js       console 48 voies + façade + 4 retours, EQ graphique
js/learn.js       fiches, quiz, oreille
js/parcours.js    les mini-leçons « Apprendre »
js/questions.js   la banque de questions
js/quiz.js        le jeu des questions, le profil (XP, niveaux, badges)
js/coach.js       visite guidée, « Explique-moi », missions de l’atelier, check-list du concert
sw.js, manifest.webmanifest, icon.svg   appli installable et hors ligne
js/game.js        déroulé du concert, notes, panneaux
tests/            tests du moteur : `npm test` (Node 18+)
outils/video/     la vidéo de présentation, filmée dans l’appli (voir son README)
```

Les tests vérifient notamment que chaque plateau du concert a une solution sans larsen qui tient les objectifs de mix,
à chaque moment de son conducteur.
