/* Progression conforme aux photographies des devoirs, octobre 2026.
   Marches 1/2/3 : graphies de la fiche "Orthographe Cycle 2". */
window.HARMONIE_DATA = Object.freeze({
  words: {
    u: {
      1: ["la rue","un fruit","une voiture","du sucre","de la confiture","un nuage"],
      2: ["je suis","une plume","des lunettes","un pull","la musique","la rue"],
      3: ["la nature","plus","surtout","sur","dessus","aujourd’hui"]
    },
    ou: {
      1: ["un loup","une souris","rouge","la route","une journée","la soupe","toujours"],
      2: ["oui","une couleur","bonjour","beaucoup","aujourd’hui","pour"],
      3: ["la cour","autour","sous","dessous","tout","surtout","douze"]
    }
  },
  // Une seule liste de trois missions par date ; aucun jeu imposé hors garde.
  schedule: {
    "2026-10-18": [["Lecture du son u","read-u",1],["Les dizaines et unités","tens",1],["La machine à remonter le temps","time",1]],
    "2026-10-19": [["Les mots en u — marche 1","spell-u",1],["La dizaine magique","subtract",1],["Les phrases négatives","negative",1]],
    "2026-10-20": [["L’ardoise du son u","write-u",1],["Les additions en morceaux","add",1],["Les amis de 10","friends",1]],
    "2026-10-26": [["Lecture du son ou","read-ou",1],["Les nombres jusqu’à 99","tens",2],["Le détective des phrases négatives","negative",2]],
    "2026-10-27": [["Les mots en ou — marche 1","spell-ou",1],["Les soustractions","subtract",2],["Passé, présent ou futur ?","time",2]],
    "2026-10-30": [["Les mots en ou — marche 2","spell-ou",2],["Les additions avec retenue","add",2],["Le détective des phrases négatives","negative",3]],
    "2026-10-31": [["L’ardoise du son ou","write-ou",1],["Les amis de 10","friends",2],["Les phrases négatives","negative",3]],
    "2026-11-01": [["Révision des mots en ou","spell-ou",1],["Passé, présent, futur","time",2],["Entraînement à la négation","negative",3]],
    "2026-11-02": [["Orthographe ou — révision","spell-ou",2],["Tables d’addition","add",3],["Entraînement à la négation","negative",3]],
    "2026-11-03": [["Les mots en ou — dernier tour","write-ou",2],["Calculs jusqu’à 99","subtract",3],["Mini-évaluation des négations","negative",4]]
  },
  // Les réponses sont vérifiées par le moteur, jamais inventées par une IA.
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
  // Dates connues dans Google Agenda : calendriers de garde Philippe / Maud.
  guardDays: ["2026-10-18","2026-10-19","2026-10-20","2026-10-26","2026-10-27","2026-10-30","2026-10-31","2026-11-01","2026-11-02","2026-11-03"],
  maxMinutes: 30
});
