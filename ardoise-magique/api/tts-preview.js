const PREVIEW_TEXT = 'Coucou Harmonie ! Pour une addition, sépare les dizaines et les unités. Calcule chaque partie, puis rassemble le résultat. Pour une soustraction, descends d’abord jusqu’à la dizaine, puis enlève ce qu’il reste. Allez, on essaie ensemble !';

module.exports = async function ttsPreview(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Voice preview is not configured' });
  }

  try {
    const googleResponse = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text: PREVIEW_TEXT },
          voice: { languageCode: 'fr-FR', name: 'fr-FR-Neural2-F' },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 0.8,
            pitch: 2,
          },
        }),
      },
    );

    if (!googleResponse.ok) {
      return res.status(502).json({ error: 'Voice preview generation failed' });
    }

    const result = await googleResponse.json();
    if (typeof result.audioContent !== 'string') {
      return res.status(502).json({ error: 'Voice preview audio was missing' });
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, immutable');
    res.setHeader('Content-Disposition', 'inline; filename="harmonie-voice-preview.mp3"');
    return res.status(200).send(Buffer.from(result.audioContent, 'base64'));
  } catch {
    return res.status(502).json({ error: 'Voice preview generation failed' });
  }
};
