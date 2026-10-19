# Harmonie — Révisions quotidiennes de la Toussaint 2026

Entrée de l'application : [index.html](./index.html), prévue pour Safari sur iPad. Les jeux existants dans `ardoise-magique/` et `harmonie-alphabet/` restent séparés.

## Programme

- Du 18 octobre au 3 novembre 2026 : trois missions par jour, sans journée vide dans le calendrier.
- Les missions portent sur les sept sons de la fiche « Orthographe Cycle 2 » : r, u, ou, eu, o, p et t. Les mots sont rangés dans les trois marches photographiées ; les dictées et ardoises des marches 2 et 3 reprennent les marches précédentes.
- La progression reprend aussi les devoirs photographiés : ordre alphabétique (première et deuxième lettres), dizaines et unités jusqu'à 99, additions avec retenue, soustractions en passant par la dizaine, compléments à 10, passé/présent/futur et phrases négatives.
- Les photos du cahier couvrent le planning scolaire du 5 au 9 octobre. Ces dates sont passées ; le calendrier de révision utilise donc des séances quotidiennes sur les vacances.

## Fonctionnement

- Trois mini-jeux par jour ; le jeu reste activable uniquement à la date affichée. Les autres dates servent à consulter le programme.
- Limite de 30 minutes d'activité par jour, avec arrêt automatique.
- Dictées vocales en français, écriture cursive au doigt, correction progressive et explications des calculs.
- Tableau de bord parent, sauvegarde locale dans `localStorage` et export CSV. Il n'y a ni compte ni serveur.
- Liens vers les deux jeux préexistants.

## Limites connues

- La dictée utilise `speechSynthesis` et dépend des voix installées sur l'iPad. Safari peut demander un geste de l'utilisateur pour démarrer le son.
- L'ardoise ne reconnaît pas automatiquement l'écriture : l'enfant compare son tracé au modèle et confirme, ou demande à recommencer.
- Le suivi est local à Safari sur cet appareil. Il n'est pas partagé avec le PC et disparaît si les données du site sont effacées.
- Le calendrier est figé dans `data.js`; il ne se synchronise pas avec Google Agenda.
- La comptine et le texte complet du porte-vues ne sont pas intégrés : la photo fournie ne montre pas les pages de lecture correspondantes.
- Vérifier le son, le tracé tactile et la limite de séance sur Safari iPad avant fusion. Cette branche ne modifie pas `main`.

## Vérification

```bash
node --test harmonie-revisions/smoke.test.cjs
```
