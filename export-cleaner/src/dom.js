// Small helpers shared by the screens.

export const $ = (selector) => document.querySelector(selector);

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// Changes screen. As on Mercy Stays Warm, the new screen fades in over the
// old one, which holds and fades only in the second half (a view
// transition; timing in style.css, --screen-fade). The first screen just
// appears. Resolves once the new screen is showing.
export function show(id) {
  const swap = () => {
    for (const screen of document.querySelectorAll('.screen')) screen.hidden = screen.id !== id;
  };
  const current = document.querySelector('.screen:not([hidden])');
  if (!current || current.id === id || !document.startViewTransition || reducedMotion.matches) {
    swap();
    return Promise.resolve();
  }
  return document.startViewTransition(swap).updateCallbackDone;
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
  return dayFormat.formatRange(entries[0].file.lastModified, entries.at(-1).file.lastModified);
}

export function formatSize(bytes, decimals = 1) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(decimals)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(decimals)} GB`;
}
