# Sono Sim · Concert Destination Musique

Simulateur pédagogique pour apprendre à sonoriser un concert d’école : choisir et placer les micros,
régler les gains, placer les retours, éviter le larsen, équilibrer le mix pour le public.

## Lancer

Aucune installation : ouvre `index.html` dans Chrome, Firefox, Safari ou Edge (double-clic).
Clique sur **Activer le son** en haut pour entendre les larsens, les saturations et les exercices d’oreille.

## Ce qu’il y a dedans

| Onglet | À quoi ça sert |
| --- | --- |
| **Le concert** | Les 5 plateaux de la soirée : mot d’accueil, chorale + soliste + piano, duo folk, atelier rock, grand final. Pour chacun : tu poses les micros et les retours, tu fais jouer les musiciens pour régler tes gains, puis tu lèves le rideau. Chaque morceau suit un **conducteur** (intro guitare seule, solo de la soliste, pont a cappella…) : à toi d’ouvrir et de couper les bonnes voies au bon moment. Pendant le spectacle il se passe des choses (la chanteuse descend dans le public, le micro pointe vers le retour, une enfant intimidée recule…). À la fin : une note sur 100 et la liste de ce qu’il faut retravailler. |
| **Atelier libre** | Matériel illimité, pas de chrono. Ajoute n’importe quel instrument et regarde l’effet de chaque réglage sur la marge avant larsen. |
| **Oreille** | Reconnaître la fréquence d’un larsen, et l’éteindre le plus vite possible sur l’EQ graphique. |
| **Quiz** | 12 questions tirées au hasard, chacune expliquée. |
| **Fiches** | La chaîne du son, dynamique / statique / DI, directivités, larsen, gain pas à pas, quel micro pour quoi, retours, check-list du jour J, glossaire. |

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

- `INVENTORY` : remplace par la liste réelle du matériel de l’école (combien de 58, de statiques, de DI, de retours…).
- `SCENES` : le vrai programme de la soirée (qui joue, où sur scène, le conducteur de chaque morceau, ce que chacun veut dans son retour, les événements, l’apparence des bonhommes).
- `VENUE` : position des enceintes de façade, distance de la régie, réverbération de la salle.
- `MICS` / `SOURCES` : ajouter un micro ou un instrument.

## Organisation du code

```
index.html        page unique
css/style.css     styles
js/data.js        micros, instruments, salle, scènes, quiz
js/engine.js      modèle physique (fonctions pures, testées)
js/state.js       état du jeu (voies, micros, retours)
js/audio.js       sons (Web Audio) : larsen, saturation, applaudissements, exercices
js/ui.js          composants : boutons rotatifs, faders, vu-mètres
js/stage.js       plan de scène vu de dessus (SVG)
js/salle.js       vue salle animée (canvas) : bonhommes, technicien, câbles, public
js/mixer.js       console 16 voies + façade + 4 retours, EQ graphique
js/learn.js       fiches, quiz, oreille
js/game.js        déroulé du concert, notes, panneaux
tests/            tests du moteur : `npm test` (Node 18+)
```

Les tests vérifient notamment que chaque plateau du concert a une solution sans larsen qui tient les objectifs de mix,
à chaque moment de son conducteur.
