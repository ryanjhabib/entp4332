import './style.css';
import { isSupported, pickFolder, readFolder } from './scan.js';

const $ = (selector) => document.querySelector(selector);

// Everything the app knows lives here.
const state = {
  dir: null, // the folder the user picked (a FileSystemDirectoryHandle)
  files: [], // { handle, file, name, ext } for each design file in it
};

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
  state.dir = dir;
  state.files = await readFolder(dir);
  renderFiles();
  show('files');
}

function renderFiles() {
  $('#folder-name').textContent = state.dir.name;
  const n = state.files.length;
  $('#file-count').textContent = `${n} design file${n === 1 ? '' : 's'}, oldest first`;
  $('#file-list').replaceChildren(
    ...state.files.map(({ name, ext, file }) => {
      const li = document.createElement('li');
      for (const text of [name, ext, formatSize(file.size), formatDate(file.lastModified)]) {
        const span = document.createElement('span');
        span.textContent = text;
        li.append(span);
      }
      return li;
    }),
  );
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' });
const formatDate = (ms) => dateFormat.format(ms);

$('#choose').addEventListener('click', chooseFolder);
$('#choose-again').addEventListener('click', chooseFolder);
show(isSupported() ? 'start' : 'unsupported');
