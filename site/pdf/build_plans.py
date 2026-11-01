#!/usr/bin/env python3
"""Write the floor-plan PDFs that the page links to.

For every entry in sections.tour.floorPlans in data/site.json, the plan's source
image (assets/src/<image>.jpg) is written to the PDF named in `file`, one page,
and all of them together go to sections.tour.allPlansPdf. The page's "PDF" links
then really are PDFs; the plan images themselves are viewed in the lightbox.

Nothing here is specific to the property: names, files and labels come from site.json.
Run from anywhere:  python3 pdf/build_plans.py
"""

import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "site.json"


def main():
    d = json.loads(DATA.read_text(encoding="utf-8"))
    tour = d["sections"]["tour"]
    src_dir = ROOT / d["images"]["sourceDir"]
    title_base = d["site"]["name"]
    pages = []
    written = []
    for fp in tour["floorPlans"]:
        image = fp.get("image") or "plan-" + fp["label"].lower().replace(" ", "-")
        src = src_dir / (image + ".jpg")
        if not src.exists():
            print("skip: no source image for %s (%s)" % (fp["label"], src.relative_to(ROOT)), file=sys.stderr)
            continue
        im = Image.open(src).convert("RGB")
        out = ROOT / fp["file"]
        out.parent.mkdir(parents=True, exist_ok=True)
        im.save(out, "PDF", resolution=150.0, title="%s — %s plan" % (title_base, fp["label"]), author=d["photographer"]["name"])
        written.append(out)
        pages.append(im)
    combined = tour.get("allPlansPdf")
    if combined and pages:
        out = ROOT / combined
        pages[0].save(out, "PDF", resolution=150.0, save_all=True, append_images=pages[1:],
                      title="%s — floor plans" % title_base, author=d["photographer"]["name"])
        written.append(out)
    for w in written:
        print("ok: wrote %s (%d KB)" % (w.relative_to(ROOT), w.stat().st_size // 1024))
    if not written:
        print("BUILD FAILED: no floor-plan PDFs written", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
