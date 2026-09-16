# Build log

A running record of what broke, why, and what fixed it.

---

## 1. Local preview server would not start

**Symptom**
```
File ".../http/server.py", line 1274, in <module>
    parser.add_argument('--directory', '-d', default=os.getcwd(),
PermissionError: [Errno 1] Operation not permitted
```

**Cause** Tooling problem, not app code. `python3 -m http.server` calls `os.getcwd()` at
import time, and it was launched from a directory the sandboxed process could not stat.

**Fix** Served the folder with a small Node static server that takes an absolute root path
instead of relying on the current working directory. Running `python3 -m http.server` from a
normal terminal inside the project folder works fine.

---

## 2. WOFF2 glyph data would not decompress

**Symptom** Every `.woff2` file rendered correctly in the specimen but fell back to the
"glyph data unavailable" message. The console error was the one thrown by our own code:
`wawoff2 binding missing`.

**Cause** Two wrong assumptions about the wawoff2 library:

1. We assumed `window.Module` was an Emscripten *factory function* — `Module().then(...)`.
   The CDN build is not modularised: it assigns a plain **object** to `window.Module`, with
   `Module.decompress` hanging off it directly. Our `typeof factory !== "function"` guard
   therefore rejected every single time.
2. We assumed the script's `load` event meant the library was ready. It does not — the
   WebAssembly module compiles asynchronously *after* the script finishes parsing, so
   `Module.decompress` does not exist yet at that moment.

**Fix** `runWoff2Decompress` now polls for `Module.calledRun && typeof Module.decompress === "function"`
(10s timeout) before calling `Module.decompress(bytes)`. Confirmed working: a 23 KB
`inter.woff2` decompresses to 66,912 bytes of raw sfnt starting with the `00 01 00 00`
TrueType signature, which opentype.js parses as "Inter, 518 glyphs".

**Also worth noting** `decompress()` returns a `Uint8Array` that is a *view into the wasm
heap*. We copy it out (`new Uint8Array(result).buffer`) before handing it to opentype.js, so
later wasm activity cannot overwrite the font data underneath us.

---

## 3. Stale data left behind after a failed load

**Symptom** Loading a good font, then a broken one, left the previous font's family name,
glyph count and file size sitting in the Information panel.

**Cause** `resetSpecimen()` only hid the specimen container and cleared the glyph grid. The
info rows and waterfall were never emptied, so the old content survived under the
`hidden` attribute.

**Fix** `resetSpecimen()` now clears the info grid, waterfall, glyph grid, glyph count and
notice text. The container is hidden *and* empty, so nothing stale can reappear.

---

## 4. `/System/Library/Fonts/LastResort.otf` reports as invalid

**Symptom** `The browser could not render LastResort.otf. The file may be corrupt or uses an
unsupported flavour. (Invalid font data in ArrayBuffer.)`

**Cause** Not a bug. That macOS file is a 2.5 KB stub — the real outlines live in the system
font cache, not in the file on disk. The FontFace API is correct to reject it.

**Kept as-is** It is a useful demonstration that the error path works: the message is
readable, the specimen stays hidden, and nothing is left half-rendered.

---

## 5. Ascenders and descenders sliced off in the waterfall

**Symptom** At the larger sizes the type looked cropped — the tops of capitals and
the tails of `g`, `p`, `y` and `Q` were shaved flat against the rules. Worst at 96px
and above. Separately, long test strings ended in an ellipsis: `Handgloves & Quartz Sp…`

**Cause** Self-inflicted, and the two symptoms share one line of CSS. To truncate long
lines I had used the standard ellipsis recipe:

```css
overflow: hidden;
white-space: nowrap;
text-overflow: ellipsis;
```

`overflow: hidden` does not clip only horizontally — it clips the box on **both axes**.
Combined with `line-height: 1.1`, the line box was shorter than the glyphs' actual ink,
so anything outside it was cut away. The taller the size, the more absolute overflow,
which is why it looked fine at 12px and broken at 128px.

**Fix** Removed the truncation entirely. Lines wrap instead, `line-height` went to
`1.3`, plus `padding-bottom: 0.08em` for fonts with unusually deep tails. Verified by
measuring, not by eye: for every size, canvas `TextMetrics.actualBoundingBoxAscent +
actualBoundingBoxDescent` is now smaller than the rendered line box.

**Worth remembering** `overflow: hidden` is a two-axis operation. There is no way to
clip one axis only — setting `overflow-x: hidden` forces `overflow-y` to compute to
`auto`, never `visible`. Ellipsis truncation and full glyph display are mutually
exclusive on the same element.

---

## 6. 128px type pushed the page sideways on a phone

**Symptom** After adding the 128px step, a one-word test string ("Handgloves")
rendered 666px wide. On a 375px phone that is roughly twice the viewport, with no
space character to wrap at, so the whole page scrolled horizontally.

**Cause** `overflow-wrap` defaults to `normal`, which only breaks at existing break
opportunities. A single long word has none, so it overflows its container instead.

**Fix** `overflow-wrap: anywhere` on the waterfall lines — it only engages when a word
genuinely cannot fit, so desktop is unaffected. Below 768px the size label also moves
above its line instead of sitting in a 56px column, giving the type the full width.
Confirmed at a real 375px viewport: `scrollWidth === innerWidth`, no sideways scroll.

---

## 7. The hero name came out absurdly long

**Symptom** The big name at the top of the specimen read "Inter SemiBold" rather than
"Inter". Longer families were worse, wrapping to two or three lines at the hero size and
forcing the type size down to compensate.

**Cause** Not a bug in our code — a property of the OpenType name table. Name ID 1
(`fontFamily`) is only the plain family for families of **four styles or fewer**. Anything
larger cannot express itself in the classic four-style model, so the weight gets pushed
into name ID 1 and the subfamily degrades to "Regular":

| Name ID | Inter SemiBold reports |
|---|---|
| 1 `fontFamily` | `Inter SemiBold` |
| 2 `fontSubfamily` | `Regular` |
| 16 `preferredFamily` | `Inter` |
| 17 `preferredSubfamily` | `SemiBold` |

We were reading ID 1, so the weight was baked into the hero.

**Fix** Read IDs **16/17** first and fall back to 1/2. Not every font ships 16/17, so when
the subfamily still reads "Regular" we lift trailing style words off the family ourselves
against a list (thin, light, medium, semibold, bold, black, italic, condensed, expanded…).
The lift requires more than one word to remain, so a family genuinely *named* "Black" keeps
its name instead of being stripped to nothing.

**Also fixed here** The hero is now sized by measurement rather than by a fixed value.
Canvas `measureText` at a 100px reference gives the ratio, and the size is set so the name
fills the measure exactly, clamped to 48–240px. "Inter" lands on the 240px ceiling;
"Libre Baskerville" fits itself at 139px; both occupy the same width and neither wraps.
Re-runs on window resize.

**Worth remembering** `document.fonts.ready` must be awaited after `document.fonts.add()`
or canvas measures the *fallback* font and the fitted size is wrong.

**Follow-up** Trial and test builds carry the same problem from a different direction:
foundries stamp "Trial", "Test" or "Demo" into the family name, and it appears at the start,
middle or end depending on the foundry ("Söhne Test", "ABCDiatype-Trial", "Klim Trial Die
Grotesk"). These are stripped wherever they sit and shown in the subtext instead, matched on
word boundaries so a family like "Protest Riot" is not mangled. A name consisting only of a
marker keeps what it had. Ceiling raised to 300px once names stopped carrying extra words.

---

## 8. The glyph viewer never actually closed

**Symptom** After adding the glyph viewer, the page went blank white. Screenshots showed
an empty overlay with the two arrows and a Close link floating on it, no matter what was
underneath. Closing the viewer changed nothing, and reloading the page still showed it.

Worse, it did not *look* like a bug from the code's side: `viewer.hidden` was `true`, the
JavaScript was setting and clearing it correctly, and element measurements all came back
sane. I initially dismissed the blank screenshots as a rendering lag in the preview pane.
They were not — this was live, and it had already shipped.

**Cause** The overlay is markup with a `hidden` attribute, and its CSS sets a layout:

```css
.glyph-viewer { display: grid; ... }   /* author stylesheet   */
[hidden] { display: none; }            /* browser's UA stylesheet */
```

**Author styles always beat the user-agent stylesheet, regardless of specificity.** It is
not a matter of the class selector outranking the attribute selector — origin is decided
before specificity is ever consulted. So `display: grid` won every time and the `hidden`
attribute did precisely nothing.

**Fix** One line, which has to be stated explicitly because nothing infers it:

```css
.glyph-viewer[hidden] { display: none; }
```

Verified on computed style rather than by eye: `none` on load, `grid` while open, `none`
again after closing.

**Worth remembering** Any element you toggle with the `hidden` attribute is at risk the
moment you give it a `display` rule of its own — every flex, grid or block overlay,
dialog, panel or drawer. Elements that never get a `display` declaration (the specimen
container, the notices, the file input) are unaffected, which is why only this one broke.

---

## 9. The glyph viewer was not actually centred

**Symptom** Reported by eye — "is the slideshow really centered vertically? i reckon its
not". It looked slightly low. Measuring the rendered outline against the viewport centre
put it **46.6px below** on a 800px-tall window.

**Cause** Two unrelated offsets that happened to stack in the same direction.

1. **Asymmetric padding, 16px.** The overlay was `padding: var(--space-16) var(--gutter)
   var(--space-8)` — 64px top against 32px bottom. Centred content in a box with uneven
   padding is not centred in the box: it sits `(64 - 32) / 2` low.
2. **Em box vs ink box, the remaining 30.6px.** The glyph was drawn with its baseline at
   `box / 2 + size / 3`, which centres the *em square*, not the glyph's actual outline.
   Every glyph has different ink extents, so each one was off by a different amount — a
   comma badly, a capital E barely.

**Fix** Symmetric padding, and a `centreInk` option that measures the drawn path's
bounding box and shifts it so the outline's centre lands on the viewBox centre.

**The deliberate part** `centreInk` is on in the viewer and *off* in the glyph grid. In
the grid the cells share a baseline, which is what lets you compare glyphs to each other;
a single glyph on screen has nothing to compare against and should just sit in the middle.
Only the translation changes, never the size, so relative proportion still reads — a
lowercase `o` measures 219px of ink against a capital `O` at 297px.

**Verified** Eight glyphs chosen to stress it — `0 b p , E o O j`, covering round,
ascender, descender, comma and cap — all land at **0.0px offset on both axes**.

**A note on method** The screenshot after the fix still looked wrong, and I had already
been burned once (entry 8) by dismissing a screenshot as rendering lag. So rather than
assume either way, I re-measured from a second direction: the overlay's rect against the
viewport, then the outline's rect against both. Viewer `0,0,1200x800`; ink spanning
y 291–510, centre `(600, 400)`; viewport centre `(600, 400)`. Independent measures
agreeing is what settles it — not the screenshot, and not the first number either.

---

## Test matrix (all passing)

| File | Format | Result |
|---|---|---|
| `Georgia.ttf` (371 KB) | TrueType | 1,134 glyphs, full info |
| `SourceCodePro-Regular.otf` (128 KB) | OpenType CFF | 1,568 glyphs, 1,500 shown + cap notice |
| `inter.woff` (30 KB) | WOFF | 515 glyphs, full info |
| `inter.woff2` (23 KB) | WOFF2 | 518 glyphs, full info (via wasm decompression) |
| `broken.ttf` (9 bytes of text) | — | "does not look like a font file", specimen hidden |
| `LastResort.otf` (2.5 KB stub) | — | Readable render error, specimen hidden |
