// Sort: comparing two versions at a time, the strip, undo, and zoom.
//
// The small folder's sunset set has three versions, oldest first:
// sunset.png, sunset-crop.jpg, sunset-bw.png. Sort opens on the newest two
// (sunset-bw.png on the left, sunset-crop.jpg on the right); sunset.png waits.

import { test, expect } from '../support/app.js';
import * as folders from '../support/folders.js';

test.describe('Sort', () => {
  test.beforeEach(async ({ app }) => {
    await app.scan('small', folders.small);
    await app.cell('sunset.png').click();
    await app.expectPair('sunset-bw.png', 'sunset-crop.jpg');
  });

  test('Pick on the left keeps it, rejects the right, and brings the next version in on the right', async ({ app, page }) => {
    await page.locator('#pick-left').click();
    await app.expectPair('sunset-bw.png', 'sunset.png');
    expect(await app.strip()).toEqual([
      { name: 'sunset.png', state: 'on-screen' },
      { name: 'sunset-crop.jpg', state: 'out' },
      { name: 'sunset-bw.png', state: 'on-screen' },
    ]);
    await app.toFamilies();
    expect(await app.decisions()).toMatchObject({ 'sunset-bw.png': 'keep', 'sunset-crop.jpg': 'reject', 'sunset.png': 'undecided' });
  });

  test('Pick on the right keeps it, rejects the left, and brings the next version in on the left', async ({ app, page }) => {
    await page.locator('#pick-right').click();
    await app.expectPair('sunset.png', 'sunset-crop.jpg');
    await app.toFamilies();
    expect(await app.decisions()).toMatchObject({ 'sunset-bw.png': 'reject', 'sunset-crop.jpg': 'keep', 'sunset.png': 'undecided' });
  });

  test('Keep both keeps the pair and brings in the next version, then moves on to the next set', async ({ app, page }) => {
    await page.locator('#keep-both').click();
    await app.expectPair('sunset-bw.png', 'sunset.png');
    await page.locator('#keep-both').click();
    await app.expectPair('ocean-4x5.png', 'ocean.png'); // the sunset set is done
    await app.toFamilies();
    expect(await app.decisions()).toMatchObject({ 'sunset-bw.png': 'keep', 'sunset-crop.jpg': 'keep', 'sunset.png': 'keep' });
    await expect(app.cell('sunset.png')).toContainText('3 kept');
  });

  test('These are different moves the newcomer into a family of its own (button and N key)', async ({ app, page }) => {
    await page.locator('#not-the-same').click();
    await app.expectPair('sunset-bw.png', 'sunset.png');
    await app.toFamilies();
    await expect(page.locator('#file-count')).toHaveText('6 design files · 2 sets · 2 solos · 0 decided');
    expect(await app.grouping()).toContainEqual(['sunset-crop.jpg']);

    // The same with the N key, on the other set.
    await app.cell('ocean.png').click();
    await app.expectPair('ocean-4x5.png', 'ocean.png');
    await page.keyboard.press('n');
    await app.toFamilies();
    await expect(page.locator('#file-count')).toHaveText('6 design files · 1 set · 4 solos · 0 decided');
  });

  test('Undo steps back a choice, a split, and across sets; Backspace and ⌘Z undo too', async ({ app, page }) => {
    const undo = page.locator('#compare-undo');
    await expect(undo).toBeDisabled(); // nothing to undo yet
    await page.keyboard.press('Backspace'); // and Backspace does nothing
    await app.expectPair('sunset-bw.png', 'sunset-crop.jpg');

    await page.locator('#pick-left').click();
    await undo.click();
    await app.expectPair('sunset-bw.png', 'sunset-crop.jpg');
    expect((await app.strip()).filter((version) => version.state === 'out')).toEqual([]);
    await expect(undo).toBeDisabled();

    await page.locator('#pick-left').click();
    await page.keyboard.press('Backspace');
    await app.expectPair('sunset-bw.png', 'sunset-crop.jpg');

    await page.locator('#pick-left').click();
    await page.keyboard.press('Meta+z');
    await app.expectPair('sunset-bw.png', 'sunset-crop.jpg');

    await page.locator('#not-the-same').click();
    await undo.click();
    await app.expectPair('sunset-bw.png', 'sunset-crop.jpg');

    // Across sets: finishing the sunset set moves on to the ocean; Undo comes back.
    await page.locator('#pick-left').click();
    await page.locator('#pick-left').click();
    await app.expectPair('ocean-4x5.png', 'ocean.png');
    await undo.click();
    await app.expectPair('sunset-bw.png', 'sunset.png');
    await app.toFamilies();
    expect(await app.decisions()).toMatchObject({ 'sunset-bw.png': 'keep', 'sunset-crop.jpg': 'reject', 'sunset.png': 'undecided' });
    await expect(page.locator('#file-count')).toHaveText('6 design files · 2 sets · 1 solo · 2 decided');
  });

  test('clicking a waiting version in the strip brings it in; one that was out comes back undecided', async ({ app, page }) => {
    const strip = (name) => page.locator('#version-grid > li', { has: page.locator(`xpath=self::*[@title="${name}"]`) });
    await strip('sunset.png').click();
    await app.expectPair('sunset-bw.png', 'sunset.png');
    await page.locator('#pick-left').click(); // sunset.png is out; sunset-crop.jpg comes back in
    await app.expectPair('sunset-bw.png', 'sunset-crop.jpg');
    await expect(strip('sunset.png')).toHaveAttribute('data-state', 'out');
    await strip('sunset.png').click();
    await app.expectPair('sunset-bw.png', 'sunset.png');
    await expect(strip('sunset.png')).toHaveAttribute('data-state', 'on-screen');
    await app.toFamilies();
    expect(await app.decisions()).toMatchObject({ 'sunset-bw.png': 'keep', 'sunset.png': 'undecided' });
  });

  test('a real double-click on Pick or Keep both decides only the pair on screen', async ({ app, page }) => {
    await page.locator('#pick-left').dblclick();
    await app.expectPair('sunset-bw.png', 'sunset.png');
    expect((await app.strip()).filter((version) => version.state === 'out').map((version) => version.name)).toEqual(['sunset-crop.jpg']);

    await page.locator('#compare-undo').click();
    await page.locator('#keep-both').dblclick();
    await app.expectPair('sunset-bw.png', 'sunset.png');
    await app.toFamilies();
    expect(await app.decisions()).toMatchObject({ 'sunset-bw.png': 'keep', 'sunset-crop.jpg': 'keep', 'sunset.png': 'undecided' });
  });

  test('Sort goes through every set, then the solos, then the Summary', async ({ app, page }) => {
    await page.locator('#pick-left').click();
    await page.locator('#pick-left').click();
    await app.expectPair('ocean-4x5.png', 'ocean.png');
    await page.locator('#pick-left').click();
    await app.expectSolo('flowers.png');
    await page.locator('#keep-solo').click();
    expect(await app.summary()).toMatchObject({
      reject: ['ocean.png', 'sunset-crop.jpg', 'sunset.png'],
      keep: ['flowers.png', 'ocean-4x5.png', 'sunset-bw.png'],
      undecided: [],
      apply: 'Move 3 files to _to_delete',
    });
  });

  test('Escape and the Families toggle go back to Families', async ({ app, page }) => {
    await page.keyboard.press('Escape');
    await expect(page.locator('#files')).toBeVisible();
    await app.cell('ocean.png').click();
    await app.expectPair('ocean-4x5.png', 'ocean.png');
    await app.toFamilies();
  });
});

test.describe('Sort zoom', () => {
  test.beforeEach(async ({ app }) => {
    await app.scan('small', folders.small);
    await app.cell('sunset.png').click();
    await app.expectPair('sunset-bw.png', 'sunset-crop.jpg');
  });

  const zoomed = async (app) => {
    const shown = await app.sort();
    return shown.mode === 'zoom' ? `${shown.zoom.index} ${shown.zoom.name}` : shown.mode;
  };

  test('Space zooms into the left version; the arrow keys step through the set and loop', async ({ app, page }) => {
    await page.keyboard.press(' ');
    await expect.poll(() => zoomed(app)).toBe('3/3 sunset-bw.png');
    await page.keyboard.press('ArrowRight'); // past the last comes the first
    await expect.poll(() => zoomed(app)).toBe('1/3 sunset.png');
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => zoomed(app)).toBe('2/3 sunset-crop.jpg');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowUp');
    await expect.poll(() => zoomed(app)).toBe('3/3 sunset-bw.png');
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => zoomed(app)).toBe('1/3 sunset.png');
    await page.keyboard.press(' ');
    await expect.poll(() => zoomed(app)).toBe('pair');
    await page.keyboard.press(' ');
    await expect.poll(() => zoomed(app)).toBe('3/3 sunset-bw.png');
    await page.keyboard.press('Escape');
    await expect.poll(() => zoomed(app)).toBe('pair');
    await app.expectPair('sunset-bw.png', 'sunset-crop.jpg'); // nothing was decided
  });

  test('the wheel steps one version at a time and stops at either end', async ({ app, page }) => {
    await page.keyboard.press(' ');
    await expect.poll(() => zoomed(app)).toBe('3/3 sunset-bw.png');
    await app.settled(); // during the zoom's fade-in the wheel goes to the fade, not the picture
    const frame = await page.locator('#flick .zoom-frame').boundingBox();
    await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2);
    await page.mouse.wheel(0, 40); // already the last: stays
    await expect.poll(() => zoomed(app)).toBe('3/3 sunset-bw.png');
    await page.mouse.wheel(0, -40);
    await expect.poll(() => zoomed(app)).toBe('2/3 sunset-crop.jpg');
    await page.mouse.wheel(0, -40);
    await expect.poll(() => zoomed(app)).toBe('1/3 sunset.png');
    await page.mouse.wheel(0, -40); // the first: stays, no looping round
    await expect.poll(() => zoomed(app)).toBe('1/3 sunset.png');
    await page.mouse.wheel(0, 20); // less than a step does nothing yet
    await expect.poll(() => zoomed(app)).toBe('1/3 sunset.png');
    await page.mouse.wheel(0, 20);
    await expect.poll(() => zoomed(app)).toBe('2/3 sunset-crop.jpg');
  });

  test('clicking a frame zooms into that version, and clicking again goes back', async ({ app, page }) => {
    await page.locator('#frame-right').click();
    await expect.poll(() => zoomed(app)).toBe('2/3 sunset-crop.jpg');
    await page.locator('#flick .zoom-frame').click();
    await expect.poll(() => zoomed(app)).toBe('pair');
  });

  test('Pick while zoomed: a version on screen wins; one stepped to comes in to be compared', async ({ app, page }) => {
    // Stepped to sunset.png, which is waiting: it comes onto the screen, undecided.
    await page.keyboard.press(' ');
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => zoomed(app)).toBe('1/3 sunset.png');
    await page.locator('#pick-zoom').click();
    await app.expectPair('sunset-bw.png', 'sunset.png');
    expect((await app.strip()).filter((version) => version.state === 'out')).toEqual([]);

    // Zoomed on sunset-bw.png, which is on screen: it wins, as Pick under it would.
    await page.keyboard.press(' ');
    await expect.poll(() => zoomed(app)).toBe('3/3 sunset-bw.png');
    await page.locator('#pick-zoom').click();
    await app.expectPair('sunset-bw.png', 'sunset-crop.jpg');
    await app.toFamilies();
    expect(await app.decisions()).toMatchObject({ 'sunset-bw.png': 'keep', 'sunset.png': 'reject', 'sunset-crop.jpg': 'undecided' });
  });
});

test.describe('Sort with a big set', () => {
  test('a set of 14 versions keeps both pictures and both Picks on screen, and the strip scrolls', async ({ app, page }) => {
    await app.scan('fourteen', folders.fourteen);
    await expect(page.locator('#file-count')).toHaveText('14 design files · 1 set · 0 solos · 0 decided');
    await page.locator('#view-compare').click();
    await expect(page.locator('#compare')).toBeVisible();
    for (const id of ['#frame-left', '#frame-right', '#pick-left', '#pick-right']) {
      await expect(page.locator(id)).toBeInViewport({ ratio: 1 });
    }
    const right = await page.locator('#frame-right').boundingBox();
    expect(right.x + right.width).toBeLessThanOrEqual(1440);
    // The strip is wider than the window and scrolls sideways to the last version.
    const strip = page.locator('#version-grid');
    expect(await strip.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    const last = page.locator('#version-grid > li').last();
    await expect(last).not.toBeInViewport({ ratio: 1 });
    await strip.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
    await expect(last).toBeInViewport({ ratio: 1 });
    // A real click on a waiting version there brings it in to be compared.
    const waiting = page.locator('#version-grid > li:not([data-state="on-screen"])').last();
    const name = await waiting.getAttribute('title');
    await waiting.click();
    await expect.poll(async () => (await app.sort()).right?.name).toBe(name);
    await expect(page.locator('#pick-right')).toBeInViewport({ ratio: 1 });
  });
});
