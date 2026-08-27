/* ============================================================================
   The menu - the alphabet as a chart, and as the way into the game
   ============================================================================ */
/*
 * Six sections behind a menu bar, one on screen at a time.
 *
 * The guide used to be a single scroll with the level grid at the top, which meant everything
 * else was below the fold and a child looking for the letter chart had to already know it was
 * down there. Naming the places is most of the fix.
 *
 * The two alphabet charts are built from LEVELS rather than written out, and that is the point
 * of doing it here at all: a hand-written chart of the বর্ণমালা would keep claiming ক has
 * sixteen levels after a refit gave it eighteen, and would keep listing a letter after the
 * vocabulary lost it. Everything below counts what the game actually ships.
 *
 * The charts also navigate. Every letter that has a level is a button that opens the first of
 * them, so the chart is both the reference and the index - which is what a child scanning for
 * ম actually wants, rather than counting through a grid of 256.
 */

// The two halves of the alphabet, in recitation order. These are facts about the script rather
// than data about the game, so they are written out; the levels behind them are counted.
const SWARABARNA = [...'অআইঈউঊঋএঐওঔ'];
const BYANJANBARNA = [...'কখগঘঙচছজঝঞটঠডঢণতথদধনপফবভমযরলশষসহ'];

/*
 * The vowel signs, each with the vowel it writes. ঋ-কার is included because the game teaches it
 * (কৃষক), and ৗ is left out for the same reason curriculum.py leaves it out: it is not a sign of
 * its own in modern Bengali, only a piece of how ৌ decomposes.
 */
const KARS = [
  ["া", "আ-কার", "আ"], ["ি", "ই-কার", "ই"], ["ী", "ঈ-কার", "ঈ"],
  ["ু", "উ-কার", "উ"], ["ূ", "ঊ-কার", "ঊ"], ["ৃ", "ঋ-কার", "ঋ"],
  ["ে", "এ-কার", "এ"], ["ৈ", "ঐ-কার", "ঐ"], ["ো", "ও-কার", "ও"],
  ["ৌ", "ঔ-কার", "ঔ"]
];

/* The marks that are not কার. A child meets all three on the boards. */
const SIGNS = [
  ["ঁ", "চন্দ্রবিন্দু", "makes the vowel nasal - চাঁদ, হাঁস"],
  ["ং", "অনুস্বার", "a nasal ending - রঙ, ফড়িং"],
  ["্", "হসন্ত", "joins two consonants into one letter - ন + ্ + ধ makes ন্ধ, as in বন্ধু"]
];

/*
 * Opening a level from a chart should shut the sheet on a phone and do nothing on a desktop,
 * where the menu is simply part of the page and closeGuide would focus a hidden button.
 */
function leaveMenu() {
  if (el.guide.classList.contains("open")) closeGuide();
}

/** Which levels each letter has, in play order, counted from what the game shipped. */
const LEVELS_BY_LETTER = (() => {
  const of = {};
  LEVELS.forEach((lv, i) => {
    const letter = lv.name[0];
    (of[letter] = of[letter] || []).push(i);
  });
  return of;
})();

/*
 * A word from the game that shows this mark, chosen by the simplest AKSHARA carrying it rather
 * than the shortest word. The difference matters for হসন্ত: the shortest word containing it is
 * ঊর্ধ্ব, whose র্ধ্ব joins three consonants and a sign - true, and the worst possible first
 * example. Ranking by the akshara picks a plain two-consonant join instead.
 */
function exampleWord(mark) {
  let best = null;
  LEVELS.forEach((lv, i) => {
    for (const w of lv.words) {
      for (const akshara of splitAksharas(w)) {
        if (!akshara.includes(mark)) continue;
        const cost = [akshara.length, splitAksharas(w).length];
        if (!best || cost[0] < best.cost[0]
            || (cost[0] === best.cost[0] && cost[1] < best.cost[1])) {
          best = { word: w, level: i, akshara, cost };
        }
      }
    }
  });
  return best;
}

/** One letter of a chart: the letter, how many levels it has, and a way in. */
function letterTile(letter) {
  const levels = LEVELS_BY_LETTER[letter] || [];
  const tile = document.createElement(levels.length ? "button" : "div");
  tile.className = "ch" + (levels.length ? "" : " ch-none");
  tile.innerHTML = `<span class="ch-l bn">${letter}</span>`
    + `<span class="ch-n">${levels.length ? bn(levels.length) : "\u2014"}</span>`;
  if (levels.length) {
    tile.type = "button";
    tile.title = `${letter} - ${levels.length} level${levels.length > 1 ? "s" : ""}, `
               + `from ${bn(levels[0] + 1)}`;
    tile.addEventListener("click", () => { loadLevel(levels[0]); leaveMenu(); });
  } else {
    // Said plainly rather than left as a blank: a letter with no level is not an oversight.
    tile.title = `${letter} - no level, because no Bengali word begins with it`;
  }
  return tile;
}

function drawCharts() {
  for (const [id, letters] of [["chartVowels", SWARABARNA],
                               ["chartConsonants", BYANJANBARNA]]) {
    const box = document.getElementById(id);
    box.innerHTML = "";
    letters.forEach(l => box.appendChild(letterTile(l)));
  }

  const table = document.getElementById("markTable");
  table.innerHTML = "";
  const row = (glyph, name, note, example) => {
    const r = document.createElement("div");
    r.className = "mk";
    r.innerHTML = `<span class="mk-g bn">${glyph}</span>`
      + `<span class="mk-n bn">${name}</span>`
      + `<span class="mk-w">${note}</span>`;
    if (example) {
      const b = document.createElement("button");
      b.className = "mk-eg bn";
      b.type = "button";
      b.textContent = example.word;
      b.title = `open level ${bn(example.level + 1)}`;
      b.addEventListener("click", () => { loadLevel(example.level); leaveMenu(); });
      r.appendChild(b);
    } else {
      // Only ever true if a refit dropped the last word carrying a sign, which is worth seeing.
      const s = document.createElement("span");
      s.className = "mk-eg mk-gone";
      s.textContent = "no word";
      r.appendChild(s);
    }
    table.appendChild(r);
  };

  for (const [sign, name, vowel] of KARS) {
    row(`ক${sign}`, name, `writes ${vowel} onto a letter`, exampleWord(sign));
  }
  for (const [sign, name, note] of SIGNS) {
    const eg = exampleWord(sign);
    // হসন্ত on its own is an invisible mark, so the column shows the conjunct it produced in a
    // real word - which is the thing being explained anyway.
    const glyph = sign === "\u09cd" ? (eg ? eg.akshara : "\u0995\u09cd\u09a4") : `ক${sign}`;
    row(glyph, name, note, eg);
  }
}

/* ---- the menu bar ---------------------------------------------------------------------- */

const MENU_KEY = "shobdojot.page";
const tabs = [...document.querySelectorAll("#menu .tab")];

function showPage(key, remember = true) {
  for (const tab of tabs) {
    const on = tab.dataset.page === key;
    tab.classList.toggle("on", on);
    tab.setAttribute("aria-selected", on ? "true" : "false");
  }
  for (const page of document.querySelectorAll(".pages .page")) {
    page.classList.toggle("on", page.id === `page-${key}`);
  }
  // Which section you were reading is a per-device convenience, so it goes in localStorage and
  // is allowed to fail: a private window or blocked site data must not break the menu.
  if (remember) { try { localStorage.setItem(MENU_KEY, key); } catch {} }
}

for (const tab of tabs) {
  tab.id = `tab-${tab.dataset.page}`;
  tab.addEventListener("click", () => showPage(tab.dataset.page));
}

drawCharts();

let opening = "levels";
try {
  const saved = localStorage.getItem(MENU_KEY);
  if (saved && tabs.some(t => t.dataset.page === saved)) opening = saved;
} catch { /* no stored preference; levels it is */ }
showPage(opening, false);
