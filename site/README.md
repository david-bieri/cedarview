# cedarview.house

Single-page site for 709 Cedarview Drive, Blacksburg, Virginia. Plain HTML, CSS and a little JavaScript; hosted on GitHub Pages at https://cedarview.house.

## One rule
**Every fact lives in `data/site.json`.** Price, dates, permits, square footage, agent details, labels — nothing else hard-codes a fact. To change the price or a date: edit `data/site.json`, run `npm run build`, commit, push.

## Layout
- `data/site.json` — single source of truth
- `assets/src/` — original photos (add the 35–40 curated JPEGs here; staged rooms named per `images.stagedRooms`)
- `scripts/build-images.mjs` — WebP + JPEG fallback at several widths, writes `assets/img/manifest.json`, burns "Virtually staged" onto staged images
- `pdf/build_spec_sheet.py` — writes `assets/cedarview-specs.pdf` from `site.json`
- `scripts/build-page.mjs` — writes `index.html` from `site.json` and the image manifest
- `css/`, `js/` — page styles and the small amount of script (gallery, lazy loading)
- `CNAME`, `robots.txt` — GitHub Pages domain; crawling blocked until launch

## Build
```
npm run build      # images → pdf → page
npm run serve      # http://localhost:8080
```

## Launch-day checklist
1. Set `site.noindex` to `false` and `site.listingLive` to `true` in `data/site.json`; replace `robots.txt` Disallow with Allow.
2. Fill every `TBC` value in `data/site.json` (see the `tbc` list at the bottom).
3. `npm run build`, commit, push.

## Lighthouse
`npm run lighthouse` audits a launch-mode copy of the page (noindex off, built in a temp dir; the repo is untouched). The committed page keeps `noindex` until listing day, which alone lowers Lighthouse's SEO score. Needs Chrome on PATH or `CHROME_PATH`.
