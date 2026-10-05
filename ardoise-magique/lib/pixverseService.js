'use strict';

const crypto = require('node:crypto');
const API_ROOT = 'https://app-api.pixverse.ai/openapi/v2';
const REQUEST_TIMEOUT_MS = 45_000;
const MIME_EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

class PixVerseError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = 'PixVerseError';
    this.code = code;
    this.details = details;
  }
}

async function request(path, apiKey, { method = 'GET', body, form } = {}) {
  const headers = { 'API-KEY': apiKey, 'Ai-trace-id': crypto.randomUUID() };
  if (body) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(API_ROOT + path, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
      ...(form ? { body: form } : {}),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch (error) {
    throw new PixVerseError(error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'PIXVERSE_TIMEOUT' : 'PIXVERSE_NETWORK_ERROR', {
      name: error?.name || 'Error'
    });
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new PixVerseError('PIXVERSE_BAD_RESPONSE', { httpStatus: response.status });
  }

  const upstreamCode = Number(payload?.ErrCode);
  if (!response.ok || upstreamCode !== 0) {
    throw new PixVerseError(upstreamCode === 500090 ? 'PIXVERSE_NO_CREDITS' : 'PIXVERSE_UPSTREAM_ERROR', {
      httpStatus: response.status,
      upstreamCode: Number.isFinite(upstreamCode) ? upstreamCode : null,
      upstreamMessage: typeof payload?.ErrMsg === 'string' ? payload.ErrMsg.slice(0, 300) : ''
    });
  }
  return payload.Resp || {};
}

async function uploadImage({ bytes, mimeType }) {
  const extension = MIME_EXTENSIONS[mimeType];
  if (!extension || !Buffer.isBuffer(bytes) || !bytes.length) throw new PixVerseError('INVALID_IMAGE');
  const form = new FormData();
  form.append('image', new Blob([bytes], { type: mimeType }), 'harmonie-source.' + extension);
  const result = await request('/image/upload', process.env.PIXVERSE_API_KEY, { method: 'POST', form });
  const imgId = Number(result.img_id);
  if (!Number.isSafeInteger(imgId) || imgId <= 0) throw new PixVerseError('PIXVERSE_BAD_RESPONSE');
  return imgId;
}

async function generateVideo({ imgId, prompt, quality = '1080p', duration = 10 }) {
  if (!Number.isSafeInteger(Number(imgId)) || Number(imgId) <= 0) throw new PixVerseError('INVALID_IMAGE');
  const result = await request('/video/img/generate', process.env.PIXVERSE_API_KEY, {
    method: 'POST',
    body: {
      img_id: Number(imgId),
      model: 'v6',
      duration,
      quality,
      motion_mode: 'normal',
      prompt,
      negative_prompt: 'cropped head, cropped hair, cropped feet, cropped arms, cropped ruler, out of frame, camera movement, zoom, cut, extra person, text, watermark, blurry, deformed hands, duplicate limbs',
      generate_audio_switch: false
    }
  });
  const videoId = Number(result.video_id);
  if (!Number.isSafeInteger(videoId) || videoId <= 0) throw new PixVerseError('PIXVERSE_BAD_RESPONSE');
  return String(videoId);
}

async function getVideoStatus(videoId) {
  if (!/^\d{1,24}$/.test(String(videoId || ''))) throw new PixVerseError('INVALID_VIDEO_ID');
  const result = await request('/video/result/' + encodeURIComponent(videoId), process.env.PIXVERSE_API_KEY);
  const status = Number(result.status);
  if (![1, 5, 6, 7, 8].includes(status)) throw new PixVerseError('PIXVERSE_BAD_RESPONSE', { status });
  return {
    status,
    url: status === 1 && typeof result.url === 'string' ? result.url : null,
    outputWidth: Number(result.outputWidth) || null,
    outputHeight: Number(result.outputHeight) || null
  };
}

async function waitForVideo(videoId, { intervalMs = 5_000, timeoutMs = 7 * 60_000, onStatus } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await getVideoStatus(videoId);
    if (onStatus) await onStatus(result);
    if (result.status === 1) return result;
    if (result.status === 7) throw new PixVerseError('PIXVERSE_MODERATION_REFUSED');
    if ([6, 8].includes(result.status)) throw new PixVerseError('PIXVERSE_GENERATION_FAILED', { status: result.status });
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new PixVerseError('PIXVERSE_TIMEOUT');
}

async function downloadResult(url) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new PixVerseError('PIXVERSE_BAD_RESPONSE'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new PixVerseError('PIXVERSE_BAD_RESPONSE');
  try {
    const response = await fetch(parsed, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok || !response.body) throw new PixVerseError('PIXVERSE_DOWNLOAD_ERROR', { httpStatus: response.status });
    return response;
  } catch (error) {
    if (error instanceof PixVerseError) throw error;
    throw new PixVerseError(error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'PIXVERSE_TIMEOUT' : 'PIXVERSE_NETWORK_ERROR', {
      name: error?.name || 'Error'
    });
  }
}

module.exports = { PixVerseError, uploadImage, generateVideo, getVideoStatus, waitForVideo, downloadResult };
