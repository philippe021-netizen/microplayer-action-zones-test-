'use strict';
const { Readable } = require('node:stream');
const SOURCE = 'https://d2ol7oe51mr4n9.cloudfront.net/user_3CNZlGstqB82H8rW1cNlNbHQ2QU/a6a9e8b3-10e2-4370-abf7-0ec79f96a197.mp4';

module.exports = async function handler(req, res) {
  if (!['GET','HEAD'].includes(req.method)) {
    res.setHeader('Allow','GET, HEAD');
    return res.status(405).end();
  }
  try {
    const headers = {};
    if (req.headers.range) headers.Range = req.headers.range;
    const upstream = await fetch(SOURCE, { method: req.method, headers });
    if (!upstream.ok && upstream.status !== 206) return res.status(502).end();

    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'video/mp4');
    res.setHeader('Accept-Ranges', upstream.headers.get('accept-ranges') || 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    for (const name of ['content-length','content-range','etag','last-modified']) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    if (req.method === 'HEAD' || !upstream.body) return res.end();
    return Readable.fromWeb(upstream.body).pipe(res);
  } catch {
    return res.status(502).end();
  }
};
