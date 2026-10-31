# cedarview

One repo, one GitHub Pages site, two things in it:

| Path | What | Source |
|---|---|---|
| `/` → **cedarview.house** | The listing website for 709 Cedarview Drive | `site/` (plain HTML/CSS/JS, built by `site/scripts/`) |
| `/prep-7c3/` | The private punch-list app used during listing prep | `src/` (React + Vite) |

The punch list sits on a non-obvious path because it holds private notes and the listing site is public and promoted; it is still `noindex` and unlinked. Change the path in `vite.config.js` (`base`) if you want another.

## Build and deploy

`npm run build` builds both into `dist/`: the listing site first (`scripts/build-site.mjs` runs `site/`'s image → PDF → page pipeline and copies the publishable files), then the punch-list app into `dist/prep-7c3/`. The workflow in `.github/workflows/deploy.yml` does the same on every push to `main` and publishes `dist/` to GitHub Pages. `CNAME` at the root carries the custom domain.

**Listing site facts** live only in `site/data/site.json`; `site/README.md` and `site/STYLE.md` explain the rules. To change the price or a date: edit that file, commit, push.

**Photos:** `site/assets/src/` holds the curated originals (tracked). The responsive renditions in `site/assets/img/` are generated at build time and are git-ignored; only `manifest.json` there is tracked.

**Local:**
```bash
npm ci && (cd site && npm ci)
pip install pillow reportlab pypdf
npm run build && npx serve dist      # or: python3 -m http.server -d dist 8080
```

---

## Punch-list app (original notes)

Static, single-page punch list for listing prep. React + Vite, no backend. Progress is stored in the browser's `localStorage`.

Live at `https://<your-username>.github.io/cedarview/`

---

## Before you push: one thing to decide

**A GitHub Pages site is publicly readable, even when the repo is private.** Private repos as a Pages source need GitHub Pro; publishing the *site* privately needs an Enterprise Cloud organization. On any normal plan, anyone with the URL sees the page.

What's on the page: your address nickname, room-by-room condition of the house, your children's first names, and what's broken. That's a reasonable thing to think about before publishing it to an unauthenticated URL.

Three ways to handle it:

1. **Accept it.** `noindex` is set in `index.html` and the URL is not linked anywhere, so it won't be indexed. Obscurity, not security.
2. **Genericize the labels.** Change the four bedroom names in `src/App.jsx` to "Bedroom 1–4". Two minutes, removes most of what you'd mind a stranger reading.
3. **Use Cloudflare Pages instead** (see below). Same git workflow, and you can put a real login in front of it for free.

---

## Setup

```bash
# 1. create the repo
gh repo create cedarview --public --source=. --push
# (or: create it on github.com, then git remote add origin … && git push -u origin main)

# 2. local dev
npm install
npm run dev
```

Then on GitHub: **Settings → Pages → Source → GitHub Actions**. Push to `main` and the workflow in `.github/workflows/deploy.yml` builds and deploys.

## Repo name and `base`

`vite.config.js` sets `base: "/cedarview/"`. For a project site this **must** match the repo name exactly, or every asset 404s and you get a blank white page. If you rename the repo, change it here too.

The one exception: if you name the repo `<your-username>.github.io`, it's a user site served from the root, and `base` must be `"/"`.

## Adding items

Two ways.

**In the app** — the "+ Add an item" button. Title, room, trade, phase. Typing a room that doesn't exist yet creates a new section for it. Items added this way are tagged `yours`, live in `localStorage` alongside your checkmarks, and can be removed from their expanded panel. Nothing to deploy.

Caveat: they're per-browser like everything else here, and "Reset all" clears checkmarks but keeps your added items.

**In the code** — for items you want everyone to see on a fresh browser, add them to `ITEMS`. This is also the only way to set `blocked` dependencies.

## Editing the list

Everything lives in the `ITEMS` array at the top of `src/App.jsx`. Each entry:

```js
{ id: "f9", t: "Light fixtures — front & back", ph: 5,
  room: "Exterior", trade: "Electrical",
  blocked: ["b2", "b3"],        // ids that must be done first
  added: true,                  // shows an "added" tag — not from the notebook
  note: "Exterior-rated." }
```

- `ph` maps to `PHASES` (0–7).
- `blocked` drives the "Waiting on —" line. Reference item `id`s.
- `blockAll: true` blocks until every non-phase-7 item is done (used for carpet cleaning).
- Adding a new `room` string? Add it to `ROOM_ORDER` so it sorts sensibly in room view.

Bumping `STORAGE_KEY` (e.g. `v1` → `v2`) resets everyone's saved progress. Don't do it casually.

---

## Known limits

- **State is per-browser.** Your phone and your wife's phone keep separate lists. There is no sync. If two people need one shared list, this architecture is the wrong one — use Supabase behind an Express API, or a shared Google Sheet.
- Clearing site data wipes progress. There's no export beyond the "copy what's ready to start" button.
- Free-tier Pages: 1 GB site, 100 GB/month bandwidth, 10 builds/hour. Not close to any of them.

## Cloudflare Pages alternative

Identical repo, no changes to the code. Connect the GitHub repo in the Cloudflare dashboard, build command `npm run build`, output directory `dist`. Two things it gives you that Pages doesn't:

- Deploys from a **private** repo on the free tier.
- **Cloudflare Access** in front of the site — email one-time-code login, free for a small number of users. That's actual access control, not obscurity.

If you'd rather the house details not be public, this is the version to run.
