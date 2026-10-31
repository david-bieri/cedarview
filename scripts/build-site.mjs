#!/usr/bin/env node
// Builds the listing site in site/ (images → PDF → page) and copies the publishable files into dist/.
// dist/ is then also the target for the punch-list app build (vite, under /prep-7c3/).
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const site = path.join(root, 'site');
const dist = path.join(root, 'dist');

execSync('npm ci --no-audit --no-fund', { cwd: site, stdio: 'inherit' });
execSync('npm run build', { cwd: site, stdio: 'inherit' });

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

// What the public site needs. Sources, scripts, data and docs stay out of dist/.
const publish = ['index.html', 'css', 'js', 'robots.txt', 'CNAME', '.nojekyll', 'assets/img', 'assets/plans', 'assets/video', 'assets/cedarview-specs.pdf'];
for (const rel of publish) {
  const from = path.join(site, rel);
  if (!fs.existsSync(from)) continue;
  fs.cpSync(from, path.join(dist, rel), { recursive: true });
}
// Domain and Jekyll bypass live at the repo root so they are easy to find.
for (const f of ['CNAME', '.nojekyll']) if (fs.existsSync(path.join(root, f))) fs.copyFileSync(path.join(root, f), path.join(dist, f));
console.log('dist/ ready:', fs.readdirSync(dist).join(', '));
