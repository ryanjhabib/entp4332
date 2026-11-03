// Step 5: compare versions side by side to find the final, family by family
// in the overview's order (similar families next to each other).
//
// Inside a family, "winner stays on": two versions are on screen; pick the
// better one and it stays where it is, the other is out (rejected), and the
// next version takes its place. "Keep both" keeps the newcomer too (a 4:5 post
// and a 9:16 story) and brings in the next. "These are different" splits the
// newcomer off into a family of its own. When a family is done, the next one
// with a pair still to compare starts; once none has, the versions on their
// own come one at a time, to Keep or Delete; then the summary.
//
// Choices are stored on each file as entry.decision = 'keep' | 'reject';
// nothing on disk changes.

import { $, show, fade, exportFormat, dayFormat, formatSize } from './dom.js';
import { makePreview, renderAt } from './thumbs.js';
import { loopLine, loopOnHover } from './loop.js';

let families = []; // every family, in the overview's order (shared with it: splits change it)
let family = null; // the versions being compared, oldest first
const slots = { left: null, right: null }; // the version on each side, or null
let newcomer = 'right'; // the side most recently filled: "keep both" replaces it
let queue = []; // versions still to take a turn, next first
let history = []; // undo: a snapshot from before each choice
let onExit = () => {};
let onChange = () => {};
let revisit = null; // the family opened from Families, shown even if it's all decided

// Opens the stream at a family. history is kept until the user leaves, so
// Undo can step back across families and splits. change() is called after
// every choice (to save progress).
export function openFamily(allFamilies, entries, exit, change) {
  families = allFamilies;
  onExit = exit;
  onChange = change;
  history = [];
  revisit = entries;
  show('compare');
  startFamily(entries);
}

const contending = (entries) => entries.filter((entry) => entry.decision !== 'reject');

// Families are ordered by colour (group.js), so newest comes from the dates.
const newestFirst = (entries) => [...entries].sort((a, b) => b.file.lastModified - a.file.lastModified);

// The newest version starts on the left (most likely the final), the next
// newest on the right; the rest wait their turn, newest first. Versions
// already out stay out: click one in the versions grid to bring it back.
// A family opened with one version left shows it alone, for Keep or Delete.
// One opened from Families that's already sorted shows its final beside the
// newest version that's out, to change the choice.
function startFamily(entries) {
  family = entries;
  const contenders = newestFirst(contending(entries));
  if (entries === revisit && contenders.length < 2) {
    contenders.push(...newestFirst(entries.filter((entry) => entry.decision === 'reject')));
  }
  if (!contenders.length) contenders.push(newestFirst(entries)[0]);
  [slots.left, slots.right = null, ...queue] = contenders;
  newcomer = 'right';
  if (slots.right) render();
  else afterChoice();
}

// Before every choice. Any choice ends the revisit: from then on, finished
// families are skipped again.
function snapshot() {
  revisit = null;
  history.push({
    families: [...families],
    family,
    slots: { ...slots },
    newcomer,
    queue: [...queue],
    decisions: family.map((entry) => entry.decision),
  });
}

// The version on `side` wins: it stays, the other is out, the next comes in.
function pick(side) {
  const other = side === 'left' ? 'right' : 'left';
  if (!slots.left || !slots.right) return;
  snapshot();
  slots[side].decision = 'keep';
  slots[other].decision = 'reject';
  slots[other] = queue.shift() ?? null;
  newcomer = other;
  afterChoice();
}

function keepBoth() {
  if (!slots.left || !slots.right) return;
  snapshot();
  slots.left.decision = 'keep';
  slots.right.decision = 'keep';
  slots[newcomer] = queue.shift() ?? null;
  afterChoice();
}

// These are different: the newcomer leaves this family for one of its own,
// placed right after it, and the next version comes in.
function notTheSame() {
  if (!slots.left || !slots.right) return;
  snapshot();
  const entry = slots[newcomer];
  const rest = family.filter((member) => member !== entry);
  families.splice(families.indexOf(family), 1, rest, [entry]);
  family = rest;
  slots[newcomer] = queue.shift() ?? null;
  afterChoice();
}

// A version on its own: Keep or Delete (reject) it.
function decideAlone(decision) {
  snapshot();
  (slots.left ?? slots.right).decision = decision;
  afterChoice();
}

// Once one side is empty this family is done. Next: a family with a pair
// still to compare (two or more versions in, something undecided), from here
// in the overview's order, then from the top; once there are none, a version
// on its own that's undecided, the same way; then the summary. A version on
// its own waits for Keep / Delete first.
const toCompare = (f) => contending(f).length > 1 && contending(f).some((entry) => !entry.decision);
const toSort = (f) => contending(f).length === 1 && !contending(f)[0].decision;

function afterChoice() {
  if (slots.left && slots.right) return render();
  const lone = slots.left ?? slots.right;
  if (lone && (!lone.decision || family === revisit)) return render();
  const after = families.slice(families.indexOf(family) + 1);
  const next = after.find(toCompare) ?? families.find(toCompare) ?? after.find(toSort) ?? families.find(toSort);
  if (next) return startFamily(next);
  exit(true);
}

// Clicking a version in the grid brings it in as the newcomer; one that was
// out comes back undecided (the way to reopen a choice once Undo is gone).
function challengeWith(entry) {
  if (entry === slots.left || entry === slots.right) return;
  snapshot();
  if (entry.decision === 'reject') entry.decision = undefined;
  queue = queue.filter((waiting) => waiting !== entry);
  const side = slots.left && slots.right ? newcomer : slots.left ? 'right' : 'left';
  if (slots[side]) queue.unshift(slots[side]);
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
  render();
}

// finished: true when the stream has reached its end or Summary was pressed
// (both go to the summary), false when the user left for Families.
// The overview is told which family the stream was on, to show it there.
function exit(finished = false) {
  flick = null;
  solo = null;
  $('#compare').classList.remove('is-zoomed', 'is-solo');
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
  $('#pick-left').hidden = !pair;
  $('#pick-right').hidden = !pair;
  $('#keep-both').hidden = !pair;
  $('#not-the-same').hidden = !pair;
  $('#not-the-same').title = pair ? `Moves ${slots[newcomer].name} into a family of its own` : '';
  $('#compare-undo').disabled = !history.length;
  const lone = pair ? null : slots.left ?? slots.right;
  showSolo(lone && (!lone.decision || family === revisit) ? lone : null);
  renderVersions();
  onChange();
}

// Under a frame: where the version sits in its family ("2/5") and its
// details. The name and export date are always dark; any other detail that
// differs from the other side is too, since that difference is often the
// answer. The shot date only shows when one side
// has one (design exports never do).
function renderInfo(side, entry, other) {
  $(`#info-${side}`).hidden = !entry;
  if (!entry) return;
  $(`#index-${side}`).textContent = `${family.indexOf(entry) + 1}/${family.length}`;
  const mine = details(entry);
  const theirs = other && details(other);
  const line = (key, text = mine[key][0]) => {
    if (key === 'name' || key === 'exported') return loopLine(text, 'dark');
    return loopLine(text, theirs && mine[key][1] !== theirs[key][1] ? 'dark' : '');
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

// This family's versions.
function renderVersions() {
  $('#version-grid').replaceChildren(...family.map(versionItem));
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

export async function blendsIn(entry) {
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

// Zoomed (the Figma's frame 135): Space or a click on a frame shows one
// version large in place of the pair, with its details, like Quick Look in
// Finder: scrolling or the arrow keys step through the family (by colour, then
// oldest to newest) in the same place, so whatever changed between two versions jumps
// out. Each version is drawn at the frame's size (the thumbnail until then) onto
// one canvas, so a step is a single draw. A click on it, Space or Escape
// goes back; the change fades both ways like changing screen.
const FLICK_STEP = 40; // px of scrolling per version
const flickCanvas = $('#flick canvas');
let flick = null; // { entries, index, thumbs, pictures, scrolled }

// Opens on `start`: the clicked frame's version, or for Space the left one.
function openFlick(start = slots.left ?? slots.right) {
  const entries = family;
  document.activeElement?.blur(); // so Space can't also press a button
  const current = { entries, index: entries.indexOf(start), thumbs: [], pictures: [], scrolled: 0 };
  flick = current;
  const zoomed = fade(() => {
    $('#flick .zoom-frame').dataset.cursor = 'zoomed';
    $('#compare').classList.add('is-zoomed');
    sizeFlick();
    if (flick === current) drawFlick();
  });
  loadFlick(current, zoomed);
}

function closeFlick() {
  flick = null;
  fade(() => $('#compare').classList.remove('is-zoomed'));
}

// A version on its own (the Figma's frame 136): the zoomed layout with Keep
// and Delete, the picture zooming in its frame as on MSW's product pages
// (below); null leaves it. Coming and going fade like zooming.
let solo = null;
let soloUrl = null;

function showSolo(entry) {
  const compare = $('#compare');
  if (entry === solo) return;
  solo = entry;
  if (!entry) {
    fade(() => compare.classList.remove('is-solo'));
    return;
  }
  const picture = $('.solo-picture');
  const img = picture.querySelector('img');
  const shown = fade(() => {
    picture.classList.remove('is-zoomed', 'blends');
    picture.dataset.cursor = 'zoom';
    delete $('#flick .zoom-frame').dataset.cursor; // the − (back) is only for zoomed pairs
    img.src = entry.thumb ?? '';
    renderInfo('zoom', entry, null);
    $('#pick-zoom').hidden = true;
    $('#index-zoom').hidden = true; // a solo is always 1/1
    $('#keep-solo').hidden = false;
    $('#delete-solo').hidden = false;
    compare.classList.add('is-solo');
  });
  if (!entry.thumb) return;
  blendsIn(entry).then((blends) => {
    if (solo === entry) picture.classList.toggle('blends', blends);
  });
  // Sharp when zoomed: the original (or a large render), once decoded and
  // the fade has put the thumbnail in.
  makePreview(entry).then(async (url) => {
    const loader = new Image();
    loader.src = url;
    await loader.decode();
    await shown;
    if (solo !== entry) return URL.revokeObjectURL(url);
    if (soloUrl) URL.revokeObjectURL(soloUrl);
    soloUrl = url;
    img.src = url;
  }).catch(() => {}); // keep the thumbnail
}

// MSW's product photo zoom: a click zooms the picture 1.6x toward the
// pointer inside its frame, moving the mouse pans, and a click or leaving
// zooms back out (style.css, --photo-zoom). The cursor turns from + to −.
// With the frame the picture's own size, the zoom point is simply where the
// pointer is in it.
{
  const picture = $('.solo-picture');
  const img = picture.querySelector('img');
  img.addEventListener('load', () => picture.style.setProperty('--ratio', img.naturalWidth / img.naturalHeight));
  const follow = (event) => {
    const box = picture.getBoundingClientRect();
    picture.style.setProperty('--zoom-x', `${Math.min(Math.max(event.clientX - box.left, 0), box.width)}px`);
    picture.style.setProperty('--zoom-y', `${Math.min(Math.max(event.clientY - box.top, 0), box.height)}px`);
  };
  const zoom = (on) => {
    picture.classList.toggle('is-zoomed', on);
    picture.dataset.cursor = on ? 'zoomed' : 'zoom';
  };
  picture.addEventListener('pointermove', follow);
  picture.addEventListener('pointerleave', () => zoom(false));
  picture.addEventListener('click', (event) => {
    follow(event);
    zoom(!picture.classList.contains('is-zoomed'));
  });
}

function sizeFlick() {
  const box = flickCanvas.getBoundingClientRect();
  flickCanvas.width = Math.round(box.width * devicePixelRatio);
  flickCanvas.height = Math.round(box.height * devicePixelRatio);
}

// Thumbnails first (instant), then each version at screen size, nearest first.
// `zoomed` resolves once the canvas has its size.
async function loadFlick(current, zoomed) {
  const { entries } = current;
  await Promise.all(entries.map(async (entry, i) => {
    if (!entry.thumb) return;
    const img = new Image();
    img.src = entry.thumb;
    await img.decode().catch(() => {});
    current.thumbs[i] = img;
    await blendsIn(entry);
  }));
  await zoomed;
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

// The version fits the frame at its top left, as in compare, so versions with
// the same framing line up. Its details follow it.
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
    const [x, y, w, h] = [0, 0, width * scale, height * scale];
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
  renderInfo('zoom', entry, null);
  $('#pick-zoom').hidden = !(slots.left && slots.right);
  $('#index-zoom').hidden = false;
  $('#keep-solo').hidden = true;
  $('#delete-solo').hidden = true;
}

// The arrow keys loop (after the last comes the first again); scrolling
// stops at either end, so a trackpad's momentum doesn't spin round.
function stepFlick(direction, loop = false) {
  const count = flick.entries.length;
  const index = loop ? (flick.index + direction + count) % count : Math.max(0, Math.min(count - 1, flick.index + direction));
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
$('#flick .zoom-frame').addEventListener('click', () => {
  if (flick) closeFlick();
});
loopOnHover($('#info-zoom'));

// Pick while zoomed: a version on screen wins, as Pick under its frame does;
// one flicked to comes onto the screen to be compared.
$('#pick-zoom').addEventListener('click', () => {
  const entry = flick.entries[flick.index];
  const side = entry === slots.left ? 'left' : entry === slots.right ? 'right' : null;
  closeFlick();
  if (side) pick(side);
  else challengeWith(entry);
});

$('#pick-left').addEventListener('click', () => pick('left'));
$('#pick-right').addEventListener('click', () => pick('right'));
$('#keep-both').addEventListener('click', keepBoth);
$('#not-the-same').addEventListener('click', notTheSame);
$('#keep-solo').addEventListener('click', () => decideAlone('keep'));
$('#delete-solo').addEventListener('click', () => decideAlone('reject'));
$('#compare-undo').addEventListener('click', undo);
$('#view-families').addEventListener('click', () => exit());
$('#compare-summary').addEventListener('click', () => exit(true));

document.addEventListener('keydown', (event) => {
  if ($('#compare').hidden) return;
  const command = event.metaKey || event.ctrlKey;
  if (flick) {
    // Holding an arrow keeps stepping, so repeats count here.
    if (command) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') stepFlick(1, true);
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') stepFlick(-1, true);
    else if (event.key === ' ' || event.key === 'Escape') {
      if (!event.repeat) closeFlick();
    } else return;
    return event.preventDefault();
  }
  if (event.repeat) return;
  if (command && event.key !== 'z') return; // leave ⌘S, ⌘D and the like to the browser
  // No key decides which version wins: arrows read as moving around (they do
  // step through versions when zoomed), and picking by them by accident
  // rejected files. Picking is the Pick links' job.
  if (event.key === ' ') {
    if (!solo) openFlick();
  } else if (event.key === 'n') notTheSame();
  else if (event.key === 'Escape') exit();
  else if ((event.key === 'z' && command) || event.key === 'Backspace') undo();
  else return;
  event.preventDefault();
});
