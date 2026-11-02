# What the data says about grouping

Lessons from every folder in `TESTING.md`, plus the measurements behind them (details in `build-log.md`). Written to steer the next round of work on grouping. Similarity scores run 0–1: 1 = identical, about 0.8+ = the same content.

## How the app decides today (one paragraph)
Every file becomes 384 numbers from **DINOv2 small**, an image model running in the browser on a 224px version of the file. Two files' similarity is how close those numbers are. Text-heavy files (20+ words, from a PDF's text layer or OCR) are compared by **shared words** instead. On top sit nudges: same capture moment +0.3, matching file-name stem +0.05. **Lightroom's original-photo ID decides on its own.** Files at or above the level's threshold join a family; links are made strongest first, and two text documents whose words disagree are never chained together. Levels: **Loose 0.75 · Balanced 0.80 · Strict 0.88**.

## What works well
| Content | Evidence |
|---|---|
| **Colour edits, re-grades, B&W, re-exports at other sizes** | 0.92–0.99 on photos (hard test set, test 4) |
| **Re-edits months apart** | March originals + October re-edits = one family (test 5) |
| **Exports of the same Lightroom original** | original-photo ID: always one family, even a 0.47-alike re-crop (tests 9–10) |
| **Colourways** (socks, sweats) | together at every level (test 15); Ryan wants this |
| **Same design in different containers** | calendar as a bare Figma frame and inside site UI = one design (test 16) |
| **Iterations of a printed piece** | crest prints: closest iterations get their own family, broader ones nearby (test 16) |
| **Text documents re-laid out; slides vs their deck** | shared words decide (tests 6–7) |
| **Ordering by look** | similar families sit side by side, so near-misses are next to each other (tests 11–12) |

## Where it fails, and why
### 1. Crops and zooms of the same piece (the biggest weakness)
- **Seen:** "let me taste eternity" at two zooms of one print; a phone mock-up shown close-up vs small; earlier, a centre-40% photo crop scored only 0.47.
- **Why:** the model judges the *whole frame's* composition at 224px. Zooming changes the composition: big letters filling the frame look like a different picture from small letters in a field of paper. Photo crops at common ratios (4:5, 16:9) survive (0.84–0.92); heavy zooms don't.
- **Fix to try first: multi-scale matching.** Describe each image at a few zoomed crops (the whole image plus centre crops at, say, 70% and 50%, maybe a 3×3 grid of tiles), and score a pair by the *best-matching* crop pair. A zoomed-in version then matches the original's matching crop. It costs about 5–10× the model runs, which is fine in the background.
- **Also worth trying: detail (patch) matching on the zoomed crop.** DINOv2's per-patch features matched one-to-one recognise "same object, different framing". On its own it was ambiguous (flat-lays, test 14), but as a second check after multi-scale it may be decisive.

### 2. Short text is thrown away
- **Seen:** "let me taste eternity" (4 words), the calendar's words (about 12), "you > helvetica" (2). The word rule only starts at **20 words**, so all of these were judged by looks alone.
- **Why it matters:** graphic designers' work is often *short, distinctive type*. Four identical words in the same order are near-proof of the same piece. And the eternity pair, the calendars and the helvetica pages would all have been decided correctly by their words.
- **Fix: a phrase rule for short text.** If both files have 3+ confidently read words and most of the shorter set appears in the longer (by count and order), treat it as strong evidence: a big nudge, like the capture-moment one. If they share almost no words *and* both have some text, treat it as evidence of *different* pieces, which would have kept "you > helvetica" apart from "you are so beautiful…". Watch for crops cutting words ("eterr").

### 3. Near-blank pages all look alike
- **Seen:** two mostly empty light pages with a little small text grouped (test 16).
- **Why:** with little content, the model's numbers are dominated by "blank paper". Any two such pages score high.
- **Fix:** measure how much is actually in the image (edge density or variance). When *both* are low-content, require extra agreement (text, or near-identical looks) before grouping.

### 4. Inverted versions (black ↔ white)
- **Seen:** the full-bleed black calendar didn't join the light calendars (test 16), though a black calendar inside site UI did.
- **Fix to try:** also describe a light/dark-inverted copy of each image and take the better match, only for low-colour, graphic images. The short-text rule (2) would also catch this one, since the calendar's words match.

### 5. Same pose, different product
- **Seen:** two different jackets, both fronts, on the same backdrop: 0.87 (tests 14–15).
- **Why:** DINOv2 is trained to ignore colour (so B&W edits match), and pose, backdrop and framing dominate. Subject crop, patch matching and subject colour were all measured and none separates them cleanly.
- **Handled for now:** Strict (0.88), or N while comparing.

## Levels vs. content types (Ryan's idea, recommended)
The levels behave like one dial trading misses against wrong merges:
- **Strict:** precise but misses a lot. Every group it made in test 16 was right; it made few.
- **Loose / Balanced:** catch more, merge more.

No single setting is right, because **the right rule depends on what's in the image**:

| Content | What decides "same piece" | What to be careful of |
|---|---|---|
| **Photos** | capture time / original ID, then looks; colour irrelevant | bursts of one scene |
| **Product shots** | looks, strict (same pose ≠ same item); colourways together | silhouettes that match across products |
| **Graphic / type work** | words (even short phrases), multi-scale looks, inversion | near-blank pages |
| **Documents / decks** | words, page by page | templates |

**Recommendation:** replace Loose/Balanced/Strict with rules chosen **per file, automatically**, from cues the app already has:
- **Photo:** EXIF camera data.
- **Product shot:** a flat backdrop with one centred subject.
- **Graphic / type:** OCR finds words on a mostly plain background.
- **Document:** a PDF with a text layer.

Each pair is then judged by the rules that fit its content, with no setting to touch. Keep one manual override ("treat this folder as product shots") for edge cases, then S / N while comparing for the rest.

## Stronger models (Ryan: fine to use, even paid later)
- **Bigger local models.** DINOv2-base (~350 MB) or -large (~1.2 GB) see finer detail and may help with crops and products. They're free to run, but a bigger one-time download; worth a measured test on tests 14–16 before switching.
- **A vision-language model as judge, for borderline pairs only.** Ask something like "Are these two the same piece: same project, different iteration?" only for pairs scoring roughly 0.65–0.88. That's typically a small share of pairs, so the cost stays low, but it's real money per folder and **the images leave the computer**, so it should be opt-in. It fits the planned serverless function (the V2 AI-renaming key).
- **A "describe how to group" prompt** ("group by product; colourways together; front and back separate") is the same judge with the user's instructions added. It's powerful for designers, and a natural paid feature.
- In the Mac app, all of this can run in the background, so slower but more accurate is the right trade.

## Suggested order for the next work
1. ~~**Short-text phrase rule**~~ **done**, plus a second, larger OCR read for very large exports with a little text: all four test-16 misses fixed (eternity, phone, helvetica, black calendar; the calendar had the *same* text, just too small to read at 1600px).
   - **Follow-up from Ryan:** an earlier iteration with *different copy* is still the same project. Limit the −0.15 word-clash penalty to sparse, mostly-empty images (the low-content guard), so dense designs whose copy changed aren't pushed apart.
2. **Multi-scale (zoomed-crop) matching:** the crop weakness.
3. **Low-content guard:** stops near-blank pages merging.
4. **Per-file content type** replacing the three levels.
5. **Measure DINOv2-base** on tests 14–16.
6. **Opt-in AI judge for borderline pairs / grouping prompt** (paid, later).

Re-run tests 4, 14, 15 and 16 after each change, and record the before/after families in `TESTING.md`.
