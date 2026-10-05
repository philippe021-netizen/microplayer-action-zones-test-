'use strict';

const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const pixverseService = require('../lib/pixverseService');

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

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
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || bytes.toString('base64') !== match[2]) return null;
  return { mimeType: match[1], bytes };
}

function logTechnicalError(stage, error) {
  console.error('Harmonie PixVerse ' + stage, {
    code: error?.code || 'UNEXPECTED_ERROR',
    details: error?.details || {},
    name: error?.name || 'Error'
  });
}

function publicErrorCode(error) {
  const code = error?.code;
  if (['PIXVERSE_NO_CREDITS', 'PIXVERSE_TIMEOUT', 'PIXVERSE_NETWORK_ERROR', 'PIXVERSE_MODERATION_REFUSED', 'PIXVERSE_GENERATION_FAILED', 'PIXVERSE_DOWNLOAD_ERROR'].includes(code)) return code;
  if (code === 'INVALID_IMAGE') return 'INVALID_IMAGE';
  if (code === 'INVALID_VIDEO_ID') return 'INVALID_VIDEO_ID';
  return 'PIXVERSE_UNAVAILABLE';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
  }

  const bridgeToken = process.env.HARMONIE_BRIDGE_TOKEN;
  if (!bridgeToken) return json(res, 503, { ok: false, code: 'BRIDGE_NOT_CONFIGURED' });
  if (!constantTimeMatch(req.headers?.authorization?.replace(/^Bearer\s+/i, ''), bridgeToken)) {
    return json(res, 401, { ok: false, code: 'UNAUTHORIZED' });
  }
  if (!process.env.PIXVERSE_API_KEY) return json(res, 503, { ok: false, code: 'PIXVERSE_NOT_CONFIGURED' });

  let input;
  try {
    input = parseBody(req.body);
  } catch {
    return json(res, 400, { ok: false, code: 'INVALID_JSON' });
  }

  if (input.action === 'status') {
    try {
      const result = await pixverseService.getVideoStatus(String(input.videoId || ''));
      return json(res, 200, { ok: true, status: result.status, outputWidth: result.outputWidth, outputHeight: result.outputHeight });
    } catch (error) {
      logTechnicalError('status', error);
      return json(res, error?.code === 'INVALID_VIDEO_ID' ? 400 : 502, { ok: false, code: publicErrorCode(error) });
    }
  }

  if (input.action === 'download') {
    try {
      const result = await pixverseService.getVideoStatus(String(input.videoId || ''));
      if (result.status !== 1 || !result.url) return json(res, 409, { ok: false, code: 'VIDEO_NOT_READY' });
      const video = await pixverseService.downloadResult(result.url);
      res.setHeader('Cache-Control', 'private, no-store');
      const contentType = video.headers.get('content-type') || '';
      res.setHeader('Content-Type', contentType.startsWith('video/') ? contentType : 'video/mp4');
      res.setHeader('Content-Disposition', 'inline; filename="harmonie-animation.mp4"');
      const length = video.headers.get('content-length');
      if (length) res.setHeader('Content-Length', length);
      return Readable.fromWeb(video.body).pipe(res);
    } catch (error) {
      logTechnicalError('download', error);
      return json(res, error?.code === 'INVALID_VIDEO_ID' ? 400 : 502, { ok: false, code: publicErrorCode(error) });
    }
  }

  if (input.action !== 'generate') return json(res, 400, { ok: false, code: 'INVALID_ACTION' });
  const image = parseImageDataUrl(input.imageDataUrl);
  if (!image) return json(res, 400, { ok: false, code: 'INVALID_IMAGE' });
  const prompt = typeof input.prompt === 'string' ? input.prompt.trim().slice(0, 1800) : '';
  if (prompt.length < 30) return json(res, 400, { ok: false, code: 'INVALID_PROMPT' });
  const quality = input.quality === '720p' ? '720p' : '1080p';

  try {
    const imgId = await pixverseService.uploadImage(image);
    const videoId = await pixverseService.generateVideo({ imgId, prompt, quality, duration: 10 });
    return json(res, 200, { ok: true, videoId, duration: 10, quality, aspectRatio: '9:16', estimatedCredits: quality === '1080p' ? 180 : 120 });
  } catch (error) {
    logTechnicalError('generate', error);
    const code = publicErrorCode(error);
    const status = code === 'INVALID_IMAGE' ? 400 : code === 'PIXVERSE_NO_CREDITS' ? 402 : code === 'PIXVERSE_TIMEOUT' ? 504 : 502;
    return json(res, status, { ok: false, code });
  }
};
