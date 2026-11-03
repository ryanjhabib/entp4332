// Step 6: everything that will and won't happen, before anything does.

import { $, show, plural, formatSize } from './dom.js';

let shownFiles = [];
let onChange = () => {};
const entryOfCard = new WeakMap();

// Shows the summary for the folder's files, in export order. The overview's
// cards are moved in here; the overview moves them back when it next renders.
// change() is called when a choice is cleared here (to save progress).
export function showSummary(files, change = onChange) {
  shownFiles = files;
  onChange = change;
  const groups = {
    reject: files.filter((entry) => entry.decision === 'reject'),
    keep: files.filter((entry) => entry.decision === 'keep'),
    undecided: files.filter((entry) => !entry.decision),
  };
  $('#summary-count').textContent =
    `${plural(files.length, 'file')} · ${groups.reject.length} to reject · ${groups.keep.length} to keep · ` +
    `${groups.undecided.length} undecided · nothing has changed yet`;
  const rejectBytes = groups.reject.reduce((sum, entry) => sum + entry.file.size, 0);
  $('#summary-space').textContent = groups.reject.length
    ? `Rejecting these frees ${formatSize(rejectBytes)}`
    : groups.keep.length ? 'Nothing marked to reject yet' : 'Nothing has been sorted yet';
  $('#apply').hidden = !groups.reject.length;
  $('#apply').textContent = `Move ${plural(groups.reject.length, 'file')} to _to_delete`;
  $('#apply-status').textContent = '';

  const titles = { reject: 'Reject', keep: 'Keep', undecided: 'Undecided' };
  for (const [name, entries] of Object.entries(groups)) {
    const group = $(`#summary-${name}`);
    group.hidden = !entries.length;
    const bytes = entries.reduce((sum, entry) => sum + entry.file.size, 0);
    group.querySelector('.summary-head').textContent = `${titles[name]} · ${plural(entries.length, 'file')} · ${formatSize(bytes)}`;
    for (const entry of entries) {
      entry.card.dataset.decision = entry.decision ?? '';
      entryOfCard.set(entry.card, entry);
    }
    group.querySelector('.card-row').replaceChildren(...entries.map((entry) => entry.card));
  }
  show('summary');
}

// Clicking a file to reject or keep clears its choice: it goes back to
// Undecided, so a mistake is fixed where it's seen.
for (const name of ['reject', 'keep']) {
  $(`#summary-${name} .card-row`).addEventListener('click', (event) => {
    const entry = entryOfCard.get(event.target.closest('li'));
    if (!entry) return;
    entry.decision = undefined;
    onChange();
    showSummary(shownFiles);
  });
}
