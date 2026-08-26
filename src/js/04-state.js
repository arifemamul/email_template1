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
  found: game.found, hints: game.hints, completed: game.completed
});

const level = () => LEVELS[game.index];
const foundSet = () => new Set(game.found[level().id] || []);
const hintSet = () => new Set(game.hints[level().id] || []);

function revealedCells() {
  const done = foundSet();
  const out = new Set(hintSet());
  for (const w of game.puzzle.words) {
    if (done.has(w.word)) for (const [r, c] of w.cells) out.add(key(r, c));
  }
  return out;
}

const isClear = () => foundSet().size === level().words.length;

