/* Sono Sim — données : micros, instruments, salle, scènes du concert, quiz.
 * Toutes les valeurs sont des ordres de grandeur réalistes, simplifiées pour le jeu.
 * Niveaux sources : dB SPL moyens mesurés à 1 m. Sensibilités micros : dBV/Pa. */
(function (root) {
  'use strict';

  // Bandes d'analyse (EQ graphique simplifié, 2/3 d'octave)
  const BANDS = [63, 100, 160, 250, 400, 630, 1000, 1600, 2500, 4000, 6300, 10000];
  const BAND_LABELS = ['63', '100', '160', '250', '400', '630', '1k', '1k6', '2k5', '4k', '6k3', '10k'];

  // ---------------------------------------------------------------- Micros
  // kind: dyn (dynamique) | cond (statique / condensateur) | di (boîte de direct)
  // pattern: omni | cardio | super | hyper
  // resp: réponse en fréquence par bande (dB), utilisée pour le calcul du larsen
  const MICS = {
    sm58: {
      name: 'Dynamique chant', model: 'type SM58', short: '58', kind: 'dyn', pattern: 'cardio',
      sens: -54.5, phantom: false, hf: false,
      resp: [-8, -4, -1, 0, 0, 0, 0, 1, 3, 4, 3, -2],
      desc: 'Le micro de chant le plus répandu au monde. Robuste, peu sensible au larsen, il aime être tenu tout près de la bouche.'
    },
    beta58: {
      name: 'Dynamique chant supercardio', model: 'type Beta 58A', short: 'β58', kind: 'dyn', pattern: 'super',
      sens: -51.5, phantom: false, hf: false,
      resp: [-8, -4, -1, 0, 0, 0, 0, 1, 3, 4, 4, 0],
      desc: 'Plus directif que le 58 : plus de gain avant larsen, mais sa zone morte est à ±125°, pas pile derrière. Les retours se placent en V.'
    },
    hf58: {
      name: 'Micro main sans fil (HF)', model: 'type SM58 HF', short: 'HF', kind: 'dyn', pattern: 'cardio',
      sens: -54.5, phantom: false, hf: true,
      resp: [-8, -4, -1, 0, 0, 0, 0, 1, 3, 4, 3, -2],
      desc: 'Même capsule qu’un 58, sans câble. Liberté totale… y compris celle d’aller se planter devant une enceinte. Piles neuves avant chaque concert.'
    },
    sm57: {
      name: 'Dynamique instrument', model: 'type SM57', short: '57', kind: 'dyn', pattern: 'cardio',
      sens: -56, phantom: false, hf: false,
      resp: [-8, -4, -1, 0, 0, 0, 0, 1, 3, 4, 2, -2],
      desc: 'Le couteau suisse : caisse claire, ampli guitare, cuivres. Encaisse de très fortes pressions sonores.'
    },
    beta52: {
      name: 'Dynamique grosse caisse', model: 'type Beta 52A', short: 'GC', kind: 'dyn', pattern: 'super',
      sens: -64, phantom: false, hf: false,
      resp: [4, 4, 1, -3, -5, -4, -2, 0, 3, 4, 1, -6],
      desc: 'Grosse membrane taillée pour le grave : grosse caisse, cajon, ampli basse.'
    },
    km184: {
      name: 'Statique petite membrane', model: 'type KM184 « crayon »', short: 'KM', kind: 'cond', pattern: 'cardio',
      sens: -36.5, phantom: true, hf: false,
      resp: [-1, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 2],
      desc: 'Précis et détaillé : overheads, guitare acoustique, piano, chorale, cordes. A besoin du 48 V.'
    },
    c414: {
      name: 'Statique grande membrane', model: 'type C414', short: '414', kind: 'cond', pattern: 'cardio',
      sens: -33, phantom: true, hf: false,
      resp: [0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 1],
      desc: 'Micro de studio très sensible. Superbe sur piano ou ensemble, risqué près des retours. A besoin du 48 V.'
    },
    col: {
      name: 'Col de cygne pupitre', model: 'type MX418', short: 'COL', kind: 'cond', pattern: 'cardio',
      sens: -35, phantom: true, hf: false,
      resp: [-10, -6, -2, 0, 0, 0, 0, 1, 2, 3, 2, 0],
      desc: 'Fixé sur le pupitre, orientable vers la bouche. Fait pour la parole. A besoin du 48 V.'
    },
    headset: {
      name: 'Serre-tête sans fil', model: 'type serre-tête omni', short: 'ST', kind: 'cond', pattern: 'omni',
      sens: -44, phantom: false, hf: true,
      resp: [0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 2, 0],
      desc: 'Mains libres, toujours à la même distance de la bouche. Omnidirectionnel : il capte aussi les enceintes. Alimenté par l’émetteur, pas besoin de 48 V.'
    },
    pzm: {
      name: 'Micro de surface', model: 'type PZM / PCC', short: 'PZM', kind: 'cond', pattern: 'omni',
      sens: -42, phantom: true, hf: false,
      resp: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
      desc: 'Posé à plat (sol, pupitre, couvercle de piano). Discret, capte large. A besoin du 48 V.'
    },
    di_pass: {
      name: 'Boîte de direct passive', model: 'DI passive', short: 'DI', kind: 'di', pattern: 'none',
      sens: 0, phantom: false, active: false, hf: false,
      desc: 'Transforme la sortie d’un clavier ou d’un instrument électrique en signal micro symétrique. Pas d’alimentation.'
    },
    di_act: {
      name: 'Boîte de direct active', model: 'DI active', short: 'DI+', kind: 'di', pattern: 'none',
      sens: 0, phantom: true, active: true, hf: false,
      desc: 'Idéale pour la basse et les capteurs passifs (haute impédance). Fonctionne avec le 48 V de la console.'
    }
  };
  const MIC_ORDER = ['sm58', 'beta58', 'hf58', 'headset', 'col', 'sm57', 'beta52', 'km184', 'c414', 'pzm', 'di_pass', 'di_act'];

  // Polarités : r(θ) = a + (1 − a)·cos θ
  const PATTERNS = {
    omni: { a: 1, diffuse: 0, label: 'Omnidirectionnel' },
    cardio: { a: 0.5, diffuse: -4.8, label: 'Cardioïde' },
    super: { a: 0.37, diffuse: -5.7, label: 'Supercardioïde' },
    hyper: { a: 0.25, diffuse: -6.0, label: 'Hypercardioïde' },
    fig8: { a: 0, diffuse: -4.8, label: 'Bidirectionnel (figure en 8)' }
  };

  // ---------------------------------------------------------------- Sources
  // level : dB SPL moyen à 1 m · crest : écart crête/moyenne (dB)
  // body : fréquence « corps » du son (un coupe-bas au-dessus l’amincit)
  // hpf : coupe-bas conseillé (Hz), 0 = pas de coupe-bas
  // dist : distance micro idéale [min, max] en cm · height : hauteur du micro (m)
  // tilt : inclinaison de l’axe du micro (° vers le haut)
  // line : niveau de sortie électrique (dBu) si l’instrument a une sortie
  // mics : adéquation micro → [note 0-3, explication]
  const NO_DI = [0, 'Une source acoustique ne se branche pas : il faut un micro.'];
  const SOURCES = {
    parole: {
      name: 'Discours', short: 'DISCOURS', level: 66, crest: 10, body: 180, hpf: 120,
      dist: [10, 25], defDist: 20, height: 1.4, tilt: 15, line: null,
      mics: {
        col: [3, 'Fait pour ça : discret, orientable vers la bouche.'],
        headset: [3, 'Parfait si la personne bouge. Omni : garde un niveau raisonnable.'],
        hf58: [3, 'Très bien, à condition de le tenir près de la bouche.'],
        sm58: [2, 'Sur pied, ça marche si la personne parle près (10-15 cm).'],
        beta58: [2, 'Possible, mais il pardonne peu quand on s’éloigne.'],
        km184: [1, 'Trop sensible au larsen pour de la parole à distance.'],
        c414: [1, 'Micro de studio : larsen assuré à cette distance.'],
        sm57: [2, 'Possible, un peu sec.'],
        pzm: [1, 'Posé sur le pupitre, il entend surtout les feuilles.'],
        beta52: [0, 'Micro de grosse caisse : voix sourde et étouffée.'],
        di_pass: NO_DI, di_act: NO_DI
      },
      tip: 'Une voix parlée est faible : demande à la personne de rester à 10-20 cm du micro, c’est ton meilleur anti-larsen.'
    },
    voix: {
      name: 'Chant', short: 'CHANT', level: 80, crest: 12, body: 200, hpf: 100,
      dist: [2, 8], defDist: 5, height: 1.5, tilt: 20, line: null,
      mics: {
        sm58: [3, 'Le classique du chant live : robuste, bonne réjection arrière.'],
        beta58: [3, 'Supercardio : encore plus de gain avant larsen si les retours sont en V.'],
        hf58: [3, 'Liberté de mouvement. Piles neuves obligatoires.'],
        headset: [2, 'Mains libres, mais omni et plus loin de la bouche : larsen plus facile.'],
        sm57: [2, 'Ça marche, mais pas de grille anti-pop : attention aux « p » et « b ».'],
        c414: [1, 'Micro de studio : trop sensible au larsen et aux chocs sur scène.'],
        km184: [1, 'Statique trop sensible pour du chant live.'],
        col: [1, 'Fait pour la parole au pupitre, pas pour chanter.'],
        pzm: [0, 'Beaucoup trop loin de la bouche.'],
        beta52: [0, 'Micro de grosse caisse : voix étouffée.'],
        di_pass: NO_DI, di_act: NO_DI
      },
      tip: 'Le micro se tient à quelques centimètres de la bouche. Un chanteur qui recule, c’est 6 dB de perdus à chaque fois que la distance double.'
    },
    soliste: {
      name: 'Voix d’enfant', short: 'SOLISTE', level: 72, crest: 12, body: 280, hpf: 120,
      dist: [3, 10], defDist: 6, height: 1.2, tilt: 20, line: null,
      mics: {
        sm58: [3, 'Bon choix, s’il ou elle chante près du micro.'],
        hf58: [3, 'Bon choix, s’il ou elle chante près du micro.'],
        beta58: [3, 'Très bien, retours en V.'],
        headset: [3, 'Excellent pour un enfant intimidé : la distance ne bouge plus.'],
        sm57: [2, 'Possible.'],
        km184: [1, 'Trop sensible au larsen.'], c414: [1, 'Trop sensible au larsen.'],
        col: [1, 'Fait pour la parole.'], pzm: [0, 'Trop loin.'], beta52: [0, 'Inadapté.'],
        di_pass: NO_DI, di_act: NO_DI
      },
      tip: 'Une voix d’enfant est douce et l’enfant recule souvent : vérifie la distance pendant la balance.'
    },
    chorale: {
      name: 'Chorale', short: 'CHORALE', level: 80, crest: 10, body: 250, hpf: 120,
      dist: [80, 200], defDist: 120, height: 2.2, tilt: -25, line: null, wide: 4.5,
      mics: {
        km184: [3, 'En paire, devant et au-dessus du chœur, à 1-1,5 m.'],
        c414: [3, 'Très bien devant le chœur, un peu en hauteur.'],
        pzm: [2, 'Posé au sol devant : capte bien, mais aussi les pas.'],
        col: [1, 'Directif et trop étroit pour un groupe.'],
        sm58: [0, 'Un dynamique à plus d’un mètre ne capte presque rien : gain énorme, larsen.'],
        beta58: [0, 'Un dynamique à plus d’un mètre ne capte presque rien.'],
        hf58: [0, 'Un dynamique à plus d’un mètre ne capte presque rien.'],
        sm57: [0, 'Un dynamique à plus d’un mètre ne capte presque rien.'],
        headset: [0, 'Un serre-tête sur un seul enfant : on n’entend que lui.'],
        beta52: [0, 'Inadapté.'],
        di_pass: NO_DI, di_act: NO_DI
      },
      tip: 'Une chorale ne se sonorise qu’en renfort : quelques dB par-dessus le son naturel. Plus tu pousses, plus le larsen arrive vite.'
    },
    piano: {
      name: 'Piano acoustique', short: 'PIANO', level: 86, crest: 14, body: 110, hpf: 60,
      dist: [15, 40], defDist: 30, height: 1.1, tilt: -30, line: null,
      mics: {
        km184: [3, 'Couvercle ouvert, vers les cordes (graves et aigus si tu en as deux).'],
        c414: [3, 'Superbe dans le piano, couvercle sur la petite béquille.'],
        pzm: [3, 'Collé sous le couvercle : très bon compromis anti-larsen.'],
        sm57: [1, 'Son étroit et dur.'], sm58: [1, 'Son étroit et dur.'], beta58: [1, 'Son étroit.'],
        beta52: [1, 'Uniquement du grave.'], hf58: [1, 'Son étroit.'], headset: [0, 'Inadapté.'], col: [1, 'Inadapté.'],
        di_pass: [0, 'Un piano acoustique n’a pas de sortie : il faut un micro.'],
        di_act: [0, 'Un piano acoustique n’a pas de sortie : il faut un micro.']
      },
      tip: 'Couvercle ouvert, micro à 20-30 cm des cordes. Le piano est déjà fort dans la salle : il faut souvent très peu de façade.'
    },
    clavier: {
      name: 'Piano numérique', short: 'CLAVIER', level: 60, crest: 14, body: 100, hpf: 0,
      dist: [0, 0], defDist: 0, height: 1.0, tilt: 0, line: -10, electric: true,
      mics: {
        di_pass: [3, 'Sortie ligne + DI passive : simple et efficace.'],
        di_act: [3, 'Marche aussi (pense au 48 V).']
      },
      micDefault: [0, 'Un clavier numérique se branche en DI : un micro devant ses petits haut-parleurs sonne mal.'],
      tip: 'Un clavier se branche en DI. Pas de micro, donc pas de risque de larsen sur cette voie.'
    },
    guitare_folk: {
      name: 'Guitare folk', short: 'GUIT. FOLK', level: 76, crest: 14, body: 120, hpf: 80,
      dist: [12, 30], defDist: 20, height: 1.0, tilt: 0, line: -18,
      mics: {
        km184: [3, 'Vers la 12e case, à 15-20 cm. Pas face à la rosace (trop de grave).'],
        c414: [2, 'Beau son, mais sensible au larsen sur scène.'],
        sm57: [2, 'Correct, un peu dur.'], sm58: [1, 'Son terne.'], beta58: [1, 'Son terne.'],
        hf58: [1, 'Son terne.'], pzm: [1, 'Trop large.'], headset: [0, 'Inadapté.'], col: [1, 'Inadapté.'], beta52: [0, 'Inadapté.'],
        di_act: [3, 'Avec le capteur intégré : aucun risque de larsen micro.'],
        di_pass: [2, 'OK si la guitare a un préampli intégré. Sinon, DI active.']
      },
      tip: 'Si la guitare a un capteur, la DI est la solution la plus sûre contre le larsen. Le micro sonne plus naturel.'
    },
    guitare_elec: {
      name: 'Ampli guitare', short: 'GUIT. ÉLEC', level: 98, crest: 12, body: 150, hpf: 80,
      dist: [1, 5], defDist: 3, height: 0.5, tilt: 0, line: null,
      mics: {
        sm57: [3, 'Le standard : collé à la grille, entre le centre et le bord du haut-parleur.'],
        sm58: [2, 'Ça marche.'], beta58: [2, 'Ça marche.'], hf58: [1, 'Gâchis de micro sans fil.'],
        c414: [1, 'Possible, mais fragile devant un ampli fort.'], km184: [1, 'Trop brillant, fragile.'],
        beta52: [1, 'Trop de grave.'], pzm: [0, 'Inadapté.'], headset: [0, 'Inadapté.'], col: [0, 'Inadapté.'],
        di_pass: [1, 'Sans l’ampli, une guitare électrique sonne plate (sauf simulateur).'],
        di_act: [1, 'Sans l’ampli, une guitare électrique sonne plate (sauf simulateur).']
      },
      tip: 'Dans une petite salle, l’ampli s’entend déjà fort : on le reprend surtout pour l’équilibrer dans la façade.'
    },
    basse: {
      name: 'Basse', short: 'BASSE', level: 92, crest: 12, body: 70, hpf: 0,
      dist: [2, 10], defDist: 5, height: 0.6, tilt: 0, line: -18,
      mics: {
        di_act: [3, 'Le classique : DI active (48 V), garde tout le grave et les aigus.'],
        di_pass: [2, 'Marche, mais une basse passive perd un peu d’aigu.'],
        beta52: [2, 'Sur l’ampli : son plus gros, souvent en plus de la DI.'],
        sm57: [1, 'Manque de grave.'], sm58: [1, 'Manque de grave.'], c414: [1, 'Possible.'],
        km184: [0, 'Inadapté.'], beta58: [1, 'Manque de grave.'], hf58: [0, 'Inadapté.'], pzm: [0, 'Inadapté.'],
        headset: [0, 'Inadapté.'], col: [0, 'Inadapté.']
      },
      tip: 'Pas de coupe-bas sur une basse : c’est justement le grave qu’on veut.'
    },
    gc: {
      name: 'Grosse caisse', short: 'GC', level: 100, crest: 18, body: 60, hpf: 0,
      dist: [3, 15], defDist: 8, height: 0.3, tilt: 0, line: null,
      mics: {
        beta52: [3, 'Dans l’ouverture de la peau avant, vers le point de frappe.'],
        pzm: [2, 'À l’intérieur, posé sur le coussin : bonne attaque.'],
        sm57: [1, 'Pas assez de grave.'], sm58: [1, 'Pas assez de grave.'], beta58: [1, 'Pas assez de grave.'],
        c414: [1, 'N’aime pas la pression, trop de bas mélangés.'], km184: [0, 'Trop fragile ici.'],
        hf58: [0, 'Inadapté.'], headset: [0, 'Inadapté.'], col: [0, 'Inadapté.'],
        di_pass: NO_DI, di_act: NO_DI
      },
      tip: 'Grosse caisse = gros écart entre moyenne et crêtes : règle le gain sur les coups, pas sur la moyenne.'
    },
    cc: {
      name: 'Caisse claire', short: 'CC', level: 100, crest: 18, body: 200, hpf: 100,
      dist: [2, 6], defDist: 4, height: 0.7, tilt: -30, line: null,
      mics: {
        sm57: [3, 'Le roi de la caisse claire : 3-5 cm du cercle, visé vers le centre.'],
        sm58: [2, 'Ça marche.'], beta58: [2, 'Ça marche, bonne isolation.'],
        km184: [1, 'Trop sensible, risque de saturation.'], c414: [1, 'Trop sensible.'], beta52: [1, 'Trop de grave.'],
        hf58: [0, 'Inadapté.'], headset: [0, 'Inadapté.'], col: [0, 'Inadapté.'], pzm: [0, 'Inadapté.'],
        di_pass: NO_DI, di_act: NO_DI
      },
      tip: 'Coupe-bas vers 100 Hz : on garde le claquant, on enlève la grosse caisse qui « bave » dedans.'
    },
    oh: {
      name: 'Cymbales (overheads)', short: 'OH', level: 96, crest: 16, body: 300, hpf: 150,
      dist: [60, 120], defDist: 80, height: 2.0, tilt: -90, line: null,
      mics: {
        km184: [3, 'Au-dessus de la batterie, pointé vers les cymbales.'],
        c414: [3, 'Très bien au-dessus de la batterie.'],
        sm57: [1, 'Manque de finesse dans les aigus.'], pzm: [1, 'Inadapté.'],
        sm58: [0, 'Manque de finesse dans les aigus.'], beta58: [0, 'Inadapté.'], beta52: [0, 'Inadapté.'],
        hf58: [0, 'Inadapté.'], headset: [0, 'Inadapté.'], col: [0, 'Inadapté.'],
        di_pass: NO_DI, di_act: NO_DI
      },
      tip: 'Dans une petite salle, la batterie s’entend déjà très fort. Les overheads servent surtout à donner de la brillance.'
    },
    cajon: {
      name: 'Cajón', short: 'CAJÓN', level: 92, crest: 16, body: 80, hpf: 50,
      dist: [5, 15], defDist: 8, height: 0.4, tilt: 0, line: null,
      mics: {
        beta52: [3, 'Dans le trou arrière : le grave du cajón.'],
        sm57: [2, 'Devant ou derrière : bon compromis.'], sm58: [2, 'Bon compromis.'],
        km184: [2, 'Devant, vers la frappe : claquant.'], c414: [2, 'Devant : beau son.'],
        beta58: [2, 'Bon compromis.'], pzm: [1, 'Possible au sol.'], hf58: [0, 'Inadapté.'],
        headset: [0, 'Inadapté.'], col: [0, 'Inadapté.'],
        di_pass: NO_DI, di_act: NO_DI
      },
      tip: 'Le grave sort par le trou à l’arrière du cajón.'
    },
    violon: {
      name: 'Violon', short: 'VIOLON', level: 84, crest: 12, body: 250, hpf: 150,
      dist: [20, 50], defDist: 30, height: 1.7, tilt: -40, line: null,
      mics: {
        km184: [3, 'Au-dessus de l’instrument, à 30-50 cm.'], c414: [3, 'Très beau son.'],
        sm57: [1, 'Son dur.'], sm58: [1, 'Son dur.'], beta58: [1, 'Son dur.'], pzm: [0, 'Inadapté.'],
        hf58: [0, 'Inadapté.'], headset: [0, 'Inadapté.'], col: [1, 'Inadapté.'], beta52: [0, 'Inadapté.'],
        di_pass: NO_DI, di_act: NO_DI
      },
      tip: 'Le son du violon rayonne vers le haut : micro au-dessus, pas devant.'
    },
    saxo: {
      name: 'Saxophone', short: 'SAXO', level: 96, crest: 12, body: 150, hpf: 100,
      dist: [10, 25], defDist: 15, height: 1.2, tilt: 0, line: null,
      mics: {
        sm57: [3, 'Vers le pavillon, un peu en biais.'], c414: [2, 'Beau son, plus sensible.'],
        km184: [2, 'Détaillé.'], sm58: [2, 'Ça marche.'], beta58: [2, 'Ça marche.'], hf58: [1, 'Possible.'],
        beta52: [0, 'Inadapté.'], pzm: [0, 'Inadapté.'], headset: [0, 'Inadapté.'], col: [0, 'Inadapté.'],
        di_pass: NO_DI, di_act: NO_DI
      },
      tip: 'Le son du saxo ne sort pas que du pavillon : 15-20 cm laissent respirer les clés.'
    },
    trompette: {
      name: 'Trompette', short: 'TROMPETTE', level: 100, crest: 14, body: 220, hpf: 120,
      dist: [15, 30], defDist: 20, height: 1.5, tilt: 0, line: null,
      mics: {
        sm57: [3, 'Face au pavillon, à 20 cm.'], sm58: [2, 'Ça marche.'], beta58: [2, 'Ça marche.'],
        c414: [2, 'Attention à la pression.'], km184: [1, 'Fragile ici.'], hf58: [1, 'Possible.'],
        beta52: [0, 'Inadapté.'], pzm: [0, 'Inadapté.'], headset: [0, 'Inadapté.'], col: [0, 'Inadapté.'],
        di_pass: NO_DI, di_act: NO_DI
      },
      tip: 'Une trompette est très forte : gain bas, et souvent très peu de façade.'
    },
    flute: {
      name: 'Flûte traversière', short: 'FLÛTE', level: 82, crest: 12, body: 300, hpf: 150,
      dist: [10, 20], defDist: 15, height: 1.5, tilt: 0, line: null,
      mics: {
        km184: [3, 'Vers l’embouchure, un peu au-dessus.'], c414: [2, 'Beau son.'],
        sm58: [2, 'Ça marche.'], sm57: [2, 'Ça marche.'], beta58: [2, 'Ça marche.'], hf58: [2, 'Ça marche.'],
        headset: [1, 'Possible.'], pzm: [0, 'Inadapté.'], col: [1, 'Possible.'], beta52: [0, 'Inadapté.'],
        di_pass: NO_DI, di_act: NO_DI
      },
      tip: 'Évite de viser pile l’embouchure : souffle garanti.'
    }
  };
  const SOURCE_ORDER = ['parole', 'voix', 'soliste', 'chorale', 'piano', 'clavier', 'guitare_folk',
    'guitare_elec', 'basse', 'gc', 'cc', 'oh', 'cajon', 'violon', 'saxo', 'trompette', 'flute'];

  function suitability(srcType, micType) {
    const s = SOURCES[srcType];
    if (!s) return [0, ''];
    if (s.mics[micType]) return s.mics[micType];
    if (s.micDefault) return s.micDefault;
    return [0, 'Inadapté.'];
  }

  // ---------------------------------------------------------------- Salle
  // Repère : x de 0 (jardin) à 10 (cour), y de 0 (fond de scène) à 5 (nez de scène).
  // Le public est en y > 5. Hauteurs z en mètres.
  const VENUE = {
    name: 'Salle polyvalente',
    stage: { w: 10, d: 5 },
    mains: [
      { id: 'L', name: 'Façade jardin', x: -0.2, y: 5.5, z: 2.2, angle: Math.PI / 2 },
      { id: 'R', name: 'Façade cour', x: 10.2, y: 5.5, z: 2.2, angle: Math.PI / 2 }
    ],
    audience: { x: 5, y: 15 },   // point de mesure du sonomètre (régie)
    // champ réverbéré relatif au son direct à 1 m (dB), par bande : petite salle assez réverbérante
    roomRev: [-20, -19, -18, -15, -17, -18, -18, -18, -17, -18, -19, -21],
    mainK: 102,  // dB SPL à 1 m pour 0 dBu en entrée (réglage des amplis)
    wedgeK: 104,
    mainResp: [2, 1, 0, 0, 0, 0, 0, 0, 1, 0, -1, -2],
    wedgeResp: [-6, -3, -1, 1, 0, 0, 1, 2, 4, 2, 0, -3],
    // directivité des enceintes : atténuation max (dB) à l’arrière, par bande
    spkDir: [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 22, 24]
  };

  // ---------------------------------------------------------------- Inventaire de l’école
  const INVENTORY = {
    sm58: 4, beta58: 1, hf58: 2, headset: 1, col: 1, sm57: 3, beta52: 1,
    km184: 2, c414: 1, pzm: 1, di_pass: 2, di_act: 2, wedge: 4
  };

  // ---------------------------------------------------------------- Le concert
  // targets.mix : niveau visé de chaque source dans le public, relatif à la source de référence [cible, tolérance]
  // targets.leq : fourchette de niveau global visée au public (dB)
  // needs : ce que chaque musicien veut entendre dans son retour
  const SCENES = [
    {
      id: 'accueil', title: 'Mot d’accueil', subtitle: 'La directrice ouvre la soirée', dur: 60,
      brief: 'La salle est pleine. La directrice monte sur scène, côté cour, et parle au pupitre. Elle n’a pas l’habitude des micros : elle parle doucement et bouge la tête en lisant ses notes.',
      sources: [{ id: 'parole', type: 'parole', name: 'La directrice', x: 7.2, y: 4.0 }],
      targets: { ref: 'parole', mix: {}, leq: [66, 78] },
      needs: [],
      events: [
        { t: 12, type: 'distance', source: 'parole', delta: 15, dur: 14, msg: 'La directrice baisse la tête vers ses notes : elle s’éloigne du micro.' },
        { t: 36, type: 'level', source: 'parole', delta: 6, dur: 8, msg: '« Et un grand merci à tous les bénévoles ! » Elle parle plus fort.' },
        { t: 50, type: 'distance', source: 'parole', delta: -10, dur: 8, msg: 'Elle se penche vers le micro pour annoncer la chorale.' }
      ],
      hints: [
        'Un col de cygne sur le pupitre est fait pour ça (n’oublie pas le 48 V).',
        'Parole = coupe-bas assez haut (100-150 Hz) : moins de « boum », moins de larsen grave.',
        'Garde un œil sur la marge avant larsen : une voix parlée demande beaucoup de gain.'
      ]
    },
    {
      id: 'chorale', title: 'La chorale des enfants', subtitle: 'Vingt voix et un piano', dur: 75,
      brief: 'Vingt enfants sur les gradins au centre, le professeur au piano droit côté cour. Les enfants doivent entendre le piano pour chanter juste. Dans le public : les parents… et beaucoup de petits frères et sœurs.',
      sources: [
        { id: 'chorale', type: 'chorale', name: 'La chorale', x: 4.6, y: 2.2 },
        { id: 'piano', type: 'piano', name: 'Le professeur au piano', x: 8.6, y: 3.3 }
      ],
      targets: { ref: 'chorale', mix: { piano: [-3, 3] }, leq: [70, 82] },
      needs: [{ who: 'chorale', wants: ['piano'] }],
      events: [
        { t: 15, type: 'level', source: 'chorale', delta: -5, dur: 14, msg: 'Couplet tout doux : la chorale chante pianissimo.' },
        { t: 40, type: 'level', source: 'piano', delta: 5, dur: 10, msg: 'Le piano joue un pont forte.' },
        { t: 55, type: 'request', who: 'chorale', delta: 4, dur: 20, msg: 'La cheffe de chœur te fait signe : les enfants n’entendent pas assez le piano !' }
      ],
      hints: [
        'Une paire de statiques devant et au-dessus du chœur, à 1-1,5 m.',
        'Un retour face aux enfants avec seulement le piano dedans.',
        'Chorale = renfort léger. Si tu pousses trop, ça siffle.'
      ]
    },
    {
      id: 'duo', title: 'Duo folk', subtitle: 'Chant et guitare acoustique', dur: 75,
      brief: 'Inès (16 ans) chante, Hugo l’accompagne à la guitare folk. Sa guitare a un capteur intégré. Les deux veulent un retour.',
      sources: [
        { id: 'voix', type: 'voix', name: 'Inès (chant)', x: 4.4, y: 3.7 },
        { id: 'guitare_folk', type: 'guitare_folk', name: 'Hugo (guitare)', x: 6.0, y: 3.5 }
      ],
      targets: { ref: 'voix', mix: { guitare_folk: [-4, 3] }, leq: [76, 88] },
      needs: [
        { who: 'voix', wants: ['voix', 'guitare_folk'] },
        { who: 'guitare_folk', wants: ['voix'] }
      ],
      events: [
        { t: 14, type: 'request', who: 'voix', delta: 5, dur: 40, msg: 'Inès pointe son retour du doigt : « Plus de voix ! »' },
        { t: 34, type: 'level', source: 'guitare_folk', delta: 5, dur: 10, msg: 'Solo de guitare : Hugo joue plus fort.' },
        { t: 52, type: 'distance', source: 'voix', delta: 15, dur: 10, msg: 'Inès éloigne le micro pour la note tenue finale.' }
      ],
      hints: [
        'Le retour se place dans la zone morte du micro : pile derrière pour un cardioïde.',
        'La guitare avec capteur : une DI active, et zéro larsen sur cette voie.',
        'Quand on te demande plus de retour, regarde la marge avant larsen avant de pousser.'
      ]
    },
    {
      id: 'rock', title: 'L’atelier rock', subtitle: 'Batterie, basse, guitare, clavier, chant', dur: 90,
      brief: 'Le groupe des ados : Léa au chant (elle adore bouger), batterie, basse, ampli guitare, clavier. La batterie à elle seule est déjà forte dans la salle. Le chant doit passer par-dessus, sans larsen.',
      sources: [
        { id: 'voix', type: 'voix', name: 'Léa (chant)', x: 5.0, y: 3.9 },
        { id: 'gc', type: 'gc', name: 'Grosse caisse', x: 5.0, y: 1.8 },
        { id: 'cc', type: 'cc', name: 'Caisse claire', x: 3.9, y: 1.5 },
        { id: 'oh', type: 'oh', name: 'Cymbales', x: 5.0, y: 0.8 },
        { id: 'basse', type: 'basse', name: 'Basse', x: 2.4, y: 2.4 },
        { id: 'guitare_elec', type: 'guitare_elec', name: 'Ampli guitare', x: 7.7, y: 2.1 },
        { id: 'clavier', type: 'clavier', name: 'Clavier', x: 8.7, y: 3.3 }
      ],
      targets: {
        ref: 'voix',
        mix: { gc: [-4, 4], cc: [-4, 4], oh: [-8, 5], basse: [-5, 4], guitare_elec: [-4, 4], clavier: [-6, 4] },
        leq: [86, 97]
      },
      needs: [
        { who: 'voix', wants: ['voix'] },
        { who: 'basse', wants: ['gc'] }
      ],
      events: [
        { t: 18, type: 'move', source: 'voix', to: { x: 0.5, y: 6.6 }, dur: 12, msg: 'Léa descend dans le public, juste devant l’enceinte jardin, pour faire chanter la salle !' },
        { t: 42, type: 'level', source: 'guitare_elec', delta: 6, dur: 12, msg: 'Solo de guitare : le guitariste monte le volume de son ampli.' },
        { t: 64, type: 'aim', source: 'voix', target: 'wedge', dur: 8, msg: 'Léa laisse pendre son micro le long du corps… grille pointée vers son retour.' }
      ],
      hints: [
        'Micro sans fil pour Léa : elle va bouger.',
        'Grosse caisse : micro spécial dans l’ouverture. Caisse claire : le 57. Basse : DI active.',
        'Garde la main près du fader du chant : quand un micro se retrouve face à une enceinte, il faut réagir en une seconde.'
      ]
    },
    {
      id: 'final', title: 'Le grand final', subtitle: 'Tout le monde sur scène', dur: 90,
      brief: 'Tout le monde revient pour la chanson de fin : la chorale au fond, Inès au chant, clavier, guitare folk, basse et cajón. Beaucoup de micros ouverts en même temps : c’est là que le larsen guette.',
      sources: [
        { id: 'chorale', type: 'chorale', name: 'La chorale', x: 5.0, y: 0.9 },
        { id: 'voix', type: 'voix', name: 'Inès (chant)', x: 5.0, y: 3.9 },
        { id: 'clavier', type: 'clavier', name: 'Clavier', x: 8.7, y: 3.3 },
        { id: 'guitare_folk', type: 'guitare_folk', name: 'Hugo (guitare)', x: 2.8, y: 3.4 },
        { id: 'basse', type: 'basse', name: 'Basse', x: 1.6, y: 2.2 },
        { id: 'cajon', type: 'cajon', name: 'Cajón', x: 7.0, y: 2.4 }
      ],
      targets: {
        ref: 'voix',
        mix: { chorale: [-3, 4], clavier: [-5, 4], guitare_folk: [-6, 4], basse: [-6, 4], cajon: [-6, 5] },
        leq: [80, 92]
      },
      needs: [
        { who: 'voix', wants: ['voix'] },
        { who: 'chorale', wants: ['clavier'] }
      ],
      events: [
        { t: 12, type: 'level', source: 'chorale', delta: 4, dur: 16, msg: 'Refrain : toute la chorale chante à pleine voix.' },
        { t: 38, type: 'aim', source: 'voix', target: 'wedge', dur: 7, msg: 'Inès applaudit en rythme… le micro pointé vers son retour.' },
        { t: 58, type: 'request', who: 'chorale', delta: 4, dur: 25, msg: 'Les enfants décrochent : ils n’entendent plus le clavier.' }
      ],
      hints: [
        'Coupe (mute) toutes les voies qui ne servent pas : chaque micro ouvert en trop rapproche le larsen.',
        'Les micros de la chorale restent ouverts mais assez bas : c’est un renfort.',
        'Le cajón et la basse n’ont presque pas besoin de façade dans une petite salle.'
      ]
    }
  ];

  // ---------------------------------------------------------------- Réglementation
  const LIMITS = { leqA: 102, leqKids: 94, note: 'Décret 2017-1244 : 102 dB(A) en moyenne sur 15 min, 94 dB(A) pour les spectacles destinés aux enfants de moins de 6 ans.' };

  // ---------------------------------------------------------------- Quiz
  const QUIZ = [
    { q: 'Tu branches un micro statique (condensateur) et il ne sort aucun son. Première chose à vérifier ?',
      a: ['Le 48 V (alimentation fantôme)', 'Le coupe-bas', 'Le fader du retour', 'La pile du micro sans fil'], ok: 0,
      why: 'Un micro statique a besoin d’être alimenté. Sur une console, c’est le bouton « 48V » ou « Phantom » de la voie.' },
    { q: 'Un chanteur avec un micro cardioïde : où placer son retour ?',
      a: ['Pile derrière le micro, face au chanteur', 'Sur le côté du micro', 'Derrière le chanteur', 'Peu importe'], ok: 0,
      why: 'Un cardioïde est sourd à 180° : le retour face au chanteur est dans l’axe mort du micro.' },
    { q: 'Et avec un supercardioïde (type Beta 58) ?',
      a: ['Deux retours en V, à environ ±55° de l’axe arrière', 'Pile derrière, comme le cardioïde', 'Sur les côtés à 90°', 'Au-dessus'], ok: 0,
      why: 'Le supercardioïde a un petit lobe à l’arrière : ses zones mortes sont vers ±125° par rapport à l’avant.' },
    { q: 'Le chanteur recule de 5 cm à 10 cm du micro. Le niveau capté…',
      a: ['Baisse d’environ 6 dB', 'Reste identique', 'Baisse de moitié en volume perçu', 'Augmente'], ok: 0,
      why: 'Loi du carré inverse : chaque fois que la distance double, on perd 6 dB.' },
    { q: 'Qu’est-ce qu’un larsen ?',
      a: ['Une boucle : l’enceinte renvoie le son dans le micro qui le renvoie dans l’enceinte…', 'Un défaut de câble', 'Un micro saturé', 'Une interférence radio'], ok: 0,
      why: 'Quand le gain de la boucle micro → console → enceinte → micro dépasse 1 (0 dB) à une fréquence, elle s’emballe.' },
    { q: 'Ça siffle ! Le réflexe immédiat ?',
      a: ['Baisser le fader de la voie en cause (ou le master)', 'Monter le gain', 'Couper le 48 V', 'Débrancher l’enceinte'], ok: 0,
      why: 'D’abord faire cesser le larsen en baissant le niveau. On cherche la cause (fréquence, micro, retour) ensuite.' },
    { q: 'Deux micros identiques ouverts au lieu d’un : le gain avant larsen…',
      a: ['Perd environ 3 dB', 'Ne change pas', 'Double', 'Gagne 3 dB'], ok: 0,
      why: 'Chaque micro ouvert ajoute un chemin de retour. On coupe toujours les voies inutilisées.' },
    { q: 'Sur quel instrument NE met-on PAS de coupe-bas ?',
      a: ['La basse', 'Le chant', 'La caisse claire', 'Le discours au pupitre'], ok: 0,
      why: 'Le coupe-bas (HPF) enlève le grave inutile. Sur une basse ou une grosse caisse, le grave est justement le son.' },
    { q: 'Comment brancher un piano numérique ?',
      a: ['Par une DI (boîte de direct)', 'Avec un SM58 devant ses haut-parleurs', 'Avec un micro statique', 'Directement en enceinte'], ok: 0,
      why: 'Une DI transforme la sortie ligne en signal micro symétrique qui peut voyager dans le multipaire jusqu’à la console.' },
    { q: 'Le gain d’une voie se règle…',
      a: ['En faisant jouer le musicien à son niveau le plus fort, crêtes vers −10 à −6 dBFS', 'Au maximum pour avoir du son', 'Après le fader', 'Pendant le spectacle uniquement'], ok: 0,
      why: 'Le gain adapte le niveau d’entrée. On le règle pendant la balance, sur les passages forts, en laissant de la marge avant saturation.' },
    { q: 'Le témoin rouge « clip » d’une voie s’allume. Que fais-tu ?',
      a: ['Je baisse le gain', 'Je baisse le fader', 'Je coupe le coupe-bas', 'Rien, c’est normal'], ok: 0,
      why: 'La saturation se produit au préampli : baisser le fader ne change rien, il faut baisser le gain.' },
    { q: 'Quel micro pour une grosse caisse ?',
      a: ['Un dynamique à grosse membrane (type Beta 52)', 'Un statique crayon', 'Un col de cygne', 'Un serre-tête'], ok: 0,
      why: 'Il encaisse la pression et restitue le grave.' },
    { q: 'Une chorale d’enfants, quel dispositif ?',
      a: ['Une paire de statiques devant et au-dessus du chœur', 'Un SM58 par enfant', 'Un SM58 à 2 m', 'Aucun micro, jamais'], ok: 0,
      why: 'Les statiques captent bien à distance. Un dynamique à 2 m ne capte quasiment rien.' },
    { q: '« Façade » désigne…',
      a: ['Les enceintes tournées vers le public', 'Les enceintes au sol pour les musiciens', 'Le devant de la console', 'Le rideau'], ok: 0,
      why: 'Façade = le son pour le public. Les « retours » sont pour les musiciens.' },
    { q: 'Le côté « jardin » de la scène, c’est…',
      a: ['La gauche vue depuis le public', 'La droite vue depuis le public', 'Le fond de scène', 'L’avant-scène'], ok: 0,
      why: 'Moyen mnémotechnique : J comme Jésus-Christ, J comme Jardin à gauche… vu de la salle. Cour à droite.' },
    { q: 'Un envoi auxiliaire « pré-fader » sert surtout pour…',
      a: ['Les retours : le musicien garde son mix même si tu bouges le fader façade', 'La réverbe', 'Le master', 'Le coupe-bas'], ok: 0,
      why: 'En pré-fader, le niveau envoyé aux retours ne dépend pas des faders de façade.' },
    { q: 'Le niveau maximal autorisé dans un lieu recevant du public en France (moyenne 15 min) ?',
      a: ['102 dB(A)', '85 dB(A)', '120 dB(A)', 'Il n’y en a pas'], ok: 0,
      why: 'Décret de 2017 : 102 dB(A) et 118 dB(C), et 94 dB(A) pour les spectacles destinés aux tout-petits.' },
    { q: 'Le larsen d’un retour sonne souvent vers 2-3 kHz. Pour gagner de la marge…',
      a: ['On creuse cette bande sur l’EQ graphique du retour', 'On monte les aigus', 'On met plus de gain', 'On rapproche le retour du micro'], ok: 0,
      why: 'C’est « l’égalisation du retour » (ringing out) : on enlève quelques dB là où ça siffle en premier.' },
    { q: 'Avant d’allumer la sono, dans quel ordre ?',
      a: ['Console d’abord, enceintes amplifiées en dernier (et l’inverse à l’extinction)', 'Enceintes d’abord', 'Tout en même temps', 'Peu importe'], ok: 0,
      why: 'Allumer les enceintes en dernier évite le « boum » d’allumage dans les haut-parleurs.' },
    { q: 'Pourquoi demander à un chanteur de ne pas tenir le micro par la grille ?',
      a: ['Ça rend le micro omnidirectionnel : larsen et son étouffé', 'Pour l’hygiène uniquement', 'Ça décharge la pile', 'Ça n’a aucune importance'], ok: 0,
      why: 'Les ouïes arrière de la grille créent la directivité. Les boucher, c’est perdre la réjection arrière.' }
  ];

  const api = {
    BANDS, BAND_LABELS, MICS, MIC_ORDER, PATTERNS, SOURCES, SOURCE_ORDER, VENUE,
    INVENTORY, SCENES, LIMITS, QUIZ, suitability
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SonoData = api;
})(this);
