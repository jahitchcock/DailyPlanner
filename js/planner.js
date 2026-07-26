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

  var RENDERERS = { monthly: renderMonthly, weekly: renderWeekly, daily: renderDaily };
  var ORDER = ['monthly', 'weekly', 'daily'];   // overview first, then detail

  // Build the chronological reading order for 2-sided printing:
  // leading blank (so months start on page 2), all month spreads,
  // then per week: the week spread followed by that week's day pages.
  // Blanks pad before any spread that wouldn't start on a facing (even) page.
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

    var pages = [blankPage()];   // page 1 blank → content starts on page 2
    items.forEach(function (it) {
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

  function generate(types, start, end, tile, duplex) {
    var mount = document.getElementById('pages');
    mount.innerHTML = '';
    var help = document.getElementById('assembly');
    if (help) help.hidden = !(duplex && tile);
    if (!start || !end || start > end) { setStatus('Pick a start date on or before the end date.'); return; }
    if (!types.length) { setStatus('Select at least one layout.'); return; }

    if (duplex) {
      var seq = buildDuplexOrder(types, start, end);
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
      var unit = type === 'daily' ? 'day pages' : (type === 'monthly' ? 'month spreads' : 'week spreads');
      parts.push(n + ' ' + unit);
    });

    var sheetNote = '';
    if (tile) {
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
                'theme-midnight', 'theme-sunset', 'theme-lavender', 'theme-mint', 'theme-sepia', 'theme-bw'];
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
    .concat(['--screen-bg', '--font-body', '--font-weight', '--mark', '--ornament', '--quote', '--watermark']);
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

  function sizeStyle() {
    var el = document.getElementById('planner-sizes');
    if (!el) { el = document.createElement('style'); el.id = 'planner-sizes'; document.head.appendChild(el); }
    return el;
  }
  function applySizes(out, paper, tile) {
    if (tile) {
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

  // In tiling mode a paper is allowed if two pages fit at 100%, OR it's the same
  // size as the planner (we then scale the pages down to fit).
  function tileAllows(outKey, paperKey) {
    return twoUp(SIZES[outKey], SIZES[paperKey]) || outKey === paperKey;
  }

  function validateSizes(outSel, paperSel, printBtn, note, tile) {
    var out = SIZES[outSel.value];
    // Disable paper options that can't hold the chosen planner size (given the mode).
    for (var i = 0; i < paperSel.options.length; i++) {
      var o = paperSel.options[i];
      o.disabled = tile ? !tileAllows(outSel.value, o.value) : !fits(out, SIZES[o.value]);
    }
    if (paperSel.selectedOptions[0].disabled) {
      for (var j = 0; j < paperSel.options.length; j++) {
        if (!paperSel.options[j].disabled) { paperSel.value = paperSel.options[j].value; break; }
      }
    }
    var paper = SIZES[paperSel.value];
    var scaled = tile && outSel.value === paperSel.value && !twoUp(out, paper);
    var ok = !!paper && (tile ? tileAllows(outSel.value, paperSel.value) : fits(out, paper));
    applySizes(out, paper || out, tile);
    if (printBtn) printBtn.disabled = !ok;
    if (note) {
      if (ok && scaled) {
        note.textContent = 'Two ' + outSel.value + ' pages scaled onto one ' + paperSel.value + ' landscape sheet — print, then cut down the center.';
      } else if (ok && tile) {
        note.textContent = 'Two ' + outSel.value + ' pages per ' + paperSel.value + ' landscape sheet — print, then cut down the center.';
      } else if (ok) {
        note.textContent = outSel.value + ' planner on ' + paperSel.value + ' paper — prints at 100%, then trim.';
      } else if (tile) {
        note.textContent = "Two " + outSel.value + " pages won't fit these sheets — try a larger paper or turn off tiling.";
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
      startEl.value = ymd(new Date(now.getFullYear(), now.getMonth(), 1));        // 1st of this month
      endEl.value = ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0));       // last day of this month

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

      var tileOn = function () { return !!(tileEl && tileEl.checked); };
      var revalidate = function () {
        if (outSel && paperSel) validateSizes(outSel, paperSel, printBtn, fitNote, tileOn());
      };

      var run = function () {
        var types = [];
        ['daily', 'weekly', 'monthly'].forEach(function (t) {
          var box = document.getElementById('chk-' + t);
          if (box && box.checked) types.push(t);
        });
        generate(types, parse(startEl.value), parse(endEl.value), tileOn(), !!(duplexEl && duplexEl.checked));
      };

      if (outSel && paperSel) {
        outSel.addEventListener('change', revalidate);
        paperSel.addEventListener('change', revalidate);
      }
      if (tileEl) {
        // Tiling changes both the fit rule and the page grouping — revalidate then rebuild.
        tileEl.addEventListener('change', function () { revalidate(); run(); });
      }
      if (duplexEl) {
        duplexEl.addEventListener('change', run);
      }

      revalidate();
      document.getElementById('gen').addEventListener('click', run);
      run();
    });
  }

  global.Planner = { initGenerator: initGenerator };
})(window);
