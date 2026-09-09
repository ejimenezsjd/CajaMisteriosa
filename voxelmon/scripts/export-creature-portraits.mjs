/**
 * Exporta portraits 3D (fondo transparente) desde el mismo modelo de juego.
 * Requiere: python/static server en :8080 y puppeteer (p.ej. /tmp/vmtest).
 *
 *   VM_URL=http://localhost:8080/voxelmon/ node voxelmon/scripts/export-creature-portraits.mjs
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
let puppeteer;
try { puppeteer = require("puppeteer"); }
catch { puppeteer = require("/tmp/vmtest/node_modules/puppeteer"); }

const GAME_URL = process.env.VM_URL || "http://localhost:8080/voxelmon/";
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../assets/creature-portraits");

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage();
  page.on("dialog", (d) => d.accept());
  await page.goto(GAME_URL, { waitUntil: "networkidle2" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle2" });
  await page.click("#btn-new");
  await page.waitForSelector(".starter-card");
  await page.click(".starter-card");
  await page.waitForFunction("window.__vm && window.__vm.mode === 'play'", { timeout: 60000 });

  const list = await page.evaluate(() => window.__vm.debug.artCatalog().map((c) => c.speciesId));
  for (const id of list) {
    const png = await page.evaluate((sid) => window.__vm.debug.dumpPortrait(sid)?.icon, id);
    if (!png || !png.startsWith("data:image")) {
      console.warn("skip", id);
      continue;
    }
    const buf = Buffer.from(png.split(",")[1], "base64");
    fs.writeFileSync(path.join(OUT, `${id}.png`), buf);
    console.log("wrote", id, buf.length);
  }
  console.log("portraits", list.length, "→", OUT);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
