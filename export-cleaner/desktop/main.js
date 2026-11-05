// Export Cleaner for Mac: the web app (built into web/ by `npm run build:web`)
// in its own window, with its models and OCR data inside the app (offline/,
// from `npm run offline`), so it works with no internet.

import { app, BrowserWindow, Menu, dialog, net, protocol, screen, session } from 'electron';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(here, 'web');
const OFFLINE = app.isPackaged ? path.join(process.resourcesPath, 'offline') : path.join(here, 'offline');

// The app's own address. Chromium treats it as secure, like https, which the
// File System Access API and Web Locks need (file:// isn't). Saved progress
// (IndexedDB) belongs to this address, so it must never change.
const ORIGIN = 'app://export-cleaner';

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true } },
]);

// /offline/… comes from the bundled models and OCR files, everything else
// from the built app. Nothing outside those two folders can be read. Each
// file goes out with its size, which Transformers.js reads for its progress.
async function serve(request) {
  const { host, pathname } = new URL(request.url);
  const offline = pathname.startsWith('/offline/');
  const root = offline ? OFFLINE : WEB;
  const file = path.join(root, decodeURIComponent(offline ? pathname.slice('/offline'.length) : pathname));
  if (host !== 'export-cleaner' || !file.startsWith(root + path.sep)) return new Response('Not found', { status: 404 });
  try {
    const [{ size }, response] = await Promise.all([stat(file), net.fetch(pathToFileURL(file).href)]);
    return new Response(response.body, { headers: { 'content-type': response.headers.get('content-type'), 'content-length': String(size) } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

// Nothing leaves the computer: every web request is refused, except a
// Waitlist signup, which sends only the email address typed into it.
const WAITLIST = /^https:\/\/[a-z0-9-]+\.supabase\.co\/+rest\/v1\/waitlist$/;

function blockNetwork({ url, method }, callback) {
  const allowed = WAITLIST.test(url) && (method === 'POST' || method === 'OPTIONS');
  if (!allowed) console.warn(`Blocked a network request to ${new URL(url).host}`);
  callback({ cancel: !allowed });
}

// Folders work as in Chrome: choosing or dropping one lets the app read it,
// and moving files needs a yes at Apply, asked once per folder until the app
// quits. Chromium keeps track of that, but Electron hands the decisions to
// the app: every request comes here (with no handler, all are granted).
// There's deliberately no permission *check* handler: Electron would then
// replace Chromium's "not yet asked" with a plain yes or no, so a folder
// would be writable the moment it was opened, or could never be asked about.
function askToWrite(contents, folder) {
  return dialog.showMessageBox(BrowserWindow.fromWebContents(contents), {
    type: 'question',
    message: `Move files in “${path.basename(folder)}”?`,
    detail: 'Export Cleaner will move the files you rejected into _to_delete inside this folder. Nothing is deleted.',
    buttons: ['Allow', 'Don’t Allow'],
    defaultId: 0,
    cancelId: 1,
  }).then(({ response }) => response === 0);
}

// Reading is asked for when a folder is chosen in the picker, or reopened
// with Resume: choosing it is the answer. The app uses no other permission
// (camera, notifications…), so the rest are refused.
function requestPermission(contents, permission, callback, { fileAccessType, filePath }) {
  if (permission !== 'fileSystem') callback(false);
  else if (fileAccessType === 'readable') callback(true);
  else askToWrite(contents, filePath).then(callback);
}

// Chrome's blocked folders (the home folder itself, Library, system folders)
// stay blocked, with Chrome's explanation; the picker then opens again (a
// drop just ends). Without this, Electron would leave the request unanswered.
async function restricted(event, details, callback) {
  await dialog.showMessageBox(BrowserWindow.getAllWindows()[0], {
    type: 'info',
    message: `Export Cleaner can’t open “${path.basename(details.path) || details.path}”`,
    detail: 'It contains system files. Choose a folder inside it instead.',
  });
  callback('tryAgain');
}

function openWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const win = new BrowserWindow({
    width: Math.min(1440, width),
    height: Math.min(900, height),
    minWidth: 860, // narrower, and "Export Cleaner" in the header wraps onto two lines (measured: below 857)
    backgroundColor: '#eeeeee', // the app's --color-bg, so opening doesn't flash white
    show: false,
    webPreferences: { spellcheck: false },
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${ORIGIN}/`)) event.preventDefault();
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.loadURL(`${ORIGIN}/index.html`);
}

if (!app.requestSingleInstanceLock()) app.exit(); // already open: the open one comes forward instead

app.on('second-instance', () => {
  const [win] = BrowserWindow.getAllWindows();
  if (win?.isMinimized()) win.restore();
  win?.focus();
});

app.whenReady().then(() => {
  protocol.handle('app', serve);
  const { defaultSession } = session;
  defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, blockNetwork);
  defaultSession.setPermissionRequestHandler(requestPermission);
  defaultSession.on('file-system-access-restricted', restricted);

  // The standard Mac menus, so typing, copy and paste, zoom and Quit work.
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]));

  openWindow();
  app.on('activate', () => {
    if (!BrowserWindow.getAllWindows().length) openWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
