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

const el = {
  loader: document.getElementById("loader"),
  dropzone: document.getElementById("dropzone"),
  fileInput: document.getElementById("file-input"),
  browse: document.getElementById("browse"),
  status: document.getElementById("status"),
  specimen: document.getElementById("specimen"),
  fontName: document.getElementById("font-name"),
  fontStyle: document.getElementById("font-style"),
  headerFont: document.getElementById("header-font"),
  infoGrid: document.getElementById("info-grid"),
  waterfall: document.getElementById("waterfall"),
  glyphGrid: document.getElementById("glyph-grid"),
  glyphCount: document.getElementById("glyph-count"),
  glyphNotice: document.getElementById("glyph-notice"),
  shuffle: document.getElementById("shuffle"),
  print: document.getElementById("print"),
};

let loadedFace = null; // the FontFace currently registered, so we can swap it out

/* -------------------------------------------------------------------------
   Status messages
   ---------------------------------------------------------------------- */
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
    return setStatus(`Could not read ${file.name}: ${err.message}`, true);
  }

  if (buffer.byteLength < 4) {
    return setStatus(`${file.name} is empty or too small to be a font file.`, true);
  }

  const format = detectFormat(buffer);
  if (!format) {
    return setStatus(
      `${file.name} does not look like a font file. Supported: .ttf, .otf, .woff, .woff2`,
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
      `The browser could not render ${file.name}. The file may be corrupt or use an unsupported flavour. (${err.message})`,
      true
    );
  }

  // Step 2: parse it for metadata and outlines. This can fail independently of
  // rendering — we still show the specimen if it does.
  const parsed = await parseFont(buffer, format);

  el.specimen.hidden = false;
  el.loader.classList.add("is-loaded");
  document.body.classList.add("has-font");
  const names = fontNames(file, parsed.font);
  renderTitle(names);
  renderInfo(file, format, parsed, names);
  setPhrase(randomPhrase()); // a fresh phrase per font, and it renders the waterfall
  renderGlyphs(parsed);

  setStatus(`Loaded ${file.name}.`);
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
        note: "Glyph data for WOFF2 could not be decompressed in this browser, so the information and glyph sections are unavailable. The specimen above still renders correctly. Try a .ttf, .otf or .woff copy of the font for the full breakdown.",
      };
    }
  }

  try {
    const font = opentype.parse(sfnt);
    return { font, note };
  } catch (err) {
    return {
      font: null,
      note: `Glyph data could not be parsed (${err.message}). The specimen above still renders correctly.`,
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

window.addEventListener("resize", fitTitle);

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
function renderGlyphs({ font, note }) {
  el.glyphNotice.hidden = !note;
  el.glyphNotice.textContent = note || "";

  if (!font) {
    el.glyphCount.textContent = "";
    el.glyphGrid.replaceChildren();
    return;
  }

  const total = font.numGlyphs;
  const shown = Math.min(total, GLYPH_LIMIT);
  el.glyphCount.textContent =
    shown < total ? `— showing ${shown} of ${total}` : `— ${total}`;

  if (shown < total && !note) {
    el.glyphNotice.hidden = false;
    el.glyphNotice.textContent = `This font has ${total} glyphs. The first ${shown} are shown to keep the page responsive.`;
  }

  const cells = [];
  for (let i = 0; i < shown; i++) {
    const glyph = font.glyphs.get(i);
    cells.push(glyphCell(glyph, font));
  }
  el.glyphGrid.replaceChildren(...cells);
}

function glyphCell(glyph, font) {
  const cell = document.createElement("div");
  cell.className = "glyph-cell";

  const mark = document.createElement("div");
  mark.className = "glyph-mark";
  // Draw the outline directly. This shows glyphs with no Unicode mapping
  // (alternates, ligatures) that plain text could never reach.
  mark.append(glyphSvg(glyph, font));

  const label = document.createElement("div");
  label.className = "glyph-label";
  label.textContent = glyph.unicode !== undefined
    ? `U+${glyph.unicode.toString(16).toUpperCase().padStart(4, "0")}`
    : glyph.name || `#${glyph.index}`;

  cell.append(mark, label);
  cell.title = glyph.name ? `${glyph.name} (#${glyph.index})` : `#${glyph.index}`;
  return cell;
}

const SVG_NS = "http://www.w3.org/2000/svg";

function glyphSvg(glyph, font) {
  const box = 40;
  const size = 28;
  const scale = size / font.unitsPerEm;
  const advance = (glyph.advanceWidth || font.unitsPerEm) * scale;
  const x = (box - advance) / 2;
  const baseline = box / 2 + size / 3;

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${box} ${box}`);
  svg.setAttribute("aria-hidden", "true");

  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", glyph.getPath(x, baseline, size).toPathData(2));
  svg.append(path);
  return svg;
}

/* -------------------------------------------------------------------------
   Reset
   ---------------------------------------------------------------------- */
function resetSpecimen() {
  el.specimen.hidden = true;
  el.loader.classList.remove("is-loaded");
  document.body.classList.remove("has-font");
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
   Events
   ---------------------------------------------------------------------- */
el.browse.addEventListener("click", (e) => {
  e.stopPropagation();
  el.fileInput.click();
});

el.dropzone.addEventListener("click", () => el.fileInput.click());
el.dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    el.fileInput.click();
  }
});

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

el.print.addEventListener("click", () => window.print());
