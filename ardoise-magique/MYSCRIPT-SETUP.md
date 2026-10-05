# Harmonie — Google Vision handwriting OCR

Le correcteur d'écriture utilise désormais Google Cloud Vision.

## Flux

1. Harmonie écrit avec le doigt ou l'Apple Pencil.
2. Le navigateur recadre uniquement la zone réellement écrite.
3. Une image PNG noir sur blanc est générée localement.
4. L'image est envoyée à l'API serveur Vercel.
5. Le serveur appelle Google Vision avec `DOCUMENT_TEXT_DETECTION` et l'indication de langue française.
6. La transcription reste côté serveur.
7. Le navigateur reçoit uniquement :
   - `match: true/false`
   - `mistakePositions`

## Secret Vercel

Variable requise :

- `GOOGLE_VISION_API_KEY`

La clé doit rester de type Sensitive et ne jamais apparaître dans le navigateur ou GitHub.

## Projet Google Cloud

Projet :
- `harmonie-ardoise-philippe`

API activée :
- `vision.googleapis.com`

La clé API est restreinte à Cloud Vision uniquement.

## Règles de correction

- français
- casse ignorée
- espaces multiples normalisés
- apostrophe typographique normalisée
- accents obligatoires : `frere` n'est pas accepté pour `frère`
- la transcription OCR n'est jamais affichée à Harmonie
