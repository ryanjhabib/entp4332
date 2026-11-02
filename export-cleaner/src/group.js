// Step 4: families by look, across the whole folder. When files were exported
// doesn't split them: a re-edit months later joins the same family.

import { similarity } from './embed.js';

// Matching file names nudge two files closer, never decide on their own:
// unrelated images score around 0.2–0.5, far below any threshold.
const NAME_BONUS = 0.05;

// Edit and copy markers that tools add to the end of a name.
const SUFFIXES = [
  / \(\d+\)$/, // browser duplicate: "photo (1)"
  / copy( \d+)?$/, // Finder duplicate: "photo copy 2"
  /[-_ ]edit([-_ ]\d+)?$/, // Lightroom: "DSC01234-Edit-2"
  /[-_ ]?v\d+$/, // versions: "poster_v3"
  /[-_ ](final|new|old|exported?)$/, // "logo_final"
];

// Names that say nothing about the content, so sharing them isn't a clue.
const GENERIC = new Set(['untitled', 'image', 'img', 'photo', 'frame', 'artboard', 'group', 'screenshot', 'export', 'download']);

// "DSC01234-Edit-2.jpg" → "dsc01234". "Untitled-501.jpg" stays "untitled-501":
// a plain sequence number marks a different photo, so it's only stripped
// ("-2") when a longer camera number is left behind. Returns null if there's no clue.
export function nameStem(name) {
  let stem = name.toLowerCase().replace(/\.[^.]+$/, '');
  for (let changed = true; changed; ) {
    changed = false;
    for (const suffix of [...SUFFIXES, /(?<=\d{3,})[-_]\d{1,2}$/]) {
      const shorter = stem.replace(suffix, '');
      if (shorter !== stem && shorter) {
        stem = shorter;
        changed = true;
      }
    }
  }
  return GENERIC.has(stem) ? null : stem;
}

// Two files are in the same family when their similarity (plus NAME_BONUS if
// their names share a stem) is at least minSimilarity. Chains count too (A looks like B, B looks like C, so A, B
// and C are one family), which keeps a run of small edits together.
// Files with no vector (no preview) stay on their own.
// Returns families as arrays of files, each oldest first, ordered by their oldest file.
export function groupFiles(files, { minSimilarity }) {
  // Union-find: each file points towards its family's representative.
  const parent = files.map((_, i) => i);
  const root = (i) => (parent[i] === i ? i : (parent[i] = root(parent[i])));
  const stems = files.map((entry) => nameStem(entry.name));
  for (let i = 0; i < files.length; i++) {
    const a = files[i].vector;
    if (!a) continue;
    for (let j = i + 1; j < files.length; j++) {
      const b = files[j].vector;
      if (!b) continue;
      const bonus = stems[i] && stems[i] === stems[j] ? NAME_BONUS : 0;
      if (similarity(a, b) + bonus >= minSimilarity) parent[root(j)] = root(i);
    }
  }
  // Files are already oldest first, so families come out in order of their oldest file.
  const families = new Map();
  files.forEach((entry, i) => {
    const key = root(i);
    if (!families.has(key)) families.set(key, []);
    families.get(key).push(entry);
  });
  return [...families.values()];
}
