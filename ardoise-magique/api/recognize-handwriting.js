const MAX_IMAGE_CHARS = 2_500_000;

function readConfidence(annotation) {
  const symbolScores = [];
  const wordScores = [];
  for (const page of annotation?.pages || []) {
    for (const block of page.blocks || []) {
      for (const paragraph of block.paragraphs || []) {
        for (const word of paragraph.words || []) {
          if (Number.isFinite(word.confidence)) wordScores.push(word.confidence);
          for (const symbol of word.symbols || []) {
            if (Number.isFinite(symbol.confidence)) symbolScores.push(symbol.confidence);
          }
        }
      }
    }
  }
  const scores = symbolScores.length ? symbolScores : wordScores;
  if (!scores.length) return 0;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length * 100);
}

module.exports = async function recognizeHandwriting(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'POST uniquement.' });
  }

  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) return res.status(503).json({ ok: false, message: 'La reconnaissance manuscrite est indisponible.' });

  let input = req.body || {};
  if (typeof input === 'string') {
    try { input = JSON.parse(input); }
    catch { return res.status(400).json({ ok: false, message: 'Image invalide.' }); }
  }
  const imageBase64 = String(input.imageBase64 || '');
  if (!imageBase64 || imageBase64.length > MAX_IMAGE_CHARS || !/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64)) {
    return res.status(400).json({ ok: false, message: 'Image invalide.' });
  }

  try {
    const upstream = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        requests: [{
          image: { content: imageBase64 },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          imageContext: { languageHints: ['mul-Latn-t-i0-handwrit'] }
        }]
      })
    });
    if (!upstream.ok) return res.status(502).json({ ok: false, message: 'Le lecteur n’a pas pu déchiffrer cette écriture. Réessaie.' });

    const response = await upstream.json();
    const annotation = response.responses?.[0]?.fullTextAnnotation;
    if (response.responses?.[0]?.error) {
      return res.status(502).json({ ok: false, message: 'Le lecteur n’a pas pu déchiffrer cette écriture. Réessaie.' });
    }
    const text = String(annotation?.text || '').trim().slice(0, 120);
    return res.status(200).json({ ok: true, text, confidence: readConfidence(annotation) });
  } catch {
    return res.status(502).json({ ok: false, message: 'Le lecteur n’a pas pu déchiffrer cette écriture. Réessaie.' });
  }
};
