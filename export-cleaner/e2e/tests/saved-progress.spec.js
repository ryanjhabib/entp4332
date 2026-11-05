// Saved progress: a refresh, a reopened folder, new files, and two tabs.

import { test, expect, App } from '../support/app.js';
import * as folders from '../support/folders.js';

// How many files the app has saved scan results for, in this browser.
const savedRows = (page) =>
  page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('syca');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (!db.objectStoreNames.contains('files')) return 0;
    return new Promise((resolve) => {
      const request = db.transaction('files').objectStore('files').count();
      request.onsuccess = () => resolve(request.result);
    });
  });

test.describe('Saved progress', () => {
  test('refreshing mid-scan picks up where it left off, without asking for the type again', async ({ app, page }) => {
    await app.open();
    await app.makeFolder('mixed', folders.mixed);
    await app.choose('mixed');
    await app.describe('mixed exports');
    await expect(page.locator('#loading')).toBeVisible();
    await expect.poll(() => savedRows(page), { timeout: 120_000 }).toBeGreaterThanOrEqual(3);
    const saved = await savedRows(page);
    expect(saved).toBeLessThan(12); // really mid-scan
    await page.reload();
    // No click: the tab reopens its folder by itself and finishes the scan.
    await app.waitForFamilies();
    await expect(page.locator('#describe-input')).toHaveValue('Mixed');
    await expect(page.locator('#file-count')).toHaveText('12 design files · 3 sets · 5 solos · 0 decided');
    expect(await app.grouping()).toContainEqual(['sunset-bw.png', 'sunset-crop.jpg', 'sunset.png']);
    expect(await savedRows(page)).toBe(12);
  });

  test('refreshing after sorting brings back the same families and choices, splits included', async ({ app, page }) => {
    await app.scan('small', folders.small);
    await app.cell('sunset.png').click();
    await page.locator('#pick-left').click(); // sunset-crop.jpg out
    await app.expectPair('sunset-bw.png', 'sunset.png');
    await page.locator('#not-the-same').click(); // sunset.png on its own
    await app.toFamilies();
    const grouping = await app.grouping();
    const decisions = await app.decisions();
    expect(grouping).toContainEqual(['sunset.png']);
    await expect(page.locator('#file-count')).toHaveText('6 design files · 2 sets · 2 solos · 2 decided');
    await page.reload();
    await app.waitForFamilies(30_000);
    await expect(page.locator('#file-count')).toHaveText('6 design files · 2 sets · 2 solos · 2 decided');
    expect(await app.grouping()).toEqual(grouping);
    expect(await app.decisions()).toEqual(decisions);
  });

  test('reopening a saved folder from the start screen skips the scan and keeps the choices', async ({ app, page }) => {
    await app.scan('small', folders.small);
    await app.cell('flowers.png').click();
    await page.locator('#delete-solo').click();
    await app.toFamilies();
    await page.locator('#choose-again').click();
    await expect(page.locator('#start')).toBeVisible();
    await expect(page.locator('#describe-input')).toHaveValue('');
    await app.choose('small');
    await app.waitForFamilies(5_000); // a scan of this folder takes longer than that
    await expect(page.locator('#describe-input')).toHaveValue('Mixed');
    await expect(page.locator('#file-count')).toHaveText('6 design files · 2 sets · 1 solo · 1 decided');
    expect((await app.decisions())['flowers.png']).toBe('reject');
  });

  test('a file added since the last visit is scanned and joins the families; choices are kept', async ({ app, page }) => {
    await app.scan('small', folders.small);
    await app.cell('flowers.png').click();
    await page.locator('#delete-solo').click();
    await app.toFamilies();
    await page.evaluate((files) => window.__e2e.addFiles('small', files), folders.city);
    await page.reload();
    await app.waitForFamilies();
    await expect(page.locator('#file-count')).toHaveText('8 design files · 3 sets · 1 solo · 1 decided');
    expect(await app.grouping()).toContainEqual(['city-crop.jpg', 'city.png']);
    expect((await app.decisions())['flowers.png']).toBe('reject');
  });
});

test.describe('Two tabs', () => {
  test('a second tab can’t open a folder that’s open in the first; a different folder still opens', async ({ app, page, context }) => {
    await app.scan('small', folders.small);
    const second = new App(await context.newPage());
    await second.open();
    await second.choose('small');
    await expect(second.$('#start-estimate')).toHaveText('“small” is already open in another Export Cleaner tab.');
    await expect(second.$('#describe-input')).toHaveValue(''); // it didn't take the folder's type
    await second.makeFolder('other', folders.ocean);
    await second.choose('other');
    await second.describe('mixed exports');
    await second.waitForFamilies();
    await expect(second.$('#folder-name')).toHaveText('other');
    await expect(second.$('#file-count')).toHaveText('2 design files · 1 set · 0 solos · 0 decided');
    // The first tab still has its folder.
    await expect(page.locator('#folder-name')).toHaveText('small');
    await expect(page.locator('#file-count')).toHaveText('6 design files · 2 sets · 1 solo · 0 decided');
  });
});
