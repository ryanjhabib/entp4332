# Export Cleaner end-to-end tests

Automated clicks through the real app in a real Chromium browser, with the real
AI scan. Kept separate from the app (its own `package.json`), so Vercel never
installs it, and nothing here changes the app.

## Run it (Mac)

Once, to install (about 200 MB, mostly the test browser):

```bash
cd export-cleaner/e2e && npm install && npx playwright install chromium
```

Each time:

```bash
cd export-cleaner/e2e && npm test
```

`npm test` builds the app into a temporary folder, serves it on port 3410 (your
dev server on 3400 is never touched), and runs every test. The first run also
downloads the AI models and OCR files once (about 150 MB) into
`e2e/.model-cache`; later runs use that copy. At the end it prints a summary:
how many checks passed, which failed, and what isn't checked yet and why.
Screenshots and step-by-step recordings of any failure go in `e2e/test-results`.

To watch it click through in a visible browser, one test at a time:

```bash
cd export-cleaner/e2e && npm run test:watch
```

## How it works

- **Folders:** the native folder picker can't be automated, so it's replaced by
  a stand-in that hands the app a folder in Chrome's private storage (OPFS).
  Each test draws its own pictures there (`support/browser.js`), so nothing
  depends on `test-images/`.
- **AI:** the real image model and OCR run, on the processor rather than the
  graphics card (the test browser has none).
- **Network:** anything leaving the computer other than the AI downloads is
  blocked and fails the test. The test build points the waitlist at an address
  that can't exist, so nothing can reach the real Supabase table.
- **Fresh start:** every test gets an empty browser profile.
