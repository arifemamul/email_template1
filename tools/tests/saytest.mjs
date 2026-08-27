// The feedback card: does it refuse an empty note, copy a full one, attach the level the
// player is actually on, and still work when the clipboard API is missing?
import { launch, PAGE, serveDocs } from './harness.mjs';

// The clipboard API needs a secure origin, so this one is served rather than file://.
const site = await serveDocs();
const b = await launch();
const fail = m => { console.log('FAIL: ' + m); process.exitCode = 1; };
// sayCopy is async - the click resolves before the clipboard promise does, so wait for the
// button to actually say something rather than reading it on the way past.
const said = (pg, re) => pg.waitForFunction(
  r => new RegExp(r, 'i').test(document.querySelector('#sayCopy .say-en').textContent),
  re.source, { timeout: 5000 }).then(() => pg.textContent('#sayCopy .say-en'));
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
const p = await ctx.newPage();
await p.goto(site.url + '/index.html');
await p.waitForFunction(() => typeof LEVELS !== 'undefined' && document.getElementById('sayCopy'));

// 1. An empty note is refused rather than copying a bare context block.
await p.click('#sayCopy');
let label = await said(p, /write a note/).catch(() => p.textContent('#sayCopy .say-en'));
if (!/write a note/i.test(label)) fail(`empty note not refused, button said "${label}"`);
if (await p.evaluate(() => navigator.clipboard.readText().then(t => t.length > 0).catch(() => false)))
  fail('an empty note still put something on the clipboard');

// 2. A real note copies, and carries the level the player is on.
await p.evaluate(() => loadLevel(93));                       // 0-indexed -> level 94
await p.fill('#sayNote', 'শিল্পী is spelled wrong here');
await p.click('#sayCopy');
label = await said(p, /copied/).catch(() => p.textContent('#sayCopy .say-en'));
if (!/copied/i.test(label)) fail(`copy did not report success, button said "${label}"`);
if (!(await p.getAttribute('#sayCopy', 'class')).includes('ok')) fail('no success colour on the button');
const text = await p.evaluate(() => navigator.clipboard.readText());
// Read what level 94 actually is rather than hardcoding it - the level count and the contents
// of any given slot move whenever the catalogue or its ordering does.
const lv = await p.evaluate(() => ({ n: LEVELS.length, words: LEVELS[93].words }));
for (const want of ['শিল্পী is spelled wrong here', `level 94 of ${lv.n}`, lv.words[0],
                    'levels cleared', 'screen 1280x1000']) {
  if (!text.includes(want)) fail(`copied text is missing "${want}"\n--- got ---\n${text}`);
}
if (!/Chrome|Chromium|HeadlessChrome/.test(text)) fail('copied text carries no browser line');

// 3. What is attached is stated on screen, and follows the level.
let adds = await p.textContent('#sayAdds');
if (!adds.includes('level 94')) fail(`on-screen note says "${adds}" on level 94`);
await p.evaluate(() => loadLevel(0));
adds = await p.textContent('#sayAdds');
if (!adds.includes('level 1')) fail(`on-screen note did not follow the level: "${adds}"`);

// 4. With no clipboard API at all, the button still leaves the text somewhere reachable.
const p2 = await (await b.newContext({ viewport: { width: 400, height: 900 } })).newPage();
await p2.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { get: () => undefined }));
await p2.goto(site.url + '/index.html');
await p2.waitForFunction(() => document.getElementById('sayCopy'));
// On a phone the whole guide slides up behind the Guide button, over 260ms - so wait for it
// rather than reading the moment the click lands.
if (!await p2.isVisible('#sayNote')) {
  await p2.click('#guideOpen');
  await p2.waitForSelector('#sayNote', { state: 'visible', timeout: 5000 })
          .catch(() => fail('the feedback card is unreachable on a phone'));
}
await p2.fill('#sayNote', 'no clipboard here');
await p2.click('#sayCopy');
await said(p2, /copied|by hand/).catch(() => {});
const box = await p2.inputValue('#sayNote');
const msg = await p2.textContent('#sayCopy .say-en');
if (!/copied|by hand/i.test(msg)) fail(`no-clipboard path said "${msg}"`);
if (/by hand/i.test(msg) && !/level 1 of \d+/.test(box))
  fail('fallback did not put the full text in the box for hand-copying');

// 5. The game screen is unchanged - no new button next to the board.
const onScreen = await p.$$eval('.screen button', bs => bs.map(x => x.id));
if (onScreen.includes('sayCopy')) fail('the feedback button leaked onto the game screen');

if (!process.exitCode) console.log('FEEDBACK OK: empty refused, note + level copied, shown on screen, fallback works, game screen untouched');
await b.close();
await site.close();
