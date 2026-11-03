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

import { $, show, familyDates, exportFormat, dayFormat, formatSize, cssTime } from './dom.js';
import { makePreview, renderAt } from './thumbs.js';
import { loopLine, loopOnHover } from './loop.js';
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
let onChange = () => {};

// Opens the stream at a family. history is kept until the user leaves, so
// Undo can step back across families and merges. change() is called after
// every choice (to save progress).
export function openFamily(allFamilies, entries, exit, change) {
  families = allFamilies;
  onExit = exit;
  onChange = change;
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
// out comes back undecided. While asking "same piece?", a next-family version
// swaps in to check a different one, and one of this family's goes back to
// comparing it against the final (the way to reopen a choice once Undo is gone).
function challengeWith(entry) {
  if (entry === slots.left || entry === slots.right) return;
  const reopen = boundary && family.includes(entry);
  if (boundary && !reopen && !boundary.includes(entry)) return;
  snapshot();
  if (entry.decision === 'reject') entry.decision = undefined;
  queue = queue.filter((waiting) => waiting !== entry);
  const side = slots.left && slots.right ? newcomer : slots.left ? 'right' : 'left';
  if (slots[side] && !boundary) queue.unshift(slots[side]);
  if (reopen) boundary = null; // the next family's version just leaves the screen
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
  for (const side of ['left', 'right']) {
    const other = slots[side === 'left' ? 'right' : 'left'];
    showFrame(side, slots[side]);
    renderInfo(side, slots[side], other);
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
  onChange();
}

// Under a frame: where the version sits in its family ("2/5") and its
// details. A detail that differs from the other side is dark, since that
// difference is often the answer. The shot date only shows when one side
// has one (design exports never do).
function renderInfo(side, entry, other) {
  $(`#info-${side}`).hidden = !entry;
  if (!entry) return;
  const group = boundary?.includes(entry) ? boundary : family;
  $(`#index-${side}`).textContent = `${group.indexOf(entry) + 1}/${group.length}`;
  const mine = details(entry);
  const theirs = other && details(other);
  const line = (key, text = mine[key][0]) => {
    if (key === 'name') return loopLine(text, 'name');
    return loopLine(text, theirs && mine[key][1] !== theirs[key][1] ? 'differs' : '');
  };
  const block = (...lines) => {
    const p = document.createElement('p');
    p.append(...lines);
    return p;
  };
  const shot = Boolean(entry.shot?.taken || other?.shot?.taken);
  $(`#details-${side}`).replaceChildren(
    block(line('name'), line('size')),
    block(line('ratio'), line('pixels')),
    block(line('label', 'Exported'), ...(shot ? [line('label', 'Shot')] : [])),
    block(line('exported'), ...(shot ? [line('shot')] : [])),
  );
}

// { key: [text shown, value compared with the other side] }
function details(entry) {
  const exported = entry.file.lastModified;
  const [ratioText, pixels] = shape(entry);
  return {
    name: [entry.name, entry.name],
    size: [formatSize(entry.file.size), entry.file.size],
    ratio: [ratioText, ratioText],
    pixels: [pixels, pixels],
    label: ['', ''],
    exported: [exportFormat.format(exported), dayFormat.format(exported)], // same day counts as same
    shot: entry.shot?.taken ? [shotFormat.format(entry.shot.taken), shotFormat.format(entry.shot.taken)] : ['No shot date', ''],
  };
}

// "Dec 5, 2039 at 3:23 PM"
const shotFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

// ["4:5", "1080 × 1350"], or for a PDF its page count.
function shape(entry) {
  if (entry.ext === 'pdf') return [`${entry.vectors?.length || 1} page${entry.vectors?.length > 1 ? 's' : ''}`, 'PDF'];
  if (!entry.width) return ['Size unknown', ''];
  return [ratio(entry.width, entry.height), `${entry.width} × ${entry.height}`];
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
  item.role = 'button';
  item.innerHTML = '<div class="version-thumb"></div><p class="version-date"></p>';
  if (entry.thumb) {
    const img = document.createElement('img');
    img.addEventListener('load', () => img.style.setProperty('--ratio', img.naturalWidth / img.naturalHeight));
    img.src = entry.thumb;
    img.alt = '';
    item.firstChild.prepend(img);
    blendsIn(entry).then((blends) => item.classList.toggle('blends', blends));
  }
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
  if (entry?.thumb) frame.dataset.cursor = 'zoom'; // the big + (cursor.js): click to see it full size
  else delete frame.dataset.cursor;
  frame.classList.remove('blends');
  if (!entry?.thumb) return;
  blendsIn(entry).then((blends) => {
    if (shown[side] === entry) frame.classList.toggle('blends', blends);
  });
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

// The image takes its own shape inside the frame (see .compare-frame img), so
// its edge line, when it needs one, sits on the picture.
for (const side of ['left', 'right']) {
  const img = $(`#frame-${side} img`);
  img.addEventListener('load', () => img.style.setProperty('--ratio', img.naturalWidth / img.naturalHeight));
}

// Whether a version's outer edge is close to the page's grey (#EEE), so it
// needs a line to show where it ends: at least half of the thumbnail's
// outer ring of pixels, at 32 × 32, within EDGE_NEAR of it on every channel
// (see-through counts as near: it shows the page). Worked out once a file.
const PAGE_GREY = 238;
const EDGE_NEAR = 20;
const EDGE_SHARE = 0.5;

async function blendsIn(entry) {
  if (entry.blends === undefined) {
    const bitmap = await createImageBitmap(await (await fetch(entry.thumb)).blob());
    const ctx = new OffscreenCanvas(32, 32).getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, 32, 32);
    bitmap.close();
    const pixels = ctx.getImageData(0, 0, 32, 32).data;
    let ring = 0;
    let near = 0;
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        if (x && y && x < 31 && y < 31) continue;
        const i = (y * 32 + x) * 4;
        ring += 1;
        if (pixels[i + 3] < 128 || [0, 1, 2].every((c) => Math.abs(pixels[i + c] - PAGE_GREY) <= EDGE_NEAR)) near += 1;
      }
    }
    entry.blends = near / ring >= EDGE_SHARE;
  }
  return entry.blends;
}

// Space shows the versions one at a time, filling the screen in the same
// place, like Quick Look in Finder: scrolling or the arrow keys step through
// them oldest to newest, so whatever changed between two versions jumps out.
// While asking "same piece?", the next family's versions follow on. Each
// version is drawn at screen size (the thumbnail until then) onto one canvas,
// so a step is a single draw. Space or Escape closes.
const FLICK_STEP = 40; // px of scrolling per version
const flickCanvas = $('#flick canvas');
let flick = null; // { entries, index, thumbs, pictures, scrolled }

// Opens on `start`: the clicked frame's version, or for Space the left one.
function openFlick(start = slots.left ?? slots.right) {
  const entries = boundary ? [...family, ...boundary] : family;
  document.activeElement?.blur(); // so Space can't also press a button
  fadeFlick(true);
  sizeFlick();
  flick = { entries, index: entries.indexOf(start), thumbs: [], pictures: [], scrolled: 0 };
  drawFlick();
  loadFlick(flick);
}

function closeFlick() {
  flick = null;
  fadeFlick(false);
}

// Opening and closing fade over --screen-fade, as changing screen does; a
// reversal mid-fade carries on from the opacity it had reached.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let flickFade = null;

function fadeFlick(open) {
  const overlay = $('#flick');
  const from = flickFade ? getComputedStyle(overlay).opacity : Number(!open);
  flickFade?.cancel();
  flickFade = null;
  overlay.hidden = false;
  if (reducedMotion.matches) {
    overlay.hidden = !open;
    return;
  }
  const fade = overlay.animate([{ opacity: from }, { opacity: Number(open) }], { duration: cssTime(overlay, '--screen-fade'), easing: 'ease' });
  flickFade = fade;
  fade.finished.then(() => {
    flickFade = null;
    if (!open) overlay.hidden = true;
  }).catch(() => {}); // cancelled by a reversal
}

function sizeFlick() {
  const box = flickCanvas.getBoundingClientRect();
  flickCanvas.width = Math.round(box.width * devicePixelRatio);
  flickCanvas.height = Math.round(box.height * devicePixelRatio);
}

// Thumbnails first (instant), then each version at screen size, nearest first.
async function loadFlick(current) {
  const { entries } = current;
  await Promise.all(entries.map(async (entry, i) => {
    if (!entry.thumb) return;
    const img = new Image();
    img.src = entry.thumb;
    await img.decode().catch(() => {});
    current.thumbs[i] = img;
    await blendsIn(entry);
  }));
  if (flick !== current) return;
  drawFlick();
  const nearest = entries.map((_, i) => i).sort((a, b) => Math.abs(a - current.index) - Math.abs(b - current.index));
  for (const i of nearest) {
    if (!entries[i].thumb) continue;
    const { width, height } = entries[i];
    const longest = Math.max(flickCanvas.width, flickCanvas.height);
    // Just big enough to fill the screen (never past the file's own size).
    const size = width ? Math.round(Math.min(1, flickCanvas.width / width, flickCanvas.height / height) * Math.max(width, height)) : longest;
    try {
      current.pictures[i] = await renderAt(entries[i], size);
    } catch {
      continue; // keep the thumbnail
    }
    if (flick !== current) return;
    if (i === current.index) drawFlick();
  }
}

// The version fits the screen, centred, so versions with the same framing line up.
function drawFlick() {
  const { entries, index } = flick;
  const entry = entries[index];
  const picture = flick.pictures[index] ?? flick.thumbs[index];
  const ctx = flickCanvas.getContext('2d');
  ctx.clearRect(0, 0, flickCanvas.width, flickCanvas.height);
  if (picture) {
    const width = picture.naturalWidth ?? picture.width;
    const height = picture.naturalHeight ?? picture.height;
    const scale = Math.min(flickCanvas.width / width, flickCanvas.height / height);
    const [x, y, w, h] = [(flickCanvas.width - width * scale) / 2, (flickCanvas.height - height * scale) / 2, width * scale, height * scale];
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(picture, x, y, w, h);
    if (entry.blends) {
      // The pale edge's line, as in the frames: 1px, inside the picture.
      const line = devicePixelRatio;
      ctx.strokeStyle = getComputedStyle(flickCanvas).getPropertyValue('--color-band-line');
      ctx.lineWidth = line;
      ctx.strokeRect(x + line / 2, y + line / 2, w - line, h - line);
    }
  }
  $('#flick-caption').textContent = [
    `${index + 1} of ${entries.length}`,
    entry.name,
    exportFormat.format(entry.file.lastModified),
    entry.decision === 'reject' && 'out',
    entry.thumb && !flick.pictures[index] && 'loading',
  ].filter(Boolean).join(' · ');
}

function stepFlick(direction) {
  const index = Math.max(0, Math.min(flick.entries.length - 1, flick.index + direction));
  if (index === flick.index) return;
  flick.index = index;
  drawFlick();
}

// Each FLICK_STEP of scrolling is one version, at most one per wheel event:
// a slow scroll steps slowly, a fast flick of the trackpad runs through them.
$('#flick').addEventListener('wheel', (event) => {
  event.preventDefault();
  flick.scrolled += event.deltaY;
  if (Math.abs(flick.scrolled) < FLICK_STEP) return;
  stepFlick(Math.sign(flick.scrolled));
  flick.scrolled = 0;
}, { passive: false });

window.addEventListener('resize', () => {
  if (!flick) return;
  sizeFlick();
  drawFlick();
});

// A click on a frame opens the full-size view on that version; a click there closes it.
// Hovering the details loops any that don't fit.
for (const side of ['left', 'right']) {
  loopOnHover($(`#info-${side}`));
  $(`#frame-${side}`).addEventListener('click', () => {
    if (slots[side]?.thumb) openFlick(slots[side]);
  });
}
$('#flick').addEventListener('click', closeFlick);

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
  if ($('#compare').hidden) return;
  const command = event.metaKey || event.ctrlKey;
  if (flick) {
    // Holding an arrow keeps stepping, so repeats count here.
    if (command) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') stepFlick(1);
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') stepFlick(-1);
    else if (event.key === ' ' || event.key === 'Escape') {
      if (!event.repeat) closeFlick();
    } else return;
    return event.preventDefault();
  }
  if (event.repeat) return;
  if (command && event.key !== 'z') return; // leave ⌘S, ⌘D and the like to the browser
  if (event.key === ' ') openFlick();
  else if (event.key === 'ArrowLeft') pick('left');
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
