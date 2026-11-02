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
