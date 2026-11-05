// Puts everything the web app downloads while it runs into offline/, for the
// Mac app only: the two AI models (from Hugging Face), Tesseract's English
// data (from jsDelivr), and Tesseract's worker and engine (copied from the web
// app's installed packages, the versions it loads from jsDelivr). Downloads
// are pinned to the exact files the web app gets today and checked against
// their SHA-256; files already in place are kept. offline/ is git-ignored and
// never part of the website.
//   npm run offline

import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { copyFile, mkdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const desktop = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OFFLINE = path.join(desktop, 'offline');
const PACKAGES = path.join(desktop, '..', 'node_modules');

// The revisions the web app's `main` pointed to on 2026-11-05.
const DINO = 'https://huggingface.co/onnx-community/dinov2-small/resolve/8b1f705a3a7f6f062f6bdd21986c1583d3ef105d';
const MINILM = 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/751bff37182d3f1213fa05d7196b954e230abad9';
const ENGLISH = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int';

const DOWNLOADS = [
  ['models/onnx-community/dinov2-small/config.json', `${DINO}/config.json`, '50965b6c1dc4a9e38af8b5e8736cf059e56aa60d9047c2aef05f7e134371d02a'],
  ['models/onnx-community/dinov2-small/preprocessor_config.json', `${DINO}/preprocessor_config.json`, '14e780d86fa1861f8751f868d7f45425b5feb55c38ca26f152ca5097ab30f828'],
  ['models/onnx-community/dinov2-small/onnx/model.onnx', `${DINO}/onnx/model.onnx`, 'f22797eabf810a75e41de68d378541ebea372122b25c4ce3ef25ff618250c20a'],
  ['models/Xenova/all-MiniLM-L6-v2/config.json', `${MINILM}/config.json`, '7135149f7cffa1a573466c6e4d8423ed73b62fd2332c575bf738a0d033f70df7'],
  ['models/Xenova/all-MiniLM-L6-v2/tokenizer.json', `${MINILM}/tokenizer.json`, 'da0e79933b9ed51798a3ae27893d3c5fa4a201126cef75586296df9b4d2c62a0'],
  ['models/Xenova/all-MiniLM-L6-v2/tokenizer_config.json', `${MINILM}/tokenizer_config.json`, '9261e7d79b44c8195c1cada2b453e55b00aeb81e907a6664974b4d7776172ab3'],
  ['models/Xenova/all-MiniLM-L6-v2/onnx/model_quantized.onnx', `${MINILM}/onnx/model_quantized.onnx`, 'afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1'],
  ['tesseract/eng.traineddata.gz', `${ENGLISH}/eng.traineddata.gz`, '45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91'],
];

// Chromium runs the relaxed-SIMD engine; the plain SIMD one is Tesseract's
// fallback if a processor lacked relaxed SIMD.
const COPIES = [
  ['tesseract/worker.min.js', 'tesseract.js/dist/worker.min.js'],
  ['tesseract/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['tesseract/tesseract-core-simd-lstm.wasm.js', 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js'],
];

async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

const exists = (file) => stat(file).then(() => true, () => false);

// Downloads to a .partial file, and keeps it only if it's the expected file.
async function download(target, url, expected) {
  if ((await exists(target)) && (await sha256(target)) === expected) return false;
  await mkdir(path.dirname(target), { recursive: true });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
  const partial = `${target}.partial`;
  await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
  const actual = await sha256(partial);
  if (actual !== expected) {
    await rm(partial);
    throw new Error(`${url} isn't the expected file (SHA-256 ${actual}, expected ${expected}). Nothing was kept.`);
  }
  await rename(partial, target);
  return true;
}

for (const [name, url, expected] of DOWNLOADS) {
  console.log(`${(await download(path.join(OFFLINE, name), url, expected)) ? 'downloaded' : 'already there'}  ${name}`);
}
for (const [name, from] of COPIES) {
  await mkdir(path.dirname(path.join(OFFLINE, name)), { recursive: true });
  await copyFile(path.join(PACKAGES, from), path.join(OFFLINE, name));
  console.log(`copied  ${name}`);
}
