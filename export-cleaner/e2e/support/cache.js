// The kept copies of the AI model and OCR files (e2e/.model-cache), shared by
// the test server, which hands them to the browser, and network.js, which
// fills it on the first run.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CACHE = fileURLToPath(new URL('../.model-cache/', import.meta.url));
export const CACHE_PATH = '/__e2e-cache/'; // where the test server serves them

export const cacheKey = (url) => crypto.createHash('sha1').update(url).digest('hex');
const bodyOf = (key) => path.join(CACHE, `${key}.body`);
const metaOf = (key) => path.join(CACHE, `${key}.json`);

export const isCached = (key) => fs.existsSync(metaOf(key));

export function keep(key, url, contentType, body) {
  fs.mkdirSync(CACHE, { recursive: true });
  const temp = `${bodyOf(key)}.${process.pid}.tmp`;
  fs.writeFileSync(temp, body);
  fs.renameSync(temp, bodyOf(key)); // whole files only, even if two tests fetch at once
  fs.writeFileSync(metaOf(key), JSON.stringify({ url, contentType }));
}

// Connect-style handler for the test server: answers whole files and byte
// ranges (the AI library asks for one byte first, to learn a file's size).
export function serveCached(req, res) {
  const key = req.url.replace(/^\//, '').split('?')[0];
  if (!/^[0-9a-f]{40}$/.test(key) || !isCached(key)) {
    res.statusCode = 404;
    return res.end();
  }
  const { contentType } = JSON.parse(fs.readFileSync(metaOf(key), 'utf8'));
  const total = fs.statSync(bodyOf(key)).size;
  res.setHeader('content-type', contentType ?? 'application/octet-stream');
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-expose-headers', '*');
  res.setHeader('accept-ranges', 'bytes');
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  let [start, end] = [0, total - 1];
  if (range) {
    start = range[1] ? Number(range[1]) : total - Number(range[2]);
    end = range[1] && range[2] ? Math.min(Number(range[2]), total - 1) : total - 1;
    res.statusCode = 206;
    res.setHeader('content-range', `bytes ${start}-${end}/${total}`);
  }
  res.setHeader('content-length', end - start + 1);
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(bodyOf(key), { start, end }).pipe(res);
}
