# Paper Planner Layouts — Design

**Date:** 2026-07-01
**Status:** Approved (design), pending implementation plan

## Purpose

Build a set of print-ready paper-planner page layouts — Daily, Weekly, and Monthly —
that the user can print at home to a PDF from a browser and use as physical planner pages.

## Output & Constraints

- **Deliverable:** Print-ready pages built with HTML + CSS, printed to PDF via a browser.
- **Paper size:** A5 (148 × 210 mm / 5.8 × 8.3 in), portrait.
- **Style:** Warm & decorative — cream/off-white background (`#fbf7f0`), muted gold accents
  (`#c9a66b` / `#a5794a`), a serif typeface (Georgia-family), small floral/ornament glyphs
  (❦ ✿) in headers, uppercase letter-spaced section labels, dotted/solid guide lines.
- **Print correctness:** Each page must fit on one A5 sheet with sensible print margins,
  use `@page { size: A5; }`, avoid unwanted page breaks, and print backgrounds/borders
  cleanly (color-adjust exact). Colors chosen to also read fine in grayscale.

## Shared Visual System

A common stylesheet defines the palette, fonts, header treatment, section-label style,
box/border style, and guide-line fills. All three layouts import it so they stay consistent.

- **Header:** title left, ornament right, 2px gold bottom border.
- **Section label (`h4`):** ~10px uppercase, letter-spaced, gold (`#a5794a`).
- **Box:** white fill, thin warm border (`#e0d5c3`), rounded 4px.
- **Guide lines:** dotted warm rule for writing rows; solid faint rule inside priority boxes.

## Layouts

### 1. Daily (single A5 page)

Two-column body with a full-width notes box at the bottom.

- **Header:** date (e.g. "❦ Tuesday, July 1") + ornament.
- **Left column:**
  - **Top 5 Priorities** — numbered box, 5 rows.
  - **To-Do** — checkbox box, ~5 rows.
- **Right column:** three stacked time blocks — **Morning**, **Afternoon**, **Night**,
  each a box of ~3 guide lines.
- **Bottom (full width):** **Notes** box spanning both columns, lined.

### 2. Weekly (two-page A5 spread)

Prints on two A5 sheets meant to face each other.

- **Left page:**
  - Header ("❦ Week of July 1").
  - **Top 3 This Week** — highlighted box (warmer fill), 3 numbered rows, at the top.
  - Day blocks: **Monday, Tuesday, Wednesday, Thursday** — each a titled box for the day.
- **Right page:**
  - Header ("the week ahead" + ornament).
  - Day blocks: **Friday, Saturday, Sunday**.
  - **Notes** — large lined box filling the remaining space.

### 3. Monthly (single A5 page)

- **Header:** month + year (e.g. "❦ July 2026") + ornament.
- **Calendar grid:** 7 columns (Sunday-start), day-of-week header row, ~5–6 week rows;
  each cell has a small day number in the corner and room to write.
- **Bottom:** two side-by-side boxes — **Monthly Goals** (lined) and **Notes** (lined).

*Note: the monthly calendar is a static, fillable grid (blank layout with day numbers to be
written in), not auto-generated per real month, unless the plan decides otherwise.*

## File Structure (proposed)

- `styles/planner.css` — shared palette, fonts, header/label/box/line styles, `@page` rules.
- `daily.html` — daily layout.
- `weekly.html` — weekly two-page spread (two A5 page sections).
- `monthly.html` — monthly layout.
- Optional `index.html` linking the three for easy preview/printing.

## Out of Scope (YAGNI)

- No auto-populated real-date calendars, weather, habit trackers, or mood/water widgets
  (not requested).
- No build tooling, frameworks, or JS interactivity — plain static HTML/CSS.
- No digital/tablet fillable version (A5 print-to-PDF only was chosen).

## Success Criteria

- Opening each HTML file and printing to PDF at A5 yields a clean, single-sheet page
  (weekly = two sheets) matching the mockups.
- Visual style is consistent across all three via the shared stylesheet.
- Layouts hold together with no clipped sections or stray page breaks.
