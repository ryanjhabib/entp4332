// Saved progress, kept in this browser on this computer (IndexedDB), so a
// refresh, a rescan or a second visit doesn't start over. Nothing here leaves
// the computer.
//
// Two stores:
// - folders: one small record per folder, rewritten on every choice:
//   { id, handle, name, used, typeId, description, level,
//     families: [[file name, ...], ...], decisions: { name: 'keep' | 'reject' } }
// - files: what the scan found for each file, written once as it's scanned:
//   { folder, name, size, lastModified, thumb (Blob), width, height, vectors, words, shot, colour }
//   A row is only reused while the file's size and date still match.
//
// A folder unused for FORGET_AFTER is dropped; "Forget this folder" drops it at once.

const FORGET_AFTER = 30 * 24 * 60 * 60 * 1000; // 30 days
let ready = null;

function open() {
  ready ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('syca', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('folders', { keyPath: 'id' });
      request.result.createObjectStore('files', { keyPath: ['folder', 'name'] });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return ready;
}

const result = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const finished = (transaction) => new Promise((resolve, reject) => {
  transaction.oncomplete = resolve;
  transaction.onerror = transaction.onabort = () => reject(transaction.error);
});

async function objects(name, mode = 'readonly') {
  return (await open()).transaction(name, mode).objectStore(name);
}

// Every row of one folder's files: [id] sorts before [id, name], and [id, []] after.
const filesOf = (id) => IDBKeyRange.bound([id], [id, []]);

export async function getFolder(id) {
  return result((await objects('folders')).get(id));
}

// The saved record for this folder, or a new one (saved at once, so another
// tab opening the same folder finds it).
export async function folderRecord(dir) {
  for (const record of await result((await objects('folders')).getAll())) {
    if (await record.handle.isSameEntry(dir)) return record;
  }
  const record = { id: crypto.randomUUID(), handle: dir, name: dir.name, used: Date.now(), families: [], decisions: {} };
  await saveFolder(record);
  return record;
}

export async function saveFolder(record) {
  record.used = Date.now();
  await result((await objects('folders', 'readwrite')).put(record));
}

// Saved scan results by file name.
export async function savedFiles(id) {
  const rows = await result((await objects('files')).getAll(filesOf(id)));
  return new Map(rows.map((row) => [row.name, row]));
}

export async function saveFile(id, entry) {
  const thumb = entry.thumb ? await (await fetch(entry.thumb)).blob() : null;
  const { name, width, height, vectors, words, shot, colour } = entry;
  const { size, lastModified } = entry.file;
  await result((await objects('files', 'readwrite')).put({ folder: id, name, size, lastModified, thumb, width, height, vectors, words, shot, colour }));
}

// Drops the rows of files no longer in the folder.
export async function pruneFiles(id, names) {
  const store = await objects('files', 'readwrite');
  const keys = await result(store.getAllKeys(filesOf(id)));
  for (const key of keys) if (!names.has(key[1])) store.delete(key);
  await finished(store.transaction);
}

export async function forgetFolder(id) {
  const transaction = (await open()).transaction(['folders', 'files'], 'readwrite');
  transaction.objectStore('folders').delete(id);
  transaction.objectStore('files').delete(filesOf(id));
  await finished(transaction);
}

export async function forgetStale() {
  const folders = await result((await objects('folders')).getAll());
  for (const { id, used } of folders) if (Date.now() - used > FORGET_AFTER) await forgetFolder(id);
}

// One tab per folder: two tabs saving choices for the same folder would
// overwrite each other. The lock is held until this tab opens another folder
// or closes (a refresh included).
let claimed = null;
let release = () => {};

export function claimFolder(id) {
  if (claimed === id) return Promise.resolve(true);
  release();
  claimed = null;
  return new Promise((resolve) => {
    navigator.locks.request(`syca-folder-${id}`, { ifAvailable: true }, (lock) => {
      if (!lock) return resolve(false);
      claimed = id;
      resolve(true);
      return new Promise((done) => { release = done; });
    });
  });
}
