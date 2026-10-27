// Step 1: open a folder and list the design files directly inside it.

// File types the app looks at. Everything else in the folder is ignored.
export const EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'pdf'];

// Safari, Firefox, Brave and mobile browsers don't have the picker at all.
export const isSupported = () => 'showDirectoryPicker' in window;

// Opens Chrome's folder picker. Read-only for now: permission to move files
// is asked for separately, only when the user applies their decisions.
// The id makes Chrome reopen the picker where it was last time.
export function pickFolder() {
  return window.showDirectoryPicker({ id: 'export-folder', mode: 'read' });
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
