# Skill Tree Journal — Design

Inspired by the Skill Tree Journal Kit (skilltree.how): a character-sheet-style habit system where each completed day fills a square, squares fill bubbles on a skill tree, and progress is permanent. Our version uses our own branches, names and layout.

## Branch sets

A "Branch set" dropdown in the planner UI. The chosen set (and custom names) is persisted with other settings and printed on every Skill Tree page.

| Set | Branches |
|---|---|
| Life (default) | Body, Mind, Craft, Bonds, Home & Money |
| Fantasy | Vitality, Arcana, Artisan, Fellowship, Fortune |
| Custom | Five text fields; user-entered names |

Always five branches.

## Pages

| Page | Cadence | Content |
|---|---|---|
| Character Sheet | one-off | name, title, level/XP box, stat block per branch, season line |
| Skill Key | one-off | 3–5 skills per branch: code (e.g. B1), daily action, XP value |
| Skill Tree | one-off | five trunks of fill-in bubbles, tiers unlocking upward, level counter at base |
| Loot Table | one-off | rewards by level milestone, claimed checkbox |
| Quest Log | one-off | side quests: title, reward, due date, done box |
| Skill Squares tracker | monthly | skill codes down the side, days 1–31 across; separate from existing Habit Tracker |
| Month's End | monthly | squares tally per branch, XP gained, level reached, wins/lessons, next focus |

Nothing on any page "resets"; the system is pen-friendly and cumulative.

## Integration

- Follows existing insert pattern: `<template>` in `index.html`, builder functions in `js/planner.js`, styles in `styles/planner.css`.
- One-off pages: counted inserts (spinners) added to `INSERT_KEYS`, defaulting to 1 each.
- Monthly pages: generated per month in the date range via `eachMonth`, like the Habit Tracker, with checkboxes and slotted into `ORDER`/`generate()`.
- Uses existing page classes, binding margin and punch-guide dots; must work at Mini size.

## Testing

`node --check js/planner.js`; render each page in the browser at full and Mini sizes; confirm no overflow, branch-set switching and custom names propagate to all pages; compare screenshots.
