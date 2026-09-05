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
 * ম actually wants, rather than counting through a grid of every level in the game.
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
  ["ঁ", "চন্দ্রবিন্দু", "স্বরকে নাকিসুরে উচ্চারণ করায় - চাঁদ, হাঁস"],
  ["ং", "অনুস্বার", "শব্দের শেষে নাকের সুর - রঙ, ফড়িং"],
  ["্", "হসন্ত", "দুই ব্যঞ্জনবর্ণকে জুড়ে একটি করে - ন + ্ + ধ মিলে ন্ধ, যেমন বন্ধু"]
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

/*
 * Each vowel beside the sign it becomes, one colour per pair.
 *
 * The table under this names every sign - "ই-কার" - and shows it attached to ক, as কি. What it
 * never shows is ই and ি side by side, so the name is the only thing telling a child that the
 * sign came from that letter, and a name is a thing you have to be able to read already.
 *
 * The sign is drawn, not typed. A কার is a combining mark, so as text it needs something to
 * combine with: alone, ু ূ and ৃ have zero advance width and paint nothing at all, and on a
 * space the shaper inserts a dotted circle - ◌া - which is the right Unicode answer to "a mark
 * with no base" and the wrong one to "show me the sign". So it comes from the face as an
 * outline instead, extracted at build time by kar_shapes in tools/build.py: the same shape the
 * game writes with, owing nothing to a shaper or a platform's idea of an orphan mark.
 *
 * Five colours for ten pairs. The colour's job is to bind a letter to its own sign inside one
 * pair, not to be unique across all ten, and the palette has five block colours - so they
 * cycle, and no two neighbours share one. A new pigment here would be a new pigment outside
 * theme.css, which the feel check refuses for good reason.
 */
function drawKarPairs() {
  const box = document.getElementById("karPairs");
  if (!box) return;
  box.innerHTML = "";
  KARS.forEach(([sign, name, vowel], i) => {
    const pair = document.createElement("div");
    pair.className = "pair";
    pair.dataset.block = (i % 5) + 1;
    // Read as one thing - "ই-কার" - rather than as two glyphs, one of which is a lone mark.
    pair.setAttribute("aria-label", name);
    const shape = KAR_SHAPES[sign];
    pair.innerHTML = `<span class="pair-v bn" aria-hidden="true">${vowel}</span>`
      + `<span class="pair-k">`
      // Flipped, because font coordinates run up the page and SVG's run down it.
      + `<svg viewBox="${shape.box}" aria-hidden="true" focusable="false">`
      + `<g transform="scale(1,-1)" fill="currentColor">${shape.paths}</g></svg></span>`;
    box.appendChild(pair);
  });
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
      s.textContent = "খেলায় নেই";
      r.appendChild(s);
    }
    table.appendChild(r);
  };

  drawKarPairs();

  for (const [sign, name, vowel] of KARS) {
    row(`ক${sign}`, name, `বর্ণের উপর ${vowel} লেখে`, exampleWord(sign));
  }
  for (const [sign, name, note] of SIGNS) {
    const eg = exampleWord(sign);
    // হসন্ত on its own is an invisible mark, so the column shows the conjunct it produced in a
    // real word - which is the thing being explained anyway.
    const glyph = sign === "\u09cd" ? (eg ? eg.akshara : "\u0995\u09cd\u09a4") : `ক${sign}`;
    row(glyph, name, note, eg);
  }
}

/* ============================================================================
   বারোখড়ি - every consonant under every কার
   ============================================================================ */
/*
 * The table a Bengali child is actually set to learn: one consonant, then that consonant under
 * each vowel sign in turn - ক কা কি কী কু কূ কৃ কে কৈ কো কৌ কং. Twelve forms, which is what
 * বারোখড়ি counts.
 *
 * The game teaches these one at a time, a level per akshara, and only 91 of the 384 possible
 * consonant-and-কার forms have a level - because a level needs real words behind it and Bengali
 * simply has no কৈ words for most letters. So this is a reference rather than an index: all
 * twelve forms for any letter, with a level to open where one exists and a word from the game
 * where one does not.
 *
 * One letter's table at a time. Thirty-two letters by twelve forms is 384 rows, which is a wall
 * rather than a lesson; a picker and one table is how a primer does it too - one page per letter.
 */
const BARO_FORMS = [
  ["", "বর্ণ নিজেই"], ["া", "আ-কার"], ["ি", "ই-কার"], ["ী", "ঈ-কার"],
  ["ু", "উ-কার"], ["ূ", "ঊ-কার"], ["ৃ", "ঋ-কার"], ["ে", "এ-কার"],
  ["ৈ", "ঐ-কার"], ["ো", "ও-কার"], ["ৌ", "ঔ-কার"], ["ং", "অনুস্বার"]
];

/* The level whose whole subject is this akshara, if the game has one. */
const LEVEL_FOR_AKSHARA = (() => {
  const of = {};
  LEVELS.forEach((lv, i) => { if (!(lv.name in of)) of[lv.name] = i; });
  return of;
})();

/**
 * A word showing this akshara, and where it came from.
 *
 * A board word first, because that one can be played: tapping it opens the level it sits on.
 * Failing that, KAR_WORDS - a word from the vocabulary pool or from wordfreq, vetted by hand
 * and glossed, which exists to fill a form no board reaches. Those are not in the game, so
 * they are shown and not offered as somewhere to go.
 */
function wordShowing(akshara) {
  let best = null;
  LEVELS.forEach((lv, i) => {
    for (const w of lv.words) {
      const parts = splitAksharas(w);
      const rank = parts[0] === akshara ? 0 : (parts.includes(akshara) ? 1 : 2);
      if (rank === 2) continue;
      const cost = [rank, parts.length];
      if (!best || cost[0] < best.cost[0]
          || (cost[0] === best.cost[0] && cost[1] < best.cost[1])) {
        best = { word: w, level: i, cost, inGame: true };
      }
    }
  });
  if (best) return best;
  const outside = KAR_WORDS[akshara];
  return outside ? { word: outside.w, gloss: outside.en, inGame: false } : null;
}

let baroLetter = "ক";

function drawBaro() {
  const pick = document.getElementById("baroPick");
  if (pick.childElementCount === 0) {
    for (const letter of BYANJANBARNA) {
      const b = document.createElement("button");
      b.className = "bp bn";
      b.type = "button";
      b.textContent = letter;
      b.addEventListener("click", () => { baroLetter = letter; drawBaro(); });
      pick.appendChild(b);
    }
  }
  for (const b of pick.children) b.classList.toggle("on", b.textContent === baroLetter);

  const table = document.getElementById("baroTable");
  table.innerHTML = "";
  for (const [sign, name] of BARO_FORMS) {
    const akshara = baroLetter + sign;
    const row = document.createElement("div");
    row.className = "br";
    row.innerHTML = `<span class="br-f bn">${akshara}</span><span class="br-n bn">${name}</span>`;

    const lvl = LEVEL_FOR_AKSHARA[akshara];
    const eg = wordShowing(akshara);

    if (lvl !== undefined || (eg && eg.inGame)) {
      // Playable: the form's own level, or the level of a word carrying it.
      const open = lvl !== undefined ? lvl : eg.level;
      const go = document.createElement("button");
      go.className = "br-go bn" + (lvl !== undefined ? " br-lvl" : "");
      go.type = "button";
      go.textContent = lvl !== undefined ? `${akshara} লেভেল` : eg.word;
      go.title = `লেভেল ${bn(open + 1)} খুলুন`;
      go.addEventListener("click", () => { loadLevel(open); leaveMenu(); });
      row.appendChild(go);
    } else if (eg) {
      // A real Bengali word, but not one this game sets as a puzzle - so it is shown with its
      // meaning and is not a button, because there is no level behind it to open.
      const out = document.createElement("span");
      out.className = "br-go br-out bn";
      out.textContent = eg.word;
      out.title = eg.gloss;
      row.appendChild(out);
      const note = document.createElement("span");
      note.className = "br-gloss bn";
      note.textContent = eg.gloss;
      row.insertBefore(note, out);
    } else {
      // Not a gap: no everyday word puts this consonant under this sign. Usually nothing in
      // 120,000 attested words carries it at all; sometimes the only things that do are a
      // place name, a misspelling, or a word this game will not set a child (see `refused`
      // in tools/kar-words.json). Said rather than left blank, and said as "not in everyday
      // Bengali" rather than "not in Bengali", which would not be true of all of them.
      const none = document.createElement("span");
      none.className = "br-go br-none bn";
      none.textContent = "চলিত বাংলায় নেই";
      row.appendChild(none);
    }
    table.appendChild(row);
  }
}

/* ---- the menu bar ---------------------------------------------------------------------- */

const MENU_KEY = "shobdojot.page";
const opts = [...document.querySelectorAll("#menuPop .opt")];

/* Which section is on screen, and the head that names it. The head used to say "মেনু" above a
   bar of ten pills, on a sheet opened from a button also marked মেনু: three chances to say the
   same word and none to say which of the ten you were reading. */
function showPage(key, remember = true) {
  let title = "";
  for (const opt of opts) {
    const on = opt.dataset.page === key;
    opt.classList.toggle("on", on);
    // A menu item is not a tab, so it is not `aria-selected`. `aria-current` is the one that
    // says "this is the one you are on" for a list of destinations.
    if (on) opt.setAttribute("aria-current", "true");
    else opt.removeAttribute("aria-current");
    if (on) title = opt.querySelector(".opt-t b").textContent;
  }
  for (const page of document.querySelectorAll(".pages .page")) {
    page.classList.toggle("on", page.id === `page-${key}`);
    // The head names the section, so a section opening with its own name says it twice. Seven
    // of the ten do; three open on something longer than their name and are left alone. Decided
    // on the words rather than on the markup, so a heading that is edited to say something new
    // comes back on its own.
    const first = page.querySelector("h3");
    if (first) first.classList.toggle("dup", first.textContent.trim() === title);
  }
  if (el.guideTitle) el.guideTitle.textContent = title;
  markTab(key);
  // Which section you were reading is a per-device convenience, so it goes in localStorage and
  // is allowed to fail: a private window or blocked site data must not break the menu.
  if (remember) { try { localStorage.setItem(MENU_KEY, key); } catch {} }
}

/*
 * The tab bar. Each tab opens one group, which is what makes four tabs four different things
 * rather than four ways to open the same list, and pressing the tab that is already open
 * closes it - the way every bar like this behaves.
 *
 * Except where the group holds one option. বর্ণমালা does, since its three sections became one,
 * and a panel offering a single card is a tap that asks a child to confirm the thing they just
 * asked for. Such a tab goes straight to its section: same press, one fewer step, and pressing
 * it again closes what it opened, which is the behaviour a tab bar had anyway.
 *
 * Read off the DOM rather than listed here, so merging or splitting a group changes this on its
 * own. The option is still reachable as a card - the sheet's ‹ মেনু opens all four groups - so
 * nothing is lost from the menu, only from the route.
 */
const tabs = [...document.querySelectorAll("#tabbar .tb")];

/** The page a tab leads to when its group holds exactly one option, or null. */
function loneSection(block) {
  const group = document.querySelector(`#menuPop .menu-group[data-block="${block}"]`);
  const only = group ? [...group.querySelectorAll(".opt")] : [];
  return only.length === 1 ? only[0].dataset.page : null;
}

for (const tab of tabs) {
  const lone = loneSection(tab.dataset.block);
  if (lone) {
    // It raises no menu, so it must not claim to. `aria-haspopup` on a control that goes
    // somewhere tells a screen reader to expect a list that never comes.
    tab.dataset.straight = lone;
    tab.removeAttribute("aria-haspopup");
    tab.removeAttribute("aria-expanded");
  }
  tab.addEventListener("click", () => {
    const block = tab.dataset.block;
    const straight = tab.dataset.straight;
    if (straight) {
      closeMenu(false);
      const here = document.getElementById(`page-${straight}`);
      if (guideIsOpen() && here && here.classList.contains("on")) { closeGuide(); return; }
      showPage(straight);
      chooseSection();
      return;
    }
    if (menuIsOpen() && el.menuPop.dataset.only === block) closeMenu();
    else openMenu(block);
  });
}

/** Which tab holds the section on screen, so the bar says where you are. */
function markTab(key) {
  const holder = document.getElementById(`opt-${key}`);
  const block = holder ? holder.closest(".menu-group").dataset.block : null;
  for (const tab of tabs) {
    if (tab.dataset.block === block) tab.setAttribute("aria-current", "true");
    else tab.removeAttribute("aria-current");
  }
}

for (const opt of opts) {
  opt.id = `opt-${opt.dataset.page}`;
  opt.addEventListener("click", () => {
    showPage(opt.dataset.page);
    chooseSection();
  });
}

/* Arrow keys walk the options, Home and End jump to the ends. A menu that can only be used
   with a pointer is a menu half the people who need it most cannot use. */
el.menuPop.addEventListener("keydown", e => {
  const here = opts.indexOf(document.activeElement);
  if (here < 0) return;
  const step = { ArrowDown: 1, ArrowUp: -1, Home: -here, End: opts.length - 1 - here }[e.key];
  if (step === undefined) return;
  e.preventDefault();
  opts[(here + step + opts.length) % opts.length].focus();
});

drawCharts();
drawBaro();

let opening = "levels";
try {
  const saved = localStorage.getItem(MENU_KEY);
  if (saved && opts.some(o => o.dataset.page === saved)) opening = saved;
} catch { /* no stored preference; levels it is */ }
showPage(opening, false);
