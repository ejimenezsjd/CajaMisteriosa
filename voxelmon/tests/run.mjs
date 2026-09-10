// Real browser modules, local vendor Three.js, isolated storage. No app mocks.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const server = createServer(async (req, res) => {
  const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!path.startsWith(root.replace(/[\\/]$/, '') + sep)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': ({ '.js':'text/javascript', '.html':'text/html', '.css':'text/css', '.json':'application/json' })[extname(path)] ?? 'application/octet-stream', 'Cache-Control':'no-store' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  await page.goto(origin + '/tests/fixture.html');
  const result = await page.evaluate(async () => (await import('./integrity.js')).run());
  result.pageErrors = errors;
  if (process.env.RESULT_FILE) await writeFile(process.env.RESULT_FILE, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.checks.some(c => !c.pass) || errors.length ? 1 : 0;
} finally { await browser.close(); await new Promise(r => server.close(r)); }
