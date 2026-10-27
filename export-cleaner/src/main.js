import './style.css';
import { isSupported, pickFolder, readFolder } from './scan.js';
import { makeThumbnail } from './thumbs.js';
import { groupFiles } from './group.js';

const $ = (selector) => document.querySelector(selector);

// Everything the app knows lives here.
const state = {
  dir: null, // the folder the user picked (a FileSystemDirectoryHandle)
  files: [], // { handle, file, name, ext, thumb, hash, card } for each design file in it
  sessions: [], // [{ files, families: [[entry, ...], ...] }], oldest first
};

// How many thumbnails are made at once. More doesn't finish sooner,
// it just holds more full-size images in memory at the same moment.
const THUMB_WORKERS = 4;

// Shows one screen and hides the rest.
function show(id) {
  for (const screen of document.querySelectorAll('.screen')) screen.hidden = screen.id !== id;
}

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

// Re-runs the grouping with the current settings. Cheap, so it runs on every change.
function regroup() {
  state.sessions = groupFiles(state.files, {
    gapMinutes: Number($('#gap').value) || 20,
    maxDistance: Number($('#max-distance').value) || 0,
  });
  renderSessions();
}

function renderCount(thumbsDone) {
  const n = state.files.length;
  $('#file-count').textContent = `${plural(n, 'design file')} · previews ${thumbsDone} of ${n}`;
}

// While previews are made: one flat grid of cards, oldest first.
function renderLoading() {
  $('#folder-name').textContent = state.dir.name;
  $('#settings').hidden = true;
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
  $('#file-count').textContent = [
    plural(state.files.length, 'design file'),
    plural(state.sessions.length, 'session'),
    plural(families, 'family', 'families'),
  ].join(' · ');
  $('#settings').hidden = false;
  $('#sessions').replaceChildren(...state.sessions.map(renderSession));
}

function renderSession({ files, families }) {
  const section = document.createElement('section');
  section.className = 'session';
  section.innerHTML = '<h2 class="session-head"><span></span> <span class="muted"></span></h2><div class="families"></div>';
  const [when, counts] = section.querySelectorAll('.session-head span');
  const start = files[0].file.lastModified;
  const end = files.at(-1).file.lastModified;
  when.textContent = `${dayFormat.format(start)} · ${timeFormat.formatRange(start, end)}`;
  counts.textContent = `${plural(files.length, 'file')} · ${plural(families.length, 'family', 'families')}`;
  section.querySelector('.families').append(...families.map(renderFamily));
  return section;
}

function renderFamily(entries) {
  const family = document.createElement('div');
  family.className = 'family';
  family.innerHTML = '<p class="family-head muted"></p><ul class="family-files"></ul>';
  family.querySelector('.family-head').textContent = plural(entries.length, 'file');
  family.querySelector('.family-files').append(...entries.map((entry) => entry.card));
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

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

$('#choose').addEventListener('click', chooseFolder);
$('#choose-again').addEventListener('click', chooseFolder);
$('#settings').addEventListener('input', regroup);
$('#settings').addEventListener('submit', (event) => event.preventDefault());
show(isSupported() ? 'start' : 'unsupported');
