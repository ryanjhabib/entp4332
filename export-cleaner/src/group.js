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

// A PDF with at least this many words is judged by its text: at thumbnail
// size the image model can't read, so text pages from one template all look alike.
const MIN_WORDS = 20;

const hasText = (entry) => (entry.words?.size ?? 0) >= MIN_WORDS;

// How alike two files are. Two PDFs with text: the words they share (the same
// text in a new layout scores high, a different text in the same template low).
// Anything else: how alike they look.
function fileSimilarity(a, b) {
  if (hasText(a) && hasText(b)) return sharedWords(a.words, b.words);
  return lookAlike(a.vectors, b.vectors);
}

// One vector each: plain similarity. A PDF's pages against one image: the
// best-matching page (a PNG of slide 3 matches the deck). Two multi-page
// PDFs: how well each one's pages are matched in the other, on average,
// so one shared cover page doesn't make two different decks the same.
function lookAlike(a, b) {
  const best = (vector, pages) => Math.max(...pages.map((page) => similarity(vector, page)));
  if (a.length === 1) return best(a[0], b);
  if (b.length === 1) return best(b[0], a);
  const covered = (pages, others) => pages.reduce((sum, page) => sum + best(page, others), 0) / pages.length;
  return (covered(a, b) + covered(b, a)) / 2;
}

// Words in both / words in either (0–1).
function sharedWords(a, b) {
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return shared / (a.size + b.size - shared);
}

// Two files are in the same family when their similarity (plus NAME_BONUS if
// their names share a stem) is at least minSimilarity. Chains count too (A
// looks like B, B looks like C, so A, B and C are one family), which keeps a
// run of small edits together. The strongest links are made first, and a
// link is skipped if it would put two PDFs whose words say they're different
// documents in one family (a PNG of a slide looks like every deck made from
// that template; it joins the one it matches best).
// Files with nothing to compare (no preview) stay on their own.
// Returns families as arrays of files, each oldest first, ordered by their oldest file.
export function groupFiles(files, { minSimilarity }) {
  const stems = files.map((entry) => nameStem(entry.name));
  const links = [];
  for (let i = 0; i < files.length; i++) {
    if (!files[i].vectors?.length) continue;
    for (let j = i + 1; j < files.length; j++) {
      if (!files[j].vectors?.length) continue;
      const bonus = stems[i] && stems[i] === stems[j] ? NAME_BONUS : 0;
      const score = fileSimilarity(files[i], files[j]) + bonus;
      if (score >= minSimilarity) links.push({ i, j, score });
    }
  }
  links.sort((a, b) => b.score - a.score);

  // Union-find: each file points towards its family's representative, which
  // also keeps the family's PDFs-with-text to check new links against.
  const parent = files.map((_, i) => i);
  const texts = files.map((entry) => (hasText(entry) ? [entry] : []));
  const root = (i) => (parent[i] === i ? i : (parent[i] = root(parent[i])));
  const differentDocuments = (x, y) =>
    texts[x].some((a) => texts[y].some((b) => sharedWords(a.words, b.words) < minSimilarity));
  for (const { i, j } of links) {
    const [x, y] = [root(i), root(j)];
    if (x === y || differentDocuments(x, y)) continue;
    parent[y] = x;
    texts[x].push(...texts[y]);
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
