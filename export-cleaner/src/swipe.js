// Step 5: decide a family one file at a time.
// Right (drag, → key or button) keeps, left rejects. Each file's choice is
// stored on it as entry.decision = 'keep' | 'reject'; nothing on disk changes.

import { $, show, familyDates, exportFormat, dayFormat, formatSize } from './dom.js';
import { makePreview } from './thumbs.js';

const SWIPE_DISTANCE = 120; // px a card must be dragged to count as a decision
const ROTATE_PER_PX = 1 / 20; // degrees of tilt per px dragged (6° at 120px)
const FLY_MS = 200; // a decided card flying off screen
const SNAP_MS = 200; // an undecided drag springing back to the centre

let families = []; // every family, to find the next one to sort
let family = null; // the entries being sorted
let index = 0; // which of them is on the card
let history = []; // undo steps: { family, index, changes: [{ entry, previous }] }
let busy = false; // true while a card flies off; input waits
let previewUrl = null; // full-size image on the card, freed when the card changes
let onExit = () => {};

const card = $('#swipe-card');

// Opens a family. history is kept across families until the user leaves,
// so Undo can step back into the family before.
export function openFamily(allFamilies, entries, exit) {
  families = allFamilies;
  onExit = exit;
  history = [];
  startFamily(entries);
  show('swipe');
}

// Starts at the first undecided file, or at the top if all are decided.
function startFamily(entries) {
  family = entries;
  const firstOpen = entries.findIndex((entry) => !entry.decision);
  index = firstOpen === -1 ? 0 : firstOpen;
  renderCard();
}

function decide(decision) {
  if (busy || !family[index]) return;
  const entry = family[index];
  history.push({ family, index, changes: [{ entry, previous: entry.decision }] });
  entry.decision = decision;
  flyOff(decision, () => {
    index += 1;
    advance();
  });
}

function decideAll(decision) {
  if (busy) return;
  history.push({ family, index, changes: family.map((entry) => ({ entry, previous: entry.decision })) });
  for (const entry of family) entry.decision = decision;
  index = family.length;
  advance();
}

function undo() {
  if (busy || !history.length) return;
  const step = history.pop();
  for (const { entry, previous } of step.changes) entry.decision = previous;
  family = step.family;
  index = step.index;
  renderCard();
}

// After a decision: the next file, else the next unfinished family, else back to the overview.
function advance() {
  if (index < family.length) return renderCard();
  const next = families.find((f) => f.some((entry) => !entry.decision));
  if (next) startFamily(next);
  else exit(true);
}

// finished: true when every file has been decided, false when the user left early.
function exit(finished = false) {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  history = [];
  onExit(finished);
}

function renderCard() {
  const entry = family[index];
  card.style.transition = 'none';
  card.style.transform = '';
  card.style.opacity = '';
  setHints(0);

  $('#swipe-where').textContent = `${familyDates(family)} · family ${families.indexOf(family) + 1} of ${families.length} · file ${index + 1} of ${family.length}`;

  $('#swipe-name').textContent = entry.name;
  const status = { keep: ' · kept', reject: ' · rejected' }[entry.decision] ?? '';
  const shot = entry.shot?.taken ? ` · shot ${dayFormat.format(entry.shot.taken)}` : '';
  $('#swipe-meta').textContent = `${exportFormat.format(entry.file.lastModified)}${shot} · ${formatSize(entry.file.size)} · ${entry.ext.toUpperCase()}${status}`;

  // The thumbnail shows at once; the full-size image replaces it once decoded.
  const img = $('#swipe-img');
  img.hidden = !entry.thumb;
  img.src = entry.thumb ?? '';
  $('#swipe-preview').dataset.empty = entry.thumb ? '' : 'No preview';
  loadPreview(entry);

  $('#undo').disabled = !history.length;
  $('#keep-all').textContent = `Keep all ${family.length}`;
  $('#reject-all').textContent = `Reject all ${family.length}`;
}

async function loadPreview(entry) {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  if (!entry.thumb) return;
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
  // The user may have moved on while this loaded.
  if (family[index] !== entry || previewUrl) return URL.revokeObjectURL(url);
  previewUrl = url;
  $('#swipe-img').src = url;
}

// The Keep / Reject labels fade in with drag distance: fully visible at SWIPE_DISTANCE.
function setHints(dx) {
  const strength = (value) => String(Math.min(1, Math.max(0, value / SWIPE_DISTANCE)));
  card.querySelector('[data-hint="keep"]').style.opacity = strength(dx);
  card.querySelector('[data-hint="reject"]').style.opacity = strength(-dx);
}

function flyOff(decision, done) {
  busy = true;
  const direction = decision === 'keep' ? 1 : -1;
  setHints(direction * SWIPE_DISTANCE);
  card.style.transition = `transform ${FLY_MS}ms ease-in, opacity ${FLY_MS}ms ease-in`;
  card.style.transform = `translateX(${direction * window.innerWidth * 0.6}px) rotate(${direction * 15}deg)`;
  card.style.opacity = '0';
  setTimeout(() => {
    busy = false;
    done();
  }, FLY_MS);
}

// Dragging: the card follows the pointer (mouse, trackpad or touch) and tilts.
let dragStart = null;
let dragX = 0;

card.addEventListener('pointerdown', (event) => {
  if (busy || event.button !== 0) return;
  dragStart = event.clientX;
  dragX = 0;
  card.setPointerCapture(event.pointerId);
  card.style.transition = 'none';
});

card.addEventListener('pointermove', (event) => {
  if (dragStart === null) return;
  dragX = event.clientX - dragStart;
  card.style.transform = `translateX(${dragX}px) rotate(${dragX * ROTATE_PER_PX}deg)`;
  setHints(dragX);
});

function endDrag() {
  if (dragStart === null) return;
  dragStart = null;
  if (Math.abs(dragX) >= SWIPE_DISTANCE) return decide(dragX > 0 ? 'keep' : 'reject');
  card.style.transition = `transform ${SNAP_MS}ms ease-out`;
  card.style.transform = '';
  setHints(0);
}

card.addEventListener('pointerup', endDrag);
card.addEventListener('pointercancel', endDrag);

$('#keep').addEventListener('click', () => decide('keep'));
$('#reject').addEventListener('click', () => decide('reject'));
$('#undo').addEventListener('click', undo);
$('#keep-all').addEventListener('click', () => decideAll('keep'));
$('#reject-all').addEventListener('click', () => decideAll('reject'));
$('#swipe-back').addEventListener('click', () => exit());

document.addEventListener('keydown', (event) => {
  if ($('#swipe').hidden || event.repeat) return;
  if (event.key === 'ArrowRight') decide('keep');
  else if (event.key === 'ArrowLeft') decide('reject');
  else if (event.key === 'Escape') exit();
  else if ((event.key === 'z' && (event.metaKey || event.ctrlKey)) || event.key === 'Backspace') undo();
  else return;
  event.preventDefault();
});
