/* ============================================================================
   Animation - every action gets a physical response
   ============================================================================ */
const still = window.matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => still.matches;

/** Screen-relative box, since the effects layer is positioned inside .screen. */
function boxOf(node) {
  const screenRect = document.querySelector('.screen').getBoundingClientRect();
  const r = node.getBoundingClientRect();
  return { x: r.left - screenRect.left, y: r.top - screenRect.top, w: r.width, h: r.height };
}

/**
 * Sends a thing from one place to another and cleans up after itself. Everything that moves
 * in this game moves through here: letters to the board, confetti across it.
 */
function fly(from, to, { text = '', cls = '', size = null, delay = 0, duration = 460,
                         arc = 0, spin = 0, fade = false, colour = null,
                         easing = 'cubic-bezier(.3,.7,.3,1)' } = {}) {
  if (reduced()) return Promise.resolve();
  const layer = document.getElementById('fx');
  if (!layer) return Promise.resolve();

  const el = document.createElement('div');
  el.className = 'fly ' + cls;
  el.textContent = text;
  const w = size || from.w, hgt = size || from.h;
  el.style.width = w + 'px';
  el.style.height = cls.includes('word') ? 'auto' : hgt + 'px';
  el.style.left = from.x + 'px';
  el.style.top = from.y + 'px';
  if (text) el.style.fontSize = Math.round(Math.min(w, hgt) * 0.44) + 'px';
  if (colour) el.style.setProperty('--conf', colour);
  layer.appendChild(el);

  const dx = (to.x + to.w / 2) - (from.x + from.w / 2);
  const dy = (to.y + to.h / 2) - (from.y + from.h / 2);
  const scale = to.w && from.w ? to.w / from.w : 1;

  const frames = [
    { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1, offset: 0 },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - arc}px) scale(${(1 + scale) / 2}) `
               + `rotate(${spin / 2}deg)`, opacity: 1, offset: 0.55 },
    { transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotate(${spin}deg)`,
      opacity: fade ? 0 : 1, offset: 1 }
  ];

  const run = el.animate(frames, { duration, delay, easing, fill: 'forwards' });
  return run.finished.then(() => el.remove()).catch(() => el.remove());
}

/** Letters leaving the wheel and landing in their cells. */
function flyLettersToBoard(word, cells) {
  const aksharas = splitAksharas(word);
  const tiles = [...el.wheel.querySelectorAll('.tile')];
  const arrivals = [];

  aksharas.forEach((akshara, i) => {
    const tile = tiles.find(t => t.textContent === akshara);
    const cell = cells[i] && el.board.querySelector(`[data-pos="${key(cells[i][0], cells[i][1])}"]`);
    if (!tile || !cell) return;
    const delay = i * 70;
    arrivals.push({ cell, delay });
    fly(boxOf(tile), boxOf(cell), {
      text: akshara, cls: '', delay, duration: 380, arc: 18
    });
  });

  // reveal each cell as its letter lands
  arrivals.forEach(({ cell, delay }) => {
    setTimeout(() => {
      cell.classList.add('on', 'arrive');
      setTimeout(() => cell.classList.remove('arrive'), 460);
    }, reduced() ? 0 : delay + 330);
  });
  const last = arrivals.length ? arrivals[arrivals.length - 1].delay + 380 : 0;
  return reduced() ? 0 : last;
}

/** Nudges the cells of a word the player has already solved. */
function knockWord(word) {
  const placed = game.puzzle.words.find(w => w.word === word);
  if (!placed || reduced()) return;
  placed.cells.forEach(([r, c], i) => {
    const cell = el.board.querySelector(`[data-pos="${key(r, c)}"]`);
    if (!cell) return;
    setTimeout(() => {
      cell.classList.add('knock');
      setTimeout(() => cell.classList.remove('knock'), 420);
    }, i * 60);
  });
}

/** The wheel refusing a word. */
function rejectWheel() {
  if (reduced()) return;
  el.wheel.querySelectorAll('.tile').forEach((t, i) => {
    setTimeout(() => {
      t.classList.add('reject');
      setTimeout(() => t.classList.remove('reject'), 380);
    }, i * 25);
  });
}

/** Cells popping in sequence, then confetti, when a level is cleared. */
const CONFETTI_COLOURS = [
  'var(--block-1)', 'var(--block-2)', 'var(--block-3)', 'var(--block-4)', 'var(--block-5)',
  'var(--marigold)', 'var(--parchment)'
];

function celebrateLevel() {
  if (reduced()) return;

  // Confetti only. The cells used to take a bow one after another and the board used to
  // glow, but both need the finished board to still be on screen, and it no longer is - the
  // next level loads in the same frame. The overlay does not care which board is underneath.

  const layer = document.getElementById('fx');
  const width = layer.clientWidth;
  const floor = layer.clientHeight + 40;

  for (let i = 0; i < 26; i++) {
    const x = Math.random() * Math.max(10, width - 12);
    const size = 7 + Math.random() * 7;
    const tall = Math.random() < 0.45;
    const shape = Math.random() < 0.3 ? ' round' : (tall ? ' tall' : '');
    fly(
      { x, y: -20, w: size, h: tall ? size * 1.8 : size },
      { x: x + (Math.random() - 0.5) * 120, y: floor, w: size, h: tall ? size * 1.8 : size },
      {
        cls: 'confetti' + shape,
        size,
        delay: Math.random() * 700,
        duration: 1100 + Math.random() * 900,
        spin: (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 540),
        arc: (Math.random() - 0.5) * 90,
        fade: true,
        colour: CONFETTI_COLOURS[Math.floor(Math.random() * CONFETTI_COLOURS.length)],
        // paper accelerates downward instead of gliding at a constant rate
        easing: 'cubic-bezier(.34,.06,.7,.5)'
      });
  }
}

/** Tiles sliding to their new places instead of teleporting. */
function animateShuffle(before) {
  if (reduced()) return;
  el.wheel.querySelectorAll('.tile').forEach(tile => {
    const from = before.get(tile.textContent);
    if (!from) return;
    const now = tile.getBoundingClientRect();
    const dx = from.left - now.left;
    const dy = from.top - now.top;
    if (!dx && !dy) return;
    tile.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0,0)' }],
      { duration: 420, easing: 'cubic-bezier(.3,1.2,.4,1)' });
  });
}

