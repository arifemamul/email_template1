import { launch, PAGE, serveDocs } from './harness.mjs';
const b = await launch();
const problems = [];

const sizes = [
  [{ width: 390, height: 844 }, 'phone', true],
  [{ width: 360, height: 640 }, 'small phone', true],
  [{ width: 820, height: 1180 }, 'tablet portrait', true],
  [{ width: 1024, height: 768 }, 'tablet landscape', true],
  [{ width: 1280, height: 800 }, 'desktop', false],
  [{ width: 1440, height: 900 }, 'wide desktop', false],
];

for (const [viewport, name, touch] of sizes) {
  const p = await b.newPage({ viewport, hasTouch: touch });
  await p.goto(PAGE);
  await p.waitForFunction(() => document.querySelectorAll('#levelGrid .lv').length > 0);

  const state = await p.evaluate(() => {
    // Actually rendered, not merely styled: a child of a display:none parent still reports
    // its own display, so computed style alone says the menu button is visible on desktop.
    const vis = s => { const e = document.querySelector(s); if (!e) return false;
      if (getComputedStyle(e).visibility === 'hidden') return false;
      return e.getClientRects().length > 0; };
    const dev = document.querySelector('.device').getBoundingClientRect();
    return {
      touchBar: vis('.touch-bar'),
      masthead: vis('header'),
      // display: contents generates no box of its own, so ask about its contents
      guideVisible: vis('.guide .panel') || vis('.guide .levels-card'),
      guideBoxed: vis('.guide'),
      menuButton: vis('.touch-menu'),
      // does the board fit the first screen without scrolling?
      deviceBottom: Math.round(dev.bottom),
      viewportH: innerHeight,
      wheelBottom: Math.round(document.getElementById('wheel').getBoundingClientRect().bottom),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });

  if (touch) {
    if (!state.touchBar) problems.push(`${name}: no touch bar`);
    if (state.masthead) problems.push(`${name}: masthead still showing`);
    if (state.guideBoxed) problems.push(`${name}: guide is open on load`);
    if (state.wheelBottom > state.viewportH)
      problems.push(`${name}: wheel bottom ${state.wheelBottom} past viewport ${state.viewportH}`);

    // open it
    await p.click('#guideOpen');
    await p.waitForTimeout(400);
    const open = await p.evaluate(() => ({
      visible: getComputedStyle(document.querySelector('.guide')).visibility,
      expanded: document.getElementById('guideOpen').getAttribute('aria-expanded'),
      bodyLocked: getComputedStyle(document.body).overflow,
      cards: document.querySelectorAll('.guide .card').length,
      hasFooter: !!document.querySelector('.guide footer'),
      levels: document.querySelectorAll('.guide #levelGrid .lv').length,
      guideTop: Math.round(document.querySelector('.guide').getBoundingClientRect().top)
    }));
    if (open.visible !== 'visible') problems.push(`${name}: guide did not open`);
    if (open.expanded !== 'true') problems.push(`${name}: aria-expanded not set`);
    if (open.bodyLocked !== 'hidden') problems.push(`${name}: body not scroll-locked`);
    // Five cards spread across six sections - levels, what-this-is, how-to-play,
    // one-tile-one-akshara and the feedback card. They exist in the DOM whichever section is
    // open, so this counts the markup rather than what is on screen.
    if (open.cards !== 5) problems.push(`${name}: guide has ${open.cards} cards, expected 5`);
    if (!open.hasFooter) problems.push(`${name}: footer missing from guide`);
    // Not a hardcoded count: the picker must hold every level there is.
    const total = await p.evaluate(() => LEVELS.length);
    if (open.levels !== total)
      problems.push(`${name}: ${open.levels} level buttons in guide, expected ${total}`);
    if (open.guideTop > 2) problems.push(`${name}: guide not flush to the top (${open.guideTop})`);

    // picking a level closes it and loads that level
    await p.click('.guide #levelGrid .lv:nth-child(5)');
    await p.waitForTimeout(400);
    const after = await p.evaluate(() => ({
      visible: getComputedStyle(document.querySelector('.guide')).visibility,
      index: game.index,
      expanded: document.getElementById('guideOpen').getAttribute('aria-expanded')
    }));
    if (after.visible === 'visible') problems.push(`${name}: guide stayed open after picking a level`);
    if (after.index !== 4) problems.push(`${name}: level ${after.index + 1} loaded, expected 5`);
    if (after.expanded !== 'false') problems.push(`${name}: aria-expanded stuck at true`);

    // escape closes it too
    await p.click('#guideOpen');
    await p.waitForTimeout(320);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(320);
    const esc = await p.evaluate(() => getComputedStyle(document.querySelector('.guide')).visibility);
    if (esc === 'visible') problems.push(`${name}: Escape did not close the guide`);

    console.log(`${name}: bar+menu ok, board ends ${state.wheelBottom}/${state.viewportH}, ` +
      `guide holds ${open.cards} cards + ${open.levels} levels + footer`);
  } else {
    if (state.touchBar) problems.push(`${name}: touch bar showing on desktop`);
    if (!state.masthead) problems.push(`${name}: masthead hidden on desktop`);
    if (!state.guideVisible) problems.push(`${name}: notes hidden on desktop`);
    if (state.menuButton) problems.push(`${name}: menu button showing on desktop`);
    // The level picker used to have a column of its own under the phone; it is a section of
    // the menu now, so the desktop layout is game on the left, menu on the right, footer last.
    const cols = await p.evaluate(() => {
      const dev = document.querySelector('.device').getBoundingClientRect();
      const menu = document.querySelector('.menu').getBoundingClientRect();
      const pages = document.querySelector('.pages').getBoundingClientRect();
      const ft = document.querySelector('footer').getBoundingClientRect();
      return {
        sideBySide: menu.left > dev.right - 4 && pages.left > dev.right - 4,
        menuAbovePages: menu.bottom <= pages.top + 4,
        footerLast: ft.top > pages.top,
        tabs: document.querySelectorAll('#menu .tab').length,
        onePageShowing: [...document.querySelectorAll('.pages .page')]
          .filter(x => getComputedStyle(x).display !== 'none').length
      };
    });
    if (!cols.sideBySide) problems.push(`${name}: the menu is not beside the game`);
    if (!cols.menuAbovePages) problems.push(`${name}: the menu bar is not above its sections`);
    if (!cols.footerLast) problems.push(`${name}: footer not last`);
    if (cols.tabs !== 6) problems.push(`${name}: ${cols.tabs} tabs, expected 6`);
    if (cols.onePageShowing !== 1)
      problems.push(`${name}: ${cols.onePageShowing} sections showing, expected exactly 1`);
    console.log(`${name}: two-up intact, no hamburger, ${cols.tabs} tabs, one section showing`);
  }
  if (state.overflow > 1) problems.push(`${name}: page scrolls sideways by ${state.overflow}px`);
  await p.close();
}

await b.close();
console.log('\n' + (problems.length ? 'PROBLEMS:\n- ' + problems.join('\n- ') : 'ALL GUIDE CHECKS PASSED'));
process.exit(problems.length ? 1 : 0);
