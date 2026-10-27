// Step 3: a perceptual hash, a 64-bit fingerprint of what an image looks like.
//
// dHash: shrink to 9×8 grey pixels, then for each row record whether each
// pixel is brighter than its right-hand neighbour (8 × 8 = 64 bits).
// Resizing or recompressing an image barely changes those bits; a different
// image changes about half of them.
export function dHash(source) {
  const canvas = new OffscreenCanvas(9, 8);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; // transparent areas count as white, not black
  ctx.fillRect(0, 0, 9, 8);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, 9, 8);
  const px = ctx.getImageData(0, 0, 9, 8).data;
  const grey = (x, y) => {
    const i = (y * 9 + x) * 4;
    return 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
  };
  let hash = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) hash = (hash << 1n) | (grey(x, y) > grey(x + 1, y) ? 1n : 0n);
  }
  return hash;
}

// How many of the 64 bits differ: 0 = look the same, around 32 = unrelated.
export function distance(a, b) {
  let bits = a ^ b;
  let count = 0;
  while (bits) {
    count += Number(bits & 1n);
    bits >>= 1n;
  }
  return count;
}
