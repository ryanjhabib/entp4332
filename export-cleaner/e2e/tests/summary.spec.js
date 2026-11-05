// Summary: what Apply will do, before it does anything.

import { test, expect } from '../support/app.js';
import * as folders from '../support/folders.js';

// Sorts the whole small folder; the stream ends on Summary.
// Rejects: sunset-crop.jpg, sunset.png, flowers.png. Keeps: sunset-bw.png, both oceans.
async function sortEverything(app, page) {
  await app.scan('small', folders.small);
  await sortScanned(app, page);
}

async function sortScanned(app, page) {
  await app.cell('sunset.png').click();
  await app.expectPair('sunset-bw.png', 'sunset-crop.jpg');
  await page.locator('#pick-left').click();
  await page.locator('#pick-left').click();
  await app.expectPair('ocean-4x5.png', 'ocean.png');
  await page.locator('#keep-both').click();
  await app.expectSolo('flowers.png');
  await page.locator('#delete-solo').click();
  await expect(page.locator('#summary')).toBeVisible();
}

test.describe('Summary', () => {
  test('lists what will move and what stays, and nothing on disk has changed', async ({ app, page }) => {
    await app.scan('small', folders.small);
    const before = await app.files('small');
    await sortScanned(app, page);
    expect(await app.summary()).toEqual({
      title: expect.stringMatching(/^Rejecting these frees \d+ KB$/),
      count: '6 files · 3 to reject · 3 to keep · 0 undecided · nothing has changed yet',
      reject: ['flowers.png', 'sunset-crop.jpg', 'sunset.png'],
      keep: ['ocean-4x5.png', 'ocean.png', 'sunset-bw.png'],
      undecided: [],
      apply: 'Move 3 files to _to_delete',
    });
    expect(await app.files('small')).toEqual(before);
  });

  test('clicking a card clears its choice; with no rejects left the move button goes', async ({ app, page }) => {
    await sortEverything(app, page);
    await app.summaryCard('sunset.png').click();
    expect(await app.summary()).toMatchObject({
      count: '6 files · 2 to reject · 3 to keep · 1 undecided · nothing has changed yet',
      undecided: ['sunset.png'],
      apply: 'Move 2 files to _to_delete',
    });
    await app.summaryCard('ocean.png').click(); // a keep clears too
    await app.summaryCard('flowers.png').click();
    await app.summaryCard('sunset-crop.jpg').click();
    expect(await app.summary()).toMatchObject({
      title: 'Nothing marked to reject yet',
      reject: [],
      keep: ['ocean-4x5.png', 'sunset-bw.png'],
      undecided: ['flowers.png', 'ocean.png', 'sunset-crop.jpg', 'sunset.png'],
      apply: null,
    });
    await app.toFamilies();
    await expect(page.locator('#file-count')).toHaveText(/· 2 decided$/);
  });

  test('is locked while Apply moves files: cards and the Families toggle don’t respond', async ({ app, page }) => {
    await sortEverything(app, page);
    // Holds every move until the test lets go, like a slow disk.
    await page.evaluate(() => {
      const move = FileSystemFileHandle.prototype.move;
      const gate = new Promise((resolve) => (window.__releaseMoves = resolve));
      FileSystemFileHandle.prototype.move = async function (...args) {
        await gate;
        return move.apply(this, args);
      };
    });
    await page.locator('#apply').click();
    await expect(page.locator('#summary')).toHaveAttribute('inert', '');
    // Real mouse clicks (a scripted click would ignore the lock).
    const card = await app.summaryCard('sunset.png').boundingBox();
    await page.mouse.click(card.x + card.width / 2, card.y + card.height / 2);
    const families = await page.locator('#summary-families').boundingBox();
    await page.mouse.click(families.x + families.width / 2, families.y + families.height / 2);
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 500)));
    await expect(page.locator('#summary')).toBeVisible();
    expect((await app.summary()).reject).toEqual(['flowers.png', 'sunset-crop.jpg', 'sunset.png']);
    await page.evaluate(() => window.__releaseMoves());
    await expect(page.locator('#done')).toBeVisible();
    await expect(page.locator('#done-result')).toHaveText('Moved 3 files into _to_delete inside “small”. 3 other files weren’t touched.');
  });

  test.fixme('Summary’s Sort works again after a card is cleared, once everything was sorted', {
    annotation: { type: 'bug', description: 'Open on master (TESTING.md 2026-11-04): Summary’s Sort does nothing, because Families’ Sort button was left disabled.' },
  }, async ({ app, page }) => {
    await sortEverything(app, page);
    await app.toFamilies();
    await page.locator('#view-summary').click();
    await app.summaryCard('sunset.png').click();
    await expect(page.locator('#summary-sort')).toBeEnabled();
    await page.locator('#summary-sort').click();
    await app.expectPair('sunset-bw.png', 'sunset.png');
  });

  test.fixme('a real double-click on a Summary card clears only that card', {
    annotation: { type: 'bug', description: 'Open on master (TESTING.md 2026-11-04): the second click clears the card that moves into its place.' },
  }, async ({ app, page }) => {
    await sortEverything(app, page);
    await app.summaryCard('flowers.png').dblclick();
    expect((await app.summary()).reject).toEqual(['sunset-crop.jpg', 'sunset.png']);
  });
});
