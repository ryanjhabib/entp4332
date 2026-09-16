# Memo source material — Font Specimen

Notes and specifics for the write-up. Live at https://ryanjhabib.github.io/entp4332/

---

## 1. The customer

**A working graphic designer evaluating a typeface they have not bought yet.**

Concretely: someone who has just downloaded a folder of trial fonts from a foundry —
Klim, Grilli Type, Dinamo, Colophon — named things like `GT-America-Trial-SemiBold.otf`,
and has to decide whether the family is right for a client project before spending
several hundred dollars on a licence.

Secondary: a design student handed a licensed font by a studio and asked to present
type options in a crit.

This is a real person with a real folder on their desktop, not a hypothetical user.

---

## 2. The problem

Four things are wrong with how that decision gets made today.

**Foundry specimen pages only sell you their own fonts.** Klim's page for Die Grotesk is
beautiful, and it is useless the moment the file is sitting in your Downloads folder.
There is no specimen page for *the file you already have*.

**Font Book previews, it does not specimen.** macOS shows you the face, but to do so you
install it system-wide — which pollutes every font menu in every app, and means
uninstalling a dozen trials later. It gives you no printable sheet, no size waterfall,
and no view of glyphs that have no keyboard mapping.

**Online specimen generators require an upload.** This is the real blocker, and it is a
licensing problem rather than a technical one. Trial licences routinely forbid
redistributing the file, and uploading a licensed font to a third-party server is
exactly the thing a studio's licence agreement tells you not to do. A designer who is
careful about licensing cannot use those tools at all.

**Trial fonts lie about their own names.** The file reports itself as
"GT America Trial SemiBold", so every tool shows you that mouthful instead of
"GT America".

---

## 3. Why this version

**The font file never leaves the browser.** This is the whole argument, and it is a
technical property rather than a promise. The file is read with `FileReader` into an
`ArrayBuffer`, rendered through the browser's `FontFace` API, and parsed for metadata
with opentype.js — all in the page. There is no server to upload to: it is a static
site on GitHub Pages. A designer under a trial licence can use it without breaking the
licence.

**It works on the file you have.** Drag it anywhere on the page.

**It prints.** A dedicated print stylesheet hides every control, stops rows splitting
across pages, and produces a clean sheet or PDF to put in front of a client.

**It reads WOFF2, which most tools will not.** More on that below — this is the single
hardest thing in the build.

**It fixes the names.** "GT America Trial SemiBold" resolves to **GT America**, with
*SemiBold · Trial* as subtext.

**It condenses the glyph grid.** Playfair Display reports 318 glyphs; 14 of those are
byte-identical outlines under different codepoints, and most of the rest are accented
variants. Default view: 95.

---

## 4. Specific failures, causes and fixes

Eight are logged in full in `BUILD_LOG.md`. These four are the ones worth telling.

### 4a. The glyph viewer never closed — and I misdiagnosed it for two rounds

**Symptom.** After adding the full-screen glyph viewer, the page went blank white. An
empty overlay with two arrows and a Close link floated over everything, and reloading
did not clear it.

**Why it was hard.** Nothing in the JavaScript was wrong. `viewer.hidden` was `true`,
the open/close handlers set and cleared it correctly, and `getBoundingClientRect()`
returned sane numbers. I assumed the blank screenshots were rendering lag in the preview
pane and carried on — for two rounds of changes, while it was live on the deployed site.

**Cause.** The overlay is markup with a `hidden` attribute, and its stylesheet gives it
a layout:

```css
.glyph-viewer { display: grid; }   /* my stylesheet          */
[hidden] { display: none; }        /* the browser's default  */
```

Author styles beat the user-agent stylesheet **regardless of specificity** — origin is
resolved before specificity is ever consulted. `display: grid` won every time, so the
`hidden` attribute did nothing at all.

**Fix.** One line, which has to be said explicitly because nothing infers it:

```css
.glyph-viewer[hidden] { display: none; }
```

**What I took from it.** Two things. Any element toggled with `hidden` is at risk the
moment it gets a `display` rule of its own — which is every overlay, dialog and drawer.
And when a screenshot disagrees with a measurement, the screenshot is evidence, not
noise. I now check computed style rather than trusting `element.hidden`.

### 4b. WOFF2 glyph data would not decompress

**Symptom.** Every `.woff2` rendered perfectly but fell back to "glyph data
unavailable". The console error was my own code's: `wawoff2 binding missing`.

**Cause.** Two wrong assumptions about the library, stacked.

1. I assumed `window.Module` was an Emscripten *factory function* — `Module().then(...)`.
   The CDN build is not modularised: it assigns a plain **object**, with `decompress`
   hanging directly off it. My `typeof factory !== "function"` guard rejected every time.
2. I assumed the script's `load` event meant it was ready. It does not — the WebAssembly
   compiles *asynchronously after* the script finishes parsing, so `Module.decompress`
   does not exist yet at that moment.

**Fix.** Poll for `Module.calledRun && typeof Module.decompress === "function"` before
calling it. Verified end to end: a 23 KB `inter.woff2` decompresses to **66,912 bytes**
of raw sfnt beginning with the `00 01 00 00` TrueType signature, which opentype.js reads
as "Inter, 518 glyphs".

**The subtle part.** `decompress()` returns a `Uint8Array` that is *a view into the wasm
heap*. It gets copied out before being handed to the parser, so later wasm activity
cannot overwrite the font data underneath it.

**Why this mattered architecturally.** Rendering and parsing are two independent paths.
`FontFace` handles WOFF2 natively; opentype.js cannot. So the specimen renders even when
parsing fails, and the failure degrades to a readable message instead of a blank page.
That separation was a design decision made before the bug, and it is why the bug was a
missing panel rather than a broken app.

### 4c. Ascenders and descenders sliced off at large sizes

**Symptom.** At 96px and above the type looked cropped — tops of capitals and tails of
`g`, `p`, `y` shaved flat against the rules. Separately, long strings ended in an
ellipsis.

**Cause.** Both symptoms, one line of CSS. I had used the standard truncation recipe:

```css
overflow: hidden;
white-space: nowrap;
text-overflow: ellipsis;
```

`overflow: hidden` does not clip horizontally — it clips **both axes**. With
`line-height: 1.1`, the line box was shorter than the glyphs' actual ink, so anything
outside got cut. It scaled with size, which is why 12px looked fine and 128px looked
broken.

**Fix.** Dropped truncation entirely: lines wrap, `line-height` went to 1.3, plus
`padding-bottom: 0.06em` for deep tails. There is no way to clip one axis —
`overflow-x: hidden` forces `overflow-y` to compute to `auto`, never `visible`. Ellipsis
truncation and full glyph display are mutually exclusive on one element.

**How I verified it.** Not by eye. For every size, canvas
`TextMetrics.actualBoundingBoxAscent + actualBoundingBoxDescent` is now smaller than the
rendered line box — 0 clipped lines across all 8 steps.

### 4d. The hero name came out absurdly long

**Symptom.** The big name read "Inter SemiBold" instead of "Inter". Longer families
wrapped to three lines.

**Cause.** Not a bug in my code — a property of the OpenType spec. Name ID 1 is only the
plain family for families of **four styles or fewer**. Anything larger cannot fit the
classic four-style model, so the weight is pushed into ID 1 and the subfamily degrades
to "Regular":

| Name ID | Inter SemiBold reports |
|---|---|
| 1 `fontFamily` | `Inter SemiBold` |
| 2 `fontSubfamily` | `Regular` |
| 16 `preferredFamily` | `Inter` |
| 17 `preferredSubfamily` | `SemiBold` |

**Fix.** Read IDs 16/17 first, fall back to 1/2, and when the subfamily still reads
"Regular", lift trailing style words off the family against a known list. The lift
requires more than one word to remain, so a family genuinely *named* "Black" keeps its
name. Trial markers are stripped the same way, wherever they sit in the string, matched
on word boundaries so "Protest Riot" is not mangled by the "test" inside it.

**Also here.** The hero is sized by *measurement*, not a fixed value: canvas
`measureText` at a 100px reference gives the ratio, and the size is set so the name
fills the measure exactly, clamped 48–300px. "Inter" hits the ceiling; "Libre
Baskerville" fits itself at 139px; neither wraps. `document.fonts.ready` must be awaited
after `document.fonts.add()` or canvas measures the *fallback* font and the number is
wrong.

---

## 5. What shows understanding rather than luck

- **Two independent paths.** Rendering (`FontFace`) and parsing (opentype.js) fail
  separately by design, so an unparseable file still produces a specimen.
- **Format detected from the file signature, not the extension.** A mislabelled `.ttf`
  is identified by reading its first four bytes (`wOF2`, `OTTO`, `wOFF`, `0x00010000`).
- **Verification by measurement.** Glyph clipping checked with canvas `TextMetrics`;
  centring checked against `innerWidth / 2`; the hidden-attribute bug caught by reading
  computed `display`. Screenshots were the thing that misled me; numbers were not.
- **Deliberate scope limits.** Variable fonts render their default instance — no axis
  controls. Glyph scanning is capped at 1,500 per font so a CJK face does not lock the
  page. Both are stated in the UI rather than failing silently.
- **Errors are readable and never silent.** A truncated file produces "The browser could
  not render truncated.ttf — it may be corrupt or use an unsupported flavour (Invalid
  font data in ArrayBuffer)" rather than a blank screen.

---

## 6. Numbers

| | |
|---|---|
| Live | https://ryanjhabib.github.io/entp4332/ |
| Stack | Plain HTML, CSS, vanilla JS — no framework, no build step |
| Source | 3 files, ~1,430 lines |
| Libraries | opentype.js (parsing), wawoff2 (WOFF2 decompression), both from CDN |
| Commits | 27 |
| Failures logged | 8, in `BUILD_LOG.md` |
| Formats | .ttf, .otf, .woff, .woff2 |
| Glyph condensing | Playfair Display: 318 reported → 304 unique → 95 shown by default |
| WOFF2 proof | 23 KB compressed → 66,912 bytes sfnt → "Inter, 518 glyphs" |
