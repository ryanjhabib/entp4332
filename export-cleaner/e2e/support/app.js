// What every test starts with: a fresh browser profile (nothing saved from
// other tests), the folder-picker stand-in, the network rules, and helpers for
// each screen. When a test ends it also fails if the page threw an error
// nobody caught, or if anything tried to reach the internet beyond the AI
// downloads.

import { test as base, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { guardNetwork } from './network.js';

const BROWSER_HELPERS = fileURLToPath(new URL('./browser.js', import.meta.url));

// The visible copy of a name (the app draws each name twice for its ticker).
const NAME = '.loop-track > span:first-child';

export const test = base.extend({
  // Set gpu: true in a test to leave WebGPU switched on (see the WebGPU test).
  gpu: [false, { option: true }],

  context: async ({ context, gpu }, use) => {
    const blocked = await guardNetwork(context);
    const errors = [];
    context.on('page', (page) => page.on('pageerror', (error) => errors.push(`${page.url()}: ${error.message}`)));
    await context.addInitScript({ path: BROWSER_HELPERS });
    // The test browser has no graphics card: Chrome offers WebGPU but can't
    // start it, which stops the scan (an open bug, see the WebGPU test in
    // start.spec.js). So the image model runs on the processor here, the
    // app's own path for a Chrome without WebGPU. Same model, same files.
    if (!gpu) await context.addInitScript(() => delete Navigator.prototype.gpu);
    await use(context);
    expect(errors, 'errors the page threw and didn’t catch').toEqual([]);
    expect(blocked, 'requests that tried to leave the computer').toEqual([]);
  },

  app: async ({ page }, use) => use(new App(page)),
});

export { expect };

export class App {
  constructor(page) {
    this.page = page;
  }

  $(selector) {
    return this.page.locator(selector);
  }

  // ---- Start screen ----

  async open() {
    await this.page.goto('/');
    await expect(this.$('#start')).toBeVisible();
  }

  async makeFolder(name, files) {
    await this.page.evaluate(([folder, list]) => window.__e2e.makeFolder(folder, list), [name, files]);
  }

  // Clicks "select" with the picker stand-in set to hand over this folder.
  async choose(name) {
    await this.page.evaluate((folder) => window.__e2e.choose(folder), name);
    await this.$('#choose').click();
  }

  // Types into the media type field and presses Enter.
  async describe(text) {
    const field = this.$('#describe-input');
    await field.click();
    await field.fill(text);
    await field.press('Enter');
  }

  // Opens the app, makes the folder, picks it, describes it, and waits for Families.
  async scan(name, files, type = 'mixed exports') {
    await this.open();
    await this.makeFolder(name, files);
    await this.choose(name);
    await this.describe(type);
    await this.waitForFamilies();
  }

  // Waits until a scan that ran on the start screen has finished and its bar
  // has settled at 100%. (Choosing the type in the moment before it settles
  // leaves the app stuck: a new bug, see start.spec.js.)
  async waitForScanOnStart() {
    await expect(this.$('#start-estimate')).toHaveText('Ready', { timeout: 120_000 });
    const fill = this.$('#start .loading-fill');
    await expect.poll(() => fill.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a)).toBe(1);
  }

  async waitForFamilies(timeout = 180_000) {
    await expect(this.$('#files')).toBeVisible({ timeout });
  }

  async files(name) {
    return this.page.evaluate((folder) => window.__e2e.listFolder(folder), name);
  }

  // ---- Families ----

  // Every cell on the Families grid, in order: its files (with choices) and counts.
  async families() {
    return this.page.$$eval(
      '#families .family',
      (cells, name) =>
        cells.map((cell) => ({
          files: [...cell.querySelectorAll('.card-row > li')].map((li) => li.querySelector(`.card-name ${name}`).textContent),
          decisions: Object.fromEntries(
            [...cell.querySelectorAll('.card-row > li')].map((li) => [li.querySelector(`.card-name ${name}`).textContent, li.dataset.decision || 'undecided']),
          ),
          counts: cell.querySelector('.family-counts').textContent,
        })),
      NAME,
    );
  }

  // The names in each family, sorted, for comparing groupings.
  async grouping() {
    return (await this.families()).map((family) => [...family.files].sort()).sort((a, b) => a[0].localeCompare(b[0]));
  }

  // Every file's choice, as Families shows it: { name: 'keep' | 'reject' | 'undecided' }.
  async decisions() {
    return Object.assign({}, ...(await this.families()).map((family) => family.decisions));
  }

  // The Families cell holding this file.
  cell(file) {
    return this.$('#families .family').filter({ has: this.page.locator(`.card-name ${NAME}`, { hasText: new RegExp(`^${escape(file)}$`) }) });
  }

  async toFamilies() {
    const button = this.page.locator('.screen:not([hidden]) .compare-toggle button', { hasText: 'Families' });
    await button.click();
    await expect(this.$('#files')).toBeVisible();
  }

  // ---- Sort ----

  // What Sort shows: 'pair', 'zoom' or 'solo', and the version on each side.
  async sort() {
    await expect(this.$('#compare')).toBeVisible();
    return this.page.evaluate((name) => {
      const compare = document.querySelector('#compare');
      const side = (id) => {
        const info = document.querySelector(`#info-${id}`);
        if (info.hidden || info.offsetParent === null) return null;
        return { name: info.querySelector(`.compare-details ${name}`)?.textContent, index: info.querySelector('.compare-index').textContent };
      };
      const mode = compare.classList.contains('is-zoomed') ? 'zoom' : compare.classList.contains('is-solo') ? 'solo' : 'pair';
      return { mode, left: side('left'), right: side('right'), zoom: side('zoom') };
    }, NAME);
  }

  // The versions strip under the pair: each version's name and state
  // ('on-screen', 'out' or '').
  async strip() {
    return this.page.$$eval('#version-grid > li', (items) => items.map((item) => ({ name: item.title, state: item.dataset.state })));
  }

  // Waits until Sort shows this pair (left, right).
  async expectPair(left, right) {
    await expect.poll(async () => {
      const shown = await this.sort();
      return shown.mode === 'pair' ? [shown.left?.name, shown.right?.name] : shown.mode;
    }).toEqual([left, right]);
  }

  // Waits until Sort shows this version on its own, for Keep or Delete.
  async expectSolo(name) {
    await expect.poll(async () => {
      const shown = await this.sort();
      return shown.mode === 'solo' ? shown.zoom?.name : shown.mode;
    }).toBe(name);
  }

  // ---- Summary ----

  async summary() {
    await expect(this.$('#summary')).toBeVisible();
    return this.page.evaluate((name) => {
      const names = (id) => {
        const group = document.querySelector(`#summary-${id}`);
        return group.hidden ? [] : [...group.querySelectorAll(`.card-row > li .card-name ${name}`)].map((n) => n.textContent).sort();
      };
      const apply = document.querySelector('#apply');
      return {
        title: document.querySelector('#summary-space').textContent,
        count: document.querySelector('#summary-count').textContent,
        reject: names('reject'),
        keep: names('keep'),
        undecided: names('undecided'),
        apply: apply.hidden ? null : apply.textContent,
      };
    }, NAME);
  }

  // A Summary card, to click.
  summaryCard(file) {
    return this.$('#summary .card-row > li').filter({ has: this.page.locator(`.card-name ${NAME}`, { hasText: new RegExp(`^${escape(file)}$`) }) });
  }
}

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
