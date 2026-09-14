# New Page Types — Design

**Date:** 2026-09-14
**Status:** Approved

## Purpose

Add 11 new planner page types to the generator, available for all planner sizes (Mini, A6, A5, A4,
Letter). Five are date-driven (follow the existing date range); six are count-based inserts that
append after all dated pages. All are implemented as HTML `<template>` elements styled by the
shared CSS variable system so they honour every existing theme.

## New Page Types

### Date-Driven (follow date range, same cadence as existing pages)

| Key | Cadence | Description |
|---|---|---|
| `thanks` | daily | Date header, 3 "I am grateful for…" prompted lines, 1 "Today's intention" free line |
| `habit-tracker` | monthly | Month header, 7 blank habit columns, rows 1–31 (day numbers on left), short-month rows greyed |
| `one-line` | monthly | Month header, 31 numbered rows with one ruled line each |
| `mood-tracker` | monthly | Month header, 31 numbered squares to colour/mark, small legend strip |
| `weekly-review` | weekly | Week header, 3 equal boxes: "What went well" / "What to improve" / "Next week's focus" |

### Inserts (count-based, appended after dated pages)

| Key | Description |
|---|---|
| `brain-dump` | Minimal header, full page of ruled lines |
| `collections` | Title field at top, numbered list rows |
| `sketch` | Title line, large blank box filling most of the page |
| `expense-log` | Date / Description / Amount columns, ~20 rows, total line at bottom |
| `future-log` | 6 equal boxes with blank month-label headers and lined space inside |
| `project` | Name / Goal / Deadline fields, checklist of 10 steps |

## Control Panel Changes (`index.html`)

Two new rows are added below the existing Monthly/Weekly/Daily checkboxes.

**Row: Dated extras** (checkboxes, same pattern as existing):
```
[ ] Thankfulness   [ ] Habit Tracker   [ ] One Line a Day
[ ] Mood Tracker   [ ] Weekly Review
```

**Row: Inserts** (number spinners, min 0, default 0):
```
Brain Dump [0]   Collections [0]   Sketch [0]
Expense Log [0]  Future Log [0]    Project [0]
```

Each spinner renders that many copies of the page appended after all dated pages.

## Template Structure (`index.html`)

Eleven new `<template>` elements added after the existing three:

- `tpl-thanks`
- `tpl-habit-tracker`
- `tpl-one-line`
- `tpl-mood-tracker`
- `tpl-weekly-review`
- `tpl-brain-dump`
- `tpl-collections`
- `tpl-sketch`
- `tpl-expense-log`
- `tpl-future-log`
- `tpl-project`

All use `.page` as their root element so sizing, theming, and print rules apply automatically.

## JavaScript Changes (`js/planner.js`)

### New page builders

```
buildThanksPage(d)           → single .page, fills date
buildHabitTrackerPage(m)     → single .page, fills month name + day count
buildOneLinePage(m)          → single .page, fills month name + day count
buildMoodTrackerPage(m)      → single .page, fills month name + day count
buildWeeklyReviewPage(m)     → single .page, fills week-of date
```

Short months: `buildHabitTrackerPage` and `buildMoodTrackerPage` mark rows beyond `daysInMonth`
with a `blank` class (same pattern as the existing monthly calendar cells).

### Extended RENDERERS and ORDER

```js
var RENDERERS = {
  monthly:       renderMonthly,
  weekly:        renderWeekly,
  daily:         renderDaily,
  thanks:        renderThanks,
  'habit-tracker': renderHabitTracker,
  'one-line':    renderOneLine,
  'mood-tracker': renderMoodTracker,
  'weekly-review': renderWeeklyReview
};
var ORDER = ['monthly', 'weekly', 'daily', 'thanks',
             'habit-tracker', 'one-line', 'mood-tracker', 'weekly-review'];
```

### Insert renderer

```js
function renderInserts(inserts, mount) {
  INSERT_KEYS.forEach(function (key) {
    var n = inserts[key] || 0;
    for (var i = 0; i < n; i++) {
      var f = clone(key);
      mount.appendChild(f.querySelector('.page'));
    }
  });
}
```

`INSERT_KEYS = ['brain-dump', 'collections', 'sketch', 'expense-log', 'future-log', 'project']`

### Updated `generate()` signature

```js
function generate(types, start, end, tile, duplex, inserts)
```

`inserts` is a plain object `{ 'brain-dump': 2, 'collections': 1, … }`. Inserts are always
appended after dated pages (both in normal and duplex mode). In duplex mode they are treated as
single pages and pad to an even count with blank pages as needed.

### Updated `initGenerator()`

Reads the 5 new checkboxes into `types` and reads the 6 spinner values into the `inserts` object
before calling `generate()`.

## CSS Changes (`styles/planner.css`)

One new section appended for the new page types. All rules use CSS custom properties from the
existing theme system (no hard-coded colours).

### Thankfulness
- `.page.thanks` — standard two-column suppressed; single-column layout
- `.thanks .prompt` — labelled line group (label + ruled line beneath)
- `.thanks .intention` — final free line with a distinct label

### Habit Tracker
- `.page.habit-tracker` — grid: `display: grid`, 8 columns (day-num + 7 habits), 32 rows (header + 31)
- `.habit-tracker .col-head` — habit name cell (top row), blank for user to write in
- `.habit-tracker .day-cell` — square cell, `var(--box-border)` border; `.blank` cells get `var(--blank-bg)`

### One Line a Day
- `.page.one-line` — single column of 31 `.entry` rows
- `.one-line .entry` — day number label + one ruled line

### Mood Tracker
- `.page.mood-tracker` — grid of 31 `.mood-cell` squares (5 columns × 7 rows, last row partial)
- `.mood-cell` — square with day number in corner, large fill area, border; `.blank` gets `var(--blank-bg)`
- `.mood-tracker .legend` — small strip at bottom for user to define their colour key

### Weekly Review
- `.page.weekly-review` — three equal `.review-box` sections stacked vertically
- `.review-box` — label + lined fill area

### Brain Dump
- `.page.brain-dump` — single column of ruled lines filling the page

### Collections
- `.page.collections` — title input line at top, numbered rows below

### Sketch / Doodle
- `.page.sketch` — title line, large `.canvas` box (white fill, thin border) filling remaining space

### Expense Log
- `.page.expense-log` — three-column table (Date / Description / Amount), ruled rows, total line

### Future Log
- `.page.future-log` — 2×3 grid of `.month-box` (label + lined area inside each)

### Project Page
- `.page.project` — header fields (Name, Goal, Deadline) + `.checklist` of 10 `.step` rows

## Ordering in Output

```
[monthly spreads] [weekly-review + weekly spread + daily + thanks (per week)]
[habit-tracker (per month)] [one-line (per month)] [mood-tracker (per month)]
[inserts × count]
```

For simplicity, date-driven extras follow the same cadence loops as their parent type but are
rendered in a separate pass after all core pages. Inserts always follow everything.

## Out of Scope

- No interleaving of extras within the duplex cut-and-stack ordering (extras append at end).
- No per-habit-tracker custom column count (always 7 habits).
- No interactive fill-in (all pages are print-and-write).
- No habit tracker for sizes smaller than A6 getting a different column count.

## Success Criteria

- All 11 page types appear in the control panel and render pages when selected/counted.
- Date-driven extras respect the chosen date range.
- Insert spinners at 0 produce no pages; any positive value produces that many copies.
- All pages render correctly in every existing theme.
- All existing functionality (daily, weekly, monthly, tiling, duplex, Mini size) continues to work.
