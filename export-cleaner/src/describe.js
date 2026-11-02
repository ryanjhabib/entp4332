// What the grouping compares for each file: what it looks like (one vector
// per image, one per PDF page) and the words in it (a PDF's text, or an
// image's text read by OCR).

import { embed } from './embed.js';
import { withPdf, renderPage, readWords } from './pdf.js';
import { THUMB_SIZE, renderAt } from './thumbs.js';
import { readImageWords } from './ocr.js';

// A very long PDF stops being described after this many pages.
const MAX_PDF_PAGES = 50;

// Images are read for text at this size: big enough for body text on a slide.
const OCR_SIZE = 1600;

// Returns { vectors: [Float32Array, ...], words: Set | null }.
export async function describe(entry, onDownload) {
  if (!entry.thumb) return { vectors: [], words: null }; // unreadable file
  if (entry.ext !== 'pdf') return { vectors: [await embed(entry.thumb, onDownload)], words: await imageWords(entry) };
  try {
    return await describePdf(entry, onDownload);
  } catch (error) {
    // A PDF whose pages or text can't be read is described by its thumbnail alone.
    console.warn(`Only the thumbnail describes ${entry.name}:`, error);
    return { vectors: [await embed(entry.thumb, onDownload)], words: null };
  }
}

// The image's text by OCR, or null if it can't be read (the looks still count).
async function imageWords(entry) {
  try {
    return await readImageWords(await renderAt(entry, OCR_SIZE));
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
