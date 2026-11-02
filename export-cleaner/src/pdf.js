// PDFs through pdf.js: render pages, read their text.

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

// Opens a PDF file, hands it to `use`, and closes it afterwards whatever happens.
export async function withPdf(file, use) {
  pdfjsReady ??= loadPdfjs();
  const pdfjs = await pdfjsReady;
  const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
  try {
    return await use(await task.promise);
  } finally {
    await task.destroy(); // pdf.js v6: cleanup lives on the loading task
  }
}

// Renders one page (numbered from 1) onto a canvas, `size` px on its longest side.
export async function renderPage(pdf, number, size) {
  const page = await pdf.getPage(number);
  const { width, height } = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: size / Math.max(width, height) });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await page.render({ canvas, viewport }).promise;
  return canvas;
}

// Every word of 3+ letters in the PDF, lower case, from every page.
export async function readWords(pdf) {
  const words = new Set();
  for (let n = 1; n <= pdf.numPages; n++) {
    const { items } = await (await pdf.getPage(n)).getTextContent();
    for (const item of items) for (const word of item.str.toLowerCase().match(/\p{L}{3,}/gu) ?? []) words.add(word);
  }
  return words;
}
