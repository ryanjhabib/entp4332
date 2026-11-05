import './style.css';
import { $, show, plural, familyDates, exportFormat, formatSize } from './dom.js';
import { isSupported, pickFolder, droppedFolder, readFolder } from './scan.js';
import { makeThumbnail } from './thumbs.js';
import { describe, readColour } from './describe.js';
import { groupFiles, orderByColour } from './group.js';
import { openFamily, blendsIn } from './compare.js';
import { showSummary } from './summary.js';
import { TRASH_FOLDER, requestWriteAccess, moveRejected } from './apply.js';
import { prepareModel } from './embed.js';
import { MEDIA_TYPES, setUpMediaField } from './media.js';
import { getFolder, folderRecord, saveFolder, savedFiles, saveFile, pruneFiles, forgetFolder, forgetStale, claimFolder } from './store.js';
import { setUpCursor } from './cursor.js';
import './waitlist.js';
import { loopLine, loopOnHover } from './loop.js';
import { startLoading, updateLoading, startScan, scannedFile, finishLoading, failLoading } from './loading.js';

// Everything the app knows lives here.
const state = {
  dir: null, // the folder the user picked (a FileSystemDirectoryHandle)
  // For each design file: { handle, file, name, ext, thumb, width, height, vectors, words, shot, colour, tone, card, decision }
  files: [],
  families: [], // [[entry, ...], ...], each oldest first, similar families side by side
  mediaType: null, // the chosen MEDIA_TYPES entry; sets the grouping level
  description: '', // what was typed to find it
  record: null, // this folder's saved progress (see store.js)
};

// Which folder this tab has open, so a refresh can pick it up again. Per tab:
// each tab can have a different folder open.
const TAB_KEY = 'syca-folder';

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
  if (!$('#loading').hidden) {
    failLoading(error.message);
    return;
  }
  const status = $('#start').hidden ? $('#file-count') : $('#start-status');
  status.hidden = false;
  status.textContent = error.message;
}

async function openFolder(dir) {
  $('#start-status').hidden = true;
  try {
    await loadFolder(dir);
  } catch (error) {
    // Shown on the loading screen, or in the start screen's estimate line.
    scanning = false;
    failLoading(error.message);
  }
}

// The scan starts as soon as a folder is picked. Until a media type is
// chosen it runs on the start screen, with the rule as its progress bar;
// choosing one moves to the loading screen, or straight to the families if
// the scan has already finished.
let scanning = false;
let typeChosen = null; // resolves a finished scan's wait for a type

setUpMediaField($('#describe-input'), $('#describe-list'), (type, text) => {
  state.mediaType = type;
  state.description = text;
  setLevel(type.level);
  saveProgress();
  if (typeChosen) typeChosen();
  else if (scanning) show('loading');
});

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

// Reads the folder, makes previews and groups them. Used for a newly picked
// folder, to rescan the same one after applying, and to resume after a
// refresh. Files scanned before (same name, size and date) reuse what was
// saved, so only new or changed files are scanned; if none are, the saved
// families come back as they were, merges and splits included.
async function loadFolder(dir) {
  startLoading();
  const record = await folderRecord(dir);
  const free = await claimFolder(record.id);
  if (free && !state.mediaType && record.typeId) restoreType(record);
  show(state.mediaType ? 'loading' : 'start');
  scanning = true;
  typeChosen = null;
  $('#start-folder-name').textContent = dir.name;
  $('#start-folder').hidden = false;
  if (!free) throw new Error(`“${dir.name}” is already open in another Export Cleaner tab.`);
  sessionStorage.setItem(TAB_KEY, record.id);
  // Free the previous folder's thumbnails before replacing them.
  for (const entry of state.files) if (entry.thumb) URL.revokeObjectURL(entry.thumb);
  const files = await readFolder(dir);
  const bytes = files.reduce((sum, entry) => sum + entry.file.size, 0);
  $('#start-folder-name').textContent = `${dir.name} (${formatSize(bytes, 0).toLowerCase()})`;
  const saved = await savedFiles(record.id);
  const todo = files.filter((entry) => {
    const row = saved.get(entry.name);
    if (row?.size !== entry.file.size || row.lastModified !== entry.file.lastModified) return true;
    const { thumb, width, height, vectors, words, shot, colour, tone } = row;
    Object.assign(entry, { thumb: thumb && URL.createObjectURL(thumb), width, height, vectors, words, shot, colour, tone });
    entry.decision = record.decisions[entry.name];
    return false;
  });
  // Files saved before tones were read get theirs from the thumbnail.
  await Promise.all(files.filter((entry) => entry.thumb && !entry.tone && !todo.includes(entry))
    .map(async (entry) => { entry.tone = (await readColour(entry.thumb)).tone; }));
  state.dir = dir;
  state.record = record;
  state.files = files;
  state.families = [];
  $('#families').replaceChildren();
  await makeThumbnails(files, todo);
  if (files !== state.files) return; // another folder was picked meanwhile
  await describeImages(files, todo);
  if (files !== state.files) return;
  pruneFiles(record.id, new Set(files.map((entry) => entry.name))).catch((error) => console.warn('Couldn’t tidy saved files:', error));
  updateLoading(98, 'Gathering your versions');
  for (const entry of files) { renderCard(entry); showThumb(entry); }
  // Let the final scan update paint before synchronous grouping begins.
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  if (files !== state.files) return;
  if (!state.mediaType) {
    // Grouping follows the type's level, so a finished scan waits for one, bar full.
    await finishLoading();
    scanning = false;
    await new Promise((resolve) => { typeChosen = resolve; });
    typeChosen = null;
    if (files !== state.files) return;
  }
  const families = !todo.length && level === record.level && savedFamilies(record, files);
  if (families) {
    state.families = families;
    renderFamilies();
    saveProgress();
  } else regroup();
  await finishLoading();
  scanning = false;
  if (files === state.files) show('files');
}

// The saved families, when every file is still in one of them.
function savedFamilies(record, files) {
  const byName = new Map(files.map((entry) => [entry.name, entry]));
  const families = record.families.map((names) => names.map((name) => byName.get(name)));
  const placed = families.flat();
  return placed.length === files.length && placed.every(Boolean) ? families.map(orderByColour) : null;
}

// The media type and grouping level the folder was last seen with.
function restoreType(record) {
  const type = MEDIA_TYPES.find((option) => option.id === record.typeId);
  if (!type) return;
  state.mediaType = type;
  state.description = record.description ?? '';
  $('#describe-input').value = type.label;
  setLevel(record.level ?? type.level);
}

// Saves the type, level, families and choices: after the scan and every
// choice, so a refresh loses nothing.
function saveProgress() {
  const { record } = state;
  if (!record) return;
  Object.assign(record, {
    typeId: state.mediaType?.id,
    description: state.description,
    level,
    families: state.families.map((family) => family.map((entry) => entry.name)),
    decisions: Object.fromEntries(state.files.filter((entry) => entry.decision).map((entry) => [entry.name, entry.decision])),
  });
  saveFolder(record).catch((error) => console.warn('Couldn’t save progress:', error));
}

// Fills in the thumbnails of files not seen before, a few at a time.
async function makeThumbnails(files, todo) {
  updateLoading(0, 'Getting the full picture');
  const queue = [...todo];
  let done = 0;
  const work = async () => {
    // Stop early if the user has picked another folder meanwhile.
    while (queue.length && files === state.files) {
      const entry = queue.shift();
      Object.assign(entry, await makeThumbnail(entry));
      done += 1;
      updateLoading(10 * done / Math.max(1, todo.length));
    }
  };
  await Promise.all(Array.from({ length: THUMB_WORKERS }, work));
}

// Runs each new file through the image model and reads its text (a PDF's, or an
// image's by OCR), one at a time: the model uses the whole GPU. The first time, the model itself downloads first.
// Each file is saved as soon as it's done, so a refresh mid-scan keeps the work.
async function describeImages(files, todo) {
  if (todo.some(entry => entry.thumb)) {
    updateLoading(10, 'Getting ready to scan');
    await prepareModel(percent => updateLoading(10 + percent * 0.05));
  }
  startScan();
  let done = 0;
  for (const entry of todo) {
    if (files !== state.files) return;
    Object.assign(entry, await describe(entry, () => {}));
    await saveFile(state.record.id, entry).catch((error) => console.warn(`Couldn’t save ${entry.name}:`, error));
    done += 1;
    scannedFile(done, todo.length);
  }
}

// How alike two files must be to share a family. Balanced suits most folders;
// Strict suits product shoots, where different items share a pose and backdrop
// (two different jackets measured 0.87); Loose catches heavier re-crops.
// Each media type starts the folder at one of these (see media.js).
const LEVELS = { loose: 0.75, balanced: 0.8, strict: 0.88 };
let level = 'balanced';

function setLevel(name) {
  level = name;
  for (const option of $('#settings').querySelectorAll('[data-level]')) option.setAttribute('aria-pressed', option.dataset.level === name);
}

// Re-runs the grouping with the current setting. Decisions live on the files,
// so they survive regrouping.
function regroup() {
  state.families = groupFiles(state.files, { minSimilarity: LEVELS[level] });
  renderFamilies();
  saveProgress();
}

// The family the compare stream was last on, to pick up there when switching back.
let lastCompared = null;

// Reaching the end of the stream leads straight to the summary; switching
// back to Families, to the overview, showing the family the stream was on.
function compareFamily(family) {
  openFamily(state.families, family, (finished, current) => {
    lastCompared = current;
    saveProgress();
    if (finished) openSummary();
    else showOverview(current);
  }, saveProgress);
}

// The only code that changes anything on disk. Runs from the Apply click,
// which Chrome requires before it will ask for write permission.
async function apply() {
  const rejected = state.files.filter((entry) => entry.decision === 'reject');
  const status = $('#apply-status');
  $('#apply').disabled = true;
  $('#summary-back').disabled = true;
  $('#summary').inert = true; // nothing on this screen can change while files move
  try {
    if (!(await requestWriteAccess(state.dir))) {
      status.textContent = 'Chrome wasn’t allowed to change this folder, so nothing moved.';
      return;
    }
    const result = await moveRejected(state.dir, rejected, (done) => {
      status.textContent = `Moving ${done} of ${rejected.length}…`;
    });
    // A moved file's choice is used up: dragged back out of the folder, it
    // comes back undecided, not set to be moved again.
    for (const { entry } of result.moved) entry.decision = undefined;
    saveProgress();
    showDone(result);
  } catch (error) {
    console.error(error);
    status.textContent = `Stopped: ${error.message} Anything already moved is in ${TRASH_FOLDER}.`;
  } finally {
    $('#apply').disabled = false;
    $('#summary-back').disabled = false;
    $('#summary').inert = false;
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
  $('#done-how').hidden = !moved.length;
  $('#done-how').textContent = copied
    ? `${moved.length - copied} moved directly; ${copied} copied, checked, then the original removed (Chrome refused a direct move).`
    : 'Every file was moved directly: same file, same dates, nothing copied.';
  const renamed = moved.filter((m) => m.name !== m.entry.name);
  if (renamed.length) {
    $('#done-how').textContent += ` ${renamed.length} renamed to avoid a clash with files already in ${TRASH_FOLDER}.`;
  }
  $('#done-failed').hidden = !failed.length;
  // Each says where the file is now; Chrome's own error is in the console.
  $('#done-failed-head').textContent = `Couldn’t move ${plural(failed.length, 'file')}.`;
  $('#done-failed-list').replaceChildren(
    ...failed.map(({ entry, gone }) => {
      const li = document.createElement('li');
      li.textContent = `${entry.name}: ${gone ? 'no longer in this folder' : 'still in place'}`;
      return li;
    }),
  );
  show('done');
}

// The overview's element for each family, to scroll the right one into view.
const familyElements = new WeakMap();

function showOverview(focus) {
  renderFamilies();
  show('files').then(() => familyElements.get(focus)?.scrollIntoView({ block: 'center' }));
}

// Once every file is described: its families, similar ones side by side.
// The cards made during loading are moved into place, not rebuilt.
// Sets (families of two or more, to compare) come first, then solos (files on
// their own, to keep or delete), each in the grouping's order; Show picks
// all, or one kind.
let showing = 'all';
const setsThenSolos = () => [...state.families.filter((f) => f.length > 1), ...state.families.filter((f) => f.length === 1)];

// The grid's column count, from style.css (--families-columns, by window width).
const gridColumns = () => parseInt(getComputedStyle(document.documentElement).getPropertyValue('--families-columns'), 10);

function renderFamilies() {
  $('#folder-name').textContent = state.dir.name;
  const decided = state.files.filter((entry) => entry.decision).length;
  const sets = state.families.filter((f) => f.length > 1).length;
  $('#file-count').textContent = [
    plural(state.files.length, 'design file'),
    plural(sets, 'set'),
    plural(state.families.length - sets, 'solo'),
    `${decided} decided`,
  ].join(' · ');
  $('#settings').hidden = false;
  $('#view-compare').disabled = !nextFamily();
  $('#open-summary').hidden = !decided;
  const shown = setsThenSolos().filter((f) => showing === 'all' || (showing === 'sets') === (f.length > 1));
  const columns = gridColumns();
  $('#families').replaceChildren(...shown.map((entries) => renderFamily(entries, columns)));
}

// A set's cell spans a column per version (wrapping past the grid's width),
// so a change of column count re-lays the grid.
for (const query of ['(max-width: 1399px)', '(max-width: 999px)', '(max-width: 699px)']) {
  matchMedia(query).addEventListener('change', () => {
    if (!$('#files').hidden) renderFamilies();
  });
}

// One cell per family: a set spans a column per version (its versions side
// by side, no lines between them), a solo takes one. Clicking it sorts it.
function renderFamily(entries, columns) {
  const family = document.createElement('div');
  family.className = 'family';
  const span = Math.min(entries.length, columns);
  family.style.gridColumn = `span ${span}`;
  family.style.setProperty('--slots', span);
  family.role = 'button';
  family.tabIndex = 0;
  family.title = entries.length > 1 ? 'Sort this set' : 'Keep or delete';
  family.innerHTML = '<p class="family-head"><span class="family-dates"></span><span class="family-counts"></span></p><ul class="card-row"></ul>';
  family.querySelector('.family-dates').textContent = familyDates(entries);
  familyElements.set(entries, family);
  const kept = entries.filter((entry) => entry.decision === 'keep').length;
  const rejected = entries.filter((entry) => entry.decision === 'reject').length;
  const bytes = entries.reduce((sum, entry) => sum + entry.file.size, 0);
  family.querySelector('.family-counts').textContent = [
    '',
    entries.length > 1 ? plural(entries.length, 'version') : 'solo',
    formatSize(bytes),
    kept && `${kept} kept`,
    rejected && `${rejected} out`,
  ].filter((part) => part !== 0).join(' · ');
  family.addEventListener('click', () => compareFamily(entries));
  family.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') compareFamily(entries);
  });
  for (const entry of entries) entry.card.dataset.decision = entry.decision ?? '';
  family.querySelector('.card-row').append(...entries.map((entry) => entry.card));
  return family;
}

function renderCard(entry) {
  const card = document.createElement('li');
  card.innerHTML = '<div class="thumb"></div><p class="card-name"></p><p class="card-time"></p>';
  card.querySelector('.card-name').replaceWith(loopLine(entry.name, 'card-name'));
  loopOnHover(card);
  card.querySelector('.card-time').textContent = exportFormat.format(entry.file.lastModified);
  entry.card = card;
  return card;
}

// The thumbnail in a 3:2 box at its top left, sized to its own shape; a
// pale one gets the edge line, as in Sort.
function showThumb(entry) {
  const box = entry.card.querySelector('.thumb');
  if (!entry.thumb) {
    box.textContent = 'No preview';
    return;
  }
  const img = document.createElement('img');
  img.addEventListener('load', () => img.style.setProperty('--ratio', img.naturalWidth / img.naturalHeight));
  img.src = entry.thumb;
  img.alt = '';
  box.replaceChildren(img);
  blendsIn(entry).then((blends) => box.classList.toggle('blends', blends));
}

$('#choose').addEventListener('click', chooseFolder);
$('#choose-again').addEventListener('click', goHome);
$('#loading-retry').addEventListener('click', chooseFolder);
// Where Compare picks up: the family it was last on if that still has versions
// to decide, otherwise the first family in the overview's order that does.
function nextFamily() {
  const open = (f) => f.some((entry) => !entry.decision);
  if (state.families.includes(lastCompared) && open(lastCompared)) return lastCompared;
  return setsThenSolos().find(open);
}

// Families' Sort and Summary's. Each screen turns its own Sort off when
// there's nothing to sort, so Summary's can't go through Families' button,
// which may still be off from before a choice was undone.
function sortNext() {
  const next = nextFamily();
  if (next) compareFamily(next);
}

$('#view-compare').addEventListener('click', sortNext);
// Summary's Sort is off when there's nothing left to sort, as Families' is;
// undoing a choice there can turn it back on.
function openSummary() {
  const sortable = () => ($('#summary-sort').disabled = !nextFamily());
  sortable();
  showSummary(state.files, () => {
    saveProgress();
    sortable();
  });
}

$('#open-summary').addEventListener('click', openSummary);
$('#view-summary').addEventListener('click', openSummary);
$('#summary-back').addEventListener('click', () => showOverview());
$('#summary-families').addEventListener('click', () => showOverview());
$('#summary-sort').addEventListener('click', sortNext);
$('#apply').addEventListener('click', apply);
$('#rescan').addEventListener('click', () => openFolder(state.dir));
// Back to the start screen, fresh. This folder's progress stays saved, so
// opening it again picks up where it left off.
function goHome() {
  sessionStorage.removeItem(TAB_KEY);
  location.reload();
}
// Drops this folder's saved scan and choices, then starts over (files untouched).
// That can be hours of work, so the first click only asks. Clicking anywhere
// else takes the question back; a double-click doesn't answer it.
const forget = $('#forget');
const forgetLabel = forget.textContent;
forget.addEventListener('click', async (event) => {
  if (event.detail > 1) return;
  if (forget.textContent === forgetLabel) {
    forget.textContent = 'Click again to forget';
    return;
  }
  await forgetFolder(state.record.id);
  goHome();
});
forget.addEventListener('blur', () => { forget.textContent = forgetLabel; });
$('#done-choose').addEventListener('click', goHome);
$('#settings').addEventListener('click', (event) => {
  const show = event.target.closest('[data-show]');
  if (show) {
    showing = show.dataset.show;
    for (const option of $('#settings').querySelectorAll('[data-show]')) option.setAttribute('aria-pressed', option === show);
    renderFamilies();
    return;
  }
  const button = event.target.closest('[data-level]');
  if (!button || button.dataset.level === level) return;
  setLevel(button.dataset.level);
  regroup();
});
// After a refresh, the folder this tab had open comes back. Chrome still
// allows reading it while it has a tab open on the site; once Chrome has
// been closed it asks again, which needs a click.
async function resume() {
  await forgetStale();
  const id = sessionStorage.getItem(TAB_KEY);
  const record = id && (await getFolder(id));
  if (!record) return;
  if ((await record.handle.queryPermission({ mode: 'read' })) === 'granted') return openFolder(record.handle);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'start-resume';
  button.textContent = `Resume ${record.name}`;
  button.addEventListener('click', async () => {
    if ((await record.handle.requestPermission({ mode: 'read' })) === 'granted') openFolder(record.handle);
  });
  $('#start-estimate').textContent = 'Saved in this tab';
  $('#start-folder-name').replaceChildren(button);
  $('#start-folder').hidden = false;
}

setUpCursor();
show(isSupported() ? 'start' : 'unsupported');
if (isSupported()) resume().catch((error) => console.warn('Couldn’t resume:', error));
