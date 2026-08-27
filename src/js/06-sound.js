/* ============================================================================
   Sound - synthesised, not sampled
   ============================================================================ */

/*
 * Every sound this game makes is generated at runtime by the Web Audio API. There is not one
 * byte of audio in the file, which is the only way sound was affordable here: the page has to
 * stay a single document that works with the network cut, and a set of recorded effects is
 * a megabyte before it is any good. Oscillators are free, they are the same size on every
 * device, and they cannot fail to load.
 *
 * What that buys musically is worth having anyway. Every note is drawn from one pentatonic
 * scale, so no two sounds can clash however they overlap - and they do overlap, because a
 * child taps faster than any envelope decays. Picking tile taps up that scale as a word grows
 * means the sounds themselves say "you are getting somewhere" before the word is even judged.
 *
 * Rules the rest of the game relies on:
 *   - nothing is created until the first touch. Browsers refuse audio before a gesture, and
 *     an AudioContext made at load time sits in `suspended` forever on iOS.
 *   - every call is safe on a device with no audio at all. `play` returns silently rather
 *     than throwing, because a missing speaker must never break a puzzle.
 *   - muting is remembered per device, and honours the same reduced-motion preference the
 *     animations do: a person who has asked for less movement is asking for less noise too.
 */
const Sfx = {
  ctx: null,
  muted: false,
  KEY: "shobdojot.sfx",

  /* A pentatonic scale in Hz, C major, two octaves. No semitone pair in it, so any two notes
     sounded together are consonant - which matters when six taps land inside one second. */
  SCALE: [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3, 659.3, 784.0, 880.0],

  load() {
    try {
      this.muted = localStorage.getItem(this.KEY) === "off";
    } catch { /* private window: default to sound on */ }
    // Someone who has asked the system for reduced motion gets a quiet game by default. They
    // can still turn sound on; this only decides the default.
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      try { if (localStorage.getItem(this.KEY) === null) this.muted = true; } catch { this.muted = true; }
    }
  },

  /** Built on first use, because that is the only time a browser will allow it. */
  wake() {
    if (this.muted) return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      try { this.ctx = new Ctx(); } catch { return null; }
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    return this.ctx;
  },

  toggle() {
    this.muted = !this.muted;
    try { localStorage.setItem(this.KEY, this.muted ? "off" : "on"); } catch {}
    if (!this.muted) { this.wake(); this.note(this.SCALE[5], 0.12, "triangle", 0.16); }
    return this.muted;
  },

  /**
   * One note.
   *
   * `type` picks the timbre and they are not interchangeable: a triangle is soft and woody and
   * carries the taps, a sine is rounder for anything that should feel like a reward, a square
   * is deliberately cheap and buzzy and only the wrong-answer sound uses it.
   */
  note(freq, dur = 0.16, type = "triangle", gain = 0.2, delay = 0, bend = 0) {
    const ctx = this.wake();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (bend) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * bend), t + dur);
    // A hard start clicks, so every note gets a 12ms rise and an exponential fall. The fall
    // has to stop just short of zero: exponentialRamp to 0 is undefined and silently does
    // nothing in some engines, which is why this ends at 0.0001 and then hard-stops.
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  },

  /* ---- the vocabulary of the game, in sound ------------------------------------------- */

  /**
   * A short buzz, where the device has one.
   *
   * Paired with sound rather than separate from it, and muted by the same switch: on a phone
   * these are two halves of the same signal, and a game that goes quiet but keeps buzzing in a
   * pocket is worse than one that does neither. Silently absent on a desktop.
   */
  buzz(ms = 8) {
    if (this.muted) return;
    try { navigator.vibrate?.(ms); } catch { /* blocked by permissions policy; not important */ }
  },

  /** A tile joins the word. Pitch climbs with the length so a word sounds like it is building. */
  tap(index = 0) {
    this.buzz(7);
    this.note(this.SCALE[Math.min(index, this.SCALE.length - 1)], 0.13, "triangle", 0.17);
  },

  /** A tile leaves the word again - the same note, quieter and falling. */
  untap(index = 0) {
    this.note(this.SCALE[Math.min(index, this.SCALE.length - 1)] / 2, 0.1, "triangle", 0.1, 0, 0.8);
  },

  /** A word is right: a rising third, the smallest phrase that reads as "yes". */
  good() {
    this.buzz(18);
    this.note(523.3, 0.14, "sine", 0.22);
    this.note(659.3, 0.16, "sine", 0.22, 0.09);
    this.note(784.0, 0.30, "sine", 0.20, 0.18);
  },

  /** A word is not one. Low, short, and soft on purpose - a child is guessing, not failing. */
  bad() {
    this.buzz(24);
    this.note(196.0, 0.14, "square", 0.09, 0, 0.7);
    this.note(174.6, 0.18, "square", 0.07, 0.1, 0.7);
  },

  /** A word already found. Neither reward nor rebuke: the same note twice. */
  dup() {
    this.note(392.0, 0.1, "sine", 0.13);
    this.note(392.0, 0.12, "sine", 0.11, 0.13);
  },

  /** Each letter landing in the grid, one after another as the cells flip. */
  land(index = 0) {
    this.note(this.SCALE[Math.min(index + 3, this.SCALE.length - 1)] * 2, 0.09, "sine", 0.1,
              index * 0.055);
  },

  /** The board is finished. Five notes up the scale, which is as much fanfare as this needs. */
  win() {
    this.buzz(40);
    [523.3, 659.3, 784.0, 1046.5, 1318.5].forEach((f, i) =>
      this.note(f, i === 4 ? 0.5 : 0.16, "sine", 0.2, i * 0.1));
    // A fifth underneath the last note, so the ending sounds resolved rather than merely high.
    this.note(659.3, 0.5, "triangle", 0.1, 0.4);
  },

  /** A hint. A little upward sparkle, high and thin. */
  hint() {
    [1046.5, 1318.5, 1568.0].forEach((f, i) => this.note(f, 0.08, "sine", 0.09, i * 0.05));
  },

  /** The wheel is reshuffled: a short noisy sweep, the one sound that is not a note. */
  shuffle() {
    const ctx = this.wake();
    if (!ctx) return;
    const t = ctx.currentTime;
    // 0.18s of white noise through a sweeping band-pass reads as "things moving about" in a
    // way no oscillator does.
    const frames = Math.floor(ctx.sampleRate * 0.18);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = ctx.createBufferSource();
    const band = ctx.createBiquadFilter();
    const amp = ctx.createGain();
    src.buffer = buffer;
    band.type = "bandpass";
    band.frequency.setValueAtTime(600, t);
    band.frequency.exponentialRampToValueAtTime(2400, t + 0.18);
    band.Q.value = 1.2;
    amp.gain.value = 0.16;
    src.connect(band).connect(amp).connect(ctx.destination);
    src.start(t);
  },

  /** Moving between levels. */
  page(forward = true) {
    this.note(forward ? 440 : 392, 0.1, "triangle", 0.12, 0, forward ? 1.25 : 0.8);
  },
};

Sfx.load();
