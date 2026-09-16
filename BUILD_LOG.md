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

**A second follow-up, from the font's own data** Adding more sample faces surfaced
"Newsreader 16pt 16pt" in the hero. That is not a parsing error — the font file genuinely
reports that string, in name ID 1 *and* name ID 16, because the optical-size token got
written twice when the family was built. Adjacent repeated words in a family name are now
collapsed. Only *adjacent* ones, so a family legitimately called something like "New York
New York" is left alone.

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

## 10. Letter spacing did not scale with the waterfall

**Symptom** The tracking control worked — dragging changed the number and the type
moved — but the effect was almost invisible at 128px and heavy-handed at 12px. It was not
tracking proportionally at all.

**Cause** The value was applied to the waterfall *container*:

```js
el.waterfall.style.letterSpacing = `${tracking / 1000}em`;   // wrong
```

An `em` length resolves against the font size of **the element it is declared on**, and
what inherits down the tree is the resulting *fixed px value*. The container inherits the
10px UI size, so `-0.045em` resolved to **-0.45px** there and every line — 12px through
128px — inherited that same -0.45px. The 128px line should have had -5.76px.

**Fix** Set a unitless custom property on the container and multiply it out on each line:

```js
el.waterfall.style.setProperty("--tracking", String(tracking / 1000));
```
```css
.waterfall-line { letter-spacing: calc(var(--tracking, 0) * 1em); }
```

A custom property inherits as an unparsed number, so the `1em` resolves separately against
each line's own font size.

**Verified** At -45 every line holds a letter-spacing to font-size ratio of exactly
-0.045: 128px gets -5.76px, 96px gets -4.32px, down to 12px at -0.54px.

**Worth remembering** `em` in an inherited property is a trap. It is resolved once, where
it is written, and inherited as an absolute length. If a value needs to mean something
different at each level of the tree, it has to travel as a unitless custom property and be
given its unit at the point of use.

---

## 11. The weight control reported the wrong weight

**Symptom** Adding a control to step through a family's weights, the label was wrong for
Manrope: weight 400 read "ExtraLight", and so did weight 200. Stepping to 700 left
"ExtraLight" stuck in the family name — the hero read "Manrope ExtraLight".

**Cause** The name table, again, but worse than entry 7. Manrope's files are *all* named
"Manrope ExtraLight", at every weight, in name ID 1 **and** in ID 16:

| Weight | ID 1 | ID 2 | ID 16 | OS/2 |
|---|---|---|---|---|
| 400 | `Manrope ExtraLight` | Regular | — | **400** |
| 700 | `Manrope ExtraLight` | Bold | — | 700 |
| 500 | `Manrope ExtraLight Medium` | Regular | `Manrope ExtraLight` | 500 |

Entry 7's fix trusted ID 16 when it existed. Here ID 16 is polluted too, so the lift was
skipped and "ExtraLight" survived into the family. And the style label was coming from the
name table, which says ExtraLight for a 400.

**Fix, in two parts.**

*The label comes from a number, not a name.* OS/2 `usWeightClass` is what the renderer
itself uses to pick a weight, and it is correct in every file. Mapped to the standard nine
names, nearest step with ties going down — Manrope's 200 declares itself 250. For a sample
font the requested weight is known outright, which is better still.

*The lift is unconditional, and only for weight words.* Neither ID 1 nor ID 16 can be
trusted, so a trailing weight word comes off the family whatever they say. Width words were
removed from that list entirely: "Archivo Narrow" and "Roboto Condensed" are families in
their own right, and stripping the width would merge them into families they are not. A
weight on the end of a family name is nearly always an artefact of the build; a width
nearly never is.

**Verified** All seven Manrope weights now read "Manrope" with the correct label. The
parser regression set still holds: Inter SemiBold splits, Archivo Narrow and Roboto
Condensed keep their widths, a family literally called "Black" keeps its name, and
"GT America Trial SemiBold" still resolves to GT America / SemiBold · Trial.

**Worth remembering** Three separate fields in a font claim to describe its weight, and on
a badly built family all three can disagree. The numeric one is the only one anything
actually renders from.

---

## 12. A bad file threw away the specimen you were reading

**Symptom** Drop a `.mov` onto a specimen and the specimen vanished. You were returned to
the empty state and told the file was wrong, having lost the font you were looking at —
which you then had to load again to get back to where you were.

**Cause** Order of operations, in two places.

`handleFile()` opened with `resetSpecimen()`, before a single check had run. Everything
after it was a validation that could only ever return, so by the time the page knew the
file was unusable it had already cleared itself.

The second one was subtler and would have survived a naive fix. The render step read:

```js
if (loadedFace) document.fonts.delete(loadedFace);   // old face gone
loadedFace = new FontFace(FAMILY, buffer);
await loadedFace.load();                             // and this may throw
```

The old face was unregistered *before* the new one was known to load. So a file that got
past the signature check and failed at `FontFace` — a truncated but correctly-stamped
`.ttf` — left the page with no font registered at all, even if nothing else had been reset.

**Fix** Nothing is torn down until the new font is proved good. Every check returns before
any teardown, and the new face is constructed and `await`ed *first*; only once it resolves
is the old one deleted and the new one registered. `new FontFace()` registers nothing on
its own, so until that await returns the page is still rendering what it was already
rendering — and if it throws, it still is.

**Verified** With Playfair Display on screen, three bad files in turn — a `.mov`, an empty
`.ttf`, and a correctly-stamped but truncated `.ttf` — each raise a notice and leave the
specimen byte-for-byte unchanged, including the rendered width of the hero, which would
have moved had the face fallen back. A good font still replaces it.

**Worth remembering** "Validate, then act" is easy to state and easy to violate twice in
one function. The giveaway is any teardown that happens before the last thing that can
fail.

---

## 13. Going home showed the last font you hovered

**Symptom** Reported from Safari: after opening a font and clicking Home, the line of
subtext above the sample library — normally "Explore sample typefaces" in the UI font at
10px — sometimes rendered in whichever typeface had last been hovered, at that same small
size. Intermittent, and it looked enough like a font-loading artifact to be dismissed as a
browser quirk.

**Cause** Not a browser quirk. The preview slot has two pieces of state set on hover: its
text, and an inline `font-family` naming the hovered sample's face. `restPreview()` clears
both, and it was wired to `mouseleave` and `focusout` on the sample list.

Clicking a sample pill loads the font, which adds `has-font` to the body, which sets the
whole preview slot to `display: none` — the pill is removed from under the cursor while
the pointer is still over it. An element that disappears under the pointer does not
reliably fire `mouseleave`. So the handler never ran, and the slot kept the last hover's
family and text the entire time it was hidden. Clicking Home unhid it and there it was.

The small size is the other half of the same state. `fitPreview()` sizes the text by
measuring the laid-out element and returns early when `clientWidth` is 0, which it is
while hidden — so on the paths where the inline size had been cleared but the family had
not, the name came back at the stylesheet's 10px in the sample's own face.

**Fix** Stop relying on the pointer to report a transition the app is making itself.
`restPreview()` is now called at both state changes: when `has-font` goes on, and inside
`resetSpecimen()` when it comes off. The slot is left resting whenever it is not visible.

**Verified** Hover a pill, click it without moving the pointer, click Home: the slot reads
"Explore sample typefaces" with no inline `font-family` or `font-size`, and its computed
family is the UI stack. Before the fix the same sequence left `font-family: "Preview0"`
and the sample's name in place.

**Worth remembering** Mouse events describe the pointer, not the application. Any cleanup
hung off `mouseleave` is a cleanup that will not happen the moment your own code hides the
element. Tie state resets to the state change, not to the gesture that usually precedes it.

---

## 14. The phone never got the rule written for the phone

**Symptom** The sample library wrapped into a narrow column on a phone, taking half the
screen and breaking long names like "Manufacturing Consent" across lines, despite a rule
in the stylesheet that said exactly the opposite.

**Cause** Declaration order, not specificity. The two rules were:

```css
@media (max-width: 767px) {
  .sample-list { max-width: 100%; }   /* line 326 */
}

.sample-list { max-width: 50%; }      /* line 334 */
```

A media query adds nothing to specificity. Both selectors are a single class, so they tie,
and a tie is broken by whichever comes last in the source. The phone rule was written
first, so on a phone both rules matched and the 50% cap won every time. The override had
never once applied.

**Fix** The base rule now carries the unconstrained value and the cap is the exception,
moved into `@media (min-width: 1200px)` and scoped to the footer. The only rules inside a
breakpoint are ones that genuinely belong to that breakpoint.

**Verified** At 760px the list measures 712px against 712px of footer content — edge to
edge. At 1280px its computed `max-width` is 50% and it occupies exactly half. Before the
fix, 760px gave the same 50%.

**Worth remembering** A media query is a condition, not a promotion. Mobile-specific rules
have to come *after* the rules they are meant to override, or be written as the default
with the wider case as the exception — which is the version that cannot rot.

**Postscript.** This happened again, in the same stylesheet, several sessions later, while
moving the phone home page top down: a `body:not(.has-font) .site-footer { position:
static }` written up with the other phone rules, six hundred lines above the `position:
fixed` it was meant to beat. Identical selector, identical specificity, later declaration
wins, so it never applied once. Having written the entry above did not prevent it. What
caught it was measuring the result — `footerPosition` came back `"fixed"` — rather than
looking at the rule and believing it. Knowing a trap exists is not the same as checking
whether you are in it.

---

## 15. Shuffle looked broken, and was working correctly

**Symptom** "Sometimes I'll notice the same phrase only 2 or 3 shuffles apart."

**Cause** Nothing was wrong with the code. `randomPhrase()` excluded exactly one value —
the phrase currently on screen — so it could not hand back the same thing twice in a row,
which is the case that obviously reads as broken. Two apart was allowed: A, B, A is three
distinct draws with no two adjacent.

And that is common, not rare. Drawing uniformly with replacement from a pool of n, the
chance of a repeat somewhere in the next k draws rises much faster than people expect —
the birthday problem. Over a session of thirty shuffles, some near repeat is close to
certain. The generator was behaving correctly and the output still looked wrong, which is
the only thing that matters.

**Fix** Uniform randomness is the wrong model for something a person watches. Each pool now
keeps a short memory of what it has handed out and draws only from what is not in it —
`pickFresh(list, key)`, with a window of a third of the pool capped at twelve, falling back
to the whole list once exhausted so a short pool can never deadlock. Shared by the
waterfall, the page phrase and the page word, each with its own history.

**Verified** Thirty consecutive waterfall shuffles: 29 distinct, and no repeat anywhere
inside a window of five. Thirty page shuffles: 30 distinct. Before, repeats two and three
apart turned up within a handful of attempts.

**Worth remembering** "Random" and "feels random" are different specifications, and for
anything a person watches repeatedly the second is the one being asked for. A memory of
recent draws is the whole fix.

---

## 16. The longest word and the widest word are not the same word

**Symptom** On a phone, the page broke words across lines — "Our planet migrates
tomorrow" set at 96px came out as "tomorro / w". There was already a fitter whose entire
job was to prevent this, and it was running.

**Cause** The fitter measured the wrong word.

```js
const longest = text.split(/\s+/)
  .reduce((a, b) => (b.length > a.length ? b : a), "");
const widthAt100 = titleCtx.measureText(longest).width;
```

It picked the word with the most characters and sized the page to that. "migrates" and
"tomorrow" are both eight characters, so the strict `>` kept "migrates" — and at the same
size, in Libre Baskerville, "tomorrow" is 17% wider. The page was fitted to a word that
was not the problem, and the actual widest word overflowed by exactly that margin.

Character count is a proxy for width that fails hardest in a font specimen, which is the
one application where the whole point is that different letters have different widths.
`iiii` and `WWWW` are both four characters. The same mistake was in the hover preview's
fitter, copied from the same idea.

**Fix** Do not identify a word at all. Measure every word and take the largest width:

```js
const widthAt100 = text.split(/\s+/)
  .reduce((max, word) => Math.max(max, titleCtx.measureText(word).width), 0);
```

Two further gaps turned up under the same test. The fit ran once, at render, against a box
that can still be zero-width on a first paint — and `fitPageText` returns the preset
ceiling untouched when it cannot measure, which is how a 96px preset reached a phone
unmodified. It now re-measures after layout and on every resize, and that re-measure only
ever lowers the size, so a size set by hand on the scrub survives unless holding it would
break a word. And the floor of 24px was itself too high for a face as wide as Michroma to
get a long word onto one line of a phone; it is 16px now.

**Verified** 360 shuffles across six faces — Michroma, League Gothic, UnifrakturMaguntia,
Manufacturing Consent, Libre Baskerville, Playfair Display — at 420px wide: zero words
wider than the box. Sizes ranged 20px to 180px, so the fitter is working across the range
rather than pinning everything to the floor. 80 more at desktop width: zero.

**Worth remembering** When a measurement is available, do not substitute a proxy for it.
`length` is a property of a string; width is a property of a string *in a typeface*, and
this program exists precisely because those two things come apart.

---

## 17. Fixed in one of the two places it was wrong, and tested only the one I fixed

**Symptom** Reported by the user, after entry 15 was supposed to have dealt with it:

> "Under the wet thatch they argued about **twin moons rise** until somebody mentioned the
> sundering. What the inventory called longing the cook called **you > helvetica**, and the
> cook was right."

Both of those are on the exclusion list. Both were still reaching a sentence slot.

**Cause** There are two paragraph generators, not one. `pageParagraphs()` builds the big
page; `paragraphText()` builds the two columns in the paragraphs section. Both fill the
same `{a}` / `{b}` slots, and each named its own pool:

```js
const phrases = shuffled(SLOT_PHRASES);   // pageParagraphs  — switched over
const pool    = shuffled(PHRASES);        // paragraphText   — missed
```

When the curated slot list was introduced I changed one and did not look for the other.

The part worth keeping is why the test passed. The verification drove `page-shuffle` 300
times and found nothing, because `page-shuffle` runs the generator that had been fixed.
`para-shuffle` was never clicked. The test proved the fix worked where I had applied it —
which is not the same claim as the fix being complete, though the green result reads
identically.

**Fix** The pool is named once now, in `slotPool()`, and the substitution happens once, in
`fillSlots()`. Both generators call both. Changing the pool for one caller and missing the
other is no longer something the code allows.

**Verified** 100 paragraph shuffles and 100 page shuffles, scanned against all 37 phrases
that are in the main pool but deliberately not in the slot list: zero in either. Matched on
word boundaries after a first pass on raw substrings reported a false "squire" — which is
the legal slot phrase "squires & omens" containing it.

**Worth remembering** Two questions, and the second is the one that gets skipped: *did my
change work*, and *did I change every place that needed it*. A passing test answers the
first. Only a grep for the old pattern answers the second, and it costs a few seconds:
`shuffled(PHRASES)` would have found the second call site immediately.

---

## 18. One ladder for every screen, and it did not fit any of them well

**Symptom** The waterfall broke words on a phone — 3 shuffles in 20 with Pinyon Script,
13 lines in 90 with Michroma. Reported as a known defect rather than found by a test: the
page had a measured fitter, the waterfall had none.

**Cause** The ladder was one hard-coded list, `[128, 96, 72, 48, 36, 24, 16, 12]`, used at
every width. 128px of a wide face cannot get a long word onto one line of a 372px column,
so the word broke. The list was also not a scale: 128/96, 96/72 and 48/36 are a perfect
fourth, but 72/48, 36/24 and 24/16 are a fifth. It looked like a system and behaved like a
hand-picked list.

**Fix** One ratio — the perfect fourth, the interval most of the old list already used —
and one top size per breakpoint, with the steps falling out of it:

```
phone     64  48  36  27  20  15        paragraphs 15 / 27
tablet    96  72  54  41  30  23  17    paragraphs 17 / 30
desktop  128  96  72  54  41  30  23 17 paragraphs 17 / 30
```

Fewer steps on a phone, because the bottom of a long ladder is unreadable before it is
informative. The paragraph columns are two steps of the same scale rather than a separate
pair of numbers, so both sections read the same system at different points. Every label
reports the size actually set — the sizes are rounded to whole pixels for that reason, since
a specimen that says 40.5 is reporting arithmetic rather than type.

A breakpoint still cannot hold every face. Michroma is wide enough that even 64px breaks on
a phone, so the ladder may start up to three whole steps below its nominal top when the top
will not fit — same ratio, same number of steps, entered lower down. It is measured against
the phrase pool rather than the line currently on screen, so the ladder is a property of the
face and the viewport and does not jump about between shuffles.

The trade is deliberate and worth stating: sizing for the widest word that *could* appear
means a face like Instrument Sans starts at 48 rather than 64 on a phone, slightly smaller
than most phrases need. Guaranteeing no broken word costs that.

**Verified** At 420px across Michroma, Pinyon Script and Instrument Sans, 12 shuffles each,
72 lines each: zero broken words, and exactly one ladder per face across all 12 — no jitter.
At 1280px: normal faces keep the full 128 ladder, Michroma drops one step to 96, zero broken
words. Crossing a breakpoint re-renders at the new sizes and keeps the prose it already had.

**Worth remembering** A list of numbers that mostly follows a rule is worse than either a
rule or an honest list, because it invites you to trust a system that is not there. And a
fixed ladder is a claim that every screen is the same screen.

---

## 19. The banner and the hero wanted the same line, and the phone had room for one

**Symptom** On a phone the hero's style pills sat underneath the pinned banner. The two
share a centre line by design — they were built to — and at 375px they overlapped by about
66px.

**Cause** Both are anchored to the middle of the bottom edge from opposite directions. The
style row starts at the left gutter; the banner is centred with `left: 50%` and a
translate. On a wide screen there is a gulf between them. On a phone there is not: the
banner is 285px of a 375px screen, 76% of the width, so the middle *is* the left.

**Fix** The first idea was to right-align the banner, and measuring it killed that on its
own: right-aligned against the gutter the banner starts at 66px and the pills end at 156,
so it still laps them by 90. A 76%-wide element cannot be moved out of the way of anything.

So it gives up its first clause as well as the centre. "Drag and drop a font anywhere, or"
was never true on a phone — you cannot drag a file onto a touch screen — and the button
after it was always the only part you could act on. Hidden below 768px, the banner is 118px
instead of 285 and right-aligning then clears the pills by 166.

Scoped to `body.has-font`. On the empty state the banner is alone in a centred column with
nothing to collide with, and there it keeps the whole sentence.

**Verified** At phone width: banner 118px at the right gutter, pills end at 156, clearance
166, no overlap, still on the style row's line. At 1000px: unchanged — 285px, centred to
the pixel, full sentence, on one line, clear of the pills. Empty state keeps the full
sentence at both.

**Worth remembering** Measure the fix before writing it. Right-aligning was the obvious
move and it was obviously wrong the moment the element's width was compared to the screen's
— which took one line of arithmetic and would otherwise have taken a round trip and a
second bug report.

---

## 20. The glass was eating the transitions, and the transitions were not the problem

**Symptom** Two complaints that turned out to be one bug. Hover on the pills "still feels
static" after two separate attempts to fix it. And the font menu "loads in static then does
the blur, its a weird glitch."

**Cause** `backdrop-filter`, in two different ways.

The first attempt added a 160ms transition on `background-color`. Measuring the hover states
afterwards showed why it changed nothing: the hover grounds were 10 to 12 steps of 255 away
from the resting ones, below the threshold where a fade has anything to show. Easing
imperceptibly is still imperceptible. So the second attempt deepened them to 28 steps and
lengthened the fade to 200ms — and it still felt static, which is the point at which the
transition stops being a plausible suspect.

A background-color transition on a backdrop-filtered element does not tween. The element
sits on its own composited layer and the backdrop behind it is re-rasterised rather than
interpolated, so the change lands in one step no matter what duration is declared. Every
light pill on the page was glass, so every hover on the page snapped.

The menu is the same property failing the other way round. An element with
`backdrop-filter` inside an ancestor whose `opacity` is less than 1 has no backdrop to
sample — the ancestor becomes a backdrop root containing only itself. The menu fades from
opacity 0 to 1, so for the whole length of that fade its pills rendered flat, and they
picked up the blur in one frame when the fade finished and the opacity hit 1. One flat pill
is a style. A pill that turns to glass a moment after it arrives is a glitch.

**Fix** Glass only for things that float over moving type and never change on hover: the two
header pills and the pinned banner. Everywhere else — the sample library, the menu, Shuffle,
the style note, the print button — the pills are solid. On a white ground the blur was
showing nothing anyway, so almost none of it is visible loss.

**Verified** A 200ms `background-color` CSSTransition object still constructs on a
now-solid pill. `backdrop-filter` survives on exactly two elements, `#home` and
`#header-font`, plus the specimen banner. Menu pills are solid `#F5F5F5` with no filter,
and both menu fades read 550ms.

**Worth remembering** Two failed fixes in a row is the signal to stop fixing and start
asking what else is true of every element that misbehaves. Both symptoms named the same
property out loud — one of them said "the glass thing" — and it still took a third pass to
hear it.

Also: `:hover` cannot be tested here. Synthetic pointer events do not set it, and the
preview pane has no OS focus, so even moving the real cursor onto an element leaves
`matches(':hover')` false. `getAnimations()` proves a transition is *declared and
constructible*; it cannot prove one is *smooth*. That gap is exactly where this bug lived,
which is why it took a user to find it three times.

---

## 21. A dip that transitions both ways is a dip that never happens

**Symptom** After entry 20 fixed the pills and the menu, the home page's hover preview was
still reported as static. It was the one element whose fade was driven from JavaScript
rather than by `:hover`, so the backdrop-filter explanation did not cover it.

**Cause** The fade was written to dip and return, with a transition on both halves:

```js
preview.style.opacity = "0.25";
await new Promise(requestAnimationFrame);   // one frame
preview.textContent = name; fitPreview();
preview.style.opacity = "1";
```

The single frame was deliberate — a value set and unset inside one frame gives a transition
nothing to run between — but one frame is enough to *start* the way down, not to finish it.
At 200ms, 16ms of travel is 8%: the opacity got to about 0.94 and was told to come back.
The comment in the code said the frame was there "to let the browser see the start value",
which was true and beside the point. Nothing visible ever happened.

**Fix** Only the return is transitioned. The drop kills the transition, sets 0.2 and commits
it with a forced reflow; the swap happens at 0.2; then the transition is restored, committed
again, and only then is the opacity set back to 1. The second commit matters as much as the
first — restoring `transition` and changing `opacity` in one recalculation means the change
is evaluated before the transition exists, and again nothing runs.

**Verified** Reading opacity the instant `showPreview` resolves: `0.2`, with a 260ms opacity
CSSTransition object live on the element, settling at `1`. Before the fix the same read gave
`1` and no transition object at all.

Also worth recording: the first attempt to verify this returned "no transition" for the
right reason and the wrong one — the preview is `display: none` below 1200px, and the
preview pane is about 490px wide, so the element under test was not rendered. A hidden
element runs no transitions. The measurement had to move to an emulated 1280px viewport
before it meant anything.

**Worth remembering** Two transitions in opposite directions, separated by one frame, cancel
to nothing. If a change has to happen *at* a particular value rather than on the way to one,
that half cannot be animated — commit it, then animate the other half.

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
