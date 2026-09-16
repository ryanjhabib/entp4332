/* Font Specimen — everything runs client-side. No font data leaves the page. */

const WATERFALL_SIZES = [128, 96, 72, 48, 36, 24, 16, 12];

// Rendering every glyph of a large CJK font locks the page up. Cap it and say so.
const GLYPH_LIMIT = 1500;

/* Each weight is registered as its own family, so several can be live at once
   and a section can point at whichever it likes. The CSS never names one
   directly — it reads --face, which is set here. */
const FAMILY = "SpecimenFont";
const faces = new Map(); // key -> { family, face, buffer, format }

function faceFamily(key) {
  return `${FAMILY}_${key}`;
}

async function registerFace(key, buffer, format) {
  if (faces.has(key)) return faces.get(key);

  const family = faceFamily(key);
  const face = new FontFace(family, buffer);
  await face.load(); // registers nothing until it resolves
  document.fonts.add(face);

  const entry = { family, face, buffer, format };
  faces.set(key, entry);
  return entry;
}

function clearFaces() {
  for (const { face } of faces.values()) document.fonts.delete(face);
  faces.clear();
}

/* Which face each surface is set in. Sections inherit the base until they are
   given one of their own. */
function useFace(target, family) {
  target.style.setProperty("--face", `"${family}"`);
}

/* Test strings. Deliberately short — at 128px a line much past ~16 characters
   wraps on a normal desktop, which spoils the largest step. Between them they
   exercise ascenders, descenders, ampersands, apostrophes and the awkward
   letters (Q, J, Z, W, X, K). */
const PHRASES = [
  "Eggs & Potatoes",
  "Quills & Ink",
  "Mead & Vespers",
  "Ye Olde Fox",
  "Baron's Turnips",
  "Vexed Knights",
  "Blacksmith's Jig",
  "Hogs & Vellum",
  "Plump Pheasants",
  "A Wretched Feast",
  "Crypts & Quails",
  "Frogs in the Moat",
  "Quigley's Zephyr",
  "Brazen Squid",
  "The Alchemist",
  "Minstrels & Mud",
  "Bewitched Turnip",
  "Plums for Abbot",
  "Gravy & Woe",
  "Jousting at Dawn",
  "Pickled Herring",
  "Wizard's Laundry",
  "Oxen & Quiet",
  "Bread & Cheese",
  "A Jug of Mead",
  "Cobbler's Lament",
  "Squires & Omens",
  "Buzzards Aloft",
  "Velvet & Mud",
  "Quartz & Flax",
  "Knaves at Dusk",
  "Pottage & Grumbles",
  "The Jester Wept",
  "Wolves & Orchard",
  // Further afield: high fantasy, same length discipline.
  "Crystal Vigil",
  "Moonlit Ruin",
  "Ashen Spire",
  "The Sundering",
  "Emberfall",
  "Shivering Vale",
  "Glass Daggers",
  "Wyrmtongue",
  "Gilded Wyrm",
  "Salt & Sorcery",
  "Runes of Vaal",
  "The Black Gate",
  "Hollow Crown",
  "Aether Drift",
  "Summoner's Rest",
  "Starmetal Shard",
  "Obsidian Oath",
  "Lichgate",
  "Velvet Grimoire",
  "Twin Moons Rise",
  "Arcane Bazaar",
  "Duskwarden",
  "Cinder & Psalm",
  "The Pale Wyrd",
  "Ghostlight Ford",
  "Glimmerwood",
  "Oath of Ash",
  "Wraithcandle",
  "Vault of Echoes",
  "Riftglass",
  "Bone & Beacon",
  "Silver Ley Line",
  // Darker fantasy: ruined kingdoms and late oaths rather than taverns.
  "Ash & Covenant",
  "The Dying Flame",
  "Kindle the Dark",
  "A Colossus Sleeps",
  "Forsaken Vigil",
  "The Waning Kings",
  "Sundered Banner",
  "Hollow Bell",
  "Godless Garden",
  "The Gilded Rot",
  "Sworn to No King",
  "Cairn of Names",
  "Where Giants Knelt",
  "The Slow Ruin",
  "Ember & Elegy",
  "Tomb of Verses",
  "A Kingdom Forgets",
  "Ruinlight",
  "The Second Dawn",
  "Faithless Steel",
  "Weight of Crowns",
  "The Unnamed Hour",
  "Nightfall Keep",
  "Of Dust & Oath",
  // Devotional. A specimen is read slowly and closely, which is the one place
  // language like this belongs; it is also the register that puts the most
  // pressure on a face — long ascenders, held vowels, a lot of soft letters.
  "God Is the Light",
  "Nearer Than the Vein",
  "The Beloved Waits",
  "A Heart Polished",
  "Mercy Precedes Wrath",
  "The Longing Itself",
  "Wounded by Nearness",
  "Every Atom Praises",
  "Remembrance & Rain",
  "The Thirsty Return",
  "Be Undone",
  "The Veil Is Thin",
  "He Answers the Cry",
  "Poverty Before God",
  "The Lamp Within",
  "Drunk on His Name",
  "Silence After Prayer",
  "Break & Be Filled",
  "Nothing but His Face",
  "The Reed's Complaint",
  "Ask, and Be Emptied",
  "A Love Without Why",
  // The author's own, kept in their own lowercase.
  "finality",
  "i promise",
  "solar flares",
  "naked knight",
  "blue fireworks",
  "swollen palms",
  "cross my heart",
  "fasabrun jameel",
  "a thousand tears",
  "mercy stays warm",
  "beauty as evidence",
  "illuminate our souls",
  "benevolence",
  "burnt sienna",
  "mother and father",
  "brother and sister",
  "you deserve nothing",
  "you > helvetica",
  "If I was you",
  "Everything",
  "Admit",
  "Nude",
  "Longing",
  "Oxygen",
  "Please",
  "Daybreak",
  "Eggnog",
  "Oatmeal",
  "Sweden",
  "Handsome",
  "Nights end",
  "Half-light",
  "Kirameku",
  "Let's play Minecraft",
  "Swimming in Ikea",
  "Backroom",
  "Squire",
];

/* Full lines rather than labels. Too long for the waterfall — past about
   sixteen characters the 128px step wraps and stops being a size specimen —
   so these are drawn only by the page, which is centred and has the measure
   for them. The author's own lines are kept in their own lowercase. */
const LINES = [
  "how many more acts will you leave behind before your written departure",
  "there is a universe of weariness in my parents eyes",
  "let's be each other's heroes",
  "an irreverence for love",
  "grant me your eyes to hold",
  "our planet migrates tomorrow",
  "god spilled a bit of his light on us",
  "i'm not so much a fighter",
  "awaiting my wedding with eternity",
  "experience raw emotion",
  "sorting all my promises",
  "How many favours of your lord will you deny",
  "to see the next part of the dream",
  "my heart tore on the tennis courts",
  "the power lines are my pyramids",
  "laying my sword on destiny’s palms",
  "he is nearer to you than your own jugular vein",
  "the heart was made to be broken open, not kept",
  "i asked for the world and was given the one who made it",
  "all this longing was only ever his invitation",
  "what you call absence is the veil of too much nearness",
  "every atom of the earth is already praising him",
  "mercy arrived before the reckoning and stayed",
  "to be emptied of yourself is the only wealth",
  "the reed cries because it remembers the reedbed",
  "love has no why, and that is how you know it is his",
  "the kingdom remembers nothing of the ones who held it",
  "somewhere a bell is rung for a name no one recalls",
  "they will build nothing on this ground and call it peace",
  "we were told the flame would last and it did not",
  "the colossus lay down and the valley went quiet",
  "every oath here was sworn to something already dead",
];

/* The waterfall lines are edited in place, so the test string lives here rather
   than in any one element. */
let testString = sentenceCase(PHRASES[0]);

/* The two slots in the forms below are grammatical holes: "the steward promised
   ___". Only a noun phrase can fill one. Most of the pool above is not — a good
   number of the phrases are whole clauses ("mercy stays warm"), imperatives
   ("kindle the dark") or statements ("you > helvetica"), and dropping one into
   a slot produces "there was a song about mercy stays warm".

   So the slots draw from their own list. It is a subset of the pool, curated by
   hand for the one thing the forms require, and the waterfall and the page go
   on drawing from everything. A phrase that reads well alone and a phrase that
   reads well inside a sentence are different jobs, and most of these only do
   the first. */
const SLOT_PHRASES = [
  "Eggs & Potatoes", "Quills & Ink", "Mead & Vespers", "Ye Olde Fox",
  "Baron's Turnips", "Vexed Knights", "Blacksmith's Jig", "Hogs & Vellum",
  "Plump Pheasants", "A Wretched Feast", "Crypts & Quails", "Frogs in the Moat",
  "Quigley's Zephyr", "Brazen Squid", "The Alchemist", "Minstrels & Mud",
  "Bewitched Turnip", "Plums for Abbot", "Gravy & Woe", "Jousting at Dawn",
  "Pickled Herring", "Wizard's Laundry", "Oxen & Quiet", "Bread & Cheese",
  "A Jug of Mead", "Cobbler's Lament", "Squires & Omens", "Buzzards Aloft",
  "Velvet & Mud", "Quartz & Flax", "Knaves at Dusk", "Pottage & Grumbles",
  "Wolves & Orchard",
  "Crystal Vigil", "Moonlit Ruin", "Ashen Spire", "The Sundering", "Emberfall",
  "Shivering Vale", "Glass Daggers", "Wyrmtongue", "Gilded Wyrm",
  "Salt & Sorcery", "Runes of Vaal", "The Black Gate", "Hollow Crown",
  "Aether Drift", "Summoner's Rest", "Starmetal Shard", "Obsidian Oath",
  "Lichgate", "Velvet Grimoire", "Arcane Bazaar", "Duskwarden",
  "Cinder & Psalm", "The Pale Wyrd", "Ghostlight Ford", "Glimmerwood",
  "Oath of Ash", "Wraithcandle", "Vault of Echoes", "Riftglass",
  "Bone & Beacon", "Silver Ley Line",
  "Ash & Covenant", "The Dying Flame", "Forsaken Vigil", "The Waning Kings",
  "Sundered Banner", "Hollow Bell", "Godless Garden", "The Gilded Rot",
  "Cairn of Names", "The Slow Ruin", "Ember & Elegy", "Tomb of Verses",
  "Ruinlight", "The Second Dawn", "Faithless Steel", "Weight of Crowns",
  "The Unnamed Hour", "Nightfall Keep",
  "The Beloved Waits", "A Heart Polished", "The Longing Itself",
  "The Thirsty Return", "The Lamp Within", "Silence After Prayer",
  "The Reed's Complaint", "A Love Without Why", "Poverty Before God",
  "Remembrance & Rain",
  "solar flares", "naked knight", "blue fireworks", "swollen palms",
  "a thousand tears", "burnt sienna", "benevolence", "finality",
  "mother and father", "brother and sister",
  "Everything", "Longing", "Oxygen", "Daybreak", "Eggnog", "Oatmeal",
  "Sweden", "Nights end", "Half-light", "Swimming in Ikea",
];

/* Paragraph specimens need running prose, not a label. These forms take two
   phrases from the pool above, so the paragraphs keep the same old-world voice
   as the waterfall rather than reading as lorem ipsum. */
const SENTENCE_FORMS = [
  "The steward promised {a}, and by Michaelmas the cellar held nothing but {b}.",
  "No one at the long table spoke of {a}, least of all the man who had traded it for {b}.",
  "They carried {a} over the frozen ford at dawn and left {b} for whoever came after.",
  "It was written, in a hand nobody could read, that {a} must never be set beside {b}.",
  "The abbot weighed {a} against {b} and found the scales no help at all.",
  "Three hard winters of {a} taught the village more than any sermon on {b}.",
  "Under the wet thatch they argued about {a} until somebody mentioned {b}.",
  "Whatever the ledger claimed of {a}, the storeroom offered only {b}.",
  "A boy was sent nine miles for {a} and came back at nightfall with {b}.",
  "The miller would not say where {a} had gone, nor why {b} had taken its place.",
  "Good {a} keeps. {b} does not.",
  "Then came {b}, and nobody laughed.",
  "By the second bell the question was no longer {a} but {b}, which was worse.",
  "In the margin someone had drawn {a} being chased by {b}, and dated it wrongly.",
  "The bridge toll was {a} on weekdays and {b} on feast days, which explains the feast days.",
  "Ask the ferryman about {a} and he will tell you, at considerable length, about {b}.",
  "Half the parish swore by {a}; the other half swore at {b}.",
  "What the inventory called {a} the cook called {b}, and the cook was right.",
  "It rained for nine days. On the tenth there was {a}, and on the eleventh, {b}.",
  "Nobody has satisfactorily explained why {a} outlasted {b}, only that it did.",
  "The physician recommended {a} for the humours and {b} for everything else.",
  "Between {a} and {b} there is a difference, and the tanner will explain it whether you ask or not.",
  "They buried the ledger under {a} and told the bishop it was {b}.",
  "The widow kept {a} in a locked chest and {b} in plain sight, which tells you something.",
  "Every spring the river took {a}, and every autumn it gave back {b}, seldom in the same condition.",
  "There is a song about {a}. There is a longer song about {b}, and it is not as good.",
  "He wagered {a} on a horse named after {b} and lost both before compline.",
  "The chronicler devotes four pages to {a} and a single grudging line to {b}.",
  // The same two slots, asked in a graver voice, so a page of prose is not
  // always pitched at turnips.
  "The pilgrim asked for {a} and was given {b}, which was the answer.",
  "Between {a} and the one who made it there is only {b}, and not much of that.",
  "They say the heart is polished by {a}; it is in fact polished by {b}.",
  "What the seeker called {a} the teacher called {b}, and said nothing more for a year.",
  "He prayed for {a}. He was answered with {b}, and understood it much later.",
  "Of {a} the scholars wrote volumes; of {b} they wrote one line and wept.",
  "The kingdom fell to {a} in a single night, and nobody in it spoke of {b} again.",
  "Long after the banners rotted, {a} remained, and {b} did not.",
  "They swore their oaths on {a} and buried them, in the end, with {b}.",
  "Somewhere beneath the ruin lies {a}, and above it, unbothered, {b}.",
  "The old wars were fought over {a}; the new ones are fought over {b}, which is worse.",
  "Grief taught him {a}. Mercy, arriving late, taught him {b}.",
  "Every name is forgotten but one, and it is neither {a} nor {b}.",
  "The lamp burned all night over {a} and went out at the first word of {b}.",
  "You will not find {a} by seeking it, nor {b} by refusing to.",
  "There is a longing in {a} that only {b} has ever answered.",
];

const PARAGRAPH_SENTENCES = 4;

function shuffled(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function paragraphText(sentences = PARAGRAPH_SENTENCES) {
  const forms = shuffled(SENTENCE_FORMS).slice(0, sentences);
  const pool = shuffled(PHRASES);
  return forms
    .map((form, i) =>
      form
        .replace("{a}", pool[(i * 2) % pool.length].toLowerCase())
        .replace("{b}", pool[(i * 2 + 1) % pool.length].toLowerCase())
    )
    .join(" ");
}

/* Drawing at random with replacement repeats far sooner than it feels like it
   should: with a hundred-odd options, seeing the same phrase two shuffles later
   is ordinary chance, and it reads as a broken button. So each pool remembers
   what it has handed out lately and will not repeat inside that window. The
   window is a third of the pool, capped, so a short pool still has somewhere
   left to go. */
const recentPicks = new Map();

function pickFresh(list, key) {
  if (list.length < 2) return list[0];

  const seen = recentPicks.get(key) ?? [];
  const window = Math.min(12, Math.max(1, Math.floor(list.length / 3)));
  const fresh = list.filter((item) => !seen.includes(item));
  const pool = fresh.length ? fresh : list; // exhausted: start the cycle again

  const choice = pool[Math.floor(Math.random() * pool.length)];
  recentPicks.set(key, [...seen, choice].slice(-window));
  return choice;
}

/* Written lowercase, shown sentence capped. The lines are set down in the voice
   they were written in, but a specimen opens on a capital unless the person
   reading it decides otherwise by editing the text. Only the first character is
   touched, so anything already title cased is left alone. */
function sentenceCase(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/* Never hand back the phrase already on screen — a shuffle that appears to do
   nothing reads as a broken button. */
function randomPhrase() {
  return sentenceCase(pickFresh(PHRASES.filter((p) => sentenceCase(p) !== testString.trim()), "waterfall"));
}

function setPhrase(text) {
  testString = text;
  renderWaterfall();
}

/* Open-licence faces served from the same CDN as the libraries. Nothing is
   uploaded — these are downloads, so the page's privacy claim still holds. */
const SAMPLE_CDN = "https://cdn.jsdelivr.net/npm/";

/* Built from the family id and a weight rather than stored per file, so a
   family with nine weights is one entry instead of nine. */
function sampleUrl(sample, weight) {
  return `${SAMPLE_CDN}@fontsource/${sample.id}/files/${sample.id}-latin-${weight}-normal.woff2`;
}

function sampleFile(sample, weight) {
  return `${sample.name.replace(/\s+/g, "")}-${weight}.woff2`;
}

/* Which sample is on screen, if any. A dropped file leaves this null, which is
   what keeps the weight control off for fonts we only have one file of. */
let activeSample = null;
let activeWeight = null;
const SAMPLE_FONTS = [
  { name: "Alegreya", id: "alegreya", weights: [400, 500, 600, 700, 800, 900], weight: 400 },
  { name: "Archivo", id: "archivo", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], weight: 600 },
  { name: "Arimo", id: "arimo", weights: [400, 500, 600, 700], weight: 400 },
  { name: "Bodoni Moda", id: "bodoni-moda", weights: [400, 500, 600, 700, 800, 900], weight: 400 },
  { name: "Bricolage Grotesque", id: "bricolage-grotesque", weights: [200, 300, 400, 500, 600, 700, 800], weight: 400 },
  { name: "Cardo", id: "cardo", weights: [400, 700], weight: 400 },
  { name: "Cinzel", id: "cinzel", weights: [400, 500, 600, 700, 800, 900], weight: 400 },
  { name: "Crimson Text", id: "crimson-text", weights: [400, 600, 700], weight: 400 },
  { name: "Eagle Lake", id: "eagle-lake", weights: [400], weight: 400 },
  { name: "EB Garamond", id: "eb-garamond", weights: [400, 500, 600, 700, 800], weight: 400 },
  { name: "Ephesis", id: "ephesis", weights: [400], weight: 400 },
  { name: "Fraunces", id: "fraunces", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], weight: 400 },
  { name: "Fredoka", id: "fredoka", weights: [300, 400, 500, 600, 700], weight: 400 },
  { name: "Fustat", id: "fustat", weights: [200, 300, 400, 500, 600, 700, 800], weight: 400 },
  { name: "Geist", id: "geist", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], weight: 400 },
  { name: "Goudy Bookletter 1911", id: "goudy-bookletter-1911", weights: [400], weight: 400 },
  { name: "Grenze Gotisch", id: "grenze-gotisch", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], weight: 400 },
  { name: "IBM Plex Sans", id: "ibm-plex-sans", weights: [100, 200, 300, 400, 500, 600, 700], weight: 400 },
  { name: "IM Fell English", id: "im-fell-english", weights: [400], weight: 400 },
  { name: "Instrument Sans", id: "instrument-sans", weights: [400, 500, 600, 700], weight: 400 },
  { name: "Instrument Serif", id: "instrument-serif", weights: [400], weight: 400 },
  { name: "Inter", id: "inter", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], weight: 400 },
  { name: "Italianno", id: "italianno", weights: [400], weight: 400 },
  { name: "JetBrains Mono", id: "jetbrains-mono", weights: [100, 200, 300, 400, 500, 600, 700, 800], weight: 400 },
  { name: "Jim Nightshade", id: "jim-nightshade", weights: [400], weight: 400 },
  { name: "Kapakana", id: "kapakana", weights: [300, 400], weight: 400 },
  { name: "League Gothic", id: "league-gothic", weights: [400], weight: 400 },
  { name: "Libre Baskerville", id: "libre-baskerville", weights: [400, 500, 600, 700], weight: 400 },
  { name: "Literata", id: "literata", weights: [200, 300, 400, 500, 600, 700, 800, 900], weight: 400 },
  { name: "Manrope", id: "manrope", weights: [200, 300, 400, 500, 600, 700, 800], weight: 400 },
  { name: "Manufacturing Consent", id: "manufacturing-consent", weights: [400], weight: 400 },
  { name: "Martian Mono", id: "martian-mono", weights: [100, 200, 300, 400, 500, 600, 700, 800], weight: 400 },
  { name: "Michroma", id: "michroma", weights: [400], weight: 400 },
  { name: "Micro 5", id: "micro-5", weights: [400], weight: 400 },
  { name: "Newsreader", id: "newsreader", weights: [200, 300, 400, 500, 600, 700, 800], weight: 400 },
  { name: "Old Standard TT", id: "old-standard-tt", weights: [400, 700], weight: 400 },
  { name: "Oxygen", id: "oxygen", weights: [300, 400, 700], weight: 400 },
  { name: "Pinyon Script", id: "pinyon-script", weights: [400], weight: 400 },
  { name: "Playfair Display", id: "playfair-display", weights: [400, 500, 600, 700, 800, 900], weight: 400 },
  { name: "Poppins", id: "poppins", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], weight: 400 },
  { name: "Public Sans", id: "public-sans", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], weight: 400 },
  { name: "Redaction", id: "redaction", weights: [400, 700], weight: 400 },
  { name: "Schibsted Grotesk", id: "schibsted-grotesk", weights: [400, 500, 600, 700, 800, 900], weight: 400 },
  { name: "Source Serif 4", id: "source-serif-4", weights: [200, 300, 400, 500, 600, 700, 800, 900], weight: 400 },
  { name: "Space Grotesk", id: "space-grotesk", weights: [300, 400, 500, 600, 700], weight: 500 },
  { name: "Spectral", id: "spectral", weights: [200, 300, 400, 500, 600, 700, 800], weight: 400 },
  { name: "Syne", id: "syne", weights: [400, 500, 600, 700, 800], weight: 600 },
  { name: "Tangerine", id: "tangerine", weights: [400, 700], weight: 400 },
  { name: "Unbounded", id: "unbounded", weights: [200, 300, 400, 500, 600, 700, 800, 900], weight: 400 },
  { name: "UnifrakturMaguntia", id: "unifrakturmaguntia", weights: [400], weight: 400 },
  { name: "Work Sans", id: "work-sans", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], weight: 400 },
];

const el = {
  loader: document.getElementById("loader"),
  fileInput: document.getElementById("file-input"),
  toast: document.getElementById("toast"),
  sampleList: document.getElementById("sample-list"),
  fontPreview: document.getElementById("font-preview"),
  bannerSlot: document.getElementById("banner-slot"),
  banner: document.getElementById("drop-banner"),
  specimen: document.getElementById("specimen"),
  intro: document.querySelector(".specimen-intro"),
  fontName: document.getElementById("font-name"),
  fontStyle: document.getElementById("font-style"),
  headerFont: document.getElementById("header-font"),
  home: document.getElementById("home"),
  fontPicker: document.getElementById("font-picker"),
  fontMenu: document.getElementById("font-menu"),
  menuList: document.getElementById("menu-list"),
  infoGrid: document.getElementById("info-grid"),
  waterfall: document.getElementById("waterfall"),
  glyphGrid: document.getElementById("glyph-grid"),
  glyphCount: document.getElementById("glyph-count"),
  glyphNotice: document.getElementById("glyph-notice"),
  glyphToggle: document.getElementById("glyph-toggle"),
  glyphHint: document.getElementById("glyph-hint"),
  viewer: document.getElementById("glyph-viewer"),
  viewerStage: document.getElementById("viewer-stage"),
  viewerMeta: document.getElementById("viewer-meta"),
  viewerPrev: document.getElementById("viewer-prev"),
  viewerNext: document.getElementById("viewer-next"),
  viewerClose: document.getElementById("viewer-close"),
  shuffle: document.getElementById("shuffle"),
  trackingScrub: document.getElementById("tracking-scrub"),
  trackingInput: document.getElementById("tracking-input"),
  paragraphs: document.getElementById("paragraphs"),
  paraTrackingScrub: document.getElementById("para-tracking-scrub"),
  paraTrackingInput: document.getElementById("para-tracking-input"),
  paraLeadingScrub: document.getElementById("para-leading-scrub"),
  paraLeadingInput: document.getElementById("para-leading-input"),
  paraShuffle: document.getElementById("para-shuffle"),
  waterfallSection: document.getElementById("waterfall-section"),
  paragraphsSection: document.getElementById("paragraphs-section"),
  pageSection: document.getElementById("page-section"),
  wfWeight: document.getElementById("wf-weight"),
  paraWeight: document.getElementById("para-weight"),
  pageWeight: document.getElementById("page-weight"),
  page: document.getElementById("page"),
  pageText: document.getElementById("page-text"),
  pageShuffle: document.getElementById("page-shuffle"),
  pageColors: document.getElementById("page-colors"),
  pageSizeScrub: document.getElementById("page-size-scrub"),
  pageSizeInput: document.getElementById("page-size-input"),
  pageLeadingScrub: document.getElementById("page-leading-scrub"),
  pageLeadingInput: document.getElementById("page-leading-input"),
  pageTrackingScrub: document.getElementById("page-tracking-scrub"),
  pageTrackingInput: document.getElementById("page-tracking-input"),
  bannerBrowse: document.getElementById("banner-browse"),
  print: document.getElementById("print"),
};

let baseFamily = null; // the face the hero, information and glyphs are set in

/* -------------------------------------------------------------------------
   Status messages
   ---------------------------------------------------------------------- */
/* Library and browser errors arrive with their own full stops; UI copy here
   carries none, so they are trimmed at the point of interpolation. */
function trimStop(text) {
  return String(text).replace(/\s*\.\s*$/, "");
}

/* A short-lived notice in the top corner. It lives on the body rather than in
   any section, so it reads the same whichever state the page is in, and it is
   only ever used for things that went wrong — a specimen appearing is its own
   confirmation that nothing did. */
const TOAST_MS = 10000;
let toastTimer = null;

function notify(message) {
  clearTimeout(toastTimer);

  if (!message) {
    el.toast.classList.remove("is-visible");
    return;
  }

  el.toast.textContent = message;
  el.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => el.toast.classList.remove("is-visible"), TOAST_MS);
}

/* -------------------------------------------------------------------------
   Format detection — read the file's own signature rather than trusting the
   extension, since a mislabelled file is a common source of confusion.
   ---------------------------------------------------------------------- */
function detectFormat(buffer) {
  const bytes = new Uint8Array(buffer, 0, 4);
  const tag = String.fromCharCode(...bytes);
  const numeric = new DataView(buffer).getUint32(0);

  if (tag === "wOF2") return { id: "woff2", label: "WOFF2", css: "woff2" };
  if (tag === "wOFF") return { id: "woff", label: "WOFF", css: "woff" };
  if (tag === "OTTO") return { id: "otf", label: "OpenType (CFF outlines)", css: "opentype" };
  if (tag === "ttcf") return { id: "ttc", label: "TrueType Collection", css: "truetype" };
  if (numeric === 0x00010000 || tag === "true") {
    return { id: "ttf", label: "TrueType", css: "truetype" };
  }
  return null;
}

/* -------------------------------------------------------------------------
   Load pipeline
   ---------------------------------------------------------------------- */
/* Nothing on screen is disturbed until the new font is known to be good. Every
   check below returns before anything is torn down, so dropping a .mov onto a
   specimen you are reading leaves that specimen exactly where it was and says
   so in the corner. */
async function handleFile(file, source = null) {
  let buffer;
  try {
    buffer = await file.arrayBuffer();
  } catch (err) {
    return notify("That file could not be read");
  }

  if (buffer.byteLength < 4) {
    return notify("That file is empty");
  }

  const format = detectFormat(buffer);
  if (!format) {
    return notify("Only .ttf, .otf, .woff and .woff2 files");
  }

  /* Loaded before the old face is touched. `new FontFace()` does not register
     anything, so until it resolves the page is still rendering the font that
     was already there — and if it throws, it still is. */
  const key = source ? source.weight : "file";
  let probe;
  try {
    probe = new FontFace(faceFamily(key), buffer);
    await probe.load();
  } catch (err) {
    return notify("That font could not be rendered");
  }

  // Past this point the new font is good, so the old ones can go.
  resetSpecimen();
  clearFaces();
  faces.set(key, { family: faceFamily(key), face: probe, buffer, format });
  document.fonts.add(probe);
  await document.fonts.ready; // canvas cannot measure the face until it is live
  baseFamily = faceFamily(key);
  useFace(el.specimen, baseFamily);

  // Parsing can fail independently of rendering — the specimen still shows.
  const parsed = await parseFont(buffer, format);

  el.specimen.hidden = false;
  document.body.classList.add("has-font");
  // The preview slot is about to be hidden. Rest it now: a click on a sample
  // pill hides the pill under the cursor, and an element removed from under
  // the pointer does not reliably fire mouseleave, so the state it was left in
  // would still be there the next time the slot is shown.
  restPreview();
  if (source) {
    activeSample = source.sample;
    activeWeight = source.weight;
  }
  placeBanner();
  const names = fontNames(file, parsed.font);
  renderTitle(names);
  renderInfo(file, format, parsed, names);
  setPhrase(randomPhrase()); // a fresh phrase per font, and it renders the waterfall
  renderParagraphs();
  renderPage(PAGE_OPENING_SHAPES);
  randomColourPair();
  closeFontMenu();
  renderGlyphs(parsed);
  sectionWeights.clear();
  syncSectionWeights();
}

/* opentype.js cannot read woff2's Brotli-compressed tables. We decompress to
   raw sfnt first with wawoff2 (Google's woff2 decoder compiled to wasm), and
   fall back to render-only if that library fails to load. */
async function parseFont(buffer, format) {
  let sfnt = buffer;
  let note = null;

  if (format.id === "woff2") {
    try {
      sfnt = await decompressWoff2(buffer);
    } catch (err) {
      return {
        font: null,
        note: "Glyph data for WOFF2 could not be decompressed in this browser, so the information and glyph sections are unavailable — the specimen above still renders correctly. For the full breakdown, try a .ttf, .otf or .woff copy of the font",
      };
    }
  }

  try {
    const font = opentype.parse(sfnt);
    return { font, note };
  } catch (err) {
    return {
      font: null,
      note: `Glyph data could not be parsed (${trimStop(err.message)}) — the specimen above still renders correctly`,
    };
  }
}

let woff2Ready = null;
function decompressWoff2(buffer) {
  if (!woff2Ready) {
    woff2Ready = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/wawoff2@2.0.1/build/decompress_binding.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("wawoff2 failed to load"));
      document.head.appendChild(script);
    });
  }
  return woff2Ready.then(() => runWoff2Decompress(new Uint8Array(buffer)));
}

/* The wawoff2 build attaches straight to window.Module (it is not a factory),
   and its wasm compiles asynchronously after the script's load event — so wait
   for the runtime before calling decompress. */
function whenWoff2RuntimeReady(timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function poll() {
      const mod = window.Module;
      if (mod && mod.calledRun && typeof mod.decompress === "function") return resolve(mod);
      if (Date.now() - start > timeoutMs) return reject(new Error("wawoff2 runtime timed out"));
      setTimeout(poll, 50);
    })();
  });
}

async function runWoff2Decompress(input) {
  const mod = await whenWoff2RuntimeReady();
  // decompress() returns a view backed by the wasm heap; copy it out before
  // anything else can reuse that memory.
  return new Uint8Array(mod.decompress(input)).buffer;
}

/* -------------------------------------------------------------------------
   Render: information
   ---------------------------------------------------------------------- */
function pickName(nameRecord) {
  if (!nameRecord) return null;
  return nameRecord.en || Object.values(nameRecord)[0] || null;
}

/* Markers foundries stamp on unlicensed release builds. They turn up at the
   start, middle or end of a family name and are not part of the name itself. */
const TRIAL_WORDS =
  /\b(trials?|test|testing|demo|beta|preview|evaluation|eval|sample|unlicensed|unregistered)\b/gi;

/* Pulls those markers out of a name, returning the cleaned name and what it
   found. Separators left stranded by the removal are tidied up. */
function extractMarkers(name) {
  const found = [];
  const stripped = name.replace(TRIAL_WORDS, (word) => {
    found.push(word[0].toUpperCase() + word.slice(1).toLowerCase());
    return " ";
  });
  if (!found.length) return { name, markers: [] };

  const cleaned = stripped
    .replace(/[\s_]+/g, " ")
    .replace(/\s*-\s*/g, "-")
    .replace(/^[-\s]+|[-\s]+$/g, "")
    .trim();

  // A name that was nothing but a marker keeps what it had.
  return cleaned ? { name: cleaned, markers: found } : { name, markers: [] };
}

/* The name table is not a reliable source for weight. Manrope's files are all
   called "Manrope ExtraLight" whatever they weigh, so the 400 reads as
   ExtraLight and the 700 leaves "ExtraLight" stuck in the family. OS/2
   usWeightClass is a number the renderer itself uses, and it is right. */
const WEIGHT_NAMES = {
  100: "Thin",
  200: "ExtraLight",
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "SemiBold",
  700: "Bold",
  800: "ExtraBold",
  900: "Black",
};

function weightName(value) {
  if (!value) return null;
  // Nearest standard step, ties going down: Manrope's 200 declares itself 250.
  const steps = Object.keys(WEIGHT_NAMES).map(Number);
  const nearest = steps.reduce((best, step) =>
    Math.abs(step - value) < Math.abs(best - value) ? step : best
  );
  return WEIGHT_NAMES[nearest];
}

/* Weight words only. Width is deliberately absent: "Archivo Narrow" and
   "Roboto Condensed" are family names in their own right, and stripping the
   width would merge them into families they are not. A weight on the end of a
   family name is nearly always an artefact of how the file was built. */
const STYLE_WORDS =
  /^(thin|hairline|extralight|ultralight|light|book|regular|normal|roman|medium|semibold|demibold|demi|bold|extrabold|ultrabold|black|heavy|fat|italic|oblique)$/i;

/* Splitting the name is the whole point of the hero: name ID 1 is only the
   plain family for four-style families. Anything larger pushes the weight into
   it ("Inter SemiBold" with a subfamily of "Regular"), which is what made the
   hero so long. Name IDs 16/17 carry the true family and style when present,
   and when they do not we lift trailing style words off the family ourselves. */
function fontNames(file, font) {
  const fallback = file.name.replace(/\.(ttf|otf|woff2?|ttc)$/i, "");
  if (!font) return { family: fallback, style: "" };

  const names = font.names;
  let family = pickName(names.preferredFamily) || pickName(names.fontFamily) || fallback;
  let style = pickName(names.preferredSubfamily) || pickName(names.fontSubfamily) || "";

  /* Some builds repeat an optical-size token in the name table itself —
     fontsource's Newsreader reports "Newsreader 16pt 16pt" in name IDs 1 and 16
     alike. Only *adjacent* repeats are collapsed, so a family legitimately
     called something like "New York New York" survives. */
  family = family
    .split(/\s+/)
    .filter((word, i, all) => i === 0 || word.toLowerCase() !== all[i - 1].toLowerCase())
    .join(" ");

  // "Trial" and friends belong in the subtext, not in the name.
  const fromFamily = extractMarkers(family);
  const fromStyle = extractMarkers(style);
  family = fromFamily.name;
  style = fromStyle.name;
  const markers = [...new Set([...fromFamily.markers, ...fromStyle.markers])];

  /* Lift a trailing weight word off the family unconditionally. Neither ID1 nor
     ID16 can be trusted here — Manrope calls itself "Manrope ExtraLight" in
     both, at every weight — and the real weight comes from OS/2 below anyway.
     More than one word must survive, so a family actually called "Black" keeps
     its name. */
  {
    const parts = family.split(/\s+/);
    const lifted = [];
    while (parts.length > 1 && STYLE_WORDS.test(parts[parts.length - 1])) {
      lifted.unshift(parts.pop());
    }
    if (lifted.length) {
      family = parts.join(" ");
      style = lifted.join(" ");
    }
  }

  const declared = weightName(font.tables.os2 && font.tables.os2.usWeightClass);
  const label = [declared || style || "Regular", ...markers].join(" · ");
  return { family, style: label, markers, declared };
}

function renderTitle(names) {
  el.fontName.textContent = names.family;
  el.headerFont.textContent = names.family;
  renderStyle(names);
  sizeIntro();
  fitTitle();
}

/* The style line is a button when the family has other weights to show, and
   plain text when it does not — a dropped file is one weight, and a control
   that cannot do anything is worse than no control. */
/* Two pills. The first counts what the family has to offer, the way the glyph
   heading counts glyphs, and carries any trial marking. It does nothing. The
   second is the weight control, and only appears when there is another weight
   to go to. */
function renderStyle(names) {
  const count = activeSample ? activeSample.weights.length : 1;

  const note = document.createElement("span");
  note.className = "style-note";
  note.textContent = [
    `${count} Style${count === 1 ? "" : "s"}`,
    ...names.markers,
  ].join(" · ");

  if (!activeSample || activeSample.weights.length < 2) {
    el.fontStyle.replaceChildren(note);
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "link-button weight-button";
  button.textContent = weightName(activeWeight);
  button.title = `Weight ${activeWeight} — click for the next of ${activeSample.weights.length}`;
  button.addEventListener("click", nextWeight);

  // Control first, label second: the thing you can act on leads the row.
  el.fontStyle.replaceChildren(button, note);
}

/* Fetches a weight if it has not been seen, and hands back its registered
   face. Everything after the first visit to a weight is instant. */
async function faceFor(sample, weight) {
  if (faces.has(weight)) return faces.get(weight);

  const res = await fetch(sampleUrl(sample, weight));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = await res.arrayBuffer();
  return registerFace(weight, buffer, detectFormat(buffer));
}

function stepWeight(list, from) {
  return list[(list.indexOf(from) + 1) % list.length];
}

/* Changing the hero weight swaps the face and redraws only what depends on the
   outlines — the name, the information and the glyphs. It does not reset the
   specimen, so the phrase you chose, the settings you dialled in and where you
   had scrolled to all survive. */
async function nextWeight() {
  if (!activeSample) return;
  const weight = stepWeight(activeSample.weights, activeWeight);

  let entry;
  try {
    entry = await faceFor(activeSample, weight);
  } catch {
    return notify(`Could not fetch ${activeSample.name}`);
  }

  activeWeight = weight;
  baseFamily = entry.family;
  useFace(el.specimen, baseFamily);

  const parsed = await parseFont(entry.buffer, entry.format);
  const shim = { name: sampleFile(activeSample, weight), size: entry.buffer.byteLength };
  const names = fontNames(shim, parsed.font);

  renderTitle(names);
  renderInfo(shim, entry.format, parsed, names);
  renderGlyphs(parsed);
  syncSectionWeights();
}

/* -------------------------------------------------------------------------
   Per-section weights
   ---------------------------------------------------------------------- */
/* A section can be set in a different weight from the hero. Only --face
   changes, so nothing re-renders and nothing moves. */
const WEIGHT_SECTIONS = [
  { key: "waterfall", section: () => el.waterfallSection, button: () => el.wfWeight },
  { key: "paragraphs", section: () => el.paragraphsSection, button: () => el.paraWeight },
  { key: "page", section: () => el.pageSection, button: () => el.pageWeight },
];

const sectionWeights = new Map();

function syncSectionWeights() {
  const list = activeSample ? activeSample.weights : [];
  const offer = list.length > 1;

  for (const { key, section, button } of WEIGHT_SECTIONS) {
    const el_ = button();
    el_.hidden = !offer;
    if (!offer) {
      sectionWeights.delete(key);
      section().style.removeProperty("--face");
      continue;
    }
    /* A section follows the hero until it is set otherwise, so nothing is
       written here — storing the hero's weight on the first sync would pin the
       section to it and it would never follow again. */
    const weight = sectionWeights.has(key) ? sectionWeights.get(key) : activeWeight;
    el_.textContent = weightName(weight);
    const entry = faces.get(weight);
    if (entry) useFace(section(), entry.family);
  }
}

async function nextSectionWeight(key) {
  if (!activeSample) return;
  const entry_ = WEIGHT_SECTIONS.find((s) => s.key === key);
  const weight = stepWeight(activeSample.weights, sectionWeights.get(key) ?? activeWeight);

  let face;
  try {
    face = await faceFor(activeSample, weight);
  } catch {
    return notify(`Could not fetch ${activeSample.name}`);
  }

  sectionWeights.set(key, weight);
  useFace(entry_.section(), face.family);
  entry_.button().textContent = weightName(weight);
}

/* The hero is set as large as it can be without wrapping, up to a ceiling.
   A fixed size cannot do this: "Inter" and "Libre Baskerville Condensed" need
   very different sizes to occupy the same measure. */
const TITLE_MAX = 300;
const TITLE_MIN = 48;
const titleCtx = document.createElement("canvas").getContext("2d");

function fitTitle() {
  const text = el.fontName.textContent;
  const available = el.fontName.clientWidth; // block element: independent of its own font-size
  if (!text || !available) return;

  titleCtx.font = `100px ${baseFamily ? `"${baseFamily}"` : `"${FAMILY}"`}`;
  const widthAt100 = titleCtx.measureText(text).width;
  if (!widthAt100) return;

  const ideal = Math.floor((available / widthAt100) * 100);
  el.fontName.style.fontSize = `${Math.max(TITLE_MIN, Math.min(TITLE_MAX, ideal))}px`;
}

/* How far down the page the intro begins. The viewport half of the sum stays in
   CSS (100svh) so it tracks window height on its own. */
function sizeIntro() {
  const top = el.intro.getBoundingClientRect().top + window.scrollY;
  document.documentElement.style.setProperty("--intro-offset", `${Math.round(top)}px`);
}

window.addEventListener("resize", () => {
  sizeIntro();
  fitTitle();
  clampPageSize(); // a narrower viewport can turn a fitted size into a broken word
  if (hoveredSample) fitPreview(); // the ceiling moves with the viewport
});

function renderInfo(file, format, { font }, names) {
  const rows = [
    ["Family", names.family || "—"],
    ["Style", font ? names.style : "—"],
    ["Glyphs", font ? String(font.numGlyphs) : "—"],
    ["Format", format.label],
    ["Units per em", font ? String(font.unitsPerEm) : "—"],
    ["File", `${file.name} · ${formatBytes(file.size)}`],
  ];

  el.infoGrid.replaceChildren(
    ...rows.flatMap(([label, value]) => {
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = value;
      return [dt, dd];
    })
  );
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/* -------------------------------------------------------------------------
   Render: waterfall
   ---------------------------------------------------------------------- */
function sampleText() {
  return testString;
}

function renderWaterfall() {
  const text = sampleText();
  el.waterfall.replaceChildren(
    ...WATERFALL_SIZES.map((size) => {
      const row = document.createElement("div");
      row.className = "waterfall-row";

      const line = document.createElement("div");
      line.className = "waterfall-line specimen-type";
      line.style.fontSize = `${size}px`;
      line.textContent = text;
      line.contentEditable = "true";
      line.spellcheck = false;
      line.setAttribute("role", "textbox");
      line.setAttribute("aria-label", `Test string at ${size} pixels`);

      const label = document.createElement("span");
      label.className = "waterfall-size";
      label.textContent = `${size}`;

      // Line first, label second — the size sits to the right of the specimen.
      row.append(line, label);
      return row;
    })
  );
}

/* -------------------------------------------------------------------------
   Render: paragraphs
   ---------------------------------------------------------------------- */
/* Two sizes of the same text. The same words in both is deliberate: it isolates
   the size as the only thing that changed, which is the point of setting them
   side by side. */
const PARAGRAPH_SIZES = [16, 28];

function renderParagraphs() {
  const text = paragraphText();

  el.paragraphs.replaceChildren(
    ...PARAGRAPH_SIZES.map((size) => {
      const column = document.createElement("div");
      column.className = "paragraph-column";

      const label = document.createElement("div");
      label.className = "paragraph-size";
      label.textContent = `${size}`;

      const body = document.createElement("p");
      body.className = "paragraph specimen-type";
      body.style.fontSize = `${size}px`;
      body.textContent = text;
      body.contentEditable = "true";
      body.spellcheck = false;
      body.setAttribute("role", "textbox");
      body.setAttribute("aria-label", `Paragraph at ${size} pixels`);

      column.append(label, body);
      return column;
    })
  );
}

/* A page holds fewer sentences than the columns: at 64px four of them would
   run off the bottom of the section. */
const PAGE_SENTENCES = 2;
const PAGE_PARAGRAPH_BLOCKS = [1, 3];  // how many paragraphs a page runs to
const PAGE_PARAGRAPH_RANGE = [2, 5];   // sentences in each of them

function randInt([low, high]) {
  return low + Math.floor(Math.random() * (high - low + 1));
}

/* Draws every form and phrase from one shuffled pool for the whole page, so a
   page of three paragraphs does not repeat a sentence shape across them. */
function pageParagraphs() {
  const forms = shuffled(SENTENCE_FORMS);
  const phrases = shuffled(SLOT_PHRASES);
  let form = 0;
  let phrase = 0;

  return Array.from({ length: randInt(PAGE_PARAGRAPH_BLOCKS) }, () => {
    const sentences = [];
    for (let i = 0; i < randInt(PAGE_PARAGRAPH_RANGE); i++) {
      sentences.push(
        forms[form++ % forms.length]
          .replace("{a}", phrases[phrase++ % phrases.length].toLowerCase())
          .replace("{b}", phrases[phrase++ % phrases.length].toLowerCase())
      );
    }
    return sentences.join(" ");
  });
}

/* Shuffling the page moves between three lengths rather than always handing
   back prose. A single word shows the letterforms, a phrase shows fit and
   rhythm, a paragraph shows colour — three different questions about the same
   face, so each arrives set the way it wants to be read. The controls follow,
   so the preset is a starting point rather than a lock. */
/* Recommended settings by the role the type is playing, in one place so the
   presets are a stated rule rather than scattered numbers.

   The rule is the one type designers already work to. Letterfit is drawn to
   look right at reading sizes, so the larger you set a face the looser that
   fit appears and the more it wants pulling in; the smaller you set it the
   more it wants opening up. Leading runs the other way: display is comfortable
   under a single line's height, body wants half as much again. */
const TEXT_ROLES = {
  display: { tracking: -30, leading: 95 },  // 100px and up
  heading: { tracking: -20, leading: 105 }, // roughly 40 to 100px
  body: { tracking: 0, leading: 150 },      // 14 to 28px, the size it was drawn for
  caption: { tracking: 10, leading: 150 },  // under 14px
};

const PAGE_STYLES = {
  word: { size: 180, centred: true, ...TEXT_ROLES.display },
  phrase: { size: 96, centred: true, ...TEXT_ROLES.heading },
  paragraph: { size: 24, centred: false, ...TEXT_ROLES.body },
};

const PAGE_SHAPES = Object.keys(PAGE_STYLES);

/* A font opens on something centred — a word or a short phrase — rather than
   on a column of prose. Shuffling from there reaches all three. */
const PAGE_OPENING_SHAPES = ["word", "phrase"];

let lastPageShape = null;

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function pageSample(shape) {
  // Running text arrives as one to three paragraphs, each of varying length.
  if (shape === "paragraph") return pageParagraphs();
  // Even odds between a label and a full line, rather than weighting by pool
  // size — there are far more phrases, and the lines would hardly ever appear.
  if (shape === "phrase") {
    const pool = Math.random() < 0.5 ? LINES : PHRASES;
    return sentenceCase(pickFresh(pool, "page-phrase"));
  }

  /* A single word, long enough to be worth looking at and never an ampersand.
     Drawn from the lines as well as the phrases: the lines are where the best
     of them are, and a word set at 180px owes nothing to the sentence it came
     from. Punctuation is trimmed off the ends so a word lifted out of the
     middle of one does not arrive still wearing its comma. */
  const words = [...PHRASES, ...LINES]
    .join(" ")
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ""))
    .filter((w) => /^[A-Za-z]{4,}$/.test(w));
  return sentenceCase(pickFresh(words, "page-word"));
}

/* One word set huge can outrun the page. Measured rather than guessed, the
   same way the hover preview is, so it never breaks mid-word. */
/* The floor the fit will not go under. It used to be 24 — the body preset —
   which meant a face as wide as Michroma still could not get a long word onto
   one line of a phone, and the word broke. Dropping to 16 is a visible shrink,
   but only display faces ever ask for it and only on the narrowest screens,
   and a shrunk line reads better than a word cut in half. */
const PAGE_MIN_SIZE = 16;

/* The ceiling on the size control, well above anything a shuffle will choose —
   the largest preset is the 180px single word. This is headroom for setting a
   size by hand, which is the only way to get near it. */
const PAGE_MAX_SIZE = 600;

function fitPageText(text, ceiling) {
  const width = el.pageText.clientWidth;
  if (!width) return ceiling;

  titleCtx.font = `100px ${baseFamily ? `"${baseFamily}"` : `"${FAMILY}"`}`;

  /* The widest word, measured — not the one with the most characters. They are
     not the same word and the difference is not small: "migrates" and
     "tomorrow" are both eight letters, and at the same size "tomorrow" is 17%
     wider. Picking by character count fitted the page to "migrates" and let
     "tomorrow" run off the end of the line. */
  const widthAt100 = text
    .split(/\s+/)
    .reduce((max, word) => Math.max(max, titleCtx.measureText(word).width), 0);
  if (!widthAt100) return ceiling;

  return Math.max(PAGE_MIN_SIZE, Math.min(ceiling, Math.floor((width / widthAt100) * 100)));
}

function renderPage(from = PAGE_SHAPES) {
  // Never the same shape twice running, or shuffle looks like it did nothing —
  // unless that leaves nothing to choose from.
  const options = from.filter((s) => s !== lastPageShape);
  const shape = pick(options.length ? options : from);
  lastPageShape = shape;

  const style = PAGE_STYLES[shape];
  const sample = pageSample(shape);

  if (Array.isArray(sample)) {
    // Real paragraph breaks, so the page is a page and not one long block.
    el.pageText.replaceChildren(
      ...sample.map((body) => {
        const p = document.createElement("p");
        p.textContent = body;
        return p;
      })
    );
  } else {
    el.pageText.textContent = sample;
  }

  el.page.classList.toggle("is-centred", style.centred);

  pageLeading.set(style.leading);
  pageTracking.set(style.tracking);
  // Measured on the whole text either way; only the longest word matters.
  pageSize.reset(fitPageText(el.pageText.textContent, style.size));

  // Measured again after layout. At render the box can still be zero-width —
  // a first paint, a hidden section — and fitPageText has nothing to divide by,
  // so it hands back the preset ceiling untouched. That is how a 96px phrase
  // reached a phone at 96px and broke "tomorrow" across two lines.
  requestAnimationFrame(clampPageSize);
}

/* Only ever brings the size down, never up, so a size chosen on the scrub
   survives a resize unless holding it would break a word across lines — which
   is the one thing a page of type must not do. Splitting a line is fine. */
function clampPageSize() {
  const text = el.pageText.textContent;
  if (!text) return;

  // A size someone set by hand stands. They can see the result and they asked
  // for it; the clamp is there to stop the automatic fit from breaking words,
  // not to overrule a decision.
  if (pageSize.isByUser()) return;

  const current = pageSize.get();
  const fitted = fitPageText(text, current);
  if (fitted < current) pageSize.set(fitted);
}

/* -------------------------------------------------------------------------
   Render: glyph grid
   ---------------------------------------------------------------------- */
const SVG_NS = "http://www.w3.org/2000/svg";

// Printable ASCII — the set most people actually want to look at.
const BASIC_FIRST = 0x20;
const BASIC_LAST = 0x7e;

let currentFont = null;
let allGlyphs = [];
let basicGlyphs = [];
let shownGlyphs = [];
let showingAll = false;

function glyphLabel(glyph) {
  return glyph.unicode !== undefined
    ? `U+${glyph.unicode.toString(16).toUpperCase().padStart(4, "0")}`
    : glyph.name || `#${glyph.index}`;
}

/* A glyph's outline normalised to a 1000-unit em, so two glyphs can be compared
   regardless of the font's own units. Fonts carry a lot of genuinely identical
   shapes under different codepoints — the same A serving Latin, Greek and
   Cyrillic, or a codepoint aliased to an existing outline. Those are what make
   the grid look so repetitive, and they are safe to collapse. Accented forms
   have different outlines and all survive. */
function outlineKey(glyph, font) {
  const advance = Math.round(((glyph.advanceWidth || 0) * 1000) / font.unitsPerEm);
  return `${glyph.getPath(0, 0, 1000).toPathData(1)}|${advance}`;
}

function buildGlyphSets(font) {
  const seen = new Set();
  const all = [];
  const scanned = Math.min(font.numGlyphs, GLYPH_LIMIT);

  for (let i = 0; i < scanned; i++) {
    const glyph = font.glyphs.get(i);
    const key = outlineKey(glyph, font);
    if (seen.has(key)) continue;
    seen.add(key);
    all.push(glyph);
  }

  const basic = all.filter(
    (g) => g.unicode >= BASIC_FIRST && g.unicode <= BASIC_LAST
  );
  return { all, basic, scanned };
}

function renderGlyphs({ font, note }) {
  currentFont = font;
  el.glyphNotice.hidden = !note;
  el.glyphNotice.textContent = note || "";

  if (!font) {
    allGlyphs = basicGlyphs = shownGlyphs = [];
    el.glyphCount.textContent = "";
    el.glyphGrid.replaceChildren();
    el.glyphToggle.hidden = true;
    el.glyphHint.hidden = true;
    return;
  }

  const { all, basic, scanned } = buildGlyphSets(font);
  allGlyphs = all;
  basicGlyphs = basic.length ? basic : all;
  showingAll = false;
  paintGlyphs();

  const duplicates = scanned - all.length;
  const parts = [];
  if (duplicates > 0) {
    parts.push(`${duplicates} glyph${duplicates === 1 ? "" : "s"} repeated an outline already shown and ${duplicates === 1 ? "was" : "were"} collapsed`);
  }
  if (scanned < font.numGlyphs) {
    parts.push(`This font has ${font.numGlyphs} glyphs; the first ${scanned} were scanned to keep the page responsive`);
  }
  if (parts.length && !note) {
    el.glyphNotice.hidden = false;
    el.glyphNotice.textContent = parts.join(" · ");
  }
}

function paintGlyphs() {
  shownGlyphs = showingAll ? allGlyphs : basicGlyphs;
  el.glyphGrid.replaceChildren(
    ...shownGlyphs.map((glyph, i) => glyphCell(glyph, currentFont, i))
  );
  // The only section that keeps a heading, because the count is worth stating.
  el.glyphCount.textContent =
    shownGlyphs.length === allGlyphs.length
      ? `${shownGlyphs.length} Glyphs`
      : `${shownGlyphs.length} of ${allGlyphs.length} Glyphs`;
  // The row holds nothing but the button now, so it goes when the button does —
  // otherwise it leaves its own margin behind as a gap.
  el.glyphToggle.hidden = allGlyphs.length <= basicGlyphs.length;
  el.glyphHint.hidden = el.glyphToggle.hidden;
  el.glyphToggle.textContent = showingAll
    ? "Show the basic set"
    : `Show all ${allGlyphs.length}`;
}

function glyphCell(glyph, font, i) {
  const cell = document.createElement("button");
  cell.type = "button";
  cell.className = "glyph-cell";
  cell.dataset.index = i;

  const mark = document.createElement("div");
  mark.className = "glyph-mark";
  // Draw the outline directly. This shows glyphs with no Unicode mapping
  // (alternates, ligatures) that plain text could never reach.
  mark.append(glyphSvg(glyph, font));

  const label = document.createElement("div");
  label.className = "glyph-label";
  label.textContent = glyphLabel(glyph);

  cell.append(mark, label);
  cell.title = glyph.name ? `${glyph.name} (#${glyph.index})` : `#${glyph.index}`;
  return cell;
}

/* `centreInk` shifts the drawing so the glyph's own outline is centred rather
   than its em box. The grid leaves it off, because a shared baseline is what
   lets you compare glyphs across cells; the viewer turns it on, because a
   single glyph on screen should sit in the middle of it. The size is unchanged
   either way, so relative proportions still read — a lowercase o stays smaller
   than a capital O. */
function glyphSvg(glyph, font, box = 40, size = 28, centreInk = false) {
  const scale = size / font.unitsPerEm;
  const advance = (glyph.advanceWidth || font.unitsPerEm) * scale;
  let x = (box - advance) / 2;
  let baseline = box / 2 + size / 3;

  let drawn = glyph.getPath(x, baseline, size);

  if (centreInk) {
    const bounds = drawn.getBoundingBox();
    // Blank glyphs (space) have no bounding box to centre on.
    if (bounds.x2 > bounds.x1 && bounds.y2 > bounds.y1) {
      x += box / 2 - (bounds.x1 + bounds.x2) / 2;
      baseline += box / 2 - (bounds.y1 + bounds.y2) / 2;
      drawn = glyph.getPath(x, baseline, size);
    }
  }

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${box} ${box}`);
  svg.setAttribute("aria-hidden", "true");

  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", drawn.toPathData(2));
  svg.append(path);
  return svg;
}

/* -------------------------------------------------------------------------
   Glyph viewer
   ---------------------------------------------------------------------- */
let viewerIndex = -1;
let lastFocused = null;

function openViewer(i) {
  if (!shownGlyphs.length) return;
  lastFocused = document.activeElement;
  viewerIndex = i;
  paintViewer();
  el.viewer.hidden = false;
  document.body.classList.add("is-viewing");
  el.viewerNext.focus();
}

function paintViewer() {
  const glyph = shownGlyphs[viewerIndex];
  if (!glyph) return;
  el.viewerStage.replaceChildren(glyphSvg(glyph, currentFont, 100, 72, true));
  el.viewerMeta.textContent = [
    glyphLabel(glyph),
    glyph.name,
    `${viewerIndex + 1} of ${shownGlyphs.length}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function stepViewer(delta) {
  const count = shownGlyphs.length;
  viewerIndex = (viewerIndex + delta + count) % count; // wraps at both ends
  paintViewer();
}

function closeViewer() {
  el.viewer.hidden = true;
  document.body.classList.remove("is-viewing");
  if (lastFocused) lastFocused.focus();
}

/* -------------------------------------------------------------------------
   Reset
   ---------------------------------------------------------------------- */
function resetSpecimen() {
  el.specimen.hidden = true;
  document.body.classList.remove("has-font");
  placeBanner();
  restPreview(); // never come back to the empty state holding the last hover
  el.fontName.textContent = "";
  el.fontStyle.textContent = "";
  el.headerFont.textContent = "";
  activeSample = null;
  activeWeight = null;
  el.infoGrid.replaceChildren();
  el.waterfall.replaceChildren();
  el.paragraphs.replaceChildren();
  el.pageText.textContent = "";
  el.glyphGrid.replaceChildren();
  el.glyphCount.textContent = "";
  el.glyphNotice.hidden = true;
  el.glyphNotice.textContent = "";
}

/* -------------------------------------------------------------------------
   Sample fonts
   ---------------------------------------------------------------------- */
function sampleItems(fonts) {
  return fonts.map((sample, i) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "link-button";
    button.textContent = sample.name;
    button.addEventListener("click", () => loadSample(sample));
    button.addEventListener("mouseenter", () => showPreview(sample, i));
    button.addEventListener("focus", () => showPreview(sample, i));
    item.append(button);
    return item;
  });
}

/* -------------------------------------------------------------------------
   Hover preview — the name of the font you are pointing at, set in itself
   ---------------------------------------------------------------------- */
const PREVIEW_MAX = 300;
const PREVIEW_MIN = 72;

/* 300px is the ceiling on a roomy desktop, but it is a ceiling, not a fixed
   size: on a smaller window it scales with the viewport so a long name still
   lands on a sensible number of lines rather than being forced to shrink all
   the way down by the height budget alone. */
function previewCeiling() {
  return Math.min(
    PREVIEW_MAX,
    Math.round(window.innerWidth * 0.22),
    Math.round(window.innerHeight * 0.34)
  );
}

const PREVIEW_TOP_GAP = 24; // clearance from the top of the window
const PREVIEW_RESTING = "Explore sample typefaces";

/* Each face is fetched once and kept. The map holds the in-flight promise, not
   the result, so hovering the same pill twice in quick succession does not
   start a second request. */
const previewFaces = new Map();
let hoveredSample = null;
let previewFamily = null;

function previewFace(sample, index) {
  if (!previewFaces.has(sample.name)) {
    const family = `Preview${index}`;
    previewFaces.set(
      sample.name,
      (async () => {
        const res = await fetch(sampleUrl(sample, sample.weight));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const face = new FontFace(family, await res.arrayBuffer());
        await face.load();
        document.fonts.add(face);
        return family;
      })()
    );
  }
  return previewFaces.get(sample.name);
}

async function showPreview(sample, index) {
  hoveredSample = sample.name;
  el.fontPreview.textContent = sample.name;

  let family;
  try {
    family = await previewFace(sample, index);
  } catch {
    restPreview(); // a face that will not load simply does not preview
    return;
  }

  // The pointer may have moved on while that was in flight.
  if (hoveredSample !== sample.name) return;

  // `inherit` is not a valid entry inside a font list — it invalidates the whole
  // declaration, which silently leaves the UI stack in place.
  el.fontPreview.style.fontFamily = `"${family}", sans-serif`;
  previewFamily = family;
  fitPreview();
}

/* As large as it fits in the space above the pills, capped at 300px.

   Measured from the laid-out element rather than calculated from text width: a
   width calculation cannot know where the browser will break, and at 300px
   "Manufacturing" alone is wider than the measure, so it breaks mid-word and
   costs a line the arithmetic says should not exist.

   The test is height against the available space and nothing else. An earlier
   version also required the height to stay under `size * 2.05` to hold it to
   two lines, which quietly broke the search: real line height here is 1.05x the
   font size, so two lines measure 2.1x and *never* passed. Only single-line
   fits survived, and long names came out at half the size they could be. It
   also made the test non-monotonic — true at 149, false at 240, true again
   at 290 — and binary search is only valid on a monotonic predicate. Height
   against a fixed budget rises with size, so the search is sound. */
function fitPreview() {
  const preview = el.fontPreview;
  if (!preview.textContent || !preview.clientWidth) return;

  // Never taller than the space above the pills, which never move. The gap is
  // read back from the stylesheet so the two cannot drift apart.
  const gap = parseFloat(getComputedStyle(preview).marginBottom) || 0;
  const headroom = el.sampleList.getBoundingClientRect().top - gap - PREVIEW_TOP_GAP;
  const maxHeight = Math.max(PREVIEW_MIN, headroom);

  /* A word must never be broken across lines. `overflow-wrap: anywhere` is on
     the element as a last resort, but a name splitting mid-word reads as a
     bug — so the size is capped at whatever keeps the widest word on one line.
     Wide faces like Michroma are constrained by this long before they are
     constrained by height.

     Widest as measured, not longest by character count: the two are different
     words often enough to matter. */
  let high = previewCeiling();
  if (previewFamily) {
    titleCtx.font = `100px "${previewFamily}"`;
    const wordAt100 = preview.textContent
      .split(/\s+/)
      .reduce((max, word) => Math.max(max, titleCtx.measureText(word).width), 0);
    if (wordAt100) {
      high = Math.min(high, Math.floor((preview.clientWidth / wordAt100) * 100));
    }
  }
  high = Math.max(high, PREVIEW_MIN);

  let low = PREVIEW_MIN;
  let best = PREVIEW_MIN;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    preview.style.fontSize = `${mid}px`;
    if (preview.scrollHeight <= maxHeight) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  preview.style.fontSize = `${best}px`;
}

/* The slot is never empty: with nothing hovered it carries its own line of copy
   at the size the stylesheet gives it. Clearing the inline styles is what hands
   it back to the UI font. */
function restPreview() {
  hoveredSample = null;
  previewFamily = null;
  el.fontPreview.textContent = PREVIEW_RESTING;
  el.fontPreview.style.fontFamily = "";
  el.fontPreview.style.fontSize = "";
}

function renderSamples() {
  el.sampleList.replaceChildren(...sampleItems(SAMPLE_FONTS));
  // The same library again, behind the name in the header.
  el.menuList.replaceChildren(...sampleItems(SAMPLE_FONTS));
}

/* -------------------------------------------------------------------------
   Font library menu
   ---------------------------------------------------------------------- */
/* Opened from the name in the header. It closes when the pointer leaves the
   picker rather than the menu alone, so crossing the gap between the button
   and the panel does not dismiss it. */
/* The menu waits after the pointer leaves rather than closing under it, and the
   wait is cancelled if you come back. Long enough to read as deliberate, and to
   cover leaving the picker on the way to somewhere else in it. */
const MENU_GRACE_MS = 3000;
let menuCloseTimer = null;

function openFontMenu() {
  clearTimeout(menuCloseTimer);
  el.fontMenu.classList.add("is-open");
  el.headerFont.setAttribute("aria-expanded", "true");
}

function closeFontMenu() {
  clearTimeout(menuCloseTimer);
  el.fontMenu.classList.remove("is-open");
  el.headerFont.setAttribute("aria-expanded", "false");
}

function toggleFontMenu() {
  if (el.fontMenu.classList.contains("is-open")) closeFontMenu();
  else openFontMenu();
}

/* The banner is part of the centred row on the empty state and a pinned bar
   once a specimen is up. The empty state's row is hidden wholesale, so the
   banner has to actually move between the two rather than be restyled. */
function placeBanner() {
  const target = document.body.classList.contains("has-font")
    ? document.body
    : el.bannerSlot;
  if (el.banner.parentElement !== target) target.append(el.banner);
}

async function loadSample(sample, weight = sample.weight) {
  try {
    const res = await fetch(sampleUrl(sample, weight));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const file = new File([blob], sampleFile(sample, weight), { type: "font/woff2" });
    await handleFile(file, { sample, weight });
  } catch (err) {
    notify(`Could not fetch ${sample.name}`);
  }
}

renderSamples();
restPreview();
placeBanner();

/* -------------------------------------------------------------------------
   Scrub controls
   ---------------------------------------------------------------------- */
/* A label you drag and a field you type into. Three of these exist, so it is
   worth one factory rather than three near-copies. */
const CONTROL_DRAG_STEP = 5; // dragging lands on multiples of 5

function scrubControl({ scrub, input, min, max, initial, apply }) {
  let value = initial;
  let from = null;
  /* Whether the value on screen was chosen by a person or computed for them.
     Anything that fits or clamps a value automatically needs to know, because
     a number someone typed is an instruction and a number we worked out is
     only a default. */
  let byUser = false;

  function set(next) {
    value = Math.max(min, Math.min(max, Math.round(next) || 0));
    scrub.setAttribute("aria-valuenow", String(value));
    // Not while it is being typed into, or the caret jumps.
    if (document.activeElement !== input) input.value = value;
    apply(value);
  }

  /* Pointer capture keeps the drag alive once the cursor leaves the label,
     which it does immediately. */
  scrub.addEventListener("pointerdown", (e) => {
    from = { x: e.clientX, value };
    scrub.setPointerCapture(e.pointerId);
    e.preventDefault(); // otherwise the drag selects page text
  });

  scrub.addEventListener("pointermove", (e) => {
    if (!from) return;
    const raw = from.value + (e.clientX - from.x);
    byUser = true;
    set(Math.round(raw / CONTROL_DRAG_STEP) * CONTROL_DRAG_STEP);
  });

  for (const type of ["pointerup", "pointercancel"]) {
    scrub.addEventListener(type, (e) => {
      from = null;
      if (scrub.hasPointerCapture(e.pointerId)) scrub.releasePointerCapture(e.pointerId);
    });
  }

  // Arrows stay fine-grained: the drag steps in fives, so this is how you land
  // between them without typing.
  scrub.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 10 : 1;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") byUser = true, set(value + step);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") byUser = true, set(value - step);
    else return;
    e.preventDefault();
  });

  // An empty or half-typed field ("-") is left alone rather than rewritten.
  input.addEventListener("input", () => {
    const raw = input.value.trim();
    if (raw === "" || raw === "-") return;
    byUser = true;
    set(Number(raw));
  });
  input.addEventListener("blur", () => { byUser = true; set(Number(input.value)); });

  set(initial);

  /* `reset` is how a render says "this is a fresh default": it sets the value
     and forgets that anyone had chosen one. `set` on its own leaves the flag
     where it was. */
  return {
    set,
    get: () => value,
    isByUser: () => byUser,
    reset: (next) => { byUser = false; set(next); },
  };
}

/* Letter spacing travels as a unitless custom property, never as an `em`
   length on the container. An `em` resolves against the element it is declared
   on and inherits as fixed px, which would hand every line the container's
   10px-derived value instead of scaling with each size. Line height is
   unitless for the same reason, and gets it for free. */
const waterfallTracking = scrubControl({
  scrub: el.trackingScrub,
  input: el.trackingInput,
  min: -200,
  max: 200,
  // The ladder spans 12px to 128px, so it starts where the face was drawn and
  // leaves the tightening to you.
  initial: TEXT_ROLES.body.tracking,
  apply: (v) => el.waterfall.style.setProperty("--tracking", String(v / 1000)),
});

const paragraphTracking = scrubControl({
  scrub: el.paraTrackingScrub,
  input: el.paraTrackingInput,
  min: -100,
  max: 100,
  initial: TEXT_ROLES.body.tracking,
  apply: (v) => el.paragraphs.style.setProperty("--para-tracking", String(v / 1000)),
});

const paragraphLeading = scrubControl({
  scrub: el.paraLeadingScrub,
  input: el.paraLeadingInput,
  min: 80,
  max: 260,
  initial: TEXT_ROLES.body.leading,
  apply: (v) => el.paragraphs.style.setProperty("--para-leading", String(v / 100)),
});

const pageSize = scrubControl({
  scrub: el.pageSizeScrub,
  input: el.pageSizeInput,
  min: 12,
  max: PAGE_MAX_SIZE,
  initial: 64,
  apply: (v) => el.page.style.setProperty("--page-size", `${v}px`),
});

const pageLeading = scrubControl({
  scrub: el.pageLeadingScrub,
  input: el.pageLeadingInput,
  min: 80,
  max: 260,
  initial: TEXT_ROLES.heading.leading,
  apply: (v) => el.page.style.setProperty("--page-leading", String(v / 100)),
});

const pageTracking = scrubControl({
  scrub: el.pageTrackingScrub,
  input: el.pageTrackingInput,
  min: -100,
  max: 100,
  initial: TEXT_ROLES.body.tracking,
  apply: (v) => el.page.style.setProperty("--page-tracking", String(v / 1000)),
});

/* -------------------------------------------------------------------------
   Page colour pairs
   ---------------------------------------------------------------------- */
/* Type behaves differently on a dark ground than a light one — the same weight
   reads heavier reversed out. Cycling pairs is the quickest way to see it. */
/* Every pair clears 4.5:1, so the page stays readable at the paragraph preset's
   24px and not only at display sizes. The vivid ones are interleaved among the
   quiet ones after the blue, rather than grouped, so cycling does not run
   through all the loud ones at once. */
const COLOUR_PAIRS = [
  { fg: "#111111", bg: "#f0f0f0" }, // ink on grey
  { fg: "#ffffff", bg: "#111111" }, // paper on ink
  { fg: "#111111", bg: "#ffffff", opening: false }, // ink on paper
  { fg: "#ffffff", bg: "#4671c4" }, // paper on blue, a shade under the banner to clear 4.5:1
  { fg: "#d9f24a", bg: "#14140f" }, // lime on near-black
  { fg: "#e8f2ea", bg: "#043d2d" }, // pale mint on racing green
  { fg: "#111111", bg: "#ff5fa2" }, // ink on hot pink
  { fg: "#5c1a1a", bg: "#d9e0cf" }, // oxblood on sage
  { fg: "#f9e7ff", bg: "#5b1a8f" }, // lilac on raspberry purple
  { fg: "#06262b", bg: "#22d3ee" }, // deep teal on cyan
  { fg: "#10243a", bg: "#cfe3f5" }, // ink blue on pale sky
  { fg: "#1c1a17", bg: "#f2ece1" }, // ink on cream
  { fg: "#12143a", bg: "#ffd400" }, // navy on vivid yellow
  { fg: "#f5e0c0", bg: "#4a0d1f" }, // pale gold on deep wine
  { fg: "#f4efe4", bg: "#0d1b3e" }, // cream on midnight navy
  { fg: "#0f3a3a", bg: "#e6b8a2" }, // deep teal on terracotta
  { fg: "#111111", bg: "#ff7a00" }, // ink on vibrant orange
  { fg: "#f2f0ff", bg: "#2b1b9c" }, // ice on electric indigo
  { fg: "#3a2718", bg: "#f0dcc0" }, // bark on wheat
  { fg: "#2e1a3a", bg: "#e3e8b0" }, // aubergine on pale chartreuse
  { fg: "#fff1f2", bg: "#c1121f" }, // pale rose on cherry red
  { fg: "#3a63a8", bg: "#f0f0f0" }, // blue on grey
  // Muted: low chroma, close in value, still clear of 4.5:1.
  { fg: "#4a3a30", bg: "#d8cabb" }, // cocoa on putty
  { fg: "#cec5e4", bg: "#2b2733" }, // lavender on slate plum
  { fg: "#4a2c34", bg: "#e0c9cc" }, // mulberry on dusty rose
  // Greens, across the range rather than one more of the same.
  { fg: "#f3f0e3", bg: "#1f3b2c" }, // cream on forest
  { fg: "#eef5e8", bg: "#2f5d34" }, // pale on moss
  { fg: "#86d9a8", bg: "#0a1f16" }, // mint on pine, the green as the ink
  { fg: "#0d2818", bg: "#a8e063" }, // dark green on acid
  { fg: "#14281d", bg: "#b8d8b0" }, // ink green on celadon
  { fg: "#3a4a24", bg: "#e8eed8" }, // olive on pale celadon
  // Ground the set was missing entirely.
  { fg: "#f5ead6", bg: "#3b2a1c" }, // cream on chocolate
  { fg: "#2b2117", bg: "#f0b478" }, // bark on apricot
  { fg: "#fdf6e3", bg: "#7a3b2e" }, // cream on brick
  { fg: "#2a2e45", bg: "#c9c4b4" }, // slate on warm stone
];

let colourPair = 0;

function applyColourPair() {
  const { fg, bg } = COLOUR_PAIRS[colourPair];
  el.page.style.setProperty("--page-fg", fg);
  el.page.style.setProperty("--page-bg", bg);
  // The swatch shows the pair it will produce, split down the middle.
  el.pageColors.style.background = `linear-gradient(90deg, ${bg} 0 50%, ${fg} 50% 100%)`;
}

el.pageColors.addEventListener("click", () => {
  colourPair = (colourPair + 1) % COLOUR_PAIRS.length;
  applyColourPair();
});

/* Each font arrives on a ground it has not just been seen on. Never the pair
   already showing, or loading a font would look like nothing happened — and
   never plain black on white, which is what the page would look like if the
   colour had failed to apply at all. The swatch still reaches it. */
function randomColourPair() {
  const others = COLOUR_PAIRS.map((pair, i) => ({ pair, i })).filter(
    ({ pair, i }) => i !== colourPair && pair.opening !== false
  );
  colourPair = others[Math.floor(Math.random() * others.length)].i;
  applyColourPair();
}

applyColourPair();

/* -------------------------------------------------------------------------
   Events
   ---------------------------------------------------------------------- */
el.home.addEventListener("click", () => {
  resetSpecimen();
  notify("");
  window.scrollTo(0, 0);
});

el.headerFont.addEventListener("click", toggleFontMenu);
el.fontPicker.addEventListener("mouseleave", () => {
  menuCloseTimer = setTimeout(closeFontMenu, MENU_GRACE_MS);
});
el.fontPicker.addEventListener("mouseenter", () => clearTimeout(menuCloseTimer));
el.menuList.addEventListener("click", closeFontMenu);

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && el.fontMenu.classList.contains("is-open")) closeFontMenu();
});

el.bannerBrowse.addEventListener("click", () => el.fileInput.click());

el.fileInput.addEventListener("change", () => {
  const file = el.fileInput.files[0];
  if (file) handleFile(file);
  el.fileInput.value = ""; // allow re-picking the same file
});

/* Drag and drop is handled on the window, not on the drop zone, so a font can
   be dropped anywhere on the page. The browser's default for a dropped file is
   to navigate away from the page, so every one of these must preventDefault —
   dragover included, or the drop event never fires at all. */
let dragDepth = 0; // dragenter/leave also fire when crossing child elements

function endDrag() {
  dragDepth = 0;
  document.body.classList.remove("is-dragging");
}

window.addEventListener("dragenter", (e) => {
  e.preventDefault();
  dragDepth++;
  document.body.classList.add("is-dragging");
});

window.addEventListener("dragover", (e) => e.preventDefault());

window.addEventListener("dragleave", (e) => {
  e.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) document.body.classList.remove("is-dragging");
});

window.addEventListener("drop", (e) => {
  e.preventDefault();
  endDrag();
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

// A drag that leaves the window entirely never fires dragleave on some
// browsers; this catches the stuck-overlay case.
window.addEventListener("dragend", endDrag);
window.addEventListener("blur", endDrag);

/* Editing any line retypes every other line. The edited line is deliberately
   left alone — rewriting its content would collapse the caret to the start on
   every keystroke. */
el.waterfall.addEventListener("input", (e) => {
  const edited = e.target.closest(".waterfall-line");
  if (!edited) return;
  testString = edited.textContent;
  for (const line of el.waterfall.querySelectorAll(".waterfall-line")) {
    if (line !== edited) line.textContent = testString;
  }
});

// Keep the lines to plain single-line text: Enter would insert markup, and a
// paste would carry the source document's formatting in with it.
el.waterfall.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.closest(".waterfall-line")) e.preventDefault();
});

el.waterfall.addEventListener("paste", (e) => {
  if (!e.target.closest(".waterfall-line")) return;
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData("text").replace(/\s+/g, " ");
  document.execCommand("insertText", false, text);
});

el.shuffle.addEventListener("click", () => setPhrase(randomPhrase()));

for (const { key, button } of WEIGHT_SECTIONS) {
  button().addEventListener("click", () => nextSectionWeight(key));
}

/* Both columns carry the same words, so editing one retypes the other. The
   edited element is left alone, or the caret collapses on every keystroke.

   Copied as cloned nodes rather than as textContent, which would flatten a
   line break into a space and leave the mirror column a line short. Cloning
   also avoids parsing markup back out of a string. */
function syncParagraphs(edited) {
  for (const other of el.paragraphs.querySelectorAll(".paragraph")) {
    if (other === edited) continue;
    other.replaceChildren(...[...edited.childNodes].map((node) => node.cloneNode(true)));
  }
}

el.paragraphs.addEventListener("input", (e) => {
  const edited = e.target.closest(".paragraph");
  if (edited) syncParagraphs(edited);
});

/* Return inserts a line break, explicitly. Left to itself a contenteditable
   paragraph will split into blocks of its own making, which differ by browser
   and would climb out of the element the columns are syncing. */
el.paragraphs.addEventListener("keydown", (e) => {
  const edited = e.target.closest(".paragraph");
  if (e.key !== "Enter" || !edited) return;
  e.preventDefault();
  document.execCommand("insertLineBreak");
  syncParagraphs(edited); // execCommand does not always raise `input`
});

el.paraShuffle.addEventListener("click", renderParagraphs);
el.pageShuffle.addEventListener("click", () => renderPage());

/* Paste lands as plain text everywhere that takes typing, so a paste from a
   styled document cannot drag its own font in with it. */
for (const field of [el.paragraphs, el.pageText]) {
  field.addEventListener("paste", (e) => {
    if (!e.target.closest(".paragraph, .page-text")) return;
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text");
    document.execCommand("insertText", false, text.replace(/\s+/g, " "));
  });
}

el.sampleList.addEventListener("mouseleave", restPreview);
el.sampleList.addEventListener("focusout", restPreview);

el.glyphToggle.addEventListener("click", () => {
  showingAll = !showingAll;
  paintGlyphs();
});

el.glyphGrid.addEventListener("click", (e) => {
  const cell = e.target.closest(".glyph-cell");
  if (cell) openViewer(Number(cell.dataset.index));
});

el.viewerPrev.addEventListener("click", () => stepViewer(-1));
el.viewerNext.addEventListener("click", () => stepViewer(1));
el.viewerClose.addEventListener("click", closeViewer);

// Clicking the backdrop closes; clicking the glyph or the controls does not.
el.viewer.addEventListener("click", (e) => {
  if (e.target === el.viewer || e.target === el.viewerStage) closeViewer();
});

window.addEventListener("keydown", (e) => {
  if (el.viewer.hidden) return;
  if (e.key === "Escape") closeViewer();
  else if (e.key === "ArrowLeft") stepViewer(-1);
  else if (e.key === "ArrowRight") stepViewer(1);
  else return;
  e.preventDefault();
});

el.print.addEventListener("click", () => window.print());
