/* Sono Sim — la banque de questions.
 * type : qcm (choix), tf (vrai / faux), order (remettre dans l’ordre), pic (réponses en images).
 * lvl : 1 facile, 2 moyen, 3 difficile. Les questions à l’écoute sont fabriquées dans quiz.js. */
(function (root) {
  'use strict';

  const CATS = {
    micros: { name: 'Les micros', color: '#5ccaa9' },
    console: { name: 'La console', color: '#f2a53a' },
    larsen: { name: 'Le larsen', color: '#ff5040' },
    retours: { name: 'Les retours', color: '#58aee0' },
    scene: { name: 'Scène et vocabulaire', color: '#bb86e6' },
    jourj: { name: 'Le jour J', color: '#ea829f' },
    oreille: { name: 'À l’oreille', color: '#ebc54a' }
  };

  const Q = [
    // ---------------------------------------------------------------- Micros
    { cat: 'micros', lvl: 1, type: 'pic', q: 'Inès va chanter. Quel micro lui donner ?', a: [{ icon: 'sm58', label: 'Micro chant' }, { icon: 'beta52', label: 'Micro grosse caisse' }, { icon: 'pzm', label: 'Micro de surface' }], ok: 0, why: 'Le micro chant dynamique (type SM58) est fait pour la voix, tenu à quelques centimètres de la bouche.' },
    { cat: 'micros', lvl: 1, type: 'pic', q: 'Quel micro pour la grosse caisse ?', a: [{ icon: 'km184', label: 'Statique crayon' }, { icon: 'beta52', label: 'Micro grosse caisse' }, { icon: 'col', label: 'Col de cygne' }], ok: 1, why: 'Une grosse membrane faite pour le grave et les fortes pressions.' },
    { cat: 'micros', lvl: 1, type: 'pic', q: 'Comment brancher le piano numérique de Zoé ?', a: [{ icon: 'sm58', label: 'Un micro devant' }, { icon: 'di', label: 'Une boîte de direct' }, { icon: 'none', label: 'Rien' }], ok: 1, why: 'La DI transforme la sortie du clavier en signal micro. Pas de micro, pas de larsen.' },
    { cat: 'micros', lvl: 1, type: 'pic', q: 'Christine parle au pupitre. Le micro idéal ?', a: [{ icon: 'c414', label: 'Statique de studio' }, { icon: 'col', label: 'Col de cygne' }, { icon: 'beta52', label: 'Micro grosse caisse' }], ok: 1, why: 'Le col de cygne est fait pour la parole et s’oriente vers la bouche.' },
    { cat: 'micros', lvl: 1, type: 'pic', q: 'L’ampli de la guitare électrique ?', a: [{ icon: 'sm57', label: 'Dynamique instrument' }, { icon: 'pzm', label: 'Micro de surface' }, { icon: 'col', label: 'Col de cygne' }], ok: 0, why: 'Le SM57 collé à la grille de l’ampli : le grand classique.' },
    { cat: 'micros', lvl: 1, type: 'tf', q: 'Un micro statique (à condensateur) a besoin du 48 V pour fonctionner.', ok: true, why: 'Il est alimenté par la console via le câble : c’est l’alimentation fantôme.' },
    { cat: 'micros', lvl: 1, type: 'tf', q: 'Un micro dynamique type SM58 a besoin du 48 V.', ok: false, why: 'Un dynamique produit son signal tout seul. Le 48 V ne l’abîme pas, mais ne sert à rien.' },
    { cat: 'micros', lvl: 2, type: 'qcm', q: 'Pour une chorale de vingt enfants, on met…', a: ['Une paire de statiques devant et au-dessus', 'Un SM58 par enfant', 'Un SM58 posé à 2 m', 'Un serre-tête sur le premier rang'], ok: 0, why: 'Les statiques captent bien un groupe à distance. Vingt micros, c’est vingt chances de larsen.' },
    { cat: 'micros', lvl: 2, type: 'qcm', q: 'Une DI active, c’est…', a: ['Une boîte de direct alimentée par le 48 V', 'Un micro sans fil', 'Un ampli de retour', 'Un égaliseur'], ok: 0, why: 'Elle a besoin d’être alimentée (48 V ou pile) et convient très bien aux basses et aux capteurs passifs.' },
    { cat: 'micros', lvl: 2, type: 'qcm', q: 'Où placer le micro d’une guitare folk ?', a: ['Vers la 12e case, à 15-20 cm', 'Dans la rosace, collé', 'Derrière la guitare', 'Au pied du guitariste'], ok: 0, why: 'Face à la rosace, ça « boume ». Vers la 12e case, c’est plus équilibré.' },
    { cat: 'micros', lvl: 2, type: 'qcm', q: 'Pourquoi un serre-tête est-il pratique pour un enfant timide ?', a: ['La distance bouche-micro ne change plus', 'Il est plus fort', 'Il n’a pas besoin de piles', 'Il coupe le larsen'], ok: 0, why: 'Un enfant timide recule. Avec un serre-tête, le micro suit la bouche.' },
    { cat: 'micros', lvl: 2, type: 'tf', q: 'Doubler la distance entre la bouche et le micro fait perdre environ 6 dB.', ok: true, why: 'Loi du carré inverse : 2 fois plus loin, 6 dB de moins. C’est énorme.' },
    { cat: 'micros', lvl: 3, type: 'qcm', q: 'L’effet de proximité, c’est…', a: ['Plus de grave quand on chante tout près d’un micro directionnel', 'Le larsen quand on est près d’une enceinte', 'La saturation d’un micro trop près', 'Le souffle quand on est loin'], ok: 0, why: 'Les micros directionnels renforcent le grave de près. Un chanteur s’en sert pour chauffer sa voix.' },
    { cat: 'micros', lvl: 3, type: 'qcm', q: 'Pour la basse électrique, la solution la plus courante ?', a: ['Une DI active', 'Un statique crayon', 'Un col de cygne', 'Un micro de surface'], ok: 0, why: 'Une DI active garde tout le grave et les aigus d’une basse passive. On ajoute parfois un micro sur l’ampli.' },
    { cat: 'micros', lvl: 3, type: 'tf', q: 'Tenir un micro par la grille le rend plus directif.', ok: false, why: 'C’est l’inverse : on bouche les ouïes arrière, le micro devient presque omni. Larsen et son étouffé.' },

    // ---------------------------------------------------------------- Console
    { cat: 'console', lvl: 1, type: 'qcm', q: 'La LED rouge d’une voie s’allume. Tu baisses…', a: ['Le gain', 'Le fader', 'Le master', 'Le retour'], ok: 0, why: 'La saturation se produit à l’entrée. Le fader agit après : il ne l’enlève pas.' },
    { cat: 'console', lvl: 1, type: 'qcm', q: 'Le bouton MUTE d’une voie…', a: ['Coupe la voie', 'Monte le volume', 'Allume le 48 V', 'Affiche ses réglages'], ok: 0, why: 'MUTE coupe la voie d’un coup, sans toucher au fader. Pratique entre deux chansons.' },
    { cat: 'console', lvl: 1, type: 'tf', q: 'Le micro branché sur la prise 3 du boîtier de scène arrive sur la voie 3 de la console.', ok: true, why: 'C’est le patch : chaque prise arrive sur la voie du même numéro.' },
    { cat: 'console', lvl: 1, type: 'qcm', q: 'HPF ou « coupe-bas », ça sert à…', a: ['Enlever le grave inutile', 'Couper les aigus', 'Monter le volume', 'Couper le micro'], ok: 0, why: 'On l’active sur presque tout (voix, guitare, caisse claire), pas sur la basse ni la grosse caisse.' },
    { cat: 'console', lvl: 2, type: 'order', q: 'Remets dans l’ordre le réglage d’une voie.', items: ['Fader en bas', 'Le musicien joue fort', 'Monter le gain', 'Coupe-bas et égaliseur', 'Monter le fader'], why: 'Gain d’abord (sur les passages forts), puis le nettoyage, puis le niveau dans le mix.' },
    { cat: 'console', lvl: 2, type: 'qcm', q: 'Les crêtes d’une voie bien réglée montent vers…', a: ['−10 à −6 dBFS', '0 dBFS pile', '−40 dBFS', '+6 dBFS'], ok: 0, why: 'On garde de la marge : les musiciens jouent plus fort pendant le concert qu’à la balance.' },
    { cat: 'console', lvl: 2, type: 'qcm', q: 'Sur une console numérique, choisir « Retour 1 » sur les faders permet de…', a: ['Régler ce que chaque voie envoie au retour 1', 'Couper la façade', 'Régler le gain', 'Écouter au casque'], ok: 0, why: 'C’est le « sends on fader » : les faders deviennent les envois vers ce retour.' },
    { cat: 'console', lvl: 2, type: 'tf', q: 'Un envoi pré-fader vers un retour change quand on bouge le fader façade.', ok: false, why: 'Pré-fader : le musicien garde son mix même quand tu bouges la façade.' },
    { cat: 'console', lvl: 2, type: 'qcm', q: '0 dBFS, c’est…', a: ['Le maximum absolu, au-delà ça sature', 'Le silence', 'Le niveau idéal moyen', 'La position du fader au milieu'], ok: 0, why: 'En numérique, rien ne passe au-dessus de 0 dBFS.' },
    { cat: 'console', lvl: 3, type: 'qcm', q: 'Pour le chant, on règle souvent le coupe-bas vers…', a: ['80-120 Hz', '20 Hz', '1 kHz', '5 kHz'], ok: 0, why: 'Sous 80-120 Hz, une voix n’a rien d’utile : seulement des bruits de manipulation et du larsen grave.' },
    { cat: 'console', lvl: 3, type: 'qcm', q: 'Une batterie se règle en gain…', a: ['Sur les coups les plus forts', 'Sur la moyenne', 'Au maximum', 'Pendant le concert'], ok: 0, why: 'Les coups font des crêtes bien plus fortes que la moyenne : on règle sur eux pour ne pas saturer.' },
    { cat: 'console', lvl: 3, type: 'tf', q: 'Le micro de Jade arrive sur la mauvaise voie : il prend les réglages de cette voie (gain, 48 V, égaliseur).', ok: true, why: 'Les réglages appartiennent à la voie, pas au micro. D’où l’importance du line check.' },

    // ---------------------------------------------------------------- Larsen
    { cat: 'larsen', lvl: 1, type: 'qcm', q: 'Ça siffle en plein concert ! Premier réflexe ?', a: ['Baisser le fader ou couper la voie', 'Chercher la fréquence à l’égaliseur', 'Débrancher l’enceinte', 'Monter le gain'], ok: 0, why: 'D’abord faire cesser le bruit. On cherche la cause après.' },
    { cat: 'larsen', lvl: 1, type: 'qcm', q: 'Le larsen, c’est…', a: ['Une boucle : enceinte → micro → enceinte…', 'Un câble abîmé', 'Une pile vide', 'Un micro saturé'], ok: 0, why: 'Quand ce qui revient dans le micro est plus fort que ce qui en est parti, la boucle s’emballe.' },
    { cat: 'larsen', lvl: 1, type: 'tf', q: 'Il ne faut jamais pointer un micro vers une enceinte.', ok: true, why: 'C’est la boucle la plus directe. Les micros restent derrière la façade.' },
    { cat: 'larsen', lvl: 2, type: 'qcm', q: 'Deux micros ouverts au lieu d’un : la marge avant larsen…', a: ['Perd environ 3 dB', 'Ne change pas', 'Gagne 3 dB', 'Double'], ok: 0, why: 'Chaque micro ouvert est un chemin de plus pour la boucle.' },
    { cat: 'larsen', lvl: 2, type: 'qcm', q: 'La meilleure arme contre le larsen ?', a: ['Rapprocher la source du micro', 'Monter les retours', 'Mettre plus d’aigus', 'Ajouter des micros'], ok: 0, why: '2 fois plus près = 6 dB de gagnés, sans rien abîmer.' },
    { cat: 'larsen', lvl: 2, type: 'qcm', q: 'Un larsen grave qui « ronfle », c’est souvent…', a: ['La salle et la façade vers 125-250 Hz', 'Un retour vers 3 kHz', 'Une cymbale', 'Un micro sans fil'], ok: 0, why: 'Les graves viennent de la salle et de la façade. Le coupe-bas aide beaucoup.' },
    { cat: 'larsen', lvl: 2, type: 'tf', q: 'Un retour qui siffle se calme en creusant 3 à 6 dB la bande qui sonne sur son égaliseur graphique.', ok: true, why: 'C’est « égaliser le retour ». Pas besoin de tout creuser.' },
    { cat: 'larsen', lvl: 3, type: 'order', q: 'Remets dans l’ordre « l’égalisation » d’un retour avant le concert.', items: ['Micro en place, retour branché', 'Monter doucement l’envoi', 'Entendre la première fréquence qui sonne', 'La creuser à l’EQ graphique', 'Remonter un peu et recommencer'], why: 'On cherche les fréquences qui sonnent en premier, une par une.' },
    { cat: 'larsen', lvl: 3, type: 'qcm', q: 'Le larsen d’un retour sonne typiquement vers…', a: ['2 à 4 kHz', '50 Hz', '10 à 16 kHz', '100 Hz'], ok: 0, why: 'Les retours ont souvent une bosse dans le haut-médium, là où l’oreille est très sensible.' },
    { cat: 'larsen', lvl: 3, type: 'tf', q: 'Baisser le fader façade arrête un larsen qui boucle par un retour.', ok: false, why: 'Un retour est souvent en pré-fader : seul le MUTE de la voie ou l’envoi vers le retour l’arrête.' },

    // ---------------------------------------------------------------- Retours
    { cat: 'retours', lvl: 1, type: 'qcm', q: 'Un retour, c’est…', a: ['Une enceinte pour que le musicien s’entende', 'L’enceinte du public', 'Un câble', 'Le bouton de la console'], ok: 0, why: 'Le « wedge », posé au sol face au musicien.' },
    { cat: 'retours', lvl: 1, type: 'qcm', q: 'Avec un micro cardioïde (SM58), le retour se place…', a: ['Pile derrière le micro, face au chanteur', 'Sur le côté', 'Derrière le chanteur', 'Au plafond'], ok: 0, why: 'Un cardioïde est sourd à l’arrière.' },
    { cat: 'retours', lvl: 2, type: 'qcm', q: 'Avec un supercardioïde (Beta 58), deux retours se placent…', a: ['En V, à environ ±55° de l’arrière', 'Pile derrière', 'Sur les côtés à 90°', 'Derrière le chanteur'], ok: 0, why: 'Sa zone sourde est vers 125°, pas pile derrière.' },
    { cat: 'retours', lvl: 2, type: 'qcm', q: 'Un musicien pointe son retour du doigt vers le haut. Il veut…', a: ['Plus de lui dans son retour', 'Moins de son', 'Changer de micro', 'Arrêter'], ok: 0, why: 'Le geste classique pour « plus de moi ».' },
    { cat: 'retours', lvl: 2, type: 'tf', q: 'Plus on met de son dans les retours, plus le larsen arrive vite.', ok: true, why: 'Chaque dB envoyé dans un retour rapproche la boucle. Le moins possible.' },
    { cat: 'retours', lvl: 3, type: 'qcm', q: 'Les enfants de la chorale chantent faux. Que mettre dans leur retour ?', a: ['Le piano (la note de référence)', 'Leurs propres voix', 'La batterie', 'Rien'], ok: 0, why: 'Ils ont besoin de la note : le piano. Leurs voix dans le retour, c’est du larsen assuré.' },

    // ---------------------------------------------------------------- Scène et vocabulaire
    { cat: 'scene', lvl: 1, type: 'qcm', q: 'Le côté « jardin » de la scène, c’est…', a: ['La gauche vue du public', 'La droite vue du public', 'Le fond', 'L’avant-scène'], ok: 0, why: 'Jardin à gauche, cour à droite, vus de la salle.' },
    { cat: 'scene', lvl: 1, type: 'qcm', q: 'La « façade », c’est…', a: ['Les enceintes tournées vers le public', 'Le rideau', 'La console', 'Les retours'], ok: 0, why: 'La façade, c’est le son du public.' },
    { cat: 'scene', lvl: 1, type: 'qcm', q: 'Le « lointain », c’est…', a: ['Le fond de la scène', 'Le fond de la salle', 'Le balcon', 'La régie'], ok: 0, why: 'Le lointain est au fond de la scène, l’avant-scène au bord.' },
    { cat: 'scene', lvl: 1, type: 'qcm', q: 'Un câble XLR, c’est…', a: ['Le câble à 3 broches des micros', 'Le câble d’une guitare', 'Une rallonge électrique', 'Un câble réseau'], ok: 0, why: 'Symétrique, solide, verrouillé : le câble micro standard.' },
    { cat: 'scene', lvl: 2, type: 'qcm', q: 'Le « multipaire », c’est…', a: ['Le gros câble qui relie la scène à la régie', 'Un micro à deux capsules', 'Une paire de retours', 'Un égaliseur'], ok: 0, why: 'Toutes les voies voyagent dedans, du boîtier de scène jusqu’à la console.' },
    { cat: 'scene', lvl: 2, type: 'qcm', q: 'Le « line check », c’est…', a: ['Vérifier que chaque micro arrive sur la bonne voie', 'Régler les retours', 'Faire jouer tout le groupe', 'Tester les lumières'], ok: 0, why: 'On gratte chaque micro, on vérifie qu’il arrive là où on l’attend.' },
    { cat: 'scene', lvl: 2, type: 'qcm', q: 'Le « conducteur », c’est…', a: ['Le déroulé : qui joue, quand', 'Le câble principal', 'Le régisseur lumière', 'Le chef de chœur'], ok: 0, why: 'On le garde sous les yeux pendant le concert pour anticiper.' },
    { cat: 'scene', lvl: 2, type: 'tf', q: 'PFL permet d’écouter une voie au casque sans changer le son de la salle.', ok: true, why: 'Pratique pour vérifier un micro discrètement pendant le concert.' },
    { cat: 'scene', lvl: 3, type: 'qcm', q: '« Unity » sur un fader, c’est…', a: ['La position 0 dB : il ne change pas le niveau', 'Le fader tout en haut', 'Le fader coupé', 'La moitié du fader'], ok: 0, why: 'La position de référence, souvent aux trois quarts de la course.' },

    // ---------------------------------------------------------------- Le jour J
    { cat: 'jourj', lvl: 1, type: 'qcm', q: 'Allumage de la sono : dans quel ordre ?', a: ['Console d’abord, enceintes en dernier', 'Enceintes d’abord', 'Tout en même temps', 'Peu importe'], ok: 0, why: 'Et l’inverse pour éteindre : enceintes d’abord. Sinon gros « boum ».' },
    { cat: 'jourj', lvl: 1, type: 'tf', q: 'On met des piles neuves dans les micros sans fil avant chaque concert.', ok: true, why: 'Une pile qui lâche au milieu du solo, ça n’arrive qu’une fois.' },
    { cat: 'jourj', lvl: 1, type: 'qcm', q: 'Le niveau maximal autorisé en France pour le public (moyenne sur 15 min) ?', a: ['102 dB(A)', '85 dB(A)', '120 dB(A)', 'Aucune limite'], ok: 0, why: 'Et 94 dB(A) pour les spectacles destinés aux enfants de moins de 6 ans.' },
    { cat: 'jourj', lvl: 2, type: 'order', q: 'Remets la journée du concert dans l’ordre.', items: ['Installer et câbler', 'Line check', 'Balance musicien par musicien', 'Égaliser les retours', 'Ouverture des portes'], why: 'On vérifie les branchements avant de faire jouer, et tout est prêt avant que le public entre.' },
    { cat: 'jourj', lvl: 2, type: 'qcm', q: 'Pourquoi scotcher les câbles au sol ?', a: ['Pour que personne ne trébuche', 'Pour le son', 'Pour le larsen', 'C’est joli'], ok: 0, why: 'Sécurité d’abord, surtout avec des enfants sur scène.' },
    { cat: 'jourj', lvl: 2, type: 'tf', q: 'Brancher un micro avec le 48 V allumé et le fader monté peut faire un gros « clac » dans les enceintes.', ok: true, why: 'Fader en bas, 48 V coupé, puis on branche.' },
    { cat: 'jourj', lvl: 3, type: 'qcm', q: 'Pendant le concert, où gardes-tu ta main ?', a: ['Près du fader du chant', 'Sur le master', 'Sur le 48 V', 'Dans ta poche'], ok: 0, why: 'C’est la voie la plus fragile : c’est elle qui part en larsen ou qu’il faut corriger en premier.' },
    { cat: 'jourj', lvl: 3, type: 'qcm', q: 'Pour un concert d’école, un niveau confortable à la régie, c’est plutôt…', a: ['80-90 dB', '100-105 dB', '60 dB', '110 dB'], ok: 0, why: 'Assez pour que tout soit clair, sans fatiguer les oreilles des enfants.' }
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = { CATS, Q };
  else root.SonoQuestions = { CATS, Q };
})(this);
