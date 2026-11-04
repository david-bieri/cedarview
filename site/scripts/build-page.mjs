#!/usr/bin/env node
/**
 * build-page.mjs — writes index.html for cedarview.house
 *
 * Usage
 *   node scripts/build-page.mjs
 *   npm run page
 *
 * Input   data/site.json            — every fact, figure, date, label, name and the design palette
 *         assets/img/manifest.json  — every image, rendition and alt text (paired staged variants included)
 * Output  index.html                — one scrolling page, mobile first
 *         scripts/tracked-links.md  — per-channel UTM links (site.url + channels[].utm)
 *
 * Design direction (site.json `design.direction`): a full-bleed hero and a square-tiled
 * gallery, then numbered, hairline-ruled sections. Colours come only from `design.palette`.
 *
 * Nothing on the page is hard-coded. Values beginning with "TBC" are placeholders
 * awaiting the owner; the public page never shows them. A line, row, list item or
 * whole section whose data is still TBC is left out, and what was left out is
 * printed at the end of the build (and checked by scripts/check-launch.mjs).
 * PREVIEW_TBC=1 (npm run review) renders every placeholder inside <span class="tbc">
 * instead, for proofreading; pair it with PAGE_OUT=review.html so index.html stays public.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'site.json'), 'utf8'));
const site = data.site; // site-level settings; everything else is read from `data`
const manifest = JSON.parse(await fs.readFile(path.join(ROOT, data.images.manifest), 'utf8'));
const PAL = data.design.palette;
const TYPE = data.design.type;

// ---------- helpers ----------
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const attr = esc;
const REVIEW = Boolean(process.env.PREVIEW_TBC);
const isTbc = (v) => typeof v === 'string' && v.startsWith('TBC');
/** Everything the public build left out because its value is still TBC; printed at the end. */
const omitted = [];
const omit = (what) => { if (!omitted.includes(what)) omitted.push(what); };
/** Escape a value. A TBC placeholder renders as a marked span in review mode and as nothing in public mode. */
const t = (v) => (isTbc(v) ? (REVIEW ? `<span class="tbc">${esc(v)}</span>` : (omit(v), '')) : esc(v));
/** True when every value is confirmed (none begins with TBC). */
const ready = (...vals) => vals.every((v) => !isTbc(v));
/** True when a site-relative asset path exists on disk; missing assets never become dead links. */
const exists = async (rel) => fs.access(path.join(ROOT, rel)).then(() => true, () => false);
const missing = (what) => (REVIEW ? `<span class="tbc">${esc(what)} not yet added</span>` : (omit(what), ''));
const get = (obj, dotted) => dotted.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
/** Resolve "{a.b.c}" placeholders from site.json. Returns '' in public mode if any piece is still TBC. */
const resolveLine = (line) => {
  const parts = line.split(/(\{[a-zA-Z0-9_.]+\})/g);
  const values = parts.map((p) => { const m = p.match(/^\{([a-zA-Z0-9_.]+)\}$/); return m ? get(data, m[1]) : undefined; });
  if (!REVIEW && values.some(isTbc)) { omit(line); return ''; }
  return parts.map((part, i) => (values[i] === undefined ? esc(part) : t(values[i]))).join('');
};
const p = (html) => (html ? `<p>${html}</p>` : '');
const num = (n) => Number(n).toLocaleString(site.language);
const abs = (p) => `${site.url}/${p}`;
const paragraphs = (arr) => arr.map((para) => p(t(para))).filter(Boolean).join('\n');
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const pad2 = (n) => String(n).padStart(2, '0');

// ---------- images ----------
const heroImg = manifest.find((i) => i.name === data.images.hero) || manifest.find((i) => i.group === 'hero');
// Daylight exterior shown directly under the hero (images.daylight); it then stays out of the grounds gallery.
const daylightImg = data.images.daylight ? manifest.find((i) => i.name === data.images.daylight) : null;
const viewImgs = manifest.filter((i) => i.group === 'view');
const viewImg = viewImgs[0];
const exteriorImgs = manifest.filter((i) => i.group === 'exterior' && i !== daylightImg);
const lowerImgs = manifest.filter((i) => i.group === 'lower');
const planImgs = manifest.filter((i) => i.group === 'plans');
const tourPoster = manifest.find((i) => i.name === data.property.tour.poster) || manifest.find((i) => i.group === 'main') || heroImg;
// Main gallery: the interior groups; exterior, lower and view photographs have their own galleries.
const galleryImgs = manifest.filter((i) => !['hero', 'plans', 'view', 'exterior', 'lower'].includes(i.group));
// Every non-hero image (the plans included) gets one index into the lightbox list; paired tiles carry both variants under one index.
const lightboxList = manifest.filter((i) => i.group !== 'hero');
const lbIndex = new Map(lightboxList.map((img, i) => [img.name, i]));

const srcset = (list) => list.map((s) => `${s.src} ${s.w}w`).join(', ');
const largest = (list) => list[list.length - 1];
const GALLERY_SIZES = '(min-width: 64rem) 23rem, (min-width: 40rem) 50vw, 100vw';
const FEATURE_SIZES = '(min-width: 64rem) 46rem, (min-width: 40rem) 50vw, 100vw';
const ROW_SIZES = '(min-width: 40rem) 33vw, 100vw';

function picture(img, { sizes, eager = false, priority = false, className = '', extra = '' } = {}) {
  const jpg = largest(img.sources.jpg);
  // Only the hero (LCP candidate) gets fetchpriority="high"; other eager images load at normal priority.
  const loading = eager ? `loading="eager"${priority ? ' fetchpriority="high"' : ''}` : 'loading="lazy"';
  return `<picture${extra}>
<source type="image/webp" srcset="${attr(srcset(img.sources.webp))}" sizes="${attr(sizes)}">
<img src="${attr(jpg.src)}" srcset="${attr(srcset(img.sources.jpg))}" sizes="${attr(sizes)}" alt="${attr(img.alt)}" width="${img.width}" height="${img.height}" ${loading} decoding="async" style="aspect-ratio:${img.width} / ${img.height};background-color:${attr(img.color)}"${className ? ` class="${className}"` : ''}>
</picture>`;
}

/** Gallery-wide photo / staged control: a line of text, the active state underlined (js/gallery.js keeps it in step). */
const variantToggle = (scope, labelFor) => `<div class="vtoggle" role="group" aria-label="${attr(labelFor)}"><span class="vtoggle-lead">Showing:</span>
<button type="button" data-variant="photo" data-scope="${scope}" aria-pressed="true">As photographed</button>
<button type="button" data-variant="staged" data-scope="${scope}" aria-pressed="false">${esc(data.labels.virtuallyStaged)}</button>
</div>`;
/** Per-photo control: one text link that flips the pair; its label is rewritten by js/gallery.js. */
const flipLink = (alt) => `<button type="button" class="vflip" data-flip aria-label="${attr(`${alt}: show ${data.labels.virtuallyStaged.toLowerCase()}`)}">Show ${esc(data.labels.virtuallyStaged.toLowerCase())}</button>`;

function galleryFigure(img, position, nearFold, sizes, lead) {
  const idx = lbIndex.get(img.name);
  const eager = nearFold && position < 2; // first couple of tiles in the main gallery sit near the fold
  const paired = Boolean(img.stagedSources);
  const caption = img.caption ? `<span class="cap">${esc(img.caption)}</span>` : '';
  // Paired tiles carry both variants as data attributes; js/gallery.js swaps the <picture> sources and alt.
  const pairData = paired ? ` data-pair="${attr(img.pair)}" data-variant="photo"`
    + ` data-photo-webp="${attr(srcset(img.sources.webp))}" data-photo-jpg="${attr(srcset(img.sources.jpg))}" data-photo-src="${attr(largest(img.sources.jpg).src)}" data-photo-alt="${attr(img.alt)}"`
    + ` data-staged-webp="${attr(srcset(img.stagedSources.webp))}" data-staged-jpg="${attr(srcset(img.stagedSources.jpg))}" data-staged-src="${attr(largest(img.stagedSources.jpg).src)}" data-staged-alt="${attr(img.stagedAlt)}"` : '';
  // A staged pair's caption carries the word (shown only while the staged frame is up) and a one-link flip.
  const stagedWord = paired ? `<span class="cap-staged" hidden>${caption ? ` &middot; ${esc(data.labels.virtuallyStaged.toLowerCase())}` : esc(data.labels.virtuallyStaged)}</span>` : '';
  const fc = caption || paired ? `<figcaption><span class="cap-text">${caption}${stagedWord}</span>${paired ? flipLink(img.alt) : ''}</figcaption>` : '';
  return `<figure class="tile${lead && position === 0 ? ' tile-lead' : ''}"${pairData}>
<button type="button" class="tile-btn" data-lb="${idx}" aria-label="${attr(`Enlarge: ${img.alt}`)}">
${picture(img, { sizes: lead && position === 0 ? FEATURE_SIZES : sizes, eager })}
</button>
${fc}
</figure>`;
}

const gallery = (imgs, id, { nearFold = false, sizes = GALLERY_SIZES, cls = '', lead = false } = {}) => `<div class="gallery${cls ? ` ${cls}` : ''}" id="${id}">
${imgs.map((img, i) => galleryFigure(img, i, nearFold, sizes, lead)).join('\n')}
</div>`;

const lightboxData = lightboxList.map((img) => {
  const d = {
    webp: largest(img.sources.webp).src,
    jpg: largest(img.sources.jpg).src,
    w: img.width, h: img.height,
    alt: img.alt, caption: img.caption, staged: img.staged, color: img.color,
  };
  if (img.stagedSources) {
    d.pair = img.pair;
    d.stagedVariant = {
      webp: largest(img.stagedSources.webp).src,
      jpg: largest(img.stagedSources.jpg).src,
      w: img.stagedWidth || img.width, h: img.stagedHeight || img.height,
      alt: img.stagedAlt,
    };
  }
  return d;
});

// ---------- sections ----------
const S = data.sections;
const P = data.property;
const A = data.agent;
const glanceHeading = 'At a glance';
// The owner's letter is a section only once it is written; a placeholder letter is worse than none.
const letterReady = S.ownersLetter.enabled !== false && (REVIEW || S.ownersLetter.paragraphs.every((x) => ready(x)));
if (!letterReady && S.ownersLetter.enabled !== false) omit('Owner\'s letter (section not rendered)');
// Contact: each line renders on its own once confirmed; the block, the sticky bar and the footer line need the agent's name.
const hasPhone = ready(A.phone) && !/TBC/.test(A.phoneHref);
const hasEmail = ready(A.email);
const hasAgent = ready(A.name, A.brokerage);
// Six items so the bar fits one line at 1024px; Updates, Life in Blacksburg and the letter are reached by scrolling or the footer.
const navItems = [
  ['glance', glanceHeading],
  ['house', S.house.heading],
  ['lower-level', S.lowerLevel.navLabel || 'Lower level'],
  ['tour', S.tour.navLabel || '3D tour'],
  ['view', S.view.heading],
  ['visit', S.visit.heading],
];
const footerNav = [
  ['updates', S.updates.heading],
  ['blacksburg', S.blacksburg.heading],
  ...(letterReady ? [['letter', S.ownersLetter.heading]] : []),
];

const tourHref = isTbc(P.tour.matterportUrl) ? '#tour' : P.tour.matterportUrl;
const tourExternal = !isTbc(P.tour.matterportUrl);
const tourButton = (cls = 'btn', label = P.tour.label) => (tourExternal
  ? `<a class="${cls}" href="${attr(tourHref)}" target="_blank" rel="noopener">${esc(label)}</a>`
  : `<a class="${cls}" href="#tour">${esc(label)}</a>`);

// On wide screens the list is always open (details[open]); js/site.js collapses it into a "Sections" menu on phones.
const nav = `<nav class="topnav" aria-label="Sections">
<a class="brand" href="#top">${esc(site.name)}</a>
<details class="nav-menu" id="nav-menu" open>
<summary>Sections</summary>
<ul>
${navItems.map(([id, label]) => `<li><a href="#${id}">${esc(label)}</a></li>`).join('\n')}
</ul>
</details>
</nav>`;

const hero = `<header class="hero" id="top">
${nav}
<div class="hero-media" style="background-color:${attr(heroImg.color)};background-image:url(${heroImg.lqip});background-size:cover">
${picture(heroImg, { sizes: '100vw', eager: true, priority: true, className: 'hero-img' })}
</div>
<div class="hero-text">
<div class="hero-inner">
<p class="status">${t(P.status)}</p>
<h1>${t(site.tagline)}</h1>
<p class="price">${t(P.price.display)}</p>
${tourButton('btn btn-cream')}
</div>
</div>
</header>`;

// Daylight exterior directly under the hero, so the architecture reads before anyone scrolls.
const daylight = daylightImg ? `<figure class="daylight">
<button type="button" class="tile-btn" data-lb="${lbIndex.get(daylightImg.name)}" aria-label="${attr(`Enlarge: ${daylightImg.alt}`)}">
${picture(daylightImg, { sizes: '100vw', eager: true, className: 'daylight-img' })}
</button>
${data.images.daylightCaption ? `<figcaption class="wrap">${esc(data.images.daylightCaption)}</figcaption>` : ''}
</figure>` : '';

// Sticky showing / contact bar: rendered only when there is someone to contact; js/site.js shows it after the hero.
const ctaBar = (hasPhone || hasEmail) ? `<div class="cta-bar" id="cta-bar" hidden>
<div class="cta-inner">
${hasPhone ? `<a class="btn" href="${attr(A.phoneHref)}" data-utm="">${esc(data.cta.showing)}</a>` : `<a class="btn" href="#visit">${esc(data.cta.showing)}</a>`}
${hasEmail ? `<a class="cta-link" href="mailto:${attr(A.email)}" data-utm="">${esc(data.cta.email)}</a>` : ''}
${tourExternal ? `<a class="cta-link" href="${attr(tourHref)}" target="_blank" rel="noopener">${esc(data.cta.tour)}</a>` : ''}
</div>
</div>` : (omit('Sticky showing bar (needs agent phone or email)'), '');

/** Numbered section head (direction C): hairline rule, two-digit eyebrow, Fraunces heading. */
let secNo = 0;
const secHead = (heading, id) => `<div class="sec-head"><span class="num" aria-hidden="true">${pad2(++secNo)}</span><h2 id="${id}-h">${t(heading)}</h2></div>`;

const glance = `<section id="glance" class="band glance" aria-label="${attr(glanceHeading)}">
<div class="wrap">
<h2 class="visually-hidden">${esc(glanceHeading)}</h2>
<ul class="cards">
${data.atAGlance.map((c) => `<li class="card"><span class="card-label">${t(c.label)}</span><strong class="card-value">${t(c.value)}</strong><span class="card-detail">${t(c.detail)}</span></li>`).join('\n')}
</ul>
</div>
</section>`;

// The photographer's fly-through: a full-width 16:9 figure directly under the facts, before anything else.
// `landscapeWalkthrough` (16:9) plays plain when it exists; until then the vertical cut stands centred in a
// 16:9 stage filled with a blurred copy of its own poster, so the frame reads as one piece on a wide screen.
const WV = P.video || {};
const hasLandscape = WV.landscapeWalkthrough && await exists(WV.landscapeWalkthrough);
const walkSrc = hasLandscape ? WV.landscapeWalkthrough : WV.verticalWalkthrough;
const walkPoster = hasLandscape
  ? (WV.landscapePoster && await exists(WV.landscapePoster) ? WV.landscapePoster : null)
  : (WV.walkthroughPoster && await exists(WV.walkthroughPoster) ? WV.walkthroughPoster : null);
const walkthrough = (walkSrc && await exists(walkSrc)) ? `<figure class="flythrough" id="flythrough" aria-label="${attr(WV.walkthroughHeading || 'Walk through')}">
<div class="fly-stage${hasLandscape ? ' landscape' : ' portrait'}"${walkPoster && !hasLandscape ? ` style="background-image:url(${attr(walkPoster)})"` : ''}>
<video class="fly-video" controls playsinline preload="none"${walkPoster ? ` poster="${attr(walkPoster)}"` : ''} width="${hasLandscape ? 1920 : 1080}" height="${hasLandscape ? 1080 : 1920}">
<source src="${attr(walkSrc)}" type="video/mp4">
</video>
</div>
<figcaption class="wrap"><strong>${esc(WV.walkthroughHeading || 'Walk through')}</strong> ${esc(WV.walkthroughCaption || '')}</figcaption>
</figure>` : (omit('Walkthrough video'), '');
const house = `<section id="house" class="wrap sec" aria-labelledby="house-h">
${secHead(S.house.heading, 'house')}
<div class="house-intro">
<div>${paragraphs(S.house.paragraphs)}</div>
</div>
<div class="gal-bar">
<p class="gal-note">${esc(S.house.stagingLine || data.footer.stagingNote)}</p>
${variantToggle('all', `Show every ${data.labels.virtuallyStaged.toLowerCase()} room as photographed or staged`)}
</div>
${gallery(galleryImgs, 'house-gallery', { nearFold: true, lead: true })}
<h3 class="sub">${t(S.house.grounds.heading)}</h3>
<p>${t(S.house.grounds.intro)}</p>
${gallery(exteriorImgs, 'grounds-gallery', { cls: 'gallery-plain' })}
</section>`;

const lower = `<section id="lower-level" class="wrap sec" aria-labelledby="lower-level-h">
${secHead(S.lowerLevel.heading, 'lower-level')}
<div class="split">
<div>${paragraphs(S.lowerLevel.paragraphs)}</div>
<ul class="facts panel">
${S.lowerLevel.facts.map((f) => `<li>${t(f)}</li>`).join('\n')}
</ul>
</div>
${gallery(lowerImgs, 'lower-gallery', { cls: 'gallery-plain' })}
</section>`;

// The 3D tour: a still of the house with a "Start" button, and the iframe is only created on click (js/site.js).
// Browsers without WebGL get a one-line note instead of a black canvas, and the direct Matterport link is always there.
const tourEmbed = tourExternal
  ? `<figure class="tour-frame" id="tour-frame" data-tour-src="${attr(P.tour.matterportUrl)}" data-tour-title="${attr(P.tour.label)}" style="background-color:${attr(tourPoster.color)}">
${picture(tourPoster, { sizes: '(min-width: 72rem) 68rem, 100vw', className: 'tour-poster' })}
<button type="button" class="btn tour-start" id="tour-start" hidden>${esc(P.tour.startLabel)}</button>
<figcaption class="tour-links"><a href="${attr(P.tour.matterportUrl)}" target="_blank" rel="noopener">${esc(P.tour.openLabel)} &#8599;</a>
<span class="muted" id="tour-note" hidden>${esc(P.tour.noWebglNote)}</span></figcaption>
</figure>`
  : (REVIEW ? `<div class="tour-placeholder" role="note"><p><span class="tbc">${esc(P.tour.matterportUrl)}</span></p></div>` : (omit('3D tour (Matterport URL)'), ''));

// Floor plans: "View" opens the plan image in the lightbox; "PDF" downloads the real PDF written by pdf/build_plans.py.
const planFor = (fp) => planImgs.find((i) => i.name === (fp.image || `plan-${slug(fp.label)}`));
const viewLabel = (fp) => (S.tour.viewLabel || 'View the {label} plan').replace('{label}', String(fp.label).toLowerCase());
const planLinks = (await Promise.all(S.tour.floorPlans.map(async (fp) => {
  const pdf = await exists(fp.file);
  const img = planFor(fp);
  const view = img ? `<button type="button" class="link-btn" data-lb="${lbIndex.get(img.name)}">${esc(viewLabel(fp))}</button>` : `${t(fp.label)} ${missing('floor plan')}`;
  const dl = pdf ? ` <span class="sep" aria-hidden="true">·</span> <a href="${attr(fp.file)}" download aria-label="${attr(`Download the ${String(fp.label).toLowerCase()} plan as a PDF`)}">${esc(S.tour.pdfLabel || 'PDF')}</a>` : '';
  return `<li><span>${view}${dl}</span><span class="muted">${num(fp.sqft)} ${esc(P.floorArea.unit)}</span></li>`;
}))).join('\n');
const allPlans = (S.tour.allPlansPdf && await exists(S.tour.allPlansPdf))
  ? `<p><a class="btn btn-outline" href="${attr(S.tour.allPlansPdf)}" download>${esc(S.tour.allPlansLabel || 'Download all plans (PDF)')}</a></p>` : '';
const planThumbs = planImgs.map((img) => {
  const fp = S.tour.floorPlans.find((f) => planFor(f) === img);
  return `<button type="button" class="plan-thumb" data-lb="${lbIndex.get(img.name)}" aria-label="${attr(`Enlarge: ${fp ? fp.label + ' plan' : img.alt}`)}">
${picture(img, { sizes: '(min-width: 40rem) 25vw, 50vw' })}
<span>${fp ? t(fp.label) : esc(img.alt)}</span>
</button>`;
}).join('\n');

const tour = `<section id="tour" class="wrap sec" aria-labelledby="tour-h">
${secHead(S.tour.heading, 'tour')}
${p(t(S.tour.intro))}
${tourEmbed}
<h3 class="sub">${esc(S.tour.plansHeading || 'Floor plans')}</h3>
<ul class="plans">
${planLinks}
</ul>
${planImgs.length ? `<div class="plan-grid">
${planThumbs}
</div>` : ''}
${allPlans}
</section>`;

// Work with a confirmed date, permit and inspection goes in the table; the rest is listed plainly with a note, never with blanks.
const dated = S.updates.items.filter((u) => !u.undated && (REVIEW || ready(u.date, u.permit, u.finalInspection)));
const undated = S.updates.items.filter((u) => !dated.includes(u));
undated.filter((u) => !u.undated).forEach((u) => omit(`Updates: date/permit/inspection for "${u.work}"`));
const updatesTable = dated.length ? `<table class="updates">
<thead><tr><th scope="col">Date</th><th scope="col">Work</th><th scope="col">Permit</th><th scope="col">Final inspection</th></tr></thead>
<tbody>
${dated.map((u) => `<tr><td data-th="Date">${t(u.date)}</td><td data-th="Work">${t(u.work)}</td><td data-th="Permit">${t(u.permit)}</td><td data-th="Final inspection">${t(u.finalInspection)}</td></tr>`).join('\n')}
</tbody>
</table>` : '';
const updatesList = undated.length ? `<h3 class="sub-tight">${esc(S.updates.undatedHeading || 'Also done')}</h3>
<ul class="facts">
${undated.map((u) => `<li>${esc(u.work)}</li>`).join('\n')}
</ul>
<p class="muted small">${esc(S.updates.undatedNote || 'Dates and permit records available on request.')}</p>` : '';
const updates = `<section id="updates" class="wrap sec" aria-labelledby="updates-h">
${secHead(S.updates.heading, 'updates')}
${p(t(S.updates.intro))}
${updatesList}
${updatesTable}
${(await exists(S.updates.specSheet.file)) ? `<p><a class="btn" href="${attr(S.updates.specSheet.file)}" download>${t(S.updates.specSheet.label)}</a></p>` : ''}
</section>`;

const viewPoster = viewImg.sources.jpg.find((s) => s.w === 1200) || largest(viewImg.sources.jpg);
const hasViewVideo = await exists(S.view.video);
// The view video is 16:9 and muted (the pan's wind noise adds nothing); the lead view photograph is its poster and
// is left out of the gallery beneath so the same ridge doesn't appear twice in a row.
const viewMedia = hasViewVideo
  ? `<video class="view-video" controls muted preload="none" playsinline poster="${attr(viewPoster.src)}" width="1280" height="720" style="background-color:${attr(viewImg.color)}">
<source src="${attr(S.view.video)}" type="video/mp4">
</video>${S.view.videoCaption ? `<p class="view-caption wrap">${esc(S.view.videoCaption)}</p>` : ''}`
  : picture(viewImg, { sizes: '100vw', className: 'view-img' });
const view = `<section id="view" class="sec sec-view" aria-labelledby="view-h">
<div class="wrap">${secHead(S.view.heading, 'view')}</div>
<div class="view-media">${viewMedia}</div>
<div class="band view-band">
<div class="wrap">
${paragraphs(S.view.paragraphs)}
${(S.view.clipsNote && (site.listingLive || REVIEW)) ? `<p class="band-note">${t(S.view.clipsNote)}</p>` : ''}${(await exists(S.view.video)) ? '' : (REVIEW ? `<p class="band-note">${missing('Drone reveal video')}</p>` : (omit('Drone reveal video'), ''))}
</div>
</div>
<div class="wrap">
${gallery(viewImgs.slice(1), 'view-gallery', { cls: 'gallery-row', sizes: ROW_SIZES })}
${await reelsBlock()}
${await albumBlock()}
</div>
</section>`;

// Reels: newest clip large (9:16, muted, poster), up to six earlier posters that swap it in. Nothing until the first exists.
async function reelsBlock() {
  const R = S.view.reels;
  if (!R) return '';
  const items = [];
  for (const it of R.items || []) {
    const file = `${R.dir}/${it.file}.mp4`, poster = `${R.dir}/${it.file}.jpg`;
    if (!(await exists(file))) { omit(`Reel "${it.file}" (file missing)`); continue; }
    items.push({ ...it, src: file, poster: (await exists(poster)) ? poster : null });
  }
  if (!items.length) { omit('Reels (none yet)'); return ''; }
  items.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const [first, ...rest] = items;
  const dateFmt = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString(site.language, { day: 'numeric', month: 'long', year: 'numeric' }) : '');
  const reelData = items.map((it) => ({ src: it.src, poster: it.poster, caption: it.caption, date: dateFmt(it.date) }));
  return `<div class="reels" id="reels">
<h3 class="sub">${esc(R.heading)}</h3>
${p(esc(R.intro))}
<div class="reel-stage">
<video id="reel-video" class="reel" controls muted playsinline preload="none"${first.poster ? ` poster="${attr(first.poster)}"` : ''} width="1080" height="1920">
<source src="${attr(first.src)}" type="video/mp4">
</video>
<p class="reel-cap"><span id="reel-cap">${esc(first.caption || '')}</span> <span class="muted" id="reel-date">${esc(dateFmt(first.date))}</span></p>
</div>
${rest.length ? `<h4 class="reel-earlier">${esc(R.earlierLabel || 'Earlier')}</h4>
<div class="reel-row">
${rest.slice(0, 6).map((it, i) => `<button type="button" class="reel-thumb" data-reel="${i + 1}" aria-label="${attr(`Play: ${it.caption || it.file}`)}">${it.poster ? `<img src="${attr(it.poster)}" alt="" loading="lazy" decoding="async" width="270" height="480">` : `<span class="reel-noposter"></span>`}<span>${esc(dateFmt(it.date))}</span></button>`).join('\n')}
</div>` : ''}
<script type="application/json" id="reel-data">${JSON.stringify(reelData).replace(/</g, '\\u003c')}</script>
</div>`;
}

// The owners' album: a strip of phone photos, each carrying the album label burned on by scripts/build-album.mjs.
async function albumBlock() {
  const AL = data.album;
  if (!AL) return '';
  const man = (await exists(AL.manifest)) ? JSON.parse(await fs.readFile(path.join(ROOT, AL.manifest), 'utf8')) : [];
  if (!man.length) { omit('Album photos (none yet)'); return ''; }
  const cards = man.map((img) => `<figure class="album-tile">
${picture(img, { sizes: '(min-width: 64rem) 18rem, (min-width: 40rem) 33vw, 80vw' })}
<figcaption>${img.season ? `<span class="album-season">${esc(img.season)}</span> ` : ''}${esc(img.caption)}</figcaption>
</figure>`).join('\n');
  return `<div class="album" id="album">
<h3 class="sub">${esc(AL.heading)}</h3>
${p(esc(AL.intro))}
<div class="album-strip">
${cards}
</div>
</div>`;
}

// Nearby places, grouped by how you get there. A mode's minutes show only when measured; the Directions link opens
// Google Maps from the house with the place's first mode preset, so every figure on the page can be checked in one tap.
const B = S.blacksburg;
const MODES = B.modes || {};
const modeIcon = {
  walk: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="13.5" cy="4" r="2" fill="currentColor"/><path d="M10 22l2.5-7 2 2V22M8 13l2-5 3-1 3 3 3 1M12.5 8l-2 5 3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bike: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="5.5" cy="17" r="3.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="18.5" cy="17" r="3.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5.5 17l4-8h5l4 8M9.5 9l3 8M12 7h3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  drive: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 13l2-5h12l2 5v5H4zM4 13h16M7 18v2M17 18v2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="15.5" r="1" fill="currentColor"/><circle cx="16" cy="15.5" r="1" fill="currentColor"/></svg>',
};
const directionsUrl = (place, mode) => {
  const q = new URLSearchParams({ api: '1', origin: B.origin, destination: place.maps, travelmode: (MODES[mode] && MODES[mode].travelmode) || 'driving' });
  return `https://www.google.com/maps/dir/?${q}`;
};
const placeTimes = (place) => Object.entries(place.times || {}).filter(([, v]) => REVIEW || ready(v));
Object.values(B.groups || []).forEach((g) => g.places.forEach((pl) => Object.entries(pl.times || {}).forEach(([m, v]) => { if (isTbc(v)) omit(`Minutes ${MODES[m] ? MODES[m].label : m} to ${pl.name}`); })));
const placeRow = (pl) => {
  const times = placeTimes(pl);
  const firstMode = Object.keys(pl.times || {})[0] || 'drive';
  return `<li class="place">
<div class="place-head"><strong>${esc(pl.name)}</strong>
${times.length ? `<span class="times">${times.map(([m, v]) => `<span class="time" title="${attr(`${t(v)} minutes ${MODES[m] ? MODES[m].label : m}`)}">${modeIcon[m] || ''}<span>${t(v)} min</span><span class="visually-hidden"> ${esc(MODES[m] ? MODES[m].label : m)}</span></span>`).join('')}</span>` : ''}
</div>
<p class="place-blurb">${esc(pl.blurb)} <a class="dir" href="${attr(directionsUrl(pl, firstMode))}" target="_blank" rel="noopener" aria-label="${attr(`${B.directionsLabel || 'Directions'} to ${pl.name}`)}">${esc(B.directionsLabel || 'Directions')} &#8599;</a></p>
</li>`;
};
const placeGroups = (B.groups || []).map((g) => `<div class="place-group">
<h3 class="sub-tight">${esc(g.heading)}</h3>
<ul class="places">
${g.places.map(placeRow).join('\n')}
</ul>
</div>`).join('\n');
const anyTime = (B.groups || []).some((g) => g.places.some((pl) => placeTimes(pl).length));

// The map: Leaflet (vendored at build time into js/ and css/) with pins coloured by group. All data the script
// needs is embedded as JSON, so js/map.js carries no facts of its own. Without JS (or in print) the pre-rendered
// still in map.fallbackImage is shown, with the lists below doing the real work.
const M = B.map;
const themeColors = B.themeColors || {};
const leafletSrc = path.join(ROOT, 'node_modules', 'leaflet', 'dist');
let mapBlock = '';
if (M && (await exists('node_modules/leaflet/dist/leaflet.js'))) {
  await fs.copyFile(path.join(leafletSrc, 'leaflet.js'), path.join(ROOT, 'js', 'leaflet.js'));
  await fs.copyFile(path.join(leafletSrc, 'leaflet.css'), path.join(ROOT, 'css', 'leaflet.css'));
  const mapData = {
    house: M.house, zoom: M.zoom || 14, tiles: M.tiles, walkArea: M.walkArea, allLabel: M.allLabel || 'All',
    colors: Object.fromEntries(Object.entries(themeColors).map(([g, k]) => [g, PAL[k] || k])),
    accent: PAL.cobalt, cream: PAL.cream, ink: PAL.ink,
    groups: (B.groups || []).map((g) => ({
      heading: g.heading, color: PAL[themeColors[g.heading]] || PAL.ink,
      places: g.places.filter((pl) => !pl.offMap && pl.lat && pl.lng).map((pl) => ({
        name: pl.name, blurb: pl.blurb, lat: pl.lat, lng: pl.lng, fit: pl.fit !== false,
        times: placeTimes(pl).map(([m, v]) => `${v} min ${MODES[m] ? MODES[m].label : m}`),
        directions: directionsUrl(pl, Object.keys(pl.times || {})[0] || 'drive'),
        directionsLabel: B.directionsLabel || 'Directions',
      })),
    })),
  };
  const fallbackPng = M.fallbackImage && (await exists(M.fallbackImage));
  // Tile-free schematic drawn at build time: the same pins and walking area on the cream ground. Used when the PNG
  // from `npm run map-image` is absent, and always for print (the live tiles do not print).
  const schematic = (() => {
    const pts = mapData.groups.flatMap((g) => g.places.map((pl) => ({ ...pl, color: g.color })));
    const lats = [...pts.map((x) => x.lat), M.house.lat], lngs = [...pts.map((x) => x.lng), M.house.lng];
    const pad = 0.004;
    const minLat = Math.min(...lats) - pad, maxLat = Math.max(...lats) + pad, minLng = Math.min(...lngs) - pad, maxLng = Math.max(...lngs) + pad;
    const W = 1200, H = 760;
    const kx = Math.cos((M.house.lat * Math.PI) / 180);
    const sx = W / ((maxLng - minLng) * kx), sy = H / (maxLat - minLat), s = Math.min(sx, sy);
    const ox = (W - (maxLng - minLng) * kx * s) / 2, oy = (H - (maxLat - minLat) * s) / 2;
    const X = (lng) => ox + (lng - minLng) * kx * s, Y = (lat) => oy + (maxLat - lat) * s;
    const poly = (M.walkArea && M.walkArea.polygon) ? `<polygon points="${M.walkArea.polygon.map(([la, lo]) => `${X(lo).toFixed(1)},${Y(la).toFixed(1)}`).join(' ')}" fill="${PAL.cobalt}" fill-opacity=".12" stroke="${PAL.cobalt}" stroke-opacity=".6" stroke-width="1.5"/>` : '';
    const pins = pts.map((pl) => `<g><circle cx="${X(pl.lng).toFixed(1)}" cy="${Y(pl.lat).toFixed(1)}" r="7" fill="${pl.color}" stroke="${PAL.cream}" stroke-width="2.5"/><text x="${(X(pl.lng) + 11).toFixed(1)}" y="${(Y(pl.lat) + 4).toFixed(1)}" font-family="Inter, system-ui, sans-serif" font-size="15" fill="${PAL.ink}">${esc(pl.name)}</text></g>`).join('');
    const house = `<circle cx="${X(M.house.lng).toFixed(1)}" cy="${Y(M.house.lat).toFixed(1)}" r="10" fill="${PAL.ink}" stroke="${PAL.cream}" stroke-width="3"/><text x="${(X(M.house.lng) + 15).toFixed(1)}" y="${(Y(M.house.lat) + 5).toFixed(1)}" font-family="Fraunces, Georgia, serif" font-size="18" fill="${PAL.ink}">${esc(M.house.label)}</text>`;
    return `<svg class="map-fallback map-schematic" viewBox="0 0 ${W} ${H}" role="img" aria-label="${attr(`Schematic map: ${site.name} and the nearby places, not to scale with streets`)}"><rect width="${W}" height="${H}" fill="${PAL.creamDeep}"/>${poly}${pins}${house}<text x="16" y="${H - 14}" font-family="Inter, system-ui, sans-serif" font-size="13" fill="${PAL.muted}">Schematic: positions to scale, streets not shown.</text></svg>`;
  })();
  const fallback = fallbackPng
    ? `<img class="map-fallback" src="${attr(M.fallbackImage)}" alt="${attr(`Map of Blacksburg with ${site.name} and the nearby places pinned`)}" loading="lazy" decoding="async">`
    : schematic;
  mapBlock = `<h3 class="sub">${esc(M.heading)}</h3>
${p(esc(M.intro))}
<div class="map-chips" id="map-chips" role="group" aria-label="Show pins for" hidden>
<button type="button" data-theme="" aria-pressed="true">${esc(M.allLabel || 'All')}</button>
${(B.groups || []).map((g) => `<button type="button" data-theme="${attr(g.heading)}" aria-pressed="false"><span class="dot" style="background:${attr(PAL[themeColors[g.heading]] || PAL.ink)}"></span>${esc(g.heading)}</button>`).join('\n')}
</div>
<figure class="map-fig">
<div class="map" id="map" aria-label="${attr(`Map of places near ${site.name}`)}">
${fallback}
</div>
${M.walkArea ? `<figcaption class="muted small"><span class="walk-swatch" aria-hidden="true"></span> ${esc(M.walkArea.label)} &middot; Map Map data &copy; OpenStreetMap contributors, tiles &copy; CARTOcopy; OpenStreetMap contributors</figcaption>` : ''}
</figure>
<script type="application/json" id="map-data">${JSON.stringify(mapData).replace(/</g, '\\u003c')}</script>`;
  if (!fallbackPng) console.log('note: no assets/img/map-fallback.png (npm run map-image on a machine with Chrome and internet); the build-time schematic is used for no-JS and print');
}

const blacksburg = `<section id="blacksburg" class="wrap sec" aria-labelledby="blacksburg-h">
${secHead(B.heading, 'blacksburg')}
${paragraphs(B.paragraphs)}
${mapBlock}
${(B.groups || []).length ? `<h3 class="sub">${esc(B.placesHeading || 'Nearby')}</h3>
${anyTime ? p(esc(B.placesIntro)) : ''}
<div class="place-grid">
${placeGroups}
</div>` : ''}
</section>`;

const letter = letterReady ? `<section id="letter" class="sec letter" aria-labelledby="letter-h">
<div class="wrap">
${secHead(S.ownersLetter.heading, 'letter')}
${paragraphs(S.ownersLetter.paragraphs)}
<p class="signature">${t(S.ownersLetter.signature)}</p>
</div>
</section>` : '';

const ev = S.visit.event;
const agentBlock = (REVIEW || hasAgent || hasPhone || hasEmail) ? `<address class="agent">
${(REVIEW || hasAgent) ? `<strong>${t(A.name)}</strong><br>
${t(A.title)}, ${t(A.brokerage)}<br>
${A.address ? `<span class="muted">${esc(A.address.street)}, ${esc(A.address.city)}, ${esc(A.address.state)} ${esc(A.address.zip)}</span><br>` : ''}` : ''}
${(REVIEW || hasPhone) ? `<a href="${attr(A.phoneHref)}" data-utm="">${t(A.phone)}</a>${A.phoneLabel ? ` <span class="muted small">(${esc(A.phoneLabel)})</span>` : ''}<br>` : ''}
${(A.office && ready(A.office) && !/TBC/.test(A.officeHref || '')) ? `<a href="${attr(A.officeHref)}" data-utm="">${esc(A.office)}</a> <span class="muted small">(office)</span><br>` : ''}
${(REVIEW || hasEmail) ? `<a href="mailto:${attr(A.email)}" data-utm="">${t(A.email)}</a>` : ''}
</address>` : (omit('Agent name, brokerage, phone, email (contact block not rendered)'), '');
const eventBlock = ev.enabled !== false && (REVIEW || ready(ev.date)) ? `<div class="event">
<h3>${t(ev.name)}</h3>
<p>${t(ev.date)} · ${t(ev.time)}</p>
<p class="muted">${t(ev.note)}</p>
</div>` : (ev.enabled === false ? '' : (omit(`Event "${ev.name}": date (event not rendered)`), ''));
const visit = `<section id="visit" class="wrap sec" aria-labelledby="visit-h">
${secHead(S.visit.heading, 'visit')}
${p(t((REVIEW || hasPhone || hasEmail) ? S.visit.intro : (S.visit.introPending || S.visit.intro)))}
${(agentBlock || eventBlock) ? `<div class="split">
${agentBlock}
${eventBlock}
</div>` : ''}
</section>`;

const ehoSvg = `<svg class="eho" viewBox="0 0 48 48" width="40" height="40" role="img" aria-label="Equal Housing Opportunity"><path d="M24 6 4 22h6v18h28V22h6z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M16 25h16M16 32h16" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`;

const footer = `<footer id="footer">
<div class="wrap">
<h2 class="visually-hidden">Listing information</h2>
<p class="footer-nav">${footerNav.map(([id, label]) => `<a href="#${id}">${esc(label)}</a>`).join(' <span class="sep" aria-hidden="true">·</span> ')}</p>
${p(resolveLine(data.footer.brokerageLine))}
${p(resolveLine(data.footer.mlsLine))}
<p class="eho-line">${ehoSvg}<span>${esc(data.footer.equalHousing)}</span></p>
<p class="muted">${esc(data.footer.stagingNote)}</p>
<p class="muted small">${esc(data.photographer.credit)}</p>
<p class="muted small">&copy; ${esc(data.footer.copyrightYear)} ${esc(site.name)}</p>
</div>
</footer>`;

// ---------- lightbox ----------
const lightbox = `<div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="Photo" hidden>
<button type="button" class="lb-close" data-lb-close aria-label="Close">&times;</button>
<button type="button" class="lb-prev" data-lb-prev aria-label="Previous photo">&#8249;</button>
<figure class="lb-fig">
<picture><source type="image/webp" id="lb-webp"><img id="lb-img" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" alt="" decoding="async"></picture>
<figcaption><span id="lb-cap"></span><span class="cap-staged" id="lb-badge" hidden> &middot; ${esc(data.labels.virtuallyStaged.toLowerCase())}</span>
<div class="vtoggle lb-toggle" id="lb-toggle" role="group" aria-label="Photo or virtually staged" hidden>
<button type="button" data-lb-variant="photo" aria-pressed="true">As photographed</button>
<button type="button" data-lb-variant="staged" aria-pressed="false">${esc(data.labels.virtuallyStaged)}</button>
</div></figcaption>
</figure>
<button type="button" class="lb-next" data-lb-next aria-label="Next photo">&#8250;</button>
</div>
<script type="application/json" id="lightbox-data">${JSON.stringify(lightboxData).replace(/</g, '\\u003c')}</script>`;

// ---------- head ----------
const ld = {
  '@context': 'https://schema.org',
  '@type': 'RealEstateListing',
  name: site.name,
  url: site.url,
  description: site.description,
  image: [...heroImg.sources.jpg].reverse().map((s) => abs(s.src)),
  about: {
    '@type': 'SingleFamilyResidence',
    name: site.name,
    address: {
      '@type': 'PostalAddress',
      streetAddress: P.address.street,
      addressLocality: P.address.city,
      addressRegion: P.address.state,
      postalCode: P.address.zip,
      addressCountry: P.address.country,
    },
    geo: { '@type': 'GeoCoordinates', latitude: P.geo.latitude, longitude: P.geo.longitude },
    numberOfRooms: P.bedrooms.total,
    numberOfBedrooms: P.bedrooms.total,
    numberOfFullBathrooms: P.bathrooms.full,
    numberOfPartialBathrooms: P.bathrooms.threeQuarter + P.bathrooms.half,
    floorSize: { '@type': 'QuantitativeValue', value: P.floorArea.total, unitCode: 'FTK', unitText: 'SQFT' },
    yearBuilt: P.yearBuilt,
  },
  offers: { '@type': 'Offer', price: P.price.amount, priceCurrency: P.price.currency, availability: site.listingLive ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder', url: site.url },
};
if (hasAgent) {
  ld.provider = {
    '@type': 'RealEstateAgent',
    name: A.name,
    ...(hasPhone ? { telephone: A.phone } : {}),
    ...(hasEmail ? { email: A.email } : {}),
    worksFor: { '@type': 'Organization', name: A.brokerage },
    parentOrganization: { '@type': 'Organization', name: A.brokerage },
  };
}

// LAUNCH_PREVIEW=1 renders the page as it will be on listing day (no noindex) for audits; it never changes site.json.
const noindex = (site.noindex && !process.env.LAUNCH_PREVIEW)
  ? `<!-- Pre-launch: remove the next line (or set site.noindex to false in data/site.json and rebuild) on listing day. -->
<meta name="robots" content="noindex, nofollow">`
  : '';

const analyticsOrigin = new URL(site.analytics.scriptSrc).origin;
const fontsHref = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(TYPE.display)}:wght@300;400&family=${encodeURIComponent(TYPE.text)}:wght@400;500;600&display=swap`;

// Palette tokens are emitted from site.json so the stylesheet never carries a colour of its own.
const tokens = Object.entries(PAL).map(([k, v]) => `--${k}:${v}`).join(';');
const criticalCss = `:root{${tokens};--display:"${TYPE.display}",Georgia,"Times New Roman",serif;--text:"${TYPE.text}",system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color-scheme:light}*,*::before,*::after{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;font-family:var(--text);color:var(--ink);background:var(--cream);line-height:1.55}.hero{position:relative;display:grid;grid-template-rows:auto 1fr;background:var(--ridge);color:var(--cream)}.hero-media{position:relative;grid-row:1;height:min(62svh,34rem);min-height:20rem}.hero-media picture,.hero-img{display:block;width:100%;height:100%}.hero-img{object-fit:cover}.topnav{position:absolute;top:0;left:0;right:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding:0 .5rem;min-height:3rem;background:rgba(29,36,48,.55);color:var(--cream)}.topnav ul{display:flex;gap:.25rem;margin:0;padding:0;list-style:none;overflow-x:auto;white-space:nowrap}.topnav a{display:inline-flex;align-items:center;min-height:2.75rem;padding:0 .6rem;color:inherit;text-decoration:none;font-size:.9rem}.nav-menu summary{list-style:none;cursor:pointer;display:inline-flex;align-items:center;min-height:2.75rem;padding:0 .75rem;font-size:.9rem;font-weight:500}.nav-menu summary::-webkit-details-marker{display:none}.nav-menu summary::after{content:"";display:inline-block;width:.45em;height:.45em;margin-left:.5em;border:solid currentColor;border-width:0 1.5px 1.5px 0;transform:translateY(-.15em) rotate(45deg)}.nav-menu[open] summary::after{transform:translateY(.1em) rotate(-135deg)}@media(max-width:47.99rem){.nav-menu{position:static}.nav-menu ul{position:absolute;left:0;right:0;top:100%;flex-direction:column;gap:0;padding:.5rem 0 .75rem;background:rgba(29,36,48,.94);white-space:normal}.nav-menu ul a{width:100%;padding:0 1.25rem}}@media(min-width:48rem){.nav-menu summary{display:none}}.hero-text{grid-row:2;padding:1.75rem 1rem 2.25rem}.hero h1{margin:.25rem 0 .5rem;font-family:var(--display);font-weight:300;font-size:clamp(2rem,6vw,3.6rem);line-height:1.08;letter-spacing:-.01em}@media(min-width:48rem){.hero{display:block;height:min(88svh,56rem);min-height:36rem}.hero-media{position:absolute;inset:0;height:100%}.hero-text{position:absolute;inset:auto 0 0 0;padding:6rem 2rem 3rem;background:linear-gradient(transparent,rgba(29,36,48,.82))}}`;

const head = `<!DOCTYPE html>
<html lang="${attr(site.language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(site.tagline)}</title>
<meta name="description" content="${attr(site.description)}">
${noindex}
<link rel="canonical" href="${attr(site.url)}">
<meta property="og:title" content="${attr(site.tagline)}">
<meta property="og:description" content="${attr(site.description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${attr(site.url)}">
<meta property="og:image" content="${attr(abs(site.ogImage))}">
<meta property="og:image:width" content="${site.ogImageWidth}">
<meta property="og:image:height" content="${site.ogImageHeight}">
<meta property="og:image:alt" content="${attr(site.ogImageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${attr(site.tagline)}">
<meta name="twitter:description" content="${attr(site.description)}">
<meta name="twitter:image" content="${attr(abs(site.ogImage))}">
<meta name="twitter:image:alt" content="${attr(site.ogImageAlt)}">
<meta name="theme-color" content="${attr(PAL.ridge)}">
<link rel="preload" as="image" imagesrcset="${attr(srcset(heroImg.sources.webp))}" imagesizes="100vw" fetchpriority="high">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${ready(site.analytics.token) ? `<link rel="preconnect" href="${attr(analyticsOrigin)}" crossorigin>` : ''}
<style>${criticalCss}</style>
<link rel="stylesheet" href="${attr(fontsHref)}" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="${attr(fontsHref)}"></noscript>
<link rel="stylesheet" href="css/style.css">
${mapBlock ? `<link rel="stylesheet" href="css/leaflet.css">
<script defer src="js/leaflet.js"></script>
<script defer src="js/map.js"></script>` : ''}
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
<script defer src="js/gallery.js"></script>
<script defer src="js/site.js"></script>
<script defer src="js/utm.js"></script>
${ready(site.analytics.token) ? `<script type="module" src="${attr(site.analytics.scriptSrc)}" data-cf-beacon='${JSON.stringify({ token: site.analytics.token })}'></script>` : (omit('Cloudflare Web Analytics token (beacon not loaded)'), '')}
</head>`;

const html = `${head}
<body>
<a class="skip" href="#glance">Skip to content</a>
${hero}
${daylight}
<main>
${glance}
${walkthrough}
${house}
${lower}
${tour}
${updates}
${view}
${blacksburg}
${letter}
${visit}
</main>
${footer}
${ctaBar}
${lightbox}
</body>
</html>
`;

await fs.writeFile(process.env.PAGE_OUT ? path.resolve(process.env.PAGE_OUT) : path.join(ROOT, 'index.html'), html);
if (!process.env.PAGE_OUT) await fs.writeFile(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${esc(site.url)}/</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod><changefreq>daily</changefreq></url></urlset>\n`);
if (omitted.length) console.log(`left out of the page until confirmed (${omitted.length}):\n  - ${omitted.join('\n  - ')}`);

// ---------- tracked links ----------
const tracked = data.channels.map((c) => {
  const q = new URLSearchParams({ utm_source: c.utm.source, utm_medium: c.utm.medium, utm_campaign: c.utm.campaign });
  return `${c.name} → ${site.url}/?${q}`;
}).join('\n');
if (!process.env.PAGE_OUT) await fs.writeFile(path.join(ROOT, 'scripts', 'tracked-links.md'), `# Tracked links (${site.campaign})\n\nGenerated by scripts/build-page.mjs from data/site.json \`channels\`. One line per channel.\n\n${tracked}\n`);

const bytes = Buffer.byteLength(html);
console.log(`index.html written (${(bytes / 1024).toFixed(1)} KB), ${manifest.length} images, ${data.channels.length} tracked links`);
