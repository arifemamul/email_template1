/* ============================================================================
   Pronunciation - so a learner hears every word
   ============================================================================ */
/*
 * Bengali spelling does not tell you the sound. ব and ভ, শ and ষ and স, ন and ণ, ড় and র
 * are each one sound in speech and different letters on the page, which is exactly where a
 * child who speaks Bengali at home but reads none of it goes wrong. Hearing the word while
 * seeing it is the thing that fixes that, so every word a player spells is spoken as it
 * lands.
 *
 * There is no control for this and nothing to switch off. The button that used to sit in the
 * actions row is gone: hearing the word is the point of the game, not an option within it,
 * and a mute toggle on a screen a child is using is a button that gets pressed once by
 * accident and never found again.
 *
 * Two sources, in order of preference:
 *
 *   1. RECORDINGS. `VOICE_CLIPS` maps a word to an audio source - a bundled data: URI or a
 *      file beside the page. It ships empty: recording every board word needs a native speaker,
 *      and `python3 tools/build.py voice` prints exactly which words in exactly what order.
 *      Drop them in and they take over automatically.
 *
 *   2. The device's own Bengali voice, through speechSynthesis.
 *
 * If neither exists, nothing is spoken. That refusal is deliberate and it is the most
 * important line in here: speechSynthesis will happily read Bengali text with an English
 * voice, and a child copying that would learn the wrong sounds from the app that was supposed
 * to teach them. Silence is the better failure.
 */
const VOICE_CLIPS = {};      // word -> audio src, filled in when recordings exist

const Speech = {
  voice: null,
  clips: new Map(),
  playing: null,

  /** A Bengali voice, or null. Bangladeshi first, then Indian Bengali, then any bn. */
  pickVoice() {
    if (!("speechSynthesis" in window)) return null;
    const voices = speechSynthesis.getVoices() || [];
    const bengali = voices.filter(v => /^bn(\b|[-_])/i.test(v.lang || ""));
    return bengali.find(v => /BD/i.test(v.lang))
        || bengali.find(v => /IN/i.test(v.lang))
        || bengali[0]
        || null;
  },

  /** Is there any way to say a Bengali word on this device? */
  get available() {
    return Object.keys(VOICE_CLIPS).length > 0 || this.voice !== null;
  },

  init() {
    this.voice = this.pickVoice();
    this.announce();
    // Chrome fills the voice list asynchronously, and can refill it later, so the answer at
    // startup is not final and the page has to be able to change its mind about it.
    if ("speechSynthesis" in window) {
      speechSynthesis.addEventListener("voiceschanged", () => {
        this.voice = this.pickVoice();
        this.announce();
      });
    }
  },

  /*
   * One class on <body> saying whether anything can be spoken at all.
   *
   * Everything marked with `data-say` gets its pressable look from this class rather than from
   * a check made when it was drawn - the charts and the tables are built once at startup, which
   * on Chrome is before the voice list exists, so a check made then would leave the whole guide
   * looking dead on a device that speaks perfectly well a second later.
   */
  announce() {
    document.body.classList.toggle("cansay", this.available);
  },

  stop() {
    if (this.playing) { this.playing.pause(); this.playing = null; }
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  },

  /**
   * Say something Bengali.
   *
   * `rate` is deliberately well below 1: a learner needs to hear the shape of a word, not a
   * native-speed run at it. 0.6 was already slow and is slower now, because the audience is
   * five and hearing a word once at speed is not how a sound is learned.
   *
   * `AGAIN` is slower still, and it is what the two replay presses use - the letter chip and a
   * found word. Asking to hear something a second time is asking to hear it properly, so the
   * second time is not a repeat of the first. Not lower than this: below about 0.4 a
   * speechSynthesis voice stops sounding slow and starts sounding broken, which teaches a
   * child a word that nobody says.
   */
  RATE: 0.5,
  AGAIN: 0.4,

  say(text, { rate = 0.5 } = {}) {
    if (!text) return false;

    const clip = VOICE_CLIPS[text];
    if (clip) {
      this.stop();
      let audio = this.clips.get(text);
      if (!audio) { audio = new Audio(clip); this.clips.set(text, audio); }
      audio.currentTime = 0;
      audio.playbackRate = rate < 1 ? 0.75 : 1;  // recordings are already paced for a child
      this.playing = audio;
      audio.play().catch(() => {});              // a blocked autoplay is not worth an error
      return true;
    }

    if (!this.voice) return false;               // no Bengali voice: say nothing at all
    this.stop();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = this.voice;
    utterance.lang = this.voice.lang;
    utterance.rate = rate;
    utterance.pitch = 1;
    speechSynthesis.speak(utterance);
    return true;
  },

};

/* ============================================================================
   Tap to hear - every letter and every word on screen
   ============================================================================ */
/*
 * The game speaks a word as it lands, and that is the moment it teaches. But the app is full of
 * Bengali outside that moment - a few hundred example words in the guide, one per row of the
 * sign table, the বারোখড়ি, the কার lists, the ফলা and যুক্তবর্ণ tables - and a word a child
 * cannot pronounce is a shape.
 *
 * So: if it is a Bengali WORD and it is on screen, pressing it says it. `Talk.mark` is how a
 * thing joins that rule, and there is one listener for all of them - delegated, because these
 * tables are redrawn whenever the picker above them changes and a listener per cell would have
 * to be rebuilt every time.
 *
 * Words, and only words. Every letter, akshara and conjunct in the app was pressable once - the
 * two alphabet charts, the বারোখড়ি forms, the কার pairs, every ফলা and যুক্তবর্ণ shape, the
 * 244-letter level grid, the chip at the top of the screen and every tile on the wheel - and all
 * of it is quiet now. A synthesised voice reading a lone Bengali letter is wrong too often to
 * teach with: ই and উ come back as the letters' names, a bare consonant arrives with a vowel
 * nobody asked for, and the mistakes land precisely on what the game is for. An app that
 * mispronounces the alphabet to a child learning the alphabet is worse than one that says
 * nothing there.
 *
 * A word already found on the board keeps its own handler rather than a mark, because what it
 * says is not what it shows: a cell shows one akshara and says the whole word it belongs to. It
 * borrows `Talk.glow`, so a press looks the same answered from either side.
 *
 * Always at `Speech.AGAIN`, the slow rate. Nothing here is spoken in passing - each one was
 * asked for, deliberately, by a finger put on it, and the answer to "what does this say" is a
 * word said slowly enough to copy.
 */
const Talk = {
  timer: null,

  /** Mark an element as something that can be heard, and say what it will say. */
  mark(el, text) {
    if (!el || !text) return el;
    el.dataset.say = text;
    // A <button> is already reachable and already turns Enter and Space into a click. Anything
    // else has to be told it is pressable, or it is pressable only with a mouse.
    if (el.tagName !== "BUTTON") {
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
    }
    if (!el.hasAttribute("aria-label")) el.setAttribute("aria-label", `${text} - উচ্চারণ শুনুন`);
    return el;
  },

  /*
   * The thing pressed lights up while it is being said.
   *
   * Sound alone leaves a child guessing which of forty letters on the screen just spoke -
   * especially the second time, when they are hunting for the one they meant. The glow ties
   * the sound to the shape, and it is also simply the app answering: something happened,
   * you did that.
   */
  glow(el) {
    if (!el) return;
    for (const n of document.querySelectorAll(".saying")) n.classList.remove("saying");
    // Restarted rather than merely re-added: without the reflow, pressing the same thing twice
    // keeps the first animation running and the second press looks like nothing at all.
    el.classList.remove("saying");
    void el.offsetWidth;
    el.classList.add("saying");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => el.classList.remove("saying"), 1400);
  },

  say(el) {
    const text = el && el.dataset ? el.dataset.say : null;
    if (!text) return;
    Sfx.tap();
    // No glow when nothing was said. On a device with no Bengali voice this is the whole of
    // the behaviour: a quiet tap tone, and no light that would promise a sound never coming.
    if (Speech.say(text, { rate: Speech.AGAIN })) this.glow(el);
  },

  wire() {
    document.addEventListener("click", e => {
      const el = e.target.closest("[data-say]");
      if (el) this.say(el);
    });
    document.addEventListener("keydown", e => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const el = e.target.closest && e.target.closest("[data-say]");
      if (!el || el.tagName === "BUTTON") return;   // a button makes its own click from these
      e.preventDefault();
      this.say(el);
    });
  }
};

/*
 * Finishing a level moves straight on to the next one - the next board is there as soon as
 * the last letters land on this one, with nothing in between.
 *
 * There were two waits here once. First a card: a five-second countdown over a panel listing
 * every word from the level. Then, after that went, a 450ms beat so the finished board
 * registered as finished before it was replaced. Both were cut for the same reason - the wait
 * is the part a player notices, and any pause after a win is longer than it sounds when the
 * win is what makes a child want the next one. The confetti plays over the change instead of
 * holding it up.
 */

