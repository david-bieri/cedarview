# cedarview.house

Single-page site for 709 Cedarview Drive, Blacksburg, Virginia. Plain HTML, CSS and a little JavaScript; hosted on GitHub Pages at https://cedarview.house.

## Two rules
**Every fact lives in `data/site.json`.** Price, dates, permits, square footage, agent details, labels — nothing else hard-codes a fact. To change the price or a date: edit `data/site.json`, run `npm run build`, commit, push.

**A placeholder never reaches the public page.** A value that still begins with `TBC` is simply left out: a place whose minutes are not yet measured shows no time, work without a dated permit goes in a plain "Major work" list instead of the table, the owner's letter is not a section until it is written, the contact block, sticky showing bar and footer lines wait for the agent's details, and the analytics beacon is not loaded without a token. The build prints what was left out, and `npm run check` (the last step of `npm run build`) fails if a `TBC` ever makes it into `index.html` or the spec-sheet PDF. To proofread the placeholders, `npm run review` writes `review.html` (git-ignored) with every one of them highlighted.

## Layout
- `data/site.json` — single source of truth
- `assets/src/` — original photos (the curated JPEGs from the photographer; staged rooms named per `images.stagedRooms`)
- `scripts/build-images.mjs` — WebP + JPEG fallback at several widths, writes `assets/img/manifest.json`, burns "Virtually staged" onto staged images
- `pdf/build_spec_sheet.py` — writes `assets/cedarview-specs.pdf` from `site.json`
- `pdf/build_plans.py` — writes the floor-plan PDFs in `assets/plans/` (one per plan plus all three together) from the plan images
- `scripts/build-page.mjs` — writes `index.html` from `site.json` and the image manifest
- `scripts/check-launch.mjs` — fails the build on a leaked placeholder, a bad `tel:`/`mailto:` link or a missing local file; stricter once `site.listingLive` is true
- `css/`, `js/` — page styles; `js/gallery.js` (gallery and lightbox), `js/site.js` (phone section menu, sticky showing bar, click-to-start 3D tour with a no-WebGL fallback), `js/utm.js`
- `CNAME`, `robots.txt` — GitHub Pages domain; crawling blocked until launch

## Page structure worth knowing
- The twilight hero is followed by the daylight front elevation (`images.daylight`), full width, so the form of the house reads before anyone scrolls. That photo is dropped from the grounds gallery so it appears once.
- The 3D tour shows a still of the house (`property.tour.poster`) with a Start button; the Matterport iframe is created only on click. A browser without WebGL gets a one-line note instead of a black canvas, and the direct "Open the tour in Matterport" link is always there.
- Floor plans: "View" opens the plan in the lightbox; "PDF" downloads a real PDF. The old links said PDF and pointed at JPEGs.
- The sticky "Schedule a showing" bar (`cta`) appears once the hero scrolls away and hides while the Visit section is on screen. It is only rendered once `agent.phone` or `agent.email` is set.
- Below 48rem the section list collapses into a "Sections" menu.

## Build
```
npm run build      # images → pdf → page → check
npm run review     # review.html with every TBC placeholder highlighted
npm run serve      # http://localhost:8080
```

## Launch-day checklist
1. Fill every `TBC` value in `data/site.json` — `npm run check` lists them by path. The agent's name, phone (E.164 in `phoneHref`) and email, the MLS number, the permit dates and numbers, measured drive times, the owner's letter.
2. Set `site.noindex` to `false` and `site.listingLive` to `true`; replace `robots.txt` Disallow with Allow. From then on the check refuses to build without the agent's contact details.
3. `npm run build`, commit, push.

## Lighthouse
`npm run lighthouse` audits a launch-mode copy of the page (noindex off, built in a temp dir; the repo is untouched). The committed page keeps `noindex` until listing day, which alone lowers Lighthouse's SEO score. Needs Chrome on PATH or `CHROME_PATH`.

## The map and the album
- **Map** (`sections.blacksburg.map`): Leaflet with OpenStreetMap tiles (desaturated in CSS), no API key, no cookies. Pins come from `sections.blacksburg.groups` (each place has `lat`/`lng`; `offMap: true` keeps the airport off it, `fit: false` keeps I-81 out of the opening frame). Pin colour per group is `themeColors`. The 15-minute walking wash is a hand-simplified polygon from the measured routes. For no-JS and print the build draws a schematic (pins to scale, no streets); `npm run map-image` on a machine with Chrome and internet replaces it with a real still at `assets/img/map-fallback.png`.
- **Album** (`album`): the "A year on Cedarview Drive" strip under The View — photos and short clips together, in the order of the year. Everything about it lives in one file, **`assets/album/album.txt`**: one line per item, `file | season | caption`, in page order; lines starting with `#` are comments. To add a photo: drop the `.jpg` into `assets/album/`, add a line, push. To add a clip: drop a 9:16 `.mp4` (under `property.video.maxBytes`) and a `.jpg` poster of the same name, add a line. If a file is in the folder but not in the list, the build appends a stub line (`[caption]`) and leaves it off the page until the caption is written. The season label decides the tab (Spring / Summer / Autumn / Winter — "September" counts as autumn, "Any Saturday" shows under All only). `scripts/build-album.mjs` sizes photos and burns "From the owners' album" on every rendition; clip posters go unlabelled. Edits can be made on github.com directly: upload the file to `site/assets/album/`, edit `album.txt` in the browser, commit — the Pages workflow rebuilds. No faces of children; nothing that dates the house.
