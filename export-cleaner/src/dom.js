// Small helpers shared by the screens.

export const $ = (selector) => document.querySelector(selector);

// Shows one screen and hides the rest.
export function show(id) {
  for (const screen of document.querySelectorAll('.screen')) screen.hidden = screen.id !== id;
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
export const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

// "Mon, Oct 26 · 10:00 – 10:35 AM"
export function sessionLabel({ files }) {
  const start = files[0].file.lastModified;
  const end = files.at(-1).file.lastModified;
  return `${dayFormat.format(start)} · ${timeFormat.formatRange(start, end)}`;
}

export function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
