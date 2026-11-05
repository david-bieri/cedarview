#!/usr/bin/env node
/**
 * build-album.mjs — the owners' own photos and short clips, kept visibly apart from the listing set.
 *
 * Input   <album.dir>/album.txt — one line per item, in page order:  file | season | caption
 *         (comments with #; see the header of that file). Photos: .jpg/.jpeg/.png. Clips: .mp4 with a .jpg
 *         poster of the same name beside it.
 * Output  Photos  → assets/img/album-<name>-<w>.webp/.jpg at the widths in images.sizes, every rendition carrying
 *                   the `album.label` burned on (bottom-right, cream on a translucent ridge pill).
 *         Clips   → assets/img/album-<name>-poster-<w>.jpg from the poster (unlabelled: the clip is already the
 *                   owners' own); the .mp4 is served from the album folder as-is.
 *         <album.manifest> with one entry per item ({type:"photo"|"clip", season, group, caption, ...}).
 *
 * A file in the folder that album.txt doesn't list gets a stub line appended ("[caption]") and a note; it stays
 * off the page until the caption is written. A listed file that doesn't exist is skipped with a note.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'site.json'), 'utf8'));
const A = site.album || {};
const SIZES = [...site.images.sizes].sort((a, b) => a - b);
const DIR = path.join(ROOT, A.dir || 'assets/album');
const LIST = path.join(DIR, A.list || 'album.txt');
const MANIFEST = path.join(ROOT, A.manifest || 'assets/img/album-manifest.json');
const OUT = path.dirname(MANIFEST);
const LABEL = A.label || "From the owners' album";
const PAL = site.design.palette;
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const exists = (p) => fs.stat(p).then(() => true, () => false);

// ---------- the list ----------
const PHOTO_EXT = /\.(jpe?g|png)$/i, CLIP_EXT = /\.mp4$/i;
const raw = (await exists(LIST)) ? await fs.readFile(LIST, 'utf8') : '';
const items = [];
raw.split(/\r?\n/).forEach((line, i) => {
  const s = line.trim();
  if (!s || s.startsWith('#')) return;
  const [file = '', season = '', ...rest] = s.split('|').map((x) => x.trim());
  const caption = rest.join('|').trim();
  if (!file) { console.log(`note: ${rel(LIST)}:${i + 1} has no file name; skipped`); return; }
  items.push({ file, season, caption, line: i + 1 });
});

// Files in the folder that the list doesn't know about: stub them so the next edit is obvious.
const listed = new Set(items.map((it) => it.file.toLowerCase()));
const inFolder = (await fs.readdir(DIR).catch(() => [])).filter((f) => PHOTO_EXT.test(f) || CLIP_EXT.test(f));
const posters = new Set(inFolder.filter((f) => CLIP_EXT.test(f)).map((f) => f.replace(CLIP_EXT, '.jpg').toLowerCase()));
const unlisted = inFolder.filter((f) => !listed.has(f.toLowerCase()) && !posters.has(f.toLowerCase())).sort();
if (unlisted.length) {
  const stub = unlisted.map((f) => `${f} |  | [caption]`).join('\n');
  await fs.writeFile(LIST, `${raw.replace(/\s*$/, '')}\n\n# Added by the build — write the season and caption, then remove the brackets.\n${stub}\n`);
  console.log(`note: ${unlisted.length} file${unlisted.length === 1 ? '' : 's'} in ${rel(DIR)} not in album.txt; stub line${unlisted.length === 1 ? '' : 's'} added:\n  - ${unlisted.join('\n  - ')}`);
}

// ---------- season tab for a label ----------
const GROUPS = [
  ['spring', /\b(spring|march|april|may|blossom)\b/i],
  ['summer', /\b(summer|june|july|august)\b/i],
  ['autumn', /\b(autumn|fall|september|october|november)\b/i],
  ['winter', /\b(winter|december|january|february|snow|christmas)\b/i],
];
const groupFor = (season) => (GROUPS.find(([, re]) => re.test(season || '')) || [''])[0];

// ---------- the label burned on photos ----------
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

async function renditions(srcPath, stem, label) {
  const meta = await sharp(srcPath).rotate().metadata();
  const srcW = meta.width, srcH = meta.height;
  const widths = [...new Set(SIZES.map((w) => Math.min(w, srcW)))];
  const sources = { webp: [], jpg: [] };
  let maxW = 0, maxH = 0;
  for (const w of widths) {
    const h = Math.round((srcH * w) / srcW);
    if (w > maxW) { maxW = w; maxH = h; }
    let img = sharp(srcPath).rotate().resize({ width: w, withoutEnlargement: true });
    if (label) img = img.composite([{ input: labelOverlay(w, h), top: 0, left: 0 }]);
    const base = await img.toBuffer();
    const outW = path.join(OUT, `${stem}-${w}.webp`), outJ = path.join(OUT, `${stem}-${w}.jpg`);
    await sharp(base).webp({ quality: 78 }).toFile(outW);
    await sharp(base).jpeg({ quality: 82, progressive: true, mozjpeg: true }).toFile(outJ);
    sources.webp.push({ w, src: rel(outW) });
    sources.jpg.push({ w, src: rel(outJ) });
  }
  const { dominant } = await sharp(srcPath).stats();
  const color = '#' + [dominant.r, dominant.g, dominant.b].map((v) => v.toString(16).padStart(2, '0')).join('');
  return { width: maxW, height: maxH, color, sources, srcW, srcH, widths };
}

function clipSeconds(file) {
  try {
    const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
    const s = parseFloat(out);
    return Number.isFinite(s) ? Math.round(s) : null;
  } catch { return null; }
}

// ---------- build ----------
await fs.mkdir(OUT, { recursive: true });
const entries = [];
for (const it of items) {
  const srcPath = path.join(DIR, it.file);
  if (!(await exists(srcPath))) { console.log(`note: album.txt:${it.line} "${it.file}" is not in ${rel(DIR)}; skipped`); continue; }
  if (!it.caption || /^\[.*\]$/.test(it.caption)) { console.log(`note: album.txt:${it.line} "${it.file}" has no caption yet; left off the page`); continue; }
  const name = it.file.replace(/\.[^.]+$/, '');
  const base = { name: `album-${name}`, caption: it.caption, season: it.season, group: groupFor(it.season), alt: it.caption };
  if (CLIP_EXT.test(it.file)) {
    const posterPath = path.join(DIR, `${name}.jpg`);
    if (!(await exists(posterPath))) { console.log(`note: clip "${it.file}" has no ${name}.jpg poster beside it; skipped`); continue; }
    const r = await renditions(posterPath, `album-${name}-poster`, false);
    const seconds = clipSeconds(srcPath);
    entries.push({ ...base, type: 'clip', src: rel(srcPath), seconds, width: r.width, height: r.height, color: r.color, sources: r.sources, alt: `Clip: ${it.caption}` });
    console.log(`[album] ${it.file}  clip${seconds ? ` ${seconds}s` : ''}, poster ${r.srcW}x${r.srcH}  ->  ${r.widths.join('/')}`);
  } else {
    const r = await renditions(srcPath, `album-${name}`, true);
    entries.push({ ...base, type: 'photo', width: r.width, height: r.height, color: r.color, sources: r.sources });
    console.log(`[album] ${it.file}  ${r.srcW}x${r.srcH}  ->  ${r.widths.join('/')}`);
  }
}
await fs.writeFile(MANIFEST, JSON.stringify(entries, null, 1));
const photos = entries.filter((e) => e.type === 'photo').length, clips = entries.length - photos;
console.log(`album manifest: ${photos} photo${photos === 1 ? '' : 's'}, ${clips} clip${clips === 1 ? '' : 's'}`);
