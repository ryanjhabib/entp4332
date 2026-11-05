// Step 3: what each image looks like, as 384 numbers from an image model
// (DINOv2 small, Apache 2.0) that runs here in the browser. Images that share
// content get similar numbers, even cropped, re-edited, or laid out differently.
// The model (about 84 MB) downloads from Hugging Face the first time, then
// Chrome caches it; the Mac app has it built in (see resources.js). No image
// ever leaves the computer.

import { loadPipeline } from './resources.js';

const MODEL = 'onnx-community/dinov2-small';

let modelReady = null;

// The Mac's GPU (WebGPU) when there's one to use, otherwise the processor
// (WebAssembly). Some machines offer WebGPU but have no usable graphics
// adapter, and asking for it anyway stopped the scan on a raw error.
async function device() {
  return (await navigator.gpu?.requestAdapter()) ? 'webgpu' : 'wasm';
}

// The library is large, so like pdf.js it's only fetched once a folder is opened.
// onDownload(percent) reports the first-time download of the model file.
function loadModel(onDownload) {
  modelReady ??= loadPipeline().then(async (pipeline) =>
    pipeline('image-feature-extraction', MODEL, {
      device: await device(),
      dtype: 'fp32', // full precision: accuracy over speed
      progress_callback: (p) => {
        if (p.status === 'progress' && p.file.endsWith('.onnx')) onDownload(Math.round(p.progress));
      },
    }),
  ).catch((error) => {
    modelReady = null; // let the next folder try again
    throw error;
  });
  return modelReady;
}

// Prepare the same cached model before the per-file scan, with download progress.
export function prepareModel(onDownload = () => {}) {
  return loadModel(onDownload);
}

// Returns the image's numbers, scaled to length 1 so comparing two is a plain dot product.
export async function embed(imageUrl, onDownload) {
  const extract = await loadModel(onDownload);
  const features = await extract(imageUrl);
  // The model returns one vector per image patch; the first (CLS) one summarises the whole image.
  const vector = features.data.slice(0, features.dims.at(-1));
  let length = 0;
  for (const v of vector) length += v * v;
  length = Math.sqrt(length);
  for (let i = 0; i < vector.length; i++) vector[i] /= length;
  return vector;
}

// 1 = the same image, around 0.8+ = the same content, lower = different.
export function similarity(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
