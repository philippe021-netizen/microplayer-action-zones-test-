# Harmonie — natural teacher voice

The classroom uses Google Cloud Text-to-Speech for the teacher voice.

- Provider: Google Cloud Text-to-Speech
- Voice: `fr-FR-Chirp3-HD-Leda`
- Secret: `GOOGLE_TTS_API_KEY`
- API key restriction: `texttospeech.googleapis.com`
- Audio encoding: MP3
- Browser cache: repeated teacher phrases are decoded once and cached in memory
- iPad playback: WebAudio is unlocked from the classroom interaction before the async TTS response returns
- Fallback: native `speechSynthesis` remains available only if cloud TTS fails

Teacher video stability:
- A1 idle video and A2 pointing video are now separate persistent `<video>` elements.
- Sources are assigned once at startup and are not swapped on every exercise.
- The WebGL chroma canvas stays in place while the active video changes.
