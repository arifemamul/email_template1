/* ============================================================================
   Keeping the game - how each browser is asked to put it on the home screen
   ============================================================================ */
/*
 * The game already installs. `manifest.webmanifest` declares it, `sw.js` caches it, and
 * `pwatest` proves it plays with the network cut. What was missing was anyone being told.
 *
 * The page used to say, in the পরিচিতি essay, that the browser would offer to add it to the
 * home screen. That is true of Chrome, which fires `beforeinstallprompt` and puts up its own
 * banner. It is not true of Safari, which has never supported that event and never offers
 * anything: on an iPhone a parent read that sentence, waited for a prompt that does not exist,
 * and concluded the game was broken. Every other browser sits somewhere between the two.
 *
 * So this asks each one in its own way, and says nothing it cannot back up:
 *
 *   already installed   nothing to offer, and it says so rather than showing dead steps
 *   beforeinstallprompt a real button - Chrome and Edge on Android, Windows, ChromeOS, desktop
 *   iOS / iPadOS        the Share → Add to Home Screen path, drawn with the actual glyph,
 *                       because Safari will not be prompted and the button cannot exist
 *   Firefox             its own menu wording, which is not Chrome's
 *   macOS Safari        File → Add to Dock, which is what installing is called there
 *   anything else       the honest generic: open the menu, look for these two names
 *
 * Why it earns a section of its own rather than a line in the essay. On iOS, installing is not
 * a convenience: Safari clears script-writable storage for a site not visited in seven days,
 * and localStorage is where this game keeps every level a child has finished. A tab loses the
 * progress. A home-screen app is exempt and keeps it. The sentence that used to be wrong was
 * also buried nine paragraphs into an essay about level design.
 *
 * Detection is by browser rather than by feature, which is normally the wrong way round and is
 * unavoidable here: there is no feature test for "this browser will let you install from a
 * menu item you have to find yourself". It is kept honest by never gating anything on it -
 * every branch shows working instructions, and a browser this guesses wrong about is told to
 * look in its menu, which is where the item is in all of them.
 */
const Install = (() => {
  const ua = navigator.userAgent;

  /* iPadOS 13 and after reports itself as a Mac and lies convincingly: same UA string, same
     platform. A Mac with a touchscreen is the one thing it cannot be, so that is the tell. */
  const touchMac = /Mac/.test(ua) && navigator.maxTouchPoints > 1;
  const ios = /iPad|iPhone|iPod/.test(ua) || touchMac;

  // Every iOS browser is WebKit underneath, so these are Safari wearing another name - but
  // each has its own menu, and until iOS 16.4 only Safari could install at all.
  const iosOther = ios && /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  const firefox = /Firefox\/|FxiOS/.test(ua);
  const macSafari = /Mac/.test(ua) && !touchMac
                    && /Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua);

  /* Already an app: display-mode for everyone, and navigator.standalone for iOS, which
     predates the media query and is still the only thing Safari sets. */
  const installed = () => window.matchMedia("(display-mode: standalone)").matches
                          || window.navigator.standalone === true;

  /* Chrome hands over its prompt once and expects it back. Holding it is the whole reason
     this listener is at the top of the file rather than inside the section that draws it:
     the event fires on load, long before anyone opens the menu. */
  let offer = null;
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();          // its own banner would cover the game
    offer = e;
    draw();
  });
  window.addEventListener("appinstalled", () => { offer = null; draw(); });

  const SHARE = `<svg class="ins-ic" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12M12 3l-4 4M12 3l4 4" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M6 11H4.5v9h15v-9H18" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

  const steps = list => `<ol class="ins-steps bn">${list.map(s => `<li>${s}</li>`).join("")}</ol>`;

  /* What to say, and whether there is a button to say it with. One shape for every branch so
     the section cannot end up with a heading and nothing under it. */
  function advice() {
    if (installed()) {
      return { done: true,
               head: "এটি এখন অ্যাপ হিসেবেই চলছে",
               body: `<p class="ins-p bn">হোম স্ক্রিন থেকে খোলা হয়েছে, তাই ইন্টারনেট ছাড়াই
                      চলবে আর অগ্রগতিও থেকে যাবে। আর কিছু করার নেই।</p>` };
    }
    if (offer) {
      return { button: "হোম স্ক্রিনে যোগ করুন",
               head: "এক চাপেই হয়ে যাবে",
               body: `<p class="ins-p bn">নিচের বোতামে চাপ দিলে আপনার ব্রাউজার নিজেই
                      জিজ্ঞেস করবে।</p>` };
    }
    if (ios) {
      return { head: "আইফোন বা আইপ্যাডে",
               body: steps([
                 `শেয়ার বোতামে চাপুন ${SHARE} - উপরের দিকে তির চিহ্নসহ বর্গাকার বোতামটি,
                  পর্দার নিচে বা উপরে থাকে।`,
                 `তালিকা নিচে নামিয়ে <b>Add to Home Screen</b> (হোম স্ক্রিনে যোগ করুন)
                  বেছে নিন।`,
                 `উপরের ডান কোণে <b>Add</b> চাপুন।`,
               ]) + (iosOther
                 ? `<p class="ins-p bn">এই ব্রাউজারে না পেলে সাফারি দিয়ে পাতাটি খুলে আবার
                    দেখুন - সাফারিতে এটি সব সময়ই থাকে।</p>`
                 : "") };
    }
    if (firefox) {
      return { head: "ফায়ারফক্সে",
               body: steps([
                 `উপরের বা নিচের কোণে <b>⋮</b> মেনুতে চাপুন।`,
                 `<b>ইনস্টল</b> বা <b>হোম স্ক্রিনে যোগ করুন</b> বেছে নিন।`,
               ]) };
    }
    if (macSafari) {
      return { head: "ম্যাকের সাফারিতে",
               body: steps([
                 `উপরের <b>File</b> মেনুতে যান।`,
                 `<b>Add to Dock</b> বেছে নিন।`,
               ]) };
    }
    return { head: "আপনার ব্রাউজারে",
             body: steps([
               `ব্রাউজারের মেনু খুলুন - সাধারণত <b>⋮</b> বা <b>⋯</b> চিহ্ন।`,
               `<b>অ্যাপ ইনস্টল করুন</b> বা <b>হোম স্ক্রিনে যোগ করুন</b> খুঁজে নিন।`,
             ]) };
  }

  function draw() {
    const box = document.getElementById("installWays");
    if (!box) return;
    const a = advice();
    box.className = "ins" + (a.done ? " ins-done" : "");
    box.innerHTML = `<h4 class="ins-h bn">${a.head}</h4>${a.body}`;
    if (!a.button) return;

    const b = document.createElement("button");
    b.className = "ins-go bn";
    b.type = "button";
    b.textContent = a.button;
    b.addEventListener("click", async () => {
      if (!offer) return;
      b.disabled = true;
      offer.prompt();
      // Chrome will not hand the same event over twice, whatever the answer was.
      await offer.userChoice.catch(() => {});
      offer = null;
      draw();
    });
    box.appendChild(b);
  }

  return { draw };
})();

/* Drawn at load rather than when the section opens, because `beforeinstallprompt` fires early
   and this has to be the thing that is already there when it does. Opening the section redraws
   it anyway - see `showPage` - for the one case that changes underneath us: installing from
   the browser's own menu while the page is still open. */
Install.draw();
