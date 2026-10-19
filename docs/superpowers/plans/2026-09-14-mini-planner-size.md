# Mini Planner Size Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Mini (81×120 mm) Pocket/A7 planner size with a 19 mm left binding margin and six CSS-drawn punch-guide dots spaced 19 mm apart.

**Architecture:** Three files change — `js/planner.js` gets the new size entry and a body-class toggle, `index.html` gets two new `<option>` elements, and `styles/planner.css` gets two scoped rules (`body.size-mini .page`) for the margin and the punch guides. No new files are created.

**Tech Stack:** Vanilla HTML/CSS/JS. No build step — open `index.html` directly in a browser to test.

---

### Task 1: Add Mini to SIZES and toggle the body class

**Files:**
- Modify: `js/planner.js:933-940` (SIZES map)
- Modify: `js/planner.js:980` (validateSizes function)

- [ ] **Step 1: Add Mini to the SIZES map**

In `js/planner.js`, find the `SIZES` object (line 933). Add `Mini` as the first entry:

```js
var SIZES = {
  Mini:   { w: 81,   h: 120 },
  A6:     { w: 105,   h: 148 },
  A5:     { w: 148,   h: 210 },
  A4:     { w: 210,   h: 297 },
  A3:     { w: 297,   h: 420 },
  Letter: { w: 215.9, h: 279.4 },
  Legal:  { w: 215.9, h: 355.6 }
};
```

- [ ] **Step 2: Toggle `size-mini` body class in validateSizes**

In `js/planner.js`, find `function validateSizes` (line 980). Add one line immediately after `var out = SIZES[outSel.value];`:

```js
function validateSizes(outSel, paperSel, printBtn, note, tile) {
  var out = SIZES[outSel.value];
  document.body.classList.toggle('size-mini', outSel.value === 'Mini');
  // ... rest of function unchanged
```

- [ ] **Step 3: Commit**

```bash
git add js/planner.js
git commit -m "feat: add Mini (81x120mm) to SIZES and toggle size-mini body class"
```

---

### Task 2: Add Mini to both dropdowns

**Files:**
- Modify: `index.html:47-62` (outsize and paper selects)

- [ ] **Step 1: Add Mini to the Planner size select**

In `index.html`, find the `<select id="outsize">` block (around line 47). Add Mini as the first option:

```html
<select id="outsize">
  <option value="Mini">Mini (81×120 mm)</option>
  <option value="A6">A6</option>
  <option value="A5" selected>A5</option>
  <option value="A4">A4</option>
  <option value="Letter">Letter</option>
</select>
```

- [ ] **Step 2: Add Mini to the Paper size select**

In `index.html`, find the `<select id="paper">` block (around line 55). Add Mini as the first option:

```html
<select id="paper">
  <option value="Mini">Mini (81×120 mm)</option>
  <option value="A5">A5</option>
  <option value="A4">A4</option>
  <option value="A3">A3</option>
  <option value="Letter" selected>Letter</option>
  <option value="Legal">Legal</option>
</select>
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add Mini option to planner size and paper size dropdowns"
```

---

### Task 3: Add CSS — position, binding margin, and punch guides

**Files:**
- Modify: `styles/planner.css:225` (`.page` rule — add `position: relative`)
- Modify: `styles/planner.css` (end of file — add two `body.size-mini` rules)

- [ ] **Step 1: Add `position: relative` to `.page`**

The `::before` pseudo-element uses `position: absolute` and needs a positioned ancestor.
Find the `.page` rule (line 225) and add `position: relative`:

```css
.page {
  width: 148mm;
  height: 210mm;
  background: var(--bg);
  padding: 12mm 11mm;
  margin: 8mm auto;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}
```

- [ ] **Step 2: Add binding margin rule**

At the end of `styles/planner.css`, append:

```css
/* ============ Mini (Pocket/A7, 81×120 mm) ============ */

/* Left binding margin — keeps content clear of the 6-ring punch zone */
body.size-mini .page {
  padding-left: 19mm;
}
```

- [ ] **Step 3: Add punch-guide dots rule**

Immediately after the rule from Step 2, append:

```css
/* Six equally-spaced punch-guide dots in the binding margin.
   Dot centers at 12.5 / 31.5 / 50.5 / 69.5 / 88.5 / 107.5 mm from the top.
   background-position y=3mm puts the first tile's center at 3+9.5=12.5mm.
   The 7th repetition would land at 126.5mm, outside the 120mm page height. */
body.size-mini .page::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  width: 19mm;
  height: 100%;
  background-image: radial-gradient(circle, rgba(0,0,0,0.18) 1.2mm, transparent 1.3mm);
  background-size: 19mm 19mm;
  background-position: 0 3mm;
  background-repeat: repeat-y;
  pointer-events: none;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
```

- [ ] **Step 4: Commit**

```bash
git add styles/planner.css
git commit -m "feat: add Mini binding margin and punch-guide dots via CSS"
```

---

### Task 4: Verify

**Files:** none — browser verification only

- [ ] **Step 1: Open the app**

Open `index.html` in a browser (File → Open, or via a local server). No build step required.

- [ ] **Step 2: Check dropdown**

In "Planner size", select "Mini (81×120 mm)". Confirm:
- Pages render visibly narrower and shorter than A5.
- "Paper size" dropdown still works (Letter and A4 should be enabled; A5, A4, A3 all fit).

- [ ] **Step 3: Check binding margin**

With Mini selected, inspect a generated page. Content should start ~19 mm from the left edge, leaving a clear strip for the binder rings.

- [ ] **Step 4: Check punch guides**

Six small grey dots should appear in the left 19 mm strip. Visually confirm spacing looks even. Dot positions (from top): 12.5, 31.5, 50.5, 69.5, 88.5, 107.5 mm.

- [ ] **Step 5: Check tiling**

Tick "Tile 2-up". Select "Letter" as paper. Confirm the status bar reads something like "Two Mini pages per Letter landscape sheet — print, then cut down the center." and two pages render side-by-side on a landscape sheet.

- [ ] **Step 6: Check existing sizes are unaffected**

Switch back to A5. Confirm pages render at 148×210 mm with no left-margin override and no punch dots.

- [ ] **Step 7: Commit verification note**

```bash
git commit --allow-empty -m "chore: verified Mini size renders correctly in browser"
```
