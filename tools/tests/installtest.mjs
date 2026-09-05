/*
 * অ্যাপ হিসেবে রাখুন - that every device is told how, and told something true.
 *
 * The bug this exists to prevent is not a crash. The page used to say, in one sentence buried
 * in the পরিচিতি essay, that the browser would offer to add the game to the home screen. On
 * Chrome that is true. On Safari it is false and always has been - there is no
 * `beforeinstallprompt` on iOS and no offer is ever made - so an iPhone owner read a promise,
 * waited, and got nothing. A test that only checked the section renders would have passed the
 * whole time that sentence was there.
 *
 * So this drives the section under six different user agents and asserts what each is told:
 * the iPhone gets the Share path and never a button, Chrome gets a button and never the Share
 * path, and nobody gets an empty box. The user agent is set on the browser context, which is
 * what `08-install.js` reads, so the branch under test is the branch a real device takes.
 *
 * It also holds the line on the other half of that bug. The same sentence said ২৪৪টি লেভেল
 * while the game shipped over three hundred, because the number was typed rather than filled.
 * `build.py check` now refuses any level count typed into the prose; this checks the other
 * side of that rule - that every `.lv-count` in the shipped page actually gets filled, and
 * with the count the page really has.
 */
import { launch, PAGE, openSection, report, levelCount } from './harness.mjs';

const problems = [];
const b = await launch();

/*
 * Real strings, because the code reads them with real regular expressions and a plausible
 * invention is how a detection test passes while the detection is wrong. iPadOS is the one
 * worth staring at: it says Macintosh, and only maxTouchPoints tells it apart from a Mac.
 */
const DEVICES = [
  { name: 'iPhone Safari',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 '
        + '(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    touch: 5, wants: ['Add to Home Screen'], hasButton: false, hasShare: true },

  { name: 'iPhone Chrome',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 '
        + '(KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1',
    touch: 5, wants: ['Add to Home Screen', 'সাফারি'], hasButton: false, hasShare: true },

  // Reports itself as a Mac. Only the touch count says otherwise, and if that check ever
  // breaks this device silently starts being told to use the File menu it does not have.
  { name: 'iPad Safari',
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 '
        + '(KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    touch: 5, wants: ['Add to Home Screen'], hasButton: false, hasShare: true },

  { name: 'Android Firefox',
    ua: 'Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0',
    touch: 5, wants: ['ফায়ারফক্স'], hasButton: false, hasShare: false },

  { name: 'macOS Safari',
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 '
        + '(KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    touch: 0, wants: ['Add to Dock'], hasButton: false, hasShare: false },

  // No branch of its own: the honest generic, which is what an unknown browser must get
  // rather than nothing.
  { name: 'Android Chrome (no prompt offered)',
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) '
        + 'Chrome/126.0.0.0 Mobile Safari/537.36',
    touch: 5, wants: ['মেনু'], hasButton: false, hasShare: false },
];

for (const d of DEVICES) {
  const ctx = await b.newContext({ userAgent: d.ua, viewport: { width: 390, height: 800 } });
  // maxTouchPoints is not settable through Playwright's context options and is exactly what
  // separates an iPad from a Mac, so it is defined on the page before any script runs.
  await ctx.addInitScript(n => {
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => n });
  }, d.touch);
  const p = await ctx.newPage();
  p.on('pageerror', e => problems.push(`${d.name}: page error: ${e.message}`));
  await p.goto(PAGE);
  await openSection(p, 'install');

  const seen = await p.evaluate(() => {
    const box = document.getElementById('installWays');
    if (!box) return null;
    return {
      head: (box.querySelector('.ins-h') || {}).textContent || '',
      text: box.textContent.replace(/\s+/g, ' ').trim(),
      steps: box.querySelectorAll('.ins-steps li').length,
      button: !!box.querySelector('.ins-go'),
      share: !!box.querySelector('.ins-ic'),
    };
  });

  if (!seen) { problems.push(`${d.name}: no install block on the page at all`); await ctx.close(); continue; }
  console.log(`${d.name.padEnd(32)} ${seen.head} · ${seen.steps} steps`
              + `${seen.button ? ' · button' : ''}${seen.share ? ' · share glyph' : ''}`);

  // Nobody may be shown a heading with nothing under it - the failure mode of a detection
  // chain that falls off the end.
  if (!seen.head) problems.push(`${d.name}: the block has no heading`);
  if (!seen.button && seen.steps === 0)
    problems.push(`${d.name}: no button and no steps - the block says nothing to do`);
  for (const want of d.wants) {
    if (!seen.text.includes(want)) problems.push(`${d.name}: never says "${want}"`);
  }
  if (seen.button !== d.hasButton)
    problems.push(`${d.name}: ${seen.button ? 'offers' : 'has no'} install button, expected the opposite`);
  // The share glyph is the one thing an iPhone owner has to find on their own screen, and
  // showing it to a device that has no share sheet is telling them to press nothing.
  if (seen.share !== d.hasShare)
    problems.push(`${d.name}: ${seen.share ? 'draws' : 'omits'} the share glyph, expected the opposite`);
  await ctx.close();
}

/* Already installed: the one state where saying nothing to do is the right answer. Chromium
   honours a forced display-mode, which is what `installed()` reads. */
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 } });
  const p = await ctx.newPage();
  await p.emulateMedia({ media: 'screen', reducedMotion: null, forcedColors: null,
                         colorScheme: null });
  await p.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = q => q.includes('display-mode: standalone')
      ? { matches: true, media: q, addListener() {}, removeListener() {},
          addEventListener() {}, removeEventListener() {} }
      : real(q);
  });
  await p.goto(PAGE);
  await openSection(p, 'install');
  const done = await p.evaluate(() => {
    const box = document.getElementById('installWays');
    return { quiet: box.classList.contains('ins-done'),
             steps: box.querySelectorAll('.ins-steps li').length,
             button: !!box.querySelector('.ins-go'),
             text: box.textContent.replace(/\s+/g, ' ').trim() };
  });
  console.log(`${'already installed'.padEnd(32)} ${done.text.slice(0, 40)}`);
  if (!done.quiet) problems.push('installed: the block is not marked done');
  if (done.steps || done.button)
    problems.push('installed: still shows steps or a button for something already done');
  await ctx.close();
}

/*
 * The button. Chromium will not fire `beforeinstallprompt` for a page opened from a file, and
 * arranging for it to do so for real would mean a served origin, a manifest it likes and a
 * heuristic nobody controls - so the event is dispatched by hand with the shape Chrome gives
 * it. That is enough to prove the half this code owns: that the offer is caught, that the
 * button appears in place of the instructions, that pressing it calls `prompt()`, and that a
 * used-up offer is not shown again.
 */
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => problems.push('prompt: page error: ' + e.message));
  await p.goto(PAGE);
  await openSection(p, 'install');

  const seen = await p.evaluate(async () => {
    let prompted = 0, defaulted = false;
    const e = new Event('beforeinstallprompt');
    e.preventDefault = () => { defaulted = true; };
    e.prompt = () => { prompted++; };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);

    const box = document.getElementById('installWays');
    const btn = box.querySelector('.ins-go');
    const before = { defaulted, button: !!btn, label: btn ? btn.textContent : '',
                     steps: box.querySelectorAll('.ins-steps li').length };
    if (btn) btn.click();
    await new Promise(r => setTimeout(r, 30));
    const after = document.getElementById('installWays');
    return { ...before, prompted,
             stillOffering: !!after.querySelector('.ins-go'),
             thenSays: (after.querySelector('.ins-h') || {}).textContent || '' };
  });
  console.log(`${'beforeinstallprompt'.padEnd(32)} `
              + `${seen.button ? 'button "' + seen.label + '"' : 'NO BUTTON'} · `
              + `prompt() called ${seen.prompted}x · then "${seen.thenSays}"`);

  if (!seen.defaulted)
    problems.push("prompt: the event was not preventDefault'd - Chrome's own banner would "
                  + 'cover the game');
  if (!seen.button) problems.push('prompt: an offer was made and no button appeared');
  if (seen.steps) problems.push('prompt: shows manual steps as well as a button');
  if (seen.prompted !== 1) problems.push(`prompt: prompt() called ${seen.prompted} times, expected once`);
  // Chrome will not hand the same event over again, so a button that survives its own press
  // is a button that does nothing the second time.
  if (seen.stillOffering) problems.push('prompt: the button is still there after being used');
  await ctx.close();
}

/* The other half of the stale-number rule. `build.py check` bans a typed count; this checks
   the marked ones are actually filled, and filled with the count the page really ships. */
{
  const ctx = await b.newContext({ viewport: { width: 900, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(PAGE);
  const n = await levelCount(p);
  const said = await p.$$eval('.lv-count', ns => ns.map(x => x.textContent.trim()));
  console.log(`level count stated in ${said.length} place(s): ${[...new Set(said)].join(' | ')}`);
  if (said.length < 3)
    problems.push(`only ${said.length} .lv-count spans - the prose states it in three places`);
  const bn = String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[+d]);
  for (const s of said) {
    if (s !== `${bn}টি লেভেল`)
      problems.push(`a level count reads "${s}", but the game has ${n} (${bn})`);
  }
  await ctx.close();
}

await b.close();
report(problems, 'INSTALL OK: every device is told how, and the level count is the real one');
