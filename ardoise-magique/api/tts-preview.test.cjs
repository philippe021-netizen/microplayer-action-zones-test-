const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('./tts-preview.js');

function response() {
  return {
    headers: {},
    statusCode: 200,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    send(body) { this.body = body; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('serves a cached MP3 preview from Google TTS without exposing the API key', async () => {
  const previousFetch = global.fetch;
  const previousKey = process.env.GOOGLE_TTS_API_KEY;
  process.env.GOOGLE_TTS_API_KEY = 'test-secret';
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ audioContent: Buffer.from('mp3-audio').toString('base64') }) };
  };
  try {
    const req = { method: 'GET' };
    const res = response();
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['Content-Type'], 'audio/mpeg');
    assert.match(res.headers['Cache-Control'], /s-maxage=86400/);
    assert.equal(res.body.toString(), 'mp3-audio');
    assert.doesNotMatch(JSON.stringify(res.headers), /test-secret/);
    assert.equal(request.url, 'https://texttospeech.googleapis.com/v1/text:synthesize?key=test-secret');
    const payload = JSON.parse(request.options.body);
    assert.equal(payload.voice.name, 'fr-FR-Neural2-F');
    assert.equal(payload.audioConfig.speakingRate, 0.8);
    assert.equal(payload.audioConfig.pitch, 8);
    assert.match(payload.input.text, /Prête pour le défi des maths/);
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GOOGLE_TTS_API_KEY;
    else process.env.GOOGLE_TTS_API_KEY = previousKey;
  }
});

test('rejects non-GET requests without calling Google TTS', async () => {
  const previousFetch = global.fetch;
  global.fetch = async () => { throw new Error('Google should not be called'); };
  try {
    const res = response();
    await handler({ method: 'POST' }, res);
    assert.equal(res.statusCode, 405);
    assert.deepEqual(res.body, { error: 'Method not allowed' });
  } finally {
    global.fetch = previousFetch;
  }
});
