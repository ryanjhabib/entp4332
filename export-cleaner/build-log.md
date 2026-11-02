# Build log: Export Cleaner

Every break gets an entry: the exact error or symptom, the cause, the fix, and any dead ends on the way.

## Setup decisions (2026-10-27)

- **Vite + vanilla JS, not React.** The app has a handful of screens and one small `state` object. The swipe is pointer events plus a CSS `transform` either way, and React wouldn't make that simpler. It would add a build concept (components, re-rendering) without removing any code.
- **Chrome only.** The File System Access API (`showDirectoryPicker`) is the only way a web page can open a real folder and move files in it. Safari, Firefox, Brave and mobile browsers don't expose it, so they get a message instead of the app.
- **Read-only at first.** The folder is opened with `mode: 'read'`. Permission to move files is requested only at the Apply step, so the first prompt the user sees is the gentler "View files" one.
- **Dev port 3400**, pinned in `package.json`, so it never collides with Ryan's other projects (3000–3300, 3007).

## Step 2 decisions: thumbnails

- **Thumbnails are 320px on the longest side**, saved as WebP (keeps transparency; JPEG turns it black). They show at 160px+ in the grid, so 320 stays sharp on a retina screen.
- **Four at a time.** A 6000×4000 photo is about 96MB once decoded, so making all of them at once could exhaust memory on a big folder. Four keeps the CPU busy without that.
- **pdf.js loads only when a folder has a PDF.** It's the biggest dependency by far, and `import()` (a dynamic import) fetches it on first use instead of on page load.
- **One bad file never stops the scan.** A file that can't be decoded shows "No preview", and the rest carry on.

## Steps 3–4 decisions: hashing and grouping

- **The hash is made from the thumbnail canvas** at the moment the thumbnail is drawn, so no file is decoded twice. Transparent areas are filled white first (otherwise they read as black and every transparent logo looks alike).
- **The spec changed mid-build.** The first version grouped by "similar hash AND within a 2-hour window". The new version first splits files into **sessions**: sorted by `lastModified`, with a new session whenever the gap to the previous file exceeds 20 minutes. Then it groups by hash **only within a session**. That's better: an export burst is a natural unit, and a fixed 2-hour window would have chopped a long afternoon at arbitrary points.
- **Families use chaining** (union-find): if A looks like B and B looks like C, all three are one family, even if A and C are further apart. That keeps a run of small edits together.
- **Measured dHash distances** on six macOS wallpapers converted to JPG (`test-images/`, git-ignored), each run through the app's own 320px thumbnail path:

  | Same image, changed | Distance (of 64 bits) |
  |---|---|
  | resized to 1080 + JPEG quality 60 | 0–1 |
  | brighter + contrast | 0–1 |
  | warmer / saturated, black & white | 0–3 |
  | heavy grade (dark, contrasty, desaturated) | 0–7 |
  | same design, other colourway (iMac blue vs orange) | 2 |
  | **centre crop to another aspect ratio (4:5, 16:9, 9:16)** | **10–34** |
  | different images | 24–40 |

  So the default "same family" threshold is **10**: every edit is at 7 or below, and every different image at 24 or above.
- **Known limit:** dHash squashes every image to 9×8 regardless of shape, so a crop to a new aspect ratio usually reads as a different image. One 4:5 crop landed at exactly 10 and joined its family; the 16:9 and 9:16 crops didn't. "The same final in several aspect ratios" is **not** reliably grouped yet.
- **Cross-session merge suggestions are not built.** They only catch near-identical re-exports, not aspect-ratio variants (see the limit above), and merging families across sessions needs its own UI. Parked until the core loop works.

## Breaks

### 1. SVGs with only a `viewBox` would be letterboxed into 300×150

- **Symptom (caught in a probe before building the SVG path):** decoding test SVGs through an `<img>` in Chrome, `naturalWidth × naturalHeight` came back as:
  - `width="800" height="400"` → 800×400 (correct)
  - `viewBox="0 0 800 400"` only → **300×150**
  - `width="100%" height="100%"` + viewBox → **300×150**
  - no size at all → **300×150**
- **Cause:** an SVG with no fixed width and height has no intrinsic size, so Chrome falls back to the default replaced-element size of 300×150. The drawing is then fitted inside that box, so a tall 400×800 artwork would come out as a 2:1 thumbnail with empty bands. Figma and Illustrator often export with only a `viewBox`.
- **Fix:** before decoding, parse the SVG with `DOMParser`, copy the `viewBox` width and height into `width` and `height`, and serialise it back to a Blob (`svgBlob()` in `thumbs.js`). The viewBox-only 400×800 test file now makes a 160×320 thumbnail.
- **Known gap:** an SVG missing `xmlns="http://www.w3.org/2000/svg"` fails to decode ("The source image cannot be decoded") and shows "No preview". Design tools always write `xmlns`, so I left it.

### 2. Thumbnails stuck at "previews 2 of 8"

- **Symptom:** in the Claude desktop app's built-in browser, the two SVGs got thumbnails and everything else (JPG, WebP, PNG, PDF) never finished. There was no error in the console, because the promises simply never settled. The four workers were all stuck, so the two broken test files queued behind them never ran either.
- **Dead end 1:** my first test script called `location.reload()` and then kept going, so the reload killed the script. I re-ran it without the reload.
- **Dead end 2:** the built-in browser pane was hidden, and hidden pages throttle timers. I brought it to the front and it stayed stuck, so it wasn't that.
- **Isolating it:** I timed each call on its own with a 4–5s timeout on `logo_transparent.png`:
  - `img.decode()` → **timed out**
  - `createImageBitmap(file)` → ok, 800px wide
  - `canvas.toBlob(..., 'image/webp')` → ok
- **Cause:** `HTMLImageElement.decode()` never resolves for raster blob URLs in the built-in browser. **In real Chrome (via Chrome DevTools) the same call resolves fine**, so this is a quirk of the in-app browser, not a bug Chrome users would hit.
- **Fix anyway:** PNG, JPG and WebP now decode with `createImageBitmap()`. It's the API built for this job: it needs no `<img>`, applies EXIF rotation, and `bitmap.close()` frees the full-size pixels right after drawing. SVG still goes through `<img>`, because `createImageBitmap` can't read SVG. From now on I test in real Chrome, since that's the target.

### 3. `pdf.destroy is not a function` (pdf.js 6.4.299)

- **Symptom:** while isolating break 2, `TypeError: doc.destroy is not a function` was thrown from my cleanup code.
- **Cause:** pdf.js v6 removed `destroy()` from the document object (`PDFDocumentProxy`). Listing its methods shows `cleanup` but no `destroy`. Older tutorials, and my first draft, call `pdf.destroy()`.
- **Fix:** keep the loading task from `getDocument()` and call `task.destroy()` in a `finally`. That shuts down the document and its worker messages whether rendering succeeded or not.
- **Also seen:** `page.render()` timed out in the built-in browser but worked in real Chrome. It's the same in-app-browser quirk as break 2.

### 4. Tall thumbnails stretched their square box

- **Symptom (screenshot in Chrome):** the portrait WebP and the tall SVG pushed their grey box taller than wide (the SVG's was about 2× as tall), which pushed their names out of line with the rest of the row.
- **Cause:** a box sized with `aspect-ratio: 1` has an automatic minimum height equal to its content. A 100%-height `<img>` inside counts as content, so the box grew to fit it.
- **Fix:** `.thumb` is `position: relative` and the `<img>` is `position: absolute; inset: 0`, which takes it out of the box's sizing. Measured after: all 8 boxes 180×180 at a 1440px-wide window.
- **Same pass:** the date sat 16px below the file name because the global `p { margin-bottom }` applied to card captions. The captions now have `margin: 0`: name 8px under the box, date 0px under the name.

### 5. localhost:3400 went down between sessions

- **Symptom:** Ryan reported "localhost is down". The page wouldn't load.
- **Cause:** I had started `npm run dev` as a background task of the Claude session. When the session moved its working folder from `pricing-simulator/` to `export-cleaner/`, that background process was stopped with it. I also tried the app's built-in preview launcher, but it still looked for its config in the old folder.
- **Fix:** the dev server now runs in its own Terminal tab ("dev server :3400"), which outlives Claude's turns and which Ryan can see and stop with Ctrl-C.

### 6. Grouping test read "previews 0 of 14" and never finished

- **Symptom:** the first grouping test sat at `14 design files, oldest first · previews 0 of 14` for 15 seconds, with no sessions shown.
- **Cause:** "oldest first" is Step 2's wording. The Chrome tab was still running the old `main.js`, which treated the new `{ thumb, hash }` result from `makeThumbnail` as if it were the old plain URL. Vite's hot reload hadn't refreshed that tab after `main.js` was rewritten.
- **Fix:** a hard reload of the tab, then the same test: 14 files grouped in 153 ms. Lesson: reload before every test run after editing `main.js`.

## Step 5 decisions: the swipe screen

- **Decisions are stored on each file object** (`entry.decision = 'keep' | 'reject'`), not in a separate list. They survive regrouping (changing the session gap or similarity) because the files are the same objects. Nothing touches the disk.
- **Motion numbers:**

  | | Value |
  |---|---|
  | Drag distance that counts as a decision | 120px |
  | Tilt while dragging | 1° per 20px (6° at 120px) |
  | Fly-off | 200ms ease-in, to 60% of the window width, 15° tilt, fading to 0 |
  | Spring back (drag under 120px) | 200ms ease-out |
  | Keep/Reject label | fades in with drag distance, fully visible at 120px |

  Only `transform` and `opacity` animate, the two properties browsers can animate without re-laying out the page (kept light for Safari later).
- **Input is ignored while a card is flying off** (`busy` flag), so a double key press can't skip a file. Measured: the next card appears 267ms after →, which is the 200ms fly-off plus a frame.
- **Undo is one stack across families.** Finishing a family opens the next unfinished one automatically, and ⌘Z / Backspace can step back into the family before. "Keep all" / "Reject all" are one undo step. The stack is cleared on leaving the swipe screen; to change a decision after that, reopen the family from the overview.
- **Thumbnail first, full size second.** The card shows the 320px thumbnail instantly (it's already decoded), loads the full image in a detached `Image`, and swaps it in only once `decode()` finishes, so the card never flashes empty. Measured: 21ms for a 2000px JPG, 359ms for a PDF page rendered at 1600px.

### 7. Undo could silently lose a step (caught in review, before testing)

- **Symptom (on reading the code back):** `undo()` called `history.pop()` *before* checking whether a card was mid-flight. Pressing Undo during the 200ms fly-off would remove the last step from history and then bail out, so that decision could never be undone.
- **Fix:** check `busy` and an empty history first, then pop.

### 8. Test dead end: "Cannot read properties of undefined (reading 'click')"

- **Symptom:** a preview test clicked the overview's Sort buttons one by one and failed on the second, after reporting a "1600px → 1600px" upgrade that made no sense for a 2000px photo.
- **Cause:** the test, not the app. It clicked "Choose another folder" and then checked a "ready" condition that was already true from the *previous* test folder, so it ran against the old overview while the new one was still loading. When the new overview rendered, the button list it had collected went stale.
- **Fix:** re-ran from a clean, fully loaded state, re-querying the buttons on each loop: photo upgraded 320 → 2000px, PDF 320 → 1600px, and Esc returned to an overview with both Sort buttons. Lesson: wait on something the new folder *changes*, not on something that might already be true.

## Step 6 decisions: the summary

- **Three groups:** Reject (will move to `_to_delete`), Keep, and Undecided (hidden when empty). **Undecided files are treated like kept files:** they stay where they are. Only an explicit reject ever moves a file.
- **Each group shows its file count and total size**, plus one line on exactly what will happen to it. The top line ends with "nothing has changed yet".
- **Two ways in:** finishing the last unfinished family goes straight to the summary, and the overview has a "Review summary" button once anything is decided. "Back to families" returns to the overview to change decisions there.
- **The swipe screen now reports why it closed** (`exit(finished)`): `true` when every file is decided (show the summary), `false` for Esc or "All families" (show the overview). The "All families" click handler is wrapped as `() => exit()`. Passed straight in as `exit`, the click event would have arrived as a truthy `finished` and sent the user to the summary by mistake.
- **The cards are the same elements as on the overview, moved, not copied.** The overview moves them back when it next renders (tested: 7 of 7 back in their families).

## Step 7 decisions: Apply

- **API used: `FileSystemFileHandle.move(destinationFolder, newName)`.** Chrome first shipped it only for its private sandbox storage (the "origin private file system"). Chrome's Intent to Ship for local files on disk targeted Chrome 111, with folder moves excluded. Current sources partly conflict on whether it's fully on for local files, so the app doesn't assume. It tries `move()`, and if that throws for any reason it falls back. Sources: [Intent to Ship](https://groups.google.com/a/chromium.org/g/blink-dev/c/ogS8CeyZ3n8), [whatwg/fs PR #180](https://github.com/whatwg/fs/pull/180), [Chrome's File System Access article](https://github.com/GoogleChrome/developer.chrome.com/blob/main/site/en/articles/file-system-access/index.md).
- **Fallback: copy → check → remove.** Write the bytes to `_to_delete/name` with `createWritable()`, read the copy back, and compare its size to the original. Only if they match, call `removeEntry()` on the original. If the sizes differ, the original is left in place and the file is listed as failed.
- **The fallback's risks:**
  - `removeEntry()` is a permanent delete of the original, not the Trash. It's safe only because it runs after a verified copy exists.
  - **The copy's modified date becomes "now"** (measured: 3:18:46 PM → 3:19:53 PM). Dragging it back out of `_to_delete` won't restore its original export time, so it would land in a different session.
  - Finder tags and creation date are not copied. The image bytes, EXIF included, are identical (checked byte for byte: 36,886 B).
  - For a moment the file takes twice the disk space.
  - If Chrome or the Mac quits mid-copy, the original is still there, plus possibly a partial copy in `_to_delete`. The failure mode leaves *two* files, never zero.
- **Write permission is asked for only on the Apply click.** The folder was opened read-only. `requestPermission({ mode: 'readwrite' })` needs a click to run from, so it can't happen earlier by accident.
- **No overwriting inside `_to_delete`.** If a file with the same name is already there from an earlier run, the new one becomes `name (2).jpg`.
- **Undecided and kept files are never touched.** Only files explicitly rejected are moved.
- **The Done screen reports how each file went:** moved directly, or copied + removed, plus any renames and failures. A real-folder test shows which path Chrome actually took.

### 9. Test scripts: three of my own mistakes, one unexplained run

- **`Error: missing ) after argument list`:** my test used `await` inside a non-async `.every()` callback. Test-only; fixed and re-run.
- **`NotFoundError` reading `_to_delete/horizon.jpg`:** my test assumed horizon.jpg would be the first card. Files sort oldest first, so it was sonoma.jpg. Test-only.
- **Unexplained "Moved 0 files" run:** one fallback test reached the Done screen with 0 moved and 0 failed, meaning Apply ran with an empty reject list. Step by step, the ← press that should have rejected sonoma hadn't registered, and the script then called `.click()` on the summary's Apply button while it was hidden (scripts can click hidden buttons; people can't). I replayed the same sequence 6 times and every ← registered. Most likely cause: the script clicked "Start sorting" in the gap after the rescan, before the regroup, when the button was hidden and there were no families yet. Not reproduced, so the app is unchanged.
- **Real-disk testing:** Chrome's folder picker is a native macOS dialog that the test tools can't drive, so `move()` on a real folder has to be checked by hand on a duplicated folder.

## Rework: look first, time second (2026-11-01)

Ryan's goal, restated: the point of the app is finding every export of the same content anywhere in the folder, even months apart, cropped to another aspect ratio, re-edited, or in a different layout. Dates are secondary. File names are a weak clue, never the source of truth. Speed doesn't matter; accuracy does.

### Why dHash had to go
dHash shrinks every image to a 9×8 grey grid, so it only recognises "same picture, different colour or compression". Crops, aspect ratios and layouts all read as different images (measured 10–34 bits apart, overlapping unrelated photos at 24–40). Grouping by 20-minute sessions first also meant a re-edit months later could never join its original.

### The test: three ways of measuring similarity on a deliberately hard set
23 images from six macOS wallpapers. Same-content groups: edits (brightness, B&W, heavy grade), crops to 4:5, 16:9, 9:16 and off-centre, a crop plus an edit, and one poster in portrait, landscape and square layouts. Plus traps: a *different* poster in the *same* layout, two colourways of one design, and unrelated photos. Every pair was scored. The **gap** is the weakest same-content pair minus the strongest different-content pair; above 0 means one threshold separates them perfectly.

| | Weakest same | Strongest different | Gap | Per image (M3, WebGPU) |
|---|---|---|---|---|
| dHash | 0.44 | 0.67 | **−0.23** | instant |
| CLIP ViT-B/32 | 0.85 | 0.90 | **−0.05** | 35 ms |
| DINOv3 small | 0.78 | 0.64 | **+0.14** | 51 ms |
| **DINOv2 small** | **0.84** | **0.73** | **+0.11** | **28 ms** |

DINOv2 small on the cases that matter: same poster across layouts 0.87–0.95; different poster, same layout 0.44; original vs 9:16 crop 0.92; off-centre crop 0.92; two different landscape photos 0.15.

**Chosen: DINOv2 small** (`onnx-community/dinov2-small`, 84 MB, Apache 2.0). DINOv3 scored slightly better but ships under Meta's custom DINOv3 License, which is a risk for a paid product. CLIP judges "same kind of picture", not "same picture", so it confused colourful abstracts with each other. **Default threshold: 80%**, between 0.73 and 0.84.

### How it works now
- **Transformers.js** (Hugging Face's library for running models in the browser, v4.3.2) runs DINOv2 on the Mac's GPU through WebGPU, or the CPU if WebGPU isn't available. Each 320px thumbnail becomes 384 numbers (the model's CLS token, a summary of the whole image), scaled to length 1. Two images' similarity is the dot product: 1 = identical.
- **The model downloads once from Hugging Face** and Chrome caches it. No image leaves the computer: the model comes to the images.
- **Families are found across the whole folder** (union-find chaining at ≥ 80%) and ordered by their oldest file. Each family shows its export date span, e.g. "Mar 3 – Oct 30, 2026", and each card its own date and time. Sessions and the gap setting are gone; one setting remains, "Same family at [80]% alike or more", applied on change rather than per keystroke.
- **Measured:** in a 14-file folder, March originals plus October re-edits cropped to 9:16 and 16:9 formed one family; a square crop from a day later joined its original. Families: 95% → 10, 80% → 6, 60% → 5. Comparing every pair of 1,200 files is 719,400 pairs; the earlier BigInt version took 0.77 s, and float dot products are cheaper.
- **The model library loads only when a folder is opened** (dynamic import), so the start page's script stays 17 KB.
- **Cost note:** the build includes ONNX Runtime's WebAssembly engine, 26.9 MB (6.8 MB compressed), downloaded once per visitor from Vercel. The Hobby plan's 100 GB a month covers roughly 15,000 first visits. The model itself comes from Hugging Face, not Vercel.

### 10. `No pooled output was returned`
- **Symptom:** the first DINOv3 run threw `Error: No pooled output was returned. Make sure the model has a 'pooler' layer when using the 'pool' option.`
- **Cause:** I'd asked for `{ pool: true }`. CLIP's export has a pooling layer that produces one vector; the DINO exports don't, and return one vector per 16×16 image patch (`[1, tokens, 384]`).
- **Fix:** no `pool` option. Take the first token (CLS), which DINO is trained to use as the whole-image summary. For CLIP's `[1, 512]` that's simply the whole output.

### 11. `Execution context was destroyed, most likely because of a navigation`
- **Symptom:** the first test script using Transformers.js died with this error.
- **Cause:** Vite pre-bundles each npm package the first time a page imports it, then reloads the page to use the bundle. The reload killed the running script.
- **Fix:** run it again. Expected once per new dependency.

### File names as a tie-breaker
- **Rule:** if two files' name stems match, their similarity gets +0.05. That's enough to tip a 0.77 pair over the 80% line, never enough to join unrelated images (around 0.2–0.5).
- **Stem:** lower case, extension off, then edit/copy markers stripped from the end, repeatedly: ` (1)`, ` copy 2`, `-Edit-2`, `_v3`, `_final` / `_new` / `_old` / `_export(ed)`. A trailing `-2` is stripped only when a 3+ digit camera number is left (`DSC01234-2` → `dsc01234`), so `Untitled-501` and `Untitled-502` stay different photos. Generic names (`untitled`, `image`, `photo`, `frame`…) aren't a clue.
- **Tested:** `DSC01234`, `-Edit`, `-Edit-2` and `-2` all → `dsc01234`; `poster_v3 copy 2.png` and `poster_final.pdf` → `poster`. At 80%, a 0.77 pair joined only with matching stems; 0.74 with matching stems and 0.40 with matching stems stayed separate.
- **Known gap:** `Frame 12-1` (if Figma names duplicates that way) doesn't match `Frame 12`. The rule is kept conservative on purpose.

### PDFs: every page, and their words
- **Every page is described (up to 50),** not just page 1. Comparing a PDF with an image uses its best-matching page, so a PNG export of slide 3 matches the deck. Comparing two multi-page PDFs averages how well each one's pages are found in the other, so one shared cover page doesn't make two decks the same.
- **pdf.js reads every word** (3+ letters, lower case). Two PDFs that both have 20+ words are compared by **shared words / words in either** (Jaccard similarity), not by looks.
- `pdf.js` is now its own module (`withPdf`, `renderPage`, `readWords`), shared by thumbnails, the swipe preview and describing. A PDF whose pages or text can't be read falls back to its thumbnail.

### 12. Different documents from one template grouped together
- **Symptom:** a test folder with a 3-page "brand review" deck, the same text re-laid out (landscape, 2 pages, new colours), a *different* 3-page document built on the same template, and a PNG of the deck's page 2 came out as **one family of four**.
- **Measured:**

  | Pair | Look-alike | Shared words |
  |---|---|---|
  | deck ↔ re-layout | 0.90 | 1.00 |
  | deck ↔ different document, same template | **1.00** | 0.04 |
  | deck ↔ PNG of page 2 | 1.00 | – |
  | different document ↔ PNG of deck page 2 | **0.99** | – |

- **Cause:** the model sees a 224px version of each page. At that size body text is texture, not words, so text-heavy pages from one template look identical. The first version took the *better* of looks and words, so the looks won.
- **Dead end:** using words for PDF↔PDF pairs alone wasn't enough. The PNG still looked 0.99 like the wrong document, and because families chain, it would have linked the two documents through itself.
- **Fix:** (1) when both files are PDFs with 20+ words, **the words decide**. (2) **Links are made strongest first**, and a link is skipped if it would put two text PDFs whose words say they're different documents into one family. The PNG joins the deck it matches best (1.00 vs 0.99).
- **Result:** {deck, re-layout, PNG of page 2} and {different document}. The photo test folder was unchanged at 6 correct families.
- **Known limit:** images of text (PNG/JPG exports of text-heavy slides) have no words, so they're judged by looks alone. The PNG's margin here was thin (1.00 vs 0.99), and two PNGs of different text slides on one template would group. Fix later: **OCR** (reading text from images, e.g. Tesseract.js), run only on images whose best match is a text PDF or another text-like image.

### More file types: AVIF, GIF, TIFF
- **AVIF and GIF:** Chrome decodes them with `createImageBitmap` (a GIF's first frame), so they're just added to the list.
- **TIFF:** Chrome can't decode TIFF at all, and it's a common lossless Lightroom export, often 16-bit. **UTIF.js** (Photopea's decoder, MIT, 83 KB, loaded only when a folder has a TIFF) decodes it; `toRGBA8` turns 16-bit channels into 8-bit; if the file holds several images, the largest is used. An `<img>` can't show TIFF either, so the swipe card renders TIFFs at 1600px like PDFs.
- **Tested** with files made by macOS's `sips` (8-bit TIFF, LZW-compressed TIFF, AVIF, GIF) and a 16-bit RGB TIFF written byte by byte, since `sips` can't make one. Each grouped with its JPG twin. The 16-bit gradient's corners came out as expected (blue channel 20000/65535 → 79/255). TIFF swipe previews took 63–127 ms.

### OCR: reading text inside images
- **Why:** after the PDF fix, images of text (PNG/JPG exports of slides) were still judged by looks, which can't tell two text slides on one template apart.
- **Tool:** **Tesseract.js 7** (Apache 2.0), English. Its engine and language data come from the jsDelivr CDN the first time and are then cached (not served by Vercel). It loads only when a folder is opened.
- **Measured on the M3, per image at 1600px:** text slide 291 ms (34 of 39 words read confidently); another deck's page 225 ms (36/36); plain photo 268 ms (**0** confident words); photo poster 101 ms (3 words: "SUMMER RELEASE October"). At 1000px, accuracy on these was the same, but 1600 keeps small body text readable, and speed isn't a priority. Estimate for 1,200 files with the model: about 5–8 minutes.
- **Rule:** every non-PDF image is read at 1600px. Words under 80% confidence are dropped (on photos Tesseract "finds" low-confidence words in textures). A file with 20+ words, PDF or image, is a **text file** and is compared by words with other text files; photos and photo-led posters are still judged by looks.
- **Word score changed** from "in both ÷ in either" to **"how much of the shorter text is in the longer one"**. A single slide holds about a third of its deck's words, so the old score put slide-vs-deck at about 0.37 ("different"); the new one scores it high, while different documents still score about 0.05.
- `renderAt(entry, size)` in `thumbs.js` now renders any supported type at any size; thumbnails, previews and OCR all use it.

### 13. A deck's second slide image blocked from joining its deck
- **Symptom:** with OCR on, `brand-review.pdf` + `brand-slide-2.png` grouped correctly, but `brand-slide-3.png` sat alone.
- **Cause:** the "two different documents can't share a family" check compared files one by one. Slide 3 had to pass a check against slide 2 already in the family, and two different slides of one deck share few words, so it was blocked as a "different document".
- **Fix:** each family keeps **all its words together**, and the check compares whole families' words. Slide 3's words are all in the deck's text, so it joins; the other document's words aren't, so it stays out.
- **Result (OCR test folder, 10 files, 4.1 s):** {deck, slide 2, slide 3}, {other document, its slide 3}, {two photo edits}, {one poster in two layouts}, {other poster}. The photo folder (6 families) and PDF folder (2 families) were unchanged.

### The overview is ordered by look
- **Why:** Ryan read the grid as "sorted by similarity". It was actually in time order: each family by its oldest file's modified date, which for downloads is download order. Similar families were only neighbours when exported close together. For "find the final", near-misses (different shots of one scene, or a re-edit just under the threshold) should sit side by side.
- **Decision (Ryan):** the **export / modified date stays the date shown everywhere**, since it marks when an export was made. EXIF capture date is planned next as a *grouping signal* ("same photo"), not as the order.
- **How:** each family gets an average look (the mean of all its files' vectors, scaled to length 1) and an average colour (each thumbnail shrunk to 16×16 over white, then averaged). Ordering starts at the oldest family and repeatedly steps to the most alike family not yet placed (a greedy nearest-neighbour walk). Difference = 1 − look similarity + **0.15** × colour distance (RGB, scaled 0–1), so colour only breaks near-ties. Unreadable files go last. The swipe order follows the grid.
- **Tested:** in the photo folder, the three abstract wallpapers (radial, the iMac colourways, purple) now sit together after the Sonoma family, with the unreadable file last. In the OCR folder, the two text documents sit together. 1,200 unrelated files grouped and ordered in 0.7 s.

### EXIF/XMP: "same shot" from photo metadata
- **What Lightroom writes**, read from Ryan's three exports `Untitled-501/502/503.jpg` with **exifr** (MIT): the same `DateTimeOriginal` (2024-05-19 20:08:06, sub-second `.662`), the same camera (Apple iPhone 13), the same **`OriginalDocumentID`** (`3BAA89B2…`, shared by every export of one original), and a different `DocumentID` per export. So they're three exports of one photo. This also showed the file-name rule's assumption was wrong for Lightroom's "Untitled-NNN" naming: the numbers count exports, not photos. Metadata is the reliable signal.
- **Rule:** a photo's identity keys are (capture moment to the sub-second + make + model) and, only when a capture time exists, its `OriginalDocumentID`. That ID is not trusted alone, because design apps carry it through "Save As". Two files sharing a key are the **same shot**, worth **+0.3** similarity (the file-name nudge is +0.05). Read from JPEG, TIFF, PNG and AVIF.
- **Shown:** the swipe card reads "May 19, 9:26 PM · shot May 19, 2024 · 5.6 MB · JPG", with the export date first (Ryan's call: the export date matters most) and the capture date after. The overview's dates are unchanged.
- **Tested:** the three real exports group, as they'd look alike anyway. A heavy re-crop (the centre 40%, square, contrasty B&W) with the original's metadata spliced in is read as the same shot, but looks only **0.47** like the original, so 0.47 + 0.3 = 0.77 stays under 80% by design. The same crop without metadata has no key.
- **Changed (Ryan's call, on my recommendation): the original-photo ID now decides on its own.** It's written by the tool that made the exports and means "exported from this exact original", so a hard crop or a re-grade, the versions most easily forgotten, shouldn't have to pass a looks test. A same-original link scores 2 (above any looks score) so it's made first; the text "different documents" check still applies. The capture-moment match stays a +0.3 nudge. Shot data is now `{ taken, moment, original }`.
- **Tested:** the heavy B&W re-crop (looks 0.47) now joins `Untitled-501`, as does the same crop without metadata (identical looks). The three exports are still one family, and the photo test folder is unchanged at 6 families.

## The compare screen replaces swiping (2026-11-01)
- **Why (Ryan):** swiping made it a keep/delete app, but the main job is **comparing versions to find the final**. Deleting is secondary.
- **Layout:** two frames side by side, each **75vh** tall (`--compare-frame-height`); details under each frame; pick buttons; Keep both and Undo; a filmstrip of every version in the family (72px, `--filmstrip-size`). Measured at 1800×1043: frames 860×782 (75%); the page is 1228px tall, so the filmstrip sits about 185px below the fold. Left as Ryan specified, for his Figma pass.
- **"Winner stays on":**
  - the newest export starts on the left (most likely the final), the next newest on the right;
  - picking one (← / → or "This one") keeps it **where it is**; the other is out (rejected) and the next version takes its slot, so nothing jumps sides;
  - **Keep both** (↓) keeps both and replaces the newcomer (for versions you need, like a 4:5 post and a 9:16 story);
  - clicking any filmstrip version brings it in as the newcomer, and one that was out comes back undecided;
  - when a side is left empty the family is done, and the next family with 2+ versions and undecided files opens; after the last, the summary.
- **Details under each frame:** name; export date/time; shot date (from EXIF); pixel size with its aspect ratio ("1080 × 1350 · 4:5", or a PDF's page count); file size and format. Anything different from the other side is bold; exports on the same day count as the same. Pixel size is recorded when the thumbnail is made (`makeThumbnail` now returns `{ thumb, width, height }`).
- **One-file families** are skipped by "Start comparing" until every multi-file family is done; opened directly, they show "Only version" with Keep / Reject.
- **Undo** (button, ⌘Z, Backspace) restores a snapshot from before each choice, across families. Esc returns to the overview.
- `swipe.js` and its styles were removed; decisions are still `keep` / `reject`, so the summary and Apply are unchanged.
- **Tested in Chrome** on the photo test folder: winner stayed in place, Keep both replaced the newcomer, filmstrip pull-in and ⌘Z worked, the Sonoma family finished then the next family opened by itself, and after the last multi-file family the summary showed 7 reject / 5 keep / 2 undecided. A one-file family offered Keep / Reject.
- **Test dead end (again):** a measurement read the frame as 0×0 because the "ready" check matched the previous folder of the same name. That's the lesson from break 8 repeated: wait on something the new load *changes* ("0 decided"), not something already true.
- **Revised (Ryan):** 75% was meant as "a good chunk", not a hard number. What matters: **everything you act on fits on one screen, and the frames stay pinned** while the versions grid scrolls below.
  - The top (header, frames, details, actions) is `position: sticky`, with a white background and the body's top padding kept when pinned.
  - The pick buttons, Keep both and Undo share **one row**, each pick centred under its frame, to save height.
  - Frame height is `calc(100vh - 440px)`: the window minus the rest of the pinned top (about 290px) and room for the first grid row (about 150px).
  - The filmstrip became a **wrapping grid** of 120px versions (`--version-size`), matching the overview cards.
  - Measured with a 30-version test family:

    | Window | Frames | Pinned top | First grid row | After scrolling |
    |---|---|---|---|---|
    | 1800×1043 | 603px | 890px | fully visible | frames still at top (94px) |
    | 1440×800 | 360px | 647px | fully visible | frames still at top (94px) |
- **Versions grid:** 160px versions (was 120px), each with its export date and time underneath (Ryan: the quickest signal for a glance). Frames give up the room: `calc(100vh - 500px)`, 543px on a 1043px-tall window, and the first grid row, dates included, still fits (ends at 1032px).

## One continuous compare stream, and a "Same piece?" check (2026-11-01)
- **Why (Ryan):** comparing one family at a time meant hunting for sets that are often only 2–10 files. Instead, walk the whole folder in the overview's order (similar families already sit together) and keep going.
- **The risk it had to handle:** inside a family, "This one" means "the other is a worse version, out". Across two *different* photos it would cull one just for sitting next to a better one.
- **Design:** inside a family, winner-stays-on as before. **Where a family ends, its final stays on screen and the next family's closest version** (by the same similarity the grouping uses, `fileSimilarity`, now exported from group.js) **comes in beside it**, with only **Same piece (S)** and **Different (D)** offered:
  - Same piece merges the two families in the shared family list (so the overview shows the merge too), and comparing continues with the next family's other versions queued.
  - Different starts the next family.
  - One-file families go straight to the check, which is how a re-edit the grouping missed gets caught.
  - At the very end of the stream, an undecided lone version gets Keep / Reject; then the summary opens.
  - While checking, the grid shows this family's versions, a "Next family · dates" divider, then the next family's; clicking one of those swaps which version is being checked.
- **Undo** snapshots now include the family list and the boundary state, so a merge can be undone too.
- **Families | Compare toggle** replaces "Start comparing" and "All families". Switching to Families scrolls the overview to the family the stream was on. Switching back resumes there if it still has undecided versions, otherwise at the first family in order that does.
- **Keys:** ← → pick, ↓ keep both, S same piece, D different, ⌘Z / Backspace undo, Esc to Families. ⌘ shortcuts other than ⌘Z are left to the browser, so ⌘S and ⌘D never trigger a merge.
- **Tested in Chrome** on the photo test folder: finishing Sonoma brought radial's closest version in for the check; D started radial; S merged radial with the iMac pair (6 → 5 families, comparing continued with 4 versions); ⌘Z restored 6; Families → Compare resumed at the next open family; the purple single got its check and stayed untouched after D; the unreadable file at the end offered Keep / Reject; then the summary showed 9 reject / 4 keep / 1 undecided.
- **Known gap:** switching to Families *during* a same-piece check and back skips that one check (the stream resumes at the next family with undecided versions).

### 14. Two different jackets in the same pose grouped (product flat-lays)
- **Symptom:** Ryan's product photos (4000×5333 PNGs, flat grey backdrop): `Bomber_front` (olive nylon bomber) and `Bomber2_front` (dark brown leather jacket) became one family. The backs stayed separate.
- **Measured** (DINOv2 small):

  | Pair | Whole image | Subject only | Patch-level detail match | Subject colour ΔE |
  |---|---|---|---|---|
  | different jackets, fronts | **0.87** | 0.80 | 0.32 | 16 |
  | different jackets, backs | 0.80 | 0.79 | 0.26 | 12 |
  | same jacket, front vs back | 0.68 | 0.69–0.71 | 0.28–0.36 | 2–5 |
  | photo vs B&W edit | 0.92 | 0.92 | 0.67 | 21 |
  | photo vs 9:16 crop | 0.92 | 0.92 | 0.34 | – |
  | photo vs heavy grade | 0.99 | 0.99 | 0.96 | 17 |

- **Cause:** DINOv2 is trained to be colour-invariant (so B&W edits still match their originals). Same pose, backdrop and framing therefore outweigh a different garment.
- **Dead ends:**
  - **Cropping to the subject** only lowered the pair to 0.80, still on the line.
  - **Patch-level mutual-nearest-neighbour matching** separates the jackets (0.26–0.32) but scores a legitimate photo crop at 0.34, so no threshold works.
  - **Subject colour in Lab:** both jackets are near-neutral (chroma 3–6), and real edits change colour more (ΔE 17–21) than the jackets differ (12–16).
  - **File names** (`Bomber` vs `Bomber2`) would help here, but Ryan's point stands: names are unreliable in general, so they stay a +0.05 nudge.
- **Outcome:** no automatic fix yet. For folders like this, set similarity to 88%. Next: a **"Not the same"** action while comparing that splits a version into its own family (the counterpart of "Same piece"), so grouping mistakes take one key press to fix in either direction. Logged in `TESTING.md` (a new record of every kind of content tested).
- **Added: "Not the same (N)" while comparing.** The newcomer (the version most recently brought in, named in the button's tooltip) leaves the family for one of its own, placed right after it in the stream; the next version comes in. The stream then visits it without asking "same piece?" about it again (an `apart` set, included in undo snapshots). So grouping mistakes take one key to fix in either direction: S joins, N splits. Tested on Ryan's flat-lays: the two jacket fronts split (3 → 4 families), the stream carried on, and ⌘Z rejoined them.
- **Changed (Ryan): no 0–100 similarity number.** It's a developer's control, and most people want the holistic choice without choosing. It's now three levels, **Loose (0.75) · Balanced (0.80, default) · Strict (0.88)**, styled like the view toggle, with tooltips saying what each is for. Strict sits just above the two jackets' 0.87 and below the photo edits measured (0.92+). Tested: flat-lays 3 families at Loose/Balanced, 4 at Strict (fronts split); the photo test folder gave the same 6 correct families at all three levels.

### Short text counts (phrase rule)
- **Why:** in Ryan's graphic folder (test 16), three of four misses involved short text that the 20-word rule ignored.
- **What OCR actually read** (which shaped the rule):

  | Pair | Looks | Words read |
  |---|---|---|
  | "let me taste eternity", two zooms | 0.66 | `letm taste` / `letme taste eternity` (OCR runs "let me" together; the crop cuts words) |
  | dua phone, close / small | 0.79 | identical 17 words on both, ignored for being under 20 |
  | you > helvetica / eva suit page | 0.86 | `you helvetica` / `you are beautiful that eva suit` (only "you" shared) |
  | black calendar / light calendars | 0.74–0.78 | different text altogether ("how many more acts…" vs "first second third…"), so not a word problem |

- **Rule** (`phraseNudge` in group.js, applied when the full word comparison doesn't apply):
  - drop filler words and junk readings (a letter repeated 3 times);
  - a word matches another that it begins;
  - if ≥ 2 key words and ≥ 80% of the shorter set is found in the other, **+0.25**, unless the longer text is more than 3× + 3 the shorter (chance matches);
  - if both carry key words, none match, and there are ≥ 4 between them, **−0.15**.
- **Result:** graphic folder 25 → 24 families. Eternity and the phone joined, the helvetica pair split, everything else unchanged. Photos, PDFs, OCR, formats, flat-lays and Lightroom test folders were all unchanged.
- **Still missed:** the full-bleed black calendar, whose text really is different; that's a looks problem (inversion), noted in INSIGHTS.md.

### 15. The black site calendar read only "calendar"
- **Symptom:** after the phrase rule, the full-bleed black calendar still sat apart from the black calendar inside a browser mock-up. Ryan: "both the blacks are the same, shouldn't it group those 2 at the minimum?"
- **Cause:** the exports are huge (site mock-ups 8640×10800, full-bleed 6480×8100). Read at 1600px (1/7 size), the mock-up's calendar labels were a few pixels tall, and OCR read only the browser tab's title, "calendar". The new clash rule then scored "calendar" vs "how many more acts…" as different text (−0.15).
- **Measured:** at 3200 and 4800px, the mock-up reads `calendar how many more acts will you leave behind before your written departure`, the same as the full-bleed version. So it was the same text, not an earlier iteration (Ryan confirmed: a finalised site-media folder).
- **Dead end 1: read everything at up to 3200px.** That fixed the calendar but broke two earlier wins:
  - the cropped eternity print read `eterr`, which isn't a prefix of `eternity`;
  - a faint light-grey page read **nothing** at its full 2293px, though it read its words at 1600.

  It was also 3.5× slower (162 s vs 46 s).
- **Dead end 2: a second read for every image ≥ 3200px.** It fixed everything, but would re-read every full-size photo, which has no text, for nothing.
- **Fix:** read at 1600 as before; re-read at 3200 and combine only when the image is ≥ 3200px **and** the first read found 1–19 words. Words sharing their first 4 letters also match.
- **Result:** graphic folder 23 families in 61 s. All four flagged misses fixed (black calendar joins a 4-file calendar family; eternity; dua phone; helvetica apart). Photos, PDFs, OCR, formats, flat-lays and Lightroom test folders unchanged.
- **Open, from Ryan:** an *earlier iteration* of a design with *different copy* is still the same project, but the −0.15 clash rule would push it apart. The clash should probably only apply when both images are sparse (mostly empty), which is the low-content guard in INSIGHTS.md.

### 16. A text sheet didn't group with its own mock-up
- **Symptom (Ryan):** `Untitled-28` (a printed text sheet with the crest) and `Untitled-35` (the same sheet among other sheets, in a "MacBook Pro" mock-up) were never grouped, except for the few minutes the slow "re-read everything" version ran.
- **Cause:** both are 2560×3200 pages of small, dense body text. At 1600px OCR read 80 and 76 words, and the sheet's words were found in the mock-up only **0.46** of the time, so they looked like different documents. At 3200 (full size): 286 and 297 words, overlap **0.97**. Break 15's shortcut (re-read only when 1–19 words were found) skipped exactly these dense pages.
- **Fix:** re-read any 3200px+ image whose first reading found *any* words. Photos and plain scans with no text still skip it.
- **Result:** the sheet and mock-up group; all four test-16 fixes hold; 22 families in **70 s** (the "re-read everything" version took 162 s, because plain scans without text no longer get a second read). Earlier test folders unchanged.
- **Lesson:** the same piece shown inside a mock-up, or among other sheets, is everyday designer output, not an edge case. Full-size text reading is what makes it work for text-heavy pieces. For mock-ups of *images* without text, that's the multi-scale (zoomed-crop) matching in INSIGHTS.md.

### 17. Two different dune photos grouped (colour documentary set)
- **Symptom (Ryan, test 18):** `Untitled-144` and `-147`, two different photos of people on a dune, grouped; a third (`151`) didn't.
- **Measured:** looks 0.82 (just over Balanced's 0.80). Metadata: different originals, shot 8 minutes apart. For contrast: `1469` / `1470`, two near-identical frames 2 s apart (Ryan wants these grouped), 0.92; exports of one photo, 0.99.
- **Cause:** mostly-plain compositions (sand and sky) look alike to the model, the photo version of the near-blank-pages problem. The metadata already said these were different shots, but only ever counted *for* grouping.
- **Fix:** different original IDs **and** different capture moments → −0.08. Dunes 0.74 (apart); building frames 0.84 (together); same-photo exports unaffected.
- **Tested:** the documentary subset gives the expected families; Lightroom, metadata re-crop, photos, flat-lays and OCR test folders unchanged.

## Instrument Sans and EB Garamond are available (2026-11-02)

- **Request:** load both families for the design pass. Registered four local `@font-face` entries, with `font-display: swap`, and added `--font-instrument-sans` / `--font-eb-garamond`. The existing `--font-sans` and all assigned interface styles stay as they were; font placement has not been specified yet.
- **Sources:** Instrument Sans variable TTFs copied from `texas-mps/app/Instrument_Sans`; EB Garamond variable TTFs downloaded from the [Google Fonts repository](https://github.com/google/fonts/tree/main/ofl/ebgaramond). Converted to WOFF2 with the already-installed fontTools/Brotli; included both original OFL notices. No package dependency or remote font stylesheet added.

  | Family | Before | Available now | Local asset size, normal + italic |
  | --- | --- | --- | --- |
  | Instrument Sans | Not registered | Weights 400–700; widths 75–100%; normal + italic | 88,456 + 94,068 bytes |
  | EB Garamond | Not registered | Weights 400–800; normal + italic | 296,728 + 286,076 bytes |

- **Size / cost:** 765,328 bytes total (about 765 kB) if all four files are requested. The browser requests a font when text uses it; no preloads were added. No paid service, push, or deployment.
- **Checked:** `npm run build` passed (existing large-chunk warning only). A temporary specimen page displayed regular, maximum weight, italic, and maximum-weight italic for each family. Chrome's own `document.fonts` report showed all four faces `loaded`; checked at 1800×1043 and 900×800 with no horizontal overflow. Temporary page removed afterward.
- **Environment / test dead ends:** sandboxed font download returned `curl: (6) Could not resolve host: fonts.googleapis.com`; downloaded official assets with approved network access instead. Sandboxed dev startup returned `Error: listen EPERM: operation not permitted ::1:3400`; an approved retry returned `Error: Port 3400 is already in use`, revealing the existing server, which was reused without stopping it. Reading `document.fonts` through the browser's read-only evaluation returned an empty list despite visible fonts, so the specimen page itself printed the browser's font status. A broad text locator returned `Playwright selector deadline exceeded`; reading the report by `#font-status` worked. These were environment/test issues; no app workaround was added.

## Solid light-grey app background (2026-11-02)

- **Request:** `#EEEEEE` as the site background / solid wallpaper. Changed `--color-bg` from `#FFFFFF` to `#EEEEEE`. The pinned compare top uses the same background token.
- Added `--color-surface: #FFFFFF` for existing white button fills and active-toggle text so the wallpaper choice only changes the backdrop.
- **Checked:** `npm run build` passed (existing large-chunk warning only). Chrome computed the body and pinned compare background as `rgb(238, 238, 238)` and button fills / active-toggle text as `rgb(255, 255, 255)`. Visual check at the existing 1800×1043 window; no layout values changed. No app break encountered.

## Syca's folder intro (2026-11-02)

- **Request:** implement Ryan's supplied start-screen screenshots. Replaced the placeholder heading, copy and bordered Choose folder button with the Syca caption and “To start, drag or select a folder”. Select is a real button, rendered inline in italic Garamond with an underline. Page title is Syca; other screens retain their existing layouts.
- **Tokens:** `#EEEEEE` background, `#333333` text and `#97A084` select (sampled from the screenshot); five stretch columns, 24px margins, 12px gutters. Intro is 36px / 110%, Regular 400, zero tracking; caption is 16px Medium 500. Spacing uses the 4px scale.
- **Rule and spacing:** white `#FFFFFF`, 2 CSS pixels, full viewport width, centered vertically. Initial 28px text-box spacing left only about 24px of visible space, because the Garamond glyphs extend below their line box at 110%. Added a 4px optical offset: 32px box spacing gives about 28px visible spacing on the one-line intro. At 375px the last line has no descenders and has about 38px visible spacing; no phone-specific typography adjustment was made.

  | Chrome viewport | Each of 5 columns | Rule center | Intro lines | Horizontal overflow |
  | --- | --- | --- | --- | --- |
  | 1800×1043 | 340.8px | 521.5px | 1 | None |
  | 900×800 | 160.8px | 400px | 1 | None |
  | 375×812 | 55.8px | 406px | 2 | None |

- **Input:** drop one directory anywhere on the intro; capture its handle in the drop event's own tick, then reuse the existing local scan pipeline. Invalid files and multiple dropped items get a small error message. Drops during a loaded run cannot replace it or navigate the tab to a file. No new write access, upload path or persistent scan storage was added. [Handle timing reference](https://developer.mozilla.org/en-US/docs/Web/API/DataTransferItem/getAsFileSystemHandle).
- **Verified:** build passed; Chrome native picker opened; nine synthetic browser integration checks plus helper edge-case assertions passed. Test events used synthetic handles and an ignored text file, not user images. Native Finder drag still needs end-to-end verification. No claim that the 1,200-image run was saved: the connected tab already showed the start screen and no loaded cards before edits.
- **Test / tool dead ends:** the first picker click was in a background tab and did not display a native sheet; bringing the test tab forward and clicking its actual button opened the sheet. A later cancel encountered `The element ID is no longer valid`; refreshed native state showed the sheet was gone. Finder automation stopped when the user changed the app, so no cross-app drag was attempted. A browser evaluation returned `Timed out after 3000ms waiting for CDP command Page.getFrameTree`; existing tab inventory and accessibility/screenshot inspection recovered without reloading. The viewport override initially affected the newest test tab rather than the older intro tab; detected from `innerWidth === 1800`, then checked fresh dedicated previews at the requested dimensions. These were test/environment issues; no app workaround was added.

## Garamond's weight was right, but its rendering looked too heavy (2026-11-02)

- **Symptom:** Ryan found both the large Garamond intro and caption too thick, including at the font's lightest weight.
- **Evidence / fix:** RH Studio's `app/layout.tsx` applies Tailwind's `antialiased` class to the root. Added its Chrome/macOS equivalent, `-webkit-font-smoothing: antialiased`, scoped to this intro. [Rendering property reference](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-smooth).
- **Correction:** briefly tried dropping the caption from 500 to 400 while investigating. Ryan clarified that the Garamond caption must stay Medium 500; restored it before committing. Final weights are intro 400 and caption 500. No fake lighter weight or text stroke was added.
- **Checked:** separate build passed and Chrome reported intro `400`, caption `500`, smoothing `antialiased`. Visually checked and saved the final desktop screenshot. Saved the intro and rendering fix as separate site commits, with these notes in a separate notes commit. Nothing pushed.

## Small Garamond description under the wordmark (2026-11-02)

- Added Ryan’s exact i / ii copy with one line break, in EB Garamond Medium 500 at 12px, 140% line height (16.8px), zero tracking. The existing 16px caption/wordmark size remains available.
- Target: 40px visible gap below the wordmark. An initial 40px box margin painted about 42px apart; a 2px font-metric adjustment gives 38px box spacing and 40px visible spacing, measured from the desktop screenshot.
- Build passed. Chrome checked at 1800×1043 and 375×812; description stays two lines, 33.6px tall, at the 24px grid margin with no horizontal overflow. No app break encountered.

## One loading screen for the complete scan (2026-11-02)

- Replaced the thumbnail-grid / model-download loading presentation with Ryan’s single screen, from folder enumeration through thumbnails, model preparation, OCR/metadata/image analysis, grouping and final card preparation. The overview appears only after completion reaches 100%. Removed the obsolete loading-grid renderer and its CSS; thumbnails still exist internally for analysis.
- Shared identity is cloned from the intro header. Layout uses the existing centered 2px white rule, five-column grid, 24px margins and 12px gutters. Progress overlays the line in `#95A081`. Percentage is **upright** Garamond Regular 400 at 36px (corrected from the initial italic interpretation). Instrument Sans status/ETA is 12px Medium 500; “Did you know?” is 16px Medium italic; the supplied fact is 32px Regular. Primary / muted text tokens changed from `#111111` / `#6B6B6B` to Ryan’s `#333333` / `#AAAAAA` throughout the app.
- Spacing targets: 24px above the line, 36px below. Added font-metric optical offsets of 4px for the percentage, 1px for the sans block and 2px for the fact heading. Checked rendered geometry and screenshots after fonts loaded. At 1800×1043 the line center is 521.5px, status starts at column 2 (376.8px), and the fact starts at column 4 (1082.4px), with a 340.8px width. At 900×800 the line center is 400px and the fact spans the last two columns (333.6px wide) to fit; at 375×812 it spans columns 2–5 and ends at about 694px. No horizontal overflow.
- Real work drives a monotonic weighted percentage: previews 0–10%, existing model preparation 10–15%, per-file analysis 15–98%, grouping/rendering to 100%. This is overall processing progress, not raw files-completed percentage. Model preparation reuses the same cached model and download path. ETA uses elapsed scan time per completed file, beginning after two files; it is an estimate and excludes model-download time.
- Motion: number and bar tween together for 180ms; recorded a test 0→67% settling at 185ms and remaining at 67% through 501ms. Dots cycle `.`, `..`, `...` every 600ms; observed `. / .. / ... / .`. Scan phrases change every 8s. Facts are configured for 20s rotation only when more than one exists; currently only Ryan’s supplied fact is present. Timers stop on completion/error; reduced motion skips the percentage tween and dot cycling. Errors stay on the same screen with a folder-picker recovery action.
- Validation: build passed (existing large-chunk warning); 13 browser checks passed, including a generated PNG through real thumbnail creation, model inference, OCR, grouping and the final card, with no preview grid during the wait. Also checked completion before overview, monotonic progress, settling, ETA, failure recovery, timer stop and already-complete completion. Temporary HTML fixtures were removed. The saved 67% / 3-minute screenshot is a design-test preview, not a real folder estimate. No paid service, push or deployment.
- Test dead end: the first synchronous assertion said `FAIL Loading screen appears before folder enumeration finishes`, because the mocked async picker had not resolved yet. Awaiting the actual loading-screen visibility fixed the test; the delayed enumeration still proved the screen appears before reading completes.
- Localhost break: Chrome returned `net::ERR_CONNECTION_REFUSED`; no listener was found on port 3400. The prior dev process was no longer running; its exit cause is unknown. Restarted `npm run dev` on the pinned port (Vite ready in 144ms) and verified a fresh Chrome page loaded. No code workaround added.
- Earlier caption commit was delayed by automatic approval review’s usage limit, not a safety determination. After its stated reset time passed, the caption and separate notes commits succeeded; no approval check was bypassed.

## Describe field, and the scan starting on the home screen (2026-11-02)

- **Built from Figma Frame 130 (list open) and 131 (field closed), with the project rules first.** Band `#E5E5E5` directly under the white rule, 36px Garamond Regular field, placeholder `#AAA`, 2px `#CCC` line under it (hidden while the list is open, where the first row covers it in Figma). Caret `#95A081` (Ryan). List: eight types, 16px Garamond Medium, `#AAA`; the row under the pointer is `#222` with white text. Ryan: the dark row is hover only, nothing pre-selected.
- **Rounded to the 4px rule:** band 77 → **76px**, rows 42px pitch / 43px dark row → **44px**. Measured at 1728×1009 (the Figma frame size): band 505.5–581.5, rows from 581.5 in 44px steps, last row ends 933.5. Field baseline 556px, same as Figma's. Row cap tops drift 2px per row from Figma's 42px pitch (first two rows match: 600 / 642).
- **Matching:** each type has a keyword list (`src/media.js`). Words typed match a type when a label word or keyword starts with them; more matched words rank higher. Enter takes the highlighted row, else the best match, else General; the typed text is kept (`state.description`) for a later AI step. Checked: "photo" → Photographs only; "zzz" → list closes, band line returns; "lightroom edits" + Enter → Photographs; empty + Enter → General.
- **Flow change (Ryan):** picking a folder starts the scan right away on the home screen. The white rule is the progress bar (same `.loading-fill`, same tween), and the folder details show the live time remaining from `loading.js` instead of a pre-scan estimate. Choosing a type moves to the loading screen at the same progress (checked 15% → 15%), or to the families if the scan already finished (checked: "Ready", bar full, then type → families). Once a type is chosen, later folders go straight to the loading screen. `startLoading()` no longer switches screens; `loadFolder` does.
- **Folder details:** 12px Instrument Sans Medium, "time remaining" `#AAA` over "Folder (size)" `#333`, column 3 (x 700.8 at 1728px; Figma 701), bottom-aligned with the intro. Size is the existing formatter lowercased ("5.0 mb"; Figma shows "27 gb" with no decimal).
- **Break, self-inflicted:** first placed the intro in columns 1–2, which wrapped it to two lines at 800px. Fixed by letting the intro span all columns and moving the folder details to column 4 under 1200px and below the intro under 760px (the intro's ~402px width reaches column 4 below ~729px). Checked 1728, 900, 700 and 375 widths: no overlap, no horizontal overflow.
- **Test note:** in the background browser pane `requestAnimationFrame` pauses, so the final tween to 100% (and the switch to families) waited until the pane was shown. Not an app bug.
- **Not done:** the type isn't used by grouping yet. On a 375px phone the 36px placeholder is cut off at "Then, describe the medi" (the app needs desktop Chrome anyway).

## Describe field tuning (2026-11-02)

- **Grey line hidden by the list:** the list started at the band's bottom edge (581.5px) and covered the 2px `#CCC` line. Now it starts under the line: line 581.5–583.5, first row from 583.5 (at 1728×1009). Moved 2px, the line's full thickness; Ryan suggested 1px, which would have left half the line covered.
- **Rows one step smaller, darker:** 44 → 40px rows, text `#AAA` → `#333`. Hover row stays `#222` / white. Eight rows run 583.5–903.5px. Cap centred: 14.9px above, 14.5px below.
- **Smarter search (still local):** plurals ("images" → image), shared words (Photographs and Product Images both carry image / photo / shot), one-letter typos for 5+ letter words ("photgraph"), filler words ignored. Ranking: exact or plural 1, start of a word 0.75, typo 0.5, summed over the typed words; a typo only counts when the word matches nothing exactly. Dead end: first version let any keyword begin a typed word, so "app" ranked Mockups (apparel) first and "edits" matched editorial as a typo; fixed with the plural limit (≤ 2 extra letters) and the tiers.

## One green, whole-number sizes (2026-11-02)

- `--color-select` `#97A084`, `--color-progress` and `--color-caret` `#95A081` merged into `--color-accent: #95A081` (Ryan's Figma value; the other was a screenshot sample, 2–3/255 off per channel). Chrome: rgb(149, 160, 129) on select, its underline, both progress fills and the caret.
- Home folder size rounds to whole numbers ("5 mb", "27 gb"); `formatSize(bytes, decimals = 1)` keeps the done screen at one decimal. Note: 1.4 GB shows as "1 gb" on the home screen.

## General catch-all words, row separators (2026-11-02)

- General also matches unsorted, junk, mess(y), clutter, dump, leftovers, downloads, desktop, exports, archive, backup, untitled, unknown, idk, dunno, whatever, assorted. Ties now put General after the specific type ("desktop screenshots" → Screenshots · General).
- 1px `#CCC` line between rows (Ryan: "try"), inside the 40px rows; none above the first row (under the band's 2px line) or after the last. Hover row's line turns `#222`. Measured: rows unchanged at 583.5–903.5px.

## Media type sets the grouping level (2026-11-02)

- Each type carries a level (`media.js`): Balanced for General, Photographs, Graphic & Type, Documents; Strict for Product Images, Screenshots, User Interface; Loose for Mockups. The toggle still overrides. Strict for products is measured (tests 14–15); for screenshots / UI it follows test 20's same-template problem; Loose for mockups is unmeasured.
- Grouping moved after the type: a scan that finishes first now waits at "Ready" with the bar full, groups when a type is chosen. Mid-scan choice still goes to the loading screen and groups at 98% as before.
- Checked: bomber flat-lays + "product shots" + Enter → Product Images, Strict, 4 families (jackets apart); Balanced → 3 (fronts merged). Model test folder mid-scan → Strict, 6 families.
- Test gotcha again: with the browser pane hidden, `requestAnimationFrame` never fires, so the bar stays at `scaleX(0)` and finishing waits. Screenshots drive frames. Not an app bug.

## On-computer AI fallback for the media type (2026-11-02)

- When typed text fits no keyword, Enter runs `Xenova/all-MiniLM-L6-v2` (q8, 23.5 MB: 22.8 MB model + tokenizer) via Transformers.js on WebAssembly and picks the type with the closest `about` phrase (cosine on mean-pooled, normalised vectors). Keywords still go first; General if the model fails to load. The model starts loading as soon as the list comes up empty, so it's usually ready by Enter. A second Enter while it's thinking is ignored.
- Tuning (Node, same library): one sentence per type got 15/20 sensible; several short phrases per type, best phrase wins, got all 25 of the then-tested phrases plus 9/10 unseen ones (e.g. "my cat" → Photographs, "packaging design" → Mockups, "restaurant branding" → Graphic & Type; "letterhead" → Documents is debatable).
- Chrome, during a live scan (DINOv2 on WebGPU alongside): "spring collection lookbook" → Photographs in 4.4 s including the first download; thesis → Documents, tiktok → Screenshots. The scan finished normally, 6 families. Console errors seen were Tesseract's existing "Image too small to scale" OCR noise.
- Known: gibberish still gets a type ("zzz" → Graphic & Type). A minimum-similarity cut-off falling back to General would fix it; not added.

## AI pick shown as a row (2026-11-02)

- When no keyword fits, the closest-meaning type now renders as the only row while typing; stale answers (text changed, field left) are dropped. Enter: hovered row → top row → wait for the model. Checked by real typing: "thesis" → Documents; "thesis about birds" → General (near "a class project or school assignment"; arguably Documents, a phrase-tuning question).

## Essays go to Documents (2026-11-02)

- Ryan: essays are Documents, not General. Added keywords essay, thesis, dissertation, article, writing, research and the phrase "essays, research papers and school writing". Now by keyword: essays, thesis about birds, term paper, book report, writing samples → Documents. Still General via the AI: school assignment, english homework, class project.
- Leftovers: "cover letter" → Graphic & Type (cover + lettering prefix); "brand deck" lists Graphic & Type first, Documents second (tie, list order).
- Open question from Ryan: is Documents useful? Right now it only sets Balanced, same as General, so choosing it changes nothing yet.
