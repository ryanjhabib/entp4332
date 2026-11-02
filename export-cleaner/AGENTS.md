# Working on Export Cleaner

Start with `HANDOFF.md` (state, file map, how to run and test), then `INSIGHTS.md` (what to improve next), `TESTING.md` and `build-log.md`.

Read `PRIVACY.md` before work that affects models/dependencies, network requests, caching or saved progress, diagnostics, accounts/payments, desktop permissions, folder watching, or cloud features. Keep its evidence and open checks current when those behaviours change, and review it before public releases. It also records the monthly review cadence while the product is actively being developed.

## About Ryan
- Designer and photographer, not a programmer. He designs in Figma and you build. Build what he describes faithfully; offer suggestions as suggestions, not changes already made.
- When he asks "what do you think", give one clear recommendation and the reason.
- He types fast and casually; read for intent. Ask only when a value or behaviour is genuinely unclear.
- He pixel-peeps and thinks in consistent spacing scales. Use exact values he gives.

## How to work
- **Explain in plain language what changed on screen**, using the real technical terms (briefly explained the first time), and **give the actual values**: before and after, with tables. He can't glance at the code.
- **Check visual and layout work in Chrome by measuring it**, not by reasoning about the code. Check desktop and a smaller window when layout changes.
- Keep solutions simple: no dead code, no workaround stacked on workaround. Fix causes. Do what's asked; mention nearby issues without changing them.
- Keep styling minimal and in the CSS custom properties; Ryan does the visual design.

## Git
- One commit per change he asks for, so each can be undone on its own; only after `npm run build` passes and the change is checked in Chrome.
- First line: what changed, as seen on the site. Body: why, with the measured numbers and anything tried and ruled out.
- **Notes (`build-log.md`, `TESTING.md`, `INSIGHTS.md`, these files) go in separate commits from site changes.**
- Log every break in `build-log.md`: exact error or symptom, cause, fix, dead ends. It's graded.
- Record every new kind of test content in `TESTING.md`.
- **Never push unless Ryan says so** (pushing deploys to Vercel). Mention anything that costs money or uses up a limit, with numbers.

## Project facts
- Dev server: `npm run dev` on port **3400** (pinned). Chrome only.
- Files never leave the computer. Anything that would send images elsewhere (a paid AI judge, for example) must be opt-in.
