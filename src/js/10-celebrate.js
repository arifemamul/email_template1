/* ============================================================================
   টিয়া, and what happens when a board is finished
   ============================================================================ */

/*
 * A child needs someone to be pleased with them.
 *
 * The game had confetti and nothing else: the board filled, paper flew, the next level
 * arrived. That marks the event but it does not react to it, and the difference matters at
 * five years old - a reaction is another person noticing, a particle effect is weather.
 *
 * So there is a parrot. A টিয়া, because it is the bird a Bangladeshi child can name before
 * they can spell it, and because a parrot is the right animal for a game about repeating
 * sounds back. It is drawn as inline SVG - no image files, nothing to load, and it scales to
 * any screen without going soft - and it has four states:
 *
 *   idle      blinks now and then, so the screen is never quite dead
 *   think     head tilts while a word is being traced
 *   cheer     wings up, on every word found
 *   party     the full thing, once a board is complete
 *
 * The states are CSS classes on one element. Nothing here animates in JavaScript, so all of
 * it stops dead under prefers-reduced-motion without a single conditional.
 */
const Bird = {
  node: null,
  timer: null,

  /* One parrot, in parts, so the CSS can move a wing without touching the head. */
  SVG: `
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <g class="bd-tail">
        <path d="M56 86 q-16 20 -30 26 q10 -22 20 -34 z" fill="#2FB980"/>
      </g>
      <g class="bd-wing-far">
        <path d="M70 54 q22 6 26 26 q-20 2 -30 -12 z" fill="#1E9E68"/>
      </g>
      <g class="bd-body">
        <ellipse cx="60" cy="62" rx="27" ry="30" fill="#35C88A"/>
        <ellipse cx="60" cy="72" rx="18" ry="19" fill="#7BE3B4"/>
      </g>
      <g class="bd-wing">
        <path d="M40 52 q-24 8 -24 30 q22 0 30 -16 z" fill="#2FB980"/>
      </g>
      <g class="bd-head">
        <circle cx="60" cy="34" r="22" fill="#3ED89A"/>
        <path d="M60 12 q10 -10 18 -4 q-8 4 -10 10 z" fill="#FFB300"/>
        <circle class="bd-eye" cx="52" cy="31" r="4.6" fill="#3B2412"/>
        <circle cx="53.6" cy="29.4" r="1.5" fill="#fff"/>
        <circle class="bd-eye" cx="70" cy="31" r="4.6" fill="#3B2412"/>
        <circle cx="71.6" cy="29.4" r="1.5" fill="#fff"/>
        <path class="bd-beak" d="M60 36 q11 3 10 12 q-10 3 -14 -6 z" fill="#FF9F1C"/>
        <circle class="bd-cheek" cx="44" cy="41" r="5" fill="#FF8FA8" opacity=".55"/>
        <circle class="bd-cheek" cx="78" cy="41" r="5" fill="#FF8FA8" opacity=".55"/>
      </g>
    </svg>`,

  mount() {
    const screen = document.querySelector(".screen");
    if (!screen || this.node) return;
    const box = document.createElement("div");
    box.className = "bird idle";
    box.id = "bird";
    box.innerHTML = this.SVG;
    // Tapping the bird makes it say hello. Nothing depends on this; it is here because a
    // child will tap it within about four seconds of finding it, and something should happen.
    box.addEventListener("click", () => { Sfx.tap(4); this.say("cheer", 900); });
    screen.appendChild(box);
    this.node = box;
  },

  /** Hold a state for `ms`, then fall back to idle. */
  say(state, ms = 700) {
    if (!this.node) return;
    clearTimeout(this.timer);
    this.node.className = "bird " + state;
    this.timer = setTimeout(() => {
      if (this.node) this.node.className = "bird idle";
    }, ms);
  },

  /** While a word is being traced. Called on every tile, so it must be cheap and idempotent. */
  thinking() {
    if (!this.node || this.node.classList.contains("party")) return;
    clearTimeout(this.timer);
    this.node.className = "bird think";
  },

  rest() { this.say("idle", 0); },
};

/*
 * The finish. Three things at once, and the order is the point: the stars land first because
 * they are the reward, the bird reacts to them, and the paper is thrown last as decoration on
 * top. Doing it the other way round buries the reward under the confetti.
 */
function celebrateBoard() {
  Bird.say("party", 1600);
  Sfx.win();
  burstStars();
  celebrateLevel();               // the existing confetti, in 09-animate.js
}

/* Three stars, thrown up out of the middle of the board and left to fall. */
function burstStars() {
  if (reduced()) return;
  const board = document.getElementById("board");
  const fx = document.getElementById("fx");
  if (!board || !fx) return;
  const b = board.getBoundingClientRect();
  const host = fx.getBoundingClientRect();
  for (let i = 0; i < 3; i++) {
    const star = document.createElement("div");
    star.className = "star";
    star.textContent = "★";
    star.style.left = `${b.left - host.left + b.width / 2 - 16}px`;
    star.style.top = `${b.top - host.top + b.height / 2 - 16}px`;
    // Spread them left, middle and right rather than at random: three stars in a row reads as
    // a score, three stars in a random cluster reads as a mistake.
    star.style.setProperty("--dx", `${(i - 1) * 74}px`);
    star.style.animationDelay = `${i * 0.11}s`;
    fx.appendChild(star);
    setTimeout(() => star.remove(), 1500);
  }
}

Bird.mount();
