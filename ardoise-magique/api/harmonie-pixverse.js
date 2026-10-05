const crypto = require('node:crypto');

const API_ROOT = 'https://app-api.pixverse.ai/openapi/v2';
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MIME_EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp'
};

function json(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}

function constantTimeMatch(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function parseBody(body) {
  if (typeof body === 'string') return JSON.parse(body || '{}');
  return body && typeof body === 'object' ? body : {};
}

function parseImageDataUrl(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return null;

  const mimeType = match[1];
  const base64 = match[2];
  const bytes = Buffer.from(base64, 'base64');
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || bytes.toString('base64') !== base64) return null;
  return { mimeType, bytes, extension: MIME_EXTENSIONS[mimeType] };
}

async function pixverseRequest(path, apiKey, method = 'GET', body) {
  const response = await fetch(`${API_ROOT}${path}`, {
    method,
    headers: {
      'API-KEY': apiKey,
      'Ai-trace-id': crypto.randomUUID(),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(45000)
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error('PIXVERSE_BAD_RESPONSE');
  }
  if (!response.ok || payload?.ErrCode !== 0) throw new Error('PIXVERSE_UPSTREAM_ERROR');
  return payload.Resp || {};
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
  }

  const bridgeToken = process.env.HARMONIE_BRIDGE_TOKEN;
  const apiKey = process.env.PIXVERSE_API_KEY;
  if (!bridgeToken) return json(res, 503, { ok: false, code: 'BRIDGE_NOT_CONFIGURED' });
  if (!constantTimeMatch(req.headers?.authorization?.replace(/^Bearer\s+/i, ''), bridgeToken)) {
    return json(res, 401, { ok: false, code: 'UNAUTHORIZED' });
  }
  if (!apiKey) return json(res, 503, { ok: false, code: 'PIXVERSE_NOT_CONFIGURED' });

  let input;
  try {
    input = parseBody(req.body);
  } catch {
    return json(res, 400, { ok: false, code: 'INVALID_JSON' });
  }

  if (input.action === 'status') {
    const videoId = String(input.videoId || '');
    if (!/^\d{1,24}$/.test(videoId)) return json(res, 400, { ok: false, code: 'INVALID_VIDEO_ID' });
    try {
      const result = await pixverseRequest(`/video/result/${videoId}`, apiKey);
      return json(res, 200, {
        ok: true,
        status: Number(result.status),
        url: Number(result.status) === 1 && typeof result.url === 'string' ? result.url : null,
        outputWidth: Number(result.outputWidth) || null,
        outputHeight: Number(result.outputHeight) || null
      });
    } catch {
      return json(res, 502, { ok: false, code: 'PIXVERSE_STATUS_ERROR' });
    }
  }

  if (input.action !== 'generate') return json(res, 400, { ok: false, code: 'INVALID_ACTION' });
  const image = parseImageDataUrl(input.imageDataUrl);
  if (!image) return json(res, 400, { ok: false, code: 'INVALID_IMAGE' });
  const prompt = typeof input.prompt === 'string' ? input.prompt.trim().slice(0, 4000) : '';
  if (prompt.length < 30) return json(res, 400, { ok: false, code: 'INVALID_PROMPT' });
  const quality = input.quality === '720p' ? '720p' : '1080p';

  try {
    const form = new FormData();
    form.append('image', new Blob([image.bytes], { type: image.mimeType }), `institutrice.${image.extension}`);
    const upload = await fetch(`${API_ROOT}/image/upload`, {
      method: 'POST',
      headers: { 'API-KEY': apiKey, 'Ai-trace-id': crypto.randomUUID() },
      body: form,
      signal: AbortSignal.timeout(45000)
    });
    let uploaded;
    try { uploaded = await upload.json(); } catch { throw new Error('PIXVERSE_BAD_RESPONSE'); }
    const imageId = uploaded?.Resp?.img_id;
    if (!upload.ok || uploaded?.ErrCode !== 0 || !Number.isFinite(Number(imageId))) {
      throw new Error('PIXVERSE_UPSTREAM_ERROR');
    }

    const result = await pixverseRequest('/video/img/generate', apiKey, 'POST', {
      img_id: Number(imageId),
      model: 'v6',
      duration: 10,
      quality,
      motion_mode: 'normal',
      prompt,
      negative_prompt: 'cropped head, cropped hair, cropped feet, cropped arms, cropped ruler, out of frame, camera movement, zoom, cut, extra person, text, watermark, blurry, deformed hands, duplicate limbs',
      sound_effect_switch: false
    });
    if (!Number.isFinite(Number(result.video_id))) throw new Error('PIXVERSE_BAD_RESPONSE');
    return json(res, 200, { ok: true, videoId: String(result.video_id), duration: 10, quality });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      return json(res, 504, { ok: false, code: 'PIXVERSE_TIMEOUT' });
    }
    return json(res, 502, { ok: false, code: 'PIXVERSE_GENERATION_ERROR' });
  }
};
