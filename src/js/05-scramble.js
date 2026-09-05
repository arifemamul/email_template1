/* ============================================================================
   The wheel - how a level's letters are arranged around the ring
   ============================================================================ */
/*
 * How the letters are arranged around the wheel.
 *
 * The catalogue lists a level's tiles in the order they were derived from its words, which
 * means কলম, কম, কল arrive as ক ল ম - the first word already spelled out along the ring. A
 * player who noticed that would be dragging in a straight line rather than reading, so the
 * ring is scrambled before it is drawn.
 *
 * Scrambled deliberately rather than randomly. Two properties are worth having and neither
 * comes free from a shuffle:
 *
 *   - the same level looks the same every time you come back to it, so a child builds a
 *     memory of where the letters are instead of hunting a fresh maze on every visit;
 *   - letters that follow one another inside a word are pushed apart around the ring, so
 *     spelling a word means finding its letters rather than sweeping through neighbours.
 *
 * So: run a handful of arrangements from a seed fixed by the level id, score each by how far
 * apart it keeps the pairs that appear next to each other in the level's words, and keep the
 * best. Deterministic, and the same in every build.
 */
function seededRandom(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5;  state >>>= 0;
    return state / 4294967296;
  };
}

function levelSeed(lv) {
  let h = 2166136261;
  for (const ch of lv.id + "|" + lv.letters.join("")) {
    h = ((h ^ ch.codePointAt(0)) * 16777619) >>> 0;
  }
  return h;
}

/**
 * How readable a word is straight off the ring. A word scores 2 if its letters sit in a
 * single unbroken run around the wheel in the order it is spelled - কলম on a ring reading
 * ক ল ম - which is the case worth avoiding: the answer is drawn on the wheel. It scores 1 if
 * they form a run in any order, and 0 otherwise.
 *
 * Separating every pair is not on offer. A five-tile wheel has five neighbouring pairs and a
 * four-word board can easily need eight, so some letters of some word will always end up side
 * by side. What can be avoided is a whole word laid out in sequence.
 */
function ringRun(order, word) {
  const n = order.length;
  const at = new Map(order.map((letter, i) => [letter, i]));
  const parts = splitAksharas(word);
  const spots = parts.map(a => at.get(a));
  if (spots.some(i => i === undefined)) return 0;

  const sorted = [...spots].sort((a, b) => a - b);
  let contiguous = sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1);
  if (!contiguous) {
    // a run can also wrap past the last tile back to the first
    const gaps = sorted.map((v, i) => (i === 0 ? v + n - sorted[n - 1 < 0 ? 0 : sorted.length - 1] : v - sorted[i - 1]));
    contiguous = gaps.filter(g => g > 1).length <= 1 && spots.length < n;
  }
  if (!contiguous) return 0;

  const step = (i) => ((spots[i + 1] - spots[i]) + n) % n;
  const forward = spots.every((_, i) => i === spots.length - 1 || step(i) === 1);
  const backward = spots.every((_, i) => i === spots.length - 1 || step(i) === n - 1);
  return forward || backward ? 2 : 1;
}

/** The pairs of tiles that sit next to each other inside some word on the board. */
function adjacentPairs(lv) {
  const pairs = [];
  for (const word of lv.words) {
    const parts = splitAksharas(word);
    for (let i = 0; i + 1 < parts.length; i++) pairs.push([parts[i], parts[i + 1]]);
  }
  return pairs;
}

/**
 * How well an arrangement hides the board. Lower is better: a word spelled out in sequence
 * around the ring costs most, a word merely bunched together costs something, and beyond that
 * the letters of a word being close together costs a little.
 */
function tellsCost(order, lv, pairs) {
  const n = order.length;
  const at = new Map(order.map((letter, i) => [letter, i]));
  let cost = 0;
  for (const word of lv.words) {
    // Weighted by length, because a long word laid out in sequence is the real giveaway. Two
    // aksharas side by side cannot always be helped: a four-tile ring has four neighbouring
    // pairs and a board of four two-letter words needs four, so something has to touch.
    const len = splitAksharas(word).length;
    cost += 40 * (len - 1) * (len - 1) * ringRun(order, word);
  }
  for (const [a, b] of pairs) {
    if (!at.has(a) || !at.has(b)) continue;
    const gap = Math.abs(at.get(a) - at.get(b));
    cost += n - Math.min(gap, n - gap);
  }
  // Two tiles carrying the same akshara must not sit next to each other. A word that needs
  // both - হিজিবিজি needs জি twice - is traced by dragging from one to the other, and a
  // straight drag between neighbours runs over the twin on the way, which adds it to the word
  // instead. Pushed apart, the line between them passes through the empty middle.
  for (let i = 0; i < n; i++) {
    if (order[i] === order[(i + 1) % n]) cost += 500;
  }
  return cost;
}

function scrambleWheel(lv) {
  const pairs = adjacentPairs(lv);
  const random = seededRandom(levelSeed(lv));
  const asAuthored = lv.letters.join("\u0000");
  let best = null, bestCost = Infinity;
  for (let attempt = 0; attempt < 160; attempt++) {
    const order = lv.letters.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    // Never the order the level was written in. `letters` runs longest word first, so that
    // order lays the longest word's letters out in sequence around the ring - which is the
    // one arrangement a scramble exists to avoid. On a small wheel it can also be the
    // cheapest by every other measure and win on merit: দুধ দুল দুই came out as দু ধ ল ই,
    // exactly as authored.
    if (order.join("\u0000") === asAuthored) continue;
    const cost = tellsCost(order, lv, pairs);
    if (cost < bestCost) { best = order; bestCost = cost; }
    if (bestCost < 160) break;   // nothing longer than a pair reads off the ring; good enough
  }
  // A one or two tile wheel has no other arrangement; nothing else can fail to find one.
  return best || lv.letters.slice();
}
