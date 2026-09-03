/* ============================================================================
   Rendering
   ============================================================================ */
const el = {
  board: document.getElementById("board"),
  boardArea: document.querySelector(".board-area"),
  wheel: document.getElementById("wheel"),
  wheelArea: document.querySelector(".wheel-area"),
  trail: document.getElementById("trail"),
  preview: document.getElementById("preview"),
  levelGrid: document.getElementById("levelGrid"),
  hint: document.getElementById("hint"),
  shuffle: document.getElementById("shuffle"),
  prev: document.getElementById("prev"),
  next: document.getElementById("next"),
  guide: document.getElementById("guide"),
  guideOpen: document.getElementById("guideOpen"),
  guideClose: document.getElementById("guideClose"),
  guideBack: document.getElementById("guideBack"),
  guideTitle: document.getElementById("guideTitle"),
  menuPop: document.getElementById("menuPop"),
  scrim: document.getElementById("scrim"),
  bar: document.querySelector(".bar"),
  levelGlyph: document.getElementById("levelGlyph"),
  levelPass: document.getElementById("levelPass"),
  mute: document.getElementById("mute"),
  device: document.querySelector(".device")
};

let tileCentres = [];


function loadLevel(i) {
  game.index = (i + LEVELS.length) % LEVELS.length;
  const lv = level();
  // Every level opens blank. Going back to one you have played means you want to play it
  // again, and a board arriving part-filled with letters you cannot remember placing is
  // worse than no memory of it at all. `completed` is what remembers you finished it.
  if (game.found[lv.id] || game.hints[lv.id]) {
    delete game.found[lv.id];
    delete game.hints[lv.id];
    persist();
  }
  game.puzzle = BOARDS[game.index];
  game.wheel = scrambleWheel(lv);
  game.picked = [];
  game.verdict = null;
  game.tapMode = false;
  // Before the layout is measured, not after: the chip is a flex child of the screen, so a
  // level that newly shows one would otherwise be allocated space as though it were not
  // there, and the wheel would be pushed off the bottom by exactly the chip plus its gap.
  drawScreen();
  drawHud();
  drawPreview();
  drawLevelGrid();
  drawSayAdds();
}

function drawHud() {
  el.hint.disabled = isClear();
  // The letter, and which go at it. `pass` is 0 when the letter has only one level.
  const lv = level();
  el.levelGlyph.textContent = lv.name;
  el.levelPass.textContent = lv.pass ? bn(lv.pass) : "";
}

/**
 * Splits the screen between board and wheel. A six-row board needs far more height than a
 * two-row one, so a fixed share leaves the big levels with unreadably small cells. The board
 * asks for what its rows need, the wheel asks for what its tiles need, and when the screen
 * cannot supply both the wheel gives ground first - it has slack, a crossword does not.
 */
function allocateSpace() {
  const p = game.puzzle;
  const screenEl = document.querySelector('.screen');
  const style = getComputedStyle(screenEl);
  // Everything in the screen that is not the board or the wheel, measured rather than
  // guessed. Counting the flex gaps by hand went wrong the moment the number of children
  // changed: it under-reserved by exactly one gap, which the wheel then spent and had
  // clipped off the bottom.
  const inFlow = [...screenEl.children].filter(c => {
    if (c.hidden) return false;
    const cs = getComputedStyle(c);
    return cs.display !== 'none' && cs.position !== 'absolute' && cs.position !== 'fixed';
  });
  const rowGap = parseFloat(style.rowGap) || 0;
  const chrome = inFlow
    .filter(c => c !== el.boardArea && c !== el.wheelArea)
    .reduce((sum, c) => sum + c.getBoundingClientRect().height, 0)
    + rowGap * Math.max(0, inFlow.length - 1);
  const usable = screenEl.clientHeight
    - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
    - chrome;
  const width = screenEl.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);

  const gap = 5;
  // MIN_CELL is the glyph's floor - below it the letter would not fit. MAX_CELL used to be
  // 64, which spent spare desktop height on ever-bigger boxes; with the letter fixed at
  // GLYPH that just draws a small letter in a large square, so cells stop at the comfortable
  // size and the leftover height goes to the wheel instead.
  const MIN_CELL = GLYPH_BOX, MAX_CELL = 60;
  // Sized for the largest board in the game, not the one on screen, so the answer is the same
  // on every level. The board area then takes only the height this level's rows need.
  // Two width limits, and they answer different questions.
  //
  // `byWidest` is what the widest board in the game can take, and it used to be the only one:
  // every level was drawn at that size so the boxes never changed between levels. The cost of
  // that turns out to be one level. Of 244 boards, 50 are two columns wide, 85 are three, 10
  // are four, 71 are five, 27 are six - and exactly one is seven. So 243 levels were drawn at
  // the size a single seven-column board needed, which on a phone is 42px against a 60px tile.
  //
  // `byHere` is what this level's own columns can take. The letter inside the box is a fixed
  // 17px either way - see GLYPH - so a bigger box is more air around the same letter, never a
  // bigger letter on some levels than others. What it changes is how much of the screen the
  // board fills, and it fills it now.
  const hereCols = game.puzzle ? game.puzzle.cols : BOARD_MAX.cols;
  // An empty column on a board is not waste, and it is not a box either.
  //
  // A board can be several islands, and an island beside another is placed with a blank column
  // between them: that blank is what stops আট and আম from reading as আটআম, a four-cell run
  // with no solution. 91 of the 93 boards that have one need it for that. But separating two
  // islands takes a gap, not a whole box, and it was being given a whole box - so a six-column
  // board with one blank was drawing six 50px boxes where it needed five boxes and a gutter.
  const hereGaps = game.puzzle ? emptyColumns(game.puzzle) : 0;
  const hereBoxes = hereCols - hereGaps;
  const byWidest = Math.floor((width - gap * (BOARD_MAX.cols - 1)) / BOARD_MAX.cols);
  const byHere = Math.floor((width - gap * (hereCols - 1)) / (hereBoxes + hereGaps * GUTTER));
  const rowGaps = gap * (BOARD_MAX.rows - 1);
  const boardFor = c => BOARD_MAX.rows * c + rowGaps;

  // What each part would like, before anyone gives anything up.
  const wheelWant = Math.min(width, WHEEL_MAX <= 4 ? 210 : WHEEL_MAX <= 5 ? 230 : 250);


  // ...and the layout we refuse to go below: cells small but still readable, and a wheel with
  // tiles a finger can still hit. Width can force the cells smaller than MIN_CELL - a
  // six-column board on a narrow phone leaves no choice - but height never may.
  const WHEEL_FLOOR = Math.min(wheelWant, 132);
  const floorCell = Math.min(byWidest, MIN_CELL);
  const floorHeight = boardFor(floorCell) + WHEEL_FLOOR;

  // If even that will not fit, say by how much rather than letting the difference be clipped.
  // `.screen` hides its overflow, so whatever does not fit is not merely cramped - it is
  // invisible, which is how the bottom of the wheel used to disappear on a small phone with
  // the letters still in it.
  const deficit = Math.max(0, floorHeight - usable);
  const budget = usable + deficit;
  // A tile is this share of the wheel's diameter - the same number `drawWheel` draws with.
  const SHARE = WHEEL_MAX <= 4 ? 0.30 : WHEEL_MAX <= 6 ? 0.26 : 0.21;
  // Where the two would come out equal: SHARE*w for a tile against (budget - w - rowGaps)/rows
  // for a cell, solved for w. Below this the wheel is taking so much height that the boxes
  // being filled in are smaller than the letters being chosen from - on a 360x640 phone the
  // wheel took its full 230px and left the board at its 30px floor against 60px tiles, which
  // is a board that reads as an afterthought to its own wheel.
  const balance = (budget - rowGaps) / (SHARE * BOARD_MAX.rows + 1);

  // Split in this order, which is the order the two parts matter in:
  //
  //   1. the wheel gets the size it wants. It is what the player reads and aims at, and a
  //      letter has to be picked out of it before anything can be spelled;
  //   2. the board takes what is left, its cells shrinking to fit;
  //   3. only when the cells reach the glyph's floor - below which the letter would not fit
  //      inside its box at all - does the wheel start giving space back.
  //
  // It used to run the other way round, the board taking cells up to a comfortable size and
  // the wheel taking the remainder. On a 360px phone that left the wheel pinned at its 132px
  // floor with 30px tiles while the board had 38px cells: the boxes being filled in were
  // bigger than the letters being chosen from, which is backwards. The board is a record of
  // what has been found; the wheel is the thing being used.
  // The wheel still gets what it wants wherever the height allows it - it is what the player
  // reads and aims at. It only gives way when what it wants would starve the board past the
  // point above, and never below its own floor.
  let wheel = Math.min(wheelWant, width, budget - boardFor(MIN_CELL),
                       Math.max(WHEEL_FLOOR, Math.floor(balance)));

  // What height allows, for the tallest board in the game. Constant per screen, and therefore
  // the thing the slot is reserved at - so the wheel below it never moves when the level does,
  // which is the whole reason the old code sized every board for the widest one.
  let roomy = Math.min(MAX_CELL, Math.floor((budget - wheel - rowGaps) / BOARD_MAX.rows));

  if (roomy < MIN_CELL) {
    // Take back only as much as the cells need to reach their floor, and no more. Driven by
    // height alone, so it lands the same way on every level and the wheel stays put.
    roomy = MIN_CELL;
    wheel = Math.max(WHEEL_FLOOR, budget - boardFor(roomy));
  }

  wheel = Math.max(WHEEL_FLOOR, Math.min(wheel, width, budget - boardFor(roomy)));

  // This level's cell: as big as the slot allows, and as big as this level's own columns do.
  const cell = Math.max(1, Math.min(roomy, byHere));

  // The full height, every level, not this level's rows. Reserving only what the open board
  // needs moved everything below it: on a 360px phone the wheel sat anywhere from 381px to
  // 445px down the screen depending on how many rows the level had, so changing level shifted
  // the whole lower half of the game. The board is centred in its slot instead, and the wheel
  // stays where the player last reached for it.
  el.boardArea.style.height = Math.round(boardFor(roomy)) + 'px';
  return { cell, wheel: Math.round(wheel), deficit: Math.ceil(deficit) };
}

/*
 * A letter is the same size wherever it appears - in a board cell, on a wheel tile, on level
 * 1 and on level 34, on a 320px phone and on a desktop. What adapts to the screen is the box
 * around the letter, not the letter inside it.
 *
 * It used to be the other way round: the glyph was a fraction of its box (0.42 of a cell, 0.4
 * of a tile), so a seven-column board on a small phone drew its letters at 13px and the wheel
 * at its floor drew them at 11px - and the levels with the most to read were the ones that
 * rendered smallest. A learner meeting ন্ধু for the first time should not have to meet it
 * smaller because the board it sits on is wide.
 *
 * GLYPH_BOX is the other half of the deal: no box may be smaller than this, or the fixed
 * letter would not fit inside it. Every akshara in the game is measured against it - see the
 * glyph check - because a conjunct is taller than a bare consonant and the tall ones decide
 * the floor.
 */
/*
 * These two numbers are a pair and the glyph check enforces the relationship. GLYPH_BOX is
 * bounded from above by the smallest screen: an eight-row board plus the wheel's floor has to
 * fit the height of a 320x568 phone, which puts the ceiling near 30px. GLYPH is then bounded
 * by GLYPH_BOX, and by the widest akshara in the game rather than the tallest - ড়িং, from
 * ফড়িং, sets it, measuring about 1.45x its font size across. Raise either one and the check
 * says which letter stopped fitting.
 */
const GLYPH = 17;       // px - board cells and wheel tiles alike
const GLYPH_BOX = 30;   // px - the smallest box that holds a GLYPH letter with air around it

/*
 * A blank column's width, as a fraction of a box. Wide enough to read as a gap between two
 * islands - which is the only job it has - and narrow enough that the boxes either side of it
 * get most of what it used to take.
 */
const GUTTER = 0.42;

/** Which columns of a board hold nothing, and how many. Cheap, and the answer never changes. */
const emptyByBoard = new WeakMap();
function emptyColumnSet(puzzle) {
  let set = emptyByBoard.get(puzzle);
  if (!set) {
    const used = new Set();
    for (const w of puzzle.words) for (const [, c] of w.cells) used.add(c);
    set = new Set();
    for (let c = 0; c < puzzle.cols; c++) if (!used.has(c)) set.add(c);
    emptyByBoard.set(puzzle, set);
  }
  return set;
}
const emptyColumns = puzzle => emptyColumnSet(puzzle).size;

function drawBoard(alloc) {
  const p = game.puzzle;
  const gap = 5;
  const cell = alloc.cell;

  // A track per column rather than one width repeated, so a blank column can be a gutter.
  const blanks = emptyColumnSet(p);
  const gutter = Math.round(cell * GUTTER);
  el.board.style.gridTemplateColumns = Array.from(
    { length: p.cols }, (_, c) => (blanks.has(c) ? gutter : cell) + 'px').join(' ');
  el.board.style.gridAutoRows = cell + "px";
  el.board.innerHTML = "";

  const shown = revealedCells();
  const hinted = hintSet();

  for (let r = 0; r < p.rows; r++) {
    for (let c = 0; c < p.cols; c++) {
      const k = key(r, c);
      const letter = p.letters.get(k);
      const div = document.createElement("div");
      div.className = "cell" + (letter === undefined ? " blank" : "");
      div.dataset.pos = k;
      if (letter !== undefined) {
        const span = document.createElement("span");
        span.textContent = letter;
        span.style.fontSize = GLYPH + "px";
        div.appendChild(span);
        if (shown.has(k)) div.classList.add("on");
        if (hinted.has(k) && !div.classList.contains("blank")) div.classList.add("hinted");
      }
      el.board.appendChild(div);
    }
  }
}

/** Re-measures the split, then redraws board and wheel from the same allocation. */
function drawScreen() {
  // Measure against the frame's natural height first, then give it back any height the
  // content could not be squeezed into. On a short screen - a small phone, or any phone in
  // landscape - that makes the page scroll a little instead of hiding the bottom of the
  // wheel. Two passes, because growing the frame changes what there is to allocate.
  el.device.style.removeProperty('height');
  let alloc = allocateSpace();
  if (alloc.deficit > 0) {
    el.device.style.height = (el.device.getBoundingClientRect().height + alloc.deficit) + 'px';
    alloc = allocateSpace();
  }
  drawBoard(alloc);
  drawWheel(alloc);
}

function refreshBoard() {
  const shown = revealedCells();
  const hinted = hintSet();
  for (const div of el.board.children) {
    if (div.classList.contains("blank")) continue;
    div.classList.toggle("on", shown.has(div.dataset.pos));
    div.classList.toggle("hinted", hinted.has(div.dataset.pos));
  }
}

function drawWheel(alloc) {
  // Trust the allocation. This used to impose its own 148px floor, which quietly overrode
  // every budget upstream - the wheel drew itself bigger than the space it had been given and
  // `.screen`, which hides its overflow, ate the difference along with the letters in it.
  const size = alloc.wheel;
  const n = game.wheel.length;
  // Sized for the fullest wheel in the game rather than this level's, for the same reason the
  // cells are: a tile should be one size per screen. A level with fewer tiles gets the same
  // tile, spaced further apart around the ring.
  //
  // Never below GLYPH_BOX either: the letter no longer shrinks with the tile, so the tile is
  // what has to give way. Eight tiles at the wheel's floor sit 50px apart centre to centre,
  // so holding them at 30px cannot make them touch.
  const full = WHEEL_MAX;
  const tile = Math.max(GLYPH_BOX,
                        Math.round(size * (full <= 4 ? 0.30 : full <= 6 ? 0.26 : 0.21)));
  const radius = size / 2 - tile / 2;

  el.wheel.style.width = el.wheel.style.height = size + "px";
  el.trail.setAttribute("viewBox", `0 0 ${size} ${size}`);

  [...el.wheel.querySelectorAll(".tile")].forEach(t => t.remove());
  tileCentres = [];

  for (let i = 0; i < n; i++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
    const cx = size / 2 + radius * Math.cos(angle);
    const cy = size / 2 + radius * Math.sin(angle);
    tileCentres.push([cx, cy]);

    const btn = document.createElement("button");
    btn.className = "tile";
    btn.type = "button";
    btn.textContent = game.wheel[i];
    btn.dataset.i = i;
    btn.style.width = btn.style.height = tile + "px";
    btn.style.left = (cx - tile / 2) + "px";
    btn.style.top = (cy - tile / 2) + "px";
    btn.style.fontSize = GLYPH + "px";
    // Offsets the resting float in effects.css, so the wheel breathes as a ring rather than
    // as one object pulsing.
    btn.style.setProperty("--i", i);
    el.wheel.appendChild(btn);
  }
  drawTrail();
}

function drawTrail(tip) {
  if (!game.picked.length) { el.trail.innerHTML = ""; return; }
  const tileEl = el.wheel.querySelector(".tile");
  const stroke = Math.max(4, Math.round((tileEl ? tileEl.offsetWidth : 56) * 0.14));
  const pts = game.picked.map(i => tileCentres[i]);
  const line = pts.map(p => p.join(",")).join(" ");
  let svg = `<polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (tip) {
    const last = pts[pts.length - 1];
    svg += `<line x1="${last[0]}" y1="${last[1]}" x2="${tip[0]}" y2="${tip[1]}" stroke="var(--accent)" stroke-opacity=".5" stroke-width="${stroke}" stroke-linecap="round"/>`;
  }
  el.trail.innerHTML = svg;
}

/*
 * Every route into the wheel - drag, tap, backing up, submitting - ends here, which makes this
 * the one place that knows the selection changed. Sounding the tile from here rather than from
 * the four call sites means drag and tap cannot drift apart, and a letter can never be added
 * silently.
 */
let soundedPick = 0;

function markTiles() {
  for (const t of el.wheel.querySelectorAll(".tile")) {
    t.classList.toggle("sel", game.picked.includes(+t.dataset.i));
  }
  const n = game.picked.length;
  if (n > soundedPick) {
    // Up the scale as the word grows, so the sounds themselves say "you are getting
    // somewhere" before the word has been judged.
    Sfx.tap(n - 1);
    Bird.thinking();
  } else if (n < soundedPick && n > 0) {
    Sfx.untap(n);
  } else if (n === 0 && soundedPick > 0) {
    Bird.rest();
  }
  soundedPick = n;
}

function currentWord() { return game.picked.map(i => game.wheel[i]).join(""); }

function drawPreview() {
  const word = game.verdict ? game.verdict.word : currentWord();
  if (!word) {
    el.preview.innerHTML = `<span class="hint-text">অক্ষর জুড়ে শব্দ বানাও</span>`;
    return;
  }
  const tone = game.verdict ? ({
    correct: " good",
    dup: " dup shake",
    wrong: " bad shake"
  }[game.verdict.result] || "") : "";
  const submit = (!game.verdict && game.tapMode)
    ? `<button class="go" id="submitWord" title="মিলিয়ে দেখো" aria-label="Check word">✓</button>` : "";
  el.preview.innerHTML = `<div class="chip${tone}">${word}${submit}</div>`;
  const go = document.getElementById("submitWord");
  if (go) go.addEventListener("click", () => submitWord());
}

/*
 * A colour per letter, so the grid reads as bands: every ক level one colour, every খ the next.
 * It used to be coloured by block - the five stages of the teaching syllabus this game
 * replaced - which in alphabet order lands ক in one colour and গ in another for no reason a
 * player could see. Five colours cycling means neighbours always differ.
 */
const HUE = (() => {
  const of = {};
  let n = 0;
  for (const lv of LEVELS) if (!(lv.name in of)) of[lv.name] = (n++ % 5) + 1;
  return of;
})();

function drawLevelGrid() {
  el.levelGrid.innerHTML = "";
  LEVELS.forEach((lv, i) => {
    const b = document.createElement("button");
    b.className = `lv lv-${HUE[lv.name]}`;
    b.type = "button";
    // The letter, not the level number - the grid is how a player finds a letter again, and
    // they remember ম, not ১২৭. The go number rides along as a superscript where there is one.
    b.textContent = lv.name;
    if (lv.pass) {
      const n = document.createElement("sup");
      n.textContent = bn(lv.pass);
      b.appendChild(n);
    }
    b.title = lv.pass ? `${lv.name} ${bn(lv.pass)}` : lv.name;
    const done = !!game.completed[lv.id];
    if (done) b.classList.add("done");
    if (i === game.index) b.classList.add("now");
    b.addEventListener("click", () => loadLevel(i));
    el.levelGrid.appendChild(b);
  });
}


