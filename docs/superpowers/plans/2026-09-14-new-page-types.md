# New Page Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 11 new planner page types — 5 date-driven (checkboxes) and 6 count-based inserts (spinners) — to the generator, working at all planner sizes.

**Architecture:** Tasks 1–3 lay the JS/HTML infrastructure (new keys, updated `generate()`, new control panel rows, updated `initGenerator`). Tasks 4–8 each add one date-driven page end-to-end (template + builder + renderer + CSS). Tasks 9–14 each add one insert page (template + CSS only — the generic `renderInserts` handles JS). Task 15 verifies everything.

**Tech Stack:** Vanilla HTML/CSS/JS. No build step — open `index.html` in a browser to test.

---

### Task 1: JS infrastructure

**Files:**
- Modify: `js/planner.js` — INSERT_KEYS, UNIT_NAMES, updated RENDERERS/ORDER, stubs, updated `generate()`, `renderInserts()`, updated `buildDuplexOrder()`

- [ ] **Step 1: Add INSERT_KEYS and UNIT_NAMES near the RENDERERS map**

Find `var RENDERERS = {` (line ~128) and insert above it:

```js
var INSERT_KEYS = ['brain-dump', 'collections', 'sketch', 'expense-log', 'future-log', 'project'];

var UNIT_NAMES = {
  monthly: 'month spreads', weekly: 'week spreads', daily: 'day pages',
  thanks: 'thankfulness pages', 'habit-tracker': 'habit trackers',
  'one-line': 'one-line pages', 'mood-tracker': 'mood trackers',
  'weekly-review': 'weekly reviews'
};
```

- [ ] **Step 2: Add stub builder and renderer functions before RENDERERS**

Insert immediately after the UNIT_NAMES block:

```js
function buildThanksPage(d)        { var e = document.createElement('div'); e.className = 'page'; return e; }
function buildHabitTrackerPage(m)  { var e = document.createElement('div'); e.className = 'page'; return e; }
function buildOneLinePage(m)       { var e = document.createElement('div'); e.className = 'page'; return e; }
function buildMoodTrackerPage(m)   { var e = document.createElement('div'); e.className = 'page'; return e; }
function buildWeeklyReviewPage(m)  { var e = document.createElement('div'); e.className = 'page'; return e; }
function renderThanks(start, end, mount)       { return 0; }
function renderHabitTracker(start, end, mount) { return 0; }
function renderOneLine(start, end, mount)      { return 0; }
function renderMoodTracker(start, end, mount)  { return 0; }
function renderWeeklyReview(start, end, mount) { return 0; }
```

- [ ] **Step 3: Extend RENDERERS and ORDER**

Replace:
```js
var RENDERERS = { monthly: renderMonthly, weekly: renderWeekly, daily: renderDaily };
var ORDER = ['monthly', 'weekly', 'daily'];
```
With:
```js
var RENDERERS = {
  monthly: renderMonthly, weekly: renderWeekly, daily: renderDaily,
  thanks: renderThanks, 'habit-tracker': renderHabitTracker,
  'one-line': renderOneLine, 'mood-tracker': renderMoodTracker,
  'weekly-review': renderWeeklyReview
};
var ORDER = ['monthly', 'weekly', 'daily', 'thanks', 'habit-tracker', 'one-line', 'mood-tracker', 'weekly-review'];
```

- [ ] **Step 4: Add renderInserts()**

Insert after the `renderMonthly` function:

```js
function renderInserts(inserts, mount) {
  if (!inserts) return;
  INSERT_KEYS.forEach(function (key) {
    var n = inserts[key] || 0;
    for (var i = 0; i < n; i++) {
      var f = clone(key);
      mount.appendChild(f.querySelector('.page'));
    }
  });
}
```

- [ ] **Step 5: Replace generate() with the updated version**

Find `function generate(` and replace the entire function with:

```js
function generate(types, start, end, tile, duplex, inserts) {
  var mount = document.getElementById('pages');
  mount.innerHTML = '';
  var help = document.getElementById('assembly');
  if (help) help.hidden = !(duplex && tile);

  var hasInserts = inserts && INSERT_KEYS.some(function (k) { return (inserts[k] || 0) > 0; });

  if (types.length > 0 && (!start || !end || start > end)) {
    setStatus('Pick a start date on or before the end date.'); return;
  }
  if (!types.length && !hasInserts) {
    setStatus('Select at least one layout or add some inserts.'); return;
  }

  if (duplex) {
    var seq = buildDuplexOrder(types, start, end);
    if (hasInserts) {
      INSERT_KEYS.forEach(function (key) {
        var n = inserts[key] || 0;
        for (var i = 0; i < n; i++) { var ff = clone(key); seq.push(ff.querySelector('.page')); }
      });
      while (seq.length % 2 !== 0) seq.push(blankPage());
    }
    var real = seq.filter(function (p) { return !p.classList.contains('blank-page'); }).length;
    if (tile) {
      layoutCutStack(mount, seq);
      setStatus('2-sided, 2-up (cut & stack): ' + real + ' planner pages across ' +
        mount.querySelectorAll('.sheet').length + ' landscape sheets. Print double-sided (flip on long edge).');
    } else {
      seq.forEach(function (p) { mount.appendChild(p); });
      setStatus('2-sided order: ' + real + ' planner pages (+ blanks) = ' + seq.length +
        ' pages. Print double-sided (flip on long edge).');
    }
    return;
  }

  var parts = [];
  ORDER.forEach(function (type) {
    if (types.indexOf(type) === -1) return;
    var n = RENDERERS[type](start, end, mount);
    parts.push(n + ' ' + (UNIT_NAMES[type] || type));
  });

  renderInserts(inserts, mount);
  if (hasInserts) {
    INSERT_KEYS.forEach(function (k) {
      var n = inserts[k] || 0;
      if (n) parts.push(n + ' ' + k.replace(/-/g, ' ') + (n > 1 ? 's' : ''));
    });
  }

  var sheetNote = '';
  if (tile) {
    var pageCount = mount.querySelectorAll('.page').length;
    tilePages(mount);
    sheetNote = ' → ' + Math.ceil(pageCount / 2) + ' landscape sheets (cut in half)';
  }
  setStatus('Generated ' + parts.join(', ') + sheetNote + '. Use Print to save as PDF.');
}
```

- [ ] **Step 6: Replace buildDuplexOrder() with the updated version**

Find `function buildDuplexOrder(` and replace the entire function with:

```js
function buildDuplexOrder(types, start, end) {
  var items = [];
  if (types.indexOf('monthly') !== -1) {
    eachMonth(start, end, function (cur) { items.push({ spread: buildMonthlySpread(cur) }); });
  }
  eachWeek(start, end, function (m) {
    if (types.indexOf('weekly') !== -1) items.push({ spread: buildWeeklySpread(m) });
    if (types.indexOf('daily') !== -1) {
      eachDayInWeek(m, start, end, function (d) { items.push({ single: buildDailyPage(d) }); });
    }
  });
  if (types.indexOf('thanks') !== -1) {
    for (var dd = new Date(start); dd <= end; dd = addDays(dd, 1)) items.push({ single: buildThanksPage(dd) });
  }
  if (types.indexOf('habit-tracker') !== -1) {
    eachMonth(start, end, function (cur) { items.push({ single: buildHabitTrackerPage(cur) }); });
  }
  if (types.indexOf('one-line') !== -1) {
    eachMonth(start, end, function (cur) { items.push({ single: buildOneLinePage(cur) }); });
  }
  if (types.indexOf('mood-tracker') !== -1) {
    eachMonth(start, end, function (cur) { items.push({ single: buildMoodTrackerPage(cur) }); });
  }
  if (types.indexOf('weekly-review') !== -1) {
    eachWeek(start, end, function (m) { items.push({ single: buildWeeklyReviewPage(m) }); });
  }
  var pages = [blankPage()];
  items.forEach(function (it) {
    if (it.spread) {
      if (pages.length % 2 === 0) pages.push(blankPage());
      pages.push(it.spread[0], it.spread[1]);
    } else {
      pages.push(it.single);
    }
  });
  return pages;
}
```

- [ ] **Step 7: Commit**

```bash
git add js/planner.js
git commit -m "feat: add JS infrastructure for new page types (stubs, generate, inserts)"
```

---

### Task 2: Control panel HTML

**Files:**
- Modify: `index.html:22-26` (after the existing Monthly/Weekly/Daily checks row)

- [ ] **Step 1: Add dated-extras checkbox row**

Find the existing checks row in `index.html`:
```html
<div class="row checks">
  <label><input type="checkbox" id="chk-monthly" checked> Monthly</label>
  <label><input type="checkbox" id="chk-weekly" checked> Weekly</label>
  <label><input type="checkbox" id="chk-daily" checked> Daily</label>
</div>
```

Insert immediately after it:
```html
<div class="row checks">
  <label><input type="checkbox" id="chk-thanks"> Thankfulness</label>
  <label><input type="checkbox" id="chk-habit-tracker"> Habit Tracker</label>
  <label><input type="checkbox" id="chk-one-line"> One Line a Day</label>
  <label><input type="checkbox" id="chk-mood-tracker"> Mood Tracker</label>
  <label><input type="checkbox" id="chk-weekly-review"> Weekly Review</label>
</div>
<div class="row checks inserts-row">
  <label>Brain Dump <input type="number" id="ins-brain-dump" class="ins-count" value="0" min="0" max="99"></label>
  <label>Collections <input type="number" id="ins-collections" class="ins-count" value="0" min="0" max="99"></label>
  <label>Sketch <input type="number" id="ins-sketch" class="ins-count" value="0" min="0" max="99"></label>
  <label>Expense Log <input type="number" id="ins-expense-log" class="ins-count" value="0" min="0" max="99"></label>
  <label>Future Log <input type="number" id="ins-future-log" class="ins-count" value="0" min="0" max="99"></label>
  <label>Project <input type="number" id="ins-project" class="ins-count" value="0" min="0" max="99"></label>
</div>
```

- [ ] **Step 2: Add spinner CSS to planner.css**

At the end of `styles/planner.css`, append:

```css
/* ============ New page types — control panel ============ */
.ins-count { width: 2.8em; text-align: center; margin-left: 2px; }
.inserts-row label { white-space: nowrap; }
```

- [ ] **Step 3: Commit**

```bash
git add index.html styles/planner.css
git commit -m "feat: add dated-extras checkboxes and insert spinners to control panel"
```

---

### Task 3: Update initGenerator to read new inputs

**Files:**
- Modify: `js/planner.js` — `run` function inside `initGenerator`

- [ ] **Step 1: Replace the run function**

Find `var run = function () {` inside `initGenerator` and replace it with:

```js
var run = function () {
  var types = [];
  ['monthly', 'weekly', 'daily', 'thanks', 'habit-tracker', 'one-line', 'mood-tracker', 'weekly-review'].forEach(function (t) {
    var box = document.getElementById('chk-' + t);
    if (box && box.checked) types.push(t);
  });
  var inserts = {};
  INSERT_KEYS.forEach(function (k) {
    var el = document.getElementById('ins-' + k);
    inserts[k] = el ? (parseInt(el.value, 10) || 0) : 0;
  });
  generate(types, parse(startEl.value), parse(endEl.value), tileOn(), !!(duplexEl && duplexEl.checked), inserts);
};
```

- [ ] **Step 2: Open index.html in a browser and verify**

Open `index.html`. The control panel should show two new rows. Click Generate with the default A5/Monthly/Weekly/Daily settings — pages should render as before (no regression). Check the browser console for errors.

Expected: no console errors, existing pages render.

- [ ] **Step 3: Commit**

```bash
git add js/planner.js
git commit -m "feat: wire new checkboxes and insert spinners into generate() call"
```

---

### Task 4: Thankfulness page

**Files:**
- Modify: `index.html` — add `tpl-thanks` template before `</body>`
- Modify: `js/planner.js` — replace `buildThanksPage` and `renderThanks` stubs
- Modify: `styles/planner.css` — add `.page.thanks` styles

- [ ] **Step 1: Add template**

In `index.html`, add before `<script src="js/planner.js">`:

```html
<!-- ============ Thankfulness template ============ -->
<template id="tpl-thanks">
  <div class="page thanks">
    <div class="hd">
      <span class="title"><span class="mark"></span> <span class="js-date"></span></span>
      <span class="ornament"></span>
    </div>
    <div class="thanks-body">
      <h4 class="label">Gratitude</h4>
      <div class="thanks-prompt"><span class="thanks-label">I am grateful for…</span><div class="line"></div></div>
      <div class="thanks-prompt"><span class="thanks-label">I am grateful for…</span><div class="line"></div></div>
      <div class="thanks-prompt"><span class="thanks-label">I am grateful for…</span><div class="line"></div></div>
      <h4 class="label" style="margin-top:5mm;">Today's Intention</h4>
      <div class="box lines fill-lines" style="flex:1;">
        <div class="line"></div><div class="line"></div><div class="line"></div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Replace buildThanksPage and renderThanks stubs in planner.js**

Find `function buildThanksPage(d)` (the stub) and replace both the builder and renderer stubs:

```js
function buildThanksPage(d) {
  var f = clone('thanks');
  f.querySelector('.js-date').textContent = fmtLong(d);
  return f.querySelector('.page');
}

function renderThanks(start, end, mount) {
  var n = 0;
  for (var d = new Date(start); d <= end; d = addDays(d, 1)) { mount.appendChild(buildThanksPage(d)); n++; }
  return n;
}
```

- [ ] **Step 3: Add CSS**

Append to `styles/planner.css`:

```css
/* ---- Thankfulness ---- */
.page.thanks { flex-direction: column; }
.thanks-body { display: flex; flex-direction: column; flex: 1; }
.thanks-prompt { margin-bottom: 5mm; }
.thanks-label {
  display: block;
  font-size: 8pt;
  color: var(--accent-soft);
  font-style: italic;
  margin-bottom: 1mm;
}
.thanks-prompt .line {
  border-bottom: 1px dotted var(--line);
  height: 7mm;
}
```

- [ ] **Step 4: Verify in browser**

Open `index.html`. Tick "Thankfulness", set a 3-day range, click Generate.
Expected: 3 thankfulness pages, each with a date header, 3 gratitude prompt lines, and an intention box.

- [ ] **Step 5: Commit**

```bash
git add index.html js/planner.js styles/planner.css
git commit -m "feat: add Thankfulness daily page"
```

---

### Task 5: Habit Tracker page

**Files:**
- Modify: `index.html` — add `tpl-habit-tracker`
- Modify: `js/planner.js` — replace `buildHabitTrackerPage` and `renderHabitTracker` stubs
- Modify: `styles/planner.css` — add `.page.habit-tracker` styles

- [ ] **Step 1: Add template**

In `index.html`, add after the Thankfulness template:

```html
<!-- ============ Habit Tracker template ============ -->
<template id="tpl-habit-tracker">
  <div class="page habit-tracker">
    <div class="hd">
      <span class="title"><span class="mark"></span> <span class="js-month"></span></span>
      <span class="ornament"></span>
    </div>
    <h4 class="label">Habit Tracker</h4>
    <div class="ht-grid"></div>
  </div>
</template>
```

- [ ] **Step 2: Replace buildHabitTrackerPage and renderHabitTracker stubs**

```js
function buildHabitTrackerPage(monthDate) {
  var f = clone('habit-tracker');
  f.querySelector('.js-month').textContent = MONTHS[monthDate.getMonth()] + ' ' + monthDate.getFullYear();
  var daysIn = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  var grid = f.querySelector('.ht-grid');
  var html = '<div class="ht-cell ht-corner"></div>';
  for (var h = 0; h < 7; h++) html += '<div class="ht-cell col-head"></div>';
  for (var d = 1; d <= 31; d++) {
    var bl = d > daysIn ? ' blank' : '';
    html += '<div class="ht-cell day-num' + bl + '">' + (d <= daysIn ? d : '') + '</div>';
    for (var c = 0; c < 7; c++) html += '<div class="ht-cell' + bl + '"></div>';
  }
  grid.innerHTML = html;
  return f.querySelector('.page');
}

function renderHabitTracker(start, end, mount) {
  var n = 0;
  eachMonth(start, end, function (cur) { mount.appendChild(buildHabitTrackerPage(cur)); n++; });
  return n;
}
```

- [ ] **Step 3: Add CSS**

```css
/* ---- Habit Tracker ---- */
.page.habit-tracker { flex-direction: column; }
.ht-grid {
  display: grid;
  grid-template-columns: 7mm repeat(7, 1fr);
  flex: 1;
  border: 1px solid var(--box-border);
  border-radius: 4px;
  overflow: hidden;
  align-content: start;
}
.ht-cell {
  border-right: 1px solid var(--cell-border);
  border-bottom: 1px solid var(--cell-border);
  font-size: 6.5pt;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--cell-num);
  min-height: 4.5mm;
}
.ht-cell.col-head {
  background: var(--accent-bg);
  min-height: 6mm;
  color: var(--accent-soft);
  font-size: 6pt;
}
.ht-cell.ht-corner { background: var(--accent-bg); }
.ht-cell.day-num {
  background: var(--daynum-bg);
  color: var(--daynum-ink);
  font-size: 6.5pt;
}
.ht-cell.blank { background: var(--blank-bg); }
```

- [ ] **Step 4: Verify in browser**

Tick "Habit Tracker", set a 2-month range, click Generate.
Expected: 2 habit tracker pages with month headers, a row of 7 blank column headers, and 31 day rows (short-month rows greyed at the bottom).

- [ ] **Step 5: Commit**

```bash
git add index.html js/planner.js styles/planner.css
git commit -m "feat: add Habit Tracker monthly page"
```

---

### Task 6: One Line a Day page

**Files:**
- Modify: `index.html` — add `tpl-one-line`
- Modify: `js/planner.js` — replace `buildOneLinePage` and `renderOneLine` stubs
- Modify: `styles/planner.css` — add `.page.one-line` styles

- [ ] **Step 1: Add template**

```html
<!-- ============ One Line a Day template ============ -->
<template id="tpl-one-line">
  <div class="page one-line">
    <div class="hd">
      <span class="title"><span class="mark"></span> <span class="js-month"></span></span>
      <span class="ornament"></span>
    </div>
    <h4 class="label">One Line a Day</h4>
    <div class="ol-entries"></div>
  </div>
</template>
```

- [ ] **Step 2: Replace buildOneLinePage and renderOneLine stubs**

```js
function buildOneLinePage(monthDate) {
  var f = clone('one-line');
  f.querySelector('.js-month').textContent = MONTHS[monthDate.getMonth()] + ' ' + monthDate.getFullYear();
  var daysIn = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  var entries = f.querySelector('.ol-entries');
  var html = '';
  for (var d = 1; d <= 31; d++) {
    var bl = d > daysIn ? ' blank' : '';
    html += '<div class="ol-entry' + bl + '"><span class="ol-num">' + (d <= daysIn ? d : '') + '</span><div class="ol-line"></div></div>';
  }
  entries.innerHTML = html;
  return f.querySelector('.page');
}

function renderOneLine(start, end, mount) {
  var n = 0;
  eachMonth(start, end, function (cur) { mount.appendChild(buildOneLinePage(cur)); n++; });
  return n;
}
```

- [ ] **Step 3: Add CSS**

```css
/* ---- One Line a Day ---- */
.page.one-line { flex-direction: column; }
.ol-entries { display: flex; flex-direction: column; flex: 1; justify-content: space-between; }
.ol-entry {
  display: flex;
  align-items: flex-end;
  gap: 2mm;
  padding-bottom: 0.5mm;
}
.ol-entry.blank { opacity: 0.25; }
.ol-num {
  font-size: 6.5pt;
  color: var(--cell-num);
  min-width: 5mm;
  text-align: right;
  flex-shrink: 0;
  padding-bottom: 1px;
}
.ol-line {
  flex: 1;
  border-bottom: 1px dotted var(--line);
  height: 5mm;
}
```

- [ ] **Step 4: Verify in browser**

Tick "One Line a Day", set a 1-month range for a 30-day month (e.g. September), click Generate.
Expected: one page with 31 numbered rows; the 31st row is faded (September has 30 days).

- [ ] **Step 5: Commit**

```bash
git add index.html js/planner.js styles/planner.css
git commit -m "feat: add One Line a Day monthly page"
```

---

### Task 7: Mood Tracker page

**Files:**
- Modify: `index.html` — add `tpl-mood-tracker`
- Modify: `js/planner.js` — replace `buildMoodTrackerPage` and `renderMoodTracker` stubs
- Modify: `styles/planner.css` — add `.page.mood-tracker` styles

- [ ] **Step 1: Add template**

```html
<!-- ============ Mood Tracker template ============ -->
<template id="tpl-mood-tracker">
  <div class="page mood-tracker">
    <div class="hd">
      <span class="title"><span class="mark"></span> <span class="js-month"></span></span>
      <span class="ornament"></span>
    </div>
    <h4 class="label">Mood Tracker</h4>
    <div class="mt-grid"></div>
    <div class="mt-legend">
      <h4 class="label" style="margin-top:3mm;">Legend</h4>
      <div class="mt-legend-row">
        <div class="mt-legend-item"></div><div class="mt-legend-item"></div>
        <div class="mt-legend-item"></div><div class="mt-legend-item"></div>
        <div class="mt-legend-item"></div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Replace buildMoodTrackerPage and renderMoodTracker stubs**

```js
function buildMoodTrackerPage(monthDate) {
  var f = clone('mood-tracker');
  f.querySelector('.js-month').textContent = MONTHS[monthDate.getMonth()] + ' ' + monthDate.getFullYear();
  var daysIn = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  var grid = f.querySelector('.mt-grid');
  var html = '';
  for (var d = 1; d <= 31; d++) {
    var bl = d > daysIn ? ' blank' : '';
    html += '<div class="mt-cell' + bl + '"><span class="mt-num">' + (d <= daysIn ? d : '') + '</span></div>';
  }
  grid.innerHTML = html;
  return f.querySelector('.page');
}

function renderMoodTracker(start, end, mount) {
  var n = 0;
  eachMonth(start, end, function (cur) { mount.appendChild(buildMoodTrackerPage(cur)); n++; });
  return n;
}
```

- [ ] **Step 3: Add CSS**

```css
/* ---- Mood Tracker ---- */
.page.mood-tracker { flex-direction: column; }
.mt-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1.5mm;
  flex: 1;
  align-content: start;
}
.mt-cell {
  border: 1px solid var(--cell-border);
  border-radius: 3px;
  min-height: 11mm;
  position: relative;
  background: var(--box-bg);
}
.mt-cell.blank {
  background: var(--blank-bg);
  border-color: var(--blank-bg);
}
.mt-num {
  font-size: 6pt;
  color: var(--cell-num);
  position: absolute;
  top: 1mm;
  left: 1.5mm;
  line-height: 1;
}
.mt-legend-row { display: flex; gap: 3mm; flex-wrap: wrap; margin-top: 2mm; }
.mt-legend-item {
  display: flex;
  align-items: center;
  gap: 2mm;
  font-size: 8pt;
  color: var(--muted);
}
.mt-legend-item::before {
  content: '';
  display: block;
  width: 6mm;
  height: 6mm;
  border: 1px solid var(--cell-border);
  border-radius: 2px;
  background: var(--box-bg);
  flex-shrink: 0;
}
```

- [ ] **Step 4: Verify in browser**

Tick "Mood Tracker", set a 1-month range for February, click Generate.
Expected: 31 cells in a 7-column grid; last 3 cells of row 5 faded (Feb has 28 days in non-leap years). Legend strip at bottom.

- [ ] **Step 5: Commit**

```bash
git add index.html js/planner.js styles/planner.css
git commit -m "feat: add Mood Tracker monthly page"
```

---

### Task 8: Weekly Review page

**Files:**
- Modify: `index.html` — add `tpl-weekly-review`
- Modify: `js/planner.js` — replace `buildWeeklyReviewPage` and `renderWeeklyReview` stubs
- Modify: `styles/planner.css` — add `.page.weekly-review` styles

- [ ] **Step 1: Add template**

```html
<!-- ============ Weekly Review template ============ -->
<template id="tpl-weekly-review">
  <div class="page weekly-review">
    <div class="hd">
      <span class="title"><span class="mark"></span> Week of <span class="js-weekof"></span></span>
      <span class="ornament"></span>
    </div>
    <div class="review-box">
      <h4 class="label">What went well</h4>
      <div class="box lines fill-lines review-lines">
        <div class="line"></div><div class="line"></div><div class="line"></div>
        <div class="line"></div><div class="line"></div><div class="line"></div>
      </div>
    </div>
    <div class="review-box">
      <h4 class="label">What to improve</h4>
      <div class="box lines fill-lines review-lines">
        <div class="line"></div><div class="line"></div><div class="line"></div>
        <div class="line"></div><div class="line"></div><div class="line"></div>
      </div>
    </div>
    <div class="review-box">
      <h4 class="label">Next week's focus</h4>
      <div class="box lines fill-lines review-lines">
        <div class="line"></div><div class="line"></div><div class="line"></div>
        <div class="line"></div><div class="line"></div><div class="line"></div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Replace buildWeeklyReviewPage and renderWeeklyReview stubs**

```js
function buildWeeklyReviewPage(m) {
  var f = clone('weekly-review');
  f.querySelector('.js-weekof').textContent = fmtMD(m) + ', ' + m.getFullYear();
  return f.querySelector('.page');
}

function renderWeeklyReview(start, end, mount) {
  var n = 0;
  eachWeek(start, end, function (m) { mount.appendChild(buildWeeklyReviewPage(m)); n++; });
  return n;
}
```

- [ ] **Step 3: Add CSS**

```css
/* ---- Weekly Review ---- */
.page.weekly-review { flex-direction: column; }
.review-box { display: flex; flex-direction: column; flex: 1; }
.review-box + .review-box { margin-top: 4mm; }
.review-box .review-lines { flex: 1; }
```

- [ ] **Step 4: Verify in browser**

Tick "Weekly Review", set a 2-week range, click Generate.
Expected: 2 review pages with week-of headers and 3 equal lined boxes.

- [ ] **Step 5: Commit**

```bash
git add index.html js/planner.js styles/planner.css
git commit -m "feat: add Weekly Review page"
```

---

### Task 9: Brain Dump insert

**Files:**
- Modify: `index.html` — add `tpl-brain-dump`
- Modify: `styles/planner.css` — add `.page.brain-dump` styles

- [ ] **Step 1: Add template**

```html
<!-- ============ Brain Dump template ============ -->
<template id="tpl-brain-dump">
  <div class="page brain-dump">
    <div class="hd">
      <span class="title"><span class="mark"></span> Brain Dump</span>
      <span class="ornament"></span>
    </div>
    <div class="box lines fill-lines bd-lines">
      <div class="line"></div><div class="line"></div><div class="line"></div>
      <div class="line"></div><div class="line"></div><div class="line"></div>
      <div class="line"></div><div class="line"></div><div class="line"></div>
      <div class="line"></div><div class="line"></div><div class="line"></div>
      <div class="line"></div><div class="line"></div><div class="line"></div>
      <div class="line"></div><div class="line"></div><div class="line"></div>
      <div class="line"></div><div class="line"></div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Add CSS**

```css
/* ---- Brain Dump ---- */
.page.brain-dump { flex-direction: column; }
.bd-lines { flex: 1; }
```

- [ ] **Step 3: Verify in browser**

Set "Brain Dump" spinner to 2, click Generate.
Expected: 2 brain dump pages, each with a header and a full page of ruled lines.

- [ ] **Step 4: Commit**

```bash
git add index.html styles/planner.css
git commit -m "feat: add Brain Dump insert page"
```

---

### Task 10: Collections insert

**Files:**
- Modify: `index.html` — add `tpl-collections`
- Modify: `styles/planner.css` — add `.page.collections` styles

- [ ] **Step 1: Add template**

```html
<!-- ============ Collections template ============ -->
<template id="tpl-collections">
  <div class="page collections">
    <div class="hd">
      <span class="title"><span class="mark"></span> Collection</span>
      <span class="ornament"></span>
    </div>
    <div class="coll-title-field"><div class="coll-title-line"></div></div>
    <div class="box lines numbered coll-list">
      <div class="line"><span class="num">1</span></div>
      <div class="line"><span class="num">2</span></div>
      <div class="line"><span class="num">3</span></div>
      <div class="line"><span class="num">4</span></div>
      <div class="line"><span class="num">5</span></div>
      <div class="line"><span class="num">6</span></div>
      <div class="line"><span class="num">7</span></div>
      <div class="line"><span class="num">8</span></div>
      <div class="line"><span class="num">9</span></div>
      <div class="line"><span class="num">10</span></div>
      <div class="line"><span class="num">11</span></div>
      <div class="line"><span class="num">12</span></div>
      <div class="line"><span class="num">13</span></div>
      <div class="line"><span class="num">14</span></div>
      <div class="line"><span class="num">15</span></div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Add CSS**

```css
/* ---- Collections ---- */
.page.collections { flex-direction: column; }
.coll-title-field { margin-bottom: 4mm; }
.coll-title-line {
  border-bottom: 2px solid var(--accent);
  height: 8mm;
}
.coll-list { flex: 1; }
```

- [ ] **Step 3: Verify in browser**

Set "Collections" spinner to 1, click Generate.
Expected: one collections page with a bold title underline and 15 numbered list rows.

- [ ] **Step 4: Commit**

```bash
git add index.html styles/planner.css
git commit -m "feat: add Collections insert page"
```

---

### Task 11: Sketch/Doodle insert

**Files:**
- Modify: `index.html` — add `tpl-sketch`
- Modify: `styles/planner.css` — add `.page.sketch` styles

- [ ] **Step 1: Add template**

```html
<!-- ============ Sketch/Doodle template ============ -->
<template id="tpl-sketch">
  <div class="page sketch">
    <div class="hd">
      <span class="title"><span class="mark"></span> Sketch</span>
      <span class="ornament"></span>
    </div>
    <div class="sketch-title-field"><div class="sketch-title-line"></div></div>
    <div class="sketch-canvas"></div>
  </div>
</template>
```

- [ ] **Step 2: Add CSS**

```css
/* ---- Sketch / Doodle ---- */
.page.sketch { flex-direction: column; }
.sketch-title-field { margin-bottom: 3mm; }
.sketch-title-line { border-bottom: 1px solid var(--line-solid); height: 7mm; }
.sketch-canvas {
  flex: 1;
  border: 1px solid var(--box-border);
  border-radius: 4px;
  background: var(--box-bg);
}
```

- [ ] **Step 3: Verify in browser**

Set "Sketch" spinner to 1, click Generate.
Expected: one sketch page with a header, a blank title line, and a large open canvas box filling the rest of the page.

- [ ] **Step 4: Commit**

```bash
git add index.html styles/planner.css
git commit -m "feat: add Sketch/Doodle insert page"
```

---

### Task 12: Expense Log insert

**Files:**
- Modify: `index.html` — add `tpl-expense-log`
- Modify: `styles/planner.css` — add `.page.expense-log` styles

- [ ] **Step 1: Add template**

```html
<!-- ============ Expense Log template ============ -->
<template id="tpl-expense-log">
  <div class="page expense-log">
    <div class="hd">
      <span class="title"><span class="mark"></span> Expense Log</span>
      <span class="ornament"></span>
    </div>
    <div class="exp-header">
      <span class="exp-date">Date</span>
      <span class="exp-desc">Description</span>
      <span class="exp-amt">Amount</span>
    </div>
    <div class="exp-rows">
      <div class="exp-row"><span class="exp-date"></span><span class="exp-desc"></span><span class="exp-amt"></span></div>
      <div class="exp-row"><span class="exp-date"></span><span class="exp-desc"></span><span class="exp-amt"></span></div>
      <div class="exp-row"><span class="exp-date"></span><span class="exp-desc"></span><span class="exp-amt"></span></div>
      <div class="exp-row"><span class="exp-date"></span><span class="exp-desc"></span><span class="exp-amt"></span></div>
      <div class="exp-row"><span class="exp-date"></span><span class="exp-desc"></span><span class="exp-amt"></span></div>
      <div class="exp-row"><span class="exp-date"></span><span class="exp-desc"></span><span class="exp-amt"></span></div>
      <div class="exp-row"><span class="exp-date"></span><span class="exp-desc"></span><span class="exp-amt"></span></div>
      <div class="exp-row"><span class="exp-date"></span><span class="exp-desc"></span><span class="exp-amt"></span></div>
      <div class="exp-row"><span class="exp-date"></span><span class="exp-desc"></span><span class="exp-amt"></span></div>
      <div class="exp-row"><span class="exp-date"></span><span class="exp-desc"></span><span class="exp-amt"></span></div>
      <div class="exp-row"><span class="exp-date"></span><span class="exp-desc"></span><span class="exp-amt"></span></div>
      <div class="exp-row"><span class="exp-date"></span><span class="exp-desc"></span><span class="exp-amt"></span></div>
      <div class="exp-row"><span class="exp-date"></span><span class="exp-desc"></span><span class="exp-amt"></span></div>
      <div class="exp-row"><span class="exp-date"></span><span class="exp-desc"></span><span class="exp-amt"></span></div>
      <div class="exp-row"><span class="exp-date"></span><span class="exp-desc"></span><span class="exp-amt"></span></div>
      <div class="exp-row"><span class="exp-date"></span><span class="exp-desc"></span><span class="exp-amt"></span></div>
      <div class="exp-row"><span class="exp-date"></span><span class="exp-desc"></span><span class="exp-amt"></span></div>
      <div class="exp-row"><span class="exp-date"></span><span class="exp-desc"></span><span class="exp-amt"></span></div>
      <div class="exp-row"><span class="exp-date"></span><span class="exp-desc"></span><span class="exp-amt"></span></div>
      <div class="exp-row"><span class="exp-date"></span><span class="exp-desc"></span><span class="exp-amt"></span></div>
    </div>
    <div class="exp-total">
      <span class="exp-date"></span>
      <span class="exp-desc exp-total-label">Total</span>
      <span class="exp-amt exp-total-val"></span>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Add CSS**

```css
/* ---- Expense Log ---- */
.page.expense-log { flex-direction: column; }
.exp-header, .exp-row, .exp-total {
  display: grid;
  grid-template-columns: 14mm 1fr 18mm;
  gap: 2mm;
  padding: 1mm 0;
  border-bottom: 1px solid var(--line);
}
.exp-header {
  border-bottom: 2px solid var(--accent);
  font-size: 7.5pt;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent-soft);
  padding-bottom: 1.5mm;
  margin-bottom: 0.5mm;
}
.exp-rows { flex: 1; overflow: hidden; }
.exp-total {
  border-top: 2px solid var(--accent);
  border-bottom: none;
  margin-top: 1mm;
}
.exp-total-label {
  font-size: 7.5pt;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent-soft);
  text-align: right;
}
.exp-total-val { border-bottom: 1px solid var(--accent); }
```

- [ ] **Step 3: Verify in browser**

Set "Expense Log" spinner to 1, click Generate.
Expected: one expense log page with a Date/Description/Amount header row, 20 blank ruled rows, and a Total line.

- [ ] **Step 4: Commit**

```bash
git add index.html styles/planner.css
git commit -m "feat: add Expense Log insert page"
```

---

### Task 13: Future Log insert

**Files:**
- Modify: `index.html` — add `tpl-future-log`
- Modify: `styles/planner.css` — add `.page.future-log` styles

- [ ] **Step 1: Add template**

```html
<!-- ============ Future Log template ============ -->
<template id="tpl-future-log">
  <div class="page future-log">
    <div class="hd">
      <span class="title"><span class="mark"></span> Future Log</span>
      <span class="ornament"></span>
    </div>
    <div class="fl-grid">
      <div class="fl-box"><div class="fl-month"></div><div class="box lines fill-lines fl-lines"><div class="line"></div><div class="line"></div><div class="line"></div><div class="line"></div></div></div>
      <div class="fl-box"><div class="fl-month"></div><div class="box lines fill-lines fl-lines"><div class="line"></div><div class="line"></div><div class="line"></div><div class="line"></div></div></div>
      <div class="fl-box"><div class="fl-month"></div><div class="box lines fill-lines fl-lines"><div class="line"></div><div class="line"></div><div class="line"></div><div class="line"></div></div></div>
      <div class="fl-box"><div class="fl-month"></div><div class="box lines fill-lines fl-lines"><div class="line"></div><div class="line"></div><div class="line"></div><div class="line"></div></div></div>
      <div class="fl-box"><div class="fl-month"></div><div class="box lines fill-lines fl-lines"><div class="line"></div><div class="line"></div><div class="line"></div><div class="line"></div></div></div>
      <div class="fl-box"><div class="fl-month"></div><div class="box lines fill-lines fl-lines"><div class="line"></div><div class="line"></div><div class="line"></div><div class="line"></div></div></div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Add CSS**

```css
/* ---- Future Log ---- */
.page.future-log { flex-direction: column; }
.fl-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: repeat(3, 1fr);
  gap: 3mm;
  flex: 1;
}
.fl-box {
  border: 1px solid var(--box-border);
  border-radius: 4px;
  padding: 2mm 2.5mm;
  display: flex;
  flex-direction: column;
  background: var(--box-bg);
}
.fl-month {
  font-size: 7.5pt;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--accent-soft);
  border-bottom: 1px solid var(--line-solid);
  padding-bottom: 1mm;
  margin-bottom: 1.5mm;
  min-height: 5mm;
}
.fl-lines { flex: 1; border: none; background: transparent; padding: 0; }
```

- [ ] **Step 3: Verify in browser**

Set "Future Log" spinner to 1, click Generate.
Expected: one future log page with a 2×3 grid of six boxes, each with a blank month label area and 4 ruled lines.

- [ ] **Step 4: Commit**

```bash
git add index.html styles/planner.css
git commit -m "feat: add Future Log insert page"
```

---

### Task 14: Project insert

**Files:**
- Modify: `index.html` — add `tpl-project`
- Modify: `styles/planner.css` — add `.page.project` styles

- [ ] **Step 1: Add template**

```html
<!-- ============ Project template ============ -->
<template id="tpl-project">
  <div class="page project">
    <div class="hd">
      <span class="title"><span class="mark"></span> Project</span>
      <span class="ornament"></span>
    </div>
    <div class="proj-fields">
      <div class="proj-field"><span class="proj-label">Name</span><div class="proj-line"></div></div>
      <div class="proj-field"><span class="proj-label">Goal</span><div class="proj-line"></div></div>
      <div class="proj-field"><span class="proj-label">Deadline</span><div class="proj-line"></div></div>
    </div>
    <h4 class="label">Steps</h4>
    <div class="box lines numbered proj-steps">
      <div class="line"><span class="num">1</span></div>
      <div class="line"><span class="num">2</span></div>
      <div class="line"><span class="num">3</span></div>
      <div class="line"><span class="num">4</span></div>
      <div class="line"><span class="num">5</span></div>
      <div class="line"><span class="num">6</span></div>
      <div class="line"><span class="num">7</span></div>
      <div class="line"><span class="num">8</span></div>
      <div class="line"><span class="num">9</span></div>
      <div class="line"><span class="num">10</span></div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Add CSS**

```css
/* ---- Project ---- */
.page.project { flex-direction: column; }
.proj-fields { margin-bottom: 4mm; }
.proj-field {
  display: flex;
  align-items: flex-end;
  gap: 3mm;
  margin-bottom: 3mm;
}
.proj-label {
  font-size: 7.5pt;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent-soft);
  min-width: 16mm;
  flex-shrink: 0;
  padding-bottom: 1px;
}
.proj-line {
  flex: 1;
  border-bottom: 1px dotted var(--line);
  height: 6mm;
}
.proj-steps { flex: 1; }
```

- [ ] **Step 3: Verify in browser**

Set "Project" spinner to 1, click Generate.
Expected: one project page with Name/Goal/Deadline field lines and 10 numbered step rows.

- [ ] **Step 4: Commit**

```bash
git add index.html styles/planner.css
git commit -m "feat: add Project insert page"
```

---

### Task 15: Full verification

**Files:** none — browser verification only

- [ ] **Step 1: Test all date-driven extras together**

Open `index.html`. Tick Monthly, Weekly, Daily, Thankfulness, Habit Tracker, One Line a Day, Mood Tracker, Weekly Review. Set a 2-week range. Click Generate.
Expected: no console errors; all page types render with correct headers and content.

- [ ] **Step 2: Test inserts only (no date range needed)**

Untick all checkboxes. Set all insert spinners to 1. Clear the date fields (or leave any range). Click Generate.
Expected: 6 insert pages render; status bar lists them all.

- [ ] **Step 3: Test Mini planner size with new pages**

Select "Mini (81×120 mm)" as planner size. Tick "Habit Tracker". Set a 1-month range. Click Generate.
Expected: habit tracker renders at Mini size with 19 mm left margin and punch-guide dots visible.

- [ ] **Step 4: Test tiling**

Select A5 planner size, Letter paper, tick "Tile 2-up". Tick Thankfulness. Set a 4-day range. Click Generate.
Expected: 2 landscape sheets, each holding 2 thankfulness pages side by side.

- [ ] **Step 5: Test duplex with new pages**

Tick Weekly Review + Weekly. Check "2-sided order". Set a 2-week range. Click Generate.
Expected: duplex sequence renders without console errors; blank padding pages inserted where needed.

- [ ] **Step 6: Test theme compatibility**

Change Theme to "Midnight". Tick all new page types. Click Generate.
Expected: all pages use the Midnight colour palette with no hard-coded colours leaking through.

- [ ] **Step 7: Final commit**

```bash
git commit --allow-empty -m "chore: verified all 11 new page types across sizes, themes, tiling, and duplex"
```
