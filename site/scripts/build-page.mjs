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
 * Nothing on the page is hard-coded; values beginning with "TBC" are rendered
 * as-is inside <span class="tbc"> so the owner can spot them before launch.
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
const isTbc = (v) => typeof v === 'string' && v.startsWith('TBC');
/** Escape a value; wrap it in <span class="tbc"> when it is a TBC placeholder. */
const t = (v) => (isTbc(v) ? `<span class="tbc">${esc(v)}</span>` : esc(v));
/** True when a site-relative asset path exists on disk; missing assets render as a labelled placeholder, never a dead link. */
const exists = async (rel) => fs.access(path.join(ROOT, rel)).then(() => true, () => false);
const missing = (what) => `<span class="tbc">${esc(what)} not yet added</span>`;
const get = (obj, dotted) => dotted.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
/** Resolve "{a.b.c}" placeholders from site.json, escaping and TBC-wrapping each piece. */
const resolveLine = (line) => line.split(/(\{[a-zA-Z0-9_.]+\})/g).map((part) => {
  const m = part.match(/^\{([a-zA-Z0-9_.]+)\}$/);
  if (!m) return esc(part);
  const v = get(data, m[1]);
  return v === undefined ? esc(part) : t(v);
}).join('');
const num = (n) => Number(n).toLocaleString(site.language);
const abs = (p) => `${site.url}/${p}`;
const paragraphs = (arr) => arr.map((p) => `<p>${t(p)}</p>`).join('\n');
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const pad2 = (n) => String(n).padStart(2, '0');

// ---------- images ----------
const heroImg = manifest.find((i) => i.name === data.images.hero) || manifest.find((i) => i.group === 'hero');
const viewImgs = manifest.filter((i) => i.group === 'view');
const viewImg = viewImgs[0];
const exteriorImgs = manifest.filter((i) => i.group === 'exterior');
const lowerImgs = manifest.filter((i) => i.group === 'lower');
const planImgs = manifest.filter((i) => i.group === 'plans');
// Main gallery: the interior groups; exterior, lower and view photographs have their own galleries.
const galleryImgs = manifest.filter((i) => !['hero', 'plans', 'view', 'exterior', 'lower'].includes(i.group));
// Every non-hero photograph gets one index into the lightbox list; paired tiles carry both variants under one index.
const lightboxList = manifest.filter((i) => i.group !== 'hero' && i.group !== 'plans');
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

/** The two-button photo / staged control; `scope` is "tile" (one pair) or "all" (every pair in a gallery). */
const variantToggle = (scope, labelFor) => `<div class="vtoggle" role="group" aria-label="${attr(labelFor)}">
<button type="button" data-variant="photo" data-scope="${scope}" aria-pressed="true">As photographed</button>
<button type="button" data-variant="staged" data-scope="${scope}" aria-pressed="false">${esc(data.labels.virtuallyStaged)}</button>
</div>`;

function galleryFigure(img, position, nearFold, sizes, lead) {
  const idx = lbIndex.get(img.name);
  const eager = nearFold && position < 2; // first couple of tiles in the main gallery sit near the fold
  const paired = Boolean(img.stagedSources);
  const caption = img.caption ? `<span class="cap">${esc(img.caption)}</span>` : '';
  // Paired tiles carry both variants as data attributes; js/gallery.js swaps the <picture> sources and alt.
  const pairData = paired ? ` data-pair="${attr(img.pair)}" data-variant="photo"`
    + ` data-photo-webp="${attr(srcset(img.sources.webp))}" data-photo-jpg="${attr(srcset(img.sources.jpg))}" data-photo-src="${attr(largest(img.sources.jpg).src)}" data-photo-alt="${attr(img.alt)}"`
    + ` data-staged-webp="${attr(srcset(img.stagedSources.webp))}" data-staged-jpg="${attr(srcset(img.stagedSources.jpg))}" data-staged-src="${attr(largest(img.stagedSources.jpg).src)}" data-staged-alt="${attr(img.stagedAlt)}"` : '';
  const badge = paired ? `<span class="badge" hidden>${esc(data.labels.virtuallyStaged)}</span>` : '';
  const fc = caption || paired ? `<figcaption>${caption}${paired ? variantToggle('tile', `${img.alt}: photo or virtually staged`) : ''}</figcaption>` : '';
  return `<figure class="tile${lead && position === 0 ? ' tile-lead' : ''}"${pairData}>
<button type="button" class="tile-btn" data-lb="${idx}" aria-label="${attr(`Enlarge: ${img.alt}`)}">
${picture(img, { sizes: lead && position === 0 ? FEATURE_SIZES : sizes, eager })}
${badge}
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
const navItems = [
  ['glance', glanceHeading],
  ['house', S.house.heading],
  ['lower-level', S.lowerLevel.heading],
  ['tour', S.tour.heading],
  ['updates', S.updates.heading],
  ['view', S.view.heading],
  ['blacksburg', S.blacksburg.heading],
  ['letter', S.ownersLetter.heading],
  ['visit', S.visit.heading],
];

const tourButton = (cls = 'btn') => (isTbc(P.tour.matterportUrl)
  ? `<a class="${cls}" href="#tour">${esc(P.tour.label)}</a>`
  : `<a class="${cls}" href="${attr(P.tour.matterportUrl)}" target="_blank" rel="noopener">${esc(P.tour.label)}</a>`);

const nav = `<nav class="topnav" aria-label="Sections">
<a class="brand" href="#top">${esc(site.name)}</a>
<ul>
${navItems.map(([id, label]) => `<li><a href="#${id}">${esc(label)}</a></li>`).join('\n')}
</ul>
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

const house = `<section id="house" class="wrap sec" aria-labelledby="house-h">
${secHead(S.house.heading, 'house')}
${paragraphs(S.house.paragraphs)}
<div class="gal-bar">
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

const tourEmbed = isTbc(P.tour.matterportUrl)
  ? `<div class="tour-placeholder" role="note"><p><span class="tbc">${esc(P.tour.matterportUrl)}</span></p>${tourButton()}</div>`
  : `<div class="tour-frame"><iframe src="${attr(P.tour.matterportUrl)}" title="${attr(P.tour.label)}" loading="lazy" allow="xr-spatial-tracking; fullscreen" allowfullscreen></iframe></div>
<p>${tourButton()}</p>`;

// Floor plans: link the PDF when it exists; otherwise fall back to the plan image's largest JPEG from the manifest.
const planFor = (fp) => planImgs.find((i) => i.name === `plan-${slug(fp.label)}`);
const planLinks = (await Promise.all(S.tour.floorPlans.map(async (fp) => {
  const pdf = await exists(fp.file);
  const img = planFor(fp);
  const href = pdf ? fp.file : (img ? largest(img.sources.jpg).src : null);
  const link = href ? `<a href="${attr(href)}"${pdf ? ' download' : ' target="_blank" rel="noopener"'}>${t(fp.label)}${pdf ? ' (PDF)' : ''}</a>` : `${t(fp.label)} — ${missing('floor plan')}`;
  return `<li>${link} <span class="muted">${num(fp.sqft)} ${esc(P.floorArea.unit)}</span></li>`;
}))).join('\n');
const planThumbs = (await Promise.all(planImgs.map(async (img) => {
  const fp = S.tour.floorPlans.find((f) => planFor(f) === img);
  const pdf = fp && await exists(fp.file);
  const href = pdf ? fp.file : largest(img.sources.jpg).src;
  return `<a class="plan-thumb" href="${attr(href)}"${pdf ? ' download' : ' target="_blank" rel="noopener"'}>
${picture(img, { sizes: '(min-width: 40rem) 25vw, 50vw' })}
<span>${fp ? t(fp.label) : esc(img.alt)}</span>
</a>`;
}))).join('\n');

const tour = `<section id="tour" class="wrap sec" aria-labelledby="tour-h">
${secHead(S.tour.heading, 'tour')}
<p>${t(S.tour.intro)}</p>
${tourEmbed}
<ul class="plans">
${planLinks}
</ul>
${planImgs.length ? `<div class="plan-grid">
${planThumbs}
</div>` : ''}
</section>`;

const updates = `<section id="updates" class="wrap sec" aria-labelledby="updates-h">
${secHead(S.updates.heading, 'updates')}
<p>${t(S.updates.intro)}</p>
<table class="updates">
<thead><tr><th scope="col">Date</th><th scope="col">Work</th><th scope="col">Permit</th><th scope="col">Final inspection</th></tr></thead>
<tbody>
${S.updates.items.map((u) => `<tr><td data-th="Date">${t(u.date)}</td><td data-th="Work">${t(u.work)}</td><td data-th="Permit">${t(u.permit)}</td><td data-th="Final inspection">${t(u.finalInspection)}</td></tr>`).join('\n')}
</tbody>
</table>
<p><a class="btn" href="${attr(S.updates.specSheet.file)}" download>${t(S.updates.specSheet.label)}</a></p>
</section>`;

const viewPoster = viewImg.sources.jpg.find((s) => s.w === 1200) || largest(viewImg.sources.jpg);
const viewMedia = (await exists(S.view.video))
  ? `<video class="view-video" controls preload="none" playsinline poster="${attr(viewPoster.src)}" width="${viewImg.width}" height="${viewImg.height}" style="aspect-ratio:${viewImg.width} / ${viewImg.height};background-color:${attr(viewImg.color)}">
<source src="${attr(S.view.video)}" type="video/mp4">
</video>`
  : picture(viewImg, { sizes: '100vw', className: 'view-img' });
const view = `<section id="view" class="sec sec-view" aria-labelledby="view-h">
<div class="wrap">${secHead(S.view.heading, 'view')}</div>
<div class="view-media">${viewMedia}</div>
<div class="band view-band">
<div class="wrap">
${paragraphs(S.view.paragraphs)}
<p class="band-note">${t(S.view.dailySunsetNote)}${(await exists(S.view.video)) ? '' : ` ${missing('Drone reveal video')}`}</p>
</div>
</div>
<div class="wrap">
${gallery(viewImgs.slice(1), 'view-gallery', { cls: 'gallery-row', sizes: ROW_SIZES })}
</div>
</section>`;

const blacksburg = `<section id="blacksburg" class="wrap sec" aria-labelledby="blacksburg-h">
${secHead(S.blacksburg.heading, 'blacksburg')}
<div class="split">
<div>${paragraphs(S.blacksburg.paragraphs)}</div>
<ul class="drive">
${S.blacksburg.driveTimes.map((d) => `<li><span>${t(d.to)}</span><span class="muted">${t(d.minutes)} minutes</span></li>`).join('\n')}
</ul>
</div>
</section>`;

const letter = `<section id="letter" class="sec letter" aria-labelledby="letter-h">
<div class="wrap">
${secHead(S.ownersLetter.heading, 'letter')}
${paragraphs(S.ownersLetter.paragraphs)}
<p class="signature">${t(S.ownersLetter.signature)}</p>
</div>
</section>`;

const ev = S.visit.event;
const visit = `<section id="visit" class="wrap sec" aria-labelledby="visit-h">
${secHead(S.visit.heading, 'visit')}
<p>${t(S.visit.intro)}</p>
<div class="split">
<address class="agent">
<strong>${t(A.name)}</strong><br>
${t(A.title)}, ${t(A.brokerage)}<br>
<a href="${attr(A.phoneHref)}" data-utm="">${t(A.phone)}</a><br>
<a href="mailto:${attr(A.email)}" data-utm="">${t(A.email)}</a>
</address>
<div class="event">
<h3>${t(ev.name)}</h3>
<p>${t(ev.date)} · ${t(ev.time)}</p>
<p class="muted">${t(ev.note)}</p>
</div>
</div>
</section>`;

const ehoSvg = `<svg class="eho" viewBox="0 0 48 48" width="40" height="40" role="img" aria-label="Equal Housing Opportunity"><path d="M24 6 4 22h6v18h28V22h6z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M16 25h16M16 32h16" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`;

const footer = `<footer id="footer">
<div class="wrap">
<h2 class="visually-hidden">Listing information</h2>
<p>${resolveLine(data.footer.brokerageLine)}</p>
<p>${resolveLine(data.footer.mlsLine)}</p>
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
<figcaption><span id="lb-cap"></span><span class="badge" id="lb-badge" hidden>${esc(data.labels.virtuallyStaged)}</span>
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
  offers: { '@type': 'Offer', price: P.price.amount, priceCurrency: P.price.currency, availability: 'https://schema.org/PreOrder', url: site.url },
  provider: {
    '@type': 'RealEstateAgent',
    name: A.name,
    telephone: A.phone,
    email: A.email,
    worksFor: { '@type': 'Organization', name: A.brokerage },
    parentOrganization: { '@type': 'Organization', name: A.brokerage },
  },
};

// LAUNCH_PREVIEW=1 renders the page as it will be on listing day (no noindex) for audits; it never changes site.json.
const noindex = (site.noindex && !process.env.LAUNCH_PREVIEW)
  ? `<!-- Pre-launch: remove the next line (or set site.noindex to false in data/site.json and rebuild) on listing day. -->
<meta name="robots" content="noindex, nofollow">`
  : '';

const analyticsOrigin = new URL(site.analytics.scriptSrc).origin;
const fontsHref = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(TYPE.display)}:wght@300;400&family=${encodeURIComponent(TYPE.text)}:wght@400;500;600&display=swap`;

// Palette tokens are emitted from site.json so the stylesheet never carries a colour of its own.
const tokens = Object.entries(PAL).map(([k, v]) => `--${k}:${v}`).join(';');
const criticalCss = `:root{${tokens};--display:"${TYPE.display}",Georgia,"Times New Roman",serif;--text:"${TYPE.text}",system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color-scheme:light}*,*::before,*::after{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;font-family:var(--text);color:var(--ink);background:var(--cream);line-height:1.55}.hero{position:relative;display:grid;grid-template-rows:auto 1fr;background:var(--ridge);color:var(--cream)}.hero-media{position:relative;grid-row:1;height:min(62svh,34rem);min-height:20rem}.hero-media picture,.hero-img{display:block;width:100%;height:100%}.hero-img{object-fit:cover}.topnav{position:absolute;top:0;left:0;right:0;z-index:5;display:flex;align-items:center;gap:.5rem;padding:0 .5rem;min-height:3rem;background:rgba(29,36,48,.55);color:var(--cream)}.topnav ul{display:flex;gap:.25rem;margin:0;padding:0;list-style:none;overflow-x:auto;white-space:nowrap}.topnav a{display:inline-flex;align-items:center;min-height:2.75rem;padding:0 .6rem;color:inherit;text-decoration:none;font-size:.9rem}.hero-text{grid-row:2;padding:1.75rem 1rem 2.25rem}.hero h1{margin:.25rem 0 .5rem;font-family:var(--display);font-weight:300;font-size:clamp(2rem,6vw,3.6rem);line-height:1.08;letter-spacing:-.01em}@media(min-width:48rem){.hero{display:block;height:min(88svh,56rem);min-height:36rem}.hero-media{position:absolute;inset:0;height:100%}.hero-text{position:absolute;inset:auto 0 0 0;padding:6rem 2rem 3rem;background:linear-gradient(transparent,rgba(29,36,48,.82))}}`;

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
<link rel="preconnect" href="${attr(analyticsOrigin)}" crossorigin>
<style>${criticalCss}</style>
<link rel="stylesheet" href="${attr(fontsHref)}" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="${attr(fontsHref)}"></noscript>
<link rel="stylesheet" href="css/style.css">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
<script defer src="js/gallery.js"></script>
<script defer src="js/utm.js"></script>
<script defer src="${attr(site.analytics.scriptSrc)}" data-cf-beacon='${JSON.stringify({ token: site.analytics.token })}'></script>
</head>`;

const html = `${head}
<body>
<a class="skip" href="#glance">Skip to content</a>
${hero}
<main>
${glance}
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
${lightbox}
</body>
</html>
`;

await fs.writeFile(process.env.PAGE_OUT ? path.resolve(process.env.PAGE_OUT) : path.join(ROOT, 'index.html'), html);

// ---------- tracked links ----------
const tracked = data.channels.map((c) => {
  const q = new URLSearchParams({ utm_source: c.utm.source, utm_medium: c.utm.medium, utm_campaign: c.utm.campaign });
  return `${c.name} → ${site.url}/?${q}`;
}).join('\n');
if (!process.env.PAGE_OUT) await fs.writeFile(path.join(ROOT, 'scripts', 'tracked-links.md'), `# Tracked links (${site.campaign})\n\nGenerated by scripts/build-page.mjs from data/site.json \`channels\`. One line per channel.\n\n${tracked}\n`);

const bytes = Buffer.byteLength(html);
console.log(`index.html written (${(bytes / 1024).toFixed(1)} KB), ${manifest.length} images, ${data.channels.length} tracked links`);
