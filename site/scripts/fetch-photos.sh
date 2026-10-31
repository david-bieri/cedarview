#!/usr/bin/env bash
# Downloads the curated photo shortlist from the photographer's CDN into assets/src/.
# Run from the repo root on a machine with normal internet access:  bash scripts/fetch-photos.sh
# Then: npm run build
set -euo pipefail
cd "$(dirname "$0")/.."
python3 - <<'PY'
import json, urllib.request, pathlib
d = json.load(open("assets/src/photos.json"))
out = pathlib.Path("assets/src"); out.mkdir(exist_ok=True)
for p in d["shortlist"]:
    dest = out / (p["name"] + ".jpg")
    if dest.exists() and dest.stat().st_size > 50_000: continue
    print("fetching", p["name"])
    urllib.request.urlretrieve(p["url"], dest)
# the four plans also go to assets/plans/ for the download links
plans = pathlib.Path("assets/plans"); plans.mkdir(exist_ok=True)
for p in d["shortlist"]:
    if p["group"] == "plans":
        src = out / (p["name"] + ".jpg")
        (plans / (p["name"].replace("plan-", "") + ".jpg")).write_bytes(src.read_bytes())
print("done")
PY
