// Step 4: families by look, across the whole folder. When files were exported
// doesn't split them: a re-edit months later joins the same family.

import { similarity } from './embed.js';

// Two files are in the same family when their similarity is at least
// minSimilarity. Chains count too (A looks like B, B looks like C, so A, B
// and C are one family), which keeps a run of small edits together.
// Files with no vector (no preview) stay on their own.
// Returns families as arrays of files, each oldest first, ordered by their oldest file.
export function groupFiles(files, { minSimilarity }) {
  // Union-find: each file points towards its family's representative.
  const parent = files.map((_, i) => i);
  const root = (i) => (parent[i] === i ? i : (parent[i] = root(parent[i])));
  for (let i = 0; i < files.length; i++) {
    const a = files[i].vector;
    if (!a) continue;
    for (let j = i + 1; j < files.length; j++) {
      const b = files[j].vector;
      if (b && similarity(a, b) >= minSimilarity) parent[root(j)] = root(i);
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
