// The test folders, made fresh in each test (support/browser.js draws them).
// Files are listed oldest first. Similarity numbers are what the real image
// model measured on these pictures (2026-11-05): versions of one picture
// 0.83–0.99 alike, different pictures 0.65 at most.

const version = (name, scene, variant = {}) => ({ name, scene, ...variant });

// Sets: versions of one picture.
export const sunset = [
  version('sunset.png', 'sunset'),
  version('sunset-crop.jpg', 'sunset', { crop: 0.85, format: 'jpeg' }),
  version('sunset-bw.png', 'sunset', { filter: 'grayscale(1)' }), // newest: Sort starts on it
];
export const ocean = [version('ocean.png', 'ocean'), version('ocean-4x5.png', 'ocean', { shape: '4:5' })];
export const city = [version('city.png', 'city'), version('city-crop.jpg', 'city', { crop: 0.85, format: 'jpeg' })];

// Solos: pictures with nothing like them in the folder.
export const flowers = version('flowers.png', 'flowers');
export const space = version('space.webp', 'space', { format: 'webp' });
export const paper = version('paper.png', 'paper'); // pale, close to the page grey
export const broken = { name: 'broken.png', broken: true }; // not a picture: "No preview"
export const pdf = { name: 'poster.pdf', pdf: 'Spring market poster' };

// Files the app must ignore: not design files, hidden, or in a subfolder.
export const skipped = [
  { name: 'notes.txt', text: 'Client notes, not a design file.' },
  { name: '.DS_Store', text: 'Finder settings' },
  { dir: 'old', files: [version('forest.png', 'forest')] },
];

// 7 versions in 3 sets, 5 solos, 3 files to skip: 12 design files.
export const mixed = [...sunset, ...ocean, ...city, flowers, space, paper, pdf, broken, ...skipped];

// The small folder for Sort: a set of 3, a set of 2 and one solo.
export const small = [...sunset, ...ocean, flowers];

// A tight crop (half the picture) scores 0.83 against the other sunsets:
// in the set at Balanced (80%), on its own at Strict (88%). The negative
// scores 0.77: in the set only at Loose (75%).
export const levels = [
  ...sunset,
  version('sunset-tight.png', 'sunset', { crop: 0.5 }),
  version('sunset-negative.png', 'sunset', { filter: 'invert(1)' }),
  ...ocean,
];

// One picture exported 14 ways: Sort must keep both versions on screen.
export const fourteen = Array.from({ length: 14 }, (_, i) =>
  version(`forest-${String(i + 1).padStart(2, '0')}.png`, 'forest', {
    crop: 1 - (i % 5) * 0.04,
    filter: ['none', 'brightness(1.1)', 'contrast(1.15)', 'saturate(1.4)', 'sepia(0.25)', 'brightness(0.9)', 'hue-rotate(12deg)'][i % 7],
  }),
);
