# Harmonie — Révisions de la Toussaint 2026

Nouvelle entrée : [index.html](./index.html) (ouvrir sur Safari iPad). Les applications existantes \`ardoise-magique/\` et \`harmonie-alphabet/\` restent inchangées.

## Éléments utilisés

- Devoirs photographiés : lire le son « u » pour le lundi 2/11 ; apprendre le son « ou » pour le 3, 5 et 6/11 ; numération à 99, soustraction en passant par la dizaine, additions avec retenue et tables ; compléments à 10 ; passé/présent/futur ; phrases négatives pour l’évaluation du 6/11.
- Fiche « Orthographe Cycle 2 » : mots de la semaine 6 (« u ») et semaine 7 (« ou »), marches 1, 2 et 3, retranscrits en \`data.js\`.
- Calendrier Google Agenda : gardes Philippe les 18, 19, 20, 26, 27, 30, 31 octobre et les 1, 2, 3 novembre 2026. Les dates sont une **copie statique** de l’agenda, pas une synchronisation automatique.

## Fonctionnalités

- Trois mini-jeux par jour de garde ; 30 minutes **au maximum d’activité** dans cette application, avec arrêt automatique à l’atteinte du plafond.
- Dix jours de programme, 30 missions, réponses multiples, dictées vocales en français, cursive avec le doigt, correction progressive, explications des calculs.
- Marches d'orthographe : dictée du niveau 2 = mots des marches 1 et 2 (cumulatif). Les mots de la marche 3 sont conservés dans les données pour une extension ultérieure.
- Tableau de bord parent ; sauvegarde dans \`localStorage\`, export CSV (pas de compte, pas de serveur).
- Liens vers les deux jeux préexistants.

## Limites connues

- La dictée utilise \`speechSynthesis\` ; dépend des voix installées sur iPad. Nécessite un geste utilisateur pour certains navigateurs.
- L'ardoise **ne fait pas de reconnaissance automatique de l'écriture**. L'enfant compare sa production au modèle.
- Le suivi est **local à Safari sur cet appareil** et disparaît si ses données sont effacées ; il n'est pas partagé entre iPad et PC.
- Le plafond porte sur le temps où un mini-jeu est ouvert au premier plan, pas sur le temps passé dans les menus.
- Le planning est figé : si la garde change, mettre à jour \`guardDays\` et \`schedule\` dans \`data.js\`.
- Les exercices de lecture utilisent des mots de la fiche, mais le texte, la comptine et la gamme de lecture du porte-vues ne sont pas reproduits faute de photos lisibles de ces pages.
- Tester en condition réelle sur Safari iPad avant fusion. Aucun déploiement en production n'est autorisé par cette branche seule.

## Vérifications

\`\`\`bash
node --test harmonie-revisions/smoke.test.cjs
\`\`\`

Les tests inspectent les listes de mots, les dates, le nombre de séances et la cohérence des références DOM. Des essais manuels sont nécessaires pour le son, le tracé tactile et les sessions de 30 minutes.
