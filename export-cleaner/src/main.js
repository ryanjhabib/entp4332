import './style.css';
import { $, show, plural, sessionLabel, timeFormat } from './dom.js';
import { isSupported, pickFolder, readFolder } from './scan.js';
import { makeThumbnail } from './thumbs.js';
import { groupFiles } from './group.js';
import { openFamily } from './swipe.js';
import { showSummary } from './summary.js';

// Everything the app knows lives here.
const state = {
  dir: null, // the folder the user picked (a FileSystemDirectoryHandle)
  // For each design file: { handle, file, name, ext, thumb, hash, card, decision }
  files: [],
  sessions: [], // [{ files, families: [[entry, ...], ...] }], oldest first
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
    throw err;
  }
  // Free the previous folder's thumbnails before replacing them.
  for (const entry of state.files) if (entry.thumb) URL.revokeObjectURL(entry.thumb);
  const files = await readFolder(dir);
  state.dir = dir;
  state.files = files;
  state.sessions = [];
  renderLoading();
  show('files');
  await makeThumbnails(files);
  if (files !== state.files) return; // another folder was picked meanwhile
  regroup();
}

// Fills in each card's thumbnail and hash, a few files at a time.
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
      renderCount(done);
    }
  };
  await Promise.all(Array.from({ length: THUMB_WORKERS }, work));
}

// Re-runs the grouping with the current settings. Cheap, so it runs on every
// change. Decisions live on the files, so they survive regrouping.
function regroup() {
  state.sessions = groupFiles(state.files, {
    gapMinutes: Number($('#gap').value) || 20,
    maxDistance: Number($('#max-distance').value) || 0,
  });
  renderSessions();
}

// Sorting every file leads straight to the summary; leaving early, to the overview.
function sortFamily(family) {
  openFamily(state.sessions, family, (finished) => (finished ? showSummary(state.files) : showOverview()));
}

function showOverview() {
  renderSessions();
  show('files');
}

function renderCount(thumbsDone) {
  const n = state.files.length;
  $('#file-count').textContent = `${plural(n, 'design file')} · previews ${thumbsDone} of ${n}`;
}

// While previews are made: one flat grid of cards, oldest first.
function renderLoading() {
  $('#folder-name').textContent = state.dir.name;
  $('#settings').hidden = true;
  $('#start-sorting').hidden = true;
  $('#open-summary').hidden = true;
  renderCount(0);
  const grid = document.createElement('ul');
  grid.className = 'thumb-grid';
  grid.append(...state.files.map(renderCard));
  $('#sessions').replaceChildren(grid);
}

// Once every file has a hash: sessions, each holding its families.
// The cards made during loading are moved into place, not rebuilt.
function renderSessions() {
  const families = state.sessions.reduce((sum, s) => sum + s.families.length, 0);
  const decided = state.files.filter((entry) => entry.decision).length;
  $('#file-count').textContent = [
    plural(state.files.length, 'design file'),
    plural(state.sessions.length, 'session'),
    plural(families, 'family', 'families'),
    `${decided} decided`,
  ].join(' · ');
  $('#settings').hidden = false;
  $('#start-sorting').hidden = decided === state.files.length;
  $('#start-sorting').textContent = decided ? 'Continue sorting' : 'Start sorting';
  $('#open-summary').hidden = !decided;
  $('#sessions').replaceChildren(...state.sessions.map(renderSession));
}

function renderSession(session) {
  const { files, families } = session;
  const section = document.createElement('section');
  section.className = 'session';
  section.innerHTML = '<h2 class="session-head"><span></span> <span class="muted"></span></h2><div class="families"></div>';
  const [when, counts] = section.querySelectorAll('.session-head span');
  when.textContent = sessionLabel(session);
  counts.textContent = `${plural(files.length, 'file')} · ${plural(families.length, 'family', 'families')}`;
  section.querySelector('.families').append(...families.map(renderFamily));
  return section;
}

function renderFamily(entries) {
  const family = document.createElement('div');
  family.className = 'family';
  family.innerHTML = '<div class="family-head"><p class="muted"></p><button>Sort</button></div><ul class="card-row"></ul>';
  const kept = entries.filter((entry) => entry.decision === 'keep').length;
  const rejected = entries.filter((entry) => entry.decision === 'reject').length;
  family.querySelector('.family-head p').textContent = [
    plural(entries.length, 'file'),
    kept && `${kept} kept`,
    rejected && `${rejected} rejected`,
  ].filter(Boolean).join(' · ');
  family.querySelector('.family-head button').addEventListener('click', () => sortFamily(entries));
  for (const entry of entries) entry.card.dataset.decision = entry.decision ?? '';
  family.querySelector('.card-row').append(...entries.map((entry) => entry.card));
  return family;
}

function renderCard(entry) {
  const card = document.createElement('li');
  card.innerHTML = '<div class="thumb"></div><p class="card-name"></p><p class="card-time"></p>';
  card.querySelector('.card-name').textContent = entry.name;
  card.querySelector('.card-name').title = entry.name;
  card.querySelector('.card-time').textContent = timeFormat.format(entry.file.lastModified);
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
$('#start-sorting').addEventListener('click', () => {
  const next = state.sessions.flatMap((s) => s.families).find((f) => f.some((entry) => !entry.decision));
  if (next) sortFamily(next);
});
$('#open-summary').addEventListener('click', () => showSummary(state.files));
$('#summary-back').addEventListener('click', showOverview);
$('#settings').addEventListener('input', regroup);
$('#settings').addEventListener('submit', (event) => event.preventDefault());
show(isSupported() ? 'start' : 'unsupported');
