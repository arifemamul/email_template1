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
    // Chrome fills the voice list asynchronously, and can refill it later. Nothing on screen
    // depends on the answer any more, so this just keeps the pick current.
    if ("speechSynthesis" in window) {
      speechSynthesis.addEventListener("voiceschanged", () => { this.voice = this.pickVoice(); });
    }
  },

  stop() {
    if (this.playing) { this.playing.pause(); this.playing = null; }
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  },

  /**
   * Say something Bengali. `rate` is deliberately well below 1: a learner needs to hear the
   * shape of a word, not a native-speed run at it.
   */
  say(text, { rate = 0.6 } = {}) {
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

