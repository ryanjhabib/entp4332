# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`entp4332` is a class project. No code has been written yet — this file exists to capture context ahead of time so future work starts aligned with how the user wants to collaborate.

## About the user

- Designer, not a programmer. Not technical, and does not want to hand-write or debug code directly.
- Has some grounding in dev terminology from prior projects: two portfolio sites, a landing page for a school org, and a headless Shopify storefront.
- Works primarily in Figma. The workflow is: design in Figma, then use AI to translate that design into front-end code.
- Design language is stripped back and minimalist — prefers simpler solutions over clever or elaborate ones.
- Very specific about front-end fidelity to the design — pay close attention to:
  - Layout and structure
  - Fonts / typography
  - Visual hierarchy
  - Spacing (margins, padding, gaps)
  - Component boundaries and reuse
- Thinks in consistent numeric scales for spacing/sizing (e.g. a scale of 4, 6, 8, etc.) rather than arbitrary values — use whatever scale is specified for the given project and apply it consistently.

## How to work with this

- When implementing UI from a Figma design or screenshot, prioritize matching spacing, type scale, and hierarchy exactly rather than approximating "close enough."
- Favor the simplest solution that achieves the design — avoid over-engineering or adding abstraction the minimalist design doesn't call for.
- Prefer explaining changes and tradeoffs in plain language over showing raw code, since the user isn't reading code to verify it — they're verifying the rendered result.
- Since there's no established stack yet, confirm framework/tooling choices before scaffolding rather than assuming.
