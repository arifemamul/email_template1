/* ============================================================================
   শব্দ গঠন and ফলা - three tables out of a printed primer
   ============================================================================ */

/*
 * The alphabet charts say what the letters are. The বারোখড়ি says what one letter becomes
 * under each কার. Neither says the thing a child needs first: that letters put side by side
 * make a word. A primer teaches it as arithmetic - ব + ক = বক - and that turns out to be the
 * right shape for a screen too, because it is short enough to read at a glance and it is
 * obviously an operation rather than a list to memorise.
 *
 * Everything drawn here comes from PRIMER, transcribed in tools/primer.json and checked by
 * tools/build.py on every build: each equation is split and compared against its own parts,
 * each word is confirmed to carry the কার it is filed under, each ফলা word to carry one of the
 * forms shown for it. Nothing on these pages is written into the page by hand.
 *
 * Words that the game actually sets as puzzles are buttons - a child who has just read ব + ক =
 * বক can play বক. The rest are plain text, because there is nothing behind them to open, and a
 * button that does nothing is worse than no button.
 */

/** The level whose board carries this word, or undefined. Buttons exist only where this does. */
const LEVEL_WITH_WORD = (() => {
  const at = {};
  LEVELS.forEach((lv, i) => {
    for (const w of lv.words) if (at[w] === undefined) at[w] = i;
  });
  return at;
})();

/**
 * A word, as a button if the game has it and as plain text if it does not.
 *
 * Used by both pages and by three different lists, which is the reason it is a function: the
 * rule "playable words are buttons" has to be the same everywhere, or a child learns that
 * tapping a word sometimes works.
 */
function wordChip(word, cls) {
  const level = LEVEL_WITH_WORD[word];
  if (level === undefined) {
    const span = document.createElement("span");
    span.className = cls + " bn";
    span.textContent = word;
    return Talk.mark(span, word);
  }
  const b = document.createElement("button");
  b.className = cls + " on bn";
  b.type = "button";
  b.textContent = word;
  b.title = `লেভেল ${bn(level + 1)} খুলুন`;
  b.addEventListener("click", () => { loadLevel(level); leaveMenu(); });
  return Talk.mark(b, word);
}

/* ---- কার চিহ্ন ছাড়া শব্দ গঠন ------------------------------------------------------------ */

function drawEquations() {
  for (const [group, id] of [["two", "eqTwo"], ["three", "eqThree"]]) {
    const box = document.getElementById(id);
    box.innerHTML = "";
    for (const parts of PRIMER[group]) {
      const eq = document.createElement("div");
      eq.className = "eq";
      // The sum, then the answer. Spans rather than one string so the + and = can be set
      // smaller and greyer than the letters without a second font size on the letters.
      parts.forEach((part, i) => {
        if (i) eq.appendChild(op("+"));
        const s = document.createElement("span");
        s.className = "eq-l bn";
        s.textContent = part;
        eq.appendChild(s);
      });
      eq.appendChild(op("="));
      eq.appendChild(wordChip(parts.join(""), "eq-w"));
      box.appendChild(eq);
    }
  }
}

function op(sign) {
  const s = document.createElement("span");
  s.className = "eq-op";
  s.textContent = sign;
  return s;
}

/* ---- কার চিহ্ন যোগে বানান শেখা ---------------------------------------------------------- */

/* The ten কার, in বারোখড়ি order - the order a child recites, not the order of the vowels. */
const KAR_PICK = ["া", "ি", "ী", "ু", "ূ", "ৃ", "ে", "ৈ", "ো", "ৌ"];
let karShowing = "া";

function drawKarWords() {
  const pick = document.getElementById("karPick");
  if (pick.childElementCount === 0) {
    for (const sign of KAR_PICK) {
      const b = document.createElement("button");
      b.className = "kp bn";
      b.type = "button";
      // ক with the sign on it is the big label, and the bare sign the small one underneath -
      // not the other way round. A কার alone has no letter to sit on, so ু and ূ and ৃ come out
      // as specks a child cannot see, while কু and কূ and কৃ are exactly what they recite.
      b.innerHTML = `<span class="kp-s bn">ক${sign}</span>`
                  + `<span class="kp-n bn">${sign}-কার</span>`;
      b.addEventListener("click", () => { karShowing = sign; drawKarWords(); });
      pick.appendChild(b);
    }
  }
  for (let i = 0; i < pick.children.length; i++) {
    pick.children[i].classList.toggle("on", KAR_PICK[i] === karShowing);
  }

  const list = document.getElementById("karList");
  list.innerHTML = "";
  const words = PRIMER.byKar[karShowing] || [];
  const head = document.createElement("p");
  head.className = "kw-count bn";
  const playable = words.filter(w => LEVEL_WITH_WORD[w] !== undefined).length;
  head.textContent = `ক${karShowing} - ${bn(words.length)}টি শব্দ`
                   + (playable ? `, তার ${bn(playable)}টি এই খেলায় আছে` : "");
  list.appendChild(head);
  const wrap = document.createElement("div");
  wrap.className = "kw-words";
  for (const w of words) wrap.appendChild(wordChip(w, "kw"));
  list.appendChild(wrap);
}

/* ---- ফলা ------------------------------------------------------------------------------- */

function drawPhala() {
  document.getElementById("phalaNote").textContent = PRIMER.phalaNote;
  const box = document.getElementById("phalaTable");
  box.innerHTML = "";
  for (const p of PRIMER.phala) {
    const card = document.createElement("section");
    card.className = "ph";
    card.innerHTML = `<h4 class="ph-h bn">${p.name}<span class="ph-m bn">${p.mark}</span></h4>`
                   + `<p class="ph-note bn">${p.note}</p>`;

    const forms = document.createElement("div");
    forms.className = "ph-forms";
    for (const f of p.forms) {
      const s = document.createElement("span");
      // The book prints every shape the mark can take. Some of them no attested Bengali word
      // actually uses - খ্ব, ঙ্ম, ঠ্র - and those are dimmed rather than dropped, because the
      // set of shapes is the lesson and the gaps are worth seeing. Said in the line below.
      const unused = p.unused.includes(f);
      s.className = "ph-f bn" + (unused ? " ph-f-none" : "");
      s.textContent = f;
      if (unused) s.title = "এই রূপে বাংলায় প্রচলিত কোনো শব্দ নেই";
      forms.appendChild(s);
    }
    card.appendChild(forms);
    if (p.unused.length) {
      const gap = document.createElement("p");
      gap.className = "ph-gap bn";
      // The list of dimmed forms goes in its own element rather than inside the sentence. Both
      // are read by a person, but only one is read by tools/tests/primertest.mjs, and prose is
      // a bad thing to search for conjuncts in: "প্রচলিত" contains প্র, "বর্ণমালা" contains র্ণ,
      // so a check that scanned the whole sentence found forms that were never listed.
      gap.textContent = `ফিকে ${bn(p.unused.length)}টি রূপে বাংলায় প্রচলিত কোনো শব্দ নেই - `;
      const list = document.createElement("span");
      list.className = "ph-gap-list bn";
      list.textContent = p.unused.join(", ");
      gap.appendChild(list);
      gap.appendChild(document.createTextNode(
        "। বর্ণমালা এদের বানাতে দেয়, ভাষা ব্যবহার করে না।"));
      card.appendChild(gap);
    }

    const words = document.createElement("div");
    words.className = "ph-words";
    for (const w of p.words) words.appendChild(wordChip(w, "ph-w"));
    card.appendChild(words);
    box.appendChild(card);
  }
}

drawEquations();
drawKarWords();
drawPhala();

/* ---- যুক্তবর্ণ -------------------------------------------------------------------------- */

/*
 * The table that explains the game's own rule.
 *
 * Every other section here teaches Bengali. This one also teaches the wheel: a child is handed
 * ক্ষ as a single tile and has to know that is not a mistake - ক্ষ is one letter, made of ক and
 * ষ, and it takes one square. tools/build.py checks each row with the same splitter the board
 * uses, so the claim on this page and the behaviour of the tiles cannot come apart.
 *
 * 103 rows is too many to read at once, so the first letter filters them. "সব" is the default
 * because a child looking for a shape they saw on a board does not know its first letter.
 */
const JUKTO_ALL = "সব";
let juktoFirst = JUKTO_ALL;

/** The first letters that actually begin a যুক্তবর্ণ, in alphabet order. */
const JUKTO_HEADS = (() => {
  const heads = new Set(PRIMER.jukto.map(r => r.parts[0]));
  return [JUKTO_ALL, ...BYANJANBARNA.filter(c => heads.has(c))];
})();

function drawJukto() {
  document.getElementById("juktoNote").textContent = PRIMER.juktoNote;

  const pick = document.getElementById("juktoPick");
  if (pick.childElementCount === 0) {
    for (const head of JUKTO_HEADS) {
      const b = document.createElement("button");
      b.className = "jp bn" + (head === JUKTO_ALL ? " jp-all" : "");
      b.type = "button";
      b.textContent = head;
      b.addEventListener("click", () => { juktoFirst = head; drawJukto(); });
      pick.appendChild(b);
    }
  }
  for (const b of pick.children) b.classList.toggle("on", b.textContent === juktoFirst);

  const table = document.getElementById("juktoTable");
  table.innerHTML = "";
  const rows = juktoFirst === JUKTO_ALL
    ? PRIMER.jukto : PRIMER.jukto.filter(r => r.parts[0] === juktoFirst);

  const count = document.createElement("p");
  count.className = "jk-count bn";
  count.textContent = juktoFirst === JUKTO_ALL
    ? `${bn(PRIMER.jukto.length)}টি যুক্তবর্ণ`
    : `${juktoFirst} দিয়ে শুরু ${bn(rows.length)}টি যুক্তবর্ণ`;
  table.appendChild(count);

  for (const r of rows) {
    const row = document.createElement("div");
    row.className = "jr";
    // The letter first, then the sum that makes it, which is the order the book prints and the
    // order a child needs: they arrive here having seen the shape, not the parts.
    row.innerHTML = `<span class="jr-f bn">${r.form}</span>`
                  + `<span class="jr-p bn">${r.parts.join(" + ")}</span>`;
    if (r.phonetic) {
      // হৃ and ত্রু, where the book's বিভাজন is how the letter sounds rather than how it is
      // written. Said out loud rather than left to look like an error in the table.
      const note = document.createElement("span");
      note.className = "jr-note bn";
      note.textContent = r.note;
      row.appendChild(note);
    }
    const words = document.createElement("span");
    words.className = "jr-words";
    for (const w of r.words) words.appendChild(wordChip(w, "jr-w"));
    row.appendChild(words);
    table.appendChild(row);
  }
}

drawJukto();
