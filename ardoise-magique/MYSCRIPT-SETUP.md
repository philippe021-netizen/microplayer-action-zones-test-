# Harmonie — activation du correcteur MyScript

Le correcteur automatique d'écriture est déjà câblé dans `ardoise-magique/api/recognize-handwriting.js`.

## Fonctionnement

1. Harmonie écrit avec le doigt ou l'Apple Pencil.
2. Les traits sont envoyés au serveur Vercel.
3. Le serveur appelle MyScript iink REST `/api/v4.0/iink/recognize/`.
4. La transcription reconnue reste côté serveur et n'est jamais affichée à l'enfant.
5. Le serveur renvoie uniquement :
   - `match: true/false`
   - les positions des fautes éventuelles.
6. L'interface affiche Bravo ou la correction au tableau.

## Variables Vercel obligatoires

Créer deux variables **Sensitive** dans le projet Vercel :

- `MYSCRIPT_APPLICATION_KEY`
- `MYSCRIPT_HMAC_KEY`

Cibles recommandées :
- Preview
- Production

Ne jamais placer ces valeurs dans `classroom.js`, `index.html`, localStorage ou un fichier GitHub.

## Vérification sûre

`GET /api/recognize-handwriting`

retourne seulement :

```json
{"ok":true,"provider":"myscript","configured":true,"language":"fr_FR"}
```

Aucune clé n'est renvoyée.

## Règles de correction

- français `fr_FR`
- casse ignorée
- espaces multiples normalisés
- apostrophe typographique normalisée
- accents obligatoires : `frere` n'est pas accepté pour `frère`
- lexique de la leçon envoyé à MyScript
- timestamps Apple Pencil normalisés avant reconnaissance
