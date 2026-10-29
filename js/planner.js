/* Paper Planner — generator.
   Clones each layout's <template> once per day / week / month across a date range
   and fills in the dates. Driven by the control panel in index.html. */
(function (global) {
  'use strict';

  var DAYS_SUN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var DAYS_MON = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(v) {
    if (!v) return null;
    var p = v.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function mondayOf(d) { return addDays(d, -((d.getDay() + 6) % 7)); }

  function fmtLong(d) { return DAYS_SUN[d.getDay()] + ' · ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); }
  function fmtMD(d) { return MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getDate(); }

  function clone(type) { return document.getElementById('tpl-' + type).content.cloneNode(true); }

  // ---- page builders: return page element(s), no DOM insertion ----

  function buildDailyPage(d) {
    var f = clone('daily');
    f.querySelector('.js-date').textContent = fmtLong(d);
    return f.querySelector('.page');
  }

  function buildWeeklySpread(m) {
    var f = clone('weekly');
    f.querySelector('.js-weekof').textContent = fmtMD(m) + ', ' + m.getFullYear();
    var days = f.querySelectorAll('.day[data-offset]');
    for (var i = 0; i < days.length; i++) {
      var off = +days[i].getAttribute('data-offset');
      days[i].querySelector('.dn').textContent = DAYS_MON[off] + ' · ' + fmtMD(addDays(m, off));
    }
    var pages = f.querySelectorAll('.page');
    return [pages[0], pages[1]];
  }

  function buildMonthlySpread(cur) {
    var f = clone('monthly');
    fillMonth(f, cur);
    var pages = f.querySelectorAll('.page');
    return [pages[0], pages[1]];
  }

  function blankPage() {
    var el = document.createElement('div');
    el.className = 'page blank-page';
    return el;
  }

  var _fillerIdx = 0;
  var FILLER_CYCLE = ['grid', 'dot-grid', 'collections'];
  function fillerType() {
    var el = document.getElementById('filler-type');
    return el ? el.value : 'random';
  }
  // Padding page used to keep spreads on facing leaves and to round out the last sheet.
  // `type` overrides the user's choice (used for the opening page); 'random' cycles the mix.
  function fillerPage(type) {
    type = type || fillerType();
    if (type === 'random') type = FILLER_CYCLE[_fillerIdx++ % FILLER_CYCLE.length];
    var page = type === 'blank' ? blankPage() : clone(type).querySelector('.page');
    page.setAttribute('data-filler', '1');
    return page;
  }
  function isFiller(p) { return p.hasAttribute('data-filler') || p.classList.contains('blank-page'); }

  // ---- range iterators ----

  function eachMonth(start, end, cb) {
    var cur = new Date(start.getFullYear(), start.getMonth(), 1);
    var endM = end.getFullYear() * 12 + end.getMonth();
    while (cur.getFullYear() * 12 + cur.getMonth() <= endM) {
      cb(cur);
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
  }
  function eachWeek(start, end, cb) {
    for (var m = mondayOf(start); m <= end; m = addDays(m, 7)) cb(m);
  }
  function eachDayInWeek(m, start, end, cb) {
    for (var i = 0; i < 7; i++) {
      var d = addDays(m, i);
      if (d >= start && d <= end) cb(d);
    }
  }

  // ---- per-type renderers (non-duplex): append pages to mount, return count ----

  function renderDaily(start, end, mount) {
    var n = 0;
    for (var d = new Date(start); d <= end; d = addDays(d, 1)) { mount.appendChild(buildDailyPage(d)); n++; }
    return n;
  }
  function renderWeekly(start, end, mount) {
    var n = 0;
    eachWeek(start, end, function (m) { buildWeeklySpread(m).forEach(function (p) { mount.appendChild(p); }); n++; });
    return n;
  }
  function renderMonthly(start, end, mount) {
    var n = 0;
    eachMonth(start, end, function (cur) { buildMonthlySpread(cur).forEach(function (p) { mount.appendChild(p); }); n++; });
    return n;
  }

  function renderInserts(inserts, mount, skip) {
    if (!inserts) return;
    INSERT_KEYS.forEach(function (key) {
      if (skip && skip[key]) return;
      var n = inserts[key] || 0;
      for (var i = 0; i < n; i++) {
        mount.appendChild(buildInsert(key));
      }
    });
  }

  function fillMonth(frag, monthDate) {
    var y = monthDate.getFullYear(), m = monthDate.getMonth();
    frag.querySelector('.js-month').textContent = MONTHS[m] + ' ' + y;

    var startCol = (new Date(y, m, 1).getDay() + 6) % 7;   // 0 = Mon .. 6 = Sun
    var daysIn = new Date(y, m + 1, 0).getDate();
    var grid = new Array(42).fill(null);
    for (var d = 1; d <= daysIn; d++) { grid[startCol + d - 1] = d; }

    var left = frag.querySelectorAll('.left .cal .cell');   // 6 rows x 4 cols (Mon-Thu)
    var right = frag.querySelectorAll('.right .cal .cell');  // 6 rows x 3 cols (Fri-Sun)
    for (var r = 0; r < 6; r++) {
      for (var c = 0; c < 4; c++) setCell(left[r * 4 + c], grid[r * 7 + c]);
      for (var c2 = 0; c2 < 3; c2++) setCell(right[r * 3 + c2], grid[r * 7 + 4 + c2]);
    }
  }

  function setCell(cell, val) {
    if (!cell) return;
    var n = cell.querySelector('.daynum');
    if (val == null) {
      cell.classList.add('blank');
      if (n) n.textContent = '';
    } else if (n) {
      n.textContent = val;
    }
  }

  // ---- orchestration ----

  var INSERT_KEYS = ['st-sheet', 'st-key', 'st-tree', 'st-loot', 'st-quest',
                     'brain-dump', 'collections', 'sketch', 'expense-log', 'future-log', 'project', 'grid', 'dot-grid'];

  // ---- Skill Tree journal ----

  var BRANCH_SETS = {
    life: ['Body', 'Mind', 'Craft', 'Bonds', 'Home & Money'],
    fantasy: ['Vitality', 'Arcana', 'Artisan', 'Fellowship', 'Fortune']
  };
  var ST_SKILLS = 3;    // skills per branch
  var ST_TIERS = 5;     // tree tiers; tier t holds t bubbles (15 per branch)
  var stState = { set: 'life', custom: ['', '', '', '', ''] };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function repeat(str, n) { return new Array(n + 1).join(str); }

  function getBranches() {
    if (stState.set === 'custom') {
      return stState.custom.map(function (n, i) { return (n || '').trim() || 'Branch ' + (i + 1); });
    }
    return BRANCH_SETS[stState.set] || BRANCH_SETS.life;
  }
  function skillCode(b, s) { return 'ABCDE'.charAt(b) + (s + 1); }

  function fillStSheet(page) {
    var html = '';
    getBranches().forEach(function (name, i) {
      html += '<div class="st-stat"><span class="st-ic" data-i="' + (i % 5) + '"></span>' +
              '<div class="st-stat-main"><span class="st-stat-name">' + esc(name) + '</span>' +
              '<div class="st-stat-focus"><span>Focus</span><i></i></div></div>' +
              '<span class="st-stat-lv">Lv</span><div class="st-stat-box"></div></div>';
    });
    page.querySelector('.st-stats').innerHTML = html;
  }

  function fillStKey(page) {
    var html = '';
    getBranches().forEach(function (name, b) {
      html += '<div class="st-key-branch"><div class="st-key-name">' + esc(name) + '</div>';
      for (var s = 0; s < ST_SKILLS; s++) {
        html += '<div class="st-key-row"><span class="st-code">' + skillCode(b, s) + '</span>' +
                '<div class="st-key-line"></div><span class="st-xp">xp</span></div>';
      }
      html += '</div>';
    });
    page.querySelector('.st-key-body').innerHTML = html;
  }

  function fillStTree(page) {
    var html = '';
    getBranches().forEach(function (name) {
      html += '<div class="st-col"><div class="st-trunk">';
      for (var t = 1; t <= ST_TIERS; t++) {
        html += '<div class="st-tier">' + repeat('<i class="st-bub"></i>', t) + '</div>';
      }
      html += '</div><div class="st-col-name">' + esc(name) + '</div></div>';
    });
    page.querySelector('.st-tree-body').innerHTML = html;
  }

  function fillStLoot(page) {
    var html = '';
    for (var lv = 1; lv <= 10; lv++) {
      html += '<div class="st-loot-row"><span class="st-loot-lv">' + lv + '</span>' +
              '<div class="st-loot-line"></div><span class="st-loot-chk">&#9744;</span></div>';
    }
    page.querySelector('.st-loot-rows').innerHTML = html;
  }

  function fillStQuest(page) {
    var html = '';
    for (var i = 0; i < 7; i++) {
      html += '<div class="st-quest-row">' +
              '<div class="st-q-top"><span class="st-loot-chk">&#9744;</span><div class="st-loot-line"></div></div>' +
              '<div class="st-q-sub"><span>Reward</span><div class="st-loot-line"></div><span>Due</span><div class="st-loot-line st-q-due"></div></div>' +
              '</div>';
    }
    page.querySelector('.st-quest-rows').innerHTML = html;
  }

  // One squares grid covering days [from, to]. `cols` is the fixed column count so a
  // short final half (days 17-31 = 15 days) keeps the same cell width as the first.
  function buildStSquaresPage(monthDate, from, to, cols) {
    var f = clone('st-squares');
    f.querySelector('.js-month').textContent = MONTHS[monthDate.getMonth()] + ' ' + monthDate.getFullYear();
    var daysIn = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    from = from || 1; to = to || 31; cols = cols || 31;
    var page = f.querySelector('.page');
    var grid = f.querySelector('.st-sq-grid');
    grid.style.setProperty('--sq-cols', cols);
    var html = '<div class="sq-cell sq-corner"></div>';
    for (var d = from; d < from + cols; d++) {
      var off = d > daysIn || d > to;
      html += '<div class="sq-cell sq-day' + (off ? ' blank' : '') + '">' + (off ? '' : d) + '</div>';
    }
    getBranches().forEach(function (name, b) {
      html += '<div class="sq-branch">' + esc(name) + '</div>';
      for (var s = 0; s < ST_SKILLS; s++) {
        html += '<div class="sq-cell sq-code">' + skillCode(b, s) + '</div>';
        for (var d2 = from; d2 < from + cols; d2++) html += '<div class="sq-cell' + (d2 > daysIn || d2 > to ? ' blank' : '') + '"></div>';
      }
    });
    grid.innerHTML = html;
    if (cols < 31) page.classList.add('sq-half');
    return page;
  }
  function isMiniOut() {
    var el = document.getElementById('outsize');
    return !!el && el.value === 'Mini';
  }
  // Mini squares are a verso/recto spread (days 1-16 | 17-31) — 31 columns on a
  // 81 mm page are unreadable. Other sizes stay a single page.
  function buildStSquaresItem(monthDate) {
    if (!isMiniOut()) return { single: buildStSquaresPage(monthDate) };
    return { spread: [buildStSquaresPage(monthDate, 1, 16, 16), buildStSquaresPage(monthDate, 17, 31, 16)] };
  }
  function renderStSquares(start, end, mount) {
    var n = 0;
    eachMonth(start, end, function (cur) {
      var it = buildStSquaresItem(cur);
      (it.spread || [it.single]).forEach(function (p) { mount.appendChild(p); });
      n++;
    });
    return n;
  }

  function buildStMonthEndPage(monthDate) {
    var f = clone('st-month-end');
    f.querySelector('.js-month').textContent = MONTHS[monthDate.getMonth()] + ' ' + monthDate.getFullYear();
    var html = '';
    getBranches().forEach(function (name, i) {
      html += '<div class="st-me-row"><span class="st-me-name"><span class="st-ic" data-i="' + (i % 5) + '"></span>' + esc(name) + '</span>' +
              '<div class="st-stat-box"></div><div class="st-stat-box"></div></div>';
    });
    f.querySelector('.st-me-rows').innerHTML = html;
    return f.querySelector('.page');
  }
  function renderStMonthEnd(start, end, mount) {
    var n = 0;
    eachMonth(start, end, function (cur) { mount.appendChild(buildStMonthEndPage(cur)); n++; });
    return n;
  }

  // ---- Instruction pages ----
  // Everything here is built from what is actually switched on: a page type (or insert)
  // that isn't in the book never appears in the instructions.
  var SKILL_IDEAS = [
    ['Walk 10 minutes', 'Stretch or mobility', 'Drink 2 L of water', 'Lights out by 11', 'Strength workout'],
    ['Read 10 pages', 'Meditate 5 minutes', 'Language lesson', 'Journal one page', 'No phone first hour'],
    ['Practice an instrument', 'Write 200 words', 'Sketch something', 'Side project 30 min', 'Course lesson'],
    ['Text or call someone', 'Device-free meal', 'Thank someone', 'Quality time', 'Write a note'],
    ['10-minute tidy', 'Log spending', 'Cook at home', 'Move money to savings', 'One admin task']
  ];
  var guideFillers = false;   // set by generate(): fillers only exist in 4-up books

  function guideCtx(types, inserts) {
    return {
      has: function (t) { return types.indexOf(t) !== -1; },
      n: function (k) { return (inserts && inserts[k]) || 0; },
      mini: isMiniOut()
    };
  }
  function listPage(tplId, items) {
    var page = clone(tplId).querySelector('.page');
    page.querySelector('.gd-list').innerHTML = items.map(function (t) { return '<li>' + t + '</li>'; }).join('');
    return page;
  }
  // Pair pages into verso|recto spreads; a trailing odd page stays single.
  function pagesToItems(pages) {
    var out = [];
    for (var i = 0; i < pages.length; i += 2) {
      out.push(pages[i + 1] ? { spread: [pages[i], pages[i + 1]] } : { single: pages[i] });
    }
    return out;
  }
  // Greedy split of entries into pages by text length (entries are never cut).
  function paginate(entries, cap) {
    var pages = [[]], used = 0;
    entries.forEach(function (e) {
      var len = e.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '-').length;
      if (used + len > cap && pages[pages.length - 1].length) { pages.push([]); used = 0; }
      pages[pages.length - 1].push(e);
      used += len;
    });
    return pages;
  }

  // Approximate characters per instruction page, by output size (text is 5.6-7.5pt).
  function guideCap(kind) {
    var el = document.getElementById('outsize'), size = el ? el.value : 'Mini';
    var caps = { Mini: { play: 1650, pages: 950 }, A6: { play: 1300, pages: 800 } };
    return (caps[size] || { play: 3000, pages: 1500 })[kind];
  }

  function skillGuideItems(types, inserts) {
    var c = guideCtx(types, inserts);
    var sheet = c.n('st-sheet'), key = c.n('st-key'), tree = c.n('st-tree'), loot = c.n('st-loot'), quest = c.n('st-quest');
    var sq = c.has('st-squares'), me = c.has('st-month-end');
    if (!(sheet || key || tree || loot || quest || sq || me)) return [];
    var steps = [];
    if (sheet) steps.push('<b>Your Character Sheet.</b> Name your hero and write your Why. Under each stat, note the skill you&rsquo;re focusing on. Update Level and Total XP ' + (me ? 'at Month&rsquo;s End.' : 'as you grow.'));
    if (key || sq) steps.push('<b>Pick your skills.</b> ' + (key ? 'On the Skill Key, name' : 'Name') + ' up to 3 skills per branch. Small and specific beats big: &ldquo;read 10 pages,&rdquo; not &ldquo;read more.&rdquo; Rate each skill&rsquo;s XP: 1 easy, 2 steady, 3 hard.');
    if (sq) steps.push('<b>Fill a square.</b> Each day you do a skill, fill its square on Skill Squares. A tiny version still counts. A missed day costs nothing &mdash; progress never resets.');
    if (me) steps.push('<b>Month&rsquo;s End.</b> ' + (sq ? 'Count squares per branch. Squares &times; skill XP = branch XP.' : 'Tally each branch&rsquo;s XP: days practiced &times; skill XP.') + (quest ? ' Add bonus XP from finished quests.' : '') + ' Write the totals on Month&rsquo;s End' + (sheet ? ' and your Character Sheet.' : '.'));
    if (tree) steps.push('<b>Grow the tree.</b> Every 20 XP in a branch fills one bubble (top tier first). Every 7 bubbles across the whole tree = 1 level, so Level 10 is 70 bubbles &mdash; about a season of play.');
    if (loot) steps.push('<b>Claim loot.</b> Fill the Loot Table <i>before</i> you start: small rewards early, big ones later. Tick a reward when you reach its level.');
    if (quest) {
      steps.push('<b>Quests are side missions, not habits.</b> Write the quest, the <i>why</i>, the reward and a due date. Keep 3&ndash;5 open. Bonus XP on finish: 10 small, 25 medium, 50 epic, added to the branch it trained.');
      steps.push('<b>Name the monster.</b> A fear or obstacle you&rsquo;ve been dodging makes a great quest. Break it into sub-quests, and note who or what you&rsquo;ll need (a partner, a book, a tool).');
    }
    if (sheet) steps.push('<b>Name your chapter.</b> Use the Season line on the Character Sheet for the stage of life you&rsquo;re in, such as &ldquo;The Reset&rdquo; or &ldquo;Year of the Garden.&rdquo; Change it when life does.');
    if (sq || me) {
      var carry = [tree ? 'tree' : '', sheet ? 'sheet' : '', loot ? 'loot' : ''].filter(Boolean).join(', ').replace(/, ([^,]*)$/, ' and $1');
      steps.push('<b>Next month.</b> Keep a skill if it&rsquo;s still a stretch; swap it if it&rsquo;s automatic or ignored. Squares start fresh each month.' + (carry ? ' The ' + carry + ' carry over.' : ''));
    }
    var pages = paginate(steps, guideCap('play')).map(function (entries, i) {
      var page = listPage('st-guide-play', entries);
      if (i) page.querySelector('.title').lastChild.textContent = ' How to Play (cont.)';
      return page;
    });
    if (key || sq) {
      var ideas = clone('st-guide-ideas').querySelector('.page');
      var custom = stState.set === 'custom';
      var html = '';
      getBranches().forEach(function (name, b) {
        html += '<div class="gd-branch"><div class="gd-bname">' + esc(name) + '</div>';
        if (custom) html += '<div class="gd-blank"></div><div class="gd-blank"></div>';
        else html += '<ul>' + SKILL_IDEAS[b].map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>';
        html += '</div>';
      });
      ideas.querySelector('.gd-ideas').innerHTML = html;
      pages.push(ideas);
    }
    return pagesToItems(pages);
  }

  var INSERT_HELP = {
    'brain-dump': '<b>Brain Dump.</b> Empty your head before you plan: tasks, worries and ideas in any order. Circle what matters and move it into the week.',
    'collections': '<b>Collections.</b> Numbered running lists that grow over time: books to read, movies, gift ideas, places to go.',
    'sketch': '<b>Sketch.</b> A free box for doodles, floor plans and rough layouts.',
    'expense-log': '<b>Expense Log.</b> Date, description, amount. Total each page when it&rsquo;s full and carry the total forward.',
    'future-log': '<b>Future Log.</b> Six boxes for upcoming months. Write the month on each, then drop in dates, deadlines and ideas. Move them to the Monthly page when the month arrives.',
    'project': '<b>Project.</b> Name it, state the goal and deadline, then break it into numbered steps. Pull one step at a time into your weekly Top 3.',
    'grid': '<b>Grid.</b> Square-ruled space for tables, charts and diagrams.',
    'dot-grid': '<b>Dot Grid.</b> Dotted space for layouts, mind maps and lettering.'
  };
  var FILLER_HELP = {
    'grid': 'Grid (tables, charts, diagrams)',
    'dot-grid': 'Dot Grid (layouts, mind maps, lettering)',
    'collections': 'Collections (running lists)',
    'brain-dump': 'Brain Dump (empty your head)',
    'sketch': 'Sketch (doodles, rough ideas)'
  };
  function fillerEntry(c) {
    if (!guideFillers) return null;
    var t = fillerType();
    var intro = '<b>Bonus pages.</b> Leftover pages that keep spreads facing and finish the last sheet ';
    if (t === 'blank') return intro + 'are blank. Use them for anything: notes, doodles, a messy list. Nothing here is required.';
    if (t !== 'random') return intro + 'are ' + (FILLER_HELP[t] || t).replace(/ \(/, ' pages (') + '. Use them freely.';
    var mix = ['grid', 'dot-grid', 'collections'];
    if (!c.n('st-sheet')) mix.push('brain-dump');
    return intro + 'are a rotating mix: ' + mix.map(function (k) { return FILLER_HELP[k]; }).join(', ').replace(/, ([^,]*)$/, ' and $1') + '. Use them freely.';
  }

  function plannerGuideItems(types, inserts) {
    var c = guideCtx(types, inserts), has = c.has, mini = c.mini;
    var PLANNER_TYPES = ['monthly', 'weekly', 'daily', 'thanks', 'habit-tracker', 'one-line', 'mood-tracker', 'weekly-review'];
    var hasPlanner = PLANNER_TYPES.some(has);
    var how = [];
    if (hasPlanner) {
      how.push('<b>Zoom in, zoom out.</b> The month sets the direction, the week makes the plan, the day gets it done. Each level feeds the next: monthly goals, then the weekly Top 3, then the daily priorities.');
      if (has('weekly') || has('daily') || has('monthly')) {
        how.push('<b>Book order.</b> Pages follow the calendar: the month pages come first, then each week, followed by that week&rsquo;s days. Just keep turning forward.');
      }
      var facing = [];
      if (has('monthly')) facing.push('a month opens Mon&ndash;Thu on the left and Fri&ndash;Sun with Goals and Notes on the right');
      if (has('weekly')) facing.push('a week opens the same way, with Notes under the weekend');
      if (has('thanks') && has('daily')) facing.push('on any day, Thankfulness is on the left and the Daily page is on the right');
      if (facing.length) { var ft = facing.join('; '); how.push('<b>Facing pages.</b> ' + ft.charAt(0).toUpperCase() + ft.slice(1) + '.'); }
      if (has('weekly')) how.push('<b>Sunday reset (5 min).</b> Look back over the week, carry forward anything unfinished, and choose next week&rsquo;s Top 3. Write plans in the day blocks as they come up.');
      if (has('daily')) how.push('<b>Daily rhythm.</b> Morning: pick your priorities' + (has('weekly') ? ' from the week&rsquo;s Top 3' : '') + ' and fill the to-do list. ' + (has('thanks') ? 'Evening: write your gratitude.' : 'Evening: look at what got done.') + ' Move leftovers to tomorrow or drop them.');
      how.push('<b>Missed a day?</b> Skip it. Don&rsquo;t backfill; start fresh on today&rsquo;s page. A blank page isn&rsquo;t a failure.');
    }
    how.push('<b>Binding.</b> After printing double-sided and cutting along the dashed lines, punch the holes at the grey guide dots.');

    var pg = [];
    if (has('monthly')) pg.push('<b>Monthly.</b> The big picture. Put deadlines, trips and appointments on the calendar, write up to three Goals, and keep Notes for ideas you&rsquo;ll come back to.');
    if (has('weekly')) pg.push('<b>Weekly.</b> Choose a Top 3 for the week, then give each day a few words. The weekend and Notes are on the facing page.');
    if (has('daily')) {
      pg.push(mini
        ? '<b>Daily.</b> Pick your Top 3, then list to-dos. Each to-do gets two lines: a checkbox line and a line for details. Finish with a One-Line Win.'
        : '<b>Daily.</b> Pick your Top 5, list to-dos, and sketch the day in Morning, Afternoon and Night. Close with Self Reflection.');
    }
    if (has('thanks')) pg.push('<b>Thankfulness.</b> Three things you&rsquo;re grateful for and one intention for the day. Small and specific works best: &ldquo;the warm mug,&rdquo; not &ldquo;my life.&rdquo;');
    if (has('habit-tracker')) pg.push('<b>Habit Tracker.</b> Name up to seven habits across the top and tick a box each day. Aim for streaks, and don&rsquo;t let one miss end one.');
    if (has('one-line')) pg.push('<b>One Line a Day.</b> One sentence per day: what happened, not how you felt about it. Read the month back at the end.');
    if (has('mood-tracker')) pg.push('<b>Mood Tracker.</b> Choose a colour for each mood in the legend, then colour one box a day. Patterns appear by month&rsquo;s end.');
    if (has('weekly-review')) pg.push('<b>Weekly Review.</b> What went well, what to improve, next week&rsquo;s focus. Use the answers to write the next Top 3.');
    if (has('st-squares') || has('st-month-end')) pg.push('<b>Skill Squares &amp; Month&rsquo;s End.</b> The game layer. See How to Play at the front of the book.');
    INSERT_KEYS.forEach(function (k) { if (INSERT_HELP[k] && c.n(k) > 0) pg.push(INSERT_HELP[k]); });
    var fe = fillerEntry(c);
    if (fe) pg.push(fe);

    var pages = [];
    if (hasPlanner) pages.push(listPage('pl-guide-how', how));
    var cap = guideCap('pages');
    if (pg.length) {
      paginate(pg, cap).forEach(function (entries, i) {
        var page = listPage('pl-guide-pages', entries);
        if (i) page.querySelector('.title').lastChild.textContent = ' Page by Page (cont.)';
        pages.push(page);
      });
    } else if (!hasPlanner) {
      return [];
    }
    return pagesToItems(pages);
  }

  // Inserts whose bodies depend on the selected branch set are filled after cloning.
  var INSERT_FILL = {
    'st-sheet': fillStSheet, 'st-key': fillStKey, 'st-tree': fillStTree,
    'st-loot': fillStLoot, 'st-quest': fillStQuest
  };
  function buildInsert(key) {
    var page = clone(key).querySelector('.page');
    if (INSERT_FILL[key]) INSERT_FILL[key](page);
    return page;
  }

  var INSERT_NAMES = {
    'st-sheet': 'character sheet', 'st-key': 'skill key', 'st-tree': 'skill tree',
    'st-loot': 'loot table', 'st-quest': 'quest log'
  };

  var UNIT_NAMES = {
    'st-guide': 'instruction spread', 'st-squares': 'skill square trackers', 'st-month-end': 'skill tree month-end pages',
    monthly: 'month spreads', weekly: 'week spreads', daily: 'day pages',
    thanks: 'thankfulness pages', 'habit-tracker': 'habit trackers',
    'one-line': 'one-line pages', 'mood-tracker': 'mood trackers',
    'weekly-review': 'weekly reviews'
  };

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

  function buildOneLineSpread(monthDate) {
    var daysIn = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    var label = MONTHS[monthDate.getMonth()] + ' ' + monthDate.getFullYear();
    function makePage(from, to) {
      var f = clone('one-line');
      f.querySelector('.js-month').textContent = label;
      var html = '';
      for (var d = from; d <= to; d++) {
        var bl = d > daysIn ? ' blank' : '';
        html += '<div class="ol-entry' + bl + '"><span class="ol-num">' + (d <= daysIn ? d : '') + '</span><div class="ol-line"></div></div>';
      }
      f.querySelector('.ol-entries').innerHTML = html;
      return f.querySelector('.page');
    }
    return [makePage(1, 16), makePage(17, 31)];
  }
  function renderOneLine(start, end, mount) {
    var n = 0;
    eachMonth(start, end, function (cur) { buildOneLineSpread(cur).forEach(function (p) { mount.appendChild(p); }); n++; });
    return n;
  }

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

  var RENDERERS = {
    monthly: renderMonthly, weekly: renderWeekly, daily: renderDaily,
    thanks: renderThanks, 'habit-tracker': renderHabitTracker,
    'one-line': renderOneLine, 'mood-tracker': renderMoodTracker,
    'weekly-review': renderWeeklyReview,
    'st-squares': renderStSquares, 'st-month-end': renderStMonthEnd
  };
  var ORDER = ['monthly', 'weekly', 'daily', 'thanks', 'habit-tracker', 'one-line', 'mood-tracker', 'weekly-review',
               'st-squares', 'st-month-end', 'st-guide'];

  // Build the chronological reading order for 2-sided printing:
  // leading blank (so months start on page 2), all month spreads,
  // then per week: the week spread followed by that week's day pages.
  // Builds a chronologically ordered item list with extras interleaved alongside their
  // parent cadence: monthly extras follow each month spread, weekly review follows each
  // weekly spread, and thankfulness follows each daily page within the same week loop.
  // facingLayout=true: when both daily and thanks are enabled, each day is emitted
  // as an atomic {spread: [thanks, daily]} pair.  The spread blank-insertion rule
  // (insert blank before a spread that would start at an even index) then guarantees
  // thanks always lands at an odd flat-page index (back-sheet, verso) and daily at
  // the next even index (front-sheet, recto) — regardless of how many single pages
  // (weekly-review, habit-tracker, etc.) precede them.
  // Skill Tree inserts lead the book instead of trailing it: character sheet alone on
  // the first recto, then facing spreads of Skill Key | Skill Tree and Quest Log | Loot Table.
  var FRONT_INSERTS = ['st-sheet', 'st-key', 'st-tree', 'st-quest', 'st-loot'];
  function consumedInserts() {
    var c = {};
    FRONT_INSERTS.forEach(function (k) { c[k] = true; });
    return c;
  }
  function insertItems(inserts, key) {
    var out = [];
    var n = (inserts && inserts[key]) || 0;
    for (var i = 0; i < n; i++) out.push({ single: buildInsert(key) });
    return out;
  }

  // Pair two single-page item lists into verso|recto spreads; any surplus stays single.
  function pairItems(left, right) {
    var out = [], n = Math.max(left.length, right.length);
    for (var i = 0; i < n; i++) {
      if (left[i] && right[i]) out.push({ spread: [left[i].single, right[i].single] });
      else out.push(left[i] || right[i]);
    }
    return out;
  }

  function buildChronologicalItems(types, start, end, facingLayout, inserts) {
    var items = [];
    function push(it) { items.push(it); }
    insertItems(inserts, 'st-sheet').forEach(push);
    var wantGuide = types.indexOf('st-guide') !== -1;
    if (wantGuide) skillGuideItems(types, inserts).forEach(push);
    pairItems(insertItems(inserts, 'st-key'), insertItems(inserts, 'st-tree')).forEach(push);
    pairItems(insertItems(inserts, 'st-quest'), insertItems(inserts, 'st-loot')).forEach(push);
    var counts = {};
    if (types.indexOf('st-guide') !== -1) counts['st-guide'] = 1;
    function add(type, item) { items.push(item); counts[type] = (counts[type] || 0) + 1; }
    var hasDaily  = types.indexOf('daily')  !== -1;
    var hasThanks = types.indexOf('thanks') !== -1;

    // Skill Tree month pages stay with the character sheet / quest log at the front.
    // A single-page squares grid faces its Month's End; Mini's two-page squares spread
    // is followed by Month's End on its own leaf.
    eachMonth(start, end, function (cur) {
      var sq = types.indexOf('st-squares') !== -1 ? buildStSquaresItem(cur) : null;
      var me = types.indexOf('st-month-end') !== -1 ? { single: buildStMonthEndPage(cur) } : null;
      if (sq && me && sq.single) {
        add('st-squares', { spread: [sq.single, me.single] });
      } else {
        if (sq) add('st-squares', sq);
        if (me) add('st-month-end', me);
      }
    });

    if (wantGuide) plannerGuideItems(types, inserts).forEach(push);

    eachMonth(start, end, function (cur) {
      if (types.indexOf('monthly') !== -1)       add('monthly',       { spread: buildMonthlySpread(cur) });
      if (types.indexOf('habit-tracker') !== -1) add('habit-tracker', { single: buildHabitTrackerPage(cur) });
      if (types.indexOf('one-line') !== -1)      add('one-line',      { spread: buildOneLineSpread(cur) });
      if (types.indexOf('mood-tracker') !== -1)  add('mood-tracker',  { single: buildMoodTrackerPage(cur) });
    });

    eachWeek(start, end, function (m) {
      if (types.indexOf('weekly') !== -1)  add('weekly', { spread: buildWeeklySpread(m) });
      eachDayInWeek(m, start, end, function (d) {
        if (facingLayout && hasDaily && hasThanks) {
          // Atomic verso+recto pair: spread[0]=thanks (verso), spread[1]=daily (recto).
          // The assembly ensures spread[0] always lands at an odd (back-sheet) slot.
          add('daily-pair', { spread: [buildThanksPage(d), buildDailyPage(d)] });
        } else {
          if (hasDaily)  add('daily',  { single: buildDailyPage(d) });
          if (hasThanks) add('thanks', { single: buildThanksPage(d) });
        }
      });
      // Weekly review goes after the week's day pages so the weekly spread and each
      // day-pair spread land on adjacent leaves (facing pages) without interruption.
      if (types.indexOf('weekly-review') !== -1)  add('weekly-review', { single: buildWeeklyReviewPage(m) });
    });

    return { items: items, counts: counts };
  }

  // Blanks pad before any spread that wouldn't start on a facing (even) page.
  function buildDuplexOrder(types, start, end, inserts) {
    var result = buildChronologicalItems(types, start, end, false, inserts);
    var pages = [blankPage()];   // page 1 blank → content starts on page 2
    result.items.forEach(function (it) {
      if (it.spread) {
        if (pages.length % 2 === 0) pages.push(blankPage());   // keep spread on a facing pair
        pages.push(it.spread[0], it.spread[1]);
      } else {
        pages.push(it.single);
      }
    });
    return pages;
  }

  function makeSheet(a, b) {
    var sheet = document.createElement('div');
    sheet.className = 'sheet cut';
    sheet.appendChild(slotFor(a));
    sheet.appendChild(slotFor(b));
    return sheet;
  }

  // Cut-and-stack imposition: after duplex printing, cut each landscape sheet down
  // the middle and stack the left pile over the right pile to read sequentially.
  // Assumes long-edge duplex flip. Emits sheet fronts/backs in document order.
  function layoutCutStack(mount, pages) {
    while (pages.length % 4 !== 0) pages.push(blankPage());
    var P = pages.length, H = P / 2, S = P / 4;
    for (var s = 0; s < S; s++) {
      mount.appendChild(makeSheet(pages[2 * s], pages[H + 2 * s]));         // front: left, right
      mount.appendChild(makeSheet(pages[2 * s + 1], pages[H + 2 * s + 1])); // back:  left, right
    }
  }

  function generate(types, start, end, tile, duplex, inserts) {
    guideFillers = tile === '4up';
    var mount = document.getElementById('pages');
    mount.innerHTML = '';
    document.body.classList.toggle('duplex-mode', !!duplex);
    var help = document.getElementById('assembly');
    if (help) help.hidden = !(duplex && tile === '2up');

    var hasInserts = inserts && INSERT_KEYS.some(function (k) { return (inserts[k] || 0) > 0; });

    if (types.length > 0 && (!start || !end || start > end)) {
      setStatus('Pick a start date on or before the end date.'); return;
    }
    if (!types.length && !hasInserts) { setStatus('Select at least one layout or add some inserts.'); return; }

    if (duplex) {
      if (tile === '4up') {
        // 8 pages per sheet: 4 front (recto, holes-left) + 4 back (verso, holes-right).
        // facingLayout=true generates thanks(verso) before daily(recto) per day.
        _fillerIdx = 0;
        var result4 = buildChronologicalItems(types, start, end, true, inserts);
        var flatPages = [];
        // If the book opens on a spread, page 1 (recto) is a filler. For the random mix
        // it's a brain dump so the binder opens to something useful.
        var openType = fillerType() === 'random' ? 'brain-dump' : fillerType();
        result4.items.forEach(function (it) {
          if (it.spread) {
            // Spread left page = verso → must land at odd index (back-sheet slot).
            if (flatPages.length % 2 === 0) flatPages.push(fillerPage(flatPages.length === 0 ? openType : undefined));
            it.spread.forEach(function (p) { flatPages.push(p); });
          } else {
            flatPages.push(it.single);
          }
        });
        if (hasInserts) {
          INSERT_KEYS.forEach(function (key) {
            if (consumedInserts(types)[key]) return;
            var n = inserts[key] || 0;
            for (var i = 0; i < n; i++) { flatPages.push(buildInsert(key)); }
          });
        }
        var real4 = flatPages.filter(function (p) { return !isFiller(p); }).length;
        while (flatPages.length % 8 !== 0) flatPages.push(fillerPage());
        layoutFourUpDuplex(mount, flatPages);
        var sheets4 = mount.querySelectorAll('.sheet').length / 2;
        setStatus('4-up, 2-sided: ' + real4 + ' pages across ' + sheets4 +
          ' physical sheets (8 pages/sheet). Print double-sided (long-edge flip), cut into quarters.');
        return;
      }
      var seq = buildDuplexOrder(types, start, end, inserts);
      if (hasInserts) {
        INSERT_KEYS.forEach(function (key) {
          if (consumedInserts(types)[key]) return;
          var n = inserts[key] || 0;
          for (var i = 0; i < n; i++) { seq.push(buildInsert(key)); }
        });
        while (seq.length % 2 !== 0) seq.push(blankPage());
      }
      var real = seq.filter(function (p) { return !p.classList.contains('blank-page'); }).length;
      if (tile === '2up') {
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

    var chrono = buildChronologicalItems(types, start, end, false, inserts);
    var consumed = consumedInserts(types);
    chrono.items.forEach(function (it) {
      if (it.spread) it.spread.forEach(function (p) { mount.appendChild(p); });
      else mount.appendChild(it.single);
    });
    var parts = [];
    ORDER.forEach(function (type) {
      var n = chrono.counts[type];
      if (n) parts.push(n + ' ' + (UNIT_NAMES[type] || type));
    });

    renderInserts(inserts, mount, consumed);
    if (hasInserts) {
      INSERT_KEYS.forEach(function (k) {
        var n = inserts[k] || 0;
        if (n) parts.push(n + ' ' + (INSERT_NAMES[k] || k.replace(/-/g, ' ')) + (n > 1 ? 's' : ''));
      });
    }

    var sheetNote = '';
    if (tile === '4up') {
      var pageCount = mount.querySelectorAll('.page').length;
      tileFourUp(mount);
      sheetNote = ' → ' + Math.ceil(pageCount / 4) + ' sheets (cut in quarters)';
    } else if (tile) {
      var pageCount = mount.querySelectorAll('.page').length;
      tilePages(mount);
      sheetNote = ' → ' + Math.ceil(pageCount / 2) + ' landscape sheets (cut in half)';
    }
    setStatus('Generated ' + parts.join(', ') + sheetNote + '. Use Print to save as PDF.');
  }

  function setStatus(msg) {
    var s = document.getElementById('status');
    if (s) s.textContent = msg;
  }

  var THEMES = ['theme-ocean', 'theme-blossom', 'theme-forest', 'theme-noir',
                'theme-midnight', 'theme-sunset', 'theme-lavender', 'theme-mint', 'theme-sepia', 'theme-bw', 'theme-homebrew'];
  function applyTheme(cls) {
    THEMES.forEach(function (t) { document.body.classList.remove(t); });
    if (cls) document.body.classList.add(cls);
  }

  // ---- custom theme ----
  var COLOR_VARS = [
    ['--bg', 'Page background'], ['--ink', 'Text'], ['--muted', 'Muted text'],
    ['--accent', 'Accent (rules/nums)'], ['--accent-soft', 'Labels'], ['--accent-deep', 'Header icons'],
    ['--box-bg', 'Box fill'], ['--box-border', 'Box border'],
    ['--accent-bg', 'Accent box fill'], ['--accent-border', 'Accent box border'],
    ['--line', 'Guide lines'], ['--line-solid', 'Solid rules'],
    ['--cell-border', 'Cell border'], ['--cell-num', 'Calendar text'],
    ['--daynum-border', 'Date box border'], ['--daynum-bg', 'Date box fill'],
    ['--daynum-ink', 'Date number'], ['--blank-bg', 'Blank cell fill']
  ];
  var CUSTOM_PROPS = COLOR_VARS.map(function (v) { return v[0]; })
    .concat(['--screen-bg', '--font-body', '--font-rpg', '--font-weight', '--mark', '--ornament', '--quote', '--watermark']);
  var FONTS = [
    // system
    ['Georgia, "Times New Roman", serif', 'Georgia (serif)'],
    ['"Palatino Linotype", "Book Antiqua", Palatino, serif', 'Palatino (serif)'],
    ['"Baskerville", "Palatino Linotype", serif', 'Baskerville (serif)'],
    ['"Iowan Old Style", Georgia, serif', 'Iowan (serif)'],
    ['"Segoe UI", "Helvetica Neue", Arial, sans-serif', 'Segoe UI (sans)'],
    ['"Trebuchet MS", sans-serif', 'Trebuchet (sans)'],
    ['"Courier New", monospace', 'Courier (mono)'],
    ['"Comic Sans MS", cursive', 'Comic Sans'],
    // Google serif
    ['"Playfair Display", serif', 'Playfair Display (serif)'],
    ['"Lora", serif', 'Lora (serif)'],
    ['"Merriweather", serif', 'Merriweather (serif)'],
    ['"EB Garamond", serif', 'EB Garamond (serif)'],
    ['"Cormorant Garamond", serif', 'Cormorant Garamond (serif)'],
    ['"Libre Baskerville", serif', 'Libre Baskerville (serif)'],
    ['"Crimson Text", serif', 'Crimson Text (serif)'],
    ['"PT Serif", serif', 'PT Serif (serif)'],
    ['"Cardo", serif', 'Cardo (serif)'],
    ['"Cinzel", serif', 'Cinzel (display serif)'],
    ['"Abril Fatface", serif', 'Abril Fatface (display)'],
    // Google sans
    ['"Poppins", sans-serif', 'Poppins (sans)'],
    ['"Montserrat", sans-serif', 'Montserrat (sans)'],
    ['"Nunito", sans-serif', 'Nunito (sans)'],
    ['"Raleway", sans-serif', 'Raleway (sans)'],
    ['"Quicksand", sans-serif', 'Quicksand (sans)'],
    ['"Josefin Sans", sans-serif', 'Josefin Sans (sans)'],
    ['"Work Sans", sans-serif', 'Work Sans (sans)'],
    // Google handwriting / script
    ['"Dancing Script", cursive', 'Dancing Script (script)'],
    ['"Caveat", cursive', 'Caveat (handwriting)'],
    ['"Pacifico", cursive', 'Pacifico (script)'],
    ['"Sacramento", cursive', 'Sacramento (script)'],
    ['"Great Vibes", cursive', 'Great Vibes (script)'],
    ['"Satisfy", cursive', 'Satisfy (script)'],
    ['"Shadows Into Light", cursive', 'Shadows Into Light (hand)'],
    ['"Patrick Hand", cursive', 'Patrick Hand (hand)'],
    ['"Kalam", cursive', 'Kalam (hand)'],
    ['"Indie Flower", cursive', 'Indie Flower (hand)'],
    ['"Amatic SC", cursive', 'Amatic SC (hand)'],
    ['"Special Elite", monospace', 'Special Elite (typewriter)']
  ];
  var WEIGHTS = [['300', 'Light'], ['400', 'Normal'], ['600', 'Semibold'], ['700', 'Bold']];
  var PALETTE = [
    { c: "❦", n: "floral heart" },
    { c: "✿", n: "flower" },
    { c: "❀", n: "flower blossom" },
    { c: "❁", n: "flower" },
    { c: "✾", n: "flower" },
    { c: "❋", n: "snowflake floret" },
    { c: "✤", n: "club leaf" },
    { c: "❧", n: "leaf bullet" },
    { c: "☘", n: "shamrock clover" },
    { c: "⚘", n: "flower" },
    { c: "☀", n: "sun" },
    { c: "☾", n: "moon crescent" },
    { c: "★", n: "star" },
    { c: "✦", n: "star sparkle" },
    { c: "✧", n: "star" },
    { c: "❖", n: "diamond" },
    { c: "❄", n: "snowflake" },
    { c: "☕", n: "coffee" },
    { c: "✎", n: "pencil" },
    { c: "♥", n: "heart" },
    { c: "◆", n: "diamond" },
    { c: "●", n: "circle dot" },
    { c: "✽", n: "asterisk flower" },
    { c: "♦", n: "diamond" },
    { c: "♣", n: "club" },
    { c: "♠", n: "spade" },
    { c: "⚜", n: "fleur de lis" },
    { c: "☙", n: "leaf" },
    { c: "❃", n: "snowflake" },
    { c: "✺", n: "star burst" },
    { c: "✵", n: "star" },
    { c: "☆", n: "star outline" },
    { c: "♪", n: "music note" },
    { c: "♫", n: "music notes" },
    { c: "☯", n: "yin yang" },
    { c: "✝", n: "cross" },
    { c: "☥", n: "ankh" },
    { c: "✡", n: "star of david" },
    { c: "☮", n: "peace" },
    { c: "⚓", n: "anchor" },
    { c: "⌘", n: "command" },
    { c: "❉", n: "flower" },
    { c: "❂", n: "sun star" },
    { c: "✻", n: "snowflake" },
    { c: "❈", n: "snowflake" },
    { c: "", n: "leaf" },
    { c: "", n: "seedling sprout plant" },
    { c: "", n: "tree" },
    { c: "", n: "tree city" },
    { c: "", n: "cannabis" },
    { c: "", n: "spa flower" },
    { c: "", n: "holly berry" },
    { c: "", n: "clover luck" },
    { c: "", n: "plant wilt" },
    { c: "", n: "lemon" },
    { c: "", n: "apple fruit" },
    { c: "", n: "carrot" },
    { c: "", n: "pepper hot chili" },
    { c: "", n: "wheat grain" },
    { c: "", n: "sun" },
    { c: "", n: "moon" },
    { c: "", n: "cloud" },
    { c: "", n: "cloud sun" },
    { c: "", n: "cloud moon" },
    { c: "", n: "cloud rain" },
    { c: "", n: "cloud showers heavy" },
    { c: "", n: "cloud bolt storm" },
    { c: "", n: "snowflake" },
    { c: "", n: "icicles ice" },
    { c: "", n: "rainbow" },
    { c: "", n: "umbrella" },
    { c: "", n: "wind" },
    { c: "", n: "tornado" },
    { c: "", n: "hurricane" },
    { c: "", n: "bolt lightning" },
    { c: "", n: "meteor" },
    { c: "", n: "temperature high hot" },
    { c: "", n: "temperature low cold" },
    { c: "", n: "smog fog" },
    { c: "", n: "earth americas globe" },
    { c: "", n: "earth africa" },
    { c: "", n: "earth asia" },
    { c: "", n: "earth europe" },
    { c: "", n: "globe world" },
    { c: "", n: "satellite" },
    { c: "", n: "satellite dish" },
    { c: "", n: "star of life" },
    { c: "", n: "atom science" },
    { c: "", n: "fire flame" },
    { c: "", n: "fire flame curved" },
    { c: "", n: "volcano" },
    { c: "", n: "water" },
    { c: "", n: "droplet water" },
    { c: "", n: "faucet drip" },
    { c: "", n: "bottle water" },
    { c: "", n: "sink" },
    { c: "", n: "bomb" },
    { c: "", n: "explosion" },
    { c: "", n: "bacon" },
    { c: "", n: "egg" },
    { c: "", n: "cheese" },
    { c: "", n: "drumstick chicken" },
    { c: "", n: "bread slice" },
    { c: "", n: "hotdog" },
    { c: "", n: "fish" },
    { c: "", n: "fish fins" },
    { c: "", n: "shrimp" },
    { c: "", n: "bowl rice" },
    { c: "", n: "bowl food" },
    { c: "", n: "plate wheat" },
    { c: "", n: "ice cream" },
    { c: "", n: "cake birthday" },
    { c: "", n: "cookie" },
    { c: "", n: "candy cane" },
    { c: "", n: "stroopwafel" },
    { c: "", n: "pizza" },
    { c: "", n: "burger" },
    { c: "", n: "utensils fork" },
    { c: "", n: "mug hot coffee" },
    { c: "", n: "coffee mug" },
    { c: "", n: "wine glass" },
    { c: "", n: "wine bottle" },
    { c: "", n: "whiskey glass" },
    { c: "", n: "martini cocktail" },
    { c: "", n: "beer mug" },
    { c: "", n: "champagne cheers" },
    { c: "", n: "concierge bell" },
    { c: "", n: "music note" },
    { c: "", n: "guitar" },
    { c: "", n: "drum" },
    { c: "", n: "headphones" },
    { c: "", n: "microphone" },
    { c: "", n: "guitar electric" },
    { c: "", n: "palette paint" },
    { c: "", n: "paintbrush" },
    { c: "", n: "paint roller" },
    { c: "", n: "film" },
    { c: "", n: "image photo" },
    { c: "", n: "clapperboard movie" },
    { c: "", n: "camera" },
    { c: "", n: "camera retro" },
    { c: "", n: "play" },
    { c: "", n: "book" },
    { c: "", n: "book open" },
    { c: "", n: "scroll" },
    { c: "", n: "bookmark" },
    { c: "", n: "newspaper" },
    { c: "", n: "pen" },
    { c: "", n: "pen nib" },
    { c: "", n: "pen fancy" },
    { c: "", n: "pencil" },
    { c: "", n: "paperclip" },
    { c: "", n: "thumbtack pin" },
    { c: "", n: "scissors cut" },
    { c: "", n: "sticky note" },
    { c: "", n: "flag" },
    { c: "", n: "flag checkered" },
    { c: "", n: "lightbulb idea" },
    { c: "", n: "bell" },
    { c: "", n: "clock time" },
    { c: "", n: "hourglass" },
    { c: "", n: "calendar" },
    { c: "", n: "calendar days" },
    { c: "", n: "key" },
    { c: "", n: "lock" },
    { c: "", n: "unlock" },
    { c: "", n: "handshake" },
    { c: "", n: "gift present" },
    { c: "", n: "trophy" },
    { c: "", n: "medal" },
    { c: "", n: "award" },
    { c: "", n: "certificate" },
    { c: "", n: "crown" },
    { c: "", n: "gem diamond" },
    { c: "", n: "ring" },
    { c: "", n: "heart love" },
    { c: "", n: "heart pulse" },
    { c: "", n: "heart crack" },
    { c: "", n: "star" },
    { c: "", n: "star half" },
    { c: "", n: "circle" },
    { c: "", n: "square" },
    { c: "", n: "asterisk" },
    { c: "", n: "check" },
    { c: "", n: "circle check" },
    { c: "", n: "thumbs up" },
    { c: "", n: "thumbs down" },
    { c: "", n: "face smile" },
    { c: "", n: "face laugh" },
    { c: "", n: "face grin" },
    { c: "", n: "face sad tear" },
    { c: "", n: "face angry" },
    { c: "", n: "face surprise" },
    { c: "", n: "hand peace" },
    { c: "", n: "hand spock" },
    { c: "", n: "hands clapping" },
    { c: "", n: "hands praying" },
    { c: "", n: "hand holding heart" },
    { c: "", n: "hand" },
    { c: "", n: "hand fist" },
    { c: "", n: "compass" },
    { c: "", n: "map" },
    { c: "", n: "map pin" },
    { c: "", n: "location dot" },
    { c: "", n: "location arrow" },
    { c: "", n: "mountain" },
    { c: "", n: "mountain sun" },
    { c: "", n: "umbrella beach" },
    { c: "", n: "campground tent" },
    { c: "", n: "hiking" },
    { c: "", n: "bicycle bike" },
    { c: "", n: "car" },
    { c: "", n: "car side" },
    { c: "", n: "truck" },
    { c: "", n: "motorcycle" },
    { c: "", n: "bus" },
    { c: "", n: "train" },
    { c: "", n: "subway" },
    { c: "", n: "tram" },
    { c: "", n: "taxi" },
    { c: "", n: "plane" },
    { c: "", n: "plane departure" },
    { c: "", n: "jet fighter" },
    { c: "", n: "helicopter" },
    { c: "", n: "rocket" },
    { c: "", n: "ship boat" },
    { c: "", n: "sailboat" },
    { c: "", n: "anchor" },
    { c: "", n: "gas pump" },
    { c: "", n: "traffic light" },
    { c: "", n: "road" },
    { c: "", n: "gauge" },
    { c: "", n: "astronaut" },
    { c: "", n: "hat wizard magic" },
    { c: "", n: "wand magic sparkles" },
    { c: "", n: "wand sparkles" },
    { c: "", n: "dragon" },
    { c: "", n: "dungeon" },
    { c: "", n: "jedi" },
    { c: "", n: "skull crossbones" },
    { c: "", n: "skull" },
    { c: "", n: "ghost" },
    { c: "", n: "spider" },
    { c: "", n: "bug" },
    { c: "", n: "snowman" },
    { c: "", n: "dice game" },
    { c: "", n: "dice d20 rpg" },
    { c: "", n: "dice d6" },
    { c: "", n: "chess" },
    { c: "", n: "chess king" },
    { c: "", n: "chess queen" },
    { c: "", n: "chess rook" },
    { c: "", n: "chess knight" },
    { c: "", n: "puzzle piece" },
    { c: "", n: "gamepad" },
    { c: "", n: "soccer futbol" },
    { c: "", n: "basketball" },
    { c: "", n: "baseball" },
    { c: "", n: "football" },
    { c: "", n: "volleyball" },
    { c: "", n: "golf" },
    { c: "", n: "dumbbell" },
    { c: "", n: "weight" },
    { c: "", n: "paw" },
    { c: "", n: "cat" },
    { c: "", n: "dog" },
    { c: "", n: "horse" },
    { c: "", n: "cow" },
    { c: "", n: "dove bird" },
    { c: "", n: "crow bird" },
    { c: "", n: "kiwi bird" },
    { c: "", n: "otter" },
    { c: "", n: "hippo" },
    { c: "", n: "frog" },
    { c: "", n: "bone" },
    { c: "", n: "feather" },
    { c: "", n: "feather pointed quill" },
    { c: "", n: "cat" },
    { c: "", n: "worm" },
    { c: "", n: "mosquito" },
    { c: "", n: "horse head" },
    { c: "", n: "hammer" },
    { c: "", n: "screwdriver" },
    { c: "", n: "wrench" },
    { c: "", n: "tools" },
    { c: "", n: "toolbox" },
    { c: "", n: "gear settings" },
    { c: "", n: "gears cogs" },
    { c: "", n: "magnet" },
    { c: "", n: "microscope" },
    { c: "", n: "flask" },
    { c: "", n: "vial" },
    { c: "", n: "dna" },
    { c: "", n: "magnifying glass search" },
    { c: "", n: "plug" },
    { c: "", n: "battery" },
    { c: "", n: "graduation cap school" },
    { c: "", n: "radiation" },
    { c: "", n: "biohazard" },
    { c: "", n: "recycle" },
    { c: "", n: "fingerprint" },
    { c: "", n: "yin yang" },
    { c: "", n: "peace" },
    { c: "", n: "star crescent islam" },
    { c: "", n: "cross christian" },
    { c: "", n: "bahai" },
    { c: "", n: "infinity" },
    { c: "", n: "star half stroke" },
    { c: "", n: "sitemap" }
  ];

  var customInputs = {}, fontSel, weightSel, markIn, ornIn, quoteIn, wmIn, lastGlyph;
  var paperIn, inkIn, accentIn, advColors;

  // ---- small colour math (hex) ----
  function hx(v) {
    v = (v || '#000000').replace('#', '');
    if (v.length === 3) v = v[0] + v[0] + v[1] + v[1] + v[2] + v[2];
    return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
  }
  function hex(rgb) {
    return '#' + rgb.map(function (n) { n = Math.max(0, Math.min(255, Math.round(n))); return ('0' + n.toString(16)).slice(-2); }).join('');
  }
  function mix(a, b, t) {   // t = weight toward b
    var A = hx(a), B = hx(b);
    return hex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
  }
  function hslHex(h, s, l) {
    h /= 360; var r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      var h2 = function (p, q, t) {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
      r = h2(p, q, h + 1 / 3); g = h2(p, q, h); b = h2(p, q, h - 1 / 3);
    }
    return hex([r * 255, g * 255, b * 255]);
  }

  // 256-color quick palette: 16 grays + 15 lightness rows × 16 hues.
  var PALETTE256 = (function () {
    var arr = [], i, r, h;
    for (i = 0; i < 16; i++) { var v = Math.round(i / 15 * 255); arr.push(hex([v, v, v])); }
    for (r = 0; r < 15; r++) {
      var L = 0.90 - r * (0.90 - 0.12) / 14;
      for (h = 0; h < 16; h++) arr.push(hslHex(h * (360 / 16), 0.68, L));
    }
    return arr;
  })();

  // ---- shared color popup (256 swatches + escape to native picker) ----
  var palettePop, popTarget, popAnchor, popOnChange;

  function ensurePalettePop() {
    if (palettePop) return palettePop;
    palettePop = mk('div', 'color-pop'); palettePop.hidden = true;
    var grid = mk('div', 'color-grid');
    PALETTE256.forEach(function (hv) {
      var b = mk('button', 'sw'); b.type = 'button'; b.style.background = hv; b.title = hv;
      b.addEventListener('click', function () { setTargetColor(hv); });
      grid.appendChild(b);
    });
    palettePop.appendChild(grid);
    var more = mk('button', 'more', 'More colors…'); more.type = 'button';
    more.addEventListener('click', function () {
      var t = popTarget; hidePalette();
      if (t) { if (t.showPicker) t.showPicker(); else t.click(); }
    });
    palettePop.appendChild(more);
    document.body.appendChild(palettePop);
    document.addEventListener('click', function (e) {
      if (!palettePop.hidden && !palettePop.contains(e.target) && e.target !== popAnchor) hidePalette();
    });
    return palettePop;
  }
  function openPalette(anchor, input, onChange) {
    ensurePalettePop();
    popTarget = input; popAnchor = anchor; popOnChange = onChange;
    var r = anchor.getBoundingClientRect();
    palettePop.style.left = (window.scrollX + r.left) + 'px';
    palettePop.style.top = (window.scrollY + r.bottom + 4) + 'px';
    palettePop.hidden = false;
  }
  function setTargetColor(hv) {
    if (popTarget) { popTarget.value = hv; if (popTarget._swatch) popTarget._swatch.style.background = hv; }
    hidePalette();
    if (popOnChange) popOnChange();
  }
  function hidePalette() { if (palettePop) palettePop.hidden = true; }

  // A color control = visible swatch (opens the 256 popup) + hidden native input (millions).
  function colorControl(onChange) {
    var wrap = mk('span', 'color-ctl');
    var input = document.createElement('input');
    input.type = 'color'; input.className = 'color-native';
    var swatch = mk('button', 'swatch'); swatch.type = 'button';
    input._swatch = swatch;
    input.addEventListener('input', function () { swatch.style.background = input.value; onChange(); });
    swatch.addEventListener('click', function (e) { e.stopPropagation(); openPalette(swatch, input, onChange); });
    wrap.appendChild(swatch); wrap.appendChild(input);
    return { wrap: wrap, input: input };
  }

  function refreshSwatches() {
    Object.keys(customInputs).forEach(function (k) {
      var inp = customInputs[k]; if (inp._swatch) inp._swatch.style.background = inp.value;
    });
    [paperIn, inkIn, accentIn].forEach(function (inp) { if (inp && inp._swatch) inp._swatch.style.background = inp.value; });
  }

  function mk(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  function simpleColor(container, label) {
    var f = mk('div', 'field');
    f.appendChild(mk('span', null, label));
    var ctl = colorControl(deriveSimple);
    f.appendChild(ctl.wrap);
    container.appendChild(f);
    return ctl.input;
  }

  // Derive a full, coherent palette from Paper + Text + Accent.
  function deriveSimple() {
    var B = paperIn.value, I = inkIn.value, A = accentIn.value;
    var set = function (k, v) { if (customInputs[k]) customInputs[k].value = v; };
    set('--bg', B);
    set('--ink', I);
    set('--accent', A);
    set('--muted', mix(I, B, 0.42));
    set('--accent-soft', mix(A, '#000000', 0.14));
    set('--accent-deep', mix(A, '#ffffff', 0.12));
    set('--box-bg', mix(B, '#ffffff', 0.55));
    set('--box-border', mix(A, B, 0.62));
    set('--accent-bg', mix(A, B, 0.86));
    set('--accent-border', mix(A, B, 0.66));
    set('--line', mix(A, B, 0.55));
    set('--line-solid', mix(A, B, 0.74));
    set('--cell-border', mix(A, B, 0.80));
    set('--cell-num', mix(I, B, 0.5));
    set('--daynum-border', mix(A, B, 0.64));
    set('--daynum-bg', mix(B, '#ffffff', 0.45));
    set('--daynum-ink', mix(A, '#000000', 0.10));
    set('--blank-bg', mix(B, A, 0.05));
    refreshSwatches();
    applyCustom();
  }

  function setActiveGlyph(inp) {
    var rows = document.querySelectorAll('.custom-panel .glyph-row');
    for (var i = 0; i < rows.length; i++) rows[i].classList.remove('active');
    if (inp && inp._row) inp._row.classList.add('active');
    lastGlyph = inp;
  }

  function refreshGlyphPreviews() {
    [markIn, ornIn, quoteIn, wmIn].forEach(function (inp) {
      if (inp && inp._preview) inp._preview.textContent = inp.value;
    });
  }

  function glyphField(panel, label) {
    var row = mk('div', 'glyph-row');
    var prev = mk('span', 'glyph-preview');
    var inp = document.createElement('input');
    inp.type = 'text'; inp.className = 'glyph-in'; inp.maxLength = 4;
    inp._preview = prev; inp._row = row;
    inp.addEventListener('input', function () { prev.textContent = inp.value; applyCustom(); });
    inp.addEventListener('focus', function () { setActiveGlyph(inp); });
    prev.addEventListener('click', function () { inp.focus(); });
    row.appendChild(prev);
    row.appendChild(mk('span', 'glyph-label', label));
    row.appendChild(inp);
    panel.appendChild(row);
    return inp;
  }

  function buildCustomPanel() {
    var panel = document.getElementById('custom-panel');
    if (!panel) return;
    panel.innerHTML = '';
    panel.appendChild(mk('h2', null, 'Custom theme'));

    var top = mk('div', 'custom-top');

    // --- Colors column ---
    var colColors = mk('div', 'col');
    colColors.appendChild(mk('h3', null, 'Colors'));
    var simple = mk('div', 'simple-colors');
    paperIn = simpleColor(simple, 'Paper');
    inkIn = simpleColor(simple, 'Text');
    accentIn = simpleColor(simple, 'Accent');
    colColors.appendChild(simple);
    var advBtn = mk('button', 'adv-toggle', 'Advanced colors ▸'); advBtn.type = 'button';
    colColors.appendChild(advBtn);
    advColors = mk('div', 'adv-colors'); advColors.hidden = true;
    COLOR_VARS.forEach(function (v) {
      var f = mk('div', 'field');
      f.appendChild(mk('span', null, v[1]));
      var ctl = colorControl(applyCustom);
      f.appendChild(ctl.wrap);
      customInputs[v[0]] = ctl.input;
      advColors.appendChild(f);
    });
    advBtn.addEventListener('click', function () {
      advColors.hidden = !advColors.hidden;
      advBtn.textContent = advColors.hidden ? 'Advanced colors ▸' : 'Advanced colors ▾';
    });
    top.appendChild(colColors);

    // --- Typography column ---
    var colType = mk('div', 'col');
    colType.appendChild(mk('h3', null, 'Typography'));
    var ff = mk('div', 'field'); ff.appendChild(mk('span', null, 'Font'));
    fontSel = document.createElement('select');
    FONTS.forEach(function (fo) { var o = document.createElement('option'); o.value = fo[0]; o.textContent = fo[1]; fontSel.appendChild(o); });
    fontSel.addEventListener('change', applyCustom); ff.appendChild(fontSel); colType.appendChild(ff);
    var wf = mk('div', 'field'); wf.appendChild(mk('span', null, 'Weight'));
    weightSel = document.createElement('select');
    WEIGHTS.forEach(function (w) { var o = document.createElement('option'); o.value = w[0]; o.textContent = w[1]; weightSel.appendChild(o); });
    weightSel.addEventListener('change', applyCustom); wf.appendChild(weightSel); colType.appendChild(wf);
    top.appendChild(colType);

    // --- Glyphs column ---
    var colGlyph = mk('div', 'col col-glyphs');
    colGlyph.appendChild(mk('h3', null, 'Glyphs'));
    markIn = glyphField(colGlyph, 'Header mark');
    ornIn = glyphField(colGlyph, 'Header ornament');
    quoteIn = glyphField(colGlyph, 'Quote mark');
    wmIn = glyphField(colGlyph, 'Blank-page watermark');
    setActiveGlyph(markIn);   // default palette target
    top.appendChild(colGlyph);

    panel.appendChild(top);
    panel.appendChild(advColors);   // full-width advanced grid, toggled by the button above

    panel.appendChild(mk('h3', null, 'Icon picker'));
    var filter = document.createElement('input');
    filter.type = 'text';
    filter.className = 'glyph-filter';
    filter.placeholder = 'Filter icons… (e.g. star, moon, coffee)';

    var pal = mk('div', 'palette');
    PALETTE.forEach(function (g) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = g.c;
      b.title = g.n;
      b.setAttribute('data-name', g.n);
      b.addEventListener('click', function () {
        if (!lastGlyph) setActiveGlyph(markIn);
        lastGlyph.value = g.c;
        if (lastGlyph._preview) lastGlyph._preview.textContent = g.c;
        applyCustom();
      });
      pal.appendChild(b);
    });

    filter.addEventListener('input', function () {
      var q = filter.value.trim().toLowerCase();
      for (var i = 0; i < pal.children.length; i++) {
        var name = pal.children[i].getAttribute('data-name');
        pal.children[i].style.display = (!q || name.indexOf(q) !== -1) ? '' : 'none';
      }
    });

    panel.appendChild(filter);
    panel.appendChild(pal);

    var ra = mk('div', 'row-actions');
    var rb = mk('button', 'reset', 'Reset to Cottage'); rb.type = 'button';
    rb.addEventListener('click', resetCustom);
    ra.appendChild(rb); panel.appendChild(ra);
  }

  function applyCustom() {
    var b = document.body;
    COLOR_VARS.forEach(function (v) { b.style.setProperty(v[0], customInputs[v[0]].value); });
    b.style.setProperty('--screen-bg', mix(customInputs['--bg'].value, '#000000', 0.16));
    b.style.setProperty('--font-body', fontSel.value);
    b.style.setProperty('--font-rpg', fontSel.value);
    b.style.setProperty('--font-weight', weightSel.value);
    b.style.setProperty('--mark', '"' + markIn.value + '"');
    b.style.setProperty('--ornament', '"' + ornIn.value + '"');
    b.style.setProperty('--quote', '"' + quoteIn.value + '"');
    b.style.setProperty('--watermark', '"' + wmIn.value + '"');
  }

  function clearCustomInline() {
    var b = document.body;
    CUSTOM_PROPS.forEach(function (p) { b.style.removeProperty(p); });
  }

  function toHex(v) {
    v = (v || '').trim();
    if (v.charAt(0) === '#') {
      if (v.length === 4) return '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
      return v.slice(0, 7);
    }
    var m = v.match(/rgba?\(([^)]+)\)/);
    if (m) {
      var p = m[1].split(',');
      return '#' + [0, 1, 2].map(function (i) { return ('0' + (parseInt(p[i], 10) || 0).toString(16)).slice(-2); }).join('');
    }
    return null;
  }

  function seedCustom() {
    var cs = getComputedStyle(document.body);
    COLOR_VARS.forEach(function (v) { var h = toHex(cs.getPropertyValue(v[0])); if (h) customInputs[v[0]].value = h; });
    var fw = cs.getPropertyValue('--font-weight').trim();
    weightSel.value = ['300', '400', '600', '700'].indexOf(fw) >= 0 ? fw : '400';
    var fb = cs.getPropertyValue('--font-body').trim();
    for (var i = 0; i < fontSel.options.length; i++) { if (fontSel.options[i].value === fb) { fontSel.value = fb; break; } }
    if (!markIn.value) markIn.value = '❦';
    if (!ornIn.value) ornIn.value = '✿';
    if (!quoteIn.value) quoteIn.value = '“';
    if (!wmIn.value) wmIn.value = markIn.value;   // watermark defaults to the header mark
    // sync the simple picker to the master colours
    paperIn.value = customInputs['--bg'].value;
    inkIn.value = customInputs['--ink'].value;
    accentIn.value = customInputs['--accent'].value;
    refreshGlyphPreviews();
    refreshSwatches();
  }

  function resetCustom() {
    clearCustomInline();
    applyTheme('');       // fall back to :root (Cottage) defaults
    markIn.value = '❦'; ornIn.value = '✿'; quoteIn.value = '“'; wmIn.value = '❦';
    seedCustom();
    applyCustom();
  }

  // ---- paper / output sizing (portrait, mm) ----
  var SIZES = {
    Mini:   { w: 81,    h: 120 },
    A6:     { w: 105,   h: 148 },
    A5:     { w: 148,   h: 210 },
    A4:     { w: 210,   h: 297 },
    A3:     { w: 297,   h: 420 },
    Letter: { w: 215.9, h: 279.4 },
    Legal:  { w: 215.9, h: 355.6 }
  };
  // Single page fits a sheet only if it's no wider AND no taller (0.5mm slack).
  function fits(out, paper) { return out.w <= paper.w + 0.5 && out.h <= paper.h + 0.5; }
  // 2-up: two portrait pages side by side on a LANDSCAPE sheet (paper rotated).
  function twoUp(out, paper) { return (2 * out.w <= paper.h + 0.5) && (out.h <= paper.w + 0.5); }
  // 4-up: 2×2 grid of pages on a PORTRAIT sheet (no rotation).
  function fourUp(out, paper) { return (2 * out.w <= paper.w + 0.5) && (2 * out.h <= paper.h + 0.5); }

  function sizeStyle() {
    var el = document.getElementById('planner-sizes');
    if (!el) { el = document.createElement('style'); el.id = 'planner-sizes'; document.head.appendChild(el); }
    return el;
  }
  function applySizes(out, paper, tile) {
    if (tile === '4up') {
      // Portrait sheet holds four pages in a 2×2 grid.
      var sheetW = paper.w, sheetH = paper.h;
      var slotW = sheetW / 2, slotH = sheetH / 2;
      var fx = Math.min(slotW / out.w, 1);
      var fy = Math.min(slotH / out.h, 1);
      sizeStyle().textContent =
        '@page { size: ' + sheetW + 'mm ' + sheetH + 'mm; margin: 0; }\n' +
        '.page { width: ' + out.w + 'mm; height: ' + out.h + 'mm; }\n' +
        '.sheet { width: ' + sheetW + 'mm; height: ' + sheetH + 'mm; }\n' +
        '.sheet .slot { width: ' + slotW + 'mm; height: ' + slotH + 'mm; }\n' +
        '.sheet .slot .page { transform: scale(' + fx.toFixed(4) + ', ' + fy.toFixed(4) + '); }';
    } else if (tile) {
      // Landscape sheet holds two portrait pages side by side, each in a half-width slot.
      var sheetW = paper.h, sheetH = paper.w;   // rotated to landscape
      var slotW = sheetW / 2, slotH = sheetH;
      // Fill each slot in both dimensions (never upscale). When the page must be
      // scaled to fit, this fills the full height rather than letterboxing.
      var fx = Math.min(slotW / out.w, 1);
      var fy = Math.min(slotH / out.h, 1);
      sizeStyle().textContent =
        '@page { size: ' + sheetW + 'mm ' + sheetH + 'mm; margin: 0; }\n' +
        '.page { width: ' + out.w + 'mm; height: ' + out.h + 'mm; }\n' +
        '.sheet { width: ' + sheetW + 'mm; height: ' + sheetH + 'mm; }\n' +
        '.sheet .slot { width: ' + slotW + 'mm; height: ' + slotH + 'mm; }\n' +
        '.sheet .slot .page { transform: scale(' + fx.toFixed(4) + ', ' + fy.toFixed(4) + '); }';
    } else {
      sizeStyle().textContent =
        '@page { size: ' + paper.w + 'mm ' + paper.h + 'mm; margin: 0; }\n' +
        '.page { width: ' + out.w + 'mm; height: ' + out.h + 'mm; }\n' +
        '@media print { .page { margin: 0 auto; } }';
    }
  }

  // In tiling mode a paper is allowed based on the tiling mode chosen.
  function tileAllows(outKey, paperKey, mode) {
    if (mode === '4up') return fourUp(SIZES[outKey], SIZES[paperKey]);
    // 2-up: two pages fit on landscape paper, or same size (scaled down).
    return twoUp(SIZES[outKey], SIZES[paperKey]) || outKey === paperKey;
  }

  function validateSizes(outSel, paperSel, printBtn, note, tile) {
    var out = SIZES[outSel.value];
    document.body.classList.toggle('size-mini', outSel.value === 'Mini');
    // Disable paper options that can't hold the chosen planner size (given the mode).
    for (var i = 0; i < paperSel.options.length; i++) {
      var o = paperSel.options[i];
      o.disabled = tile ? !tileAllows(outSel.value, o.value, tile) : !fits(out, SIZES[o.value]);
    }
    if (paperSel.selectedOptions[0].disabled) {
      for (var j = 0; j < paperSel.options.length; j++) {
        if (!paperSel.options[j].disabled) { paperSel.value = paperSel.options[j].value; break; }
      }
    }
    var paper = SIZES[paperSel.value];
    var printPaper = document.getElementById('print-paper');
    if (printPaper) printPaper.textContent = paperSel.value + (tile === '2up' ? ' (landscape)' : '');
    var scaled = tile === '2up' && outSel.value === paperSel.value && !twoUp(out, paper);
    var ok = !!paper && (tile ? tileAllows(outSel.value, paperSel.value, tile) : fits(out, paper));
    applySizes(out, paper || out, tile);
    if (printBtn) printBtn.disabled = !ok;
    if (note) {
      if (ok && scaled) {
        note.textContent = 'Two ' + outSel.value + ' pages scaled onto one ' + paperSel.value + ' landscape sheet — print, then cut down the center.';
      } else if (ok && tile === '4up') {
        note.textContent = 'Four ' + outSel.value + ' pages per ' + paperSel.value + ' sheet — print, then cut into quarters.';
      } else if (ok && tile) {
        note.textContent = 'Two ' + outSel.value + ' pages per ' + paperSel.value + ' landscape sheet — print, then cut down the center.';
      } else if (ok) {
        note.textContent = outSel.value + ' planner on ' + paperSel.value + ' paper — prints at 100%, then trim.';
      } else if (tile === '4up') {
        note.textContent = 'Four ' + outSel.value + " pages won't fit these sheets — try a larger paper or turn off tiling.";
      } else if (tile) {
        note.textContent = 'Two ' + outSel.value + " pages won't fit these sheets — try a larger paper or turn off tiling.";
      } else {
        note.textContent = outSel.value + " doesn't fit on any smaller sheet — pick a larger paper size.";
      }
    }
    return ok;
  }

  function slotFor(page) {
    var s = document.createElement('div');
    s.className = 'slot';
    s.appendChild(page);
    return s;
  }

  // Wrap already-rendered .page elements two-per-sheet for landscape tiling.
  function tilePages(mount) {
    var pages = Array.prototype.slice.call(mount.querySelectorAll('.page'));
    mount.innerHTML = '';
    // Odd count: append a blank page so the last real page keeps the left slot.
    if (pages.length % 2 === 1) {
      var blank = document.createElement('div');
      blank.className = 'page blank-page';
      pages.push(blank);
    }
    for (var i = 0; i < pages.length; i += 2) {
      var sheet = document.createElement('div');
      sheet.className = 'sheet cut';
      sheet.appendChild(slotFor(pages[i]));
      sheet.appendChild(slotFor(pages[i + 1]));
      mount.appendChild(sheet);
    }
  }

  // 4-up duplex imposition for portrait ring-binder pages.
  // Long-edge flip maps printer-TL→physical-TR, printer-TR→physical-TL, etc.
  // Content is NOT pre-mirrored; the printer driver handles orientation transparently.
  // Front (recto, holes-left): [p0, p2, p4, p6] at printer TL/TR/BL/BR.
  // Back  (verso, holes-right): [p3, p1, p7, p5] at printer TL/TR/BL/BR →
  //   physical TR/TL/BR/BL, so each back slot sits behind the correct front slot.
  function layoutFourUpDuplex(mount, pages) {
    for (var i = 0; i < pages.length; i += 8) {
      var p = pages.slice(i, i + 8);
      var front = document.createElement('div');
      front.className = 'sheet cut4';
      front.appendChild(slotFor(p[0])); // printer TL → physical TL front
      front.appendChild(slotFor(p[2])); // printer TR → physical TR front
      front.appendChild(slotFor(p[4])); // printer BL → physical BL front
      front.appendChild(slotFor(p[6])); // printer BR → physical BR front
      mount.appendChild(front);

      var back = document.createElement('div');
      back.className = 'sheet cut4 duplex-back';
      back.appendChild(slotFor(p[3])); // printer TL → physical TR back (pairs with p[2])
      back.appendChild(slotFor(p[1])); // printer TR → physical TL back (pairs with p[0])
      back.appendChild(slotFor(p[7])); // printer BL → physical BR back (pairs with p[6])
      back.appendChild(slotFor(p[5])); // printer BR → physical BL back (pairs with p[4])
      mount.appendChild(back);
    }
  }

  // Wrap already-rendered .page elements four-per-sheet (2×2 grid) for portrait tiling.
  function tileFourUp(mount) {
    var pages = Array.prototype.slice.call(mount.querySelectorAll('.page'));
    mount.innerHTML = '';
    while (pages.length % 4 !== 0) pages.push(fillerPage());
    for (var i = 0; i < pages.length; i += 4) {
      var sheet = document.createElement('div');
      sheet.className = 'sheet cut4';
      for (var j = 0; j < 4; j++) sheet.appendChild(slotFor(pages[i + j]));
      mount.appendChild(sheet);
    }
  }

  function initGenerator() {
    document.addEventListener('DOMContentLoaded', function () {
      var startEl = document.getElementById('start');
      var endEl = document.getElementById('end');
      var themeEl = document.getElementById('theme');
      var outSel = document.getElementById('outsize');
      var paperSel = document.getElementById('paper');
      var printBtn = document.getElementById('print');
      var fitNote = document.getElementById('fit-note');
      var tileEl = document.getElementById('tile');
      var duplexEl = document.getElementById('duplex');
      var now = new Date();
      // Default range: next month's first Monday through its last Sunday (whole weeks).
      var nm = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      var firstMon = addDays(nm, (8 - nm.getDay()) % 7);                          // Sun=0 -> +1, Mon -> +0
      var nmLast = new Date(nm.getFullYear(), nm.getMonth() + 1, 0);
      var lastSun = addDays(nmLast, -nmLast.getDay());                             // Sun -> +0
      startEl.value = ymd(firstMon);
      endEl.value = ymd(lastSun);

      // ---- Defaults ----
      if (outSel) outSel.value = 'Mini';
      if (tileEl) tileEl.value = '4up';
      if (duplexEl) duplexEl.checked = true;
      var CHK_DEFAULTS = ['monthly', 'weekly', 'daily', 'thanks', 'st-squares', 'st-month-end', 'st-guide'];
      ORDER.forEach(function (t) {
        var el = document.getElementById('chk-' + t);
        if (el) el.checked = CHK_DEFAULTS.indexOf(t) !== -1;
      });
      var INS_DEFAULTS = { 'st-sheet': 1, 'st-key': 1, 'st-tree': 1, 'st-loot': 1, 'st-quest': 1 };
      INSERT_KEYS.forEach(function (k) {
        var el = document.getElementById('ins-' + k);
        if (el) el.value = INS_DEFAULTS[k] || 0;
      });
      var fillerEl = document.getElementById('filler-type');
      if (fillerEl) fillerEl.value = 'random';
      if (paperSel) paperSel.value = 'Letter';

      if (themeEl) {
        buildCustomPanel();
        var customPanel = document.getElementById('custom-panel');
        var onTheme = function () {
          if (themeEl.value === 'custom') {
            seedCustom();          // read the currently-active theme's values
            applyTheme('');        // drop the class
            applyCustom();         // write them inline so it looks identical, then editable
            if (customPanel) customPanel.hidden = false;
          } else {
            if (customPanel) customPanel.hidden = true;
            clearCustomInline();
            applyTheme(themeEl.value);
          }
        };
        themeEl.addEventListener('change', onTheme);
        onTheme();
      }

      var stSetEl = document.getElementById('st-set');
      var stCustomEl = document.getElementById('st-custom');
      var syncBranches = function () {
        stState.set = stSetEl ? stSetEl.value : 'life';
        if (stCustomEl) stCustomEl.hidden = stState.set !== 'custom';
        for (var i = 0; i < 5; i++) {
          var inp = document.getElementById('st-b' + i);
          if (inp) stState.custom[i] = inp.value;
        }
      };
      syncBranches();
      if (stSetEl) stSetEl.addEventListener('change', syncBranches);

      var tileOn = function () { return tileEl ? tileEl.value : ''; };
      var revalidate = function () {
        if (outSel && paperSel) validateSizes(outSel, paperSel, printBtn, fitNote, tileOn());
      };

      var run = function () {
        syncBranches();
        var types = [];
        ORDER.forEach(function (t) {
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

      if (outSel && paperSel) {
        outSel.addEventListener('change', revalidate);
        paperSel.addEventListener('change', revalidate);
      }
      if (tileEl) {
        tileEl.addEventListener('change', function () { revalidate(); run(); });
      }
      if (duplexEl) {
        duplexEl.addEventListener('change', function () { revalidate(); run(); });
      }

      revalidate();
      document.getElementById('gen').addEventListener('click', run);
      run();
    });
  }

  global.Planner = { initGenerator: initGenerator };
})(window);
