# Build log

A running record of what broke, why, and what fixed it.

---

## 1. Local preview server would not start

**Symptom**
```
File ".../http/server.py", line 1274, in <module>
    parser.add_argument('--directory', '-d', default=os.getcwd(),
PermissionError: [Errno 1] Operation not permitted
```

**Cause** Tooling problem, not app code. `python3 -m http.server` calls `os.getcwd()` at
import time, and it was launched from a directory the sandboxed process could not stat.

**Fix** Served the folder with a small Node static server that takes an absolute root path
instead of relying on the current working directory. Running `python3 -m http.server` from a
normal terminal inside the project folder works fine.

---

## 2. WOFF2 glyph data would not decompress

**Symptom** Every `.woff2` file rendered correctly in the specimen but fell back to the
"glyph data unavailable" message. The console error was the one thrown by our own code:
`wawoff2 binding missing`.

**Cause** Two wrong assumptions about the wawoff2 library:

1. We assumed `window.Module` was an Emscripten *factory function* — `Module().then(...)`.
   The CDN build is not modularised: it assigns a plain **object** to `window.Module`, with
   `Module.decompress` hanging off it directly. Our `typeof factory !== "function"` guard
   therefore rejected every single time.
2. We assumed the script's `load` event meant the library was ready. It does not — the
   WebAssembly module compiles asynchronously *after* the script finishes parsing, so
   `Module.decompress` does not exist yet at that moment.

**Fix** `runWoff2Decompress` now polls for `Module.calledRun && typeof Module.decompress === "function"`
(10s timeout) before calling `Module.decompress(bytes)`. Confirmed working: a 23 KB
`inter.woff2` decompresses to 66,912 bytes of raw sfnt starting with the `00 01 00 00`
TrueType signature, which opentype.js parses as "Inter, 518 glyphs".

**Also worth noting** `decompress()` returns a `Uint8Array` that is a *view into the wasm
heap*. We copy it out (`new Uint8Array(result).buffer`) before handing it to opentype.js, so
later wasm activity cannot overwrite the font data underneath us.

---

## 3. Stale data left behind after a failed load

**Symptom** Loading a good font, then a broken one, left the previous font's family name,
glyph count and file size sitting in the Information panel.

**Cause** `resetSpecimen()` only hid the specimen container and cleared the glyph grid. The
info rows and waterfall were never emptied, so the old content survived under the
`hidden` attribute.

**Fix** `resetSpecimen()` now clears the info grid, waterfall, glyph grid, glyph count and
notice text. The container is hidden *and* empty, so nothing stale can reappear.

---

## 4. `/System/Library/Fonts/LastResort.otf` reports as invalid

**Symptom** `The browser could not render LastResort.otf. The file may be corrupt or uses an
unsupported flavour. (Invalid font data in ArrayBuffer.)`

**Cause** Not a bug. That macOS file is a 2.5 KB stub — the real outlines live in the system
font cache, not in the file on disk. The FontFace API is correct to reject it.

**Kept as-is** It is a useful demonstration that the error path works: the message is
readable, the specimen stays hidden, and nothing is left half-rendered.

---

## Test matrix (all passing)

| File | Format | Result |
|---|---|---|
| `Georgia.ttf` (371 KB) | TrueType | 1,134 glyphs, full info |
| `SourceCodePro-Regular.otf` (128 KB) | OpenType CFF | 1,568 glyphs, 1,500 shown + cap notice |
| `inter.woff` (30 KB) | WOFF | 515 glyphs, full info |
| `inter.woff2` (23 KB) | WOFF2 | 518 glyphs, full info (via wasm decompression) |
| `broken.ttf` (9 bytes of text) | — | "does not look like a font file", specimen hidden |
| `LastResort.otf` (2.5 KB stub) | — | Readable render error, specimen hidden |
