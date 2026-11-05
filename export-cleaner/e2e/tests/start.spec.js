// The start screen: choosing a folder, the media type field, and folders
// with nothing to sort.

import { test, expect } from '../support/app.js';
import * as folders from '../support/folders.js';

test.describe('Start screen', () => {
  test('select opens the folder and starts scanning while the media type is still asked', async ({ app, page }) => {
    await app.open();
    await app.makeFolder('trip', folders.small);
    await app.choose('trip');
    await expect(page.locator('#start-folder-name')).toHaveText(/^trip \(\d+ kb\)$/);
    await expect(page.locator('#start')).toBeVisible(); // still asking for the type
    // The scan has started: the white rule under the sentence is its progress bar.
    const fill = page.locator('#start .loading-fill');
    await expect.poll(() => fill.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a)).toBeGreaterThan(0);
    await app.describe('mixed exports');
    await app.waitForFamilies();
    await expect(page.locator('#folder-name')).toHaveText('trip');
    await expect(page.locator('#file-count')).toHaveText('6 design files · 2 sets · 1 solo · 0 decided');
  });

  test('a scan that finishes before the type is chosen waits, then goes straight to Families', async ({ app, page }) => {
    await app.open();
    await app.makeFolder('trip', folders.small);
    await app.choose('trip');
    await app.waitForScanOnStart();
    await expect(page.locator('#start')).toBeVisible();
    await app.describe('mixed exports');
    await app.waitForFamilies(10_000);
    await expect(page.locator('#file-count')).toHaveText('6 design files · 2 sets · 1 solo · 0 decided');
  });

  test('closing the folder picker without choosing leaves the start screen as it was', async ({ app, page }) => {
    await app.open();
    await page.evaluate(() => window.__e2e.choose(null)); // the stand-in acts like Cancel
    await page.locator('#choose').click();
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 300)));
    await expect(page.locator('#start')).toBeVisible();
    await expect(page.locator('#start-folder')).toBeHidden();
    await expect(page.locator('#start-status')).toBeHidden();
  });

  test('the media type field lists every type, narrows as you type, and takes the arrow keys', async ({ app, page }) => {
    await app.open();
    const field = page.locator('#describe-input');
    const rows = page.locator('#describe-list li');
    await field.click();
    await expect(rows).toHaveText(['Mixed', 'Photographs', 'Mockups', 'Graphic & Type', 'Documents', 'Screenshots', 'Product Images', 'User Interface']);
    await field.fill('photo');
    await expect(rows.first()).toHaveText('Photographs');
    await field.fill('brand deck'); // a deck is a format, so Documents wins the tie with branding
    await expect(rows.first()).toHaveText('Documents');
    await field.fill('screenshots of apps');
    await expect(rows).toHaveText(['Screenshots', 'User Interface']);
    await field.press('ArrowDown');
    await expect(rows.nth(0)).toHaveAttribute('aria-selected', 'true');
    await field.press('ArrowDown');
    await expect(rows.nth(1)).toHaveAttribute('aria-selected', 'true');
    await field.press('Enter'); // takes the highlighted row, not the top one
    await expect(field).toHaveValue('User Interface');
    await expect(page.locator('#describe-list')).toBeHidden();
    await field.click();
    await expect(page.locator('#describe-list')).toBeVisible();
    await field.press('Escape');
    await expect(page.locator('#describe-list')).toBeHidden();
  });

  test('a description with no keyword is matched by meaning, with the small text model', async ({ app, page }) => {
    await app.open();
    const field = page.locator('#describe-input');
    const rows = page.locator('#describe-list li');
    await field.click();
    await field.fill('holiday with grandma');
    await expect(rows).toHaveText(['Photographs'], { timeout: 60_000 }); // the model loads the first time
    await field.fill('quarterly earnings summary');
    await expect(rows).toHaveText(['Documents']);
  });

  test('the media type sets the starting grouping level', async ({ app, page }) => {
    await app.open();
    await app.makeFolder('shop', folders.small);
    await app.choose('shop');
    const field = page.locator('#describe-input');
    await field.click();
    await field.fill('shop');
    await page.locator('#describe-list li', { hasText: 'Product Images' }).click(); // a row can be clicked, too
    await expect(field).toHaveValue('Product Images');
    await app.waitForFamilies();
    await expect(page.locator('[data-level="strict"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-level="balanced"]')).toHaveAttribute('aria-pressed', 'false');
  });

  test('an empty folder opens to an empty Families page', async ({ app, page }) => {
    await app.open();
    await app.makeFolder('empty', []);
    await app.choose('empty');
    await app.waitForScanOnStart();
    await app.describe('mixed exports');
    await app.waitForFamilies();
    await expect(page.locator('#file-count')).toHaveText('0 design files · 0 sets · 0 solos · 0 decided');
    await expect(page.locator('#families .family')).toHaveCount(0);
    await expect(page.locator('#view-compare')).toBeDisabled();
  });

  test('a folder with only skipped files is treated as empty, and its files are left alone', async ({ app, page }) => {
    await app.open();
    await app.makeFolder('skipped', folders.skipped);
    const before = await app.files('skipped');
    await app.choose('skipped');
    await app.waitForScanOnStart();
    await app.describe('mixed exports');
    await app.waitForFamilies();
    await expect(page.locator('#file-count')).toHaveText('0 design files · 0 sets · 0 solos · 0 decided');
    expect(await app.files('skipped')).toEqual(before);
  });
});
