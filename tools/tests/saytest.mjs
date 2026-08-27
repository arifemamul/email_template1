// The feedback card: does it refuse an empty note, copy a full one, attach the level the
// player is actually on, keep one on the device, and still work when the clipboard API is
// missing?
import { launch, PAGE, serveDocs } from './harness.mjs';

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
// The feedback card lives in the About section of the menu now, and only the open section is on
// screen. Open it the way a player would rather than reaching past the menu.
const openAbout = async pg => {
  await pg.click('#tab-about');
  await pg.waitForSelector('#sayNote', { state: 'visible', timeout: 5000 });
};
await openAbout(p);

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
  await p2.waitForSelector('#menu', { state: 'visible', timeout: 5000 })
          .catch(() => fail('the menu is unreachable on a phone'));
  await openAbout(p2).catch(() => fail('the feedback card is unreachable on a phone'));
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
await p.click('#tab-about');

// 6. An empty note is refused here too - an empty entry in the list is worse than none.
await p.fill('#sayNote', '   ');
await p.click('#saySave');
const emptyKept = await p.evaluate(() =>
  JSON.parse(localStorage.getItem('shobdojot.reports') || '[]').length);
if (emptyKept) fail('an empty note was kept');

// 7. A real one is kept, with the level the player was actually on, and the box is emptied so
//    the next note does not start with the last one still in it.
await p.evaluate(() => loadLevel(5));
const note = 'পরীক্ষা: এই শব্দের মানে ঠিক নয়';
await p.fill('#sayNote', note);
await p.click('#saySave');
await p.waitForTimeout(120);
const kept = await p.evaluate(() => ({
  stored: JSON.parse(localStorage.getItem('shobdojot.reports') || '[]'),
  rows: document.querySelectorAll('.rp').length,
  box: document.getElementById('sayNote').value,
  onLevel: LEVELS[5].id,
}));
if (kept.stored.length !== 1) fail(`${kept.stored.length} reports stored, expected 1`);
else {
  if (kept.stored[0].text !== note) fail('the note was stored as something else');
  if (kept.stored[0].level !== kept.onLevel)
    fail(`the report says level ${kept.stored[0].level}, the player was on ${kept.onLevel}`);
}
if (kept.rows !== 1) fail(`${kept.rows} reports drawn, expected 1`);
if (kept.box !== '') fail('the note box still holds the note that was just kept');

// 8. It is still there after a reload. This is the whole feature - anything above could be
//    true of a variable that vanishes when the tab closes.
await p.reload();
await p.waitForFunction(() => document.getElementById('sayList'));
await p.click('#tab-about');
const afterReload = await p.evaluate(() => ({
  rows: document.querySelectorAll('.rp').length,
  text: (document.querySelector('.rp-text') || {}).textContent,
  when: (document.querySelector('.rp-when') || {}).textContent,
}));
if (afterReload.rows !== 1) fail('the kept report did not survive a reload');
if (afterReload.text !== note) fail(`after a reload the report reads "${afterReload.text}"`);
if (!/[০-৯]{2}\/[০-৯]{2}\/[০-৯]{4}/.test(afterReload.when || ''))
  fail(`the report is not dated in Bengali numerals: "${afterReload.when}"`);

// 9. Clearing the game's own save must not take the reports with it. They are separate keys
//    for exactly this reason, and a child pressing something is how progress gets cleared.
await p.evaluate(() => { try { localStorage.removeItem('shobdojot'); } catch {} });
await p.reload();
await p.waitForFunction(() => document.getElementById('sayList'));
await p.click('#tab-about');
const survived = await p.evaluate(() => document.querySelectorAll('.rp').length);
if (survived !== 1) fail('clearing game progress destroyed the kept reports');

// 10. The note goes back on screen as text, never as markup.
await p.fill('#sayNote', '<img src=x onerror="window.__pwned=1">');
await p.click('#saySave');
await p.waitForTimeout(120);
const escaped = await p.evaluate(() => ({
  pwned: !!window.__pwned,
  imgs: document.querySelectorAll('.rp img').length,
  shown: document.querySelector('.rp-text').textContent,
}));
if (escaped.pwned || escaped.imgs) fail('a report was rendered as markup, not as text');
if (!escaped.shown.startsWith('<img')) fail('the report text was mangled on the way back');

// 11. Deleting takes two presses, and then it is gone.
const del = await p.evaluate(async () => {
  const drop = document.querySelector('.rp .rp-drop');
  drop.click();
  const afterOne = JSON.parse(localStorage.getItem('shobdojot.reports') || '[]').length;
  drop.click();
  const afterTwo = JSON.parse(localStorage.getItem('shobdojot.reports') || '[]').length;
  return { afterOne, afterTwo, rows: document.querySelectorAll('.rp').length };
});
if (del.afterOne !== 2) fail('one press deleted a report; it should take two');
if (del.afterTwo !== 1) fail('two presses did not delete the report');
if (del.rows !== 1) fail(`${del.rows} rows drawn after deleting one of two`);

// 12. "Copy all" takes every one of them, oldest first.
await p.fill('#sayNote', 'দ্বিতীয় নোট');
await p.click('#saySave');
await p.waitForTimeout(120);
const all = await p.evaluate(async () => {
  const btn = document.getElementById('sayAll');
  if (btn.hidden) return { hidden: true };
  btn.click();
  await new Promise(r => setTimeout(r, 250));
  let text = '';
  try { text = await navigator.clipboard.readText(); } catch {}
  return { hidden: false, text };
});
if (all.hidden) fail('"copy all" stayed hidden with two reports kept');
else {
  const first = all.text.indexOf(note);
  const second = all.text.indexOf('দ্বিতীয় নোট');
  if (first < 0 || second < 0) fail('"copy all" did not include both reports');
  else if (first > second) fail('"copy all" put the newest first; they should read oldest first');
}
// 13. Rubbish in storage must not take the page down with it. Anything can end up in a
//     localStorage key - another script, a half-finished write, a browser extension - and the
//     failure mode has to be an empty list, never a game that will not start.
const spoiled = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p4 = await spoiled.newPage();
let broke = null;
p4.on('pageerror', e => { broke = e.message; });
await p4.addInitScript(() => {
  try { localStorage.setItem('shobdojot.reports', '{not json at all'); } catch {}
});
await p4.goto(site.url + '/index.html');
await p4.waitForFunction(() => document.getElementById('sayList'));
const corrupt = await p4.evaluate(() => ({
  rows: document.querySelectorAll('.rp').length,
  none: !!document.querySelector('.rp-none'),
  playable: !!document.querySelector('.tile'),
}));
if (broke) fail(`a corrupt report store threw: ${broke}`);
if (!corrupt.playable) fail('a corrupt report store stopped the game loading');
if (corrupt.rows || !corrupt.none) fail('a corrupt report store did not fall back to an empty list');
await p4.close();

// 14. A store that refuses the write must say so and leave the note in the box. Telling
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
await p5.click('#tab-about');
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

console.log(`reports: kept, survived a reload and a cleared save, escaped as text, `
          + `two-press delete, copy-all in order, corrupt and full stores handled`);

if (!process.exitCode) console.log('FEEDBACK OK: empty refused, note + level copied, shown on screen, fallback works, game screen untouched, and a kept report survives');
await b.close();
await site.close();
