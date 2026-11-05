# What Export Cleaner has been tested on

A running record of every kind of folder and file the app has been run on, what each one checked, and how it went. Newest at the bottom. The test folders live in `test-images/` (git-ignored, never committed); Ryan's real folders stay where they are.

| # | Folder / files | Kind of content | What it checked | Result |
|---|---|---|---|---|
| 1 | Fake folder: 9 entries | Mixed names, `.txt`, `.DS_Store`, subfolder | Step 1: only design files are read | ✅ 6 of 9 read; the rest skipped |
| 2 | Fake folder: 8 files | Generated PNG, JPG (6000×4000), WebP, SVGs, PDF, broken files | Thumbnails for every type | ✅ all previewed, broken ones say "No preview" |
| 3 | 6 macOS wallpapers → JPG | Landscapes, abstract colourful designs | Edits, crops, colourways, re-exports: how similar they score | ✅ used to choose DINOv2; dHash failed crops |
| 4 | 23-image hard test set | Same photo as edits, crops (4:5, 16:9, 9:16, off-centre); one poster in 3 layouts; a different poster in the same layout | Can the model tell same content from different? | ✅ DINOv2: weakest same 0.84, strongest different 0.73 |
| 5 | 14-file "Model Test" | Wallpapers across two days, re-edits months later, a broken file | Whole-folder families, months apart | ✅ March originals + October 9:16/16:9 re-edits = one family |
| 6 | Hand-written PDFs | 3-page deck, same text re-laid out, different doc on the same template, PNG of a slide | PDF pages and words | ✅ after fix: deck + re-layout + slide together, other doc apart |
| 7 | OCR test (10 files) | PNG exports of text slides, photo posters, photos | Reading text inside images | ✅ slides join their deck, template look-alikes stay apart |
| 8 | Format test | TIFF (8-bit, LZW, 16-bit), AVIF, GIF beside JPG twins | More file types | ✅ all read, each grouped with its twin |
| 9 | **Ryan's Lightroom Saved Photos** (3 JPG) | Three Lightroom exports of one iPhone photo | EXIF / original-photo ID | ✅ read as the same shot; also showed "Untitled-NNN" numbers count exports, not photos |
| 10 | Re-crop with metadata | Centre-40% B&W crop with the original's metadata copied in | Original-photo ID deciding on its own | ✅ joins its original despite looking only 0.47 alike |
| 11 | **Ryan's Unsplash folder** (362 photos) | Mostly distinct stock photos | Real-world grouping at scale | ✅ 334 families; matches seen were right (e.g. two `oxana-golubets` shots), no wrong merges spotted |
| 12 | **Ryan's ~35-file folder** (Wolfgang Hasselmann photos) | One photographer's set: flowers, snow, landscapes | Grouping and look-ordering | ✅ "groups accurate", about a minute in total; prompted ordering by look |
| 13 | 30-version test family | One photo graded 30 ways | Compare screen layout, pinned frames, scrolling | ✅ fits one screen at 1043 and 800px tall |
| 14 | **Ryan's product flat-lays** (4 PNG, 4000×5333) | Two different jackets, front and back, same grey backdrop and pose | Same pose, different product | ❌ the two **fronts** grouped (looks 0.87): the model ignores colour by design, so "green bomber front" ≈ "brown leather front". Subject-only (0.80), detail matching (0.32 vs a legit crop's 0.34) and subject colour (ΔE 12–16 vs edits' 9–21) don't separate them cleanly. Now handled two ways: the **Strict** grouping level (88%) separates them, and **Not the same (N)** splits them in one key while comparing. |
| 15 | **Ryan's "misc FInal" product flat-lays** (28 files) | Jeans, sweats (grey + black), bombers, a bag in 3 shots, beanies, 9 sock colourways, quarter-zips on models, a perfume bottle | All three grouping levels on a real product folder | Mixed, and useful. The model groups by shape, not colour, so **colourways stay together** at every level (9 socks; grey + black sweats), which Ryan wants. **Loose (9) / Balanced (10):** jeans + sweats merge (similar silhouettes); jacket fronts merge. **Strict (16):** jeans pair and sweats 4 come out exactly right and jackets split, but the bag's 3 shots and the 2 beanies split too. No single level is right for the whole folder; S / N while comparing fix the rest. Quarter-zips: Ryan finds the dark pair grouping understandable. |
| 16 | **Ryan's "graphic" folder** (37 files: graphic design practice and portfolio finals) | Mostly text on paper, printed and scanned; type posters; a printed crest on different papers; a calendar design as Figma frames, inside site UI and full-bleed black; an iPhone mock-up showing a dua | Real graphic-design work, Balanced (25 families) | **Strong:** the crest printed on different papers formed sensible groups, with the closest iterations (two wrinkled prints of slightly different versions) in their own family, which Ryan loved; calendars as plain Figma frames and inside site UI were recognised as one design. **Misses:** ❌ **crops / zooms**: "let me taste eternity" at two zooms of the same print (`3597`, `3599`) and the dua phone mock-up close-up vs small (`wefrgtnghn`, `scanene`) stayed apart; ❌ the full-bleed black calendar (`wwwqwd`) didn't join the calendar group; ❌ **wrong merge**: "you > helvetica" with "you are so beautiful in that eva suit" (two near-blank pages with a little small text). **Strict:** very few groups, but every one it made was right (precise, misses a lot). |
| 16b | Same graphic folder, after the **short-text phrase rule** | as above | Before/after | 25 → 24 families: ✅ eternity zooms joined, ✅ dua phone close/small joined, ✅ helvetica / eva suit split; all other families unchanged; tests 5–9 and 14 unchanged. Then the black calendar turned out to have the *same* text, unread at 1600px. |
| 16c | Same graphic folder, after **re-reading large exports with a little text at 3200px** | as above | Before/after, time | 23 families in 61 s (original run 46 s): ✅ black calendar joins (calendar family of 4), and eternity, dua phone and helvetica fixes held. All four misses Ryan flagged are fixed. Earlier folders unchanged. |
| 16d | Same graphic folder, re-reading **any** large export with text | as above | Sheet vs its mock-up (`Untitled-28` / `Untitled-35`) | ✅ grouped (word overlap 0.46 at 1600px → 0.97 at 3200px); 22 families in 70 s; all earlier fixes hold; earlier folders unchanged. |
| 17 | **Ryan's B&W street photographs** (`portfolio media/photo/monotone`, 58 Lightroom exports, Ricoh GR III) | Monotone street photos; several frames of one scene seconds apart; repeat exports | Grouping photos with no colour and no text | ✅ **Accurate** (Ryan: "really great job"). Exports of the same photo grouped (`205` + `206`: same original ID, same capture second). Separate frames of the same scene stayed apart and Ryan agrees that's right; metadata confirms they're different photos (`204` shot 4 s after `205`; motorbike `218` / `239` 4 s apart; streets `192` / `193` 2 min apart). Look-ordering puts those near-frames side by side. |
| 18 | **Ryan's colour documentary photos** (`portfolio media/photo/documentary`, 59 Lightroom exports, Ricoh GR III) | Street and travel photos in colour; few duplicates; frames of one scene | Wrong merges in a mostly-unique set | Mostly ✅. Same photo exported twice grouped (`126` + `161`, same original, 0.99); near-identical frames 2 s apart grouped (`1469` + `1470`, 0.92), which Ryan likes; bedroom frames 6 s apart apart (0.57). ❌ two different dune photos 8 min apart grouped (`144` + `147`, 0.82: big plain areas of sand and sky). **Fixed:** photos the metadata says are different shots get −0.08, so the dunes split (0.74) and the building frames stay (0.84). |
| 19 | **Ryan's mixed portfolio photographs** (`Lightroom 2/Portfolio Photographs`, 95 files) | Lightroom exports (Ricoh GR III), iPhone shoots, product tees, downloaded car photos, a false-colour image | Real mixed folder | ✅ **Great** (Ryan). Same photo re-cropped a year later (`Wizard-2106` + `2106.2`, the second with **no metadata**, matched on looks alone); a crop to a different shape months apart (`2095` tall + `2309` wide); the same image in totally different false colours (`Untitled-288` + `Wizard-2048`); a re-export months apart (`2303` + `3679`); five photos of the same crashed car model kept apart. ❌ two **different cyclists** shot 2 s apart grouped (`3168` + `3174`): consecutive frames, same setting and framing, different subject. That's the same-pose problem (tests 14–15); the metadata gap (2 s) looks exactly like the building frames Ryan wants grouped (test 18). Use N while comparing. |
| 20 | **Ryan's "site post" folder** (36 desktop screenshots of his portfolio site) | Each screenshot: browser bar + white page with one small piece in the middle | Same template, different content | ❌ **10 different graphic pieces merged into one family**: the shared site frame outweighs the small piece inside it. Photos survived (their colour and contrast stand out). Proposed fix: compare a centre crop as well as the whole; a strong whole match with a weak centre match means same frame, different content. **Acceptance check:** `FAMOUSTEE1` + `FAMOUSTEE3` (same white tee, different small chest print, test 19) must stay together. |
| 21 | **Ryan's 3-year Lightroom folder** (`Lightroom 2`, 1,286 photos) | Three years of exports and re-edits: colour, B&W, crops, light-leak edits, fashion shoots, events | The biggest real test: "find the final" at scale | ✅ **Mostly very good** (Ryan). One photo re-edited over a year in one family (yellow bush, 9 versions, Dec 2024 – Dec 2025); beach portrait with 5 exports incl. light-leak edits and `613 FIXED` (Jul 2024 – Nov 2025); colour + B&W twins; crops to new shapes throughout. ❌ **Same subject, different photo:** consecutive B&W frames of different cyclists (`389`–`393`); the same white tee on a model in different shots and sessions (`1013` vs `1024`/`1026`; `1008` vs `1296`/`1297`). **Performance:** previews about 1 min, then about 1.9 s per photo, **41 minutes in total**; the Chrome tab used **about 1.8 GB**. |
| 21b | Same Lightroom folder, more of Ryan's notes | | Crops and site screenshots | ✅ "Surprised how good it got some of these crops" (Ryan crops normally, plus 90° rotations): wide taxi shot + tight hooded crop (`1158` + `1159`); flower crops across months (`713`/`746`/`1817`/`1818`, `7` + `197`, `198` + `707`); a 7-file branch session. Cat frames in a near-identical pose grouped; Ryan accepts that as an iteration. ❌ **A site screenshot of a photo** (`wedaq.png`) didn't join the photo itself (`701` + `1811`): the reverse of test 20, where the frame hides that it's the *same* piece. **Second acceptance check for the centre-crop fix:** `wedaq.png` should join `701` + `1811`. |

## Typography setup (2026-11-02)

- Temporary font specimen page, removed after checking: Instrument Sans and EB Garamond, each at regular and maximum weight, in normal and italic styles. This is synthetic test text, not user folder content.
- Chrome reported all four font faces `loaded`. Instrument Sans supports weights 400–700 and widths 75–100%; EB Garamond supports weights 400–800. Checked at 1800×1043 and 900×800, with no horizontal overflow.
- `npm run build` passed and emitted all four WOFF2 files. Existing interface typography remains the system font; the new families are available through CSS custom properties for Ryan's design pass.

## Syca intro and folder input (2026-11-02)

- **Layout:** checked in Chrome at 1800×1043, 900×800 and 375×812. Five stretch columns, 24px margins, 12px gutters. The 2px rule's center was 521.5px, 400px and 406px respectively, exactly half the viewport height. No horizontal overflow. The intro is one line at the first two widths and two lines at 375px.
- **Typography:** intro 36px EB Garamond Regular 400, 110% line height; brand/caption 16px Medium 500. Confirmed computed weights and `-webkit-font-smoothing: antialiased`, matching RH Studio's root `antialiased` utility. Accent and text sampled from Ryan's screenshot: `#97A084` and `#333333`.
- **Visual spacing:** desktop and 900px screenshots show approximately 28px between visible letters and the white rule. The text box is 32px away, including a 4px optical adjustment for Garamond's glyphs. At 375px the last line is “folder”, with no descenders, and its visible gap is about 38px; the text-box gap remains 32px. No separate phone design was supplied.
- **Native picker:** clicking select in the foreground test tab opened Chrome's macOS folder picker. Cancelling leaves the intro available.
- **Synthetic browser integration:** a temporary copy of the app's HTML imported the real `main.js` and used synthetic `DragEvent` objects and directory handles with an ignored `.txt` file. Nine checks passed: invalid-file navigation blocked, intro retained, useful error shown; valid drop navigation blocked, directory routed through scanning, normal extension filtering retained; loaded-run drop navigation blocked and folder retained; select routed through the picker. Temporary page removed afterward. This does not establish native Finder drag end to end.
- **Drop helper:** Node assertions passed for synchronous handle capture before awaiting, valid-directory acceptance, no items, string-only items, multiple files, unavailable handle API, a file handle, and a null handle.
- **Limits:** no real user folder was used or moved. Full native Finder drag remains a manual check. Save progress is still not implemented; these changes do not preserve a loaded run across HTML/JavaScript reloads. The connected user tab was already on the start screen with zero loaded cards before this work.

## Describe field and home-screen scan (2026-11-02)

- Chrome at 1728×1009 (Figma frame size), 900×800, 700×800, 375×812 with the `modelTest()` folder through the real select button. Measurements and keyword checks are in `build-log.md`. Not yet tried with a real folder or the native picker.

## Kinds of content still untested
- Figma exports (frames, components, variants)
- Real multi-page client PDFs and slide decks
- RAW-adjacent Lightroom exports (16-bit TIFFs from a real catalogue)
- Folders over 1,000 files end to end (time and memory)
- Screenshots and UI mockups

- 2026-11-02 caption check: new 12px / 500 Garamond description, 16.8px line height, two lines with one explicit break. Checked at 1800×1043 and 375×812; 40px visible wordmark gap on desktop, no overflow.

## Unified loading screen (2026-11-02)

- Chrome layout at 1800×1043, 900×800 and 375×812: centered 2px line, upright 36px / 400 percentage, 12px / 500 Instrument Sans status, 16px / 500 italic fact label and 32px fact. Verified `#95A081` progress and `#AAAAAA` muted text. No horizontal overflow; fact expands across additional columns in smaller windows.
- Thirteen browser checks passed. Synthetic folder enumeration was delayed 500ms, and one generated PNG passed the real thumbnail, DINOv2, OCR, grouping and final-card pipeline. Confirmed loading before enumeration ends, hidden overview/no thumbnail grid during processing, 100% before overview, correct final card, monotonic/settled percentage, ETA calculation, failure recovery, stopped dots and completion without a hang when already at 100%.
- Recorded progress samples from 0→67%: settled by 185ms and stayed settled through 501ms; dots observed as `.`, `..`, `...`, `.` at 600ms intervals. One fact remains stable; 20s rotation is configured for future additional facts. A 67% / approximately 3-minute preview was seeded for visual QA only. Temporary fixtures removed; no user images or real folder were used.
- Limits: no repeat of the 1,200-image run or cold-cache resource network audit. Grouping logic and processing providers did not change. Reduced-motion handling is implemented; this session’s live animation measurement used normal motion.

## Saved progress across refreshes and tabs (2026-11-03)

- **Setup:** two real folders in Chrome's private test storage (OPFS, so the handles can be saved), built from the generated Sonoma / radial / horizon test images. No user files.
- **Refresh:** 5-file folder, first scan 4.3 s; after a split (Not the same) and a keep/reject pair, a refresh brought back the identical families, choices, Mixed and Balanced, with data restored 184 ms after page start.
- **Two tabs:** a second tab picking the same folder showed “already open in another Syca tab” on the start screen without taking its media type; a different folder opened normally, both locks held, each tab resuming its own folder. A background tab finishes resuming only once shown (Chrome pauses animation frames there).
- **New file:** adding one file and refreshing scanned only that file (about 7 s, mostly first-use warm-up of OCR and the GPU model); choices kept, families regrouped.
- **Forget / expiry:** Forget returned to the start screen and removed only that folder's records; all 6 files stayed on disk. A 31-day-old record was dropped at start, a 29-day-old one kept.
- **Not checked:** the “Resume” click after Chrome is closed and reopened (test-storage folders are always readable); a refresh in the middle of a long scan (same per-file save path as the new-file test).

## Full-flow audit after the Families rebuild (2026-11-03)

- **Folder:** an 11-file test folder in Chrome's private storage (no user files): 3 sets (Sonoma ×3, radial ×2, horizon ×2), solos mac-purple, a pale paper PNG, a one-page PDF and an unreadable `broken.png`.
- **Start → Families:** picked the folder, typed "mixed exports" (one row: Mixed), Enter → loading → Families: 3 sets · 4 solos; PDF and paper got the edge line; broken.png "No preview". Grouping Strict / Loose / Balanced and Show All / Sets / Solos worked; Enter on a focused cell opened Sort.
- **Sort:** Keep both, Undo, Backspace with nothing to undo (no-op), These are different, ⌘Z, zoom arrows looping 3/3 → 1/3 → 2/3 → 3/3, Escape back, Pick, reopening an out version from the strip, then on to the next set; sets → solos (broken Keep, mac-purple Delete, PDF Keep, paper Delete) → Summary.
- **Summary → Apply → Done → Rescan:** 6 to reject / 5 to keep matched every choice; Apply moved the 6 into `_to_delete` (all direct moves), Done reported 2.0 MB; Rescan showed 5 files, all kept, Sort disabled.
- **Found and fixed:** the start bar's first frame could run backwards (scaleX −0.004); skipped screen fades threw uncaught promise errors; Syca sat left on Done; Summary's Sort was enabled with nothing to sort; a sorted family clicked in Families was skipped (now reopens: a set's final beside its newest out version, a solo's Keep / Delete).
- **Production build** (`vite preview`): start screen, fonts, cursor load; CSS times minified to .35s / .4s and read correctly.
- **Not checked:** native Finder drag, the Resume click after a Chrome restart, a real large folder on the new Families grid, phone widths (unsupported by design).

## Colour sets inside a family (2026-11-03)

- **Folder:** 27 files in Chrome's private storage, written in their real date order: 512px copies of 19 photos from Ryan's color folder, plus 8 calendars from graphic. Dates were therefore all the same day, in the right order.
- **Result:** dunes 1126, 1128, 1129 (B&W) then 1127, 1208; calendars kuummyu, e-2 then vwrervr, e-3, and muim, e-1 then wwwqwd, e; the people and flower sets kept date order.
- **Sort:** the dune set opened on 1208 beside 1129, its two newest.
- **Live:** after pushing, the new build was confirmed on syca.vercel.app by its files, not by scanning a folder there.
- **Not checked:** a folder saved before this change reopening with the new order; full-size originals; Apply after the reorder; the row at phone width.

## Full UX and bug audit (2026-11-04): must-fixes and the date bug fixed, the rest open

- **How:** every button and flow driven on throwaway folders in the browser pane's private storage (28-file mix with broken, empty, huge-ratio, long-name, skipped and subfolder files; a 24-version set; empty; skipped-only; deleted-while-open). The pane was hidden, so animation frames and screen fades were faked on the page. Waitlist saves were stubbed, so nothing reached Supabase.
- **Must fix (all fixed the same day, see `build-log.md`):**
  1. Sets wider than the strip break Sort: `#compare` has no column limit, so the strip widens it. At 1440 wide, 13+ versions push the right frame out (13: 786–1455, 24: 1446–2115) and it can't be scrolled to. Tried on the page: `#compare { grid-template-columns: minmax(0, 1fr) }` restores 726–1395 and the strip scrolls. Fixed: a5b8453.
  2. A real double-click on Pick rejected two versions, one never seen (pair to pair has no fade). Keep both shares the path. Fixed: 52859bf.
  3. Forget has no confirmation: one click dropped 4 choices and a 24-file scan. Fixed: 6e61530.
  4. A file dragged back out of `_to_delete`, as Done says to, returns marked reject (same name, size, date) and Apply offers to move it again. Fixed: 4aa38de.
  5. During Apply the cards and the Families toggle stay live: clearing a card said 17 files, 18 moved; leaving for Families was pulled to Done. Fixed: f9e8587.
- **Bugs:**
  - `familyDates` reads first and last, wrong since colour order: Jan–Jun shows Jan–Mar (ed51f4b). Fixed: 5a8a8a8.
  - Summary's Sort does nothing when `#view-compare` is stale-disabled (all decided, Families, Summary, clear a card).
  - Reopen a decided solo, Keep, Undo: dead screen, "1/1", "Only version", no buttons (`revisit` not restored).
  - Wheel on a solo throws "Cannot read properties of null (reading 'scrolled')".
  - A solo with no preview shows Chrome's broken-image icon in an empty square; frames say "No preview".
  - Done with 0 moved says "Every file was moved directly" and "still in place" for a file that's gone, and leaves an empty `_to_delete`.
  - A second folder mid-scan shows a false "Failed to fetch" until the new scan overwrites it.
  - Waitlist opened from loading: the scan's end pulls you to Families.
  - Waitlist field stays disabled after a success until refresh.
  - Media field: type "photos", click away, click back, Enter picks Mixed.
  - Grouping toggles drop "These are different" splits, even back at the same level (13 solos back to 12). By code, so does any rescan with a file missing.
  - WebGPU present but no adapter: scan stops on a raw `--enable-unsafe-webgpu` message, no fallback. Offline and missing-folder errors are raw too, and a refresh repeats the missing-folder one.
  - 0 bytes reads "1 kb".
  - Found while fixing: a real double-click on a Summary card clears that card and the one that moves into its place (3 to reject became 1). Only undoes choices, so left open.
- **Passed:** Pick, Keep both, These are different (key `n` too), Undo across sets and splits, Backspace, ⌘Z, strip reopening, zoom (Space, arrows loop, wheel stops at ends, Pick while zoomed), reopening sorted sets and swapping the final, full stream sets then solos to Summary with no dead ends, Apply (right files, clash renamed, skipped files and subfolders untouched), Rescan, refresh mid-scan, reopening a saved folder (305ms), two tabs on one folder, waitlist validation and failure, HTML in file names, window heights down to 560.
- **Not checked:** native picker and Finder drag, Apply on a real disk, Resume after a Chrome restart, real screen fades, large real folders.

