/* Révisions de Toussaint à partir des photos des devoirs et de la fiche
   « Orthographe Cycle 2 ». Les marches sont cumulatives pour les mots à observer et écrire. */
window.HARMONIE_DATA = Object.freeze({
  words: {
    r: {
      1: ["une rue","le roi","le repas","un arbre","mon frère","un fruit","une voiture","trois"],
      2: ["la reine","ma mère","mon père","après","il roule","la route","quatre"],
      3: ["rond","ronde","aujourd’hui","hier","derrière","un carré","ma sœur"]
    },
    u: {
      1: ["la rue","un fruit","une voiture","du sucre","de la confiture","un nuage"],
      2: ["je suis","une plume","des lunettes","un pull","la musique","la rue"],
      3: ["la nature","plus","surtout","sur","dessus","aujourd’hui"]
    },
    ou: {
      1: ["un loup","une souris","rouge","la route","une journée","la soupe"],
      2: ["oui","une couleur","bonjour","beaucoup","aujourd’hui","pour"],
      3: ["la cour","autour","sous","dessous","tout","surtout","douze"]
    },
    eu: {
      1: ["un cheval","des chevaux","devant","ma sœur","la peur","la leçon","une fleur","des fleurs","les yeux"],
      2: ["heureux","un cheveu","des cheveux","un œuf","des œufs","deux"],
      3: ["joyeux","le cœur","dehors","demain","peut-être","une heure"]
    },
    o: {
      1: ["un homme","une photo","un manteau","chaud","chaude","comme","beau","jaune","beaucoup"],
      2: ["un gâteau","une école","dehors","un chapeau","gros","grosse","de l’eau"],
      3: ["un oiseau","des oiseaux","comment","alors","encore","l’automne","aussi","autour"]
    },
    p: {
      1: ["je m’appelle","petit","petite","je porte","il porte","un panier","propre","un sport","sportif","sportive","un pantalon","des pantalons"],
      2: ["après","l’après-midi","une jupe","un chapeau","une écharpe","peut-être","un poisson","pauvre"],
      3: ["mes parents","du papier","parce que","un hôpital","le pied","la pluie","la patte"]
    },
    t: {
      1: ["une histoire","les bottes","des lunettes","un tableau","la maîtresse","trois","huit","treize","quatorze"],
      2: ["le travail","j’attrape","il attrape","une étoile","des étoiles","une fenêtre","trop"],
      3: ["peut-être","l’hôpital","toujours","le maître","de la terre","tôt","tard","très"]
    }
  },
  // Trois jeux quotidiens du 18 octobre au 3 novembre, y compris les jours
  // sans garde chez Philippe. Le jour de jeu reste le jour affiché.
  schedule: {
    "2026-10-18": [["Lecture du son u","read-u",1],["Les dizaines et unités","tens",1],["La machine à remonter le temps","time",1]],
    "2026-10-19": [["Observe et écris les mots en u — marche 1","spell-u",1],["La dizaine magique","subtract",1],["Les phrases négatives","negative",1]],
    "2026-10-20": [["L’ardoise du son u","write-u",1],["Les additions en morceaux","add",1],["Les amis de 10","friends",1]],
    "2026-10-21": [["Lecture du son r","read-r",1],["Observe et écris les mots du son r","spell-r",1],["Dizaines et unités","tens",1]],
    "2026-10-22": [["Écriture cursive du son r","write-r",2],["Soustractions par la dizaine","subtract",1],["Passé, présent ou futur ?","time",1]],
    "2026-10-23": [["Lecture du son p","read-p",1],["Observe et écris les mots du son p","spell-p",1],["Les amis de 10","friends",1]],
    "2026-10-24": [["Écriture cursive du son p","write-p",1],["Additions avec retenue","add",1],["Les phrases négatives","negative",1]],
    "2026-10-25": [["Lecture du son ou","read-ou",1],["Observe et écris les mots du son ou","spell-ou",1],["Soustractions par la dizaine","subtract",2]],
    "2026-10-26": [["Écriture cursive du son ou","write-ou",1],["Les nombres jusqu’à 99","tens",2],["Le détective des phrases négatives","negative",2]],
    "2026-10-27": [["Observe et écris les mots en ou — marche 2","spell-ou",2],["Les additions avec retenue","add",2],["Passé, présent ou futur ?","time",2]],
    "2026-10-28": [["Lecture du son eu","read-eu",1],["Observe et écris les mots du son eu","spell-eu",1],["Ordre alphabétique — 1re lettre","alphabet",1]],
    "2026-10-29": [["Écriture cursive du son eu","write-eu",2],["Les amis de 10","friends",2],["Soustractions par la dizaine","subtract",2]],
    "2026-10-30": [["Lecture du son o","read-o",1],["Observe et écris les mots du son o","spell-o",1],["Le détective des phrases négatives","negative",3]],
    "2026-10-31": [["Écriture cursive du son o","write-o",2],["Ordre alphabétique — 2e lettre","alphabet",2],["Les additions avec retenue","add",2]],
    "2026-11-01": [["Lecture du son t","read-t",1],["Observe et écris les mots du son t","spell-t",1],["Passé, présent ou futur ?","time",2]],
    "2026-11-02": [["Lecture du son u","read-u",1],["Soustraire en passant par la dizaine","subtract",3],["Nombres jusqu’à 99","tens",2]],
    "2026-11-03": [["Écriture cursive du son ou","write-ou",2],["Calculs jusqu’à 99","add",3],["Mini-évaluation des négations","negative",4]]
  },
  questions: {
    time: [
      ["Hier, nous avons joué.", "passé"],
      ["Demain, je ferai du vélo.", "futur"],
      ["Aujourd’hui, je mange une pomme.", "présent"],
      ["La semaine dernière, il pleuvait.", "passé"],
      ["En ce moment, elle dessine.", "présent"],
      ["Bientôt, nous partirons.", "futur"],
      ["Hier soir, j’ai lu un livre.", "passé"],
      ["Plus tard, tu seras grande.", "futur"]
    ],
    negative: [
      ["Il joue dans le jardin.", "Il ne joue pas dans le jardin.", "Il joue pas dans le jardin."],
      ["Elle aime les fraises.", "Elle n’aime pas les fraises.", "Elle ne aime pas les fraises."],
      ["Nous chantons.", "Nous ne chantons pas.", "Nous chantons jamais."],
      ["J’écoute la musique.", "Je n’écoute pas la musique.", "Je ne écoute pas la musique."],
      ["Tu cours vite.", "Tu ne cours pas vite.", "Tu cours ne pas vite."],
      ["On regarde les étoiles.", "On ne regarde pas les étoiles.", "On regarde pas les étoiles."],
      ["Il a un vélo.", "Il n’a pas de vélo.", "Il ne a pas un vélo."],
      ["Elles jouent dehors.", "Elles ne jouent pas dehors.", "Elles jouent ne pas dehors."]
    ]
  },
  maxMinutes: 30
});
