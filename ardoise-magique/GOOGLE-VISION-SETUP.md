# Harmonie — Google Vision handwriting OCR

The handwriting corrector now uses Google Cloud Vision instead of MyScript.

## Runtime flow
- iPad/Safari keeps the child's original ink visible on the classroom canvas.
- On “J’ai fini !”, the browser redraws only the written strokes on a cropped white PNG.
- The PNG is sent to the Vercel server function.
- The server calls Google Cloud Vision with `DOCUMENT_TEXT_DETECTION` and French language hint.
- The recognized text is compared server-side with the expected lesson answer.
- The recognized transcription is never returned to or displayed to the child.
- The API returns only `match`, `quality`, and `mistakePositions`.

## Secret
Vercel variable:
- `GOOGLE_VISION_API_KEY`

The Google API key is restricted to:
- `vision.googleapis.com`

Never place the key in browser JavaScript, HTML, localStorage, or GitHub.

## Correction rules
- French text normalization
- case-insensitive
- typographic apostrophe normalized
- repeated spaces normalized
- accents remain required for spelling
- math answers normalized separately
