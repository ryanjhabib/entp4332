// Solos: versions on their own, one at a time, to Keep or Delete.

import { test, expect } from '../support/app.js';
import * as folders from '../support/folders.js';

const SOLOS = [folders.flowers, folders.space, folders.paper, folders.broken];

test.describe('Solos', () => {
  test.beforeEach(async ({ app }) => {
    await app.scan('solos', SOLOS);
    await expect(app.page.locator('#file-count')).toHaveText('4 design files · 0 sets · 4 solos · 0 decided');
  });

  test('Keep and Delete decide each solo in turn, then Summary shows the choices', async ({ app, page }) => {
    await page.locator('#view-compare').click();
    const kept = [];
    const deleted = [];
    for (const [i, choice] of ['keep', 'delete', 'keep', 'delete'].entries()) {
      await expect.poll(async () => (await app.sort()).mode).toBe('solo');
      const { name } = (await app.sort()).zoom;
      expect([...kept, ...deleted]).not.toContain(name); // a new solo each time
      await expect(page.locator('#keep-solo')).toBeVisible();
      await page.locator(choice === 'keep' ? '#keep-solo' : '#delete-solo').click();
      (choice === 'keep' ? kept : deleted).push(name);
      if (i < 3) await expect.poll(async () => (await app.sort()).zoom?.name).not.toBe(name);
    }
    expect(await app.summary()).toMatchObject({ keep: kept.sort(), reject: deleted.sort(), undecided: [] });
  });

  test('a decided solo opened from Families can be changed', async ({ app, page }) => {
    await app.cell('flowers.png').click();
    await app.expectSolo('flowers.png');
    await page.locator('#keep-solo').click();
    await app.toFamilies();
    expect((await app.decisions())['flowers.png']).toBe('keep');
    await expect(app.cell('flowers.png')).toContainText('1 kept');
    await app.cell('flowers.png').click();
    await app.expectSolo('flowers.png'); // shown again, though it's decided
    await page.locator('#delete-solo').click();
    await app.toFamilies();
    expect((await app.decisions())['flowers.png']).toBe('reject');
  });

  test('clicking a solo’s picture zooms in on it, and clicking again zooms back out', async ({ app, page }) => {
    await app.cell('flowers.png').click();
    await app.expectSolo('flowers.png');
    await app.settled();
    const picture = page.locator('.solo-picture');
    await picture.click();
    await expect(picture).toHaveClass(/is-zoomed/);
    await picture.click();
    await expect(picture).not.toHaveClass(/is-zoomed/);
  });

  test.fixme('Undo after changing a reopened solo brings its Keep and Delete back', {
    annotation: { type: 'bug', description: 'Open on master (TESTING.md 2026-11-04): Undo leaves a dead screen (“1/1”, “Only version”, no buttons).' },
  }, async ({ app, page }) => {
    await app.cell('flowers.png').click();
    await page.locator('#keep-solo').click();
    await app.toFamilies();
    await app.cell('flowers.png').click();
    await app.expectSolo('flowers.png');
    await page.locator('#keep-solo').click();
    await page.locator('#compare-undo').click();
    await app.expectSolo('flowers.png');
    await expect(page.locator('#keep-solo')).toBeVisible();
    await expect(page.locator('#delete-solo')).toBeVisible();
  });

  test.fixme('scrolling over a solo doesn’t throw an error', {
    annotation: { type: 'bug', description: 'Open on master (TESTING.md 2026-11-04): the wheel on a solo throws “Cannot read properties of null (reading \'scrolled\')”.' },
  }, async ({ app, page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await app.cell('flowers.png').click();
    await app.expectSolo('flowers.png');
    await app.settled();
    const box = await page.locator('.solo-picture').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 80);
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 300)));
    expect(errors).toEqual([]);
  });

  test.fixme('a solo with no preview says “No preview” instead of a broken image', {
    annotation: { type: 'bug', description: 'Open on master (TESTING.md 2026-11-04): shows Chrome’s broken-image icon in an empty square.' },
  }, async ({ app, page }) => {
    await app.cell('broken.png').click();
    await app.expectSolo('broken.png');
    await expect(page.locator('.solo-picture img')).toBeHidden();
    await expect(page.locator('#flick .zoom-frame')).toContainText('No preview');
  });
});
