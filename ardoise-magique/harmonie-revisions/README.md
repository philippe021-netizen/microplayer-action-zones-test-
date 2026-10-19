# Harmonie — Révisions quotidiennes de la Toussaint 2026

Entrée de l'application : [index.html](./index.html), prévue pour Safari sur iPad. Les jeux existants dans `ardoise-magique/` et `harmonie-alphabet/` restent séparés.

## Programme

- Du 18 octobre au 3 novembre 2026 : trois missions par jour, sans journée vide dans le calendrier.
- Les missions portent sur les sept sons de la fiche « Orthographe Cycle 2 » : r, u, ou, eu, o, p et t. Les mots sont rangés dans les trois marches photographiées ; les activités d’observation et d’écriture des marches 2 et 3 reprennent les marches précédentes.
- La progression reprend aussi les devoirs photographiés : ordre alphabétique (première et deuxième lettres), dizaines et unités jusqu'à 99, additions avec retenue, soustractions en passant par la dizaine, compléments à 10, passé/présent/futur et phrases négatives.
- Les photos du cahier couvrent le planning scolaire du 5 au 9 octobre. Ces dates sont passées ; le calendrier de révision utilise donc des séances quotidiennes sur les vacances.

## Fonctionnement

- Trois mini-jeux par jour ; les séances d’aujourd’hui et des jours précédents restent jouables. Les journées futures sont consultables et se débloquent à leur date. Le quota de 30 minutes est suivi par date réelle de séance, y compris lorsqu’on reprend un devoir d’un jour précédent.
- Limite de 30 minutes d'activité par jour, avec arrêt automatique.
- Les mots à écrire restent visibles trois secondes avant l’ouverture de l’ardoise. Lili, une voix originale enregistrée pour Harmonie et ralentie pour être plus claire, présente les jeux d’écriture ; les mots en « u » sont joués en audio avant la première question. Après 30 secondes sans activité, une phrase taquine enregistrée est choisie au hasard, sans répétition immédiate. La synthèse vocale du navigateur n’est pas utilisée.
- Le morceau original « Claves de la mañana » joue en boucle pendant les missions ; son volume baisse quand Lili ou Gus parle pour que leurs voix restent compréhensibles. La voix et la musique peuvent chacune être coupées depuis les boutons en haut de page. Les animations et sons originaux de Gus dans `gus_media/` ne sont pas interrompus par la narration.
- Les séances anciennes restent rejouables. Leur temps de reprise est décompté du quota quotidien de 30 minutes du jour réel, afin de pouvoir reprendre dimanche puis continuer les devoirs d’aujourd’hui sans contourner la limite journalière.
- Tableau de bord parent, sauvegarde locale dans `localStorage` et export CSV. Il n'y a ni compte ni serveur.
- Liens vers les deux jeux préexistants.

## Limites connues

- L'ardoise ne reconnaît pas automatiquement l'écriture : l'enfant compare son tracé au modèle et confirme, ou demande à recommencer.
- Le suivi est local à Safari sur cet appareil. Il n'est pas partagé avec le PC et disparaît si les données du site sont effacées.
- Le calendrier est figé dans `data.js`; il ne se synchronise pas avec Google Agenda.
- La comptine et le texte complet du porte-vues ne sont pas intégrés : la photo fournie ne montre pas les pages de lecture correspondantes.
- Vérifier les pistes audio, le tracé tactile et la limite de séance sur Safari iPad avant fusion. Cette branche ne modifie pas `main`.

## Vérification

```bash
node --test harmonie-revisions/smoke.test.cjs
```
