/* ============================================================================
   The reports page - a reader for what the game kept
   ============================================================================ */

/*
 * A page of its own, linked from nowhere.
 *
 * The game can save a note to the device. This reads them back somewhere the game is not, so
 * they can be gone through properly rather than in a panel between levels.
 *
 * What "private" means here is worth being exact about, because the obvious reading is wrong.
 * The URL is not a secret and is not a password: this file sits in the same published folder
 * as the game and anyone who types its name can open it. What protects the notes is that they
 * are in `localStorage`, which belongs to one browser on one device. A stranger opening this
 * page sees their own empty store. There is nothing here to leak because there is nothing here
 * until the device that wrote the notes opens it.
 *
 * The flip side of the same fact: notes written on a phone are not visible on a laptop, and
 * clearing site data takes them. This page cannot fix that - it is a reader, not a server.
 *
 * Deliberately standalone. It shares the game's palette and its storage key and no code at
 * all: the game is 3,600 lines that need a board, a wheel and an audio engine, and none of
 * that should have to load to read a list of notes.
 */
const KEY = "shobdojot.reports";

const el = {
  list: document.getElementById("list"),
  total: document.getElementById("total"),
  bar: document.getElementById("bar"),
};

const BN = "০১২৩৪৫৬৭৮৯";
const bn = n => String(n).replace(/\d/g, d => BN[+d]);

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? raw.filter(r => r && typeof r.text === "string") : [];
  } catch {
    // Rubbish in the key, or storage blocked outright. An empty list and a working page beats
    // a stack trace either way.
    return [];
  }
}

function write(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); return true; }
  catch { return false; }
}

function when(ms) {
  const d = new Date(ms);
  const two = n => bn(String(n).padStart(2, "0"));
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${bn(d.getFullYear())}, `
       + `${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** One report as plain text - the same shape the game's own copy button produces. */
function asText(r) {
  return [
    r.text,
    "",
    `-- শব্দজট, ${when(r.at)}`,
    `   লেভেল ${bn(r.level)}${r.name ? ` (${r.name})` : ""}: ${r.words || ""}`,
    `   ${bn(r.cleared || 0)}টি শেষ, পর্দা ${r.screen || ""}`,
    `   ${r.ua || ""}`,
  ].join("\n");
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { /* needs a secure origin; fall through */ }
  const box = document.createElement("textarea");
  box.value = text;
  box.setAttribute("aria-hidden", "true");
  box.style.cssText = "position:fixed;top:-1000px;opacity:0";
  document.body.appendChild(box);
  box.select();
  const ok = document.execCommand && document.execCommand("copy");
  box.remove();
  return !!ok;
}

function button(label, cls, onClick) {
  const b = document.createElement("button");
  b.className = "rp-btn bn" + (cls ? " " + cls : "");
  b.type = "button";
  b.textContent = label;
  b.addEventListener("click", () => onClick(b));
  return b;
}

/** Say something on a button, then let it settle back. */
function flash(b, message, ms = 2000) {
  const was = b.dataset.rest || (b.dataset.rest = b.textContent);
  b.textContent = message;
  clearTimeout(+b.dataset.timer);
  b.dataset.timer = setTimeout(() => { b.textContent = was; }, ms);
}

function draw() {
  const list = read();
  el.total.textContent = list.length ? `${bn(list.length)}টি রিপোর্ট` : "";
  el.bar.hidden = list.length === 0;
  el.list.innerHTML = "";

  if (!list.length) {
    const box = document.createElement("div");
    box.className = "rp-empty";
    box.innerHTML =
      '<h2 class="bn">এখানে কিছু নেই</h2>'
      + '<p class="bn">রিপোর্টগুলো যে ব্রাউজারে লেখা হয়েছিল, শুধু সেখানেই থাকে - সার্ভারে নয়। '
      + 'তাই ফোনে লেখা রিপোর্ট ল্যাপটপে দেখা যাবে না, আর উল্টোটাও।</p>'
      + '<p class="bn">যদি এখানে কিছু থাকার কথা থাকে: একই ডিভাইসের একই ব্রাউজারে খুলুন, '
      + 'আর দেখুন সাইটের ডেটা মুছে ফেলা হয়েছে কিনা।</p>';
    el.list.appendChild(box);
    return;
  }

  for (const r of list) {
    const card = document.createElement("article");
    card.className = "rp";

    const head = document.createElement("p");
    head.className = "rp-when bn";
    head.textContent = `${when(r.at)} · লেভেল ${bn(r.level)}${r.name ? ` (${r.name})` : ""}`;

    // textContent, never innerHTML: this is text a person typed, and it goes back on screen
    // as text.
    const body = document.createElement("p");
    body.className = "rp-text bn";
    body.textContent = r.text;

    const meta = document.createElement("details");
    meta.className = "rp-meta";
    const sum = document.createElement("summary");
    sum.className = "bn";
    sum.textContent = "বিস্তারিত";
    const pre = document.createElement("pre");
    pre.textContent = [
      `শব্দ: ${r.words || "-"}`,
      `শেষ হয়েছে: ${bn(r.cleared || 0)}টি`,
      `পর্দা: ${r.screen || "-"}`,
      `ব্রাউজার: ${r.ua || "-"}`,
    ].join("\n");
    meta.append(sum, pre);

    const tools = document.createElement("div");
    tools.className = "rp-tools";
    tools.append(
      button("কপি", "", async b => flash(b, (await copy(asText(r))) ? "কপি হয়েছে" : "গেল না")),
      // Two presses. A single delete beside a copy button is how a note gets lost.
      button("মুছুন", "rp-drop", b => {
        if (b.dataset.armed !== "1") {
          b.dataset.armed = "1";
          b.classList.add("armed");
          flash(b, "সত্যি মুছবেন?", 3000);
          setTimeout(() => { b.dataset.armed = "0"; b.classList.remove("armed"); }, 3000);
          return;
        }
        write(read().filter(x => x.at !== r.at));
        draw();
      }),
    );

    card.append(head, body, meta, tools);
    el.list.appendChild(card);
  }
}

/* ---- everything at once ---------------------------------------------------------------- */

/** Oldest first when they go out together, so they read as a history rather than in reverse. */
const allText = () => [...read()].reverse().map(asText).join("\n\n———\n\n");

document.getElementById("copyAll").addEventListener("click", async b => {
  const list = read();
  if (!list.length) return;
  const btn = document.getElementById("copyAll");
  flash(btn, (await copy(allText())) ? `${bn(list.length)}টি কপি হয়েছে` : "কপি করা গেল না");
});

/*
 * Saved as a file, which is the only route off this device that does not go through a person
 * pasting. A blob and an <a download> - no server, and nothing leaves until the browser's own
 * save dialog is answered.
 */
document.getElementById("download").addEventListener("click", () => {
  const list = read();
  if (!list.length) return;
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([allText()], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `shobdojot-reports-${stamp}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

// Another tab may have kept a note since this page was opened.
addEventListener("storage", e => { if (e.key === KEY) draw(); });

draw();
