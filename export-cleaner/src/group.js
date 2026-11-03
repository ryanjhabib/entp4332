// Step 4: families by look, across the whole folder. When files were exported
// doesn't split them: a re-edit months later joins the same family.

import { similarity } from './embed.js';

// Matching file names nudge two files closer, never decide on their own:
// unrelated images score around 0.2–0.5, far below any threshold.
const NAME_BONUS = 0.05;

// Photo metadata (see metadata.js). The same original photo (Lightroom's ID)
// decides on its own: those files are exports of one original, however
// differently cropped or graded. The same capture moment on the same camera
// is a strong nudge, but the looks still count: such a pair has to look at
// least 0.5 alike to join at the default 80%.
const SAME_MOMENT_BONUS = 0.3;

const sameOriginal = (a, b) => Boolean(a.shot?.original && a.shot.original === b.shot?.original);
const sameMoment = (a, b) => Boolean(a.shot && a.shot.moment === b.shot?.moment);

// And when the metadata says they're different photos (different originals,
// shot at different moments), only near-identical frames still group: two
// dune photos 8 minutes apart looked 0.82 alike, two frames of one building
// 2 seconds apart 0.92.
const DIFFERENT_PHOTOS_PENALTY = 0.08;
const differentPhotos = (a, b) =>
  Boolean(a.shot?.original && b.shot?.original && !sameOriginal(a, b) && !sameMoment(a, b));

// The score a same-original link gets: above any looks-based score, so it's made first.
const SAME_ORIGINAL = 2;

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

// A file with at least this many words (a PDF's text, or an image's by OCR)
// is judged by its text: at thumbnail size the image model can't read, so text
// pages from one template all look alike. A photo poster's headline is too
// few words, so posters are still judged by their looks.
const MIN_WORDS = 20;

const hasText = (entry) => (entry.words?.size ?? 0) >= MIN_WORDS;

// How alike two files are. Two files with text: the words they share (the same
// text in a new layout scores high, a different text in the same template low).
// Anything else: how alike they look, nudged by any short text they carry.
function fileSimilarity(a, b) {
  if (hasText(a) && hasText(b)) return sharedWords(a.words, b.words);
  return lookAlike(a.vectors, b.vectors) + phraseNudge(a.words, b.words);
}

// Short text (type posters, captions, a phone mock-up's words) is too little
// for the full word comparison but distinctive enough to count: four identical
// words on two zooms of one print are near-proof they're the same piece.
const PHRASE_MATCH = 0.25; // most of the shorter text is in the other
const PHRASE_CLASH = 0.15; // both carry words, and not one matches

// Words that say nothing about which piece it is.
const FILLER = new Set([
  'the', 'and', 'you', 'your', 'are', 'that', 'this', 'for', 'with', 'from', 'was', 'were', 'but', 'not', 'all',
  'any', 'can', 'has', 'have', 'had', 'our', 'his', 'her', 'its', 'they', 'them', 'their', 'who', 'what', 'when',
  'how', 'why', 'will', 'would', 'there', 'here', 'into', 'out', 'more', 'most', 'some', 'than', 'then', 'also',
  'just', 'only', 'very', 'about', 'over', 'she', 'him',
]);

// Filler and junk readings ("uuu": OCR finding letters in texture) left out.
const keyWords = (words) => [...(words ?? [])].filter((word) => !FILLER.has(word) && !/(.)\1\1/.test(word));

// A word matches another it begins (OCR runs words together: "let me" → "letm")
// or one sharing its first four letters (a crop or misread changes the end:
// "eterr" for "eternity").
const wordsMatch = (a, b) =>
  a.startsWith(b) || b.startsWith(a) || (a.length >= 4 && b.length >= 4 && a.slice(0, 4) === b.slice(0, 4));

function phraseNudge(a, b) {
  const [x, y] = [keyWords(a), keyWords(b)];
  if (!x.length || !y.length) return 0;
  const [shorter, longer] = x.length <= y.length ? [x, y] : [y, x];
  const found = shorter.filter((word) => longer.some((other) => wordsMatch(word, other))).length;
  if (!found) return shorter.length + longer.length >= 4 ? -PHRASE_CLASH : 0;
  // A couple of words inside a much longer text could match by chance.
  const comparable = longer.length <= 3 * shorter.length + 3;
  return shorter.length >= 2 && found / shorter.length >= 0.8 && comparable ? PHRASE_MATCH : 0;
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

// How much of the shorter text is in the longer one (0–1), so one slide
// scores high against the whole deck it came from.
function sharedWords(a, b) {
  const [shorter, longer] = a.size <= b.size ? [a, b] : [b, a];
  let shared = 0;
  for (const word of shorter) if (longer.has(word)) shared += 1;
  return shared / shorter.size;
}

// Two files are in the same family when they're exports of the same original
// photo, or when their similarity (plus NAME_BONUS if their names share a
// stem, SAME_MOMENT_BONUS if they were shot at the same moment on the same
// camera) is at least minSimilarity. Chains count too (A
// looks like B, B looks like C, so A, B and C are one family), which keeps a
// run of small edits together. The strongest links are made first, and a
// link is skipped if it would put two files whose words say they're different
// documents in one family (an image that looks like several decks made from
// one template joins the one it matches best).
// Files with nothing to compare (no preview) stay on their own.
// Returns families as arrays of files, each by colour (see orderByColour), ordered by look (see orderByLook).
export function groupFiles(files, { minSimilarity }) {
  const stems = files.map((entry) => nameStem(entry.name));
  const links = [];
  for (let i = 0; i < files.length; i++) {
    if (!files[i].vectors?.length) continue;
    for (let j = i + 1; j < files.length; j++) {
      if (!files[j].vectors?.length) continue;
      const bonus =
        (stems[i] && stems[i] === stems[j] ? NAME_BONUS : 0) +
        (sameMoment(files[i], files[j]) ? SAME_MOMENT_BONUS : 0) -
        (differentPhotos(files[i], files[j]) ? DIFFERENT_PHOTOS_PENALTY : 0);
      const score = sameOriginal(files[i], files[j]) ? SAME_ORIGINAL : fileSimilarity(files[i], files[j]) + bonus;
      if (score >= minSimilarity) links.push({ i, j, score });
    }
  }
  links.sort((a, b) => b.score - a.score);

  // Union-find: each file points towards its family's representative, which
  // also keeps all the family's words together. Two families are different
  // documents when their words mostly don't overlap; comparing whole families
  // (not file by file) lets slides 2 and 3, which share few words, both join
  // the deck that contains them.
  const parent = files.map((_, i) => i);
  const texts = files.map((entry) => (hasText(entry) ? new Set(entry.words) : null));
  const root = (i) => (parent[i] === i ? i : (parent[i] = root(parent[i])));
  const differentDocuments = (x, y) => texts[x] && texts[y] && sharedWords(texts[x], texts[y]) < minSimilarity;
  for (const { i, j } of links) {
    const [x, y] = [root(i), root(j)];
    if (x === y || differentDocuments(x, y)) continue;
    parent[y] = x;
    if (texts[y]) texts[x] = texts[x] ? new Set([...texts[x], ...texts[y]]) : texts[y];
  }

  // Files are already oldest first, so families come out in order of their oldest file.
  const families = new Map();
  files.forEach((entry, i) => {
    const key = root(i);
    if (!families.has(key)) families.set(key, []);
    families.get(key).push(entry);
  });
  return orderByLook([...families.values()].map(orderByColour));
}

// Below this chroma a version is black and white (they measure 0–0.2, colour
// photos 26 and up); below this shadows grey it has true blacks (dark graphics
// measure 22, everything else tested 59 and up). See readColour in describe.js.
const GREY_CHROMA = 6;
const BLACK_SHADOWS = 40;

// A family's versions grouped by colour (black and white or colour, with true
// blacks or without), so a black and white edit sits beside the other black and
// white edits. Groups come in order of their oldest version, each oldest first.
export function orderByColour(family) {
  const sets = new Map();
  for (const entry of family) {
    const key = entry.tone ? `${entry.tone.chroma < GREY_CHROMA} ${entry.tone.shadows < BLACK_SHADOWS}` : '';
    if (!sets.has(key)) sets.set(key, []);
    sets.get(key).push(entry);
  }
  return [...sets.values()].flat();
}

// How much colour counts when ordering families: a weak tie-breaker after looks.
const COLOUR_WEIGHT = 0.15;

// Orders the overview so similar families sit side by side: start with the
// oldest family, then keep stepping to the most alike family not yet placed.
// Families with nothing to compare (unreadable files) go last.
function orderByLook(families) {
  const placed = [];
  const left = families.map(summarise).filter((summary) => summary.look);
  let current = left.shift();
  while (current) {
    placed.push(current.family);
    let nearest = 0;
    for (let k = 1; k < left.length; k++) if (difference(current, left[k]) < difference(current, left[nearest])) nearest = k;
    current = left.splice(nearest, 1)[0];
  }
  return [...placed, ...families.filter((family) => !placed.includes(family))];
}

// A family's average look (all its files' vectors, scaled to length 1) and average colour.
function summarise(family) {
  const vectors = family.flatMap((entry) => entry.vectors ?? []);
  const colours = family.map((entry) => entry.colour).filter(Boolean);
  if (!vectors.length) return { family, look: null };
  const look = new Float32Array(vectors[0].length);
  for (const vector of vectors) for (let i = 0; i < look.length; i++) look[i] += vector[i];
  const length = Math.hypot(...look);
  for (let i = 0; i < look.length; i++) look[i] /= length;
  const colour = [0, 1, 2].map((c) => colours.reduce((sum, rgb) => sum + rgb[c], 0) / colours.length);
  return { family, look, colour };
}

// 0 = identical; unrelated looks score around 0.7–0.9, colour adds up to 0.15.
function difference(a, b) {
  const colour = Math.hypot(a.colour[0] - b.colour[0], a.colour[1] - b.colour[1], a.colour[2] - b.colour[2]) / (255 * Math.sqrt(3));
  return 1 - similarity(a.look, b.look) + COLOUR_WEIGHT * colour;
}
