# PRD: Syca (Export Cleaner)

**PRODUCT:** Syca, a Chrome web app that finds every version of the same piece of work in a folder and helps you pick the final. Working name in the repo: Export Cleaner.

**USER:** Designers and photographers whose export folders (Lightroom exports, Downloads, portfolio folders) fill up with versions of the same piece: re-edits months apart, crops, re-layouts, PDF and PNG twins, colour and B&W copies.

**PROBLEM:** The versions of one piece end up scattered across a folder under names like `Untitled-288`, `613 FIXED` and `final_v3 (2)`. Finding the final means opening files one by one and comparing from memory. Clearing out the rest is risky, because nobody is sure which copy is the real one. Freeing disk space matters, but it comes second: finding the final is the weekly need, cleanup is occasional.

**CORE USER STORY:** As a designer, I can open a folder and see every version of each piece grouped together, compare them side by side, pick the final, and set the rest aside, so that I always know which file is the one and can clear the rest without fear.

**VALUE HYPOTHESIS:** If versions are grouped by what they look like (and what they say), not by file name or date, people will trust the grouping enough to choose finals and move the rest out of the folder.

## The steps the user moves through

1. **Open a folder.** Drag it onto the start screen or choose it. The folder opens read-only, and the scan starts straight away.
2. **Describe the media type.** One line, e.g. "my Lightroom exports" or "brand deck". Syca picks the closest of eight types (Mixed, Photographs, Mockups, Graphic & Type, Documents, Screenshots, Product Images, User Interface), and the type sets how strictly files are grouped (Loose 75%, Balanced 80%, Strict 88% similarity).
3. **Wait for the scan.** One loading screen with a percentage, time remaining and rotating facts.
4. **Families.** Every set of versions, then the solos (files with no other version). Filter by All / Sets / Solos.
5. **Compare.** Inside one family at a time: two versions side by side with their details (export date, shot date, size). Pick the better one and the next version comes in, until one is left. Click a frame to see it full size; Space opens a flick preview through every version, oldest to newest.
6. **Solos.** Keep or Delete each one.
7. **Summary.** Everything kept and everything set aside. Click a file to undo its choice.
8. **Apply.** Rejected files move into a `_to_delete` folder inside the same folder. Nothing is permanently deleted, and undecided files are never touched.

## Features (in the order they were built)

1. **M1. Walking skeleton:** open a folder, see its design files, group them, choose, move rejects.
   Done means: a folder goes from open to `_to_delete` end to end. ✅ Built.
2. **M2. Grouping that matches by content:** an on-device image model, text reading (PDF text and OCR), photo metadata, grouping levels.
   Done means: re-edits months apart, crops, colour/B&W twins and PDF/PNG twins of one piece land in one family across real test folders (see `TESTING.md`). ✅ Built, with known weak spots below.
3. **M3. Compare and decide:** side-by-side compare, full-size zoom, flick preview, solos, summary with undo.
   Done means: every family and solo in a folder can be decided with the keyboard and mouse, and every choice can be undone before Apply. ✅ Built.
4. **M4. Safe Apply:** move rejects with the browser's file move, falling back to copy → check size → remove original.
   Done means: rejected files are in `_to_delete` with nothing lost. ✅ Built and tested in Chrome's private test storage. ⚠️ Still to confirm on a real folder on disk, using a duplicate folder.
5. **M5. Saved progress (database extension):** each file's scan result and every choice saved in the browser's own database (IndexedDB), so a refresh or a second visit picks up where you left off. Only new or changed files are scanned again.
   Done means: refreshing mid-decision restores the same families and choices; adding one file rescans only that file. ✅ Built 2026-11-03.
6. **M6. Mac app waitlist (Supabase extension):** an email signup for the future Mac app, stored in Supabase. Visitors can add their email; only Ryan can read the list.
   Done means: a signup appears in the Supabase table, and the public key cannot read the list back. ⏳ Planned.

## Extensions

| Extension | What it does in Syca | Why this way |
|---|---|---|
| **AI layer** | Three AI models run inside the browser: DINOv2 small (an image model that judges whether two files are the same piece), Tesseract (reads text inside images) and MiniLM (matches the typed media-type description to a type). | **Privacy:** folders hold client work and personal photos, and nothing is uploaded. **Cost:** no per-request fees; a 1,286-photo folder costs nothing to scan. **Right tool:** "is this the same picture?" is an image-matching job, not a chatbot job. **Safety:** the image model doesn't follow instructions, so hidden text in a file can't redirect it (prompt injection). |
| **Database** | Saved progress in IndexedDB (M5); Mac app waitlist in Supabase (M6, planned). | Scan results describe the user's private files, so they stay on the user's computer. The waitlist holds only an email address, so it can live on a server. |

## Evidence that shaped the product

- **"Find the final" before "free up space" (2026-11-01).** Testing on my own folders, the useful moment was seeing every version of one photo together, not the gigabytes saved. Finding the final is a weekly need; cleanup is occasional.
- **Compare replaced swiping (2026-11-01).** The first version swiped through files one by one to keep or delete. That made it a cleanup app, so it became a side-by-side compare for choosing the final.
- **Saved progress (M5).** The 3-year Lightroom folder (1,286 photos) took 41 minutes to scan, and a refresh threw all of it away.
- **Grouping levels and media types.** Product flat-lays showed that no single strictness is right for every folder: Strict separates two different jackets but also splits the 3 shots of one bag. The media type now sets the level.
- **Short-text phrase rule.** Graphic design work is often a few distinctive words. Two zooms of the same "let me taste eternity" print stayed apart until matching words counted as evidence.
- **Compare stays inside one family; arrow keys no longer pick.** Arrow keys rejected 7 files by accident during a real session.
- [Placeholder for Ryan: findings from the Discovery Report and the synthetic interviews that shaped these choices.]

## Testing

21 folders so far, logged in `TESTING.md`, from generated test sets to Ryan's real work: a 362-photo stock folder, B&W and colour street photography, product flat-lays, graphic design prints, website screenshots, and a 3-year Lightroom folder (1,286 photos, 41 minutes, about 1.8 GB of browser memory).

## Known limits

- **Heavy crops and zooms** of the same piece can be missed (the model compares whole frames).
- **Same pose, different subject:** two different jackets on the same backdrop, or two cyclists shot 2 seconds apart, can group. Strict or a manual split fixes it.
- **Same template, different content:** website screenshots with a small piece inside the same page frame merge.
- **Near-blank pages** look alike to the model.
- **Speed:** about 1.9 seconds per photo after previews; very large folders take a long time on first scan (saved progress makes later visits fast).
- **Desktop Chrome only.** Chrome won't open Downloads, Desktop or Documents themselves, only folders inside them.

## Out of scope

Recorded with the date they were set aside.

- Subfolders, video, RAW files: only the top level of a folder, and image and PDF formats (2026-10-27, first build)
- Permanent deletion: Apply only moves files to `_to_delete` (2026-10-27)
- Safari, Firefox and mobile: they can't open a real folder from a web page (2026-10-27)
- Accounts and cloud sync of scan results (2026-11-01, privacy)
- Sending images to a cloud AI: any future cloud judge must be opt-in (2026-11-01)
- The Mac app: background watching of export folders, opening Downloads directly (2026-11-01, next product)

## Data we store

- **On the user's computer only (IndexedDB, in this browser):** per file: name, size, date, a thumbnail, the image model's numbers, words read from the file, photo metadata, main colour; per folder: its families and the user's choices. Dropped after 30 days unused, or at once with "Forget this folder".
- **On a server (Supabase, planned):** an email address, only if someone joins the Mac app waitlist.
- **Never:** the files themselves, or anything read from them, leave the computer. No analytics.

## Next

1. Fix crops and zooms with multi-scale matching (compare zoomed-in crops as well as the whole frame).
2. Compare a centre crop as well as the whole frame, so screenshots of different pieces in the same page frame stop merging.
3. The Mac app (Syca as a desktop app) that watches export folders in the background.
