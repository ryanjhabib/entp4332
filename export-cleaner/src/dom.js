// Small helpers shared by the screens.

export const $ = (selector) => document.querySelector(selector);

// Shows one screen and hides the rest.
export function show(id) {
  for (const screen of document.querySelectorAll('.screen')) screen.hidden = screen.id !== id;
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// "Oct 26, 10:05 AM": when one file was exported.
export const exportFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const dayFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

// When a family's files were exported: "Oct 26, 2026", or "Mar 3 – Oct 26, 2026".
export function familyDates(entries) {
  return dayFormat.formatRange(entries[0].file.lastModified, entries.at(-1).file.lastModified);
}

export function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
