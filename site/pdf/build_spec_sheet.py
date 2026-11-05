#!/usr/bin/env python3
"""Build assets/cedarview-specs.pdf from data/site.json.

Every fact, figure, date, name and label in the PDF is read from site.json.
Nothing property-specific is hard-coded here. Placeholder values ("TBC...")
never reach the public PDF: a cell still TBC prints as "on request", a row that
is nothing but placeholders is dropped, and footer lines that need the agent or
the MLS number are left out until those are confirmed. PREVIEW_TBC=1 renders
the placeholders as they are, for proofreading.

Run from anywhere:  python3 pdf/build_spec_sheet.py
"""

import datetime as _dt
import json
import os
import re
import sys
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "site.json"
OUT = ROOT / "assets" / "cedarview-specs.pdf"

# ---------------------------------------------------------------- helpers


def load():
    with DATA.open(encoding="utf-8") as fh:
        return json.load(fh)


def get(d, dotted):
    """Resolve 'a.b.c' against nested dicts/lists."""
    cur = d
    for part in dotted.split("."):
        if isinstance(cur, list):
            cur = cur[int(part)]
        else:
            cur = cur[part]
    return cur


def resolve(template, d):
    """Replace {a.b.c} placeholders in a site.json template string."""
    return re.sub(r"\{([a-zA-Z0-9_.]+)\}", lambda m: str(get(d, m.group(1))), template)


REVIEW = bool(os.environ.get("PREVIEW_TBC"))
ON_REQUEST = "on request"
OMITTED = []


def is_tbc(v):
    return isinstance(v, str) and v.startswith("TBC")


def ready(*vals):
    return not any(is_tbc(v) for v in vals)


def omit(what):
    if what not in OMITTED:
        OMITTED.append(what)


def pub(v):
    """A TBC value becomes 'on request' in the public PDF (unchanged in review mode)."""
    if is_tbc(v) and not REVIEW:
        omit(v)
        return ON_REQUEST
    return v


def s(v):
    """Stringify a site.json value for display; escape for Paragraph markup."""
    v = pub(v)
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return escape(f"{v:,}" if isinstance(v, int) else str(v))
    return escape(str(v))


def raw(v):
    v = pub(v)
    return f"{v:,}" if isinstance(v, int) and not isinstance(v, bool) else str(v)


# ---------------------------------------------------------------- styles

INK = colors.HexColor("#1f1f1f")
MUTED = colors.HexColor("#5a5a5a")
RULE = colors.HexColor("#b9b2a6")
BAND = colors.HexColor("#f2efe9")

SERIF = "Times-Roman"
SERIF_B = "Times-Bold"
SANS = "Helvetica"
SANS_B = "Helvetica-Bold"

ST = {
    "title": ParagraphStyle("title", fontName=SERIF_B, fontSize=20, leading=24, textColor=INK, spaceAfter=2),
    "subtitle": ParagraphStyle("subtitle", fontName=SERIF, fontSize=12.5, leading=16, textColor=INK),
    "meta": ParagraphStyle("meta", fontName=SANS, fontSize=8.5, leading=11, textColor=MUTED),
    "price": ParagraphStyle("price", fontName=SERIF_B, fontSize=14, leading=18, textColor=INK, alignment=TA_LEFT),
    "h2": ParagraphStyle("h2", fontName=SERIF_B, fontSize=12.5, leading=15, textColor=INK, spaceBefore=11, spaceAfter=4),
    "body": ParagraphStyle("body", fontName=SANS, fontSize=9, leading=12, textColor=INK),
    "cell": ParagraphStyle("cell", fontName=SANS, fontSize=8.5, leading=10.5, textColor=INK),
    "cellb": ParagraphStyle("cellb", fontName=SANS_B, fontSize=8.5, leading=10.5, textColor=INK),
    "th": ParagraphStyle("th", fontName=SANS_B, fontSize=7.5, leading=9.5, textColor=MUTED),
    "foot": ParagraphStyle("foot", fontName=SANS, fontSize=7, leading=9, textColor=MUTED),
}


def P(text, style="body"):
    return Paragraph(text, ST[style])


def table(header, rows, widths, bold_first=False, bold_rows=()):
    data = [[P(escape(h), "th") for h in header]]
    for i, r in enumerate(rows):
        style = "cellb" if (i in bold_rows) else "cell"
        cells = []
        for j, v in enumerate(r):
            st = "cellb" if (bold_first and j == 0) or style == "cellb" else "cell"
            cells.append(P(s(v), st))
        data.append(cells)
    t = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    ts = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, 0), 0.6, RULE),
        ("LINEBELOW", (0, 1), (-1, -1), 0.25, RULE),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]
    for i in bold_rows:
        ts.append(("BACKGROUND", (0, i + 1), (-1, i + 1), BAND))
    t.setStyle(TableStyle(ts))
    return t


# ---------------------------------------------------------------- build


def build(d):
    site, prop, spec, agent, foot = d["site"], d["property"], d["specSheet"], d["agent"], d["footer"]
    build_date = _dt.date.today().isoformat()
    W = letter[0] - 2 * 0.8 * inch  # usable width

    # footer text, resolved from site.json; lines that need the agent or MLS number wait until those are confirmed
    footer_lines = []
    if REVIEW or ready(agent["name"], agent["brokerage"]):
        contact = [x for x in (agent["phone"], agent["email"]) if REVIEW or ready(x)]
        footer_lines.append(" · ".join([resolve(foot["brokerageLine"], d)] + [raw(x) for x in contact]))
    else:
        omit("footer: agent and brokerage line")
    if REVIEW or ready(prop["mls"]["number"]):
        footer_lines.append(resolve(foot["mlsLine"], d))
    else:
        omit("footer: MLS number line")
    footer_lines += [
        foot["equalHousing"],
        spec["disclaimer"],
        "Built " + build_date + " from site.json · " + raw(site["url"]),
    ]

    def on_page(canvas, doc):
        canvas.saveState()
        y = 0.42 * inch
        canvas.setStrokeColor(RULE)
        canvas.setLineWidth(0.4)
        canvas.line(doc.leftMargin, y + 9 * len(footer_lines) + 4, letter[0] - doc.rightMargin, y + 9 * len(footer_lines) + 4)
        canvas.setFont(SANS, 7)
        canvas.setFillColor(MUTED)
        for i, line in enumerate(reversed(footer_lines)):
            canvas.drawString(doc.leftMargin, y + 9 * i, line)
        canvas.drawRightString(letter[0] - doc.rightMargin, y, "Page %d" % doc.page)
        canvas.restoreState()

    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=letter,
        leftMargin=0.8 * inch,
        rightMargin=0.8 * inch,
        topMargin=0.75 * inch,
        bottomMargin=1.25 * inch,
        title=spec["title"],
        subject=spec["subtitle"],
        author=raw(agent["name"]) if (REVIEW or ready(agent["name"])) else site["name"],
        creator="pdf/build_spec_sheet.py",
    )
    F = []

    # 1. Header
    F.append(P(s(spec["title"]), "title"))
    F.append(P(s(spec["subtitle"]), "subtitle"))
    F.append(Spacer(1, 4))
    hdr = Table(
        [[
            P(s(prop["price"]["display"]) + " &nbsp;&nbsp;<font name='%s' size='9' color='#5a5a5a'>%s</font>" % (SANS, s(prop["status"])), "price"),
            P(s(site["campaign"]) + " · " + s(site["name"]) + "<br/>" + s(site["url"]), "meta"),
        ]],
        colWidths=[W * 0.55, W * 0.45],
    )
    hdr.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("LINEBELOW", (0, 0), (-1, 0), 0.8, INK),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    ST["meta"].alignment = 2  # right-align the campaign/URL block
    F.append(hdr)

    # 2. At a glance
    F.append(P("At a glance", "h2"))
    F.append(table(
        ["", "", ""],
        [[g["label"], g["value"], g["detail"]] for g in d["atAGlance"]],
        [W * 0.24, W * 0.26, W * 0.50],
        bold_first=True,
    ))

    # 3. Square footage by level
    fa = prop["floorArea"]
    unit = fa["unit"]
    F.append(P("Square footage by level", "h2"))
    bbl = {b["level"]: b for b in spec["bedroomsByLevel"]}
    levels = [
        ("Main floor", fa["main"]),
        ("Upper floor", fa["upper"]),
        ("Lower level", fa["lower"]),
    ]
    rows = []
    for level, sqft in levels:
        b = bbl.get(level, {})
        rows.append([level, b.get("bedrooms", ""), raw(sqft) + " " + unit])
    rows.append(["Above ground (main and upper)", "", raw(fa["aboveGround"]) + " " + unit])
    rows.append(["Total finished", raw(prop["bedrooms"]["total"]), raw(fa["total"]) + " " + unit])
    F.append(table(["Level", "Bedrooms", "Finished area"], rows, [W * 0.46, W * 0.22, W * 0.32], bold_rows=(3, 4)))
    F.append(P("Source: " + s(fa["source"]) + ". " + s(fa["display"]) + ".", "meta"))
    ST["meta"].alignment = 0

    # 4. Updated systems
    F.append(P("Updated systems", "h2"))
    F.append(table(
        ["System", "Detail", "Date", "Permit number", "Final inspection"],
        [[x["system"], x["detail"], x["date"], x["permit"], x["finalInspection"]] for x in spec["systems"]],
        [W * 0.14, W * 0.42, W * 0.12, W * 0.16, W * 0.16],
        bold_first=True,
    ))

    # 5. (The page's Updates section is a by-area summary of the table above; permits and inspections live only here.)

    # 6. Appliances (a row that is nothing but placeholders is dropped; the section waits until one row is real)
    appliances = [a for a in spec["appliances"] if REVIEW or ready(a["item"])]
    for a in spec["appliances"]:
        if a not in appliances:
            omit("appliances: %s" % a["room"])
    if appliances:
        F.append(P("Appliances", "h2"))
        F.append(table(
            ["Room", "Item", "Brand", "Year"],
            [[a["room"], a["item"], a["brand"], a["year"]] for a in appliances],
            [W * 0.22, W * 0.36, W * 0.26, W * 0.16],
            bold_first=True,
        ))

    # 7. Internet  (provider only; no speed is ever printed)
    F.append(P("Internet", "h2"))
    net_a, net_b = raw(spec["internet"]), raw(prop["internet"]["display"])
    net_line = net_b if net_a.lower() in net_b.lower() else net_a + " — " + net_b
    F.append(P(escape(net_line), "body"))

    # 8. Lot, view, and the rest
    lot, view = prop["lot"], prop["view"]
    F.append(KeepTogether([P("Lot and view", "h2"), table(
        ["", ""],
        [
            ["Lot", lot["displayLong"]],
            ["Acreage (county)", lot["acresCounty"]],
        ] + ([["Acreage (deed)", lot["acresDeed"]]] if (REVIEW or ready(lot["acresDeed"])) else (omit("lot: deed acreage"), [])[1]) + [
            ["View", view["display"]],
            ["Year built", str(prop["yearBuilt"])],
            ["Style", prop["style"]],
            ["Bathrooms", prop["bathrooms"]["display"]],
            ["Garage", prop["garage"]],
            ["County", prop["address"]["county"]],
        ],
        [W * 0.24, W * 0.76],
        bold_first=True,
    )]))

    doc.build(F, onFirstPage=on_page, onLaterPages=on_page)


# ---------------------------------------------------------------- checks


def extract_text(path):
    from pypdf import PdfReader
    r = PdfReader(str(path))
    return "\n".join((pg.extract_text() or "") for pg in r.pages), len(r.pages)


def check(d):
    text, pages = extract_text(OUT)
    low = text.lower()
    hits = [b for b in d["wordingRules"]["banned"] if b.lower() in low]
    # speed guard: never a speed, whatever unit spelling slipped through
    if re.search(r"\d\s*(mb|gb)(ps|/s)\b", low):
        hits.append("<internet speed>")
    assert not hits, "BANNED WORDING FOUND IN PDF: %r" % hits
    # the public PDF carries no placeholder, ever
    if not REVIEW:
        leaked = re.findall(r"\bTBC\w*", text)
        assert not leaked, "PLACEHOLDER LEAKED INTO PDF: %r" % sorted(set(leaked))
    # a few spot checks that the sheet really carries site.json's values
    for must in (d["specSheet"]["title"], d["footer"]["equalHousing"], d["property"]["price"]["display"]):
        flat = re.sub(r"\s+", " ", must)
        assert flat in re.sub(r"\s+", " ", text), "missing from PDF: %r" % must
    return pages


def main():
    d = load()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    build(d)
    try:
        pages = check(d)
    except AssertionError as e:
        OUT.unlink(missing_ok=True)
        print("BUILD FAILED:", e, file=sys.stderr)
        sys.exit(1)
    print("ok: wrote %s (%d page%s); banned-word check passed" % (OUT.relative_to(ROOT), pages, "" if pages == 1 else "s"))
    if OMITTED:
        print("printed as '%s' or left out until confirmed (%d): %s" % (ON_REQUEST, len(OMITTED), "; ".join(OMITTED)))


if __name__ == "__main__":
    main()
