const LESSONS = {
  add: 'Coucou Harmonie ! Prête pour le défi des additions ? On sépare les dizaines et les unités. Soixante-trois, c’est soixante plus trois ; vingt-deux, c’est vingt plus deux. On additionne les dizaines : soixante plus vingt, ça fait quatre-vingts. Puis les unités : trois plus deux, ça fait cinq. Et hop, quatre-vingts plus cinq, ça fait quatre-vingt-cinq ! À toi de jouer !',
  subtract: 'Coucou Harmonie ! Pour soustraire en passant par la dizaine, enlève d’abord juste ce qu’il faut pour y arriver. Trente-six moins sept : on enlève six, et on arrive à trente. Il reste un à enlever : trente moins un, ça fait vingt-neuf. Et voilà ! À toi d’essayer !',
  numbers: 'Coucou Harmonie ! Pour trouver le nombre avant, recule d’un. Pour trouver celui d’après, avance d’un. Pour comparer, regarde quel nombre est le plus grand et choisis le bon signe : plus petit, plus grand ou égal. Sur la droite, chaque petite graduation avance d’un. Dans la bande, compte les nombres dans l’ordre. Prête ? À toi !',
  friends: 'Coucou Harmonie ! Pour trouver ce qui manque jusqu’à dix, compte en avançant. Par exemple, après six, il faut encore quatre pas : sept, huit, neuf, dix. Donc six plus quatre, ça fait dix ! À toi de jouer !',
};

module.exports = async function ttsMath(req, res) {
  if (req.method !== 'GET') return res.status(400).json({ error: 'Invalid request' });

  const url = new URL(req.url, 'https://localhost');
  if (url.searchParams.size !== 1 || !url.searchParams.has('lesson')) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  const text = LESSONS[url.searchParams.get('lesson')];
  if (!text) return res.status(400).json({ error: 'Invalid request' });

  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Voice is not configured' });

  try {
    const googleResponse = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: 'fr-FR', name: 'fr-FR-Neural2-F' },
          audioConfig: { audioEncoding: 'MP3', speakingRate: 0.8, pitch: 8 },
        }),
      },
    );

    if (!googleResponse.ok) return res.status(502).json({ error: 'Voice generation failed' });
    const result = await googleResponse.json();
    if (typeof result.audioContent !== 'string') {
      return res.status(502).json({ error: 'Voice audio was missing' });
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
    res.setHeader('Content-Disposition', 'inline; filename="harmonie-math.mp3"');
    return res.status(200).send(Buffer.from(result.audioContent, 'base64'));
  } catch {
    return res.status(502).json({ error: 'Voice generation failed' });
  }
};
