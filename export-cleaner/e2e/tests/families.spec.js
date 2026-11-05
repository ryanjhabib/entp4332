// Families: the sets and solos, Show and Grouping, opening a family, Forget.

import { test, expect } from '../support/app.js';
import * as folders from '../support/folders.js';

test.describe('Families', () => {
  test.beforeEach(async ({ app }) => {
    await app.scan('mixed', folders.mixed);
  });

  test('groups versions into sets, lists sets before solos, and ignores files that aren’t designs', async ({ app, page }) => {
    await expect(page.locator('#folder-name')).toHaveText('mixed');
    await expect(page.locator('#file-count')).toHaveText('12 design files · 3 sets · 5 solos · 0 decided');
    expect(await app.grouping()).toEqual([
      ['broken.png'],
      ['city-crop.jpg', 'city.png'],
      ['flowers.png'],
      ['ocean-4x5.png', 'ocean.png'],
      ['paper.png'],
      ['poster.pdf'],
      ['space.webp'],
      ['sunset-bw.png', 'sunset-crop.jpg', 'sunset.png'],
    ]);
    const counts = (await app.families()).map((family) => family.counts);
    expect(counts.slice(0, 3)).toEqual(counts.slice(0, 3).map(() => expect.stringMatching(/^ · \d versions · \d+ KB$/)));
    expect(counts.slice(3)).toEqual(counts.slice(3).map(() => expect.stringMatching(/^ · solo · \d+ KB$/)));
    // An unreadable file has no preview and goes last; a pale picture gets the edge line.
    await expect(app.cell('broken.png')).toContainText('No preview');
    expect((await app.families()).at(-1).files).toEqual(['broken.png']);
    await expect(app.cell('paper.png').locator('.thumb')).toHaveClass(/blends/);
    await expect(page.locator('#open-summary')).toBeHidden(); // nothing decided yet
  });

  test('Show: Sets, Solos and All', async ({ app, page }) => {
    const cells = page.locator('#families .family');
    await expect(cells).toHaveCount(8);
    await page.locator('[data-show="sets"]').click();
    await expect(cells).toHaveCount(3);
    await expect(page.locator('[data-show="sets"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-show="solos"]').click();
    await expect(cells).toHaveCount(5);
    expect((await app.families()).every((family) => family.files.length === 1)).toBe(true);
    await page.locator('[data-show="all"]').click();
    await expect(cells).toHaveCount(8);
  });

  test('clicking a set opens Sort on its two newest versions', async ({ app }) => {
    await app.cell('sunset.png').click();
    await app.expectPair('sunset-bw.png', 'sunset-crop.jpg');
    const shown = await app.sort();
    expect([shown.left.index, shown.right.index]).toEqual(['3/3', '2/3']); // colour versions first, then black and white
  });

  test('clicking a solo opens it on its own, with Keep and Delete', async ({ app, page }) => {
    await app.cell('flowers.png').click();
    await app.expectSolo('flowers.png');
    await expect(page.locator('#keep-solo')).toBeVisible();
    await expect(page.locator('#delete-solo')).toBeVisible();
    await expect(page.locator('#pick-zoom')).toBeHidden();
  });

  test('Enter on a focused cell opens it', async ({ app }) => {
    await app.cell('city.png').focus();
    await app.page.keyboard.press('Enter');
    await app.expectPair('city-crop.jpg', 'city.png');
  });

  test('Forget asks first; clicking elsewhere or a double-click doesn’t forget', async ({ page }) => {
    const forget = page.locator('#forget');
    await forget.click();
    await expect(forget).toHaveText('Click again to forget');
    await page.locator('#folder-name').click(); // anywhere else takes the question back
    await expect(forget).toHaveText('Forget this folder');
    await forget.dblclick(); // a double-click only asks
    await expect(forget).toHaveText('Click again to forget');
    await expect(page.locator('#files')).toBeVisible();
    await page.locator('#folder-name').click();
    await expect(forget).toHaveText('Forget this folder');
  });

  test('Forget’s second click clears the saved scan and choices, and leaves the files alone', async ({ app, page }) => {
    await app.cell('flowers.png').click();
    await page.locator('#delete-solo').click();
    await app.toFamilies();
    await expect(page.locator('#file-count')).toHaveText(/· 1 decided$/);
    const before = await app.files('mixed');
    await page.locator('#forget').click();
    await page.locator('#forget').click();
    await expect(page.locator('#start')).toBeVisible();
    await expect(page.locator('#start-folder')).toBeHidden();
    expect(await app.files('mixed')).toEqual(before);
    // Opened again, it's a new folder to the app: the type is asked again and nothing is decided.
    await app.choose('mixed');
    await expect(page.locator('#describe-input')).toHaveValue('');
    await app.describe('mixed exports');
    await app.waitForFamilies();
    await expect(page.locator('#file-count')).toHaveText('12 design files · 3 sets · 5 solos · 0 decided');
  });
});

test.describe('Families grouping levels', () => {
  test('Strict splits off a loose version, Loose pulls in a far one, Balanced brings the sets back', async ({ app, page }) => {
    await app.scan('levels', folders.levels);
    const balanced = [
      ['ocean-4x5.png', 'ocean.png'],
      ['sunset-bw.png', 'sunset-crop.jpg', 'sunset-tight.png', 'sunset.png'],
      ['sunset-negative.png'],
    ];
    expect(await app.grouping()).toEqual(balanced);
    await page.locator('[data-level="strict"]').click();
    await expect(page.locator('[data-level="strict"]')).toHaveAttribute('aria-pressed', 'true');
    expect(await app.grouping()).toEqual([
      ['ocean-4x5.png', 'ocean.png'],
      ['sunset-bw.png', 'sunset-crop.jpg', 'sunset.png'],
      ['sunset-negative.png'],
      ['sunset-tight.png'],
    ]);
    await page.locator('[data-level="loose"]').click();
    expect(await app.grouping()).toEqual([
      ['ocean-4x5.png', 'ocean.png'],
      ['sunset-bw.png', 'sunset-crop.jpg', 'sunset-negative.png', 'sunset-tight.png', 'sunset.png'],
    ]);
    await page.locator('[data-level="balanced"]').click();
    expect(await app.grouping()).toEqual(balanced);
    await expect(page.locator('#file-count')).toHaveText('7 design files · 2 sets · 1 solo · 0 decided');
  });

  test.fixme('switching Grouping and back keeps a “These are different” split', {
    annotation: { type: 'bug', description: 'Open on master (TESTING.md 2026-11-04): any Grouping change drops the splits, even back at the same level.' },
  }, async ({ app, page }) => {
    await app.scan('small', folders.small);
    await app.cell('sunset.png').click();
    await page.locator('#not-the-same').click(); // sunset-crop.jpg on its own
    await app.toFamilies();
    await expect(page.locator('#file-count')).toHaveText('6 design files · 2 sets · 2 solos · 0 decided');
    await page.locator('[data-level="strict"]').click();
    await page.locator('[data-level="balanced"]').click();
    await expect(page.locator('#file-count')).toHaveText('6 design files · 2 sets · 2 solos · 0 decided');
  });
});
