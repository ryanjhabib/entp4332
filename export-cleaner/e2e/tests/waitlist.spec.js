// The Mac app waitlist. Its one network call is answered here by the test:
// the test build points it at an address that can't exist
// (waitlist.e2e.invalid), so nothing can ever reach the real Supabase table.

import { test, expect } from '../support/app.js';
import * as folders from '../support/folders.js';
import { WAITLIST_URL } from '../support/env.js';

// Answers the waitlist's call with each status in turn; returns the requests made.
async function answerWaitlist(page, ...statuses) {
  const requests = [];
  await page.route(`${WAITLIST_URL}/**`, (route) => {
    requests.push(route.request());
    return route.fulfill({ status: statuses[Math.min(requests.length, statuses.length) - 1] ?? 201, body: '' });
  });
  return requests;
}

async function openWaitlist(app, page) {
  await app.open();
  await page.locator('#start .waitlist-open').click();
  await expect(page.locator('#join')).toBeVisible();
  await expect(page.locator('#join-email')).toBeFocused();
}

async function submit(page, email) {
  await page.locator('#join-email').fill(email);
  await page.locator('#join-email').press('Enter');
}

test.describe('Waitlist', () => {
  test('opens the join screen with the email field ready; Back and Escape return', async ({ app, page }) => {
    await openWaitlist(app, page);
    await expect(page.locator('#join-intro')).toHaveText('Be notified when Export Cleaner is ready for Mac.');
    await page.locator('#join-back').click();
    await expect(page.locator('#start')).toBeVisible();
    await page.locator('#start .waitlist-open').click();
    await expect(page.locator('#join-email')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#start')).toBeVisible();
  });

  test('an address that isn’t an email is refused, and nothing is sent', async ({ app, page }) => {
    const requests = await answerWaitlist(page, 201);
    await openWaitlist(app, page);
    for (const email of ['hello', 'ryan@example', '@example.com']) {
      await page.locator('#join-intro').evaluate((el) => (el.textContent = ''));
      await submit(page, email);
      await expect(page.locator('#join-intro')).toHaveText('That email doesn’t look right.');
    }
    expect(requests).toHaveLength(0);
  });

  test('a valid email is sent once, lower-cased and trimmed, with nothing but the email', async ({ app, page }) => {
    const requests = await answerWaitlist(page, 201);
    await openWaitlist(app, page);
    await submit(page, '  Ryan@Example.com ');
    await expect(page.locator('#join-intro')).toHaveText('Thank you, you’re on the list.');
    await expect(page.locator('#join-email')).toHaveValue('');
    await expect(page.locator('#join-email')).toHaveAttribute('placeholder', 'We’ll email you when it’s ready.');
    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request.method()).toBe('POST');
    expect(request.url()).toBe(`${WAITLIST_URL}/rest/v1/waitlist`);
    expect(request.postDataJSON()).toEqual({ email: 'ryan@example.com' });
    expect(await request.allHeaders()).toMatchObject({ apikey: 'e2e-not-a-real-key', prefer: 'return=minimal' });
  });

  test('already on the list (409) counts as success', async ({ app, page }) => {
    await answerWaitlist(page, 409);
    await openWaitlist(app, page);
    await submit(page, 'ryan@example.com');
    await expect(page.locator('#join-intro')).toHaveText('Thank you, you’re on the list.');
  });

  test('a failed save says so and lets you try again', async ({ app, page }) => {
    const requests = await answerWaitlist(page, 500, 201);
    await openWaitlist(app, page);
    await submit(page, 'ryan@example.com');
    await expect(page.locator('#join-intro')).toHaveText('That didn’t save. Try again.');
    await expect(page.locator('#join-email')).toBeEnabled();
    await expect(page.locator('#join-email')).toBeFocused();
    await page.locator('#join-email').press('Enter');
    await expect(page.locator('#join-intro')).toHaveText('Thank you, you’re on the list.');
    expect(requests).toHaveLength(2);
  });

  test.fixme('after a success the email field can be used again', {
    annotation: { type: 'bug', description: 'Open on master (TESTING.md 2026-11-04): the field stays disabled after a success until a refresh.' },
  }, async ({ app, page }) => {
    await answerWaitlist(page, 201);
    await openWaitlist(app, page);
    await submit(page, 'ryan@example.com');
    await expect(page.locator('#join-intro')).toHaveText('Thank you, you’re on the list.');
    await expect(page.locator('#join-email')).toBeEnabled();
  });

  test.fixme('opened during a scan, the waitlist stays open when the scan ends', {
    annotation: { type: 'bug', description: 'Open on master (TESTING.md 2026-11-04): the end of the scan pulls you to Families.' },
  }, async ({ app, page }) => {
    await app.open();
    await app.makeFolder('small', folders.small);
    await app.choose('small');
    await app.describe('mixed exports');
    await expect(page.locator('#loading')).toBeVisible();
    await page.locator('#loading .waitlist-open').click();
    await expect(page.locator('#join')).toBeVisible();
    await expect(page.locator('#loading-eta')).toHaveText('Ready', { timeout: 120_000 }); // the scan has ended
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1000)));
    await expect(page.locator('#join')).toBeVisible();
  });
});
