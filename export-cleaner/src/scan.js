// Step 1: open a folder and list the design files directly inside it.

// File types the app looks at. Everything else in the folder is ignored.
export const EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'tif', 'tiff', 'svg', 'pdf'];

// Safari, Firefox, Brave and mobile browsers don't have the picker at all.
export const isSupported = () => 'showDirectoryPicker' in window;

// Opens Chrome's folder picker. Read-only for now: permission to move files
// is asked for separately, only when the user applies their decisions.
// The id makes Chrome reopen the picker where it was last time.
export function pickFolder() {
  return window.showDirectoryPicker({ id: 'export-folder', mode: 'read' });
}

// Capture the handle promises in the drop event's own tick, before any await.
export async function droppedFolder(dataTransfer) {
  const items = Array.from(dataTransfer.items).filter(item => item.kind === 'file');
  if (items.length !== 1) throw new Error('Drop one folder to start.');
  if (!items[0].getAsFileSystemHandle) throw new Error('Use select to open a folder in this browser.');
  const handle = await items[0].getAsFileSystemHandle();
  if (handle?.kind !== 'directory') throw new Error('Drop a folder, rather than individual files.');
  return handle;
}

// Lists matching files in the folder (not its subfolders), oldest first.
// Each entry keeps its handle (needed later to move the file) and its File
// (name, size, lastModified, and the bytes for thumbnails).
export async function readFolder(dir) {
  const files = [];
  for await (const handle of dir.values()) {
    if (handle.kind !== 'file' || handle.name.startsWith('.')) continue;
    const ext = handle.name.split('.').pop().toLowerCase();
    if (!EXTENSIONS.includes(ext)) continue;
    files.push({ handle, file: await handle.getFile(), name: handle.name, ext });
  }
  return files.sort((a, b) => a.file.lastModified - b.file.lastModified);
}
