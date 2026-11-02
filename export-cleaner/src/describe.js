// What the grouping compares for each file: what it looks like (one vector
// per image, one per PDF page), the words in it (a PDF's text, or an image's
// text read by OCR), which shot it is (photo metadata), and its average
// colour (for ordering the overview).

import { embed } from './embed.js';
import { withPdf, renderPage, readWords } from './pdf.js';
import { THUMB_SIZE, renderAt } from './thumbs.js';
import { readImageWords } from './ocr.js';
import { readShot } from './metadata.js';

// A very long PDF stops being described after this many pages.
const MAX_PDF_PAGES = 50;

// Images are read for text at this size: big enough for body text on a slide.
const OCR_SIZE = 1600;

// Very large exports with any text are read again at this size and the readings
// combined. At 1600, small text is lost: an 8640px site mock-up's calendar read
// only the browser tab's "calendar", and a dense 3200px text sheet read 80 of
// its 286 words, too few to recognise it inside a mock-up (0.46 overlap vs 0.97).
// Photos read no words, so they skip it. The 1600 reading is kept, since faint
// text can read worse at full size (a 2293px page read nothing at full size).
const OCR_LARGE = 3200;

// Returns { vectors: [Float32Array, ...], words: Set | null, shot: { taken, moment, original } | null,
// colour: [r, g, b] | null }.
export async function describe(entry, onDownload) {
  if (!entry.thumb) return { vectors: [], words: null, shot: null, colour: null }; // unreadable file
  return {
    ...(await describeContent(entry, onDownload)),
    shot: await readShot(entry),
    colour: await averageColour(entry.thumb),
  };
}

async function describeContent(entry, onDownload) {
  if (entry.ext !== 'pdf') return { vectors: [await embed(entry.thumb, onDownload)], words: await imageWords(entry) };
  try {
    return await describePdf(entry, onDownload);
  } catch (error) {
    // A PDF whose pages or text can't be read is described by its thumbnail alone.
    console.warn(`Only the thumbnail describes ${entry.name}:`, error);
    return { vectors: [await embed(entry.thumb, onDownload)], words: null };
  }
}

// The thumbnail's average colour as [r, g, b] (0–255); transparent areas count as white.
async function averageColour(thumbUrl) {
  const bitmap = await createImageBitmap(await (await fetch(thumbUrl)).blob());
  const canvas = new OffscreenCanvas(16, 16);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 16, 16);
  ctx.drawImage(bitmap, 0, 0, 16, 16);
  bitmap.close();
  const pixels = ctx.getImageData(0, 0, 16, 16).data;
  const sum = [0, 0, 0];
  for (let i = 0; i < pixels.length; i += 4) {
    sum[0] += pixels[i];
    sum[1] += pixels[i + 1];
    sum[2] += pixels[i + 2];
  }
  return sum.map((total) => total / 256);
}

// The image's text by OCR, or null if it can't be read (the looks still count).
async function imageWords(entry) {
  try {
    const words = await readImageWords(await renderAt(entry, OCR_SIZE));
    if (words.size && Math.max(entry.width ?? 0, entry.height ?? 0) >= OCR_LARGE) {
      for (const word of await readImageWords(await renderAt(entry, OCR_LARGE))) words.add(word);
    }
    return words;
  } catch (error) {
    console.warn(`Couldn't read text in ${entry.name}:`, error);
    return null;
  }
}

function describePdf(entry, onDownload) {
  return withPdf(entry.file, async (pdf) => {
    const vectors = [];
    for (let n = 1; n <= Math.min(pdf.numPages, MAX_PDF_PAGES); n++) {
      const canvas = await renderPage(pdf, n, THUMB_SIZE);
      const url = URL.createObjectURL(await new Promise((resolve) => canvas.toBlob(resolve, 'image/png')));
      try {
        vectors.push(await embed(url, onDownload));
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    return { vectors, words: await readWords(pdf) };
  });
}
