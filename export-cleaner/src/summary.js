// Step 6: everything that will and won't happen, before anything does.

import { $, show, plural, formatSize } from './dom.js';

// Shows the summary for the folder's files, in export order. The overview's
// cards are moved in here; the overview moves them back when it next renders.
export function showSummary(files) {
  const groups = {
    reject: files.filter((entry) => entry.decision === 'reject'),
    keep: files.filter((entry) => entry.decision === 'keep'),
    undecided: files.filter((entry) => !entry.decision),
  };
  $('#summary-count').textContent =
    `${plural(files.length, 'file')} · ${groups.reject.length} to reject · ${groups.keep.length} to keep · ` +
    `${groups.undecided.length} undecided · nothing has changed yet`;

  const titles = { reject: 'Reject', keep: 'Keep', undecided: 'Undecided' };
  for (const [name, entries] of Object.entries(groups)) {
    const group = $(`#summary-${name}`);
    group.hidden = !entries.length;
    const bytes = entries.reduce((sum, entry) => sum + entry.file.size, 0);
    group.querySelector('.summary-head').textContent = `${titles[name]} · ${plural(entries.length, 'file')} · ${formatSize(bytes)}`;
    for (const entry of entries) entry.card.dataset.decision = entry.decision ?? '';
    group.querySelector('.card-row').replaceChildren(...entries.map((entry) => entry.card));
  }
  show('summary');
}
