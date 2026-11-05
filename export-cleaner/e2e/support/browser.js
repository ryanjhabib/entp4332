// Runs inside the test browser before the app loads (an init script), so it
// can't import anything. It gives the tests:
// - a stand-in for Chrome's folder picker, which can't be automated: it hands
//   the app a folder in Chrome's private storage (OPFS), chosen with
//   window.__e2e.choose(name). Nothing chosen behaves like pressing Cancel.
// - makeFolder(): writes generated test pictures and other files into a
//   private-storage folder, oldest first, so their dates come out in order.
// - helpers that read the folder back, and move a file the way Finder would.
// None of this changes the app: it only replaces the native picker.

(() => {
  if (window.__e2e) return;

  const root = () => navigator.storage.getDirectory();
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function folderAt(path, create = false) {
    let dir = await root();
    for (const part of path.split('/').filter(Boolean)) dir = await dir.getDirectoryHandle(part, { create });
    return dir;
  }

  // The folder picker. A real picker resolves after the user clicks; this one
  // resolves at once, with the folder named in localStorage (so it survives
  // the app's own reloads, and other tabs see it too).
  window.showDirectoryPicker = async () => {
    const name = localStorage.getItem('e2e-folder');
    if (!name) throw new DOMException('The user aborted a request.', 'AbortError');
    return folderAt(name);
  };

  // ---- Generated pictures ---------------------------------------------------
  // Every picture comes from a seeded random sequence, so each run draws the
  // same pixels. A "scene" is a whole made-up picture; a "variant" is how a
  // version of it was re-exported (cropped, regraded, resized, re-encoded).

  function random(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const W = 1200;
  const H = 800;

  const SCENES = {
    sunset(ctx, r) {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#2b1055');
      sky.addColorStop(0.45, '#d4418e');
      sky.addColorStop(0.7, '#ff9a5a');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffe29a';
      ctx.beginPath();
      ctx.arc(W * 0.62, H * 0.58, 110, 0, Math.PI * 2);
      ctx.fill();
      ['#5b2a6e', '#3d1c4f', '#1e0d2b'].forEach((colour, layer) => {
        ctx.fillStyle = colour;
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 60) ctx.lineTo(x, H * (0.55 + layer * 0.12) - r() * 140);
        ctx.lineTo(W, H);
        ctx.fill();
      });
    },
    city(ctx, r) {
      ctx.fillStyle = '#0b1530';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#f4f1c9';
      ctx.beginPath();
      ctx.arc(W * 0.15, H * 0.18, 50, 0, Math.PI * 2);
      ctx.fill();
      for (let x = 0; x < W; ) {
        const width = 50 + r() * 90;
        const height = 200 + r() * 450;
        ctx.fillStyle = r() > 0.5 ? '#1c2747' : '#26345c';
        ctx.fillRect(x, H - height, width - 6, height);
        for (let wy = H - height + 14; wy < H - 20; wy += 26) {
          for (let wx = x + 8; wx < x + width - 18; wx += 18) {
            ctx.fillStyle = r() > 0.55 ? '#ffd45e' : '#33406a';
            ctx.fillRect(wx, wy, 9, 14);
          }
        }
        x += width;
      }
    },
    ocean(ctx, r) {
      ctx.fillStyle = '#9fd8f5';
      ctx.fillRect(0, 0, W, H * 0.45);
      ctx.fillStyle = '#0d4f8b';
      ctx.fillRect(0, H * 0.45, W, H * 0.55);
      ctx.strokeStyle = '#d8f1ff';
      ctx.lineWidth = 4;
      for (let y = H * 0.5; y < H; y += 34) {
        ctx.beginPath();
        const phase = r() * 6;
        for (let x = 0; x <= W; x += 10) ctx.lineTo(x, y + Math.sin(x / 40 + phase) * 8);
        ctx.stroke();
      }
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(560, 200);
      ctx.lineTo(560, 380);
      ctx.lineTo(420, 380);
      ctx.fill();
      ctx.fillStyle = '#7a3b1c';
      ctx.fillRect(400, 385, 220, 36);
    },
    forest(ctx, r) {
      ctx.fillStyle = '#e8f4e4';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#7fb069';
      ctx.fillRect(0, H * 0.7, W, H * 0.3);
      for (let i = 0; i < 40; i++) {
        const x = r() * W;
        const base = H * 0.7 + r() * 160;
        const height = 160 + r() * 260;
        ctx.fillStyle = '#5a3d2b';
        ctx.fillRect(x - 6, base - 30, 12, 30);
        ctx.fillStyle = r() > 0.5 ? '#1f5f3b' : '#2e7d4f';
        ctx.beginPath();
        ctx.moveTo(x, base - height);
        ctx.lineTo(x + height * 0.28, base - 25);
        ctx.lineTo(x - height * 0.28, base - 25);
        ctx.fill();
      }
    },
    flowers(ctx, r) {
      ctx.fillStyle = '#3f7d20';
      ctx.fillRect(0, 0, W, H);
      const colours = ['#ff4d6d', '#ffd60a', '#f8f9fa', '#c77dff', '#ff8500'];
      for (let i = 0; i < 70; i++) {
        const [x, y, size] = [r() * W, r() * H, 18 + r() * 30];
        ctx.fillStyle = colours[Math.floor(r() * colours.length)];
        for (let p = 0; p < 6; p++) {
          ctx.beginPath();
          ctx.arc(x + Math.cos((p * Math.PI) / 3) * size, y + Math.sin((p * Math.PI) / 3) * size, size * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#5c3d00';
        ctx.beginPath();
        ctx.arc(x, y, size * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    space(ctx, r) {
      ctx.fillStyle = '#05030f';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 300; i++) ctx.fillRect(r() * W, r() * H, 2, 2);
      const planet = ctx.createRadialGradient(560, 380, 30, 600, 420, 200);
      planet.addColorStop(0, '#f6c28b');
      planet.addColorStop(1, '#8c4a2f');
      ctx.fillStyle = planet;
      ctx.beginPath();
      ctx.arc(600, 420, 190, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e3d5b8';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.ellipse(600, 420, 330, 70, -0.25, 0, Math.PI * 2);
      ctx.stroke();
    },
    tiles(ctx, r) {
      const colours = ['#e63946', '#f1faee', '#a8dadc', '#457b9d', '#1d3557', '#ffb703'];
      for (let y = 0; y < H; y += 80) {
        for (let x = 0; x < W; x += 80) {
          ctx.fillStyle = colours[Math.floor(r() * colours.length)];
          ctx.fillRect(x, y, 80, 80);
          if (r() > 0.5) {
            ctx.fillStyle = colours[Math.floor(r() * colours.length)];
            ctx.beginPath();
            ctx.arc(x + 40, y + 40, 30, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    },
    // Pale paper: close to the app's #EEE page grey, so it gets an edge line.
    paper(ctx, r) {
      ctx.fillStyle = '#f0efeb';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#d9d6cf';
      ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        ctx.beginPath();
        ctx.moveTo(r() * W, r() * H);
        ctx.lineTo(r() * W, r() * H);
        ctx.stroke();
      }
    },
  };

  // variant: { seed, crop (share of the picture kept, centred), shape ('4:5',
  // '16:9': a centred crop to that shape), filter (a CSS filter: a regrade),
  // width (output width), format ('png' | 'jpeg' | 'webp'), quality }
  async function picture({ scene, seed = 1, crop = 1, shape, filter = 'none', width, format = 'png', quality = 0.9 }) {
    const source = new OffscreenCanvas(W, H);
    SCENES[scene](source.getContext('2d'), random(seed));
    let [sw, sh] = [W * crop, H * crop];
    if (shape) {
      const [a, b] = shape.split(':').map(Number);
      if (sw / sh > a / b) sw = sh * (a / b);
      else sh = sw / (a / b);
    }
    const [sx, sy] = [(W - sw) / 2, (H - sh) / 2];
    const outWidth = Math.round(width ?? Math.min(900, sw));
    const outHeight = Math.round((outWidth * sh) / sw);
    const out = new OffscreenCanvas(outWidth, outHeight);
    const ctx = out.getContext('2d');
    ctx.filter = filter;
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, outWidth, outHeight);
    return out.convertToBlob({ type: `image/${format}`, quality });
  }

  // A small, valid one-page PDF with a line of text.
  function pdf(text) {
    const stream = `BT /F1 36 Tf 72 700 Td (${text.replace(/[()\\]/g, '')}) Tj ET`;
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];
    let body = '%PDF-1.4\n';
    const offsets = objects.map((object, i) => {
      const offset = body.length;
      body += `${i + 1} 0 obj\n${object}\nendobj\n`;
      return offset;
    });
    const xref = body.length;
    body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    body += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
    body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return new Blob([body], { type: 'application/pdf' });
  }

  async function contents(file) {
    if (file.scene) return picture(file);
    if (file.pdf !== undefined) return pdf(file.pdf);
    if (file.svg !== undefined) return new Blob([file.svg], { type: 'image/svg+xml' });
    if (file.broken) return new Blob([new Uint8Array(2048).map((_, i) => (i * 37) % 251)]);
    return new Blob([file.text ?? '']);
  }

  async function write(dir, file) {
    const handle = await dir.getFileHandle(file.name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(await contents(file));
    await writable.close();
  }

  // Writes the files in order, a moment apart, so the first listed is the
  // oldest (the app sorts by date). { dir, files } entries are subfolders.
  async function writeAll(dir, files) {
    for (const file of files) {
      if (file.dir) await writeAll(await dir.getDirectoryHandle(file.dir, { create: true }), file.files);
      else await write(dir, file);
      await sleep(25);
    }
  }

  async function list(dir, prefix = '') {
    const out = {};
    for await (const handle of dir.values()) {
      const path = prefix + handle.name;
      if (handle.kind === 'directory') Object.assign(out, await list(handle, `${path}/`));
      else {
        const file = await handle.getFile();
        out[path] = { size: file.size, lastModified: file.lastModified };
      }
    }
    return out;
  }

  window.__e2e = {
    choose(name) {
      if (name) localStorage.setItem('e2e-folder', name);
      else localStorage.removeItem('e2e-folder');
    },
    async makeFolder(name, files) {
      const top = await root();
      await top.removeEntry(name, { recursive: true }).catch(() => {});
      await writeAll(await folderAt(name, true), files);
    },
    // Every file in the folder and its subfolders: { 'path/name': { size, lastModified } }.
    async listFolder(name) {
      return list(await folderAt(name));
    },
    // What dragging a file back out of _to_delete in Finder does.
    async moveBack(name, file) {
      const folder = await folderAt(name);
      const trash = await folder.getDirectoryHandle('_to_delete');
      await (await trash.getFileHandle(file)).move(folder);
    },
    async addFiles(name, files) {
      await writeAll(await folderAt(name), files);
    },
    async removeFile(name, file) {
      await (await folderAt(name)).removeEntry(file);
    },
  };
})();
