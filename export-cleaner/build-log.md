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
