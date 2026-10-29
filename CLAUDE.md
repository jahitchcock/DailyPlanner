# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A browser-based "Paper Planner Generator": a no-build, no-dependency static site that generates printable planner pages (monthly/weekly/daily plus journal and Skill Tree insert pages) for a date range, sized for ring-binder inserts (Mini 81×120 mm default, A6/A5/A4/Letter). Output is printed or saved to PDF from the browser. There is no package.json, test suite, linter, or build step.

## Running

```
node server.js [port]     # static server, default port 365 -> http://localhost:365/
```

`start-planner.vbs` launches the same server hidden (hardcoded paths to this directory and `C:\nvm4w\nodejs\node.exe`). Port 365 may need elevation; use e.g. `node server.js 8365`. Verify UI changes visually in a browser (screenshots in the repo root are earlier previews, untracked).

## Architecture

- `index.html` — the control panel (checkboxes, insert counts, theme/size/tile/duplex selects) **and every page layout as an inline `<template id="tpl-<type>">`**. The files in `templates/` (daily/weekly/monthly) are standalone previews that nothing loads; edit the `<template>` in `index.html` for real changes.
- `js/planner.js` — one IIFE. `clone('<type>')` clones a `tpl-<type>` template; `build*Page` fills it in; `render*` functions loop a date range; `generate(types, start, end, tile, duplex, inserts)` assembles everything into `#pages`.
  - Page types are registered in the `ORDER` array (date-driven layouts, matched to `chk-<type>` checkboxes) and `INSERT_KEYS` (count-driven inserts, matched to `ins-<key>` inputs). Adding a page type means: a `tpl-` template, a control in the panel, a builder/renderer, and registration in these lists (see `docs/superpowers/plans/2026-09-14-new-page-types.md`).
  - Layout modes: plain, duplex (front/back order), 2-up and 4-up tiling (`tilePages`, `layoutFourUpDuplex`, `layoutCutStack`). Duplex 4-up relies on slot parity (verso pages at odd indices, with `fillerPage()`/`blankPage()` padding) so pages land correctly after cutting; the "facing layout" pairs thanks (verso) before daily (recto).
  - Sizing: `SIZES` map, `applySizes`, `validateSizes` (enables/disables Print and toggles `body.size-mini`, which the CSS uses for the 19 mm binding margin and punch-guide dots).
  - Theming: `applyTheme` plus a large custom-theme panel (`buildCustomPanel`, `applyCustom`) that sets the CSS variables.
- `styles/planner.css` — all styles. Themes are `body.theme-*` classes overriding CSS custom properties (`--box-bg`, `--line`, ...); `@page` and `@media print` control print output. Print dialog settings: margins None, background graphics on.
- `docs/superpowers/{specs,plans}/` — design specs and plans per feature (mini size, new page types, skill tree journal); consult the relevant spec before changing those features.
