# PixVerse pour la vidéo de l’institutrice

La page isolée `pixverse-admin.html` crée un clip Image-to-Video V6 de 10 secondes à partir d’une image portrait complète. Elle n’est pas intégrée au parcours des élèves.

## Configuration de l’environnement Vercel

Ajouter ces variables dans le projet Vercel de test, pour l’environnement **Preview** :

- `PIXVERSE_API_KEY` : clé API de la PixVerse Platform. Elle reste uniquement côté serveur.
- `HARMONIE_BRIDGE_TOKEN` : jeton privé d’accès à la page d’administration. Utiliser une valeur aléatoire longue, distincte de la clé PixVerse.

Ne jamais mettre l’une ou l’autre valeur dans le code, dans une URL ou dans le dépôt. La page demande le jeton Harmonie en mémoire pour la session ; il n’est pas enregistré dans le navigateur.

Après le déploiement Preview, ouvrir `/pixverse-admin.html`, entrer le jeton Harmonie, puis choisir une image source nette d’au moins 720 × 1280 px, au ratio 9:16, avec une marge autour de la tête, des bras, de la règle et des chaussures. La page propose 1080p par défaut et demande confirmation avant de lancer une tâche facturée.

## Vérifications locales

```sh
node ardoise-magique/pixverse-bridge.test.cjs
node ardoise-magique/smoke.test.cjs
```

La génération utilise l’API Platform PixVerse : upload d’image, création vidéo, puis interrogation du statut. Vérifier le résultat sur iPad Safari avant de l’intégrer au module de classe.
