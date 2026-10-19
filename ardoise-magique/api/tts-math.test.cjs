const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('./tts-math.js');

function response() {
  return {
    headers: {}, statusCode: 200,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    send(body) { this.body = body; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('serves each fixed math explanation with the approved slow, high French voice', async () => {
  const previousFetch = global.fetch;
  const previousKey = process.env.GOOGLE_TTS_API_KEY;
  process.env.GOOGLE_TTS_API_KEY = 'test-secret';
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({ audioContent: Buffer.from('math-mp3').toString('base64') }) };
  };
  try {
    for (const lesson of ['add', 'subtract', 'numbers', 'friends']) {
      const res = response();
      await handler({ method: 'GET', url: `/api/tts-math?lesson=${lesson}` }, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.headers['Content-Type'], 'audio/mpeg');
      assert.match(res.headers['Cache-Control'], /s-maxage=31536000/);
      assert.equal(res.body.toString(), 'math-mp3');
    }
    assert.equal(requests.length, 4);
    for (const { options } of requests) {
      const payload = JSON.parse(options.body);
      assert.equal(payload.voice.name, 'fr-FR-Neural2-F');
      assert.equal(payload.audioConfig.speakingRate, 0.8);
      assert.equal(payload.audioConfig.pitch, 8);
    }
    assert.match(JSON.parse(requests[0].options.body).input.text, /Prête pour le défi des additions/);
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GOOGLE_TTS_API_KEY;
    else process.env.GOOGLE_TTS_API_KEY = previousKey;
  }
});

test('rejects unknown lessons, extra query parameters, and non-GET requests', async () => {
  const previousFetch = global.fetch;
  global.fetch = async () => { throw new Error('Google should not be called'); };
  try {
    for (const req of [
      { method: 'GET', url: '/api/tts-math?lesson=other' },
      { method: 'GET', url: '/api/tts-math?lesson=add&cachebuster=1' },
      { method: 'POST', url: '/api/tts-math?lesson=add' },
    ]) {
      const res = response();
      await handler(req, res);
      assert.equal(res.statusCode, 400);
    }
  } finally {
    global.fetch = previousFetch;
  }
});

test('math lessons use the server generated voice endpoint rather than missing mp3 files', () => {
  const fs = require('node:fs');
  const app = fs.readFileSync(require('node:path').join(__dirname, '../harmonie-revisions/app.js'), 'utf8');
  assert.match(app, /file\.startsWith\("lili-math-"\)/);
  assert.match(app, /\/api\/tts-math\?lesson=/);
});
