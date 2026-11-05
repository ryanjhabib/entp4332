// Apply and Done: the only part of the app that changes the folder.
//
// The mixed folder plus a _to_delete folder from an earlier run that already
// holds a flowers.png. Choices: sunset-bw.png kept, sunset-crop.jpg and
// flowers.png rejected, the other 9 design files undecided.

import { test, expect } from '../support/app.js';
import * as folders from '../support/folders.js';

const FOLDER = [...folders.mixed, { dir: '_to_delete', files: [{ name: 'flowers.png', text: 'rejected in an earlier run' }] }];

async function chooseAndOpenSummary(app, page) {
  await app.scan('mixed', FOLDER);
  await app.cell('sunset.png').click();
  await app.expectPair('sunset-bw.png', 'sunset-crop.jpg');
  await page.locator('#pick-left').click();
  await page.keyboard.press('Escape');
  await app.cell('flowers.png').click();
  await app.expectSolo('flowers.png');
  await page.locator('#delete-solo').click();
  await app.toFamilies();
  await page.locator('#open-summary').click();
  expect(await app.summary()).toMatchObject({
    reject: ['flowers.png', 'sunset-crop.jpg'],
    keep: ['sunset-bw.png'],
    apply: 'Move 2 files to _to_delete',
  });
}

test.describe('Apply and Done', () => {
  test('moves only the rejected files into _to_delete, renames a clash, and leaves everything else alone', async ({ app, page }) => {
    await chooseAndOpenSummary(app, page);
    const before = await app.files('mixed');
    await page.locator('#apply').click();
    await expect(page.locator('#done')).toBeVisible();
    await expect(page.locator('#done-result')).toHaveText('Moved 2 files into _to_delete inside “mixed”. 10 other files weren’t touched.');
    await expect(page.locator('#done-how')).toHaveText(
      'Every file was moved directly: same file, same dates, nothing copied. 1 renamed to avoid a clash with files already in _to_delete.',
    );
    await expect(page.locator('#done-space')).toHaveText(/^\d+ KB is now in _to_delete\. Delete that folder in Finder to free it\.$/);
    await expect(page.locator('#done-failed')).toBeHidden();

    const after = await app.files('mixed');
    const expected = { ...before };
    delete expected['flowers.png'];
    delete expected['sunset-crop.jpg'];
    expected['_to_delete/flowers (2).png'] = before['flowers.png'];
    expected['_to_delete/sunset-crop.jpg'] = before['sunset-crop.jpg'];
    // Same sizes and dates everywhere: skipped files, the subfolder, the earlier
    // flowers.png, undecided and kept files untouched; moved files unchanged.
    expect(after).toEqual(expected);
  });

  test('Rescan shows what’s left, with the choices it still has', async ({ app, page }) => {
    await chooseAndOpenSummary(app, page);
    await page.locator('#apply').click();
    await expect(page.locator('#done')).toBeVisible();
    await page.locator('#rescan').click();
    await app.waitForFamilies();
    await expect(page.locator('#file-count')).toHaveText('10 design files · 3 sets · 4 solos · 1 decided');
    const decisions = await app.decisions();
    expect(decisions['sunset-bw.png']).toBe('keep');
    expect(Object.keys(decisions)).not.toContain('flowers.png');
    expect(Object.keys(decisions)).not.toContain('sunset-crop.jpg');
  });

  test('a file dragged back out of _to_delete comes back undecided', async ({ app, page }) => {
    await chooseAndOpenSummary(app, page);
    const before = await app.files('mixed');
    await page.locator('#apply').click();
    await expect(page.locator('#done')).toBeVisible();
    await page.evaluate(() => window.__e2e.moveBack('mixed', 'sunset-crop.jpg')); // what Finder does
    // Same name, size and date as before: the app would recognise it as the same file.
    expect((await app.files('mixed'))['sunset-crop.jpg']).toEqual(before['sunset-crop.jpg']);
    await page.locator('#rescan').click();
    await app.waitForFamilies();
    await expect(page.locator('#file-count')).toHaveText('11 design files · 3 sets · 4 solos · 1 decided');
    expect(await app.decisions()).toMatchObject({ 'sunset-crop.jpg': 'undecided', 'sunset-bw.png': 'keep' });
  });

  test.fixme('Done with nothing moved says so, and leaves no empty _to_delete', {
    annotation: { type: 'bug', description: 'Open on master (TESTING.md 2026-11-04): Done says “Every file was moved directly” and “still in place” for a file that’s gone.' },
  }, async ({ app, page }) => {
    await app.scan('small', folders.small);
    await app.cell('flowers.png').click();
    await page.locator('#delete-solo').click();
    await app.toFamilies();
    await page.locator('#open-summary').click();
    await page.evaluate(() => window.__e2e.removeFile('small', 'flowers.png')); // gone before Apply
    await page.locator('#apply').click();
    await expect(page.locator('#done')).toBeVisible();
    await expect(page.locator('#done-how')).not.toContainText('Every file was moved directly');
    await expect(page.locator('#done-failed-head')).not.toContainText('still in place');
    expect(Object.keys(await app.files('small')).some((path) => path.startsWith('_to_delete'))).toBe(false);
  });
});
