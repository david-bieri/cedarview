#!/usr/bin/env node
/**
 * map-image.mjs — renders the live Leaflet map once with headless Chrome and saves it as the
 * no-JS / print fallback named in data/site.json sections.blacksburg.map.fallbackImage.
 *
 * Needs a built index.html, Chrome (CHROME_PATH or on PATH) and the `playwright` package resolvable
 * from this machine; it is a local, occasional step, not part of `npm run build`. Re-run it after
 * adding or moving a place.
 *
 * Usage   npm run map-image
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'site.json'), 'utf8'));
const out = path.join(ROOT, site.sections.blacksburg.map.fallbackImage);

let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); }
catch { try { ({ chromium } = createRequire('/opt/npm-tools/node_modules/')('playwright')); } catch { console.error('playwright not found; skip'); process.exit(0); } }

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const server = createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'index.html';
  try { const buf = await fs.readFile(path.join(ROOT, rel)); res.writeHead(200, { 'content-type': TYPES[path.extname(rel)] || 'application/octet-stream' }); res.end(buf); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 });
await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.getElementById('map').scrollIntoView());
await page.waitForSelector('#map.map-live .leaflet-tile-loaded', { timeout: 20000 });
await page.waitForTimeout(2500);
await page.locator('#map').screenshot({ path: out });
await browser.close();
server.close();
console.log(`wrote ${path.relative(ROOT, out)}`);
