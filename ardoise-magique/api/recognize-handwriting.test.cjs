const test = require('node:test');
const assert = require('node:assert/strict');

const handler = require('./recognize-handwriting');

function responseMock() {
  return {
    code: 200,
    headers: {},
    body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('Google Vision lit une transcription manuscrite et renvoie son niveau de confiance', async () => {
  const previousKey = process.env.GOOGLE_VISION_API_KEY;
  const previousFetch = global.fetch;
  process.env.GOOGLE_VISION_API_KEY = 'unit-test-key';
  let upstreamUrl = '';
  let upstreamBody;
  global.fetch = async (url, options) => {
    upstreamUrl = String(url);
    upstreamBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        responses: [{
          fullTextAnnotation: {
            text: 'la roue',
            pages: [{ blocks: [{ paragraphs: [{ words: [{ symbols: [
              { confidence: 0.9 }, { confidence: 0.8 }
            ] }] }] }] }]
          }
        }]
      })
    };
  };

  try {
    const res = responseMock();
    await handler({ method: 'POST', body: { imageBase64: 'aGVsbG8=' } }, res);
    assert.equal(res.code, 200);
    assert.deepEqual(res.body, { ok: true, text: 'la roue', confidence: 85 });
    assert.match(upstreamUrl, /vision\.googleapis\.com\/v1\/images:annotate/);
    assert.match(upstreamUrl, /key=unit-test-key/);
    assert.equal(upstreamBody.requests[0].features[0].type, 'DOCUMENT_TEXT_DETECTION');
    assert.equal(upstreamBody.requests[0].imageContext.languageHints[0], 'mul-Latn-t-i0-handwrit');
    assert.equal(upstreamBody.requests[0].image.content, 'aGVsbG8=');
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GOOGLE_VISION_API_KEY;
    else process.env.GOOGLE_VISION_API_KEY = previousKey;
  }
});

test('Google Vision endpoint refuses missing credentials, malformed input, and wrong methods', async () => {
  const previousKey = process.env.GOOGLE_VISION_API_KEY;
  const previousFetch = global.fetch;
  delete process.env.GOOGLE_VISION_API_KEY;
  global.fetch = async () => { throw new Error('should not call Google Vision'); };
  try {
    let res = responseMock();
    await handler({ method: 'GET' }, res);
    assert.equal(res.code, 405);
    res = responseMock();
    await handler({ method: 'POST', body: { imageBase64: 'aGVsbG8=' } }, res);
    assert.equal(res.code, 503);
    process.env.GOOGLE_VISION_API_KEY = 'unit-test-key';
    res = responseMock();
    await handler({ method: 'POST', body: { imageBase64: 'not an image' } }, res);
    assert.equal(res.code, 400);
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GOOGLE_VISION_API_KEY;
    else process.env.GOOGLE_VISION_API_KEY = previousKey;
  }
});
