// The feedback card: does it refuse an empty note, copy a full one, attach the level the
// player is actually on, keep one on the device, and still work when the clipboard API is
// missing?
import { launch, PAGE, serveDocs, openSection } from './harness.mjs';

// The clipboard API needs a secure origin, so this one is served rather than file://.
const site = await serveDocs();
const b = await launch();
const fail = m => { console.log('FAIL: ' + m); process.exitCode = 1; };
const bnDigits = n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[+d]);
// sayCopy is async - the click resolves before the clipboard promise does, so wait for the
// button to actually say something rather than reading it on the way past.
const said = (pg, re) => pg.waitForFunction(
  r => new RegExp(r, 'i').test(document.getElementById('saySaid').textContent),
  re.source, { timeout: 5000 }).then(() => pg.textContent('#saySaid'));
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
const p = await ctx.newPage();
await p.goto(site.url + '/index.html');
await p.waitForFunction(() => typeof LEVELS !== 'undefined' && document.getElementById('sayCopy'));
// The feedback card has a named section of its own now, and only the open section is on
// screen. Open it the way a player would rather than reaching past the menu.
const openReport = async pg => {
  await openSection(pg, 'report');
  await pg.waitForSelector('#sayNote', { state: 'visible', timeout: 5000 });
};
await openReport(p);

// 1. An empty note is refused rather than copying a bare context block.
await p.click('#sayCopy');
let label = await said(p, /আগে কিছু লিখুন/).catch(() => p.textContent('#saySaid'));
if (!/আগে কিছু লিখুন/.test(label)) fail(`empty note not refused, button said "${label}"`);
if (await p.evaluate(() => navigator.clipboard.readText().then(t => t.length > 0).catch(() => false)))
  fail('an empty note still put something on the clipboard');

// 2. A real note copies, and carries the level the player is on.
await p.evaluate(() => loadLevel(93));                       // 0-indexed -> level 94
await p.fill('#sayNote', 'শিল্পী is spelled wrong here');
await p.click('#sayCopy');
label = await said(p, /কপি হয়েছে/).catch(() => p.textContent('#saySaid'));
if (!/কপি হয়েছে/.test(label)) fail(`copy did not report success, button said "${label}"`);
// The success colour moved with the message: it is the status line that goes green now, not
// the button, because the button no longer holds the text.
if (!(await p.getAttribute('#saySaid', 'class')).includes('ok'))
  fail('no success colour on the status line');
const text = await p.evaluate(() => navigator.clipboard.readText());
// Read what level 94 actually is rather than hardcoding it - the level count and the contents
// of any given slot move whenever the catalogue or its ordering does.
const lv = await p.evaluate(() => ({ n: LEVELS.length, words: LEVELS[93].words }));
for (const want of ['শিল্পী is spelled wrong here', `লেভেল ${bnDigits(94)} / ${bnDigits(lv.n)}`,
                    lv.words[0], 'টি শেষ', 'পর্দা 1280x1000']) {
  if (!text.includes(want)) fail(`copied text is missing "${want}"\n--- got ---\n${text}`);
}
if (!/Chrome|Chromium|HeadlessChrome/.test(text)) fail('copied text carries no browser line');

// 3. What is attached is stated on screen, and follows the level.
let adds = await p.textContent('#sayAdds');
if (!adds.includes(`লেভেল ${bnDigits(94)}`)) fail(`on-screen note says "${adds}" on level 94`);
await p.evaluate(() => loadLevel(0));
adds = await p.textContent('#sayAdds');
if (!adds.includes(`লেভেল ${bnDigits(1)}`)) fail(`on-screen note did not follow the level: "${adds}"`);

// 4. With no clipboard API at all, the button still leaves the text somewhere reachable.
const p2 = await (await b.newContext({ viewport: { width: 400, height: 900 } })).newPage();
await p2.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { get: () => undefined }));
await p2.goto(site.url + '/index.html');
await p2.waitForFunction(() => document.getElementById('sayCopy'));
// On a phone the whole guide slides up behind the Guide button, over 260ms - so wait for it
// rather than reading the moment the click lands.
if (!await p2.isVisible('#sayNote')) {
  await p2.click('#guideOpen');
  await p2.waitForSelector('#menuPop', { state: 'visible', timeout: 5000 })
          .catch(() => fail('the options are unreachable on a phone'));
  await openReport(p2).catch(() => fail('the feedback card is unreachable on a phone'));
}
await p2.fill('#sayNote', 'no clipboard here');
await p2.click('#sayCopy');
await said(p2, /কপি হয়েছে|হাতে কপি/).catch(() => {});
const box = await p2.inputValue('#sayNote');
const msg = await p2.textContent('#saySaid');
if (!/কপি হয়েছে|হাতে কপি/.test(msg)) fail(`no-clipboard path said "${msg}"`);
if (/হাতে কপি/.test(msg) && !/লেভেল [০-৯]+ \/ [০-৯]+/.test(box))
  fail('fallback did not put the full text in the box for hand-copying');

// 5. The game screen is unchanged - no new button next to the board.
const onScreen = await p.$$eval('.screen button', bs => bs.map(x => x.id));
if (onScreen.includes('sayCopy')) fail('the feedback button leaked onto the game screen');

/* ---- kept reports ---------------------------------------------------------------------
 * The copy button hands a note to the clipboard and forgets it. Keeping one is a promise that
 * it will still be there tomorrow, and a promise about someone's own words is worth testing
 * harder than a button: everything below is about whether the note survives.
 */
await p.evaluate(() => { try { localStorage.removeItem('shobdojot.reports'); } catch {} });
await p.reload();
await p.waitForFunction(() => document.getElementById('saySave'));
await openSection(p, 'report');

// 6. An empty note is refused here too - an empty entry in the list is worse than none.
await p.fill('#sayNote', '   ');
await p.click('#saySave');
const emptyKept = await p.evaluate(() =>
  JSON.parse(localStorage.getItem('shobdojot.reports') || '[]').length);
if (emptyKept) fail('an empty note was kept');

// 7. A real one is kept, with the level the player was actually on, and the box is emptied so
//    the next note does not start with the last one still in it.
//
//    What the game does with a report ends here: it writes to the drawer and no longer reads
//    from it. Displaying them, copying them, deleting them and coping with a corrupt store all
//    belong to docs/reports/ now, and tools/tests/reportspage.mjs is where they are tested.
await p.evaluate(() => loadLevel(5));
const note = 'পরীক্ষা: এই শব্দের মানে ঠিক নয়';
await p.fill('#sayNote', note);
await p.click('#saySave');
await p.waitForTimeout(120);
const kept = await p.evaluate(() => ({
  stored: JSON.parse(localStorage.getItem('shobdojot.reports') || '[]'),
  box: document.getElementById('sayNote').value,
  onLevel: LEVELS[5].id,
}));
if (kept.stored.length !== 1) fail(`${kept.stored.length} reports stored, expected 1`);
else {
  if (kept.stored[0].text !== note) fail('the note was stored as something else');
  if (kept.stored[0].level !== kept.onLevel)
    fail(`the report says level ${kept.stored[0].level}, the player was on ${kept.onLevel}`);
  if (!kept.stored[0].ua) fail('the report was kept without the browser it came from');
}
if (kept.box !== '') fail('the note box still holds the note that was just kept');

// 8. It survives a reload. This is the whole point of keeping one - anything weaker would also
//    be true of a variable that dies with the tab.
await p.reload();
await p.waitForFunction(() => document.getElementById('saySave'));
const afterReload = await p.evaluate(() =>
  JSON.parse(localStorage.getItem('shobdojot.reports') || '[]'));
if (afterReload.length !== 1) fail('the kept report did not survive a reload');
else if (afterReload[0].text !== note) fail('the report came back as something else');

// 9. Clearing the game's own save must not take the reports with it. They are separate keys
//    for exactly this reason, and a child pressing something is how progress gets cleared.
await p.evaluate(() => { try { localStorage.removeItem('shobdojot'); } catch {} });
await p.reload();
await p.waitForFunction(() => document.getElementById('saySave'));
const survived = await p.evaluate(() =>
  JSON.parse(localStorage.getItem('shobdojot.reports') || '[]').length);
if (survived !== 1) fail('clearing game progress destroyed the kept reports');

// 10. Rubbish in the report store must not stop the game loading. Anything can end up in a
//     localStorage key - another script, a half-finished write, a browser extension - and the
//     game has to start regardless, whatever the reports page later makes of it.
const spoiled = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p4 = await spoiled.newPage();
let broke = null;
p4.on('pageerror', e => { broke = e.message; });
await p4.addInitScript(() => {
  try { localStorage.setItem('shobdojot.reports', '{not json at all'); } catch {}
});
await p4.goto(site.url + '/index.html');
await p4.waitForFunction(() => document.querySelector('.tile'));
const corrupt = await p4.evaluate(() => ({ playable: !!document.querySelector('.tile') }));
if (broke) fail(`a corrupt report store threw: ${broke}`);
if (!corrupt.playable) fail('a corrupt report store stopped the game loading');
await p4.close();

// 11. A store that refuses the write must say so and leave the note in the box. Telling
//     someone their words are safe when they are not is the one unforgivable failure here.
const nostore = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p5 = await nostore.newPage();
await p5.addInitScript(() => {
  const real = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (k === 'shobdojot.reports') throw new DOMException('QuotaExceededError');
    return real.call(this, k, v);
  };
});
await p5.goto(site.url + '/index.html');
await p5.waitForFunction(() => document.getElementById('saySave'));
await openSection(p5, 'report');
await p5.fill('#sayNote', 'জায়গা নেই এমন অবস্থায়');
await p5.click('#saySave');
await p5.waitForTimeout(200);
const full = await p5.evaluate(() => ({
  said: document.getElementById('saySaid').textContent,
  claimedOk: document.getElementById('saySaid').classList.contains('ok'),
  stillInBox: document.getElementById('sayNote').value,
}));
if (!full.said.trim()) fail('a refused write said nothing at all');
if (full.claimedOk) fail('a refused write reported success');
if (!full.stillInBox) fail('a refused write emptied the note box, losing what was typed');
await p5.close();

console.log('reports: kept with its level, survived a reload and a cleared save, '
          + 'corrupt and full stores handled');

/* ---- the mail route -------------------------------------------------------------------
 * `mailto:` is the whole delivery mechanism here, so what matters is not that a button exists
 * but what the URL it builds actually contains: the right mailbox, the level the player was
 * on, their words, and a length a mail client will not silently truncate.
 */
const mailCtx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
const m = await mailCtx.newPage();
await m.addInitScript(() => {
  window.__mailto = [];
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href^="mailto:"]');
    if (a) { window.__mailto.push(a.href); e.preventDefault(); }
  }, true);
});
await m.goto(site.url + '/index.html');
await m.waitForFunction(() => document.getElementById('sayMail'));
await openSection(m, 'report');

// 15. An empty note does not open a mail app with nothing in it.
await m.fill('#sayNote', '   ');
await m.click('#sayMail');
await m.waitForTimeout(150);
if ((await m.evaluate(() => window.__mailto)).length)
  fail('an empty note opened the mail app anyway');

// 16. A real one carries the address, the level and the words.
await m.evaluate(() => loadLevel(5));
const mailNote = 'পরীক্ষা: এই শব্দের বানান ঠিক নয়';
await m.fill('#sayNote', mailNote);
await m.click('#sayMail');
await m.waitForTimeout(200);
const links = await m.evaluate(() => window.__mailto);
if (!links.length) fail('the mail button opened nothing');
else {
  const url = new URL(links[0]);
  const q = new URLSearchParams(url.search);
  const to = decodeURIComponent(url.pathname);
  const body = q.get('body') || '';
  const subject = q.get('subject') || '';
  const level = await m.evaluate(() => ({ id: LEVELS[5].id, name: LEVELS[5].name,
                                          words: LEVELS[5].words }));
  const bnDigit = n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[+d]);
  if (to !== 'emamularif@gmail.com') fail(`the report is addressed to "${to}"`);
  if (!subject.includes(bnDigit(level.id))) fail(`the subject does not name the level: "${subject}"`);
  if (!body.includes(mailNote)) fail('the mail body does not contain what was typed');
  if (!level.words.every(w => body.includes(w)))
    fail('the mail body does not list the level\'s words');
  // Some clients truncate a mailto: past ~2000 characters, and a truncated bug report is
  // worse than a short one.
  if (links[0].length > 2000) fail(`the mailto: URL is ${links[0].length} characters`);
  console.log(`mail: to ${to}, subject "${subject}", ${links[0].length} char URL`);
}

// 16b. A very long note is truncated rather than handed to a client that will silently cut it
//      somewhere arbitrary. The ceiling only bites on a long note, so this types one.
await m.evaluate(() => { window.__mailto = []; });
await m.fill('#sayNote', 'দীর্ঘ নোট। '.repeat(300));
await m.click('#sayMail');
await m.waitForTimeout(200);
const longOne = await m.evaluate(() => window.__mailto);
if (!longOne.length) fail('a long note opened nothing');
else if (longOne[0].length > 2000)
  fail(`a long note built a ${longOne[0].length} character mailto:, past what clients keep`);
else {
  const body = new URLSearchParams(new URL(longOne[0]).search).get('body') || '';
  if (!body.includes('[...]')) fail('a long note was cut without saying it had been cut');
  console.log(`long note: ${longOne[0].length} char URL, truncation marked`);
}
await m.fill('#sayNote', mailNote);

// 17. The status line says the mail app is opening - never that anything was sent. The page
//     cannot send, and a message implying it did would be the worst thing on this card.
const mailSaid = await m.textContent('#saySaid');
if (!mailSaid || !mailSaid.trim()) fail('the mail button said nothing');
else if (/পাঠানো হয়েছে|sent/i.test(mailSaid))
  fail(`the status line claims the report was sent: "${mailSaid}"`);

// 18. The address is not sitting in the page as a plain string for a crawler to find.
const bare = await m.evaluate(() => document.documentElement.innerHTML.includes('emamularif@gmail.com'));
if (bare) fail('the address is a plain string in the published page');
await m.close();

if (!process.exitCode) console.log('FEEDBACK OK: empty refused, note + level copied, shown on screen, fallback works, game screen untouched, a kept report survives, and mail carries the right report');
await b.close();
await site.close();
