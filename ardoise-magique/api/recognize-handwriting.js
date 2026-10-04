const crypto = require('node:crypto');

function normalizeText(value) {
  return String(value || '')
    .normalize('NFC')
    .toLocaleLowerCase('fr')
    .replace(/[’]/g, "'")
    .replace(/[.,;:!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function withoutDiacritics(value) {
  return normalizeText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED', message: 'POST uniquement.' });
  }

  const applicationKey = process.env.MYSCRIPT_APPLICATION_KEY;
  const hmacKey = process.env.MYSCRIPT_HMAC_KEY;
  if (!applicationKey || !hmacKey) {
    return res.status(503).json({ ok: false, code: 'MYSCRIPT_NOT_CONFIGURED', message: 'Clés MyScript non configurées.' });
  }

  try {
    const input = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const expected = String(input.expected || '').trim();
    const strokes = Array.isArray(input.strokes) ? input.strokes : [];
    const lexicon = Array.isArray(input.lexicon) ? input.lexicon.map(String).filter(Boolean).slice(0, 100) : [];

    if (!expected || !strokes.length) {
      return res.status(400).json({ ok: false, code: 'EMPTY_INK', message: 'Aucun mot à reconnaître.' });
    }

    const cleanStrokes = strokes
      .map((stroke, index) => ({
        id: String(index + 1),
        x: Array.isArray(stroke.x) ? stroke.x.map(Number).filter(Number.isFinite) : [],
        y: Array.isArray(stroke.y) ? stroke.y.map(Number).filter(Number.isFinite) : []
      }))
      .filter(stroke => stroke.x.length > 1 && stroke.x.length === stroke.y.length);

    if (!cleanStrokes.length) {
      return res.status(400).json({ ok: false, code: 'EMPTY_INK', message: 'Aucun trait exploitable.' });
    }

    const payload = {
      scaleX: 25.4 / 96,
      scaleY: 25.4 / 96,
      contentType: 'Text',
      configuration: {
        lang: 'fr_FR',
        text: {
          configuration: {
            customLexicon: lexicon,
            addLKText: true
          }
        }
      },
      strokes: cleanStrokes
    };

    const body = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha512', applicationKey + hmacKey).update(body, 'utf8').digest('hex');

    const upstream = await fetch('https://cloud.myscript.com/api/v4.0/iink/recognize/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/plain,application/json',
        'applicationKey': applicationKey,
        'hmac': hmac
      },
      body
    });

    const raw = await upstream.text();
    if (!upstream.ok) {
      console.error('MyScript recognition error', upstream.status, raw.slice(0, 500));
      return res.status(502).json({ ok: false, code: 'MYSCRIPT_ERROR', message: 'MyScript n’a pas pu lire l’écriture.' });
    }

    const recognized = normalizeText(raw);
    const wanted = normalizeText(expected);
    const exact = recognized === wanted;
    const accentTolerant = withoutDiacritics(recognized) === withoutDiacritics(wanted);

    return res.status(200).json({
      ok: true,
      match: exact || accentTolerant,
      quality: exact ? 'exact' : accentTolerant ? 'accent-tolerant' : 'different'
    });
  } catch (error) {
    console.error('Handwriting recognition failure', error);
    return res.status(500).json({ ok: false, code: 'RECOGNITION_ERROR', message: 'Erreur de reconnaissance.' });
  }
};
