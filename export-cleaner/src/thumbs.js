// Step 2: a small preview image for every file.

// Longest side of a thumbnail in pixels: sharp at 160 CSS px on a retina screen.
const SIZE = 320;

// Makes one thumbnail. Returns an object URL for an <img>, or null if the
// file can't be read (corrupt, or a format the browser can't decode).
export async function makeThumbnail({ file, ext }) {
  try {
    const render = { pdf: renderPdf, svg: renderSvg }[ext] ?? renderRaster;
    const canvas = await render(file);
    // WebP keeps transparency, which JPEG would turn black.
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
    return URL.createObjectURL(blob);
  } catch (err) {
    console.warn(`No thumbnail for ${file.name}:`, err);
    return null;
  }
}

// Longest side of a PDF page on the swipe card.
const PREVIEW_SIZE = 1600;

// A bigger image for the swipe card, as an object URL. Images use the
// original file (the browser scales it to the card); PDFs render page 1 larger.
export async function makePreview({ file, ext }) {
  if (ext === 'pdf') {
    const canvas = await renderPdf(file, PREVIEW_SIZE);
    return URL.createObjectURL(await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9)));
  }
  return URL.createObjectURL(ext === 'svg' ? await svgBlob(file) : file);
}

// PNG, JPG and WebP decode straight to a bitmap (EXIF rotation included),
// which is freed as soon as the small copy is drawn.
async function renderRaster(file) {
  const bitmap = await createImageBitmap(file);
  try {
    return drawScaled(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

// createImageBitmap can't read SVG, so SVGs go through an <img> instead.
async function renderSvg(file) {
  const url = URL.createObjectURL(await svgBlob(file));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return drawScaled(img, img.naturalWidth, img.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Chrome gives an SVG with no fixed width and height (Figma often exports
// only a viewBox) a default 300×150 box, which letterboxes the drawing.
// Copying the viewBox size into width and height gives it its real shape.
async function svgBlob(file) {
  const doc = new DOMParser().parseFromString(await file.text(), 'image/svg+xml');
  const svg = doc.documentElement;
  const [, , w, h] = (svg.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
  if (w > 0 && h > 0) {
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
  }
  return new Blob([new XMLSerializer().serializeToString(doc)], { type: 'image/svg+xml' });
}

function drawScaled(source, width, height) {
  const scale = SIZE / Math.max(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high'; // smoother downscaling of big photos
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// pdf.js is large, so it's only downloaded the first time a folder has a PDF.
let pdfjsReady;

async function loadPdfjs() {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

// Renders page 1 of a PDF straight onto a canvas, `size` px on its longest side.
async function renderPdf(file, size = SIZE) {
  pdfjsReady ??= loadPdfjs();
  const pdfjs = await pdfjsReady;
  const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
  try {
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    const { width, height } = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: size / Math.max(width, height) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvas, viewport }).promise;
    return canvas;
  } finally {
    await task.destroy(); // pdf.js v6: cleanup lives on the loading task
  }
}
