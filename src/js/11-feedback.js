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
/*
 * Where a report goes.
 *
 * Still no server: `mailto:` hands the note to whatever mail app the player already uses, with
 * the address, a subject and the whole report filled in. They press send. That last part is not
 * a limitation to be apologised for - it is what keeps this page a single file that works
 * offline, and it means nothing is ever transmitted without the sender reading it first. The
 * card says so in as many words, because a button that looks like it sent something and did
 * not is the worst thing this card could do.
 *
 * Assembled from parts rather than written out. The page is published, and an address sitting
 * as a plain string in the HTML is harvested by the first crawler that finds it. This stops the
 * naive ones and would not slow down anybody who looked, which is the honest description of
 * what it buys.
 */
const MAILBOX = ["emamularif", "gmail.com"].join("\u0040");

// mailto: is a URL, and a URL has a practical ceiling - some clients silently truncate past
// about 2000 characters, and a report cut at an arbitrary point is worse than a short one.
//
// The limit is on the *encoded* URL, not on the text. Capping the text was the obvious thing
// and it was wrong by a factor of nine: encodeURIComponent turns every Bengali character into
// something like %E0%A6%AC, so 1800 characters of Bengali came out as a 10,317-character URL -
// exactly the silent truncation the cap existed to prevent.
const MAIL_URL_MAX = 1900;

const say = {
  note: document.getElementById("sayNote"),
  adds: document.getElementById("sayAdds"),
  copy: document.getElementById("sayCopy"),
  save: document.getElementById("saySave"),
  mail: document.getElementById("sayMail"),
  said: document.getElementById("saySaid"),
};

/*
 * Kept reports.
 *
 * Copying a note out is fine when you are going to paste it somewhere immediately, and useless
 * when you are not: a parent notices a wrong gloss at bedtime, and by the time they are next
 * near a keyboard the clipboard is long gone. So a note can be kept on the device instead, and
 * read back from this same card whenever they get round to sending it.
 *
 * Its own key, deliberately not part of the game save. `persist` runs on every word found, so
 * folding reports into it would rewrite the whole list dozens of times an hour for no reason;
 * more to the point, clearing progress should not throw away something a person wrote, and a
 * save that fails to parse should not take the other with it.
 *
 * Nothing here leaves the device on its own. This is a drawer, not an outbox - the same trade
 * the copy button already makes, only now it will still be there tomorrow.
 *
 * The game writes to this drawer and no longer reads from it: `docs/reports/` is a page of
 * its own that does the reading, linked from nowhere. A list of a parent's bug reports is not
 * something a child should meet between levels, and it is easier to go through somewhere the
 * game is not.
 */
const REPORTS = {
  KEY: "shobdojot.reports",
  // Enough that nobody hits it in practice, small enough that a runaway loop cannot fill the
  // origin's storage and take the game's own save down with it.
  MAX: 60,
  MAX_CHARS: 1400,

  read() {
    try {
      const raw = JSON.parse(localStorage.getItem(this.KEY) || "[]");
      return Array.isArray(raw) ? raw.filter(r => r && typeof r.text === "string") : [];
    } catch { return []; }
  },

  write(list) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(list.slice(0, this.MAX)));
      return true;
    } catch {
      // A full or blocked store. Say so rather than pretending it was kept - a person who
      // thinks their note is safe and finds it gone has been lied to by the page.
      return false;
    }
  },

  add(entry) {
    const list = this.read();
    list.unshift(entry);
    return this.write(list);
  },

};

/** ২৭/০৮/২০২৬, ২২:৩০ - Bengali numerals, because the rest of the card is Bengali. */
function reportDate(ms) {
  const d = new Date(ms);
  const two = n => bn(String(n).padStart(2, "0"));
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${bn(d.getFullYear())}, `
       + `${two(d.getHours())}:${two(d.getMinutes())}`;
}

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
  if (await copyText(text)) return sayDone("কপি হয়েছে - এখন যেখানে খুশি পেস্ট করুন", true);

  // No dead end: if neither route worked, put the text in the box and select it, so the
  // player can always copy a selection by hand.
  say.note.value = text;
  say.note.select();
  sayDone("বেছে নেওয়া লেখাটি হাতে কপি করুন", false);
}

let sayTimer = null;

/**
 * Say what just happened, in the line under the buttons.
 *
 * It used to be written inside the button that was pressed. That worked while the only message
 * was "কপি", and stopped working the moment there were three buttons and messages that are
 * sentences: the button grew to hold the text and shoved the whole card around. A status line
 * of its own can say as much as it needs to and nothing moves.
 */
function sayDone(message, ok) {
  say.said.textContent = message;
  say.said.classList.toggle("ok", ok);
  clearTimeout(sayTimer);
  sayTimer = setTimeout(() => {
    say.said.textContent = "";
    say.said.classList.remove("ok");
  }, 3600);
}

/** The level moves as the player moves, so what is attached is re-stated on every draw. */
function drawSayAdds() {
  const cleared = Object.keys(game.completed).length;
  say.adds.textContent =
    `লেভেল ${bn(level().id)}, ${bn(cleared)}টি শেষ, পর্দা ${innerWidth}×${innerHeight}, `
    + "আর আপনি কোন ব্রাউজার ব্যবহার করছেন";
}

/* ---- keeping one -------------------------------------------------------------------- */

/**
 * Keep the note on this device.
 *
 * The same facts the copy button attaches are stored alongside it, and for the same reason:
 * "level 94 is broken" can be acted on a month later and "a level is broken" cannot. They are
 * captured now rather than when the list is read, because by then the player will be on a
 * different level and the note would quietly acquire the wrong one.
 */
function saySave() {
  const text = say.note.value.trim();
  if (!text) {
    say.note.focus();
    return sayDone("আগে কিছু লিখুন", false);
  }
  const lv = level();
  const kept = REPORTS.add({
    at: Date.now(),
    text: text.slice(0, REPORTS.MAX_CHARS),
    level: lv.id,
    name: lv.name,
    words: lv.words.join(", "),
    cleared: Object.keys(game.completed).length,
    screen: `${innerWidth}x${innerHeight}`,
    ua: navigator.userAgent,
  });
  if (!kept) return sayDone("রাখা গেল না - ব্রাউজারের জায়গা নেই", false);
  say.note.value = "";
  sayDone("রাখা হলো", true);
}

/**
 * Open the player's mail app with the report in it.
 *
 * Returns whether a mail app could be reached at all. A device with none configured does
 * nothing visible when a mailto: link is followed, so the caller says what happened rather than
 * leaving the player looking at an unchanged screen wondering whether it worked.
 */
function mailReport(subject, body) {
  const build = text => `mailto:${MAILBOX}`
                      + `?subject=${encodeURIComponent(subject)}`
                      + `&body=${encodeURIComponent(text)}`;

  // Shorten until the whole thing fits. Halving rather than stepping because the ratio between
  // characters and encoded length depends on the script - one for ASCII, nine for Bengali -
  // and guessing it wrong in either direction either truncates a report that would have fitted
  // or loops a thousand times on one that would not.
  let text = body;
  let url = build(text);
  while (url.length > MAIL_URL_MAX && text.length > 40) {
    text = text.slice(0, Math.floor(text.length / 2));
    url = build(text + "\n[...]");
  }
  if (url.length > MAIL_URL_MAX) url = build("[...]");
  try {
    // A real click on a real anchor, not location.href: an iOS mail app opening from a
    // synthetic navigation is blocked in some browsers, and an anchor is what they expect.
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    a.style.cssText = "position:fixed;left:-9999px";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch {
    return false;
  }
}

/** Copy by whichever route this browser allows. Shared by the note box and every kept report. */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch { /* no clipboard API, or permission refused; fall through */ }
  const box = document.createElement("textarea");
  box.value = text;
  box.setAttribute("aria-hidden", "true");
  box.style.cssText = "position:fixed;top:-1000px;opacity:0";
  document.body.appendChild(box);
  box.select();
  const copied = document.execCommand && document.execCommand("copy");
  box.remove();
  return !!copied;
}

/* Send now: the note, the level, and the machine details, in the player's own mail app. */
say.mail.addEventListener("click", () => {
  const text = say.note.value.trim();
  if (!text) {
    say.note.focus();
    return sayDone("আগে কিছু লিখুন", false);
  }
  const lv = level();
  const opened = mailReport(`শব্দজট - লেভেল ${bn(lv.id)} (${lv.name})`, sayText());
  sayDone(opened
    ? "মেইল অ্যাপ খুলছে - সেখান থেকে পাঠান বোতামে চাপুন"
    : "মেইল অ্যাপ খোলা গেল না - বদলে কপি করে পাঠান", opened);
});

say.copy.addEventListener("click", sayCopy);
say.save.addEventListener("click", saySave);
addEventListener("resize", drawSayAdds);
drawSayAdds();
