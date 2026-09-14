# Mini Planner Size — Design

**Date:** 2026-09-14
**Status:** Approved

## Purpose

Add a "Mini" paper size to the planner generator that matches the standard Pocket/A7 ring-organizer insert
(81 × 120 mm). The size is sold interchangeably under the Pocket and A7 designations. Its defining feature
is 6 rings spaced equally at 19 mm apart. The generated pages must reserve a left margin for the binding
and print small punch-guide dots so the user knows exactly where to hole-punch.

## Dimensions & Hole Geometry

| Property | Value |
|---|---|
| Page width | 81 mm |
| Page height | 120 mm |
| Left binding margin | 19 mm |
| Ring count | 6 |
| Ring spacing (center-to-center) | 19 mm |
| First ring from top | 12.5 mm — (120 − 5 × 19) / 2 |
| Ring positions from top | 12.5 / 31.5 / 50.5 / 69.5 / 88.5 / 107.5 mm |
| Live writing area | 62 × 120 mm (after 19 mm left margin) |

## Changes

### `js/planner.js`

1. Add `Mini` to the `SIZES` map:
   ```js
   Mini: { w: 81, h: 120 }
   ```
2. In `validateSizes`, toggle a `size-mini` class on `document.body` when `outSel.value === 'Mini'`
   and remove it otherwise. This is the only hook the CSS needs.

### `index.html`

1. Add to the **Planner size** (`#outsize`) select:
   ```html
   <option value="Mini">Mini (81×120 mm)</option>
   ```
2. Add to the **Paper size** (`#paper`) select:
   ```html
   <option value="Mini">Mini (81×120 mm)</option>
   ```
   The existing `fits` / `twoUp` logic handles enabling/disabling paper options automatically once
   the size is in `SIZES`.

### `styles/planner.css`

Two rules, both scoped to `body.size-mini`:

**1. Binding margin**
```css
body.size-mini .page {
  padding-left: 19mm;
}
```

**2. Punch-guide dots**
```css
body.size-mini .page::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  width: 19mm;
  height: 100%;
  background-image: radial-gradient(circle, rgba(0,0,0,0.18) 1.2mm, transparent 1.3mm);
  background-size: 19mm 19mm;
  background-position: left top 12.5mm;
  background-repeat: repeat-y;
  pointer-events: none;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
```

The gradient places a ~2.4 mm dot centered in the 19 mm margin strip at 12.5 mm from the top, then
repeats every 19 mm. Exactly 6 dots fall within the 120 mm page height; the 7th would land at
126.5 mm which is outside the page.

## Fit / Tiling Behaviour

No special casing needed. The existing `fits` and `twoUp` functions handle the new size automatically:

- Single-page printing: Mini fits on A5, A4, Letter, Legal (all larger than 81 × 120 mm).
- 2-up tiling: 2 × 81 mm = 162 mm ≤ 215.9 mm (Letter width), so Letter and A4 landscape tiling both work.

## Out of Scope

- No re-tuning of font sizes or line counts for the smaller page area (can be done iteratively).
- No right-side margin for a notes strip.
- No print hint update in the static `.hint` div in `index.html` (that text is A5-specific but is
  cosmetic and does not affect functionality).

## Success Criteria

- "Mini (81×120 mm)" appears in both the Planner size and Paper size dropdowns.
- Selecting Mini as the planner size adds 19 mm of left padding to every generated page.
- Six evenly-spaced punch-guide dots appear in the left margin on screen and in the printed PDF.
- Tiling with Letter or A4 paper works without errors.
- All existing sizes (A6, A5, A4, Letter) continue to work unchanged.
