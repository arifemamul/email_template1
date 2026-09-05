/*
 * The bar, the options behind it, and the sheet they open.
 *
 * There used to be two designs here and this file tested the seam between them: a gold masthead
 * with a row of ten pills on a wide screen, and a separate strip with a hamburger on a phone.
 * Which one you got depended on the width, so half of what this checked was "the right one of
 * the two is showing".
 *
 * One bar now, at every width, and the width decides one thing only: where a chosen section is
 * read. Wide, it is the column beside the game and always there. Narrow, there is no room
 * beside a phone, so it is a sheet over the top. That is the seam worth testing now.
 */
import { launch, PAGE, openSection } from './harness.mjs';
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

for (const [viewport, name, sheet] of sizes) {
  const p = await b.newPage({ viewport, hasTouch: sheet });
  p.on('pageerror', e => problems.push(`${name}: pageerror ${e.message}`));
  await p.goto(PAGE);
  await p.waitForFunction(() => document.querySelectorAll('#levelGrid .lv').length > 0);

  const state = await p.evaluate(() => {
    // Actually rendered, not merely styled: a child of a display:none parent still reports its
    // own display, so computed style alone once said the menu button was visible on desktop.
    const vis = s => { const e = document.querySelector(s); if (!e) return false;
      if (getComputedStyle(e).visibility === 'hidden') return false;
      return e.getClientRects().length > 0; };
    const dev = document.querySelector('.device').getBoundingClientRect();
    const bar = document.querySelector('.bar').getBoundingClientRect();
    return {
      // The bar is emptied rather than removed on a phone - it still holds the options panel,
      // which is why it cannot be display:none - so its own box is not the question. What is
      // on screen is.
      bar: vis('.bar-name'),
      button: vis('#guideOpen'),
      tabbar: vis('#tabbar'),
      barTop: Math.round(bar.top),
      optionsShowing: vis('#menuPop'),
      guideVisible: vis('.guide .panel') || vis('.guide .levels-card'),
      guideBoxed: vis('.guide'),
      deviceBottom: Math.round(dev.bottom),
      viewportH: innerHeight,
      wheelBottom: Math.round(document.getElementById('wheel').getBoundingClientRect().bottom),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });

  // ---- true at every width ------------------------------------------------------------
  // The way in is not the same thing at every width, and that is the point of this block: on a
  // wide screen it is the button in the top bar, and on a phone it is a tab at the foot of the
  // screen, because the far top corner of a phone is a two-handed reach. What has to be true
  // either way is that there IS one, that it opens, and that it can be got out of.
  const wayIn = sheet ? '#tabbar .tb[data-block="3"]' : '#guideOpen';
  if (sheet) {
    if (!state.tabbar) problems.push(`${name}: no tab bar`);
    if (state.bar) problems.push(`${name}: the top bar is still on screen on a phone`);
    if (state.button) problems.push(`${name}: the top bar's button is still on screen on a phone`);
  } else {
    if (!state.bar) problems.push(`${name}: no bar`);
    if (!state.button) problems.push(`${name}: no menu button`);
    if (state.tabbar) problems.push(`${name}: the tab bar is showing on a wide screen`);
    // The bar is sticky, not fixed: at the top of the page it sits below the page's own
    // padding, which is where it belongs. What matters is that it pins once anything scrolls
    // under it - otherwise the only way to the menu is to scroll back up.
    const pinned = await p.evaluate(async () => {
      const room = document.documentElement.scrollHeight - innerHeight;
      if (room < 40) return { skipped: room };
      scrollTo(0, Math.min(400, room));
      await new Promise(r => requestAnimationFrame(r));
      await new Promise(r => requestAnimationFrame(r));
      const top = Math.round(document.querySelector('.bar').getBoundingClientRect().top);
      const painted = document.querySelector('.bar').classList.contains('stuck');
      scrollTo(0, 0);
      return { top, painted };
    });
    if (pinned.skipped === undefined) {
      if (pinned.top > 1)
        problems.push(`${name}: scrolled, the bar sits ${pinned.top}px down instead of pinning`);
      if (!pinned.painted)
        problems.push(`${name}: the bar did not paint its background once scrolled`);
    }
  }
  if (state.optionsShowing)
    problems.push(`${name}: the options are on screen before anything is pressed`);

  // The options open, and land where the thing that opened them is.
  await p.click(wayIn);
  await p.waitForSelector('#menuPop', { state: 'visible' });
  // It rises into place over about 180ms. Measured the moment it becomes visible, the numbers
  // are the animation's, not the layout's - which read as the options covering the tab that
  // opened them by 233px, a geometry that never actually happens.
  await p.waitForTimeout(280);
  const pop = await p.evaluate(opener => {
    const r = document.getElementById('menuPop').getBoundingClientRect();
    const shown = [...document.querySelectorAll('#menuPop .menu-group')]
      .filter(g => getComputedStyle(g).display !== 'none');
    const opts = shown.flatMap(g => [...g.querySelectorAll('.opt')]);
    return {
      expanded: document.querySelector(opener).getAttribute('aria-expanded'),
      // Measured from whatever opened them: the panel hangs below a button in the top bar and
      // sits on top of a tab at the foot, so the number to check is the gap, either way.
      gap: Math.round(document.querySelector(opener).getBoundingClientRect().top >= r.bottom
        ? document.querySelector(opener).getBoundingClientRect().top - r.bottom
        : r.top - document.querySelector(opener).getBoundingClientRect().bottom),
      offRight: Math.round(r.right - innerWidth),
      offLeft: Math.round(-r.left),
      offBottom: Math.round(r.bottom - innerHeight),
      count: opts.length,
      groups: shown.length,
      // Every option says what it leads to. They used to carry that sentence in a `title`,
      // which is a tooltip - something no touch device has ever shown anyone.
      described: opts.filter(o => (o.querySelector('.opt-t i')?.textContent || '').trim()).length,
      focused: document.activeElement?.classList.contains('opt'),
    };
  }, wayIn);
  if (pop.expanded !== 'true') problems.push(`${name}: aria-expanded not set when open`);
  if (pop.gap < -2) problems.push(`${name}: the options cover what opened them by ${-pop.gap}px`);
  if (pop.offRight > 1) problems.push(`${name}: the options run ${pop.offRight}px off the right`);
  if (pop.offLeft > 1) problems.push(`${name}: the options run ${pop.offLeft}px off the left`);
  if (pop.offBottom > 1) problems.push(`${name}: the options run ${pop.offBottom}px off the bottom`);
  // A tab opens one group; the button in the top bar opens all four.
  const wantGroups = sheet ? 1 : 4;
  if (pop.groups !== wantGroups)
    problems.push(`${name}: ${pop.groups} groups on screen, expected ${wantGroups}`);
  if (pop.described !== pop.count)
    problems.push(`${name}: ${pop.count - pop.described} options have no description`);
  if (!pop.focused) problems.push(`${name}: opening the options did not move focus into them`);

  // Escape closes them, and gives the focus back to the button that opened them.
  await p.keyboard.press('Escape');
  await p.waitForTimeout(120);
  const esc = await p.evaluate(opener => ({
    hidden: document.getElementById('menuPop').hidden,
    onButton: document.activeElement === document.querySelector(opener),
  }), wayIn);
  if (!esc.hidden) problems.push(`${name}: Escape did not close the options`);
  if (!esc.onButton) problems.push(`${name}: Escape left the focus adrift`);

  // A press anywhere else closes them too.
  await p.click(wayIn);
  await p.waitForSelector('#menuPop', { state: 'visible' });
  // On a phone the options are a sheet from the bar to the bottom edge, so the bottom corner of
  // the screen is *inside* them - pressing there chose an option rather than closing anything.
  // The scrim is what makes "somewhere else" exist at all; press it where it is not covered.
  await p.mouse.click(6, 6);
  await p.waitForTimeout(140);
  if (!(await p.evaluate(() => document.getElementById('menuPop').hidden)))
    problems.push(`${name}: a press outside did not close the options`);

  if (sheet) {
    // ---- narrow: the game owns the first screen, the notes are a sheet ------------------
    if (state.guideBoxed) problems.push(`${name}: the sheet is open on load`);
    if (state.wheelBottom > state.viewportH)
      problems.push(`${name}: wheel bottom ${state.wheelBottom} past viewport ${state.viewportH}`);

    await openSection(p, 'levels');
    const open = await p.evaluate(() => ({
      visible: getComputedStyle(document.querySelector('.guide')).visibility,
      bodyLocked: getComputedStyle(document.body).overflow,
      optionsGone: document.getElementById('menuPop').hidden,
      // Six cards across the sections - levels, keep-it-as-an-app, what-this-is,
      // how-to-play, one-tile-one-akshara and the feedback card. They are in the DOM whichever
      // section is open, so this counts the markup rather than what is on screen.
      cards: document.querySelectorAll('.guide .card').length,
      hasFooter: !!document.querySelector('.guide footer'),
      levels: document.querySelectorAll('.guide #levelGrid .lv').length,
      guideTop: Math.round(document.querySelector('.guide').getBoundingClientRect().top),
      head: document.getElementById('guideTitle').textContent.trim(),
      canGoBack: !!document.getElementById('guideBack'),
    }));
    if (open.visible !== 'visible') problems.push(`${name}: the sheet did not open`);
    if (open.bodyLocked !== 'hidden') problems.push(`${name}: body not scroll-locked`);
    if (!open.optionsGone) problems.push(`${name}: the options stayed open behind the sheet`);
    if (open.cards !== 6) problems.push(`${name}: the sheet has ${open.cards} cards, expected 6`);
    if (!open.hasFooter) problems.push(`${name}: footer missing from the sheet`);
    if (open.head !== 'লেভেল') problems.push(`${name}: the head says "${open.head}", not লেভেল`);
    if (!open.canGoBack) problems.push(`${name}: no way back to the options from the sheet`);
    const total = await p.evaluate(() => LEVELS.length);
    if (open.levels !== total)
      problems.push(`${name}: ${open.levels} level buttons, expected ${total}`);
    if (open.guideTop > 2) problems.push(`${name}: the sheet is not flush to the top (${open.guideTop})`);

    // ‹ মেনু goes back to the options rather than out altogether - someone who opened the wrong
    // section should not have to close everything and start over.
    await p.click('#guideBack');
    await p.waitForTimeout(320);
    const back = await p.evaluate(() => ({
      options: !document.getElementById('menuPop').hidden,
      sheet: getComputedStyle(document.querySelector('.guide')).visibility,
    }));
    if (!back.options) problems.push(`${name}: ‹ মেনু did not bring the options back`);
    if (back.sheet === 'visible') problems.push(`${name}: ‹ মেনু left the sheet open`);

    // Picking a level closes the sheet and loads it.
    await openSection(p, 'levels');
    await p.click('.guide #levelGrid .lv:nth-child(5)');
    await p.waitForTimeout(400);
    const after = await p.evaluate(() => ({
      visible: getComputedStyle(document.querySelector('.guide')).visibility,
      index: game.index,
    }));
    if (after.visible === 'visible') problems.push(`${name}: the sheet stayed open after picking a level`);
    if (after.index !== 4) problems.push(`${name}: level ${after.index + 1} loaded, expected 5`);

    // Escape closes the sheet too.
    await openSection(p, 'levels');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(320);
    if ((await p.evaluate(() => getComputedStyle(document.querySelector('.guide')).visibility)) === 'visible')
      problems.push(`${name}: Escape did not close the sheet`);

    console.log(`${name}: tab bar + ${pop.count} options in the group it opens, board ends `
              + `${state.wheelBottom}/${state.viewportH}, sheet holds ${open.cards} cards + `
              + `${open.levels} levels + footer`);
  } else {
    // ---- wide: the section is the column beside the game --------------------------------
    if (!state.guideVisible) problems.push(`${name}: notes hidden on desktop`);
    const cols = await p.evaluate(() => {
      const dev = document.querySelector('.device').getBoundingClientRect();
      const pages = document.querySelector('.pages').getBoundingClientRect();
      // The footer is build notes, so it lives inside পরিচিতি rather than under all ten - it
      // used to sit below every section, which read as a caption to whatever was on screen,
      // including the alphabet chart.
      const ft = document.querySelector('footer');
      return {
        sideBySide: pages.left > dev.right - 4,
        footerInAbout: !!ft.closest('#page-about'),
        options: document.querySelectorAll('#menuPop .opt').length,
        sections: document.querySelectorAll('.pages .page').length,
        onePageShowing: [...document.querySelectorAll('.pages .page')]
          .filter(x => getComputedStyle(x).display !== 'none').length
      };
    });
    if (!cols.sideBySide) problems.push(`${name}: the notes are not beside the game`);
    if (!cols.footerInAbout) problems.push(`${name}: the footer is not inside the পরিচিতি section`);
    // One option per section, counted rather than written out - this file said 6 and kept
    // saying it after two sections were added, so the literal was the bug. menutest owns which
    // sections exist and in what order; here it only has to be an option for each of them.
    if (cols.options !== cols.sections)
      problems.push(`${name}: ${cols.options} options for ${cols.sections} sections`);
    if (cols.onePageShowing !== 1)
      problems.push(`${name}: ${cols.onePageShowing} sections showing, expected exactly 1`);

    await openSection(p, 'about');
    const footerShows = await p.evaluate(() =>
      getComputedStyle(document.querySelector('footer')).display !== 'none'
      && document.querySelector('footer').getBoundingClientRect().height > 0);
    if (!footerShows) problems.push(`${name}: the footer does not show when পরিচিতি is open`);
    console.log(`${name}: two-up intact, ${cols.options} options behind the bar, one section showing`);
  }
  if (state.overflow > 1) problems.push(`${name}: page scrolls sideways by ${state.overflow}px`);
  await p.close();
}

await b.close();
console.log('\n' + (problems.length ? 'PROBLEMS:\n- ' + problems.join('\n- ') : 'ALL GUIDE CHECKS PASSED'));
process.exit(problems.length ? 1 : 0);
