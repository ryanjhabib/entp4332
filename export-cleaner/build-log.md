# Build log: Export Cleaner

Every break gets an entry: the exact error or symptom, the cause, the fix, and any dead ends on the way.

## Setup decisions (2026-10-27)

- **Vite + vanilla JS, not React.** The app has a handful of screens and one small `state` object. The swipe is pointer events plus a CSS `transform` either way, and React wouldn't make that simpler. It would add a build concept (components, re-rendering) without removing any code.
- **Chrome only.** The File System Access API (`showDirectoryPicker`) is the only way a web page can open a real folder and move files in it. Safari, Firefox, Brave and mobile browsers don't expose it, so they get a message instead of the app.
- **Read-only at first.** The folder is opened with `mode: 'read'`. Permission to move files is requested only at the Apply step, so the first prompt the user sees is the gentler "View files" one.
- **Dev port 3400**, pinned in `package.json`, so it never collides with Ryan's other projects (3000–3300, 3007).

## Breaks

_None yet._
