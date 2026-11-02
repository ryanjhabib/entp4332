# Export Cleaner: handoff (2026-11-01)

State of the app at the hand-over from Claude Code to Codex. Read this, then `INSIGHTS.md` (what to improve and why), `TESTING.md` (what's been tested) and `build-log.md` (every decision and break, with numbers).

Ongoing privacy and personal-data requirements, current evidence, and unfinished verification are in [`PRIVACY.md`](PRIVACY.md). Revisit it when changing data handling or dependencies and before public releases; it also records a monthly review cadence during active development.

## What it is
A Chrome web app (class project, ENTP 4332) that helps designers and photographers **find the final** among their exports. It opens a folder and groups every version of the same piece (re-edits months apart, crops, re-layouts, PDF/PNG twins) into families. Then it lets you compare versions side by side, keep the final, and move rejects into a `_to_delete` folder. **Positioning (Ryan's decision): finding the final comes first; freeing space is secondary.** Long term it becomes a paid Mac app (Tauri wrapping this UI) that runs in the background, watches export folders and can open Downloads. The web app is the free demo. Files never leave the computer.

## Run it
- `npm install`, then `npm run dev` → **http://localhost:3400** (port pinned with `--strictPort`). Desktop Chrome only (File System Access API).
- `npm run build` must pass before any commit.
- First folder: the image model (DINOv2 small, about 84 MB from Hugging Face) and the OCR data (jsDelivr) download once, then are cached.
- Chrome won't open Downloads, Desktop or Documents themselves, only folders inside them.
- Ryan added `localhost:3400` to Chrome's Memory Saver "always keep active" list. Any file edit reloads the dev page and wipes a run in progress.

## How it works
**Intro UI update (2026-11-02):** the start screen now says Syca, with “To start, drag or select a folder”, a native picker on italic/underlined select, and whole-intro folder dropping. Five stretch columns, 24px margins, 12px gutters, 36px Garamond Regular intro, 16px Medium brand/caption, `#EEEEEE` backdrop and a centered 2px white rule. Garamond uses antialiased rendering, matching RH Studio; the caption stays weight 500. Font files are bundled locally. See `TESTING.md` for measured layouts and input-test limits. Save progress remains unbuilt; CSS hot updates generally retain state, but HTML/JavaScript reloads can reset it.

**The flow:** choose/drop folder → the scan starts on the start screen (the white rule is its progress bar) → describe the media type (`src/media.js`; stored, not used for grouping yet) → one loading screen for the rest of the scan (read files → thumbnails → model preparation → describe each file → group) → overview (Families) ⇄ Compare stream → Summary → Apply → Done.

| File | Job |
|---|---|
| `index.html` | every screen as a `<section class="screen">`: start, files (overview), compare, summary, done, unsupported |
| `src/loading.js` | unified loading UI, monotonic progress tween, dots, scan messages, ETA and future fact rotation |
| `src/main.js` | state, the loading pipeline, overview rendering, view toggle, grouping levels, Apply / Done |
| `src/scan.js` | folder picker; reads top-level `png jpg jpeg webp avif gif tif tiff svg pdf` |
| `src/thumbs.js` | `renderAt(entry, size)` for every type; 320px thumbnails; 1600px previews; TIFF via UTIF.js; SVG viewBox fix |
| `src/pdf.js` | pdf.js wrappers: `withPdf`, `renderPage`, `readWords` |
| `src/describe.js` | per file: `vectors` (one per image, one per PDF page up to 50), `words` (PDF text, or OCR at 1600px), `shot` (EXIF), `colour` |
| `src/embed.js` | DINOv2 small via Transformers.js on WebGPU; CLS token, normalised; `similarity` = dot product |
| `src/ocr.js` | Tesseract.js, English, words at ≥80% confidence |
| `src/metadata.js` | exifr: capture moment + camera, Lightroom `OriginalDocumentID` |
| `src/group.js` | `nameStem`, `fileSimilarity`, strongest-first linking with a different-documents check, `orderByLook` |
| `src/compare.js` | the compare stream: winner stays on, Keep both, Same piece (S), Different (D), Not the same (N), undo, versions grid |
| `src/summary.js`, `src/apply.js` | summary screen; move rejects with `FileSystemFileHandle.move()`, falling back to copy → verify → remove |
| `src/dom.js`, `src/style.css` | helpers and formats; every colour, size and space is a CSS custom property in `:root` |

**Grouping rules:** see `INSIGHTS.md`, "How the app decides today". Levels: Loose 0.75 · Balanced 0.80 (default) · Strict 0.88.

**Decisions** are `entry.decision = 'keep' | 'reject'`. Undecided files are never moved; only Apply touches the disk.

## Testing (how this project has been tested)
- **Chrome DevTools** against http://localhost:3400. The native folder picker can't be automated, so tests replace `window.showDirectoryPicker` with a fake folder handle that returns real files with chosen dates. Helpers are in `test-images/fixtures.js`, which is git-ignored, along with all test images, including copies of a few of Ryan's real files.
- Folders: `modelTest()`, `pdfTest()`, `ocrTest()`, `formatTest()`, `lightroomTest()`, `sameShotTest()`, `bigFamilyTest()`, `bomberTest()`; `openInApp(folder)` opens one through the real button.
- **Gotchas** (all hit before, see build-log breaks 6, 8, 11):
  - Wait for something the new load *changes* (e.g. `0 decided`), not a condition that's already true.
  - Reload the tab after editing `main.js`.
  - The first import of a new npm package makes Vite reload the page once.
- Apply was tested on Chrome's sandboxed storage (OPFS). **On a real disk folder it's still to be confirmed by Ryan, on a duplicate folder.**

## Open issues and next steps
1. **Grouping quality:** follow the order in `INSIGHTS.md`. Short-text phrase rule → multi-scale crop matching → low-content guard → per-file content type replacing the levels → measure DINOv2-base → opt-in AI judge / grouping prompt.
2. **Save progress (IndexedDB)** so a reload or rescan doesn't redo every file (discussed with Ryan, not built).
3. **Compare:** switching to Families during a "same piece?" check skips that check on return; changing the grouping level undoes manual S/N fixes. Ideas agreed for later: flicker (spacebar swaps A/B in place) and linked zoom.
4. **Overview UX** for Ryan's design pass: multi-file families before singles; very large folders.
5. **Deploy to Vercel** (Hobby): ONNX runtime wasm is 26.9 MB (6.8 MB compressed) per first visit; the model and OCR data come from CDNs, not Vercel. Push only when Ryan says so.

## Status
Nothing has been pushed; every commit is local on `master` in the `entp4332` repo (this app lives in `export-cleaner/`). The repo also holds other class work and some uncommitted changes outside this folder that aren't ours: don't touch them.
