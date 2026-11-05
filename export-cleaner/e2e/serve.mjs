// Builds the app exactly as Vercel does (vite build), into a temporary folder,
// and serves it on its own port for the tests. The app's own dist/ and its dev
// server on port 3400 are never touched. Vite is the app's own copy, found in
// export-cleaner/node_modules.
//
// The waitlist address is replaced with one that can't exist (.invalid never
// resolves), and the build is checked for any Supabase address before it's
// served, so a test can never reach the real waitlist table.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORT, WAITLIST_URL } from './support/env.js';
import { CACHE_PATH, serveCached } from './support/cache.js';

const app = fileURLToPath(new URL('..', import.meta.url));
const outDir = path.join(os.tmpdir(), 'export-cleaner-e2e-build');
const envDir = path.join(os.tmpdir(), 'export-cleaner-e2e-env'); // empty: .env.local is never read

let vite;
try {
  vite = await import('vite');
} catch {
  console.error('Vite is missing. Run `npm install` in the export-cleaner folder first.');
  process.exit(1);
}

fs.mkdirSync(envDir, { recursive: true });
process.env.VITE_SUPABASE_URL = WAITLIST_URL;
process.env.VITE_SUPABASE_ANON_KEY = 'e2e-not-a-real-key';

await vite.build({ root: app, envDir, logLevel: 'error', build: { outDir, emptyOutDir: true } });

for (const file of fs.readdirSync(path.join(outDir, 'assets'))) {
  if (!file.endsWith('.js')) continue;
  if (fs.readFileSync(path.join(outDir, 'assets', file), 'utf8').includes('supabase.co')) {
    console.error(`The test build contains a Supabase address (${file}); refusing to serve it.`);
    process.exit(1);
  }
}

// The kept AI model and OCR files, at /__e2e-cache/ (see support/cache.js).
const modelCache = {
  name: 'e2e-model-cache',
  configurePreviewServer(server) {
    server.middlewares.use(CACHE_PATH, serveCached);
  },
};

const server = await vite.preview({
  root: app,
  envDir,
  logLevel: 'error',
  plugins: [modelCache],
  build: { outDir },
  preview: { port: PORT, strictPort: true },
});
console.log(`Export Cleaner test build on http://localhost:${PORT}`);
process.on('SIGTERM', () => server.close().then(() => process.exit(0)));
