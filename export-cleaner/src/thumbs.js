// Step 2: a small preview image for every file.

import { withPdf, renderPage } from './pdf.js';

// Longest side of a thumbnail in pixels: sharp at 160 CSS px on a retina screen.
export const THUMB_SIZE = 320;

// Draws any supported file (a PDF's first page) onto a canvas, `size` px on its longest side.
export function renderAt({ file, ext }, size) {
  const render = { pdf: renderPdf, svg: renderSvg, tif: renderTiff, tiff: renderTiff }[ext] ?? renderRaster;
  return render(file, size);
}

// Makes one thumbnail. Returns an object URL for an <img>, or null if the
// file can't be read (corrupt, or a format the browser can't decode).
export async function makeThumbnail(entry) {
  const { file } = entry;
  try {
    const canvas = await renderAt(entry, THUMB_SIZE);
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
// original file (the browser scales it to the card); PDFs and TIFFs, which an
// <img> can't show, are rendered larger instead.
export async function makePreview(entry) {
  const { file, ext } = entry;
  if (['pdf', 'tif', 'tiff'].includes(ext)) {
    const canvas = await renderAt(entry, PREVIEW_SIZE);
    return URL.createObjectURL(await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9)));
  }
  return URL.createObjectURL(ext === 'svg' ? await svgBlob(file) : file);
}

// PNG, JPG, WebP, AVIF and GIF decode straight to a bitmap (EXIF rotation
// included; a GIF's first frame).
async function renderRaster(file, size) {
  return drawBitmap(await createImageBitmap(file), size);
}

// Chrome can't decode TIFF (a common lossless Lightroom export, often
// 16-bit), so UTIF.js does. It's only fetched the first time a folder has one.
let utifReady;

async function renderTiff(file, size) {
  utifReady ??= import('utif').then((module) => module.default ?? module);
  const UTIF = await utifReady;
  const buffer = await file.arrayBuffer();
  // A TIFF can hold several images (some tools add a small preview): use the largest.
  const image = UTIF.decode(buffer).reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
  UTIF.decodeImage(buffer, image);
  const rgba = UTIF.toRGBA8(image); // 16-bit channels come back as 8-bit
  const pixels = new ImageData(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.length), image.width, image.height);
  return drawBitmap(await createImageBitmap(pixels), size);
}

// Draws a decoded bitmap smaller, then frees its full-size pixels.
function drawBitmap(bitmap, size) {
  try {
    return drawScaled(bitmap, bitmap.width, bitmap.height, size);
  } finally {
    bitmap.close();
  }
}

// createImageBitmap can't read SVG, so SVGs go through an <img> instead.
async function renderSvg(file, size) {
  const url = URL.createObjectURL(await svgBlob(file));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return drawScaled(img, img.naturalWidth, img.naturalHeight, size);
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

function drawScaled(source, width, height, size) {
  const scale = size / Math.max(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high'; // smoother downscaling of big photos
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// Page 1 of a PDF, `size` px on its longest side.
function renderPdf(file, size) {
  return withPdf(file, (pdf) => renderPage(pdf, 1, size));
}
