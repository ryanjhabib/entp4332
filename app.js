/* Font Specimen — everything runs client-side. No font data leaves the page. */

const WATERFALL_SIZES = [128, 96, 72, 48, 36, 24, 16, 12];

// Rendering every glyph of a large CJK font locks the page up. Cap it and say so.
const GLYPH_LIMIT = 1500;

// The family name we register every loaded font under, so the CSS never changes.
const FAMILY = "SpecimenFont";

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
];

/* The waterfall lines are edited in place, so the test string lives here rather
   than in any one element. */
let testString = PHRASES[0];

/* Never hand back the phrase already on screen — a shuffle that appears to do
   nothing reads as a broken button. */
function randomPhrase() {
  const pool = PHRASES.filter((p) => p !== testString.trim());
  return pool[Math.floor(Math.random() * pool.length)];
}

function setPhrase(text) {
  testString = text;
  renderWaterfall();
}

/* Open-licence faces served from the same CDN as the libraries. Nothing is
   uploaded — these are downloads, so the page's privacy claim still holds. */
const SAMPLE_CDN = "https://cdn.jsdelivr.net/npm/";
const SAMPLE_FONTS = [
  { name: "Inter", file: "Inter-Regular.woff2", path: "@fontsource/inter/files/inter-latin-400-normal.woff2" },
  { name: "Geist", file: "Geist-Regular.woff2", path: "@fontsource/geist/files/geist-latin-400-normal.woff2" },
  { name: "Work Sans", file: "WorkSans-Regular.woff2", path: "@fontsource/work-sans/files/work-sans-latin-400-normal.woff2" },
  { name: "Poppins", file: "Poppins-Regular.woff2", path: "@fontsource/poppins/files/poppins-latin-400-normal.woff2" },
  { name: "Oxygen", file: "Oxygen-Regular.woff2", path: "@fontsource/oxygen/files/oxygen-latin-400-normal.woff2" },
  { name: "Manrope", file: "Manrope-Regular.woff2", path: "@fontsource/manrope/files/manrope-latin-400-normal.woff2" },
  { name: "IBM Plex Sans", file: "IBMPlexSans-Regular.woff2", path: "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2" },
  { name: "Archivo", file: "Archivo-SemiBold.woff2", path: "@fontsource/archivo/files/archivo-latin-600-normal.woff2" },
  { name: "Instrument Sans", file: "InstrumentSans-Regular.woff2", path: "@fontsource/instrument-sans/files/instrument-sans-latin-400-normal.woff2" },
  { name: "Bricolage Grotesque", file: "BricolageGrotesque-Regular.woff2", path: "@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-400-normal.woff2" },
  { name: "Space Grotesk", file: "SpaceGrotesk-Medium.woff2", path: "@fontsource/space-grotesk/files/space-grotesk-latin-500-normal.woff2" },
  { name: "Michroma", file: "Michroma-Regular.woff2", path: "@fontsource/michroma/files/michroma-latin-400-normal.woff2" },
  { name: "League Gothic", file: "LeagueGothic-Regular.woff2", path: "@fontsource/league-gothic/files/league-gothic-latin-400-normal.woff2" },
  { name: "Newsreader", file: "Newsreader-Regular.woff2", path: "@fontsource/newsreader/files/newsreader-latin-400-normal.woff2" },
  { name: "Source Serif 4", file: "SourceSerif4-Regular.woff2", path: "@fontsource/source-serif-4/files/source-serif-4-latin-400-normal.woff2" },
  { name: "Cormorant Garamond", file: "CormorantGaramond-Regular.woff2", path: "@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-normal.woff2" },
  { name: "EB Garamond", file: "EBGaramond-Regular.woff2", path: "@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff2" },
  { name: "Libre Baskerville", file: "LibreBaskerville-Regular.woff2", path: "@fontsource/libre-baskerville/files/libre-baskerville-latin-400-normal.woff2" },
  { name: "Goudy Bookletter 1911", file: "GoudyBookletter1911-Regular.woff2", path: "@fontsource/goudy-bookletter-1911/files/goudy-bookletter-1911-latin-400-normal.woff2" },
  { name: "IM Fell English", file: "IMFellEnglish-Regular.woff2", path: "@fontsource/im-fell-english/files/im-fell-english-latin-400-normal.woff2" },
  { name: "Playfair Display", file: "PlayfairDisplay-Regular.woff2", path: "@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2" },
  { name: "Fraunces", file: "Fraunces-Regular.woff2", path: "@fontsource/fraunces/files/fraunces-latin-400-normal.woff2" },
  { name: "Bodoni Moda", file: "BodoniModa-Regular.woff2", path: "@fontsource/bodoni-moda/files/bodoni-moda-latin-400-normal.woff2" },
  { name: "Jim Nightshade", file: "JimNightshade-Regular.woff2", path: "@fontsource/jim-nightshade/files/jim-nightshade-latin-400-normal.woff2" },
  { name: "Kapakana", file: "Kapakana-Regular.woff2", path: "@fontsource/kapakana/files/kapakana-latin-400-normal.woff2" },
  { name: "UnifrakturMaguntia", file: "UnifrakturMaguntia-Regular.woff2", path: "@fontsource/unifrakturmaguntia/files/unifrakturmaguntia-latin-400-normal.woff2" },
  { name: "Manufacturing Consent", file: "ManufacturingConsent-Regular.woff2", path: "@fontsource/manufacturing-consent/files/manufacturing-consent-latin-400-normal.woff2" },
  { name: "Micro 5", file: "Micro5-Regular.woff2", path: "@fontsource/micro-5/files/micro-5-latin-400-normal.woff2" },
  { name: "JetBrains Mono", file: "JetBrainsMono-Regular.woff2", path: "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2" },
];

const el = {
  loader: document.getElementById("loader"),
  fileInput: document.getElementById("file-input"),
  status: document.getElementById("status"),
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
  infoGrid: document.getElementById("info-grid"),
  waterfall: document.getElementById("waterfall"),
  glyphGrid: document.getElementById("glyph-grid"),
  glyphCount: document.getElementById("glyph-count"),
  glyphNotice: document.getElementById("glyph-notice"),
  glyphToggle: document.getElementById("glyph-toggle"),
  viewer: document.getElementById("glyph-viewer"),
  viewerStage: document.getElementById("viewer-stage"),
  viewerMeta: document.getElementById("viewer-meta"),
  viewerPrev: document.getElementById("viewer-prev"),
  viewerNext: document.getElementById("viewer-next"),
  viewerClose: document.getElementById("viewer-close"),
  shuffle: document.getElementById("shuffle"),
  bannerBrowse: document.getElementById("banner-browse"),
  print: document.getElementById("print"),
};

let loadedFace = null; // the FontFace currently registered, so we can swap it out

/* -------------------------------------------------------------------------
   Status messages
   ---------------------------------------------------------------------- */
/* Library and browser errors arrive with their own full stops; UI copy here
   carries none, so they are trimmed at the point of interpolation. */
function trimStop(text) {
  return String(text).replace(/\s*\.\s*$/, "");
}

function setStatus(message, isError = false) {
  el.status.textContent = message;
  el.status.classList.toggle("is-error", isError);
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
async function handleFile(file) {
  resetSpecimen();
  setStatus(`Reading ${file.name}…`);

  let buffer;
  try {
    buffer = await file.arrayBuffer();
  } catch (err) {
    return setStatus(`Could not read ${file.name}: ${trimStop(err.message)}`, true);
  }

  if (buffer.byteLength < 4) {
    return setStatus(`${file.name} is empty or too small to be a font file`, true);
  }

  const format = detectFormat(buffer);
  if (!format) {
    return setStatus(
      `${file.name} does not look like a font file — supported: .ttf, .otf, .woff, .woff2`,
      true
    );
  }

  // Step 1: render it. The FontFace API handles every format the browser
  // supports, including woff2 and variable fonts (default instance).
  try {
    if (loadedFace) document.fonts.delete(loadedFace);
    loadedFace = new FontFace(FAMILY, buffer);
    await loadedFace.load();
    document.fonts.add(loadedFace);
    await document.fonts.ready; // canvas cannot measure the face until it is live
  } catch (err) {
    loadedFace = null;
    return setStatus(
      `The browser could not render ${file.name} — it may be corrupt or use an unsupported flavour (${trimStop(err.message)})`,
      true
    );
  }

  // Step 2: parse it for metadata and outlines. This can fail independently of
  // rendering — we still show the specimen if it does.
  const parsed = await parseFont(buffer, format);

  el.specimen.hidden = false;
  document.body.classList.add("has-font");
  placeBanner();
  const names = fontNames(file, parsed.font);
  renderTitle(names);
  renderInfo(file, format, parsed, names);
  setPhrase(randomPhrase()); // a fresh phrase per font, and it renders the waterfall
  renderGlyphs(parsed);

  setStatus(`Loaded ${file.name}`);
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

/* Weight and width words that may be sitting on the end of a family name. */
const STYLE_WORDS =
  /^(thin|hairline|extralight|ultralight|light|book|regular|normal|roman|medium|semibold|demibold|demi|bold|extrabold|ultrabold|black|heavy|fat|italic|oblique|condensed|compressed|narrow|extended|expanded|wide)$/i;

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

  if (!style || /^regular$/i.test(style)) {
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

  const label = [style || "Regular", ...markers].join(" · ");
  return { family, style: label, markers };
}

function renderTitle({ family, style }) {
  el.fontName.textContent = family;
  el.fontStyle.textContent = style;
  el.headerFont.textContent = family;
  sizeIntro();
  fitTitle();
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

  titleCtx.font = `100px "${FAMILY}"`;
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
  el.glyphCount.textContent = `— ${shownGlyphs.length}`;
  el.glyphToggle.hidden = allGlyphs.length <= basicGlyphs.length;
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
  el.fontName.textContent = "";
  el.fontStyle.textContent = "";
  el.headerFont.textContent = "";
  el.infoGrid.replaceChildren();
  el.waterfall.replaceChildren();
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
        const res = await fetch(SAMPLE_CDN + sample.path);
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
     bug — so the size is capped at whatever keeps the longest word on one
     line. Wide faces like Michroma are constrained by this long before they
     are constrained by height. */
  const longest = preview.textContent
    .split(/\s+/)
    .reduce((a, b) => (b.length > a.length ? b : a), "");

  let high = previewCeiling();
  if (previewFamily && longest) {
    titleCtx.font = `100px "${previewFamily}"`;
    const wordAt100 = titleCtx.measureText(longest).width;
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

async function loadSample(sample) {
  setStatus(`Fetching ${sample.name}…`);
  try {
    const res = await fetch(SAMPLE_CDN + sample.path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    await handleFile(new File([blob], sample.file, { type: "font/woff2" }));
  } catch (err) {
    setStatus(
      `Could not fetch ${sample.name} (${trimStop(err.message)}) — drop a font file instead`,
      true
    );
  }
}

renderSamples();
restPreview();
placeBanner();

/* -------------------------------------------------------------------------
   Events
   ---------------------------------------------------------------------- */
el.home.addEventListener("click", () => {
  resetSpecimen();
  setStatus("");
  window.scrollTo(0, 0);
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
