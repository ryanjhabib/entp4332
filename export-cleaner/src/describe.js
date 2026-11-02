// What the grouping compares for each file: what it looks like (one vector
// per image, one per PDF page) and, for PDFs, the words in it.

import { embed } from './embed.js';
import { withPdf, renderPage, readWords } from './pdf.js';
import { THUMB_SIZE } from './thumbs.js';

// A very long PDF stops being described after this many pages.
const MAX_PDF_PAGES = 50;

// Returns { vectors: [Float32Array, ...], words: Set | null }.
export async function describe(entry, onDownload) {
  if (!entry.thumb) return { vectors: [], words: null }; // unreadable file
  if (entry.ext !== 'pdf') return { vectors: [await embed(entry.thumb, onDownload)], words: null };
  try {
    return await describePdf(entry, onDownload);
  } catch (error) {
    // A PDF whose pages or text can't be read is described by its thumbnail alone.
    console.warn(`Only the thumbnail describes ${entry.name}:`, error);
    return { vectors: [await embed(entry.thumb, onDownload)], words: null };
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
