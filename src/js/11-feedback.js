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
  copy: document.getElementById("sayCopy"),
  save: document.getElementById("saySave"),
  said: document.getElementById("saySaid"),
  list: document.getElementById("sayList"),
  count: document.getElementById("sayCount"),
  all: document.getElementById("sayAll")
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

  remove(at) {
    return this.write(this.read().filter(r => r.at !== at));
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
  drawReports();
  sayDone("রাখা হলো - নিচের তালিকায় আছে", true);
}

/** One kept report as text, in the same shape the copy button produces. */
function reportText(r) {
  return [
    r.text,
    "",
    `-- শব্দজট, ${reportDate(r.at)}`,
    `   লেভেল ${bn(r.level)}${r.name ? ` (${r.name})` : ""}: ${r.words || ""}`,
    `   ${bn(r.cleared || 0)}টি শেষ, পর্দা ${r.screen || ""}`,
    `   ${r.ua || ""}`,
  ].join("\n");
}

/* ---- reading them back ---------------------------------------------------------------- */

function drawReports() {
  const list = REPORTS.read();
  say.count.textContent = list.length ? `${bn(list.length)}টি` : "";
  say.all.hidden = list.length < 2;
  say.list.innerHTML = "";
  if (!list.length) {
    const none = document.createElement("p");
    none.className = "rp-none bn";
    none.textContent = "এখনো কিছু রাখা হয়নি।";
    say.list.appendChild(none);
    return;
  }
  for (const r of list) {
    const row = document.createElement("article");
    row.className = "rp";

    const when = document.createElement("p");
    when.className = "rp-when bn";
    when.textContent = `${reportDate(r.at)} · লেভেল ${bn(r.level)}${r.name ? ` (${r.name})` : ""}`;

    // textContent, never innerHTML: this is text the player typed, and it goes back on screen
    // exactly as typed rather than as markup.
    const body = document.createElement("p");
    body.className = "rp-text bn";
    body.textContent = r.text;

    const tools = document.createElement("div");
    tools.className = "rp-tools";

    const copy = document.createElement("button");
    copy.className = "rp-btn bn";
    copy.type = "button";
    copy.textContent = "কপি";
    copy.addEventListener("click", async () => {
      await copyText(reportText(r));
      copy.textContent = "কপি হয়েছে";
      setTimeout(() => { copy.textContent = "কপি"; }, 2000);
    });

    // Two presses to delete. A single one next to a copy button is how a person loses the note
    // they came here to send.
    const drop = document.createElement("button");
    drop.className = "rp-btn rp-drop bn";
    drop.type = "button";
    drop.textContent = "মুছুন";
    let armed = false;
    drop.addEventListener("click", () => {
      if (!armed) {
        armed = true;
        drop.textContent = "সত্যি মুছবেন?";
        drop.classList.add("armed");
        setTimeout(() => {
          if (!armed) return;
          armed = false;
          drop.textContent = "মুছুন";
          drop.classList.remove("armed");
        }, 3000);
        return;
      }
      REPORTS.remove(r.at);
      drawReports();
    });

    tools.append(copy, drop);
    row.append(when, body, tools);
    say.list.appendChild(row);
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

say.copy.addEventListener("click", sayCopy);
say.save.addEventListener("click", saySave);
say.all.addEventListener("click", async () => {
  const list = REPORTS.read();
  if (!list.length) return;
  // Oldest first when they go out together, so they read as a history rather than in reverse.
  const text = [...list].reverse().map(reportText).join("\n\n———\n\n");
  const ok = await copyText(text);
  sayDone(ok ? `${bn(list.length)}টি কপি হয়েছে` : "কপি করা গেল না", ok);
});
addEventListener("resize", drawSayAdds);
drawSayAdds();
drawReports();
