/**
 * Exporta hojas PNG desde los pintores (misma fuente que el fallback canvas).
 * Uso: node voxelmon/scripts/export-creature-pngs.mjs
 */
import { deflateSync } from "zlib";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const jsDir = join(here, "../js");
const outDir = join(here, "../assets/creatures");

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcBuf));
  return Buffer.concat([len, t, data, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4)
      .copy(raw, y * (width * 4 + 1) + 1);
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const { renderSheet } = await import(pathToFileURL(join(jsDir, "creature-pixels.js")).href);
const { listPixelSpecies } = await import(pathToFileURL(join(jsDir, "creature-art.js")).href);

mkdirSync(outDir, { recursive: true });
for (const id of listPixelSpecies()) {
  const sheet = renderSheet(id);
  if (!sheet) continue;
  const buf = encodePng(sheet.width, sheet.height, sheet.rgba);
  const dest = join(outDir, `${id}.png`);
  writeFileSync(dest, buf);
  console.log(`wrote ${dest} (${sheet.width}x${sheet.height})`);
}
