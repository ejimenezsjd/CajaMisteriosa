/**
 * Pintores pixel-art originales (Fase 10.5).
 *
 * El arte vive como dibujo en cuadrícula 32×32 / 48×48 con paleta limitada,
 * contorno 1 px y 4 filas de animación. Si existe un PNG en
 * assets/creatures/<id>.png, el renderer lo prefiere; estos pintores son
 * el fallback síncrono y la fuente de los PNG de arranque.
 *
 * Coordenadas: (0,0) = esquina superior izquierda del frame.
 */

import { SHEET_COLS, SHEET_ROWS, getCreatureArt } from "./creature-art.js";

export class Pix {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Array(w * h).fill(null);
  }

  at(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.data[y * this.w + x];
  }

  set(x, y, c) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return;
    this.data[y * this.w + x] = c;
  }

  fillRect(x, y, w, h, c) {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
    }
  }

  fillCircle(cx, cy, r, c) {
    const r2 = r * r;
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        const dx = x - cx + 0.5, dy = y - cy + 0.5;
        if (dx * dx + dy * dy <= r2) this.set(x, y, c);
      }
    }
  }

  fillEllipse(cx, cy, rx, ry, c) {
    for (let y = cy - ry; y <= cy + ry; y++) {
      for (let x = cx - rx; x <= cx + rx; x++) {
        const dx = (x - cx + 0.5) / rx, dy = (y - cy + 0.5) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
    }
  }

  diamond(cx, cy, r, c) {
    for (let y = cy - r; y <= cy + r; y++) {
      const w = r - Math.abs(y - cy);
      for (let x = cx - w; x <= cx + w; x++) this.set(x, y, c);
    }
  }

  outline(color) {
    const add = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.at(x, y)) continue;
        if (this.at(x - 1, y) || this.at(x + 1, y) || this.at(x, y - 1) || this.at(x, y + 1)) {
          add.push([x, y]);
        }
      }
    }
    for (const [x, y] of add) this.set(x, y, color);
  }

  shift(dx, dy) {
    const n = new Pix(this.w, this.h);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = this.at(x, y);
        if (c) n.set(x + dx, y + dy, c);
      }
    }
    return n;
  }

  tint(hex, amt = 0.35) {
    const n = new Pix(this.w, this.h);
    const [tr, tg, tb] = hexToRgb(hex);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = this.at(x, y);
        if (!c) continue;
        const [r, g, b] = hexToRgb(c);
        const rr = Math.round(r + (tr - r) * amt);
        const gg = Math.round(g + (tg - g) * amt);
        const bb = Math.round(b + (tb - b) * amt);
        n.set(x, y, rgbToHex(rr, gg, bb));
      }
    }
    return n;
  }

  toRgba() {
    const out = new Uint8ClampedArray(this.w * this.h * 4);
    for (let i = 0; i < this.data.length; i++) {
      const c = this.data[i];
      const o = i * 4;
      if (!c) { out[o + 3] = 0; continue; }
      const [r, g, b] = hexToRgb(c);
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
    }
    return out;
  }
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r, g, b) {
  const c = (n) => n.toString(16).padStart(2, "0");
  return `#${c(Math.max(0, Math.min(255, r)))}${c(Math.max(0, Math.min(255, g)))}${c(Math.max(0, Math.min(255, b)))}`;
}

function paintEmberin() {
  const p = new Pix(32, 32);
  const body = "#e07a3a", rock = "#4a3028", belly = "#ffd080";
  const flame = "#ff6a20", flame2 = "#ffd84a", eye = "#1a1010";
  p.fillEllipse(16, 21, 7, 6, body);
  p.fillEllipse(16, 23, 4, 3, belly);
  p.fillCircle(16, 12, 6, body);
  p.fillCircle(16, 13, 3, belly);
  p.diamond(11, 6, 3, rock);
  p.diamond(21, 6, 3, rock);
  p.fillRect(10, 5, 2, 3, flame);
  p.fillRect(20, 5, 2, 3, flame);
  p.set(11, 4, flame2); p.set(21, 4, flame2);
  p.fillCircle(13, 12, 1, "#fff8e8");
  p.fillCircle(19, 12, 1, "#fff8e8");
  p.set(13, 12, eye); p.set(19, 12, eye);
  p.fillRect(9, 27, 3, 3, rock);
  p.fillRect(13, 27, 3, 3, rock);
  p.fillRect(17, 27, 3, 3, rock);
  p.fillRect(21, 27, 3, 3, rock);
  p.fillRect(23, 18, 4, 3, body);
  p.fillRect(26, 14, 3, 6, flame);
  p.fillRect(27, 11, 2, 4, flame2);
  p.outline("#3a1810");
  return p;
}

function paintBrasor() {
  const p = new Pix(32, 32);
  const body = "#d45520", dark = "#5a2418", belly = "#ff9040";
  const mane = "#ff6a20", mane2 = "#ffd84a", eye = "#1a1010";
  p.fillEllipse(16, 20, 9, 7, body);
  p.fillEllipse(16, 22, 5, 4, belly);
  p.fillCircle(16, 11, 7, body);
  p.fillCircle(16, 12, 3, belly);
  p.fillRect(8, 4, 16, 4, mane);
  p.fillRect(10, 2, 12, 3, mane2);
  p.set(9, 3, mane); p.set(22, 3, mane);
  p.fillRect(7, 8, 3, 5, dark);
  p.fillRect(22, 8, 3, 5, dark);
  p.fillCircle(13, 11, 1, "#fff0d0");
  p.fillCircle(19, 11, 1, "#fff0d0");
  p.set(13, 11, eye); p.set(19, 11, eye);
  p.fillRect(8, 27, 4, 4, dark);
  p.fillRect(13, 27, 3, 4, dark);
  p.fillRect(17, 27, 3, 4, dark);
  p.fillRect(21, 27, 4, 4, dark);
  p.fillRect(24, 16, 5, 4, body);
  p.fillRect(27, 10, 4, 8, mane);
  p.fillRect(28, 7, 2, 4, mane2);
  p.outline("#3a140c");
  return p;
}

function paintGotita() {
  const p = new Pix(32, 32);
  const body = "#3a9fe0", light = "#80d0ff", foam = "#e8f6ff", dark = "#1a4a70";
  p.fillEllipse(16, 18, 8, 9, body);
  p.fillCircle(16, 10, 5, body);
  p.fillEllipse(16, 20, 5, 4, light);
  p.fillRect(14, 5, 4, 3, foam);
  p.fillRect(13, 4, 6, 2, foam);
  p.set(12, 6, foam); p.set(19, 6, foam);
  p.fillCircle(13, 14, 1, "#ffffff");
  p.fillCircle(19, 14, 1, "#ffffff");
  p.set(13, 14, dark); p.set(19, 14, dark);
  p.fillRect(11, 27, 3, 3, light);
  p.fillRect(18, 27, 3, 3, light);
  p.set(16, 8, foam);
  p.outline("#163a58");
  return p;
}

function paintSemilla() {
  const p = new Pix(32, 32);
  const shell = "#8a6030", body = "#3dba7a", leaf = "#2a9860", vein = "#80e0a8";
  const eye = "#1a3018";
  p.fillEllipse(16, 20, 7, 8, shell);
  p.fillEllipse(16, 22, 4, 4, "#c4925a");
  p.fillCircle(16, 13, 6, body);
  p.fillEllipse(9, 8, 5, 3, leaf);
  p.fillEllipse(23, 8, 5, 3, leaf);
  p.fillRect(16, 6, 1, 5, "#187848");
  p.set(9, 8, vein); p.set(23, 8, vein);
  p.fillCircle(13, 13, 1, "#e8ffe8");
  p.fillCircle(19, 13, 1, "#e8ffe8");
  p.set(13, 13, eye); p.set(19, 13, eye);
  p.fillRect(11, 28, 3, 3, shell);
  p.fillRect(18, 28, 3, 3, shell);
  p.outline("#2a3c18");
  return p;
}

function paintChispin() {
  const p = new Pix(32, 32);
  const body = "#e0c23a", belly = "#ffe680", bolt = "#c09010", eye = "#2a2010";
  p.fillEllipse(16, 20, 7, 6, body);
  p.fillEllipse(16, 22, 4, 3, belly);
  p.fillCircle(16, 12, 6, body);
  p.fillCircle(16, 13, 3, belly);
  p.fillRect(10, 3, 2, 2, bolt);
  p.fillRect(9, 5, 3, 2, bolt);
  p.fillRect(11, 7, 2, 3, bolt);
  p.fillRect(20, 3, 2, 2, bolt);
  p.fillRect(20, 5, 3, 2, bolt);
  p.fillRect(19, 7, 2, 3, bolt);
  p.fillCircle(13, 12, 1, "#fff8d0");
  p.fillCircle(19, 12, 1, "#fff8d0");
  p.set(13, 12, eye); p.set(19, 12, eye);
  p.fillRect(10, 26, 3, 4, body);
  p.fillRect(19, 26, 3, 4, body);
  p.fillRect(22, 18, 5, 2, bolt);
  p.fillRect(25, 15, 2, 4, bolt);
  p.fillRect(26, 13, 3, 2, "#ffe680");
  p.outline("#5a4010");
  return p;
}

function paintPiedrita() {
  const p = new Pix(32, 32);
  const rock = "#c4925a", dark = "#8a6030", crystal = "#80d0ff", shine = "#e8f8ff";
  const eye = "#3a2010";
  p.fillRect(10, 16, 12, 10, rock);
  p.fillRect(8, 18, 16, 8, rock);
  p.fillRect(12, 10, 8, 8, dark);
  p.fillRect(11, 11, 10, 6, rock);
  p.diamond(16, 8, 4, crystal);
  p.set(16, 7, shine); p.set(15, 9, shine);
  p.fillRect(13, 14, 2, 2, "#fff0d8");
  p.fillRect(18, 14, 2, 2, "#fff0d8");
  p.set(13, 15, eye); p.set(19, 15, eye);
  p.fillRect(9, 26, 4, 4, dark);
  p.fillRect(19, 26, 4, 4, dark);
  p.fillRect(7, 20, 3, 3, "#aeaeb6");
  p.fillRect(22, 19, 3, 4, "#9c9ca4");
  p.outline("#4a3018");
  return p;
}

function paintTitanor() {
  const p = new Pix(48, 48);
  const plate = "#8a6030", dark = "#5a3c20", magma = "#e07030", glow = "#ffd84a";
  const crystal = "#c04040", eye = "#1a1008";
  p.fillRect(12, 22, 24, 18, plate);
  p.fillRect(10, 26, 28, 14, plate);
  p.fillRect(14, 12, 20, 14, dark);
  p.fillRect(16, 10, 16, 16, plate);
  p.fillRect(18, 6, 12, 8, dark);
  p.fillRect(20, 4, 8, 6, plate);
  p.diamond(15, 8, 3, magma);
  p.diamond(32, 8, 3, magma);
  p.fillRect(22, 16, 4, 10, magma);
  p.fillRect(23, 18, 2, 14, glow);
  p.fillRect(18, 28, 12, 3, magma);
  p.diamond(16, 20, 3, crystal);
  p.diamond(31, 22, 3, crystal);
  p.fillRect(18, 14, 3, 3, "#f0e0c0");
  p.fillRect(27, 14, 3, 3, "#f0e0c0");
  p.set(19, 15, eye); p.set(28, 15, eye);
  p.fillRect(10, 40, 8, 6, dark);
  p.fillRect(18, 40, 6, 7, dark);
  p.fillRect(24, 40, 6, 7, dark);
  p.fillRect(30, 40, 8, 6, dark);
  p.fillRect(8, 30, 5, 8, plate);
  p.fillRect(35, 28, 6, 10, plate);
  p.outline("#2a180c");
  return p;
}

function paintPlumin() {
  const p = new Pix(32, 32);
  const body = "#8eb6e0", tuft = "#c0dcf0", beak = "#f0b040", eye = "#203040";
  p.fillEllipse(16, 20, 8, 7, body);
  p.fillCircle(16, 13, 6, body);
  p.fillEllipse(16, 22, 5, 3, tuft);
  p.fillRect(15, 5, 2, 4, tuft);
  p.fillRect(14, 4, 4, 2, tuft);
  p.fillRect(15, 18, 3, 2, beak);
  p.fillRect(16, 17, 3, 2, beak);
  p.fillCircle(13, 13, 1, "#ffffff");
  p.fillCircle(19, 13, 1, "#ffffff");
  p.set(13, 13, eye); p.set(19, 13, eye);
  p.fillEllipse(8, 18, 4, 2, tuft);
  p.fillEllipse(24, 18, 4, 2, tuft);
  p.fillRect(12, 27, 3, 3, body);
  p.fillRect(18, 27, 3, 3, body);
  p.outline("#305070");
  return p;
}

function paintUmbra() {
  const p = new Pix(32, 32);
  const cloak = "#5a3a80", wisp = "#7a5aa0", dark = "#2a1840", eye = "#e8d0ff";
  p.fillEllipse(16, 18, 8, 10, cloak);
  p.fillCircle(16, 12, 6, cloak);
  p.fillRect(10, 20, 3, 8, wisp);
  p.fillRect(19, 22, 3, 7, wisp);
  p.fillRect(14, 24, 2, 6, dark);
  p.fillCircle(13, 13, 2, dark);
  p.fillCircle(19, 13, 2, dark);
  p.set(13, 13, eye); p.set(19, 13, eye);
  p.set(13, 12, "#ffffff"); p.set(19, 12, "#ffffff");
  p.fillRect(8, 16, 2, 5, wisp);
  p.fillRect(22, 15, 3, 6, wisp);
  p.set(7, 20, wisp); p.set(25, 18, wisp);
  p.outline("#1a1028");
  return p;
}

function paintLucier() {
  const p = new Pix(32, 32);
  const body = "#e8d878", glow = "#fff8d0", lamp = "#ffe870", dark = "#6a5820";
  p.fillEllipse(16, 20, 7, 6, body);
  p.fillEllipse(16, 22, 5, 4, lamp);
  p.fillCircle(16, 13, 5, body);
  p.fillRect(12, 5, 1, 5, dark);
  p.fillRect(19, 5, 1, 5, dark);
  p.fillCircle(12, 4, 1, glow);
  p.fillCircle(19, 4, 1, glow);
  p.fillEllipse(8, 16, 4, 2, glow);
  p.fillEllipse(24, 16, 4, 2, glow);
  p.fillCircle(13, 13, 1, "#ffffff");
  p.fillCircle(18, 13, 1, "#ffffff");
  p.set(13, 13, dark); p.set(18, 13, dark);
  p.fillRect(12, 26, 3, 4, body);
  p.fillRect(18, 26, 3, 4, body);
  p.set(16, 21, "#ffffff");
  p.outline("#5a4820");
  return p;
}

const PAINTERS = {
  emberin: paintEmberin,
  brasor: paintBrasor,
  gotita: paintGotita,
  semilla: paintSemilla,
  chispin: paintChispin,
  piedrita: paintPiedrita,
  titanor: paintTitanor,
  plumin: paintPlumin,
  umbra: paintUmbra,
  lucier: paintLucier,
};

function animFrames(base) {
  const idle = [base, base.shift(0, -1), base, base.shift(0, 0)];
  const walk = [
    base.shift(-1, 0),
    base.shift(0, -1),
    base.shift(1, 0),
    base.shift(0, 0),
  ];
  const hurt = [base.tint("#ff4040", 0.4), base.shift(1, 0)];
  while (hurt.length < 4) hurt.push(hurt[hurt.length - 1]);
  const attack = [
    base.shift(0, 0),
    base.shift(0, -1),
    base.shift(0, -2),
    base.shift(0, -1),
  ];
  return { idle, walk, hurt, attack };
}

/** Hoja RGBA: cols×rows frames. */
export function renderSheet(speciesId) {
  const art = getCreatureArt(speciesId);
  const painter = PAINTERS[speciesId];
  if (!art || !painter) return null;
  const fw = art.frameSize.width;
  const fh = art.frameSize.height;
  const base = painter();
  const anim = animFrames(base);
  const rows = ["idle", "walk", "hurt", "attack"];
  const sheetW = fw * SHEET_COLS;
  const sheetH = fh * SHEET_ROWS;
  const rgba = new Uint8ClampedArray(sheetW * sheetH * 4);
  rows.forEach((name, row) => {
    const frames = anim[name];
    for (let col = 0; col < SHEET_COLS; col++) {
      const frame = frames[col] ?? frames[frames.length - 1];
      blit(rgba, sheetW, frame, col * fw, row * fh);
    }
  });
  return { width: sheetW, height: sheetH, rgba, frameWidth: fw, frameHeight: fh };
}

function blit(dest, destW, pix, dx, dy) {
  for (let y = 0; y < pix.h; y++) {
    for (let x = 0; x < pix.w; x++) {
      const c = pix.at(x, y);
      const i = ((dy + y) * destW + (dx + x)) * 4;
      if (!c) { dest[i + 3] = 0; continue; }
      const [r, g, b] = hexToRgb(c);
      dest[i] = r; dest[i + 1] = g; dest[i + 2] = b; dest[i + 3] = 255;
    }
  }
}

export function sheetToCanvas(sheet) {
  const canvas = document.createElement("canvas");
  canvas.width = sheet.width;
  canvas.height = sheet.height;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.putImageData(new ImageData(sheet.rgba, sheet.width, sheet.height), 0, 0);
  return canvas;
}

export function hasPainter(speciesId) {
  return typeof PAINTERS[speciesId] === "function";
}

export { PAINTERS };
