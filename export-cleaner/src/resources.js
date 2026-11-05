// Where the AI models and their engines come from. On the web they download
// the first time a folder is scanned (the models from Hugging Face; the ONNX
// engine, Tesseract and its English data from jsDelivr), then the browser
// caches them. The Mac app (desktop/) carries them all inside it, so it never
// downloads anything: its build runs Vite in 'desktop' mode, and this file is
// the only place that differs. In the web build DESKTOP is false, so Vite
// drops the desktop settings altogether.
const DESKTOP = import.meta.env.MODE === 'desktop';

// Transformers.js's pipeline(), which runs both models. The library is large,
// so it's only fetched once it's needed, and only the parts used are kept.
export async function loadPipeline() {
  const { pipeline, env } = await import('@huggingface/transformers');
  if (DESKTOP) {
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.localModelPath = '/offline/models/';
    // Already on disk, inside the app: no copies in the browser's cache.
    env.useBrowserCache = false;
    env.useWasmCache = false;
    // The ONNX engine bundled into the build (assets/), not jsDelivr's copy.
    env.backends.onnx.wasm.wasmPaths = undefined;
  }
  return pipeline;
}

// Tesseract's worker, engine and English data.
export const TESSERACT_PATHS = DESKTOP
  ? { workerPath: '/offline/tesseract/worker.min.js', corePath: '/offline/tesseract/', langPath: '/offline/tesseract/', cacheMethod: 'none' }
  : {};
