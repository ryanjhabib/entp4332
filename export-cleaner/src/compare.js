// Step 5: compare versions side by side to find the final, one continuous
// stream through the whole folder in the overview's order (similar families
// next to each other).
//
// Inside a family, "winner stays on": two versions are on screen; pick the
// better one and it stays where it is, the other is out (rejected), and the
// next version takes its place. "Keep both" keeps the newcomer too (a 4:5 post
// and a 9:16 story) and brings in the next.
//
// Where a family ends, its final is checked against the closest version of the
// next family: "Same piece" merges the two families and the comparing goes
// on; "Different" starts the next family. That catches the versions the
// grouping missed, one-file families included. The opposite fix, "Not the
// same", splits the newcomer off into a family of its own.
//
// Choices are stored on each file as entry.decision = 'keep' | 'reject';
// nothing on disk changes.

import { $, show, familyDates, exportFormat, dayFormat, formatSize } from './dom.js';
import { makePreview } from './thumbs.js';
import { fileSimilarity } from './group.js';

let families = []; // every family, in the overview's order (shared with it: merges change it)
let family = null; // the versions being compared, oldest first
const slots = { left: null, right: null }; // the version on each side, or null
let newcomer = 'right'; // the side most recently filled: "keep both" replaces it
let queue = []; // versions still to take a turn, next first
let boundary = null; // the next family, while asking whether it's the same piece
let apart = new Set(); // versions split off with "Not the same": not asked about again
let history = []; // undo: a snapshot from before each choice
let onExit = () => {};

// Opens the stream at a family. history is kept until the user leaves, so
// Undo can step back across families and merges.
export function openFamily(allFamilies, entries, exit) {
  families = allFamilies;
  onExit = exit;
  history = [];
  apart = new Set();
  show('compare');
  startFamily(entries);
}

const contending = (entries) => entries.filter((entry) => entry.decision !== 'reject');

// The newest version starts on the left (most likely the final), the next
// newest on the right; the rest wait their turn, newest first. Versions
// already out stay out: click one in the versions grid to bring it back.
// A family with one version goes straight to the check against its neighbour.
function startFamily(entries) {
  family = entries;
  boundary = null;
  const contenders = contending(entries).reverse();
  if (!contenders.length) contenders.push(entries.at(-1));
  [slots.left, slots.right = null, ...queue] = contenders;
  newcomer = 'right';
  if (slots.right) render();
  else afterChoice();
}

function snapshot() {
  history.push({
    families: [...families],
    family,
    slots: { ...slots },
    newcomer,
    queue: [...queue],
    boundary,
    apart: new Set(apart),
    decisions: family.map((entry) => entry.decision),
  });
}

// The version on `side` wins: it stays, the other is out, the next comes in.
function pick(side) {
  const other = side === 'left' ? 'right' : 'left';
  if (boundary || !slots.left || !slots.right) return;
  snapshot();
  slots[side].decision = 'keep';
  slots[other].decision = 'reject';
  slots[other] = queue.shift() ?? null;
  newcomer = other;
  afterChoice();
}

function keepBoth() {
  if (boundary || !slots.left || !slots.right) return;
  snapshot();
  slots.left.decision = 'keep';
  slots.right.decision = 'keep';
  slots[newcomer] = queue.shift() ?? null;
  afterChoice();
}

// Not the same piece: the newcomer leaves this family for one of its own,
// placed right after it, and the next version comes in. The stream visits it
// next without asking "same piece?" about it again.
function notTheSame() {
  if (boundary || !slots.left || !slots.right) return;
  snapshot();
  const entry = slots[newcomer];
  const rest = family.filter((member) => member !== entry);
  families.splice(families.indexOf(family), 1, rest, [entry]);
  family = rest;
  apart.add(entry);
  slots[newcomer] = queue.shift() ?? null;
  afterChoice();
}

// A lone version at the very end of the stream, with no neighbour left.
function decideAlone(decision) {
  snapshot();
  (slots.left ?? slots.right).decision = decision;
  afterChoice();
}

// Once one side is empty this family's comparing is done: check its final
// against the next family. At the end of the stream, a version never decided
// waits for Keep / Reject; otherwise it's over.
function afterChoice() {
  if (slots.left && slots.right) return render();
  const next = families.slice(families.indexOf(family) + 1).find((f) => contending(f).some((entry) => !entry.decision));
  if (next) return next.every((entry) => apart.has(entry)) ? startFamily(next) : askSamePiece(next);
  if (!(slots.left ?? slots.right).decision) return render();
  exit(true);
}

// The final stays where it is; the next family's closest version comes in beside it.
function askSamePiece(next) {
  const final = slots.left ?? slots.right;
  const side = slots.left ? 'right' : 'left';
  const candidates = contending(next);
  boundary = next;
  slots[side] = final.vectors?.length
    ? candidates.reduce((best, entry) => (fileSimilarity(final, entry) > fileSimilarity(final, best) ? entry : best))
    : candidates.at(-1);
  newcomer = side;
  render();
}

// Same piece: the two families become one, and the comparing goes on with
// the next family's versions taking their turns.
function samePiece() {
  if (!boundary) return;
  snapshot();
  const merged = [...family, ...boundary].sort((a, b) => a.file.lastModified - b.file.lastModified);
  families.splice(families.indexOf(boundary), 1);
  families.splice(families.indexOf(family), 1, merged);
  queue = contending(boundary).filter((entry) => entry !== slots[newcomer]).reverse();
  family = merged;
  boundary = null;
  render();
}

function different() {
  if (!boundary) return;
  snapshot();
  startFamily(boundary);
}

// Clicking a version in the grid brings it in as the newcomer; one that was
// out comes back undecided. While asking "same piece?", only the next
// family's versions can be swapped in, to check a different one.
function challengeWith(entry) {
  if (entry === slots.left || entry === slots.right) return;
  if (boundary && !boundary.includes(entry)) return;
  snapshot();
  if (entry.decision === 'reject') entry.decision = undefined;
  queue = queue.filter((waiting) => waiting !== entry);
  const side = slots.left && slots.right ? newcomer : slots.left ? 'right' : 'left';
  if (slots[side] && !boundary) queue.unshift(slots[side]);
  slots[side] = entry;
  newcomer = side;
  render();
}

function undo() {
  const step = history.pop();
  if (!step) return;
  families.splice(0, families.length, ...step.families);
  step.family.forEach((entry, i) => (entry.decision = step.decisions[i]));
  family = step.family;
  Object.assign(slots, step.slots);
  newcomer = step.newcomer;
  queue = step.queue;
  boundary = step.boundary;
  apart = step.apart;
  render();
}

// finished: true when the stream has reached its end, false when the user left.
// The overview is told which family the stream was on, to show it there.
function exit(finished = false) {
  for (const side of ['left', 'right']) showFrame(side, null);
  history = [];
  onExit(finished, family);
}

function render() {
  const pair = Boolean(slots.left && slots.right);
  const left = queue.length + (pair && !boundary ? 1 : 0);
  $('#compare-where').textContent =
    `${familyDates(family)} · family ${families.indexOf(family) + 1} of ${families.length} · ` +
    `${family.length} version${family.length > 1 ? 's' : ''} · ` +
    (boundary ? 'same piece as the next family?' : left ? `${left} left to compare` : 'nothing left to compare');
  for (const side of ['left', 'right']) {
    const other = slots[side === 'left' ? 'right' : 'left'];
    showFrame(side, slots[side]);
    renderCaption($(`#caption-${side}`), slots[side], other);
  }
  const comparing = pair && !boundary;
  $('#pick-left').hidden = !comparing;
  $('#pick-right').hidden = !comparing;
  $('#keep-both').hidden = !comparing;
  $('#not-the-same').hidden = !comparing;
  $('#not-the-same').title = comparing ? `Moves ${slots[newcomer].name} into a family of its own` : '';
  $('#same-piece').hidden = !boundary;
  $('#different').hidden = !boundary;
  $('#keep-alone').hidden = pair;
  $('#reject-alone').hidden = pair;
  $('#compare-undo').disabled = !history.length;
  renderVersions();
}

// The details under a frame. A detail that differs from the other side is
// marked, since that difference is often the answer. The shot date only
// shows when one side has one (design exports never do).
function renderCaption(caption, entry, other) {
  if (!entry) return caption.replaceChildren();
  const noShot = !entry.shot?.taken && !other?.shot?.taken;
  const shown = ([key]) => !(noShot && key === 'shot');
  const mine = details(entry).filter(shown);
  const theirs = other ? details(other).filter(shown) : null;
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

// This family's versions; while asking "same piece?", the next family's after a divider.
function renderVersions() {
  const items = family.map(versionItem);
  if (boundary) {
    const divider = document.createElement('li');
    divider.className = 'version-divider';
    divider.textContent = `Next family · ${familyDates(boundary)}`;
    items.push(divider, ...boundary.map(versionItem));
  }
  $('#version-grid').replaceChildren(...items);
}

function versionItem(entry) {
  const item = document.createElement('li');
  const onScreen = entry === slots.left || entry === slots.right;
  item.dataset.state = onScreen ? 'on-screen' : entry.decision === 'reject' ? 'out' : '';
  item.title = entry.name;
  item.innerHTML = '<div class="version-thumb"><span class="mark"></span></div><p class="version-date"></p>';
  if (entry.thumb) {
    const img = document.createElement('img');
    img.src = entry.thumb;
    img.alt = '';
    item.firstChild.prepend(img);
  }
  item.querySelector('.mark').textContent = { keep: '✓', reject: '✕' }[entry.decision] ?? '';
  item.querySelector('.version-date').textContent = exportFormat.format(entry.file.lastModified);
  item.addEventListener('click', () => challengeWith(entry));
  return item;
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
  frame.dataset.empty = entry && !entry.thumb ? 'No preview' : !entry ? 'Only version' : '';
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
$('#not-the-same').addEventListener('click', notTheSame);
$('#same-piece').addEventListener('click', samePiece);
$('#different').addEventListener('click', different);
$('#keep-alone').addEventListener('click', () => decideAlone('keep'));
$('#reject-alone').addEventListener('click', () => decideAlone('reject'));
$('#compare-undo').addEventListener('click', undo);
$('#view-families').addEventListener('click', () => exit());

document.addEventListener('keydown', (event) => {
  if ($('#compare').hidden || event.repeat) return;
  const command = event.metaKey || event.ctrlKey;
  if (command && event.key !== 'z') return; // leave ⌘S, ⌘D and the like to the browser
  if (event.key === 'ArrowLeft') pick('left');
  else if (event.key === 'ArrowRight') pick('right');
  else if (event.key === 'ArrowDown') keepBoth();
  else if (event.key === 'n') notTheSame();
  else if (event.key === 's') samePiece();
  else if (event.key === 'd') different();
  else if (event.key === 'Escape') exit();
  else if ((event.key === 'z' && command) || event.key === 'Backspace') undo();
  else return;
  event.preventDefault();
});
