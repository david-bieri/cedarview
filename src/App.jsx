import { useState, useEffect, useMemo } from "react";

/* ---------------------------------- data --------------------------------- */

const PHASES = [
  { id: 0, code: "00", name: "Book & order", hint: "Lead time, not labor", color: "#3F5E6B" },
  { id: 1, code: "01", name: "Demo & structure", hint: "Dust, holes, noise", color: "#7A5A3C" },
  { id: 2, code: "02", name: "Wash", hint: "Before any paint", color: "#4A88A8" },
  { id: 3, code: "03", name: "Patch & trim", hint: "Before any paint", color: "#B39B72" },
  { id: 4, code: "04", name: "Paint", hint: "Ceilings, walls, exterior", color: "#B8863B" },
  { id: 5, code: "05", name: "Fixtures & hardware", hint: "Onto finished surfaces", color: "#4C5A6E" },
  { id: 6, code: "06", name: "Flooring", hint: "After paint cures", color: "#6E5B4E" },
  { id: 7, code: "07", name: "Final clean", hint: "After everyone leaves", color: "#4F8464" },
];

const ROOMS = [
  { n: "Family room", f: "Basement" },
  { n: "Bedroom #4 (Airlie)", f: "Basement" },
  { n: "Bedroom #5 (Greta)", f: "Basement" },
  { n: "Bedroom #6 (Clara)", f: "Basement" },
  { n: "Bedroom #7 (Cole)", f: "Basement" },
  { n: "Bathroom #4", f: "Basement" },
  { n: "Mudroom", f: "Basement" },
  { n: "Master bedroom", f: "First floor" },
  { n: "Master bathroom", f: "First floor" },
  { n: "Dining room", f: "First floor" },
  { n: "Living room", f: "First floor" },
  { n: "Library", f: "First floor" },
  { n: "TV room", f: "First floor" },
  { n: "Kitchen", f: "First floor" },
  { n: "Breakfast nook", f: "First floor" },
  { n: "Screened porch", f: "First floor" },
  { n: "Laundry room", f: "First floor" },
  { n: "Half-bath", f: "First floor" },
  { n: "Bedroom #1", f: "Second floor" },
  { n: "Bedroom #2 (Daisy)", f: "Second floor" },
  { n: "Bedroom #3 (Heidi)", f: "Second floor" },
  { n: "Play room", f: "Second floor" },
  { n: "Bathroom #1", f: "Second floor" },
  { n: "Bathroom #2", f: "Second floor" },
  { n: "Balcony", f: "Second floor" },
  { n: "Garage", f: "Outside" },
  { n: "Storage room", f: "Outside" },
  { n: "Exterior", f: "Outside" },
  { n: "Yard", f: "Outside" },
  { n: "Driveway", f: "Outside" },
  { n: "Back patio", f: "Outside" },
  { n: "Deck", f: "Outside" },
  { n: "Back steps", f: "Outside" },
  { n: "Whole house", f: "Whole house" },
];

const FLOOR_ORDER = ["Basement", "First floor", "Second floor", "Outside", "Whole house"];
const roomFloor = (r) => (ROOMS.find((x) => x.n === r) || {}).f || "Unassigned";
const roomRank = (r) => {
  const i = ROOMS.findIndex((x) => x.n === r);
  return i === -1 ? ROOMS.length : i;
};

const TRADES = [
  "Carpentry", "Cleaning", "Decision", "Drywall", "Electrical", "Exterior",
  "Flooring", "Hardware", "Landscaping", "Paint", "Plumbing", "Purchase", "Radon", "Tree",
];

// sz: S = under an hour, M = half a day, L = a full day or more. Rough, for planning only.
const SIZES = { S: "under 1h", M: "half day", L: "full day+" };

const blankDraft = { t: "", room: "", ph: 5, trade: "", sz: "S" };

const ITEMS = [
  // 00 — book & order
  { id: "b1", t: "Book radon contractor", ph: 0, room: "Exterior", trade: "Radon", sz: "S", sub: true, note: "Discharge point is a standard inspection flag — fix before it's written up." },
  { id: "b2", t: "Book electrician — one visit", ph: 0, room: "Whole house", trade: "Electrical", sz: "S", sub: true, note: "Ten jobs on this list are electrical. One trip charge." },
  { id: "b3", t: "Buy all light fixtures", ph: 0, room: "Whole house", trade: "Purchase", sz: "M", note: "Must be in hand before the electrician arrives." },
  { id: "b4", t: "Measure & order carpet", ph: 0, room: "Play room", trade: "Purchase", sz: "S", note: "1–3 week material lead time." },
  { id: "b5", t: "Measure & order blinds", ph: 0, room: "Master bedroom", trade: "Purchase", sz: "S", note: "Inside-mount width and drop." },
  { id: "b6", t: "Book pressure washing", ph: 0, room: "Exterior", trade: "Exterior", sz: "S", note: "Or rent a washer and do it yourself — it's a full day for facade, deck and balcony." },
  { id: "b7", t: "Decide: paint half-bath + Bathroom #4?", ph: 0, room: "Whole house", trade: "Decision", sz: "S", note: "Both were left as “Paint?” in the notebook. Small rooms, cheap coat, reads well in photos." },
  { id: "b8", t: "Confirm paint colors, pull match chips", ph: 0, room: "Whole house", trade: "Decision", sz: "S", note: "No leftover cans? Take a 2×2in chip from an inconspicuous spot. Touch-ups in the wrong sheen look worse than none." },
  { id: "b9", t: "Get range make + model", ph: 0, room: "Kitchen", trade: "Purchase", sz: "S", note: "Needed to order the knob." },
  { id: "b10", t: "Measure toilet rough-in", ph: 0, room: "Master bathroom", trade: "Purchase", sz: "S", note: "Wall to bolt centers, usually 12in." },
  { id: "b11", t: "Confirm existing deck & balcony finish", ph: 0, room: "Exterior", trade: "Decision", sz: "S", added: true, note: "Ask the paint specialists what went on originally and match it. Stain soaks into the wood, paint sits on top — paint will cover stain, but stain won't take over paint. Settle this before buying anything for the seal/stain job." },

  // 01 — demo & structure
  { id: "s1", t: "Remove gate / stud supports", ph: 1, room: "Library", trade: "Carpentry", sz: "M" },
  { id: "s2", t: "Rebuild back steps — 4x4s, iron rods", ph: 1, room: "Back steps", trade: "Carpentry", sz: "L" },
  { id: "s3", t: "Pipe support at ceiling", ph: 1, room: "Mudroom", trade: "Carpentry", sz: "S" },
  { id: "s4", t: "Balcony wood stabilization", ph: 1, room: "Balcony", trade: "Carpentry", sz: "L" },
  { id: "s5", t: "Ceiling patches", ph: 1, room: "Garage", trade: "Drywall", sz: "M" },
  { id: "s9", t: "Replace rotted wood siding — west side", ph: 1, room: "Exterior", trade: "Carpentry", sz: "L", note: "Outside the master bath and Bedroom #1/#2 level, west elevation. Open it up far enough to find where the water is getting in — rot outside a wet room is often a flashing or shower-wall leak, not weather." },
  { id: "s10", t: "Replace failing deck boards", ph: 1, room: "Deck", trade: "Carpentry", sz: "L", added: true, note: "Before the deck gets pressure washed — no point cleaning boards that are coming out. Look at the joists while the deck is open; soft boards usually mean water has been sitting on the framing underneath." },
  { id: "s11", t: "Fix failing mailbox top", ph: 1, room: "Exterior", trade: "Carpentry", sz: "S", added: true },
  { id: "s12", t: "Remove dead electrical wire", ph: 1, room: "Exterior", trade: "Electrical", sz: "S", added: true, note: "Verified dead and disconnected at the box." },
  { id: "s6", t: "Dead tree removal", ph: 1, room: "Yard", trade: "Tree", sz: "L", sub: true, note: "The one job on this list where DIY risk is real. Sub it unless the tree is small and clear of everything." },
  { id: "s7", t: "Brush removal", ph: 1, room: "Yard", trade: "Landscaping", sz: "M" },
  { id: "s8", t: "Weed killer — front yard", ph: 1, room: "Yard", trade: "Landscaping", sz: "S", note: "Apply 10–14 days before mulching so the weeds actually die back. Treating after the mulch goes down wastes both." },

  // 02 — wash
  { id: "w1", t: "Pressure wash facade", ph: 2, room: "Exterior", trade: "Exterior", sz: "M", blocked: ["b6", "s9"], note: "Repair the rot first — a pressure washer will tear soft siding apart." },
  { id: "w2", t: "Pressure wash deck", ph: 2, room: "Exterior", trade: "Exterior", sz: "M", blocked: ["b6", "s10"] },
  { id: "w3", t: "Pressure wash balcony", ph: 2, room: "Balcony", trade: "Exterior", sz: "S", blocked: ["b6", "s4"] },

  // 03 — patch & trim
  { id: "t1", t: "Patch shelf holes", ph: 3, room: "Master bedroom", trade: "Drywall", sz: "S" },
  { id: "t2", t: "Door trim at entrance", ph: 3, room: "Master bedroom", trade: "Carpentry", sz: "M" },
  { id: "t7", t: "Patch ceiling cracks", ph: 3, room: "Master bathroom", trade: "Drywall", sz: "M", note: "Check whether the crack is active before filling it — a moving or moisture-driven crack reopens through the patch. Worth connecting to the siding rot on the same elevation." },
  { id: "t3", t: "Shoe molding + trim", ph: 3, room: "Master bathroom", trade: "Carpentry", sz: "M" },
  { id: "t4", t: "Fix trim / shoe molding", ph: 3, room: "Bathroom #4", trade: "Carpentry", sz: "M" },
  { id: "t5", t: "Patch wall scars from gate removal", ph: 3, room: "Library", trade: "Drywall", sz: "M", added: true, blocked: ["s1"] },
  { id: "t6", t: "Caulk + spot-prime all patches", ph: 3, room: "Whole house", trade: "Paint", sz: "M", added: true, blocked: ["t1", "t5", "t7", "s5"], note: "One pass with the caulk gun through every patched room. Don't do this room by room." },

  // 04 — paint
  { id: "c1", t: "Paint ceiling", ph: 4, room: "Play room", trade: "Paint", sz: "M" },
  { id: "c14", t: "Paint walls", ph: 4, room: "TV room", trade: "Paint", sz: "M", blocked: ["b8"] },
  { id: "c15", t: "Paint touch-up", ph: 4, room: "Bedroom #1", trade: "Paint", sz: "S", blocked: ["b8"] },
  { id: "c16", t: "Paint touch-up", ph: 4, room: "Bedroom #2 (Daisy)", trade: "Paint", sz: "S", blocked: ["b8"] },
  { id: "c17", t: "Paint touch-up", ph: 4, room: "Bedroom #3 (Heidi)", trade: "Paint", sz: "S", blocked: ["b8"] },
  { id: "c2", t: "Paint drywall — primer + 2 coats", ph: 4, room: "Bedroom #4 (Airlie)", trade: "Paint", sz: "L", note: "The only room needing a full coat rather than touch-up." },
  { id: "c5", t: "Paint touch-up", ph: 4, room: "Bedroom #5 (Greta)", trade: "Paint", sz: "S", blocked: ["b8"] },
  { id: "c3", t: "Paint touch-up", ph: 4, room: "Bedroom #6 (Clara)", trade: "Paint", sz: "S", blocked: ["b8"] },
  { id: "c4", t: "Paint touch-up", ph: 4, room: "Bedroom #7 (Cole)", trade: "Paint", sz: "S", blocked: ["b8"] },
  { id: "c6", t: "Paint touch-up + corridor", ph: 4, room: "Family room", trade: "Paint", sz: "M", blocked: ["b8"] },
  { id: "c7", t: "Trim repaint", ph: 4, room: "Master bathroom", trade: "Paint", sz: "M", blocked: ["t3", "t7"] },
  { id: "c8", t: "Paint", ph: 4, room: "Half-bath", trade: "Paint", sz: "M", blocked: ["b7"] },
  { id: "c9", t: "Paint", ph: 4, room: "Bathroom #4", trade: "Paint", sz: "M", blocked: ["b7", "t4"] },
  { id: "c10", t: "Paint exterior doors", ph: 4, room: "Exterior", trade: "Paint", sz: "M", blocked: ["w1"] },
  { id: "c13", t: "Prime + paint replacement siding", ph: 4, room: "Exterior", trade: "Paint", sz: "M", added: true, blocked: ["s9", "w1"], note: "Bare replacement boards need primer plus topcoat, or they read as a patch from the street." },
  { id: "c11", t: "Paint door trusses", ph: 4, room: "Garage", trade: "Paint", sz: "M", blocked: ["s5"] },
  { id: "c12", t: "Seal / stain balcony, deck & front steps", ph: 4, room: "Exterior", trade: "Paint", sz: "L", added: true, blocked: ["b11", "w3", "w2", "s10"], note: "One job, three surfaces. Buy the material once and run all three in a single pass — separate batches on separate weekends will not match." },
  { id: "c18", t: "Repaint mailbox", ph: 4, room: "Exterior", trade: "Paint", sz: "S", added: true, blocked: ["s11"] },

  // 05 — fixtures & hardware
  { id: "f1", t: "Overhead lights", ph: 5, room: "Kitchen", trade: "Electrical", sz: "S", sub: true, blocked: ["b2", "b3"] },
  { id: "f2", t: "Light switch rewiring", ph: 5, room: "Kitchen", trade: "Electrical", sz: "S", sub: true, blocked: ["b2"] },
  { id: "f3", t: "Fix lights", ph: 5, room: "Library", trade: "Electrical", sz: "S", sub: true, blocked: ["b2", "b3"] },
  { id: "f4", t: "Replace vanity lights", ph: 5, room: "Master bathroom", trade: "Electrical", sz: "S", sub: true, blocked: ["b2", "b3", "c7"] },
  { id: "f5", t: "Jacuzzi switch fix / replace", ph: 5, room: "Master bathroom", trade: "Electrical", sz: "S", sub: true, blocked: ["b2"], note: "Confirm GFCI requirement for the circuit." },
  { id: "f6", t: "Fix light / replace", ph: 5, room: "Half-bath", trade: "Electrical", sz: "S", sub: true, blocked: ["b2", "b3", "c8"] },
  { id: "f7", t: "Shower light fix", ph: 5, room: "Bathroom #1", trade: "Electrical", sz: "S", sub: true, blocked: ["b2", "b3"], note: "Must be damp/wet-rated." },
  { id: "f8", t: "Replace lights", ph: 5, room: "Balcony", trade: "Electrical", sz: "S", sub: true, blocked: ["b2", "b3"], note: "Exterior-rated." },
  { id: "f9", t: "Light fixtures — front & back", ph: 5, room: "Exterior", trade: "Electrical", sz: "S", sub: true, blocked: ["b2", "b3", "c10"] },
  { id: "f10", t: "Smoke detector replacement", ph: 5, room: "Bedroom #6 (Clara)", trade: "Electrical", sz: "S", sub: true, blocked: ["b2"], note: "If the house is on interconnected hardwired units, match the model or replace all together." },
  { id: "f26", t: "Dryer cord connection", ph: 5, room: "Laundry room", trade: "Electrical", sz: "S", sub: true, blocked: ["b2"], note: "Match the cord to the receptacle — 3-prong and 4-prong are not interchangeable. Check which the outlet is before buying." },
  { id: "f20", t: "Replace toilet", ph: 5, room: "Master bathroom", trade: "Plumbing", sz: "M", sub: true, blocked: ["b10", "c7"], note: "DIY-able in a half day if the flange is sound. Sub it if you'd rather not find out mid-job." },
  { id: "f21", t: "Faucet plate", ph: 5, room: "Exterior", trade: "Plumbing", sz: "S", note: "Measure hole spacing before buying." },
  { id: "f11", t: "Outlet cover", ph: 5, room: "Family room", trade: "Hardware", sz: "S", blocked: ["c6"] },
  { id: "f12", t: "Replace door handles", ph: 5, room: "Whole house", trade: "Hardware", sz: "L", note: "Count every door first. One finish throughout. Do all of them in one session — it's the same three motions each time." },
  { id: "f13", t: "Replace exterior door handle", ph: 5, room: "Exterior", trade: "Hardware", sz: "S", blocked: ["c10"] },
  { id: "f14", t: "Drawer handle replacement", ph: 5, room: "Half-bath", trade: "Hardware", sz: "S", blocked: ["c8"] },
  { id: "f15", t: "Drawer handle replacement", ph: 5, room: "Bathroom #4", trade: "Hardware", sz: "S", blocked: ["c9"] },
  { id: "f16", t: "Drawer handle", ph: 5, room: "Bathroom #1", trade: "Hardware", sz: "S" },
  { id: "f17", t: "Towel rack", ph: 5, room: "Bathroom #2", trade: "Hardware", sz: "S" },
  { id: "f18", t: "Install blinds", ph: 5, room: "Master bedroom", trade: "Hardware", sz: "S", blocked: ["b5"] },
  { id: "f19", t: "Range knob replacement", ph: 5, room: "Kitchen", trade: "Hardware", sz: "S", blocked: ["b9"] },
  { id: "f25", t: "Fridge butter tray glue", ph: 5, room: "Kitchen", trade: "Hardware", sz: "S" },
  { id: "f27", t: "Fix cabinet door hinge", ph: 5, room: "Kitchen", trade: "Hardware", sz: "S", added: true, note: "A door that sags or won't sit flush usually needs the hinge adjusted, not replaced — cup hinges have separate screws for side, depth and height. If the screw holes in the carcass are stripped, glue a dowel or matchstick in and re-drive rather than moving to a fatter screw." },
  { id: "f28", t: "Glue cabinet slat next to fridge", ph: 5, room: "Kitchen", trade: "Carpentry", sz: "S", added: true, note: "Scrape the old glue off both faces first — fresh glue won't bond to a glazed joint. Clamp it, or pull it tight with painter's tape, and leave it overnight." },
  { id: "f22", t: "Fix umbrella holder", ph: 5, room: "Back patio", trade: "Hardware", sz: "S" },
  { id: "f23", t: "Porch screen", ph: 5, room: "Screened porch", trade: "Carpentry", sz: "M" },
  { id: "f24", t: "Balcony screen door", ph: 5, room: "Balcony", trade: "Carpentry", sz: "M", note: "Measure the opening. Repair vs. replace." },

  // 06 — flooring
  { id: "r1", t: "Install carpet", ph: 6, room: "Play room", trade: "Flooring", sz: "M", sub: true, blocked: ["c1", "b4"], note: "Usually bundled with the carpet purchase. Ceiling paint first — reversing this is the most expensive mistake available on this list." },

  // 07 — final clean
  { id: "z1", t: "Clean gutters, fasten nails", ph: 7, room: "Exterior", trade: "Cleaning", sz: "M" },
  { id: "z2", t: "Clean skylights", ph: 7, room: "Exterior", trade: "Cleaning", sz: "S" },
  { id: "z2b", t: "Sweep brush debris, remove weeds", ph: 7, room: "Driveway", trade: "Landscaping", sz: "S", blocked: ["s7", "w1"], note: "Do the driveway cracks in the same pass as the front-yard weed killer — one mix, one trip." },
  { id: "z3", t: "Mulch beds", ph: 7, room: "Yard", trade: "Landscaping", sz: "L", blocked: ["s6", "s7", "s8"], note: "Last outdoor act — mulch shows the footprints of every trade that walks past it." },
  { id: "z4", t: "Whole-house carpet cleaning", ph: 7, room: "Whole house", trade: "Cleaning", sz: "M", sub: true, blockAll: true, note: "The final interior task, after every other person has left the house." },
];

const STORAGE_KEY = "cedarview:punchlist:v2";
/* ---------------------------------- app ---------------------------------- */

export default function PunchList() {
  const [done, setDone] = useState({});
  const [notes, setNotes] = useState({});
  const [custom, setCustom] = useState([]);
  const [owners, setOwners] = useState({});
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(blankDraft);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [groupBy, setGroupBy] = useState("phase");
  const [filter, setFilter] = useState("open");
  const [phaseFilter, setPhaseFilter] = useState(null);
  const [open, setOpen] = useState(null);
  const [copied, setCopied] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          setDone(parsed.done || {});
          setNotes(parsed.notes || {});
          setCustom(parsed.custom || []);
          setOwners(parsed.owners || {});
        }
      } catch (e) {
        /* first run — nothing saved yet */
      }
      setLoaded(true);
    })();
  }, []);

  const persist = async (nextDone, nextNotes, nextCustom = custom, nextOwners = owners) => {
    setSaveState("saving");
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          done: nextDone, notes: nextNotes, custom: nextCustom, owners: nextOwners,
        })
      );
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1200);
    } catch (e) {
      setSaveState("error");
    }
  };

  const toggle = (id) => {
    const next = { ...done };
    if (next[id]) delete next[id];
    else next[id] = new Date().toISOString().slice(0, 10);
    setDone(next);
    persist(next, notes);
  };

  const setNote = (id, val) => {
    const next = { ...notes, [id]: val };
    setNotes(next);
    persist(done, next);
  };

  const allItems = useMemo(() => [...ITEMS, ...custom], [custom]);
  const rooms = useMemo(
    () => [...new Set(allItems.map((i) => i.room))].sort((a, b) => roomRank(a) - roomRank(b)),
    [allItems]
  );

  const addItem = () => {
    const title = draft.t.trim();
    if (!title) return;
    const item = {
      id: `x${Date.now().toString(36)}`,
      t: title,
      ph: Number(draft.ph),
      room: draft.room.trim() || "Whole house",
      trade: draft.trade.trim() || "General",
      note: draft.note.trim() || undefined,
      mine: true,
    };
    const next = [...custom, item];
    setCustom(next);
    persist(done, notes, next);
    setDraft({ ...blankDraft, room: item.room, ph: item.ph });
    setAdding(false);
    setPhaseFilter(null);
    setFilter("open");
  };

  const removeItem = (id) => {
    const nextCustom = custom.filter((i) => i.id !== id);
    const nextDone = { ...done };
    const nextNotes = { ...notes };
    delete nextDone[id];
    delete nextNotes[id];
    setCustom(nextCustom);
    setDone(nextDone);
    setNotes(nextNotes);
    setOpen(null);
    persist(nextDone, nextNotes, nextCustom);
  };

  // who does it: defaults come from the item (electrical/plumbing/specialist = sub),
  // and any override the user has set wins.
  const ownerOf = (item) => owners[item.id] || { mode: item.sub ? "sub" : "diy", who: "" };

  const setOwner = (id, patch) => {
    const cur = owners[id] || {};
    const base = allItems.find((i) => i.id === id);
    const next = {
      ...owners,
      [id]: { mode: base.sub ? "sub" : "diy", who: "", ...cur, ...patch },
    };
    setOwners(next);
    persist(done, notes, custom, next);
  };

  const isBlocked = (item) => {
    if (item.blockAll) return allItems.some((o) => o.ph !== 7 && !done[o.id]);
    if (!item.blocked) return false;
    return item.blocked.some((b) => !done[b]);
  };

  const blockerNames = (item) => {
    if (item.blockAll) {
      const n = allItems.filter((o) => o.ph !== 7 && !done[o.id]).length;
      return `${n} item${n === 1 ? "" : "s"} still open`;
    }
    return item.blocked
      .filter((b) => !done[b])
      .map((b) => {
        const src = allItems.find((o) => o.id === b);
        return src.room === "Whole house" || src.ph === 0 ? src.t : `${src.t} — ${src.room}`;
      })
      .join(" · ");
  };

  const doneCount = allItems.filter((i) => done[i.id]).length;
  const pct = allItems.length ? Math.round((doneCount / allItems.length) * 100) : 0;

  const phaseStats = useMemo(
    () =>
      PHASES.map((p) => {
        const all = allItems.filter((i) => i.ph === p.id);
        const d = all.filter((i) => done[i.id]).length;
        return { ...p, total: all.length, done: d, pct: all.length ? d / all.length : 0 };
      }),
    [done, allItems]
  );

  const visible = allItems.filter((i) => {
    if (phaseFilter !== null && i.ph !== phaseFilter) return false;
    if (filter === "open" && done[i.id]) return false;
    if (filter === "done" && !done[i.id]) return false;
    return true;
  });

  const groups = useMemo(() => {
    if (groupBy === "trade") {
      const ts = [...new Set(visible.map((i) => i.trade))].sort();
      return ts.map((t) => ({
        key: t,
        label: t,
        sub: `${allItems.filter((i) => i.trade === t && done[i.id]).length}/${
          allItems.filter((i) => i.trade === t).length
        } complete`,
        color: muted,
        items: visible.filter((i) => i.trade === t),
      }));
    }
    if (groupBy === "phase") {
      return PHASES.map((p) => ({
        key: p.id,
        label: `${p.code} · ${p.name}`,
        sub: p.hint,
        color: p.color,
        items: visible.filter((i) => i.ph === p.id),
      })).filter((g) => g.items.length);
    }
    const shown = [...new Set(visible.map((i) => i.room))].sort(
      (a, b) => roomRank(a) - roomRank(b)
    );
    return shown.map((r) => ({
      key: r,
      label: r,
      sub: roomFloor(r),
      color: muted,
      items: visible.filter((i) => i.room === r),
    }));
  }, [visible, groupBy, done, allItems]);

  const copyOpen = () => {
    const ready = allItems.filter((i) => !done[i.id] && !isBlocked(i));
    const mine = ready.filter((i) => ownerOf(i).mode === "diy");
    const subs = ready.filter((i) => ownerOf(i).mode === "sub");
    const fmt = (list) =>
      list.map((i) => `- ${i.room} (${roomFloor(i.room)}): ${i.t}`).join("\n");
    const text =
      `Cedarview — ready to start\n\nMe (${mine.length})\n${fmt(mine)}` +
      (subs.length ? `\n\nSubcontract (${subs.length})\n${fmt(subs)}` : "");
    try {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (e) {
      /* clipboard unavailable */
    }
  };

  const resetProgress = () => {
    if (!resetArmed) {
      setResetArmed(true);
      setTimeout(() => setResetArmed(false), 4000);
      return;
    }
    setResetArmed(false);
    setDone({});
    persist({}, notes);
  };

  const P = (id) => PHASES[id];

  return (
    <div style={S.shell}>
      <style>{CSS}</style>

      <header style={S.header}>
        <div style={S.headRow}>
          <div>
            <div style={S.eyebrow}>Listing prep</div>
            <h1 style={S.title}>Cedarview</h1>
          </div>
          <div style={S.counter}>
            <div style={S.counterNum}>{pct}%</div>
            <div style={S.counterSub}>
              {doneCount}/{allItems.length}
            </div>
          </div>
        </div>
        <div style={S.bar}>
          <div style={{ ...S.barFill, width: `${pct}%` }} />
        </div>
      </header>

      {/* fan deck */}
      <div style={S.deckWrap}>
        <div style={S.deck} className="deck">
          {phaseStats.map((p) => {
            const active = phaseFilter === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setPhaseFilter(active ? null : p.id)}
                style={{
                  ...S.chip,
                  outline: active ? `2px solid ${p.color}` : "2px solid transparent",
                  outlineOffset: 2,
                }}
                aria-pressed={active}
              >
                <span style={{ ...S.chipSwatch, backgroundColor: `${p.color}22` }}>
                  <span
                    style={{
                      ...S.chipFill,
                      backgroundColor: p.color,
                      height: `${p.pct * 100}%`,
                    }}
                  />
                  <span style={S.chipCode}>{p.code}</span>
                </span>
                <span style={S.chipName}>{p.name}</span>
                <span style={S.chipCount}>
                  {p.done}/{p.total}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* controls */}
      <div style={S.controls}>
        <div style={S.segment}>
          {[
            ["phase", "Phase"],
            ["room", "Room"],
            ["trade", "Trade"],
          ].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setGroupBy(v)}
              style={{ ...S.segBtn, ...(groupBy === v ? S.segBtnOn : {}) }}
            >
              {l}
            </button>
          ))}
        </div>
        <div style={S.segment}>
          {[
            ["open", "Open"],
            ["all", "All"],
            ["done", "Done"],
          ].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              style={{ ...S.segBtn, ...(filter === v ? S.segBtnOn : {}) }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {phaseFilter !== null && (
        <button onClick={() => setPhaseFilter(null)} style={S.clearFilter}>
          Showing {P(phaseFilter).name} only — clear
        </button>
      )}

      {/* add */}
      <div style={S.addWrap}>
        {!adding ? (
          <button onClick={() => setAdding(true)} style={S.addOpen}>
            + Add an item
          </button>
        ) : (
          <div style={S.addPanel}>
            <input
              autoFocus
              value={draft.t}
              onChange={(e) => setDraft({ ...draft, t: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
              placeholder="What needs doing"
              style={S.input}
            />
            <div style={S.addRow}>
              <input
                list="room-list"
                value={draft.room}
                onChange={(e) => setDraft({ ...draft, room: e.target.value })}
                placeholder="Room"
                style={{ ...S.input, flex: 1 }}
              />
              <datalist id="room-list">
                {rooms.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
              <input
                list="trade-list"
                value={draft.trade}
                onChange={(e) => setDraft({ ...draft, trade: e.target.value })}
                placeholder="Trade"
                style={{ ...S.input, flex: 1 }}
              />
              <datalist id="trade-list">
                {TRADES.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <select
              value={draft.ph}
              onChange={(e) => setDraft({ ...draft, ph: Number(e.target.value) })}
              style={S.input}
            >
              {PHASES.map((ph) => (
                <option key={ph.id} value={ph.id}>
                  {ph.code} · {ph.name}
                </option>
              ))}
            </select>
            <div style={S.addRow}>
              <button onClick={addItem} style={S.addSave} disabled={!draft.t.trim()}>
                Add item
              </button>
              <button
                onClick={() => {
                  setAdding(false);
                  setDraft(blankDraft);
                }}
                style={S.addCancel}
              >
                Cancel
              </button>
            </div>
            <div style={S.addHint}>
              A new room name is fine — type it and it becomes a section.
            </div>
          </div>
        )}
      </div>

      {/* list */}
      <main style={S.main}>
        {!loaded && <div style={S.empty}>Loading your saved progress…</div>}

        {loaded && groups.length === 0 && (
          <div style={S.empty}>
            {filter === "open"
              ? "Nothing open here. Change the filter or pick another phase."
              : "Nothing to show with these filters."}
          </div>
        )}

        {groups.map((g) => (
          <section key={g.key} style={S.group}>
            <div style={S.groupHead}>
              <span style={{ ...S.groupDot, backgroundColor: g.color }} />
              <span style={S.groupLabel}>{g.label}</span>
              <span style={S.groupSub}>{g.sub}</span>
            </div>

            {g.items.map((i) => {
              const isDone = !!done[i.id];
              const blocked = !isDone && isBlocked(i);
              const expanded = open === i.id;
              const own = ownerOf(i);
              return (
                <div
                  key={i.id}
                  style={{
                    ...S.item,
                    borderLeft: `4px solid ${P(i.ph).color}`,
                    opacity: isDone ? 0.5 : 1,
                  }}
                >
                  <div style={S.itemRow}>
                    <button
                      onClick={() => toggle(i.id)}
                      className="check"
                      style={{
                        ...S.check,
                        borderColor: isDone ? P(i.ph).color : "#B7BEB9",
                        backgroundColor: isDone ? P(i.ph).color : "transparent",
                      }}
                      aria-label={isDone ? `Mark ${i.t} not done` : `Mark ${i.t} done`}
                    >
                      {isDone && <span style={S.checkMark}>✓</span>}
                    </button>

                    <button
                      onClick={() => setOpen(expanded ? null : i.id)}
                      style={S.itemBody}
                    >
                      <div
                        style={{
                          ...S.itemTitle,
                          textDecoration: isDone ? "line-through" : "none",
                        }}
                      >
                        {i.t}
                        {i.added && <span style={S.addedTag}>added</span>}
                        {i.mine && <span style={S.addedTag}>yours</span>}
                      </div>
                      <div style={S.itemMeta}>
                        {groupBy === "room"
                          ? `${P(i.ph).code} ${P(i.ph).name}`
                          : `${i.room} · ${roomFloor(i.room)}`}
                        <span style={S.dot}>·</span>
                        {i.trade}
                        <span style={S.dot}>·</span>
                        {SIZES[i.sz] || ""}
                        {notes[i.id] ? <span style={S.hasNote}>· note</span> : null}
                      </div>
                      <div style={S.ownerLine}>
                        <span
                          style={{
                            ...S.ownerChip,
                            borderColor: own.mode === "sub" ? "#8A5A2B" : "#6E7873",
                            color: own.mode === "sub" ? "#8A5A2B" : muted,
                          }}
                        >
                          {own.mode === "sub" ? own.who || "Subcontract" : "Me"}
                        </span>
                      </div>
                      {blocked && (
                        <div style={S.blocked}>Waiting on — {blockerNames(i)}</div>
                      )}
                    </button>
                  </div>

                  {expanded && (
                    <div style={S.expand}>
                      <div style={S.ownerRow}>
                        <div style={S.segment}>
                          {[
                            ["diy", "I'll do it"],
                            ["sub", "Subcontract"],
                          ].map(([m, l]) => (
                            <button
                              key={m}
                              onClick={() => setOwner(i.id, { mode: m })}
                              style={{ ...S.segBtn, ...(own.mode === m ? S.segBtnOn : {}) }}
                            >
                              {l}
                            </button>
                          ))}
                        </div>
                        {own.mode === "sub" && (
                          <input
                            value={own.who}
                            onChange={(e) => setOwner(i.id, { who: e.target.value })}
                            placeholder="Who — name or company"
                            style={{ ...S.input, flex: 1 }}
                          />
                        )}
                      </div>
                      {i.note && <p style={S.builtNote}>{i.note}</p>}
                      <textarea
                        value={notes[i.id] || ""}
                        onChange={(e) => setNote(i.id, e.target.value)}
                        placeholder="Quote, measurement, who's doing it…"
                        style={S.textarea}
                        rows={2}
                      />
                      <div style={S.expandFoot}>
                        {isDone && <span style={S.doneStamp}>Marked done {done[i.id]}</span>}
                        {i.mine && (
                          <button onClick={() => removeItem(i.id)} style={S.removeBtn}>
                            Remove item
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </main>

      <footer style={S.footer}>
        <button onClick={copyOpen} style={S.footBtn}>
          {copied ? "Copied" : "Copy what's ready to start"}
        </button>
        <button
          onClick={resetProgress}
          style={{
            ...S.footBtn,
            ...S.footBtnQuiet,
            ...(resetArmed ? S.footBtnArmed : {}),
          }}
        >
          {resetArmed ? "Tap again to clear" : "Reset progress"}
        </button>
        <div style={S.saveNote}>
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && "Saved"}
          {saveState === "error" && "Couldn't save — changes are in this session only"}
          {saveState === "idle" &&
            (resetArmed
              ? "Clears ticks only — notes, added items and who's doing what are kept"
              : "Progress saves automatically")}
        </div>
      </footer>
    </div>
  );
}

/* --------------------------------- styles -------------------------------- */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Public+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
* { box-sizing: border-box; }
button { font: inherit; cursor: pointer; }
button:disabled { opacity: .4; cursor: not-allowed; }
input, select, textarea { font: inherit; }
.deck::-webkit-scrollbar { height: 0; }
/* The tick box stays 24px visually, but the tap target is stretched to ~44px.
   Insets stay inside the row's own padding and gap, so this never overlaps
   the item body button next to it. */
.check { position: relative; }
.check::before {
  content: ""; position: absolute;
  top: -10px; bottom: -10px; left: -12px; right: -6px;
}
button:focus-visible, textarea:focus-visible { outline: 2px solid #14211D; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

const ink = "#14211D";
const muted = "#525A56";  // AA 4.5:1 on paper, surface and the #CDD3CF segment
const paper = "#DDE1DE";
const surface = "#F4F6F3";
const disp = "'Barlow Condensed', system-ui, sans-serif";
const body = "'Public Sans', system-ui, sans-serif";
const mono = "'IBM Plex Mono', ui-monospace, monospace";

const S = {
  shell: {
    fontFamily: body, backgroundColor: paper, color: ink,
    minHeight: "100vh", maxWidth: 720, margin: "0 auto", paddingBottom: 40,
  },
  header: { padding: "22px 18px 0" },
  headRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-end" },
  eyebrow: {
    fontFamily: mono, fontSize: 10, letterSpacing: "0.18em",
    textTransform: "uppercase", color: muted,
  },
  title: {
    fontFamily: disp, fontSize: 46, lineHeight: 0.9, fontWeight: 700,
    letterSpacing: "-0.01em", textTransform: "uppercase", margin: "4px 0 0",
  },
  counter: { textAlign: "right" },
  counterNum: { fontFamily: disp, fontSize: 34, fontWeight: 700, lineHeight: 1 },
  counterSub: { fontFamily: mono, fontSize: 11, color: muted },
  bar: { height: 3, backgroundColor: "#C6CCC7", marginTop: 14, borderRadius: 2, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: ink, transition: "width .4s ease" },

  deckWrap: { padding: "18px 0 4px" },
  deck: {
    display: "flex", gap: 8, overflowX: "auto", padding: "0 18px 6px",
    scrollbarWidth: "none",
  },
  chip: {
    flex: "0 0 auto", width: 96, background: "none", border: "none",
    padding: 0, textAlign: "left", borderRadius: 3,
  },
  chipSwatch: {
    display: "block", position: "relative", height: 62, borderRadius: 2,
    overflow: "hidden", marginBottom: 6,
  },
  chipFill: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    transition: "height .45s cubic-bezier(.2,.7,.3,1)",
  },
  chipCode: {
    position: "absolute", top: 6, left: 7, fontFamily: mono, fontSize: 10,
    letterSpacing: "0.1em", color: ink, mixBlendMode: "multiply",
  },
  chipName: {
    display: "block", fontFamily: disp, fontSize: 15, fontWeight: 600,
    lineHeight: 1.05, textTransform: "uppercase", letterSpacing: "0.01em",
  },
  chipCount: { display: "block", fontFamily: mono, fontSize: 10, color: muted, marginTop: 2 },

  controls: { display: "flex", gap: 8, padding: "10px 18px 4px", flexWrap: "wrap" },
  segment: { display: "flex", backgroundColor: "#CDD3CF", borderRadius: 3, padding: 2 },
  segBtn: {
    border: "none", background: "none", padding: "6px 11px", borderRadius: 2,
    fontFamily: mono, fontSize: 11, letterSpacing: "0.04em", color: muted,
  },
  segBtnOn: { backgroundColor: surface, color: ink, fontWeight: 500 },
  clearFilter: {
    margin: "0 18px", border: "none", background: "none", padding: "14px 0",
    fontFamily: mono, fontSize: 11, color: muted, textDecoration: "underline",
  },

  addWrap: { padding: "12px 18px 0" },
  addOpen: {
    width: "100%", border: `1px dashed #A9B1AC`, background: "none", color: muted,
    padding: "11px 0", borderRadius: 2, fontFamily: mono, fontSize: 11.5,
    letterSpacing: "0.04em",
  },
  addPanel: {
    backgroundColor: surface, padding: 12, borderRadius: 2,
    display: "flex", flexDirection: "column", gap: 8,
    borderLeft: `4px solid ${ink}`,
  },
  addRow: { display: "flex", gap: 8 },
  input: {
    // 16px is the floor: below it iOS Safari zooms the page on focus.
    width: "100%", fontFamily: body, fontSize: 16, padding: "9px 10px",
    border: `1px solid #C6CCC7`, borderRadius: 2, backgroundColor: paper,
    color: ink, minWidth: 0,
  },
  addSave: {
    flex: 1, border: `1px solid ${ink}`, backgroundColor: ink, color: surface,
    padding: "10px 0", borderRadius: 2, fontFamily: mono, fontSize: 11.5,
    letterSpacing: "0.04em",
  },
  addCancel: {
    flex: 1, border: `1px solid #C6CCC7`, background: "none", color: muted,
    padding: "10px 0", borderRadius: 2, fontFamily: mono, fontSize: 11.5,
  },
  addHint: { fontFamily: mono, fontSize: 10, color: muted },

  main: { padding: "14px 18px 0" },
  empty: {
    padding: "38px 4px", fontSize: 14, color: muted, textAlign: "center",
  },
  group: { marginBottom: 26 },
  groupHead: {
    display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8,
    paddingBottom: 6, borderBottom: `1px solid #C6CCC7`,
  },
  groupDot: { width: 9, height: 9, borderRadius: 1, alignSelf: "center" },
  groupLabel: {
    fontFamily: disp, fontSize: 19, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.01em",
  },
  groupSub: { fontFamily: mono, fontSize: 10, color: muted, marginLeft: "auto" },

  item: { backgroundColor: surface, marginBottom: 5, borderRadius: 2, transition: "opacity .25s ease" },
  itemRow: { display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 12px" },
  check: {
    flex: "0 0 auto", width: 24, height: 24, borderRadius: 2, border: "2px solid",
    marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center",
    transition: "background-color .18s ease",
  },
  checkMark: { color: surface, fontSize: 13, lineHeight: 1 },
  itemBody: { flex: 1, background: "none", border: "none", padding: 0, textAlign: "left" },
  itemTitle: { fontSize: 15, fontWeight: 500, lineHeight: 1.3 },
  addedTag: {
    fontFamily: mono, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase",
    color: muted, border: `1px solid #C6CCC7`, borderRadius: 2, padding: "1px 4px", marginLeft: 7,
  },
  itemMeta: { fontFamily: mono, fontSize: 10.5, color: muted, marginTop: 3 },
  ownerLine: { marginTop: 5 },
  ownerChip: {
    display: "inline-block", fontFamily: mono, fontSize: 9.5, letterSpacing: "0.06em",
    textTransform: "uppercase", border: "1px solid", borderRadius: 2, padding: "1px 5px",
  },
  ownerRow: { display: "flex", gap: 8, alignItems: "center", marginBottom: 9, flexWrap: "wrap" },
  dot: { margin: "0 5px" },
  hasNote: { marginLeft: 5 },
  blocked: {
    fontFamily: mono, fontSize: 10.5, color: "#8A5A2B", marginTop: 5,
    lineHeight: 1.4,
  },
  expand: { padding: "0 12px 12px 46px" },
  builtNote: { fontSize: 13, color: muted, lineHeight: 1.5, margin: "0 0 8px" },
  textarea: {
    // 16px for the same reason as S.input.
    width: "100%", fontFamily: body, fontSize: 16, padding: 8, borderRadius: 2,
    border: `1px solid #C6CCC7`, backgroundColor: paper, color: ink, resize: "vertical",
  },
  expandFoot: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: 10, marginTop: 8, minHeight: 14,
  },
  doneStamp: { fontFamily: mono, fontSize: 10, color: muted },
  removeBtn: {
    marginLeft: "auto", border: "none", background: "none", padding: "14px 0 14px 16px",
    fontFamily: mono, fontSize: 10, color: "#8A5A2B", textDecoration: "underline",
  },

  footer: { padding: "10px 18px 0", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
  footBtn: {
    border: `1px solid ${ink}`, backgroundColor: ink, color: surface,
    padding: "9px 14px", borderRadius: 2, fontFamily: mono, fontSize: 11,
    letterSpacing: "0.04em",
  },
  footBtnQuiet: { backgroundColor: "transparent", color: ink, marginLeft: "auto" },
  footBtnArmed: { borderColor: "#8A5A2B", color: "#8A5A2B" },
  saveNote: { width: "100%", fontFamily: mono, fontSize: 10, color: muted, marginTop: 8 },
};
