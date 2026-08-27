/* ============================================================================
   Play
   ============================================================================ */
let verdictTimer = null;

function showVerdict(word, result) {
  game.verdict = { word, result };
  drawPreview();
  clearTimeout(verdictTimer);
  verdictTimer = setTimeout(() => { game.verdict = null; drawPreview(); }, 720);
}

function submitWord() {
  const word = currentWord();
  game.picked = [];
  game.tapMode = false;
  markTiles();
  drawTrail();
  if (!word) { drawPreview(); return; }

  const lv = level();
  const done = foundSet();

  // -- a word on the board ---------------------------------------------------
  if (lv.words.includes(word)) {
    if (done.has(word)) {
      showVerdict(word, "dup");
      knockWord(word);
      return;
    }

    done.add(word);
    game.found[lv.id] = [...done];

    const cleared = done.size === lv.words.length;
    if (cleared) game.completed[lv.id] = true;
    persist();

    showVerdict(word, "correct");
    Speech.say(word);
    const placed = game.puzzle.words.find(w => w.word === word);
    const settle = placed ? flyLettersToBoard(word, placed.cells) : 0;
    setTimeout(() => {
      refreshBoard();
      drawHud();
      drawLevelGrid();
    }, settle);

    if (cleared) {
      // No pause: the confetti starts and the next board arrives in the same frame, the
      // moment the last letters have landed.
      setTimeout(() => { celebrateLevel(); loadLevel(game.index + 1); }, settle);
    }
    return;
  }

  // -- not a word here ------------------------------------------------------
  showVerdict(word, "wrong");
  rejectWheel();
}

/* pointer drag across the wheel */
function tileAt(x, y) {
  const rect = el.wheel.getBoundingClientRect();
  const px = x - rect.left, py = y - rect.top;
  const tile = el.wheel.querySelector(".tile");
  const r = tile ? tile.offsetWidth * 0.62 : 24;
  for (let i = 0; i < tileCentres.length; i++) {
    const [cx, cy] = tileCentres[i];
    if (Math.hypot(cx - px, cy - py) <= r) return i;
  }
  return null;
}

let startPoint = null;

el.wheel.addEventListener("pointerdown", e => {
  const i = tileAt(e.clientX, e.clientY);
  if (i === null) return;
  e.preventDefault();
  el.wheel.setPointerCapture(e.pointerId);
  game.dragging = true;
  game.moved = false;
  startPoint = [e.clientX, e.clientY];

  if (game.tapMode) {
    // click-by-click entry: same tile twice steps back, a new tile extends
    if (game.picked.length && game.picked[game.picked.length - 1] === i) game.picked.pop();
    else if (!game.picked.includes(i)) game.picked.push(i);
  } else {
    game.picked = [i];
  }
  game.verdict = null;
  markTiles();
  drawTrail();
  drawPreview();
});

el.wheel.addEventListener("pointermove", e => {
  if (!game.dragging) return;
  if (!game.moved && Math.hypot(e.clientX - startPoint[0], e.clientY - startPoint[1]) > 9) {
    game.moved = true;
    game.tapMode = false;
  }
  if (!game.moved) return;

  const rect = el.wheel.getBoundingClientRect();
  drawTrail([e.clientX - rect.left, e.clientY - rect.top]);

  const i = tileAt(e.clientX, e.clientY);
  if (i === null) return;
  if (game.picked.length >= 2 && i === game.picked[game.picked.length - 2]) game.picked.pop();
  else if (!game.picked.includes(i)) game.picked.push(i);
  markTiles();
  drawTrail([e.clientX - rect.left, e.clientY - rect.top]);
  drawPreview();
});

function endDrag() {
  if (!game.dragging) return;
  game.dragging = false;
  if (game.moved) {
    submitWord();
  } else {
    game.tapMode = true;   // a plain click keeps the selection for more clicks
    drawTrail();
    drawPreview();
  }
}

el.wheel.addEventListener("pointerup", endDrag);
el.wheel.addEventListener("pointercancel", () => {
  game.dragging = false;
  if (!game.tapMode) { game.picked = []; markTiles(); drawTrail(); drawPreview(); }
});

document.addEventListener("keydown", e => {
  if (e.key === "Enter" && game.picked.length) { e.preventDefault(); submitWord(); }
  if (e.key === "Escape") {
    if (guideIsOpen()) { closeGuide(); return; }
    game.picked = []; game.tapMode = false;
    markTiles(); drawTrail(); drawPreview();
  }
});

/* controls */
el.hint.addEventListener("click", () => {
  const lv = level();
  const done = foundSet();
  const shown = revealedCells();
  let target = null;
  for (const w of game.puzzle.words) {
    if (done.has(w.word)) continue;
    for (const [r, c] of w.cells) {
      if (!shown.has(key(r, c))) { target = key(r, c); break; }
    }
    if (target) break;
  }
  if (!target) return;
  game.hints[lv.id] = [...hintSet(), target];
  persist();
  refreshBoard();
  drawHud();

  const cell = el.board.querySelector(`[data-pos="${target}"]`);
  if (cell && !reduced()) {
    cell.classList.add('arrive');
    setTimeout(() => cell.classList.remove('arrive'), 460);
  }
  el.hint.classList.remove('flash');
  void el.hint.offsetWidth;
  el.hint.classList.add('flash');
});

el.shuffle.addEventListener("click", () => {
  // remember where each letter was, so the tiles can slide rather than jump
  const before = new Map();
  el.wheel.querySelectorAll('.tile').forEach(t => before.set(t.textContent, t.getBoundingClientRect()));

  for (let i = game.wheel.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [game.wheel[i], game.wheel[j]] = [game.wheel[j], game.wheel[i]];
  }
  game.picked = [];
  game.tapMode = false;
  drawScreen();
  drawPreview();
  animateShuffle(before);
});

/* The guide sheet. On a wide screen the notes are simply on the page and this never runs;
   the class it toggles has no styling above the touch breakpoint. */
const guideIsOpen = () => el.guide.classList.contains("open");

function openGuide() {
  el.guide.classList.add("open");
  document.body.classList.add("guide-open");
  el.guideOpen.setAttribute("aria-expanded", "true");
  el.guide.scrollTop = 0;
  el.guideClose.focus();
}

function closeGuide() {
  el.guide.classList.remove("open");
  document.body.classList.remove("guide-open");
  el.guideOpen.setAttribute("aria-expanded", "false");
  el.guideOpen.focus();
}

/* The level count is stated twice in the prose. Both come from the table rather than from a
   number typed into the copy, because the catalogue ships a slice of itself while the game is
   being reworked and a hardcoded count would be wrong the moment that slice changes. */
function drawLevelCount() {
  const n = LEVELS.length;
  const plural = n === 1 ? "level" : "levels";
  const words = ["zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
                 "Nine", "Ten", "Eleven", "Twelve"][n];
  const eyebrow = document.getElementById("eyebrowCount");
  const deck = document.getElementById("deckCount");
  if (eyebrow) eyebrow.textContent = `${n} ${plural}`;
  if (deck) deck.textContent = `${words || n} ${plural}`;
}
drawLevelCount();

/* Pronunciation has no control, so there is nothing to wire up - just pick the voice. It is
   a no-op on a device with no Bengali voice, so nothing here needs to check first. */
Speech.init();

el.guideOpen.addEventListener("click", openGuide);
el.guideClose.addEventListener("click", closeGuide);

// Picking a level from inside the sheet means the player wants to play it, so get out of the way.
el.levelGrid.addEventListener("click", e => {
  if (e.target.closest(".lv") && guideIsOpen()) closeGuide();
});

el.prev.addEventListener("click", () => loadLevel(game.index - 1));
el.next.addEventListener("click", () => loadLevel(game.index + 1));

/* keep the board and wheel sized to the screen */
let resizeTimer = null;
new ResizeObserver(() => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { drawScreen(); markTiles(); }, 60);
}).observe(document.querySelector(".screen"));

/* first unsolved level makes the best landing spot */
const firstOpen = LEVELS.findIndex(lv => !game.completed[lv.id]);
loadLevel(firstOpen === -1 ? 0 : firstOpen);

/*
 * Install the offline copy. Wrapped in every guard there is, because none of this is the game:
 * a service worker needs a secure origin, so it is absent over plain http and on a file:// page
 * opened straight from disk, and a browser that refuses one must still play. Registered after
 * load so it never competes with the first paint for a slow phone's attention.
 *
 * `isSecureContext` rather than a check for https: localhost is a secure origin too, and
 * testing this at all means serving it from one. Checking the protocol instead looks equivalent
 * and silently makes the whole feature unverifiable.
 */
if ('serviceWorker' in navigator && window.isSecureContext) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
