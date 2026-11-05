// Small helpers shared by the screens.

export const $ = (selector) => document.querySelector(selector);

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// Makes a change to the page with a fade, as on Mercy Stays Warm: the new
// look fades in over the old, which holds and fades only in the second half
// (a view transition; timing in style.css, --screen-fade). Resolves once
// the change has been made.
export function fade(change) {
  if (!document.startViewTransition || reducedMotion.matches) {
    change();
    return Promise.resolve();
  }
  const transition = document.startViewTransition(change);
  // A fade is skipped when another starts or the tab is hidden; the change
  // still happens, so its rejected promises mean nothing.
  transition.ready.catch(() => {});
  transition.finished.catch(() => {});
  return transition.updateCallbackDone;
}

// Changes screen, with the fade. The first screen just appears.
export function show(id) {
  const swap = () => {
    for (const screen of document.querySelectorAll('.screen')) screen.hidden = screen.id !== id;
  };
  const current = document.querySelector('.screen:not([hidden])');
  if (!current || current.id === id) {
    swap();
    return Promise.resolve();
  }
  return fade(swap);
}

// A CSS time token in ms ("400ms", or ".4s" once the build has minified it).
export function cssTime(element, name) {
  const time = getComputedStyle(element).getPropertyValue(name).trim();
  return parseFloat(time) * (time.endsWith('ms') ? 1 : 1000);
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// "Oct 26, 10:05 AM": when one file was exported.
export const exportFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// "Oct 26, 2026"
export const dayFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

// When a family's files were exported: "Oct 26, 2026", or "Mar 3 – Oct 26, 2026".
export function familyDates(entries) {
  const dates = entries.map((entry) => entry.file.lastModified);
  return dayFormat.formatRange(Math.min(...dates), Math.max(...dates));
}

// Under 1 KB reads 1 KB, so a small file doesn't read as nothing; only 0 reads 0.
export function formatSize(bytes, decimals = 1) {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(decimals)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(decimals)} GB`;
}
