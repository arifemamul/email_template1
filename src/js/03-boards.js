/* ============================================================================
   Boards - laid out by tools/bangla.py, and the tables built from them here
   ============================================================================ */
/*
 * A level arrives with its board already placed. It used to be laid out here at runtime,
 * which meant the placer existed twice - once in Python for the checks and once in
 * JavaScript for the game - and nothing but a diff of every board stopped the two from
 * drifting. Emitting the board leaves one implementation, and lets the search be exhaustive
 * rather than a heuristic cheap enough to run on page load: every ordering of a level's words
 * is tried, 5040 of them for a seven-word level, three seconds for the whole game at build
 * time. Two orderings was the most that was affordable in the page, and it left বা on a 6x6
 * board when a 3x6 one exists - which cost every level a smaller box, because a box is sized
 * for the largest board in the game.
 */
const key = (r, c) => r + "," + c;

function boardOf(lv) {
  const letters = new Map();
  // The grid is as big as the cells reach. The layout is normalised to the origin, so the
  // furthest row and column are the size - no need to ship the size alongside the cells.
  let rows = 0, cols = 0;
  const words = lv.board.map(({ w, c }) => {
    const aks = splitAksharas(w);
    c.forEach(([r, col], i) => {
      letters.set(key(r, col), aks[i]);
      if (r >= rows) rows = r + 1;
      if (col >= cols) cols = col + 1;
    });
    return { word: w, aks, cells: c, horizontal: c.length < 2 || c[0][0] === c[1][0] };
  });
  return { rows, cols, letters, words };
}


/*
 * A level's words are its board read back. Every word on a board is a word of the level and
 * every word of the level is on the board, so shipping both was the same strings twice - 11 KB
 * of a 210 KB page, on a phone, on mobile data. Nothing downstream cares about the order.
 */
for (const lv of LEVELS) lv.words = lv.board.map(b => b.w);


/*
 * Every board, laid out once at startup, and the largest of them.
 *
 * A box is sized from these rather than from the level on screen, so that a box is the same
 * size on every level of a given screen. It used to be sized from whichever board was open,
 * which meant a level with a wide, half-empty grid got 30px cells while a small one got 46px
 * on the same phone - the letter inside stayed 17px either way, so it read as cramped on one
 * level and lost in space on the next. The board is what changes between levels; the size of
 * a box should only change when the screen does.
 *
 * The boards arrive laid out, so this is only a walk over the level table - and it is what
 * makes the worst case knowable before anything is drawn.
 */
const BOARDS = LEVELS.map(boardOf);
const BOARD_MAX = {
  rows: Math.max(...BOARDS.map(b => b.rows)),
  cols: Math.max(...BOARDS.map(b => b.cols))
};
const WHEEL_MAX = Math.max(...LEVELS.map(lv => lv.letters.length));

