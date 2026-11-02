// Capture details from a photo's EXIF/XMP metadata, read with exifr (MIT,
// loaded the first time it's needed). Lightroom keeps them in every export:
// the moment the photo was taken, the camera, and an ID for the original
// photo that all of its exports share.

// Formats exifr can read metadata from.
const READABLE = ['jpg', 'jpeg', 'tif', 'tiff', 'png', 'avif'];

let exifrReady;

// Returns { taken: Date, moment, original } or null. `moment` is the capture
// moment to the sub-second plus the camera; `original` is Lightroom's
// OriginalDocumentID, which every export of one original photo shares.
export async function readShot({ file, ext }) {
  if (!READABLE.includes(ext)) return null;
  exifrReady ??= import('exifr').then((module) => module.default ?? module);
  const exifr = await exifrReady;
  let tags;
  try {
    tags = await exifr.parse(file, { tiff: true, exif: true, xmp: true });
  } catch {
    return null; // no metadata, or none exifr can read
  }
  const taken = tags?.DateTimeOriginal instanceof Date ? tags.DateTimeOriginal : null;
  if (!taken) return null; // without a capture time it isn't a photo's metadata
  return {
    taken,
    moment: `${taken.getTime()}.${tags.SubSecTimeOriginal ?? ''}|${tags.Make ?? ''}|${tags.Model ?? ''}`,
    // Only trusted alongside a capture time: design apps carry an original ID
    // through "Save As", so a new design started from an old one would share it.
    original: tags.OriginalDocumentID ?? null,
  };
}
