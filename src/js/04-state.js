/* ============================================================================
   Game state
   ============================================================================ */
const store = {
  read() {
    try { return JSON.parse(localStorage.getItem("shobdojot") || "{}"); }
    catch { return {}; }
  },
  write(v) { try { localStorage.setItem("shobdojot", JSON.stringify(v)); } catch {} }
};

/**
 * Which levels count as finished, from a save of any age. A level is finished if it says so,
 * or - for saves predating that flag - if its found-word list covers the whole board.
 */
function migrateCompleted(saved) {
  const completed = { ...(saved.completed || {}) };
  const found = saved.found || {};
  for (const lv of LEVELS) {
    const words = found[lv.id];
    if (Array.isArray(words) && lv.words.every(w => words.includes(w))) completed[lv.id] = true;
  }
  return completed;
}

const saved = store.read();
const game = {
  index: 0,
  found: saved.found || {},          // levelId -> [words] found on THIS attempt
  hints: saved.hints || {},          // levelId -> ["r,c"]
  /*
   * When the next hint may be taken, as a clock time.
   *
   * A hint used to be free and unlimited, and a child who found that out stopped playing: press
   * it enough times and the board fills itself. So a hint now costs half a minute of waiting,
   * and the only way to buy that back is to find words - fifteen seconds each, so two found
   * words pay for one hint exactly. The two numbers are multiples on purpose: a child can see
   * that two words earn a hint without being told.
   *
   * Kept as an absolute time and saved, so closing the page and coming back does not hand out
   * a free one. Not per level: it is a limit on asking, and asking is the same act whichever
   * board it happens on.
   */
  hintAt: saved.hintAt || 0,
  // Levels ever fully solved. Separate from `found`, which is wiped each time a cleared level
  // is revisited so it can be played again - a board sitting there fully lit with nothing left
  // to drag is not a level, it is a screenshot of one. `completed` is what remembers progress
  // for the level grid and for where a fresh visit lands.
  //
  // Saves written before this existed recorded a finished level only as a full `found` list,
  // so read that too. Without it a returning player loses every checkmark, lands back on
  // level 1, and watches those `found` lists get wiped one by one as they look around.
  completed: migrateCompleted(saved),
  puzzle: null,
  wheel: [],
  picked: [],
  dragging: false,
  moved: false,
  tapMode: false,
  verdict: null
};

const persist = () => store.write({
  found: game.found, hints: game.hints, completed: game.completed, hintAt: game.hintAt
});

/* -- what a hint costs ---------------------------------------------------------------------
   Half a minute to wait, and fifteen seconds back for every word found. Two words, one hint.
   Long enough that a child stops pressing the button and looks at the board, short enough that
   the wait is never the game. */
const HINT_WAIT = 30000;
const HINT_CREDIT = 15000;

/** Seconds still to wait, rounded up. 0 means a hint can be taken now. */
function hintWait() {
  return Math.max(0, Math.ceil((game.hintAt - Date.now()) / 1000));
}

/** A word was found: bring the next hint fifteen seconds closer, but never into the past. */
function creditHint() {
  game.hintAt = Math.max(Date.now(), game.hintAt - HINT_CREDIT);
}

const level = () => LEVELS[game.index];
const foundSet = () => new Set(game.found[level().id] || []);
const hintSet = () => new Set(game.hints[level().id] || []);

/**
 * The cells of every word actually found. This is what makes a cell gold.
 *
 * Kept apart from `revealedCells` on purpose. A hinted cell has its letter showing but the
 * word is still unsolved, and for a while both sets were the same set - so taking a hint lit
 * the cell exactly like solving it, and a child looking at a part-hinted board saw a board the
 * game had answered for them. A hint shows a letter; only finding the word fills the cell.
 */
function solvedCells() {
  const done = foundSet();
  const out = new Set();
  for (const w of game.puzzle.words) {
    if (done.has(w.word)) for (const [r, c] of w.cells) out.add(key(r, c));
  }
  return out;
}

/** Everything a player can already see: solved cells plus hinted ones. What a hint may skip. */
function revealedCells() {
  const out = solvedCells();
  for (const k of hintSet()) out.add(k);
  return out;
}

const isClear = () => foundSet().size === level().words.length;

