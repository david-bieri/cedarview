#!/usr/bin/env node
/**
 * build-images.mjs — responsive image pipeline for cedarview.house
 *
 * Usage
 *   node scripts/build-images.mjs            # build what is stale, write manifest
 *   node scripts/build-images.mjs --force    # rebuild everything
 *   node scripts/build-images.mjs --quiet    # only print the summary line
 *   npm run images                           # same as the first form
 *
 * Input   <images.sourceDir>/*.jpg|jpeg|png      (from data/site.json)
 *         <images.sourceDir>/captions.json        optional alt/caption/group overrides:
 *           { "<name>": { "alt": "...", "caption": "...", "group": "..." } }
 * Output  assets/img/<name>-<width>.webp and .jpg at every width in images.sizes
 *         (never upscaled: a source narrower than a size gets that size at the
 *         source width), plus <images.manifest> — an ordered array of
 *           { name, alt, caption, staged, variant, pair?, width, height, aspect,
 *             color, lqip, sources: { webp: [{w, src}], jpg: [{w, src}] }, group,
 *             stagedSources?, stagedAlt?, stagedWidth?, stagedHeight? }
 *         where `src` is a site-root-relative path and `width`/`height` are the
 *         largest rendition's dimensions (same aspect as the source).
 *
 * Staging  For each name in images.stagedRooms, `<name>.jpg` is the UNSTAGED
 *         original (never labelled; staged:false, variant:"photo", pair:"<name>")
 *         and `<name><images.stagedSuffix>.jpg` is the STAGED version, which gets
 *         labels.virtuallyStaged burned onto every rendition (bottom-left, white
 *         type on a translucent dark pill). The staged renditions do not form a
 *         gallery item of their own: they are attached to the unstaged entry as
 *         `stagedSources` / `stagedAlt` / `stagedWidth` / `stagedHeight`, and the
 *         gallery toggles between the two. If only the staged file exists it is
 *         emitted as its own labelled entry (staged:true, variant:"staged").
 * Groups  captions.json `group` wins. Fallback inference: hero-* → hero ·
 *         view-* → view · lower-level-* → lower · upper-* → upper · plan-* → plans ·
 *         exterior-*, grounds-*, lot-*, entrance-*, front-door, deck-* → exterior ·
 *         else main.
 * Order   The hero named in images.hero is first; then the order of keys in
 *         captions.json for images listed there; images not in captions.json
 *         follow, by group (hero, exterior, main, upper, lower, view, plans) and
 *         then name.
 * Idempotent  A rendition is skipped when it is newer than its source, this
 *         script and data/site.json. The manifest is always rewritten, and
 *         renditions whose source has gone are removed.
 *
 * Needs `sharp` (devDependency). Placeholders for a dry run come from
 * scripts/make-placeholder-images.mjs.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELF = fileURLToPath(import.meta.url);
const SITE_JSON = path.join(ROOT, 'data', 'site.json');
const args = new Set(process.argv.slice(2));
const FORCE = args.has('--force');
const QUIET = args.has('--quiet');

const site = JSON.parse(await fs.readFile(SITE_JSON, 'utf8'));
const cfg = site.images;
const STAGED_LABEL = site.labels.virtuallyStaged;
const SIZES = [...cfg.sizes].sort((a, b) => a - b);
const SRC_DIR = path.join(ROOT, cfg.sourceDir);
const MANIFEST = path.join(ROOT, cfg.manifest);
const OUT_DIR = path.dirname(MANIFEST);
const STAGED_ROOMS = new Set(cfg.stagedRooms);
const SUFFIX = cfg.stagedSuffix || '-staged';
const GROUP_ORDER = ['hero', 'exterior', 'main', 'upper', 'lower', 'view', 'plans'];

const JPEG_OPTS = { quality: 82, progressive: true, mozjpeg: true, chromaSubsampling: '4:2:0' };
const WEBP_OPTS = { quality: 78, effort: 5 };

// ---------- helpers ----------
const exists = (p) => fs.stat(p).then((s) => s, () => null);
const log = (...m) => { if (!QUIET) console.log(...m); };

function groupFor(name) {
  if (name.startsWith('hero-') || name === cfg.hero) return 'hero';
  if (name.startsWith('view-')) return 'view';
  if (name.startsWith('lower-level-')) return 'lower';
  if (name.startsWith('upper-')) return 'upper';
  if (name.startsWith('plan-') || name.startsWith('plans-')) return 'plans';
  if (/^(exterior|grounds|lot|entrance|deck)(-|$)/.test(name) || name === 'front-door') return 'exterior';
  return 'main';
}

// Plain-English alt text from a file name. "lower-level-bedroom-1" -> "Lower level bedroom 1".
// Describes the house, never a buyer; the lower floor is always "lower level".
const WORDS = {
  hero: '', twilight: 'at twilight', aerial: 'from above', south: 'to the south',
  north: 'to the north', east: 'to the east', west: 'to the west', front: 'from the front',
  rear: 'from the rear', ll: 'lower level', bsmt: 'lower level',
};
function altFor(name) {
  let s = name.replace(/^lower-level-/, 'lower level ').replace(/^upper-/, 'upper floor ');
  s = s.split('-').map((t) => (t in WORDS ? WORDS[t] : t)).filter(Boolean).join(' ')
    .replace(/\s+/g, ' ').trim();
  if (s.startsWith('at twilight')) s = `The house ${s}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
const stagedAltFrom = (alt) => `${alt}, ${STAGED_LABEL.toLowerCase()}`;

// Translucent dark pill with white label, bottom-left; scales with width so it
// stays legible at the smallest size.
function labelOverlay(w, h) {
  const fontPx = Math.max(16, Math.round(w * 0.034));
  const padX = Math.round(fontPx * 0.9), padY = Math.round(fontPx * 0.55);
  const textW = Math.round(STAGED_LABEL.length * fontPx * 0.58);
  const pillW = textW + padX * 2, pillH = fontPx + padY * 2;
  const margin = Math.round(w * 0.025);
  const x = margin, y = h - margin - pillH;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect x="${x}" y="${y}" width="${pillW}" height="${pillH}" rx="${Math.round(pillH / 2)}"
        fill="#000" fill-opacity="0.62"/>
  <text x="${x + padX}" y="${y + padY + fontPx * 0.78}" font-family="Helvetica, Arial, sans-serif"
        font-size="${fontPx}" font-weight="600" fill="#fff">${STAGED_LABEL}</text>
</svg>`);
}

async function stale(out, deps) {
  if (FORCE) return true;
  const o = await exists(out);
  if (!o) return true;
  return deps.some((t) => t > o.mtimeMs);
}

// ---------- discover sources ----------
await fs.mkdir(OUT_DIR, { recursive: true });
const files = (await fs.readdir(SRC_DIR).catch(() => []))
  .filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
if (!files.length) {
  console.error(`No source images in ${path.relative(ROOT, SRC_DIR)}. Run scripts/make-placeholder-images.mjs or add photos.`);
  process.exit(1);
}
const captionsPath = path.join(SRC_DIR, 'captions.json');
const captionsRaw = (await exists(captionsPath)) ? JSON.parse(await fs.readFile(captionsPath, 'utf8')) : {};
const captions = Object.fromEntries(Object.entries(captionsRaw).filter(([k, v]) => !k.startsWith('_') && v && typeof v === 'object'));
const CAPTION_ORDER = new Map(Object.keys(captions).map((k, i) => [k, i]));
const depTimes = [(await fs.stat(SELF)).mtimeMs, (await fs.stat(SITE_JSON)).mtimeMs];

// Classify each source file: { name, file, role: 'photo' | 'staged', pair? }
//   <room>.jpg          -> unstaged original of a staged room (role photo, pair room)
//   <room><suffix>.jpg  -> staged version (role staged, pair room)
//   anything else       -> plain photo
const sourcesByName = new Map();
for (const file of files) {
  const name = path.basename(file).replace(/\.(jpe?g|png)$/i, '');
  if (sourcesByName.has(name)) { console.warn(`warning: duplicate source "${name}" (${file} ignored)`); continue; }
  let role = 'photo', pair;
  if (name.endsWith(SUFFIX) && STAGED_ROOMS.has(name.slice(0, -SUFFIX.length))) {
    role = 'staged'; pair = name.slice(0, -SUFFIX.length);
  } else if (STAGED_ROOMS.has(name)) {
    pair = name;
  }
  sourcesByName.set(name, { name, file, role, pair });
}

// ---------- build ----------
let built = 0, skipped = 0;

// Render every size of one source; returns { sources, width, height, srcW, srcH }.
async function render(src, label) {
  const srcPath = path.join(SRC_DIR, src.file);
  const srcStat = await fs.stat(srcPath);
  const deps = [...depTimes, srcStat.mtimeMs];
  const meta = await sharp(srcPath).metadata();
  const srcW = meta.width, srcH = meta.height;

  const widths = [...new Set(SIZES.map((w) => Math.min(w, srcW)))];
  const sources = { webp: [], jpg: [] };
  let maxW = 0, maxH = 0;

  for (const w of widths) {
    const h = Math.round((srcH * w) / srcW);
    if (w > maxW) { maxW = w; maxH = h; }
    const outs = { webp: path.join(OUT_DIR, `${src.name}-${w}.webp`), jpg: path.join(OUT_DIR, `${src.name}-${w}.jpg`) };
    for (const fmt of ['webp', 'jpg']) {
      sources[fmt].push({ w, src: path.relative(ROOT, outs[fmt]).split(path.sep).join('/') });
    }
    const need = await Promise.all(Object.values(outs).map((o) => stale(o, deps)));
    if (!need.some(Boolean)) { skipped += 2; continue; }

    let img = sharp(srcPath).rotate().resize({ width: w, withoutEnlargement: true });
    if (label) img = img.composite([{ input: labelOverlay(w, h), top: 0, left: 0 }]);
    const base = await img.toBuffer();
    if (need[0]) { await sharp(base).webp(WEBP_OPTS).toFile(outs.webp); built++; }
    if (need[1]) { await sharp(base).jpeg(JPEG_OPTS).toFile(outs.jpg); built++; }
  }
  log(`${label ? '[staged] ' : ''}${src.name}  ${srcW}x${srcH}  ->  ${widths.join('/')}`);
  return { sources, width: maxW, height: maxH, srcPath };
}

// Dominant colour and a tiny inline placeholder (LQIP), from the source.
async function colourAndLqip(srcPath) {
  const { dominant } = await sharp(srcPath).stats();
  const color = '#' + [dominant.r, dominant.g, dominant.b].map((v) => v.toString(16).padStart(2, '0')).join('');
  const lqipBuf = await sharp(srcPath).rotate().resize({ width: 24 }).blur(1).webp({ quality: 30 }).toBuffer();
  return { color, lqip: `data:image/webp;base64,${lqipBuf.toString('base64')}` };
}

const entries = [];
for (const src of sourcesByName.values()) {
  if (src.role === 'staged' && sourcesByName.has(src.pair)) continue; // folded into its pair below

  const o = captions[src.name] || {};
  const labelled = src.role === 'staged'; // only reached when the unstaged file is missing
  const r = await render(src, labelled);
  const baseAlt = o.alt || (labelled ? (captions[src.pair]?.alt || altFor(src.pair)) : altFor(src.name));
  const entry = {
    name: src.name,
    alt: labelled ? stagedAltFrom(baseAlt) : baseAlt,
    caption: o.caption || '',
    staged: labelled,
    variant: labelled ? 'staged' : 'photo',
    ...(src.pair ? { pair: src.pair } : {}),
    width: r.width,
    height: r.height,
    aspect: +(r.width / r.height).toFixed(4),
    ...(await colourAndLqip(r.srcPath)),
    sources: r.sources,
    group: o.group || captions[src.pair]?.group || groupFor(src.pair || src.name),
  };

  // Attach the staged renditions of a paired room to its unstaged entry.
  if (src.role === 'photo' && src.pair) {
    const stagedSrc = sourcesByName.get(`${src.pair}${SUFFIX}`);
    if (stagedSrc) {
      const s = await render(stagedSrc, true);
      const so = captions[stagedSrc.name] || {};
      entry.stagedSources = s.sources;
      entry.stagedAlt = stagedAltFrom(so.alt || baseAlt);
      entry.stagedWidth = s.width;
      entry.stagedHeight = s.height;
    } else {
      log(`note: staged room "${src.pair}" has no ${src.pair}${SUFFIX} source; emitted unstaged only`);
    }
  }
  entries.push(entry);
}

// ---------- order + write manifest ----------
const orderKey = (e) => CAPTION_ORDER.has(e.name) ? CAPTION_ORDER.get(e.name) : Infinity;
entries.sort((a, b) => {
  if (a.name === cfg.hero) return -1;
  if (b.name === cfg.hero) return 1;
  const ca = orderKey(a), cb = orderKey(b);
  if (ca !== cb) return ca - cb;
  const g = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group);
  return g || a.name.localeCompare(b.name, 'en', { numeric: true });
});

// Guard: a staged room listed in site.json must have a source image.
for (const room of cfg.stagedRooms) {
  if (!entries.some((e) => e.pair === room)) console.warn(`warning: staged room "${room}" has no source image in ${path.relative(ROOT, SRC_DIR)}`);
}
// Guard: the hero named in site.json must exist.
if (!entries.some((e) => e.name === cfg.hero)) console.warn(`warning: hero "${cfg.hero}" has no source image`);

// Remove stale renditions whose source has gone.
const keep = new Set(entries.flatMap((e) => [
  ...e.sources.webp, ...e.sources.jpg,
  ...(e.stagedSources ? [...e.stagedSources.webp, ...e.stagedSources.jpg] : []),
].map((s) => path.basename(s.src))));
let removed = 0;
for (const f of await fs.readdir(OUT_DIR)) {
  if (/-\d+\.(webp|jpg)$/.test(f) && !keep.has(f)) { await fs.unlink(path.join(OUT_DIR, f)); removed++; }
}

await fs.writeFile(MANIFEST, JSON.stringify(entries, null, 2) + '\n');
const paired = entries.filter((e) => e.stagedSources).length;
console.log(`images: ${entries.length} entries (${paired} with staged pairs), ${built} renditions written, ${skipped} up to date, ${removed} stale removed -> ${path.relative(ROOT, MANIFEST)}`);
