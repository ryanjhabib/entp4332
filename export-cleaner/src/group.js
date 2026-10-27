// Step 4: sessions by export time, then families by look within each session.

import { distance } from './hash.js';

// Splits files (already sorted oldest first) into export sessions: a new
// session starts whenever the gap since the previous file is longer than
// gapMinutes. Returns [{ files, families }], families filled in below.
export function groupFiles(files, { gapMinutes, maxDistance }) {
  const sessions = [];
  let previous = -Infinity;
  for (const entry of files) {
    const time = entry.file.lastModified;
    if (time - previous > gapMinutes * 60_000) sessions.push({ files: [] });
    sessions.at(-1).files.push(entry);
    previous = time;
  }
  for (const session of sessions) session.families = findFamilies(session.files, maxDistance);
  return sessions;
}

// Two files are in the same family when their hashes differ by at most
// maxDistance bits. Chains count too (A looks like B, B looks like C, so
// A, B and C are one family), which keeps a run of small edits together.
// Files with no hash (no preview) stay on their own.
function findFamilies(files, maxDistance) {
  // Union-find: each file points towards its family's representative.
  const parent = files.map((_, i) => i);
  const root = (i) => (parent[i] === i ? i : (parent[i] = root(parent[i])));
  for (let i = 0; i < files.length; i++) {
    for (let j = i + 1; j < files.length; j++) {
      const a = files[i].hash;
      const b = files[j].hash;
      if (a != null && b != null && distance(a, b) <= maxDistance) parent[root(j)] = root(i);
    }
  }
  // Collect by representative; families come out in order of their oldest file.
  const families = new Map();
  files.forEach((entry, i) => {
    const key = root(i);
    if (!families.has(key)) families.set(key, []);
    families.get(key).push(entry);
  });
  return [...families.values()];
}
