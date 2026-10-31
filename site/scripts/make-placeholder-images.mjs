#!/usr/bin/env node
/**
 * make-placeholder-images.mjs
 *
 * Writes obviously-placeholder source images into `images.sourceDir`
 * (from data/site.json) so that `scripts/build-images.mjs` can be run
 * end to end before the real photographs arrive.
 *
 *   node scripts/make-placeholder-images.mjs            # fill in what is missing
 *   node scripts/make-placeholder-images.mjs --force    # overwrite every placeholder
 *   node scripts/make-placeholder-images.mjs --no-prune # keep stale sources
 *
 * One placeholder per key in <images.sourceDir>/captions.json, plus a
 * `<room><images.stagedSuffix>` variant for every room in `images.stagedRooms`
 * (the build script burns the "virtually staged" label onto that file only).
 * Each is a soft colour field with the file name in small type, coloured
 * roughly by group so the dry-run page reads the way the real one will:
 *   hero / exterior  warm cream #EFE9DC with a cobalt #2B4C8C block
 *   view             blue-grey #2E3A4F gradient
 *   main / upper     off-white #F3EFE6 with an oak #B8864C bar
 *   lower            light #F5F2EA
 *   plans            white with a thin grey grid
 * Source files whose name is in neither captions.json nor the staged list are
 * removed (old placeholders), unless --no-prune is given.
 *
 * Delete these once the curated photos are in place — the build script treats
 * any *.jpg|jpeg|png in the source directory as a photo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'site.json'), 'utf8'));
const srcDir = path.join(ROOT, site.images.sourceDir);
const force = process.argv.includes('--force');
const prune = !process.argv.includes('--no-prune');
const SUFFIX = site.images.stagedSuffix || '-staged';
const P = site.design?.palette || {};
const C = {
  cream: P.cream || '#EFE9DC', cobalt: P.cobalt || '#2B4C8C', ridge: P.ridge || '#2E3A4F',
  oak: P.oak || '#B8864C', ink: P.ink || '#1D2430', muted: P.muted || '#5B6170',
};

const captionsRaw = JSON.parse(await fs.readFile(path.join(srcDir, 'captions.json'), 'utf8'));
const captions = Object.fromEntries(Object.entries(captionsRaw).filter(([k, v]) => !k.startsWith('_') && v && typeof v === 'object'));

function groupFor(name) {
  if (captions[name]?.group) return captions[name].group;
  if (name === site.images.hero || name.startsWith('hero-')) return 'hero';
  if (name.startsWith('view-')) return 'view';
  if (name.startsWith('lower-level-')) return 'lower';
  if (name.startsWith('upper-')) return 'upper';
  if (name.startsWith('plan-')) return 'plans';
  if (/^(exterior|grounds|lot|entrance|deck)(-|$)/.test(name) || name === 'front-door') return 'exterior';
  return 'main';
}

const list = [];
for (const name of Object.keys(captions)) {
  list.push({ name, group: groupFor(name), w: 2400, h: 1600 });
  if (site.images.stagedRooms.includes(name)) {
    list.push({ name: `${name}${SUFFIX}`, group: groupFor(name), w: 2400, h: 1600, staged: true });
  }
}
// Staged rooms listed in site.json but missing from captions.json still get both files.
for (const room of site.images.stagedRooms) {
  if (!captions[room]) {
    list.push({ name: room, group: groupFor(room), w: 2400, h: 1600 });
    list.push({ name: `${room}${SUFFIX}`, group: groupFor(room), w: 2400, h: 1600, staged: true });
  }
}

const FONT = 'font-family="Helvetica, Arial, sans-serif"';

function background({ group, w, h, name }) {
  const hero = name === site.images.hero;
  switch (group) {
    case 'hero':
    case 'exterior': {
      // warm cream field with a cobalt block (the front door), hero gets a twilight sky band
      const bw = Math.round(w * 0.16), bh = Math.round(h * 0.42);
      const bx = Math.round(w * 0.62), by = h - bh - Math.round(h * 0.12);
      const sky = hero ? `<rect width="${w}" height="${Math.round(h * 0.38)}" fill="url(#sky)"/>` : '';
      return `<rect width="${w}" height="${h}" fill="${C.cream}"/>${sky}
  <rect x="0" y="${h - Math.round(h * 0.12)}" width="${w}" height="${Math.round(h * 0.12)}" fill="#E3DBC9"/>
  <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="${C.cobalt}"/>`;
    }
    case 'view':
      return `<rect width="${w}" height="${h}" fill="url(#view)"/>
  <path d="M0 ${h * 0.62} L${w * 0.18} ${h * 0.5} L${w * 0.36} ${h * 0.58} L${w * 0.55} ${h * 0.44} L${w * 0.74} ${h * 0.55} L${w} ${h * 0.47} L${w} ${h} L0 ${h} Z" fill="#26324A" fill-opacity="0.9"/>`;
    case 'lower':
      return `<rect width="${w}" height="${h}" fill="#F5F2EA"/>
  <rect x="0" y="${Math.round(h * 0.78)}" width="${w}" height="${Math.round(h * 0.22)}" fill="#E8E3D6"/>`;
    case 'plans': {
      const step = Math.round(w / 24);
      return `<rect width="${w}" height="${h}" fill="#FFFFFF"/>
  <rect width="${w}" height="${h}" fill="url(#grid)"/>
  <rect x="${step * 3}" y="${step * 2}" width="${step * 18}" height="${step * 11}" fill="none" stroke="${C.muted}" stroke-width="3"/>
  <line x1="${step * 11}" y1="${step * 2}" x2="${step * 11}" y2="${step * 13}" stroke="${C.muted}" stroke-width="2"/>
  <line x1="${step * 3}" y1="${step * 8}" x2="${step * 11}" y2="${step * 8}" stroke="${C.muted}" stroke-width="2"/>`;
    }
    default: // main, upper: off-white with an oak bar (the floor)
      return `<rect width="${w}" height="${h}" fill="#F3EFE6"/>
  <rect x="0" y="${Math.round(h * 0.74)}" width="${w}" height="${Math.round(h * 0.26)}" fill="${C.oak}"/>`;
  }
}

function svgFor(item) {
  const { name, w, h, group } = item;
  const dark = group === 'view';
  const ink = dark ? '#FFFFFF' : C.ink;
  const fs = Math.round(w / 60);
  const step = Math.round(w / 24);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="view" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FA3BF"/><stop offset="0.5" stop-color="${C.ridge}"/><stop offset="1" stop-color="#1D2430"/></linearGradient>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3B4A66"/><stop offset="1" stop-color="${C.cream}"/></linearGradient>
    <pattern id="grid" width="${step}" height="${step}" patternUnits="userSpaceOnUse"><path d="M ${step} 0 L 0 0 0 ${step}" fill="none" stroke="#D5D5D5" stroke-width="1"/></pattern>
  </defs>
  ${background(item)}
  <text x="${w / 2}" y="${h / 2}" text-anchor="middle" ${FONT}
        font-size="${fs}" fill="${ink}" fill-opacity="0.6" letter-spacing="2">PLACEHOLDER${item.staged ? ' · STAGED VERSION' : ''}</text>
  <text x="${w / 2}" y="${h / 2 + fs * 1.6}" text-anchor="middle" ${FONT}
        font-size="${Math.round(fs * 0.7)}" fill="${ink}" fill-opacity="0.6">${name}.jpg · ${w}×${h} · ${group}</text>
</svg>`;
}

await fs.mkdir(srcDir, { recursive: true });
let written = 0;
for (const item of list) {
  const out = path.join(srcDir, `${item.name}.jpg`);
  if (!force && await fs.stat(out).then(() => true, () => false)) continue;
  await sharp(Buffer.from(svgFor(item))).jpeg({ quality: 88 }).toFile(out);
  written++;
}

// Prune source images whose names are no longer in captions.json (old placeholders).
let pruned = 0;
if (prune) {
  const wanted = new Set(list.map((i) => i.name));
  for (const f of await fs.readdir(srcDir)) {
    if (!/\.(jpe?g|png)$/i.test(f)) continue;
    const name = f.replace(/\.(jpe?g|png)$/i, '');
    if (!wanted.has(name)) { await fs.unlink(path.join(srcDir, f)); pruned++; console.log(`pruned stale source ${f}`); }
  }
}
console.log(`placeholders: ${written} written, ${list.length - written} already present, ${pruned} pruned (${path.relative(ROOT, srcDir)})`);
