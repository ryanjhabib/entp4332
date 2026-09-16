/* Font Specimen — everything runs client-side. No font data leaves the page. */

const WATERFALL_SIZES = [12, 16, 24, 36, 48, 72, 96];

// Rendering every glyph of a large CJK font locks the page up. Cap it and say so.
const GLYPH_LIMIT = 1500;

// The family name we register every loaded font under, so the CSS never changes.
const FAMILY = "SpecimenFont";

const el = {
  loader: document.getElementById("loader"),
  dropzone: document.getElementById("dropzone"),
  fileInput: document.getElementById("file-input"),
  browse: document.getElementById("browse"),
  status: document.getElementById("status"),
  specimen: document.getElementById("specimen"),
  infoGrid: document.getElementById("info-grid"),
  sample: document.getElementById("sample"),
  waterfall: document.getElementById("waterfall"),
  glyphGrid: document.getElementById("glyph-grid"),
  glyphCount: document.getElementById("glyph-count"),
  glyphNotice: document.getElementById("glyph-notice"),
  print: document.getElementById("print"),
  reset: document.getElementById("reset"),
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
  renderInfo(file, format, parsed);
  renderWaterfall();
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

function renderInfo(file, format, { font }) {
  const names = font ? font.names : null;
  const rows = [
    ["Family", pickName(names && names.fontFamily) || "—"],
    ["Style", pickName(names && names.fontSubfamily) || "—"],
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
  return el.sample.textContent.trim() || "Handgloves";
}

function renderWaterfall() {
  const text = sampleText();
  el.waterfall.replaceChildren(
    ...WATERFALL_SIZES.map((size) => {
      const row = document.createElement("div");
      row.className = "waterfall-row";

      const label = document.createElement("span");
      label.className = "waterfall-size";
      label.textContent = `${size}`;

      const line = document.createElement("div");
      line.className = "waterfall-line specimen-type";
      line.style.fontSize = `${size}px`;
      line.textContent = text;

      row.append(label, line);
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

["dragenter", "dragover"].forEach((type) =>
  el.dropzone.addEventListener(type, (e) => {
    e.preventDefault();
    el.dropzone.classList.add("is-dragover");
  })
);

["dragleave", "drop"].forEach((type) =>
  el.dropzone.addEventListener(type, (e) => {
    e.preventDefault();
    el.dropzone.classList.remove("is-dragover");
  })
);

el.dropzone.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

// Dropping anywhere on the page works too, but the browser's default is to
// navigate to the file — so cancel that everywhere.
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());

el.sample.addEventListener("input", renderWaterfall);

el.print.addEventListener("click", () => window.print());

el.reset.addEventListener("click", () => {
  resetSpecimen();
  setStatus("");
  el.fileInput.click();
});
