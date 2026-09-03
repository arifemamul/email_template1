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
  const MIN_CELL = GLYPH_BOX, MAX_CELL = 58;
  // Sized for the largest board in the game, not the one on screen, so the answer is the same
  // on every level. The board area then takes only the height this level's rows need.
  const byWidth = Math.floor((width - gap * (BOARD_MAX.cols - 1)) / BOARD_MAX.cols);
  const rowGaps = gap * (BOARD_MAX.rows - 1);
  const boardFor = c => BOARD_MAX.rows * c + rowGaps;

  // What each part would like, before anyone gives anything up.
  const wheelWant = Math.min(width, WHEEL_MAX <= 4 ? 210 : WHEEL_MAX <= 5 ? 230 : 250);

  // ...and the layout we refuse to go below: cells small but still readable, and a wheel with
  // tiles a finger can still hit. Width can force the cells smaller than MIN_CELL - a
  // six-column board on a narrow phone leaves no choice - but height never may.
  const WHEEL_FLOOR = Math.min(wheelWant, 132);
  const floorCell = Math.min(byWidth, MIN_CELL);
  const floorHeight = boardFor(floorCell) + WHEEL_FLOOR;

  // If even that will not fit, say by how much rather than letting the difference be clipped.
  // `.screen` hides its overflow, so whatever does not fit is not merely cramped - it is
  // invisible, which is how the bottom of the wheel used to disappear on a small phone with
  // the letters still in it.
  const deficit = Math.max(0, floorHeight - usable);
  const budget = usable + deficit;

  // One size for both, solved for together rather than split.
  //
  // A board cell and a wheel tile are the same object to a child: the letter they are hunting
  // for and the letter they press to put it there. Drawn at 44px and 60px they were not, and
  // the wheel became the big thing on the screen with the board a smaller record beside it.
  //
  // So this solves for the largest U that fits both at once. A tile is a fixed share of the
  // wheel's diameter - the share that keeps eight of them from touching - so a wheel whose
  // tiles are U across is U/SHARE wide, and the height needed is:
  //
  //     rows * U + rowGaps  +  U / SHARE  <=  budget
  //
  // which rearranges to the single division below. The previous version gave the wheel what
  // it asked for first and let the board have the rest, which is why the two never agreed.
  const SHARE = WHEEL_MAX <= 4 ? 0.30 : WHEEL_MAX <= 6 ? 0.26 : 0.21;
  let cell = Math.floor((budget - rowGaps) / (BOARD_MAX.rows + 1 / SHARE));
  cell = Math.min(cell, MAX_CELL, byWidth);

  // The wheel is then whatever holds tiles that size - never under its own floor, because a
  // ring too small to space its tiles apart is worse than a ring bigger than its tiles need.
  let wheel = Math.max(WHEEL_FLOOR, Math.min(width, Math.round(cell / SHARE)));

  // Deliberately not expanded into the height left over. Filling it spread five 42px tiles
  // around a 250px ring, which read as a sparse hoop rather than as a set of letters. The ring
  // stays in proportion to the tiles on it and `.wheel-area` centres it, so the slack becomes
  // even space above and below instead of a band under the buttons.

  if (cell < MIN_CELL) {
    // Width, not height, is what forced this - see glyphFor. Give the board its floor if the
    // width allows it and let the wheel take what is left, as it used to.
    cell = Math.min(MIN_CELL, byWidth);
    wheel = Math.max(WHEEL_FLOOR, Math.min(width, budget - boardFor(cell)));
  }

  cell = Math.max(1, Math.min(cell, byWidth));
  wheel = Math.max(WHEEL_FLOOR, Math.min(wheel, width, budget - boardFor(cell)));

  // The full height, every level, not this level's rows. Reserving only what the open board
  // needs moved everything below it: on a 360px phone the wheel sat anywhere from 381px to
  // 445px down the screen depending on how many rows the level had, so changing level shifted
  // the whole lower half of the game. The board is centred in its slot instead, and the wheel
  // stays where the player last reached for it.
  el.boardArea.style.height = Math.round(boardFor(cell)) + 'px';
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
const GLYPH = 21;       // px - board cells and wheel tiles alike
const GLYPH_BOX = 37;   // px - the smallest box that holds a GLYPH letter with air around it

/*
 * The one case the pair above cannot honour. Height it can always find - the wheel gives
 * space back until the cells reach GLYPH_BOX - but width it cannot: a six-column board on a
 * 375px phone leaves 32px per cell and there is nothing to trade for the rest.
 *
 * So the letter comes down with the box when the box is forced under its floor, in the same
 * proportion, and every letter on that screen comes down with it - board cells and wheel tiles
 * both take this number. A letter is still one size wherever it appears, which is the promise
 * that matters; what it is no longer is the same size on a 375px phone as on a desktop, which
 * was never a promise a fixed letter could keep against a fixed board width.
 */
function glyphFor(box) {
  if (box >= GLYPH_BOX) return GLYPH;
  return Math.max(13, Math.floor(box * GLYPH / GLYPH_BOX));
}

function drawBoard(alloc) {
  const p = game.puzzle;
  const gap = 5;
  const cell = alloc.cell;

  el.board.style.gridTemplateColumns = `repeat(${p.cols}, ${cell}px)`;
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
        span.style.fontSize = glyphFor(cell) + "px";
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
  // The board's number, not the wheel's own. `allocate` solved for one size that both could
  // hold, so a tile is a cell - which is the point: the letter on the wheel and the letter in
  // the board are the same letter, and were being drawn at two different sizes.
  //
  // GLYPH_BOX is the one exception, and it only bites where width has already forced the cells
  // under it: a tile that small could not hold its own letter, and shrinking the thing being
  // pressed to match the thing being filled in would be the wrong way round. Anything above
  // that floor takes the cell's size exactly - a 44px tap target with the ring spacing them
  // well apart, rather than a bigger circle that disagrees with the board it feeds.
  const tile = Math.max(GLYPH_BOX, alloc.cell);
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
    // The wheel takes the board's number, not its own: the two sit on one screen and a letter
    // that is 21px on a tile and 18px in the cell it lands in reads as two different letters.
    btn.style.fontSize = glyphFor(Math.min(tile, alloc.cell)) + "px";
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


