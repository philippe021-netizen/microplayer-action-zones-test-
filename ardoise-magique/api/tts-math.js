const LESSONS = {
  add: 'Coucou Harmonie ! Prête pour le défi des additions ? On sépare les dizaines et les unités. Soixante-trois, c’est soixante plus trois ; vingt-deux, c’est vingt plus deux. On additionne les dizaines : soixante plus vingt, ça fait quatre-vingts. Puis les unités : trois plus deux, ça fait cinq. Et hop, quatre-vingts plus cinq, ça fait quatre-vingt-cinq ! À toi de jouer !',
  subtract: 'Coucou Harmonie ! Pour soustraire en passant par la dizaine, enlève d’abord juste ce qu’il faut pour y arriver. Trente-six moins sept : on enlève six, et on arrive à trente. Il reste un à enlever : trente moins un, ça fait vingt-neuf. Et voilà ! À toi d’essayer !',
  numbers: 'Coucou Harmonie ! Pour trouver le nombre avant, recule d’un. Pour trouver celui d’après, avance d’un. Pour comparer, regarde quel nombre est le plus grand et choisis le bon signe : plus petit, plus grand ou égal. Sur la droite, chaque petite graduation avance d’un. Dans la bande, compte les nombres dans l’ordre. Prête ? À toi !',
  friends: 'Coucou Harmonie ! Pour trouver ce qui manque jusqu’à dix, compte en avançant. Par exemple, après six, il faut encore quatre pas : sept, huit, neuf, dix. Donc six plus quatre, ça fait dix ! À toi de jouer !',
  negative: 'Coucou Harmonie ! Pour mettre une phrase à la forme négative, encadre le verbe avec ne et pas. Par exemple : « Il joue » devient « Il ne joue pas ». Devant une voyelle, ne devient n’ : « Elle aime » devient « Elle n’aime pas ». À toi de jouer !',
  time: 'Coucou Harmonie ! La machine à remonter le temps a trois boutons. Hier, c’est le passé. Aujourd’hui, c’est le présent. Demain, c’est le futur. Cherche le mot qui indique quand l’action se passe, puis choisis le bon bouton !',
  alphabet: 'Coucou Harmonie ! Pour ranger les mots dans l’ordre alphabétique, compare leurs lettres en commençant par la première. Si elles sont pareilles, regarde la suivante. Le mot dont la première lettre arrive le plus tôt dans l’alphabet vient avant. À toi !',
  spell: 'Coucou Harmonie ! Regarde bien le mot pendant quelques secondes. Essaie de le photographier dans ta tête. Quand il disparaît, écris-le sur l’ardoise avec ton doigt. Puis vérifie chaque lettre. Prête ?',
  write: 'Coucou Harmonie ! Observe le modèle, puis écris le mot en attachant les lettres comme à l’école. Tu peux prendre ton temps et recommencer si tu en as besoin. À toi de jouer !',
  'read-r': 'Coucou Harmonie ! Cherche le son « r » dans les mots. Écoute bien et regarde les lettres : elles peuvent se trouver au début, au milieu ou à la fin. Choisis un mot de la bonne famille !',
  'read-u': 'Coucou Harmonie ! Cherche le son « u » dans les mots. Écoute bien et regarde les lettres : elles peuvent se trouver au début, au milieu ou à la fin. Choisis un mot de la bonne famille !',
  'read-ou': 'Coucou Harmonie ! Cherche le son « ou ». Il s’écrit avec les lettres o et u. Regarde bien le mot et choisis celui qui contient ce son !',
  'read-eu': 'Coucou Harmonie ! Cherche le son « eu » dans les mots. Regarde bien les lettres et prononce le mot doucement pour entendre son son. Choisis un mot de la bonne famille !',
  'read-o': 'Coucou Harmonie ! Cherche le son « o » dans les mots. Il peut s’écrire de plusieurs façons. Prononce le mot doucement et choisis celui de la bonne famille !',
  'read-p': 'Coucou Harmonie ! Cherche le son « p » dans les mots. Écoute bien le début, le milieu et la fin du mot. Choisis celui qui contient le son « p » !',
  'read-t': 'Coucou Harmonie ! Cherche le son « t » dans les mots. Écoute bien le début, le milieu et la fin du mot. Choisis celui qui contient le son « t » !',
};

module.exports = async function ttsMath(req, res) {
  if (req.method !== 'GET') return res.status(400).json({ error: 'Invalid request' });

  const url = new URL(req.url, 'https://localhost');
  if (url.searchParams.size !== 1 || !url.searchParams.has('lesson') || url.searchParams.getAll('lesson').length !== 1) {
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
