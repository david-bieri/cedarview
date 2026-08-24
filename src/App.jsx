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

const ITEMS = [
  // 00 — book & order
  { id: "b1", t: "Book radon contractor", ph: 0, room: "Exterior", trade: "Radon", note: "Discharge point is a standard inspection flag — fix before it's written up." },
  { id: "b2", t: "Book electrician — one visit", ph: 0, room: "Whole house", trade: "Electrical", note: "Ten jobs on this list are electrical. One trip charge." },
  { id: "b3", t: "Buy all light fixtures", ph: 0, room: "Whole house", trade: "Purchase", note: "Must be in hand before the electrician arrives." },
  { id: "b4", t: "Measure & order play room carpet", ph: 0, room: "Play room", trade: "Purchase", note: "1–3 week material lead time." },
  { id: "b5", t: "Measure & order master blinds", ph: 0, room: "Master BR", trade: "Purchase", note: "Inside-mount width and drop." },
  { id: "b6", t: "Book pressure washing", ph: 0, room: "Exterior", trade: "Exterior", note: "Weather-dependent. Needs a dry window plus 48–72h drying." },
  { id: "b7", t: "Decide: paint main toilet + downstairs bath?", ph: 0, room: "Whole house", trade: "Decision", note: "Both were left as “Paint?” in the notebook. Small rooms, cheap coat, reads well in photos." },
  { id: "b8", t: "Confirm paint colors, pull match chips", ph: 0, room: "Whole house", trade: "Decision", note: "No leftover cans? Take a 2×2in chip from an inconspicuous spot. Touch-ups in the wrong sheen look worse than none." },
  { id: "b9", t: "Get range make + model", ph: 0, room: "Kitchen", trade: "Purchase", note: "Needed to order the knob." },
  { id: "b10", t: "Measure master toilet rough-in", ph: 0, room: "Master bath", trade: "Purchase", note: "Wall to bolt centers, usually 12in." },

  // 01 — demo & structure
  { id: "s1", t: "Remove gate / stud supports", ph: 1, room: "Library", trade: "Carpentry" },
  { id: "s2", t: "Rebuild back steps — 4x4s, iron rods", ph: 1, room: "Back steps", trade: "Carpentry" },
  { id: "s3", t: "Pipe support at ceiling", ph: 1, room: "Mudroom", trade: "Carpentry" },
  { id: "s4", t: "Balcony wood stabilization", ph: 1, room: "Balcony", trade: "Carpentry" },
  { id: "s5", t: "Ceiling patches", ph: 1, room: "Garage", trade: "Drywall" },
  { id: "s6", t: "Dead tree removal", ph: 1, room: "Yard", trade: "Tree" },
  { id: "s7", t: "Brush removal", ph: 1, room: "Yard", trade: "Landscaping" },
  { id: "s9", t: "Replace rotted wood siding — west side", ph: 1, room: "Exterior", trade: "Carpentry", note: "Outside the master bath and the 2nd-floor bedroom, west elevation. Open it up far enough to find where the water is getting in — rot outside a wet room is often a flashing or shower-wall leak, not weather." },
  { id: "s8", t: "Weed killer — front yard", ph: 1, room: "Yard", trade: "Landscaping", note: "Apply 10–14 days before mulching so the weeds actually die back. Treating after the mulch goes down wastes both." },

  // 02 — wash
  { id: "w1", t: "Pressure wash facade", ph: 2, room: "Exterior", trade: "Exterior", blocked: ["b6", "s9"], note: "Repair the rot first — a pressure washer will tear soft siding apart." },
  { id: "w2", t: "Pressure wash deck", ph: 2, room: "Exterior", trade: "Exterior", blocked: ["b6"] },
  { id: "w3", t: "Pressure wash balcony", ph: 2, room: "Balcony", trade: "Exterior", blocked: ["b6", "s4"] },

  // 03 — patch & trim
  { id: "t1", t: "Patch shelf holes", ph: 3, room: "Master BR", trade: "Drywall" },
  { id: "t2", t: "Door trim at entrance", ph: 3, room: "Master BR", trade: "Carpentry" },
  { id: "t3", t: "Shoe molding + trim", ph: 3, room: "Master bath", trade: "Carpentry" },
  { id: "t4", t: "Fix trim / shoe molding", ph: 3, room: "Downstairs bath", trade: "Carpentry" },
  { id: "t5", t: "Patch wall scars from gate removal", ph: 3, room: "Library", trade: "Drywall", added: true, blocked: ["s1"] },
  { id: "t6", t: "Caulk + spot-prime all patches", ph: 3, room: "Whole house", trade: "Paint", added: true, blocked: ["t1", "t5", "t7", "s5"] },
  { id: "t7", t: "Patch ceiling cracks", ph: 3, room: "Master bath", trade: "Drywall", note: "Check whether the crack is active before filling it — a moving or moisture-driven crack reopens through the patch." },

  // 04 — paint
  { id: "c1", t: "Paint ceiling", ph: 4, room: "Play room", trade: "Paint" },
  { id: "c2", t: "Paint drywall — primer + 2 coats", ph: 4, room: "Airlie's room", trade: "Paint", note: "The only room needing a full coat rather than touch-up." },
  { id: "c3", t: "Paint touch-up", ph: 4, room: "Clara's room", trade: "Paint", blocked: ["b8"] },
  { id: "c4", t: "Paint touch-up", ph: 4, room: "Cole's room", trade: "Paint", blocked: ["b8"] },
  { id: "c5", t: "Paint touch-up", ph: 4, room: "Greta's room", trade: "Paint", blocked: ["b8"] },
  { id: "c6", t: "Paint touch-up", ph: 4, room: "Family room / corridor", trade: "Paint", blocked: ["b8"] },
  { id: "c7", t: "Trim repaint", ph: 4, room: "Master bath", trade: "Paint", blocked: ["t3"] },
  { id: "c8", t: "Paint", ph: 4, room: "Main toilet", trade: "Paint", blocked: ["b7"] },
  { id: "c9", t: "Paint", ph: 4, room: "Downstairs bath", trade: "Paint", blocked: ["b7", "t4"] },
  { id: "c10", t: "Paint exterior doors", ph: 4, room: "Exterior", trade: "Paint", blocked: ["w1"] },
  { id: "c11", t: "Paint door trusses", ph: 4, room: "Garage", trade: "Paint", blocked: ["s5"] },
  { id: "c13", t: "Prime + paint replacement siding", ph: 4, room: "Exterior", trade: "Paint", added: true, blocked: ["s9", "w1"], note: "Bare replacement boards need primer plus topcoat, or they read as a patch from the street." },
  { id: "c12", t: "Seal / stain balcony wood", ph: 4, room: "Balcony", trade: "Paint", added: true, blocked: ["w3"], note: "Sealing over dirt fails within a season." },

  // 05 — fixtures & hardware
  { id: "f1", t: "Overhead lights", ph: 5, room: "Kitchen", trade: "Electrical", blocked: ["b2", "b3"] },
  { id: "f2", t: "Light switch rewiring", ph: 5, room: "Kitchen", trade: "Electrical", blocked: ["b2"] },
  { id: "f3", t: "Fix lights", ph: 5, room: "Library", trade: "Electrical", blocked: ["b2", "b3"] },
  { id: "f4", t: "Replace vanity lights", ph: 5, room: "Master bath", trade: "Electrical", blocked: ["b2", "b3"] },
  { id: "f5", t: "Jacuzzi switch fix / replace", ph: 5, room: "Master bath", trade: "Electrical", blocked: ["b2"], note: "Confirm GFCI requirement for the circuit." },
  { id: "f6", t: "Fix light / replace", ph: 5, room: "Main toilet", trade: "Electrical", blocked: ["b2", "b3"] },
  { id: "f7", t: "Shower light fix", ph: 5, room: "Bath #1", trade: "Electrical", blocked: ["b2", "b3"], note: "Must be damp/wet-rated." },
  { id: "f8", t: "Replace lights", ph: 5, room: "Balcony", trade: "Electrical", blocked: ["b2", "b3"], note: "Exterior-rated." },
  { id: "f9", t: "Light fixtures — front & back", ph: 5, room: "Exterior", trade: "Electrical", blocked: ["b2", "b3"] },
  { id: "f10", t: "Smoke detector replacement", ph: 5, room: "Clara's room", trade: "Electrical", blocked: ["b2"], note: "If the house is on interconnected hardwired units, match the model or replace all together." },
  { id: "f11", t: "Outlet cover", ph: 5, room: "Family room / corridor", trade: "Hardware", blocked: ["c6"] },
  { id: "f12", t: "Replace door handles", ph: 5, room: "Whole house", trade: "Hardware", note: "Count every door first. One finish throughout." },
  { id: "f13", t: "Replace exterior door handle", ph: 5, room: "Exterior", trade: "Hardware", blocked: ["c10"] },
  { id: "f14", t: "Drawer handle replacement", ph: 5, room: "Main toilet", trade: "Hardware" },
  { id: "f15", t: "Drawer handle replacement", ph: 5, room: "Downstairs bath", trade: "Hardware" },
  { id: "f16", t: "Drawer handle", ph: 5, room: "Bath #1", trade: "Hardware" },
  { id: "f17", t: "Towel rack", ph: 5, room: "Bath #2", trade: "Hardware" },
  { id: "f18", t: "Install blinds", ph: 5, room: "Master BR", trade: "Hardware", blocked: ["b5"] },
  { id: "f19", t: "Range knob replacement", ph: 5, room: "Kitchen", trade: "Hardware", blocked: ["b9"] },
  { id: "f20", t: "Replace toilet", ph: 5, room: "Master bath", trade: "Plumbing", blocked: ["b10"] },
  { id: "f21", t: "Faucet plate", ph: 5, room: "Exterior", trade: "Plumbing", note: "Measure hole spacing before buying." },
  { id: "f22", t: "Fix umbrella holder", ph: 5, room: "Back patio", trade: "Hardware" },
  { id: "f23", t: "Porch screen", ph: 5, room: "Porch", trade: "Carpentry" },
  { id: "f24", t: "Balcony screen door", ph: 5, room: "Balcony", trade: "Carpentry", note: "Measure the opening. Repair vs. replace." },
  { id: "f25", t: "Fridge butter tray glue", ph: 5, room: "Kitchen", trade: "Hardware" },
  { id: "f26", t: "Dryer cord connection", ph: 5, room: "Laundry", trade: "Electrical", blocked: ["b2"], note: "Match the cord to the receptacle — 3-prong and 4-prong are not interchangeable. Check which the outlet is before buying." },

  // 06 — flooring
  { id: "r1", t: "Install carpet", ph: 6, room: "Play room", trade: "Flooring", blocked: ["c1", "b4"], note: "Ceiling paint first. Reversing this is the most expensive mistake available on this list." },

  // 07 — final clean
  { id: "z1", t: "Clean gutters, fasten nails", ph: 7, room: "Exterior", trade: "Cleaning" },
  { id: "z2", t: "Clean skylights", ph: 7, room: "Exterior", trade: "Cleaning" },
  { id: "z2b", t: "Sweep brush debris, remove weeds", ph: 7, room: "Driveway", trade: "Landscaping", blocked: ["s7", "w1"], note: "Do the driveway cracks in the same pass as the front-yard weed killer — one mix, one trip." },
  { id: "z3", t: "Mulch beds", ph: 7, room: "Yard", trade: "Landscaping", blocked: ["s6", "s7", "s8"], note: "Last outdoor act — mulch shows the footprints of every trade that walks past it." },
  { id: "z4", t: "Whole-house carpet cleaning", ph: 7, room: "Whole house", trade: "Cleaning", blockAll: true, note: "The final interior task, after every other person has left the house." },
];

const STORAGE_KEY = "cedarview:punchlist:v1";
const ROOM_ORDER = [
  "Exterior", "Yard", "Driveway", "Back patio", "Back steps", "Porch", "Balcony", "Garage",
  "Mudroom", "Laundry", "Kitchen", "Family room / corridor", "Library", "Play room",
  "Master BR", "Master bath", "Main toilet", "Downstairs bath", "Bath #1", "Bath #2",
  "Airlie's room", "Clara's room", "Cole's room", "Greta's room", "Whole house",
];

// rooms you add yourself aren't in ROOM_ORDER — sort them to the end, not the front
const roomRank = (r) => {
  const i = ROOM_ORDER.indexOf(r);
  return i === -1 ? ROOM_ORDER.length : i;
};

const TRADES = [
  "Carpentry", "Cleaning", "Decision", "Drywall", "Electrical", "Exterior",
  "Flooring", "Hardware", "Landscaping", "Paint", "Plumbing", "Purchase", "Radon", "Tree",
];

const blankDraft = { t: "", room: "", ph: 5, trade: "", note: "" };

/* ---------------------------------- app ---------------------------------- */

export default function PunchList() {
  const [done, setDone] = useState({});
  const [notes, setNotes] = useState({});
  const [custom, setCustom] = useState([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(blankDraft);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [groupBy, setGroupBy] = useState("phase");
  const [filter, setFilter] = useState("open");
  const [phaseFilter, setPhaseFilter] = useState(null);
  const [open, setOpen] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          setDone(parsed.done || {});
          setNotes(parsed.notes || {});
          setCustom(parsed.custom || []);
        }
      } catch (e) {
        /* first run — nothing saved yet */
      }
      setLoaded(true);
    })();
  }, []);

  const persist = async (nextDone, nextNotes, nextCustom = custom) => {
    setSaveState("saving");
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ done: nextDone, notes: nextNotes, custom: nextCustom })
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
      sub: `${allItems.filter((i) => i.room === r && done[i.id]).length}/${
        allItems.filter((i) => i.room === r).length
      } complete`,
      color: "#6E7873",
      items: visible.filter((i) => i.room === r),
    }));
  }, [visible, groupBy, done, allItems]);

  const copyOpen = () => {
    const lines = allItems.filter((i) => !done[i.id] && !isBlocked(i)).map(
      (i) => `- ${i.room}: ${i.t}`
    );
    const text = `Cedarview — ready to start (${lines.length})\n\n${lines.join("\n")}`;
    try {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (e) {
      /* clipboard unavailable */
    }
  };

  const resetAll = () => {
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
            ["phase", "By phase"],
            ["room", "By room"],
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
                        {groupBy === "phase" ? i.room : `${P(i.ph).code} ${P(i.ph).name}`}
                        <span style={S.dot}>·</span>
                        {i.trade}
                        {notes[i.id] ? <span style={S.hasNote}>· note</span> : null}
                      </div>
                      {blocked && (
                        <div style={S.blocked}>Waiting on — {blockerNames(i)}</div>
                      )}
                    </button>
                  </div>

                  {expanded && (
                    <div style={S.expand}>
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
        <button onClick={resetAll} style={{ ...S.footBtn, ...S.footBtnQuiet }}>
          Reset all
        </button>
        <div style={S.saveNote}>
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && "Saved"}
          {saveState === "error" && "Couldn't save — changes are in this session only"}
          {saveState === "idle" && "Progress saves automatically"}
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
button:focus-visible, textarea:focus-visible { outline: 2px solid #14211D; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

const ink = "#14211D";
const muted = "#6E7873";
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
    margin: "8px 18px 0", border: "none", background: "none", padding: 0,
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
    width: "100%", fontFamily: body, fontSize: 14, padding: "9px 10px",
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
  dot: { margin: "0 5px" },
  hasNote: { marginLeft: 5 },
  blocked: {
    fontFamily: mono, fontSize: 10.5, color: "#8A5A2B", marginTop: 5,
    lineHeight: 1.4,
  },
  expand: { padding: "0 12px 12px 46px" },
  builtNote: { fontSize: 13, color: muted, lineHeight: 1.5, margin: "0 0 8px" },
  textarea: {
    width: "100%", fontFamily: body, fontSize: 13, padding: 8, borderRadius: 2,
    border: `1px solid #C6CCC7`, backgroundColor: paper, color: ink, resize: "vertical",
  },
  expandFoot: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: 10, marginTop: 8, minHeight: 14,
  },
  doneStamp: { fontFamily: mono, fontSize: 10, color: muted },
  removeBtn: {
    marginLeft: "auto", border: "none", background: "none", padding: 0,
    fontFamily: mono, fontSize: 10, color: "#8A5A2B", textDecoration: "underline",
  },

  footer: { padding: "10px 18px 0", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
  footBtn: {
    border: `1px solid ${ink}`, backgroundColor: ink, color: surface,
    padding: "9px 14px", borderRadius: 2, fontFamily: mono, fontSize: 11,
    letterSpacing: "0.04em",
  },
  footBtnQuiet: { backgroundColor: "transparent", color: ink },
  saveNote: { width: "100%", fontFamily: mono, fontSize: 10, color: muted, marginTop: 8 },
};
