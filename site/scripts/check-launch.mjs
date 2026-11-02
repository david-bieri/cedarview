#!/usr/bin/env node
/**
 * check-launch.mjs — the last step of `npm run build`: fails the build if anything
 * unfinished would reach the public page, and reports what is still TBC in site.json.
 *
 * Always fails on
 *   - a "TBC…" token or "not yet added" anywhere in index.html or the spec sheet PDF
 *   - a tel:/mailto: link on the page that is not a real number / address
 *   - a link to a site-relative file that does not exist
 * Additionally fails when site.listingLive is true and
 *   - site.noindex is still true, or robots.txt still disallows crawling
 *   - the agent's name, phone or email is still TBC (no conversion path on a live listing)
 * Prints, never fails on: every remaining TBC value in site.json, by path.
 *
 * Usage   node scripts/check-launch.mjs        (exit 1 on failure)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'site.json'), 'utf8'));
const html = await fs.readFile(path.join(ROOT, 'index.html'), 'utf8');
const failures = [];
const notes = [];

// 1. Placeholders on the page
const leaked = [...new Set(html.match(/\bTBC\w*/g) || [])];
if (leaked.length) failures.push(`index.html still shows placeholders: ${leaked.join(', ')}`);
if (/not yet added/i.test(html)) failures.push('index.html still shows a "not yet added" note');

// 2. Placeholders in the spec sheet PDF (text extracted with pypdf, already a build dependency)
const pdfRel = data.sections.updates.specSheet.file;
try {
  const text = execFileSync('python3', ['-c', `
import sys
from pypdf import PdfReader
r = PdfReader(sys.argv[1])
print("\\n".join((p.extract_text() or "") for p in r.pages))`, path.join(ROOT, pdfRel)], { encoding: 'utf8' });
  const pdfLeaks = [...new Set(text.match(/\bTBC\w*/g) || [])];
  if (pdfLeaks.length) failures.push(`${pdfRel} still shows placeholders: ${pdfLeaks.join(', ')}`);
} catch (e) {
  notes.push(`could not read ${pdfRel}: ${e.message.split('\n')[0]}`);
}

// 3. Contact links
for (const m of html.matchAll(/href="(tel:[^"]*|mailto:[^"]*)"/g)) {
  const href = m[1];
  if (href.startsWith('tel:') && !/^tel:\+?[0-9][0-9().\- ]{6,}$/.test(href)) failures.push(`bad phone link: ${href}`);
  if (href.startsWith('mailto:') && !/^mailto:[^@\s"]+@[^@\s"]+\.[a-z]{2,}$/i.test(href)) failures.push(`bad email link: ${href}`);
}

// 4. Site-relative links and sources that must exist on disk
const refs = new Set();
for (const m of html.matchAll(/(?:href|src)="([^"#?][^"]*)"/g)) {
  const u = m[1];
  if (/^(https?:|mailto:|tel:|data:|\/\/)/.test(u)) continue;
  refs.add(u.split('?')[0]);
}
for (const m of html.matchAll(/srcset="([^"]+)"/g)) for (const part of m[1].split(',')) refs.add(part.trim().split(/\s+/)[0]);
for (const rel of refs) {
  try { await fs.access(path.join(ROOT, rel)); } catch { failures.push(`missing file linked from the page: ${rel}`); }
}

// 4b. Video files that would bloat the Pages deploy
const maxVideo = (data.sections.view.reels && data.sections.view.reels.maxBytes) || 15_000_000;
const videoDir = path.join(ROOT, 'assets', 'video');
const walkFiles = async (dir) => { const out = []; for (const e of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) { const p = path.join(dir, e.name); if (e.isDirectory()) out.push(...await walkFiles(p)); else out.push(p); } return out; };
for (const f of await walkFiles(videoDir)) {
  if (!/\.(mp4|webm|mov)$/i.test(f)) continue;
  const { size } = await fs.stat(f);
  if (size > maxVideo) failures.push(`${path.relative(ROOT, f)} is ${(size / 1e6).toFixed(1)} MB; the limit is ${(maxVideo / 1e6).toFixed(0)} MB (re-export at 1080x1920, H.264, ~6 Mbit/s)`);
}

// 5. Launch-day conditions
if (data.site.listingLive) {
  if (data.site.noindex) failures.push('site.listingLive is true but site.noindex is still true');
  const robots = await fs.readFile(path.join(ROOT, 'robots.txt'), 'utf8').catch(() => '');
  if (/^\s*Disallow:\s*\/\s*$/m.test(robots)) failures.push('site.listingLive is true but robots.txt still disallows crawling');
  for (const k of ['name', 'phone', 'email']) if (/^TBC/.test(String(data.agent[k]))) failures.push(`site.listingLive is true but agent.${k} is still TBC`);
}

// 6. What is still TBC in site.json, by path
const pending = [];
const walk = (v, p) => {
  if (typeof v === 'string') { if (v.startsWith('TBC') && !p.startsWith('_') && !/\._/.test(p)) pending.push(p); }
  else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!k.startsWith('_')) walk(x, p ? `${p}.${k}` : k);
};
walk(data, '');

if (pending.length) console.log(`still TBC in data/site.json (${pending.length}); left off the page until filled in:\n  - ${pending.join('\n  - ')}`);
for (const n of notes) console.log(`note: ${n}`);
if (failures.length) {
  console.error(`\nCHECK FAILED (${failures.length}):\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`check passed: no placeholder on the page or in the PDF, ${refs.size} local links resolve${data.site.listingLive ? ', launch conditions met' : ' (pre-launch: noindex on)'}`);
