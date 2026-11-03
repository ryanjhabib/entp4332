# CLAUDE.md: Syca (Export Cleaner)

Instructions for Claude Code working on this app. What the product is and why: `prd.md`.

## Start here

Another agent (Codex) also works on this project, so the code may have changed since your last session. Before assuming anything, read:

1. `git log` (recent commits)
2. `HANDOFF.md`: state, file map, how to run and test
3. `INSIGHTS.md`: what the grouping gets right and wrong, and what to fix next
4. `TESTING.md`: every folder tested so far
5. `build-log.md`: every decision and break, with numbers
6. `PRIVACY.md`, before touching models, dependencies, network requests, saved data, accounts, payments or anything that could send data off the computer

## What it is

A Chrome web app for designers and photographers. It opens a folder, groups every version of the same piece of work into families, lets you compare versions and pick the final, and moves rejects into `_to_delete`. **Finding the final comes first; freeing space is secondary.** The web app is the free demo; the long-term product is a paid Mac app.

## Stack

- Plain JavaScript, HTML and CSS, built with Vite. No framework.
- AI runs in the browser through Transformers.js: DINOv2 small (image similarity), MiniLM (media-type matching). Tesseract.js reads text in images; pdf.js reads PDFs; exifr reads photo metadata.
- File System Access API to open and move files, so **desktop Chrome only**.
- Saved progress in IndexedDB (`src/store.js`).
- Every colour, size and space is a CSS custom property in `:root` in `src/style.css`.

## Run it

- `npm install`, then `npm run dev` → http://localhost:3400 (port pinned).
- `npm run build` must pass before any commit.
- Any file edit reloads the dev page. **Don't edit while Ryan has a long scan running.**

## Rules

- **Files never leave the computer.** Nothing read from a user's files (images, text, metadata, file names, the model's numbers) is uploaded or sent to analytics. Anything that would send data elsewhere must be a separate opt-in and reviewed against `PRIVACY.md` first.
- **Nothing is permanently deleted.** Apply only moves rejected files into `_to_delete`. Undecided files are never touched. Write permission is asked for only on the Apply click.
- **Secrets stay out of code.** API keys go in `.env.local` (git-ignored). Only keys meant to be public, like a Supabase anon key protected by Row Level Security, may appear in the browser.
- **One user never sees another's data.** Any server table (e.g. the Supabase waitlist) lets visitors add rows but never read them.

## Working with Ryan

- Ryan is a designer and photographer, not a programmer. He designs in Figma; you build it faithfully. Offer improvements as suggestions, not changes already made.
- He pixel-peeps and thinks in consistent spacing scales. Use exact values he gives, and check visual work by measuring it in Chrome, not by reading the code.
- Explain changes in plain language, in terms of what he'll see on screen, using the real technical terms (explained briefly the first time). Give the actual values, before and after.
- Keep solutions simple: no dead code, no workaround on top of a workaround. Fix causes. Do what's asked; mention nearby issues without changing them.
- Placeholder UI or copy is fine when needed, but always say it's a placeholder.

## Git

- One commit per change he asks for, after the build passes and the change is checked in Chrome.
- First line: what changed, as seen on the site. Body: why, with measured numbers and anything ruled out.
- Notes (`build-log.md`, `TESTING.md`, `INSIGHTS.md`, `HANDOFF.md`, this file) go in separate commits from site changes.
- Log every break in `build-log.md`: the symptom, cause, fix and dead ends.
- **Never push unless Ryan says so.** Pushing deploys to Vercel. Mention anything that costs money or uses up a limit, with the numbers.
