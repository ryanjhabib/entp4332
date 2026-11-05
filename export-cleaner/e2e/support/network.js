// What the test browser may reach outside the app.
//
// - The AI models and OCR files the app downloads (Hugging Face, jsDelivr) are
//   real: the first run fetches them once and keeps a copy in e2e/.model-cache,
//   and from then on the browser is redirected to that copy on the test server,
//   so tests don't download 84 MB each. The real app still loads and runs the
//   real files; only where the bytes come from changes.
// - Supabase (the waitlist) can never be reached: the test build points the
//   waitlist at an address that can't exist, and any other request outside the
//   app is blocked and listed, which fails the test (see app.js). The waitlist
//   tests answer its call themselves.

import { PORT, WAITLIST_URL } from './env.js';
import { CACHE_PATH, cacheKey, isCached, keep } from './cache.js';

const APP = `http://localhost:${PORT}`;
const DOWNLOADS = /^https:\/\/(huggingface\.co|cdn\.jsdelivr\.net)\//;

async function fromCache(route) {
  const request = route.request();
  const url = request.url();
  const key = cacheKey(url);
  if (!isCached(key)) {
    // The whole file, even when the browser asked for a part of it.
    const { range, ...headers } = await request.allHeaders();
    const response = await route.fetch({ headers, timeout: 300_000 }); // follows Hugging Face's redirect to its CDN
    if (response.status() !== 200) return route.fulfill({ response });
    keep(key, url, response.headers()['content-type'], await response.body());
  }
  return route.fulfill({
    status: 307, // keeps the method and the range asked for
    headers: { location: `${APP}${CACHE_PATH}${key}`, 'access-control-allow-origin': '*' },
  });
}

// Sets up the rules on a browser context. Returns the list of blocked
// requests, which each test checks is empty when it ends.
export async function guardNetwork(context) {
  const blocked = [];
  await context.route(
    (url) => url.origin !== APP && !['blob:', 'data:'].includes(url.protocol),
    async (route) => {
      const url = route.request().url();
      if (DOWNLOADS.test(url)) return fromCache(route);
      if (url.startsWith(WAITLIST_URL)) return route.abort('internetdisconnected'); // unless a test answers it first
      blocked.push(url);
      return route.abort('blockedbyclient');
    },
  );
  return blocked;
}
