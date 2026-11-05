// Step 7: move rejected files into a _to_delete folder inside the chosen
// folder. Nothing is ever permanently deleted by the app.

export const TRASH_FOLDER = '_to_delete';

// Asks Chrome for permission to change the folder (the folder was opened
// read-only). Must run from a click. Returns true if granted.
export async function requestWriteAccess(dir) {
  const mode = { mode: 'readwrite' };
  if ((await dir.queryPermission(mode)) === 'granted') return true;
  return (await dir.requestPermission(mode)) === 'granted';
}

// Moves each rejected file into _to_delete, one at a time.
// Returns { moved: [{ entry, name, how }], failed: [{ entry, error, gone }] },
// gone when a file that couldn't be moved isn't in the folder any more.
export async function moveRejected(dir, rejected, onProgress) {
  const existed = await dir.getDirectoryHandle(TRASH_FOLDER).then(() => true, () => false);
  const trash = await dir.getDirectoryHandle(TRASH_FOLDER, { create: true });
  const moved = [];
  const failed = [];
  for (const entry of rejected) {
    try {
      const name = await freeName(trash, entry.name);
      const how = await moveFile(entry, dir, trash, name);
      moved.push({ entry, name, how });
    } catch (error) {
      console.error(`Could not move ${entry.name}:`, error);
      const gone = await entry.handle.getFile().then(() => false, (missing) => missing.name === 'NotFoundError');
      failed.push({ entry, error, gone });
    }
    onProgress(moved.length + failed.length);
  }
  // Nothing went into a _to_delete made just now, so it goes again. Without
  // `recursive`, removeEntry only removes an empty folder.
  if (!existed && !moved.length) await dir.removeEntry(TRASH_FOLDER).catch(() => {});
  return { moved, failed };
}

// Chrome's move() is a real move: the same file, same dates, nothing copied.
// If this Chrome refuses it for files on disk, fall back to copying the file,
// checking the copy is complete, and only then removing the original.
async function moveFile(entry, from, to, name) {
  try {
    await entry.handle.move(to, name);
    return 'move';
  } catch (error) {
    console.warn(`move() failed for ${entry.name}, copying instead:`, error);
  }
  const source = await entry.handle.getFile();
  const target = await to.getFileHandle(name, { create: true });
  const writable = await target.createWritable();
  await writable.write(source);
  await writable.close();
  const copy = await target.getFile();
  if (copy.size !== source.size) {
    throw new Error(`The copy is ${copy.size} bytes but the original is ${source.size}; original left in place.`);
  }
  await from.removeEntry(entry.name);
  return 'copy';
}

// "name.jpg", or "name (2).jpg" etc. if _to_delete already has one from an earlier run.
async function freeName(folder, name) {
  const dot = name.lastIndexOf('.');
  const [base, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? name : `${base} (${n})${ext}`;
    try {
      await folder.getFileHandle(candidate);
    } catch (error) {
      if (error.name === 'NotFoundError') return candidate;
      throw error;
    }
  }
}
