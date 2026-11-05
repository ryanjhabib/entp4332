// Reading the words inside an image (OCR, optical character recognition), so
// text-heavy images can be compared by their words the way PDFs are.
// Tesseract.js, English. Its engine and language data (a few MB) come from
// the jsDelivr CDN the first time, then Chrome caches them; the Mac app has
// them built in (see resources.js).

import { TESSERACT_PATHS } from './resources.js';

// Words Tesseract is less sure of than this (0–100) are left out: on photos
// it "finds" words in textures, all at low confidence.
const MIN_CONFIDENCE = 80;

let workerReady = null;

function loadWorker() {
  workerReady ??= import('tesseract.js')
    .then(({ createWorker, OEM }) => createWorker('eng', OEM.LSTM_ONLY, TESSERACT_PATHS)) // LSTM_ONLY: Tesseract's default engine
    .catch((error) => {
      workerReady = null; // let the next file try again
      throw error;
    });
  return workerReady;
}

// Every confidently read word of 3+ letters in the canvas, lower case.
export async function readImageWords(canvas) {
  const worker = await loadWorker();
  const { data } = await worker.recognize(canvas, {}, { blocks: true });
  const words = new Set();
  for (const block of data.blocks ?? []) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        for (const word of line.words) {
          if (word.confidence < MIN_CONFIDENCE) continue;
          for (const part of word.text.toLowerCase().match(/\p{L}{3,}/gu) ?? []) words.add(part);
        }
      }
    }
  }
  return words;
}
