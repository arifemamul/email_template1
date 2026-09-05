/* ============================================================================
   Play
   ============================================================================ */

/*
 * How long the finished board stays on screen before the next one arrives.
 *
 * This used to be nothing at all: the last letters landed and `loadLevel` ran in the same
 * frame. The reasoning was that a child should not be made to wait, and it was wrong in a way
 * no test here caught - `advancetest` checked that clearing advances and that the next board
 * is blank, which is precisely the behaviour that hides the reward. The mechanism was verified
 * and nobody asked whether a human could see it.
 *
 * Measured on the real thing: the completed board was on screen for about no frames at all,
 * and the confetti and the stars were thrown over the *next* level's empty grid. On a phone
 * with iOS Reduce Motion turned on it was worse - the whole reward was skipped and the level
 * simply changed, which is how this came back as a bug report from an iPhone.
 *
 * So: the letters land, the board is celebrated, and it is then held for a beat that a person
 * can actually use. The hold is not an animation and does not scale with one - it applies on
 * every device and under every motion preference, because being given time to look at
 * something is not movement.
 */
const SHOW_CLEARED = 1200;

let verdictTimer = null;

function showVerdict(word, result, ms = 720) {
  game.verdict = { word, result };
  render();
  clearTimeout(verdictTimer);
  verdictTimer = setTimeout(() => { game.verdict = null; render(); }, ms);
}

function submitWord() {
  const word = currentWord();
  game.picked = [];
  game.tapMode = false;
  soundPick();
  render();
  if (!word) return;

  const lv = level();
  const done = foundSet();

  // -- a word on the board ---------------------------------------------------
  if (lv.words.includes(word)) {
    if (done.has(word)) {
      showVerdict(word, "dup");
      Sfx.dup();
      knockWord(word);
      return;
    }

    done.add(word);
    game.found[lv.id] = [...done];
    // Every word found brings the next hint fifteen seconds closer. Before `persist`, so the
    // credit is saved with the word that earned it.
    creditHint();

    const cleared = done.size === lv.words.length;
    if (cleared) game.completed[lv.id] = true;
    persist();

    // The verdict chip is held as long as the board is, so the word a child just found is
    // still named on screen while they look at where it landed.
    showVerdict(word, "correct", cleared ? SHOW_CLEARED + 400 : undefined);
    // The reward, in this order: the tone first because it is instant, then the bird.
    if (!cleared) { Sfx.good(); Bird.say("cheer", 700); }
    const placed = game.puzzle.words.find(w => w.word === word);
    // A backstop, not a substitute for the guards inside. Everything below this line is the
    // game working; everything in `flyLettersToBoard` is the game looking nice. If some engine
    // finds a way to break the second, it must not be allowed to take the first with it - the
    // word is already recorded and saved by now, and the board still has to catch up.
    let settle = 0;
    try {
      if (placed) settle = flyLettersToBoard(word, placed.cells) || 0;
    } catch (err) {
      settle = 0;
    }
    setTimeout(() => {
      render();
      drawLevelGrid();
    }, settle);

    if (cleared) {
      // Three moments, not one. The letters land, then the finished board is celebrated -
      // over the board that was finished, which is the whole point and was not true before -
      // and only then does the next level arrive.
      setTimeout(celebrateBoard, settle);
      setTimeout(() => loadLevel(game.index + 1), settle + SHOW_CLEARED);
    }
    return;
  }

  // -- not a word here ------------------------------------------------------
  // Soft and low rather than a buzzer. A child at this stage is guessing, which is the
  // correct thing to be doing, and the game should not sound like it disagrees.
  showVerdict(word, "wrong");
  Sfx.bad();
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
  soundPick();
  render();
});

el.wheel.addEventListener("pointermove", e => {
  if (!game.dragging) return;
  if (!game.moved && Math.hypot(e.clientX - startPoint[0], e.clientY - startPoint[1]) > 9) {
    game.moved = true;
    game.tapMode = false;
  }
  if (!game.moved) return;

  // The only draw in the file that is not `render`, and the only one that should be: this runs
  // on every pointer move, not just the ones that change the selection, and all it has to do
  // is keep the loose end of the trail under the finger. Nothing else on screen has changed.
  const rect = el.wheel.getBoundingClientRect();
  drawTrail([e.clientX - rect.left, e.clientY - rect.top]);

  const i = tileAt(e.clientX, e.clientY);
  if (i === null) return;
  if (game.picked.length >= 2 && i === game.picked[game.picked.length - 2]) game.picked.pop();
  else if (!game.picked.includes(i)) game.picked.push(i);
  soundPick();
  render([e.clientX - rect.left, e.clientY - rect.top]);
});

function endDrag() {
  if (!game.dragging) return;
  game.dragging = false;
  if (game.moved) {
    submitWord();
  } else {
    game.tapMode = true;   // a plain click keeps the selection for more clicks
    render();
  }
}

el.wheel.addEventListener("pointerup", endDrag);
el.wheel.addEventListener("pointercancel", () => {
  game.dragging = false;
  if (!game.tapMode) { game.picked = []; soundPick(); render(); }
});

document.addEventListener("keydown", e => {
  if (e.key === "Enter" && game.picked.length) { e.preventDefault(); submitWord(); }
  if (e.key === "Escape") {
    if (guideIsOpen()) { closeGuide(); return; }
    game.picked = []; game.tapMode = false;
    soundPick(); render();
  }
});

/* controls */
el.hint.addEventListener("click", () => {
  if (hintWait() > 0) return;          // the button is disabled, but a keyboard can still fire
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
  game.hintAt = Date.now() + HINT_WAIT;
  Sfx.hint();
  persist();
  render();

  const cell = el.board.querySelector(`[data-pos="${target}"]`);
  if (cell && !reduced()) {
    cell.classList.add('arrive');
    setTimeout(() => cell.classList.remove('arrive'), 460);
  }
  el.hint.classList.remove('flash');
  void el.hint.offsetWidth;
  el.hint.classList.add('flash');
});

/*
 * The countdown has to move by itself, or the button is a number that lies until something
 * else happens to redraw the screen. One second is the resolution it shows, so one second is
 * how often it is asked. It runs only while there is something to count: `drawHint` clears
 * `cooling` when the wait reaches zero, and that same class is what stops this doing any work
 * for the rest of the game.
 */
setInterval(() => {
  if (hintWait() > 0 || el.hint.classList.contains("cooling")) drawHint();
}, 1000);

el.shuffle.addEventListener("click", () => {
  Sfx.shuffle();
  // remember where each letter was, so the tiles can slide rather than jump
  const before = new Map();
  el.wheel.querySelectorAll('.tile').forEach(t => before.set(t.textContent, t.getBoundingClientRect()));

  for (let i = game.wheel.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [game.wheel[i], game.wheel[j]] = [game.wheel[j], game.wheel[i]];
  }
  game.picked = [];
  game.tapMode = false;
  // No `soundPick`: the shuffle has its own sound, and clearing the shelf on the way is not a
  // thing the player did.
  drawScreen();
  render();
  animateShuffle(before);
});

/* The options, and the sheet they open.
 *
 * Two things, deliberately separate. The options are a panel that drops out of the bar and is
 * the same at every width. The sheet is where a chosen section is read, and it only exists on a
 * narrow screen - on a wide one the section is simply the right-hand column, always there.
 *
 * The button used to open the sheet directly, with the ten sections as a bar of pills inside
 * it. That put a child two decisions deep before anything was named: press মেনু, then read ten
 * identical pills to find out what mostly was not what they wanted. */
const menuIsOpen = () => !el.menuPop.hidden;
const guideIsOpen = () => el.guide.classList.contains("open");

/* The phone sheet hangs off the bottom of the bar, and the bar's height depends on the font,
   the safe area and whether the strapline fits - so it is measured rather than guessed. */
function markBar() {
  if (el.bar) {
    document.documentElement.style.setProperty("--bar-bottom",
      Math.round(el.bar.getBoundingClientRect().bottom) + "px");
  }
  // The options sit on top of the tab bar, and its height depends on the phone's safe area -
  // measured rather than guessed, for the same reason the top bar's was.
  if (el.tabbar) {
    document.documentElement.style.setProperty("--tabbar-h",
      Math.round(el.tabbar.getBoundingClientRect().height) + "px");
  }
}

/*
 * `block` names one group of options, which is what a tab at the foot of the screen asks for.
 * Without it - the button in the top bar on a wide screen - the panel shows all four.
 */
function openMenu(block) {
  markBar();
  if (block) el.menuPop.dataset.only = block;
  else delete el.menuPop.dataset.only;
  el.menuPop.hidden = false;
  el.scrim.hidden = false;
  el.guideOpen.setAttribute("aria-expanded", "true");
  // Only the tabs that actually raise the panel. A tab whose group holds one option goes
  // straight to its section and carries no `aria-haspopup`, so an `aria-expanded` written here
  // would put the attribute back on a control that has nothing to expand.
  for (const tab of el.tabbar.querySelectorAll(".tb[aria-haspopup]"))
    tab.setAttribute("aria-expanded", tab.dataset.block === block ? "true" : "false");
  Sfx.page(true);
  // Focus the option you are on if it is in the group being shown, and the first one otherwise:
  // focusing a hidden option puts the keyboard somewhere the screen is not.
  const shown = [...el.menuPop.querySelectorAll(".opt")].filter(o => o.offsetParent !== null);
  const here = shown.find(o => o.classList.contains("on")) || shown[0];
  if (here) here.focus();
}

function closeMenu(giveFocusBack = true) {
  if (el.menuPop.hidden) return;
  const from = el.menuPop.dataset.only;
  el.menuPop.hidden = true;
  el.scrim.hidden = true;
  el.guideOpen.setAttribute("aria-expanded", "false");
  for (const tab of el.tabbar.querySelectorAll(".tb[aria-haspopup]"))
    tab.setAttribute("aria-expanded", "false");
  // Back to whatever opened it, which on a phone is the tab rather than the top bar's button.
  if (!giveFocusBack) return;
  const tab = from && el.tabbar.querySelector(`.tb[data-block="${from}"]`);
  (tab && tab.offsetParent !== null ? tab : el.guideOpen).focus();
}

/* Choosing an option. On a phone that means opening the sheet to read it; on a wide screen the
   section is already on the page beside the game, so all that is left is to get the panel out
   of the way and put the focus where the reading is. */
function chooseSection() {
  closeMenu(false);
  if (window.matchMedia("(max-width: 1024px)").matches) openGuide();
  else el.guide.querySelector(".guide-title").focus?.();
}

function openGuide() {
  el.guide.classList.add("open");
  document.body.classList.add("guide-open");
  el.guide.scrollTop = 0;
  el.guideClose.focus();
}

function closeGuide() {
  el.guide.classList.remove("open");
  document.body.classList.remove("guide-open");
  el.guideOpen.focus();
}

/* Every place the prose states the level count, filled from the table rather than from a
   number typed into the copy - because the catalogue ships a slice of itself while the game is
   being reworked, and a hardcoded count is wrong the moment that slice changes.

   By class rather than by id, which is the repair. This used to name two ids, and a third
   mention was later written into the পরিচিতি essay with the number typed in. It said ২৪৪ for
   as long as it took someone to read that far: the game had grown past three hundred levels
   and nothing connected the sentence to the table. A class means the next mention only has to
   be marked, not wired, and `build.py check` fails if one carries a digit of its own. */
function drawLevelCount() {
  // Bengali, and in Bengali digits, because the sentence around it is Bengali. There is no
  // plural to agree with - বাংলায় একটি আর অনেকগুলো লেভেল একই শব্দ - which removes the
  // spelled-out-number table this used to carry for the English.
  const said = `${bn(LEVELS.length)}টি লেভেল`;
  for (const n of document.querySelectorAll(".lv-count")) n.textContent = said;
}
drawLevelCount();

el.guideOpen.addEventListener("click", () => (menuIsOpen() ? closeMenu() : openMenu()));
el.guideClose.addEventListener("click", closeGuide);

/* Back to the options rather than out altogether: someone who opened ফলা and wanted যুক্তবর্ণ
   should not have to close the sheet and start again. */
el.guideBack.addEventListener("click", () => {
  if (guideIsOpen()) closeGuide();
  openMenu();
});

/* Escape closes the innermost thing that is open, and a press outside the options closes them -
   the two ways anyone expects to get out of a menu. */
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (menuIsOpen()) closeMenu();
  else if (guideIsOpen()) closeGuide();
});

document.addEventListener("pointerdown", e => {
  if (!menuIsOpen()) return;
  if (e.target.closest("#menuPop") || e.target.closest("#guideOpen")) return;
  // The tab bar has its own handler, which toggles. Letting this one fire as well would close
  // the panel and then the tab would open it again, so pressing a tab would do nothing at all.
  if (e.target.closest("#tabbar")) return;
  closeMenu(false);
});

/* The bar only paints its background once the page has scrolled under it - see the comment on
   `.bar::after`. Passive, because this listener must never be a reason a scroll stutters. */
function markScrolled() {
  if (el.bar) el.bar.classList.toggle("stuck", scrollY > 4);
}
addEventListener("scroll", markScrolled, { passive: true });
markScrolled();

/* The bar's height changes with the width - the strapline drops out below 620px - so the sheet
   that hangs off it has to be re-measured rather than measured once. */
addEventListener("resize", markBar);
markBar();

// Picking a level from inside the sheet means the player wants to play it, so get out of the way.
el.levelGrid.addEventListener("click", e => {
  if (e.target.closest(".lv") && guideIsOpen()) closeGuide();
});

el.prev.addEventListener("click", () => { Sfx.page(false); loadLevel(game.index - 1); });
el.next.addEventListener("click", () => { Sfx.page(true); loadLevel(game.index + 1); });

/* The mute switch. Kept out of the top bar and the action row - those hold exactly what a
   child needs and nothing else - so it sits in the screen's corner, where a parent can find
   it and a player will not press it by accident. */
el.mute.addEventListener("click", () => {
  const muted = Sfx.toggle();
  el.mute.setAttribute("aria-pressed", muted ? "true" : "false");
  el.mute.textContent = muted ? "🔇" : "🔊";
  el.mute.title = muted ? "শব্দ চালু করুন" : "শব্দ বন্ধ করুন";
});

/* keep the board and wheel sized to the screen */
let resizeTimer = null;
new ResizeObserver(() => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { drawScreen(); render(); }, 60);
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
