/* ============================================================================
   Feedback - a note the player can carry out of the game
   ============================================================================ */
/*
 * There is no server behind this game, and that is not a gap waiting to be filled: no server
 * is what lets it play offline, cost nothing to run, and ask a child for no account. It does
 * leave a real hole, though - a parent who finds a wrong gloss among 629 words has nowhere to
 * say so, and they will find them long before anyone here does.
 *
 * So the note goes to the clipboard instead of to a server, and the player sends it on with
 * whatever they already use - WhatsApp, Messenger, mail. The trade is honest: one extra step
 * for them, and in exchange no backend, no third party reading it, no address in the page for
 * a scraper to harvest, and it still works with the network off.
 *
 * The level is attached because "level 94 is broken" can be acted on and "a level is broken"
 * cannot. What gets attached is named on screen next to the box, and the player reads the
 * whole thing in their own app before it goes anywhere - a page that gathers more than it
 * admits to is the thing being avoided here.
 */
const say = {
  note: document.getElementById("sayNote"),
  adds: document.getElementById("sayAdds"),
  copy: document.getElementById("sayCopy")
};

/**
 * The note, plus the few facts that make it actionable. Deliberately short: the level and its
 * words, how far in the player is, the screen the bug was seen on, and the browser - which is
 * the one line that explains most rendering complaints on its own.
 */
function sayText() {
  const lv = level();
  const cleared = Object.keys(game.completed).length;
  return [
    say.note.value.trim(),
    "",
    `-- শব্দজট, লেভেল ${bn(lv.id)} / ${bn(LEVELS.length)}: ${lv.words.join(", ")}`,
    `   ${bn(LEVELS.length)}টির মধ্যে ${bn(cleared)}টি শেষ`,
    `   পর্দা ${innerWidth}x${innerHeight}`,
    `   ${navigator.userAgent}`
  ].join("\n");
}

/**
 * Copy, by whichever route this browser allows.
 *
 * `navigator.clipboard` needs a secure origin, so it is there on the real site and missing
 * from a `file://` copy of the page. `execCommand` is deprecated and still the thing that
 * works when it is. If neither does, the text goes into the box itself and is selected: the
 * player can always copy a selection by hand, so there is no dead end - the button never
 * simply fails to do anything.
 */
async function sayCopy() {
  if (!say.note.value.trim()) {
    say.note.focus();
    return sayDone("আগে কিছু লিখুন", false);
  }
  const text = sayText();
  try {
    await navigator.clipboard.writeText(text);
    return sayDone("কপি হয়েছে - এখন যেখানে খুশি পেস্ট করুন", true);
  } catch { /* no clipboard API, or permission refused; fall through */ }

  const box = document.createElement("textarea");
  box.value = text;
  box.setAttribute("aria-hidden", "true");
  box.style.cssText = "position:fixed;top:-1000px;opacity:0";
  document.body.appendChild(box);
  box.select();
  const copied = document.execCommand && document.execCommand("copy");
  box.remove();
  if (copied) return sayDone("কপি হয়েছে - এখন যেখানে খুশি পেস্ট করুন", true);

  say.note.value = text;
  say.note.select();
  sayDone("বেছে নেওয়া লেখাটি হাতে কপি করুন", false);
}

let sayTimer = null;

/** Say what happened on the button itself, then let it settle back. */
function sayDone(message, ok) {
  const label = say.copy.querySelector(".say-en");
  label.textContent = message;
  say.copy.classList.toggle("ok", ok);
  clearTimeout(sayTimer);
  sayTimer = setTimeout(() => {
    label.textContent = "কপি";
    say.copy.classList.remove("ok");
  }, 3200);
}

/** The level moves as the player moves, so what is attached is re-stated on every draw. */
function drawSayAdds() {
  const cleared = Object.keys(game.completed).length;
  say.adds.textContent =
    `লেভেল ${bn(level().id)}, ${bn(cleared)}টি শেষ, পর্দা ${innerWidth}×${innerHeight}, `
    + "আর আপনি কোন ব্রাউজার ব্যবহার করছেন";
}

say.copy.addEventListener("click", sayCopy);
addEventListener("resize", drawSayAdds);
drawSayAdds();
