#!/usr/bin/env node
/**
 * build-album.mjs — the owners' own photos, kept visibly apart from the listing set.
 *
 * Input   data/site.json `album.items`  [{ file, caption, season?, date? }]  (file = name without extension)
 *         <album.dir>/<file>.jpg|jpeg|png|heic-converted-to-jpg
 * Output  assets/img/album-<file>-<w>.webp/.jpg at the widths in images.sizes, every rendition carrying
 *         the `album.label` burned on (bottom-right, cream on a translucent ridge pill — the mirror image of the
 *         "Virtually staged" label so the two are never confused), plus <album.manifest>.
 *         An item whose file is missing is skipped with a note; the page renders the strip only from the manifest.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'site.json'), 'utf8'));
const A = site.album || { items: [] };
const SIZES = [...site.images.sizes].sort((a, b) => a - b);
const DIR = path.join(ROOT, A.dir || 'assets/album');
const MANIFEST = path.join(ROOT, A.manifest || 'assets/img/album-manifest.json');
const OUT = path.dirname(MANIFEST);
const LABEL = A.label || "From the owners' album";
const PAL = site.design.palette;

const exists = (p) => fs.stat(p).then(() => true, () => false);

function labelOverlay(w, h) {
  const fontPx = Math.max(15, Math.round(w * 0.03));
  const padX = Math.round(fontPx * 0.9), padY = Math.round(fontPx * 0.5);
  const textW = Math.round(LABEL.length * fontPx * 0.56);
  const pillW = textW + padX * 2, pillH = fontPx + padY * 2;
  const m = Math.round(w * 0.025);
  const x = w - m - pillW, y = h - m - pillH;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect x="${x}" y="${y}" width="${pillW}" height="${pillH}" rx="${Math.round(pillH / 2)}" fill="${PAL.ridge}" fill-opacity="0.78"/>
  <text x="${x + padX}" y="${y + padY + fontPx * 0.78}" font-family="Georgia, 'Times New Roman', serif" font-style="italic"
        font-size="${fontPx}" fill="${PAL.cream}">${LABEL}</text>
</svg>`);
}

await fs.mkdir(OUT, { recursive: true });
const entries = [];
for (const it of A.items || []) {
  const srcFile = (await Promise.all(['jpg', 'jpeg', 'png', 'JPG', 'JPEG'].map(async (ext) => ((await exists(path.join(DIR, `${it.file}.${ext}`))) ? `${it.file}.${ext}` : null)))).find(Boolean);
  if (!srcFile) { console.log(`note: album item "${it.file}" has no file in ${path.relative(ROOT, DIR)}; skipped`); continue; }
  const srcPath = path.join(DIR, srcFile);
  const meta = await sharp(srcPath).rotate().metadata();
  const srcW = meta.width, srcH = meta.height;
  const widths = [...new Set(SIZES.map((w) => Math.min(w, srcW)))];
  const sources = { webp: [], jpg: [] };
  let maxW = 0, maxH = 0;
  for (const w of widths) {
    const h = Math.round((srcH * w) / srcW);
    if (w > maxW) { maxW = w; maxH = h; }
    const base = await sharp(srcPath).rotate().resize({ width: w, withoutEnlargement: true })
      .composite([{ input: labelOverlay(w, h), top: 0, left: 0 }]).toBuffer();
    const outW = path.join(OUT, `album-${it.file}-${w}.webp`), outJ = path.join(OUT, `album-${it.file}-${w}.jpg`);
    await sharp(base).webp({ quality: 78 }).toFile(outW);
    await sharp(base).jpeg({ quality: 82, progressive: true, mozjpeg: true }).toFile(outJ);
    sources.webp.push({ w, src: path.relative(ROOT, outW).split(path.sep).join('/') });
    sources.jpg.push({ w, src: path.relative(ROOT, outJ).split(path.sep).join('/') });
  }
  const { dominant } = await sharp(srcPath).stats();
  const color = '#' + [dominant.r, dominant.g, dominant.b].map((v) => v.toString(16).padStart(2, '0')).join('');
  entries.push({ name: `album-${it.file}`, alt: it.alt || it.caption || LABEL, caption: it.caption || '', season: it.season || '', date: it.date || '', width: maxW, height: maxH, color, sources, group: 'album' });
  console.log(`[album] ${it.file}  ${srcW}x${srcH}  ->  ${widths.join('/')}`);
}
await fs.writeFile(MANIFEST, JSON.stringify(entries, null, 1));
console.log(`album manifest: ${entries.length} photo${entries.length === 1 ? '' : 's'}`);
