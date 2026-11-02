import './style.css';
import { $, show, plural, familyDates, exportFormat, formatSize } from './dom.js';
import { isSupported, pickFolder, droppedFolder, readFolder } from './scan.js';
import { makeThumbnail } from './thumbs.js';
import { describe } from './describe.js';
import { groupFiles } from './group.js';
import { openFamily } from './compare.js';
import { showSummary } from './summary.js';
import { TRASH_FOLDER, requestWriteAccess, moveRejected } from './apply.js';

// Everything the app knows lives here.
const state = {
  dir: null, // the folder the user picked (a FileSystemDirectoryHandle)
  // For each design file: { handle, file, name, ext, thumb, width, height, vectors, words, shot, colour, card, decision }
  files: [],
  families: [], // [[entry, ...], ...], each oldest first, similar families side by side
};

// How many thumbnails are made at once. More doesn't finish sooner,
// it just holds more full-size images in memory at the same moment.
const THUMB_WORKERS = 4;

async function chooseFolder() {
  let dir;
  try {
    dir = await pickFolder();
  } catch (err) {
    if (err.name === 'AbortError') return; // the user closed the picker
    showFolderError(err);
    return;
  }
  await openFolder(dir);
}

function showFolderError(error) {
  const status = $('#start').hidden ? $('#file-count') : $('#start-status');
  status.hidden = false;
  status.textContent = error.message;
}

async function openFolder(dir) {
  $('#start-status').hidden = true;
  try {
    await loadFolder(dir);
  } catch (error) {
    showFolderError(error);
  }
}

// Anywhere on the intro accepts a folder; loaded runs cannot be replaced by a drop.
document.addEventListener('dragover', (event) => {
  if (!event.dataTransfer.types.includes('Files')) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = $('#start').hidden ? 'none' : 'copy';
});

document.addEventListener('drop', async (event) => {
  if (!event.dataTransfer.types.includes('Files')) return;
  event.preventDefault();
  if ($('#start').hidden) return;
  try {
    const dir = await droppedFolder(event.dataTransfer);
    // A picker may have opened a folder while the dropped handle resolved.
    if (!$('#start').hidden) await openFolder(dir);
  } catch (error) {
    if (!$('#start').hidden) showFolderError(error);
  }
});

// Reads the folder fresh, makes previews and groups them. Used for a newly
// picked folder and to rescan the same one after applying.
async function loadFolder(dir) {
  // Free the previous folder's thumbnails before replacing them.
  for (const entry of state.files) if (entry.thumb) URL.revokeObjectURL(entry.thumb);
  const files = await readFolder(dir);
  state.dir = dir;
  state.files = files;
  state.families = [];
  renderLoading();
  show('files');
  await makeThumbnails(files);
  if (files !== state.files) return; // another folder was picked meanwhile
  try {
    await describeImages(files);
  } catch (error) {
    console.error(error);
    $('#file-count').textContent = `Couldn’t load the image model, so files can’t be grouped: ${error.message}`;
    return;
  }
  if (files !== state.files) return;
  regroup();
}

// Fills in each card's thumbnail, a few files at a time.
async function makeThumbnails(files) {
  const queue = [...files];
  let done = 0;
  const work = async () => {
    // Stop early if the user has picked another folder meanwhile.
    while (queue.length && files === state.files) {
      const entry = queue.shift();
      Object.assign(entry, await makeThumbnail(entry));
      showThumb(entry);
      done += 1;
      setStatus(`previews ${done} of ${files.length}`);
    }
  };
  await Promise.all(Array.from({ length: THUMB_WORKERS }, work));
}

// Runs each file through the image model and reads its text (a PDF's, or an
// image's by OCR), one at a time: the model uses the whole GPU. The first time, the model itself downloads first.
async function describeImages(files) {
  let done = 0;
  for (const entry of files) {
    if (files !== state.files) return;
    Object.assign(entry, await describe(entry, (percent) => setStatus(`loading the image model ${percent}%`)));
    done += 1;
    setStatus(`looking at each file ${done} of ${files.length}`);
  }
}

// How alike two files must be to share a family. Balanced suits most folders;
// Strict suits product shoots, where different items share a pose and backdrop
// (two different jackets measured 0.87); Loose catches heavier re-crops.
const LEVELS = { loose: 0.75, balanced: 0.8, strict: 0.88 };
let level = 'balanced';

// Re-runs the grouping with the current setting. Decisions live on the files,
// so they survive regrouping.
function regroup() {
  state.families = groupFiles(state.files, { minSimilarity: LEVELS[level] });
  renderFamilies();
}

// The family the compare stream was last on, to pick up there when switching back.
let lastCompared = null;

// Reaching the end of the stream leads straight to the summary; switching
// back to Families, to the overview, showing the family the stream was on.
function compareFamily(family) {
  openFamily(state.families, family, (finished, current) => {
    lastCompared = current;
    if (finished) showSummary(state.files);
    else showOverview(current);
  });
}

// The only code that changes anything on disk. Runs from the Apply click,
// which Chrome requires before it will ask for write permission.
async function apply() {
  const rejected = state.files.filter((entry) => entry.decision === 'reject');
  const status = $('#apply-status');
  $('#apply').disabled = true;
  $('#summary-back').disabled = true;
  try {
    if (!(await requestWriteAccess(state.dir))) {
      status.textContent = 'Chrome wasn’t allowed to change this folder, so nothing moved.';
      return;
    }
    const result = await moveRejected(state.dir, rejected, (done) => {
      status.textContent = `Moving ${done} of ${rejected.length}…`;
    });
    showDone(result);
  } catch (error) {
    console.error(error);
    status.textContent = `Stopped: ${error.message} Anything already moved is in ${TRASH_FOLDER}.`;
  } finally {
    $('#apply').disabled = false;
    $('#summary-back').disabled = false;
  }
}

function showDone({ moved, failed }) {
  const kept = state.files.length - moved.length - failed.length;
  const bytes = moved.reduce((sum, { entry }) => sum + entry.file.size, 0);
  $('#done-space').hidden = !moved.length;
  $('#done-space').textContent = `${formatSize(bytes)} is now in ${TRASH_FOLDER}. Delete that folder in Finder to free it.`;
  $('#done-result').textContent =
    `Moved ${plural(moved.length, 'file')} into ${TRASH_FOLDER} inside “${state.dir.name}”. ` +
    `${plural(kept, 'other file')} ${kept === 1 ? 'wasn’t' : 'weren’t'} touched.`;
  const copied = moved.filter((m) => m.how === 'copy').length;
  $('#done-how').textContent = copied
    ? `${moved.length - copied} moved directly; ${copied} copied, checked, then the original removed (Chrome refused a direct move).`
    : 'Every file was moved directly: same file, same dates, nothing copied.';
  const renamed = moved.filter((m) => m.name !== m.entry.name);
  if (renamed.length) {
    $('#done-how').textContent += ` ${renamed.length} renamed to avoid a clash with files already in ${TRASH_FOLDER}.`;
  }
  $('#done-failed').hidden = !failed.length;
  $('#done-failed-head').textContent = `Couldn’t move ${plural(failed.length, 'file')}. They’re still in place.`;
  $('#done-failed-list').replaceChildren(
    ...failed.map(({ entry, error }) => {
      const li = document.createElement('li');
      li.textContent = `${entry.name}: ${error.message}`;
      return li;
    }),
  );
  show('done');
}

// The overview's element for each family, to scroll the right one into view.
const familyElements = new WeakMap();

function showOverview(focus) {
  renderFamilies();
  show('files');
  familyElements.get(focus)?.scrollIntoView({ block: 'center' });
}

function setStatus(progress) {
  $('#file-count').textContent = `${plural(state.files.length, 'design file')} · ${progress}`;
}

// While previews are made: one flat grid of cards, oldest first.
function renderLoading() {
  $('#folder-name').textContent = state.dir.name;
  $('#settings').hidden = true;
  $('#view-compare').disabled = true;
  $('#open-summary').hidden = true;
  setStatus('making previews');
  const grid = document.createElement('ul');
  grid.className = 'thumb-grid';
  grid.append(...state.files.map(renderCard));
  $('#families').replaceChildren(grid);
}

// Once every file is described: its families, similar ones side by side.
// The cards made during loading are moved into place, not rebuilt.
function renderFamilies() {
  const decided = state.files.filter((entry) => entry.decision).length;
  $('#file-count').textContent = [
    plural(state.files.length, 'design file'),
    plural(state.families.length, 'family', 'families'),
    `${decided} decided`,
  ].join(' · ');
  $('#settings').hidden = false;
  $('#view-compare').disabled = !nextFamily();
  $('#open-summary').hidden = !decided;
  $('#families').replaceChildren(...state.families.map(renderFamily));
}

function renderFamily(entries) {
  const family = document.createElement('div');
  family.className = 'family';
  family.innerHTML =
    '<div class="family-head"><div><p class="family-dates"></p><p class="muted"></p></div><button>Compare</button></div><ul class="card-row"></ul>';
  family.querySelector('.family-dates').textContent = familyDates(entries);
  familyElements.set(entries, family);
  const kept = entries.filter((entry) => entry.decision === 'keep').length;
  const rejected = entries.filter((entry) => entry.decision === 'reject').length;
  const bytes = entries.reduce((sum, entry) => sum + entry.file.size, 0);
  family.querySelector('.family-head .muted').textContent = [
    plural(entries.length, 'file'),
    formatSize(bytes),
    kept && `${kept} kept`,
    rejected && `${rejected} rejected`,
  ].filter(Boolean).join(' · ');
  family.querySelector('.family-head button').addEventListener('click', () => compareFamily(entries));
  for (const entry of entries) entry.card.dataset.decision = entry.decision ?? '';
  family.querySelector('.card-row').append(...entries.map((entry) => entry.card));
  return family;
}

function renderCard(entry) {
  const card = document.createElement('li');
  card.innerHTML = '<div class="thumb"></div><p class="card-name"></p><p class="card-time"></p>';
  card.querySelector('.card-name').textContent = entry.name;
  card.querySelector('.card-name').title = entry.name;
  card.querySelector('.card-time').textContent = exportFormat.format(entry.file.lastModified);
  entry.card = card;
  return card;
}

function showThumb(entry) {
  const box = entry.card.querySelector('.thumb');
  if (!entry.thumb) {
    box.textContent = 'No preview';
    return;
  }
  const img = document.createElement('img');
  img.src = entry.thumb;
  img.alt = '';
  box.replaceChildren(img);
}

$('#choose').addEventListener('click', chooseFolder);
$('#choose-again').addEventListener('click', chooseFolder);
// Where Compare picks up: the family it was last on if that still has versions
// to decide, otherwise the first family in the overview's order that does.
function nextFamily() {
  const open = (f) => f.some((entry) => !entry.decision);
  if (state.families.includes(lastCompared) && open(lastCompared)) return lastCompared;
  return state.families.find(open);
}

$('#view-compare').addEventListener('click', () => {
  const next = nextFamily();
  if (next) compareFamily(next);
});
$('#open-summary').addEventListener('click', () => showSummary(state.files));
$('#summary-back').addEventListener('click', showOverview);
$('#apply').addEventListener('click', apply);
$('#rescan').addEventListener('click', () => loadFolder(state.dir));
$('#done-choose').addEventListener('click', chooseFolder);
$('#settings').addEventListener('click', (event) => {
  const button = event.target.closest('[data-level]');
  if (!button || button.dataset.level === level) return;
  level = button.dataset.level;
  for (const option of $('#settings').querySelectorAll('[data-level]')) option.setAttribute('aria-pressed', option === button);
  regroup();
});
show(isSupported() ? 'start' : 'unsupported');
