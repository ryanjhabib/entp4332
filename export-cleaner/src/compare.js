// Step 5: compare a family's versions side by side to find the final.
// "Winner stays on": two versions are on screen; pick the better one and it
// stays where it is, the other is out (rejected), and the next version takes
// its place. "Keep both" keeps the newcomer too (a 4:5 post and a 9:16 story)
// and brings in the next. When no versions are left, the last one standing is
// the final. Choices are stored on each file as entry.decision = 'keep' |
// 'reject'; nothing on disk changes.

import { $, show, familyDates, exportFormat, dayFormat, formatSize } from './dom.js';
import { makePreview } from './thumbs.js';

let families = []; // every family, to find the next one to compare
let family = null; // the versions being compared, oldest first
const slots = { left: null, right: null }; // the version on each side, or null
let newcomer = 'right'; // the side most recently filled: "keep both" replaces it
let queue = []; // versions still to take a turn, next first
let history = []; // undo: a snapshot from before each choice
let onExit = () => {};

// Opens a family. history is kept across families until the user leaves,
// so Undo can step back into the family before.
export function openFamily(allFamilies, entries, exit) {
  families = allFamilies;
  onExit = exit;
  history = [];
  startFamily(entries);
  show('compare');
}

// The newest version starts on the left (most likely the final), the next
// newest on the right; the rest wait their turn, newest first. Versions
// already out stay out: click one in the versions grid to bring it back.
function startFamily(entries) {
  family = entries;
  const contenders = entries.filter((entry) => entry.decision !== 'reject').reverse();
  if (!contenders.length) contenders.push(entries.at(-1));
  [slots.left, slots.right = null, ...queue] = contenders;
  newcomer = 'right';
  render();
}

function snapshot() {
  history.push({ family, slots: { ...slots }, newcomer, queue: [...queue], decisions: family.map((entry) => entry.decision) });
}

// The version on `side` wins: it stays, the other is out, the next comes in.
function pick(side) {
  const other = side === 'left' ? 'right' : 'left';
  if (!slots.right) return;
  snapshot();
  slots[side].decision = 'keep';
  slots[other].decision = 'reject';
  slots[other] = queue.shift() ?? null;
  newcomer = other;
  afterChoice();
}

function keepBoth() {
  if (!slots.right) return;
  snapshot();
  slots.left.decision = 'keep';
  slots.right.decision = 'keep';
  slots[newcomer] = queue.shift() ?? null;
  afterChoice();
}

// A version with nothing left to compare it to (a one-file family).
function decideAlone(decision) {
  snapshot();
  slots.left.decision = decision;
  afterChoice();
}

// Once a side is empty the family is done; on to the next family with
// versions to compare, or, when there's none, out of this screen.
function afterChoice() {
  if (slots.left && slots.right) return render();
  const next = families.find((f) => f.length > 1 && f.some((entry) => !entry.decision));
  if (next) startFamily(next);
  else exit(true);
}

// Clicking a version in the grid brings it in as the newcomer; one that was out comes back undecided.
function challengeWith(entry) {
  if (entry === slots.left || entry === slots.right) return;
  snapshot();
  if (entry.decision === 'reject') entry.decision = undefined;
  queue = queue.filter((waiting) => waiting !== entry);
  const side = slots.right ? newcomer : 'right';
  if (slots[side]) queue.unshift(slots[side]);
  slots[side] = entry;
  newcomer = side;
  render();
}

function undo() {
  const step = history.pop();
  if (!step) return;
  step.family.forEach((entry, i) => (entry.decision = step.decisions[i]));
  family = step.family;
  Object.assign(slots, step.slots);
  newcomer = step.newcomer;
  queue = step.queue;
  render();
}

// finished: true when there's nothing left to compare, false when the user left early.
function exit(finished = false) {
  for (const side of ['left', 'right']) showFrame(side, null);
  history = [];
  onExit(finished);
}

function render() {
  const left = queue.length + (slots.right ? 1 : 0);
  $('#compare-where').textContent =
    `${familyDates(family)} · family ${families.indexOf(family) + 1} of ${families.length} · ` +
    `${family.length} versions · ${left ? `${left} left to compare` : 'nothing left to compare'}`;
  const pair = Boolean(slots.right);
  for (const side of ['left', 'right']) {
    const other = slots[side === 'left' ? 'right' : 'left'];
    showFrame(side, slots[side]);
    renderCaption($(`#caption-${side}`), slots[side], other);
  }
  $('#pick-left').hidden = !pair;
  $('#pick-right').hidden = !pair;
  $('#keep-both').hidden = !pair;
  $('#keep-alone').hidden = pair;
  $('#reject-alone').hidden = pair;
  $('#compare-undo').disabled = !history.length;
  renderVersions();
}

// The details under a frame. A detail that differs from the other side is
// marked, since that difference is often the answer.
function renderCaption(caption, entry, other) {
  if (!entry) return caption.replaceChildren();
  const mine = details(entry);
  const theirs = other ? details(other) : null;
  caption.replaceChildren(
    ...mine.map(([key, text, compareBy = text], i) => {
      const line = document.createElement('span');
      line.textContent = text;
      if (key === 'name') line.className = 'name';
      else if (theirs && compareBy !== (theirs[i][2] ?? theirs[i][1])) line.className = 'differs';
      return line;
    }),
  );
}

// [key, text shown, value compared with the other side (defaults to the text)]
function details(entry) {
  const exported = entry.file.lastModified;
  return [
    ['name', entry.name],
    ['exported', `Exported ${exportFormat.format(exported)}`, dayFormat.format(exported)], // same day counts as same
    ['shot', entry.shot?.taken ? `Shot ${dayFormat.format(entry.shot.taken)}` : 'No shot date'],
    ['shape', shape(entry)],
    ['size', `${formatSize(entry.file.size)} · ${entry.ext.toUpperCase()}`],
  ];
}

// "1080 × 1350 · 4:5", or for a PDF its page count.
function shape(entry) {
  if (entry.ext === 'pdf') return `${entry.vectors?.length || 1} page${entry.vectors?.length > 1 ? 's' : ''}`;
  if (!entry.width) return 'Size unknown';
  return `${entry.width} × ${entry.height} · ${ratio(entry.width, entry.height)}`;
}

const RATIOS = [[1, 1], [4, 5], [5, 4], [2, 3], [3, 2], [3, 4], [4, 3], [9, 16], [16, 9], [1, 2], [2, 1]];

// The common aspect ratio within 1%, or the ratio to one decimal ("1.9:1").
function ratio(width, height) {
  const r = width / height;
  const match = RATIOS.find(([w, h]) => Math.abs(r - w / h) / (w / h) < 0.01);
  return match ? `${match[0]}:${match[1]}` : `${r.toFixed(1)}:1`;
}

function renderVersions() {
  $('#version-grid').replaceChildren(
    ...family.map((entry) => {
      const item = document.createElement('li');
      const onScreen = entry === slots.left || entry === slots.right;
      item.dataset.state = onScreen ? 'on-screen' : entry.decision === 'reject' ? 'out' : '';
      item.title = entry.name;
      if (entry.thumb) {
        const img = document.createElement('img');
        img.src = entry.thumb;
        img.alt = '';
        item.append(img);
      }
      const mark = document.createElement('span');
      mark.className = 'mark';
      mark.textContent = { keep: '✓', reject: '✕' }[entry.decision] ?? '';
      item.append(mark);
      item.addEventListener('click', () => challengeWith(entry));
      return item;
    }),
  );
}

// Each frame shows the thumbnail at once, then the full-size image once decoded.
const shown = { left: null, right: null };
const previewUrls = { left: null, right: null };

async function showFrame(side, entry) {
  if (shown[side] === entry) return; // already showing it, maybe already full size
  shown[side] = entry;
  if (previewUrls[side]) URL.revokeObjectURL(previewUrls[side]);
  previewUrls[side] = null;
  const frame = $(`#frame-${side}`);
  const img = frame.querySelector('img');
  img.hidden = !entry?.thumb;
  img.src = entry?.thumb ?? '';
  frame.dataset.empty = entry && !entry.thumb ? 'No preview' : !entry && side === 'right' ? 'Only version' : '';
  if (!entry?.thumb) return;
  let url;
  try {
    url = await makePreview(entry);
    const loader = new Image();
    loader.src = url;
    await loader.decode();
  } catch {
    if (url) URL.revokeObjectURL(url);
    return; // keep showing the thumbnail
  }
  if (shown[side] !== entry) return URL.revokeObjectURL(url); // moved on while it loaded
  previewUrls[side] = url;
  img.src = url;
}

$('#pick-left').addEventListener('click', () => pick('left'));
$('#pick-right').addEventListener('click', () => pick('right'));
$('#keep-both').addEventListener('click', keepBoth);
$('#keep-alone').addEventListener('click', () => decideAlone('keep'));
$('#reject-alone').addEventListener('click', () => decideAlone('reject'));
$('#compare-undo').addEventListener('click', undo);
$('#compare-back').addEventListener('click', () => exit());

document.addEventListener('keydown', (event) => {
  if ($('#compare').hidden || event.repeat) return;
  if (event.key === 'ArrowLeft') pick('left');
  else if (event.key === 'ArrowRight') pick('right');
  else if (event.key === 'ArrowDown') keepBoth();
  else if (event.key === 'Escape') exit();
  else if ((event.key === 'z' && (event.metaKey || event.ctrlKey)) || event.key === 'Backspace') undo();
  else return;
  event.preventDefault();
});
