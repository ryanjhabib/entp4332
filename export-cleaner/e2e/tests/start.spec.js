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

test.describe('Start screen, known bugs', () => {
  test.fixme('choosing the type the moment the scan finishes still opens Families', {
    annotation: { type: 'bug', description: 'New (found by this suite, 2026-11-05): a type chosen within ~180 ms of “Ready” leaves the app at 100% on the loading screen for good.' },
  }, async ({ app, page }) => {
    await app.open();
    await app.makeFolder('trip', folders.small);
    await app.choose('trip');
    const field = page.locator('#describe-input');
    await field.click();
    await field.fill('mixed exports'); // typed while it scans
    await expect(page.locator('#start-estimate')).toHaveText('Ready', { timeout: 120_000 });
    await field.press('Enter'); // the moment it's ready
    await app.waitForFamilies(15_000);
  });

  test.fixme('typing “photos”, clicking away and back, then Enter picks Photographs', {
    annotation: { type: 'bug', description: 'Open on master (TESTING.md 2026-11-04): Enter picks Mixed, because clicking back lists every type again.' },
  }, async ({ app, page }) => {
    await app.open();
    const field = page.locator('#describe-input');
    await field.click();
    await field.fill('photos');
    await page.locator('#start .start-description').click();
    await field.click();
    await field.press('Enter');
    await expect(field).toHaveValue('Photographs');
  });

  test.fixme('an empty folder’s size doesn’t read “1 kb”', {
    annotation: { type: 'bug', description: 'Open on master (TESTING.md 2026-11-04): 0 bytes reads “1 kb”.' },
  }, async ({ app, page }) => {
    await app.open();
    await app.makeFolder('empty', []);
    await app.choose('empty');
    await expect(page.locator('#start-folder-name')).toHaveText(/^empty \(/);
    await expect(page.locator('#start-folder-name')).not.toHaveText('empty (1 kb)');
  });

  test.fixme('choosing a second folder mid-scan shows no false error', {
    annotation: { type: 'bug', description: 'Open on master (TESTING.md 2026-11-04): a false “Failed to fetch” shows until the new scan overwrites it.' },
  }, async ({ app, page }) => {
    await app.open();
    await app.makeFolder('first', folders.mixed);
    await app.makeFolder('second', folders.small);
    await page.evaluate(() => {
      window.__seen = [];
      for (const id of ['#start-estimate', '#loading-eta']) {
        const el = document.querySelector(id);
        new MutationObserver(() => window.__seen.push(el.textContent)).observe(el, { childList: true, characterData: true, subtree: true });
      }
    });
    await app.choose('first');
    await expect.poll(async () => parseInt(await page.locator('#loading-percent').textContent(), 10), { timeout: 120_000 }).toBeGreaterThan(20);
    await app.choose('second');
    await app.waitForScanOnStart();
    expect((await page.evaluate(() => window.__seen)).filter((text) => /fail/i.test(text))).toEqual([]);
  });

  test.fixme('a folder that has gone missing gets a plain-language message', {
    annotation: { type: 'bug', description: 'Open on master (TESTING.md 2026-11-04): missing-folder and offline errors show Chrome’s raw message; a refresh repeats it.' },
  }, async ({ app, page }) => {
    await app.scan('small', folders.small);
    await page.evaluate(async () => (await navigator.storage.getDirectory()).removeEntry('small', { recursive: true }));
    await page.reload(); // the tab tries to reopen its folder, which is gone
    await expect(page.locator('#loading-phase')).toHaveText('Couldn’t finish scanning');
    await expect(page.locator('#loading-eta')).not.toContainText('operation');
  });
});

test.describe('Start screen without a working graphics card', () => {
  test.use({ gpu: true });

  test.fixme('a Chrome that offers WebGPU but can’t start it still scans, on the processor', {
    annotation: { type: 'bug', description: 'Open on master (TESTING.md 2026-11-04): the scan stops on a raw “--enable-unsafe-webgpu” message, with no fallback.' },
  }, async ({ app, page, context }) => {
    await context.addInitScript(() => {
      if (navigator.gpu) navigator.gpu.requestAdapter = async () => null; // as on a Mac whose GPU Chrome can't use
    });
    await app.scan('small', folders.small);
    await expect(page.locator('#file-count')).toHaveText('6 design files · 2 sets · 1 solo · 0 decided');
  });
});
