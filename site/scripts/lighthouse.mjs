#!/usr/bin/env node
/**
 * lighthouse.mjs — mobile Lighthouse audit of the site as it will be on launch day.
 *
 * The committed index.html carries <meta name="robots" content="noindex"> until the
 * MLS listing is live, which caps Lighthouse's SEO score (is-crawlable fails). This
 * script builds a LAUNCH_PREVIEW copy of the page into a temp dir alongside the real
 * css/, js/ and assets/, serves it, and audits that. Nothing in the repo is changed.
 *
 * Usage:  node scripts/lighthouse.mjs            (needs Chrome; set CHROME_PATH if not on PATH)
 * Output: scores for performance / accessibility / SEO, plus the JSON report path.
 */
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cedarview-lh-'));
for (const d of ['css', 'js', 'assets']) fs.cpSync(path.join(ROOT, d), path.join(tmp, d), { recursive: true });
execSync(`node scripts/build-page.mjs`, { cwd: ROOT, env: { ...process.env, LAUNCH_PREVIEW: '1', PAGE_OUT: path.join(tmp, 'index.html') }, stdio: 'inherit' });

const port = 8089;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: tmp, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const out = path.join(tmp, 'lighthouse.json');
try {
  execSync(`npx --yes lighthouse http://127.0.0.1:${port}/ --form-factor=mobile --screenEmulation.mobile --chrome-flags="--headless --no-sandbox" --only-categories=performance,accessibility,seo --output=json --output-path=${out} --quiet`, { cwd: ROOT, stdio: 'inherit' });
  const r = JSON.parse(fs.readFileSync(out, 'utf8'));
  const s = Object.fromEntries(Object.entries(r.categories).map(([k, v]) => [k, Math.round(v.score * 100)]));
  console.log(`\nLighthouse (mobile, launch preview): performance ${s.performance}  accessibility ${s.accessibility}  seo ${s.seo}`);
  console.log(`report: ${out}`);
  process.exitCode = Object.values(s).every((v) => v >= 90) ? 0 : 1;
} finally {
  server.kill();
}
