import './style.css';
import { isSupported, pickFolder, readFolder } from './scan.js';
import { makeThumbnail } from './thumbs.js';

const $ = (selector) => document.querySelector(selector);

// Everything the app knows lives here.
const state = {
  dir: null, // the folder the user picked (a FileSystemDirectoryHandle)
  files: [], // { handle, file, name, ext, thumb, card } for each design file in it
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
  state.dir = dir;
  state.files = await readFolder(dir);
  renderFiles();
  show('files');
  await makeThumbnails(state.files);
}

// Fills in each card's thumbnail as it's made, a few files at a time.
async function makeThumbnails(files) {
  const queue = [...files];
  let done = 0;
  const work = async () => {
    // Stop early if the user has picked another folder meanwhile.
    while (queue.length && files === state.files) {
      const entry = queue.shift();
      entry.thumb = await makeThumbnail(entry);
      showThumb(entry);
      done += 1;
      renderCount(done);
    }
  };
  await Promise.all(Array.from({ length: THUMB_WORKERS }, work));
}

function renderCount(thumbsDone) {
  const n = state.files.length;
  const count = `${n} design file${n === 1 ? '' : 's'}, oldest first`;
  $('#file-count').textContent = thumbsDone < n ? `${count} · previews ${thumbsDone} of ${n}` : count;
}

function renderFiles() {
  $('#folder-name').textContent = state.dir.name;
  renderCount(0);
  $('#thumb-grid').replaceChildren(...state.files.map(renderCard));
}

function renderCard(entry) {
  const card = document.createElement('li');
  card.innerHTML = '<div class="thumb"></div><p class="card-name"></p><p class="card-time"></p>';
  card.querySelector('.card-name').textContent = entry.name;
  card.querySelector('.card-name').title = entry.name;
  card.querySelector('.card-time').textContent = formatDate(entry.file.lastModified);
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

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' });
const formatDate = (ms) => dateFormat.format(ms);

$('#choose').addEventListener('click', chooseFolder);
$('#choose-again').addEventListener('click', chooseFolder);
show(isSupported() ? 'start' : 'unsupported');
