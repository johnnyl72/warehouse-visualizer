// ─────────────────────────────────────────────────────────────────────────
// Domain model. Visual objects are database-backed entities, not drawings:
// every shelf carries operational metadata (label health, scan-fail rate,
// SKU count, replacement history, wear prediction) and a spatial footprint.
//
// Layout is intentionally NOT a uniform grid. Each zone has its own
// character and mixes shelf *types* (standard rack H/V, bulk pallet block,
// cold rack, corner) at varied footprints with organic gaps — packed
// deterministically so it renders identically every reload and never
// overlaps.
// ─────────────────────────────────────────────────────────────────────────
import { rng } from './wf-primitives.jsx';

export const WORLD = { w: 900, h: 540 };
export const CELL = 22; // base unit; Edit-mode placement snaps to this

export const ZONES = [
  { id: 'A', label: 'A · Receiving', x: 30, y: 30, w: 260, h: 210, tint: '#eef0e5' },
  { id: 'B', label: 'B · Bulk Storage', x: 310, y: 30, w: 360, h: 210, tint: '#eaeae1' },
  { id: 'C', label: 'C · Cold Storage', x: 690, y: 30, w: 180, h: 210, tint: '#e2eaeb' },
  { id: 'D', label: 'D · Pick & Pack', x: 30, y: 260, w: 360, h: 250, tint: '#f0ece2' },
  { id: 'E', label: 'E · Returns', x: 410, y: 260, w: 220, h: 250, tint: '#ecebe5' },
  { id: 'F', label: 'F · Shipping', x: 650, y: 260, w: 220, h: 250, tint: '#e9ebe3' },
];
export const ZONE_BY_ID = Object.fromEntries(ZONES.map((z) => [z.id, z]));

export const WAREHOUSES = [
  { id: 'ATL-01', name: 'Atlanta DC', region: 'Southeast', tone: 'ok', seed: 7 },
  { id: 'DAL-02', name: 'Dallas Fulfillment', region: 'South Central', tone: 'warn', seed: 5 },
  { id: 'SEA-03', name: 'Seattle Hub', region: 'Pacific NW', tone: 'ok', seed: 9 },
  { id: 'CHI-04', name: 'Chicago Cold', region: 'Midwest', tone: 'bad', seed: 3 },
  { id: 'NWK-05', name: 'Newark Cross-dock', region: 'Northeast', tone: 'ok', seed: 11 },
  { id: 'PHX-06', name: 'Phoenix DC', region: 'Southwest', tone: 'warn', seed: 2 },
];

export const statusOf = (health) => (health >= 80 ? 'ok' : health >= 60 ? 'warn' : 'bad');
export const STATUS_LABEL = { ok: 'Healthy', warn: 'Aging', bad: 'Replace' };
export const LABEL_STATE = { ok: 'healthy', warn: 'aging', bad: 'replace' };

export const SHELF_TYPE_LABEL = {
  rack: 'Standard rack',
  bulk: 'Bulk pallet',
  cold: 'Cold rack',
  corner: 'Corner unit',
};

// ── Editor unit configuration ────────────────────────────────────────────
// A placed tile is a spatial placeholder (1 grid unit); its *physical* bay
// (cubic volume) and operational rules are metadata you set per unit.
// Categories carry sensible default rules and a canvas color.
export const SHELF_CATEGORIES = [
  { id: 'standard', label: 'Standard', color: '#9ca38c', rules: {} },
  { id: 'bulk', label: 'Bulk / pallet', color: '#bda36b', rules: { maxWeightKg: 2400, levels: 3 } },
  { id: 'cold', label: 'Cold chain', color: '#8fb3c2', rules: { temperatureControlled: true, targetTempC: 2 } },
  { id: 'hazmat', label: 'Hazmat', color: '#d6b13f', rules: { hazmat: true, locked: true } },
  { id: 'fastpick', label: 'Fast-pick', color: '#8fb877', rules: { levels: 3, pickable: true } },
  { id: 'returns', label: 'Returns', color: '#b69bb0', rules: { pickable: false } },
  { id: 'staging', label: 'Staging', color: '#b8b4ac', rules: { levels: 1, pickable: false } },
];
export const CATEGORY_BY_ID = Object.fromEntries(SHELF_CATEGORIES.map((c) => [c.id, c]));

// One standard pallet footprint of usable cube, for a rough slot estimate.
const PALLET_M3 = 1.2 * 0.8 * 1.5;

const DEFAULT_UNIT_CFG = {
  category: 'standard',
  dims: { w: 120, d: 80, h: 200 }, // centimetres (bay W × D × H)
  levels: 4,
  rules: {
    maxWeightKg: 1000,
    temperatureControlled: false,
    targetTempC: null,
    hazmat: false,
    pickable: true,
    locked: false,
  },
};

export const volumeM3 = (dims) =>
  +(((dims?.w || 0) * (dims?.d || 0) * (dims?.h || 0)) / 1_000_000).toFixed(2);

// Rough storage-slot capacity: per-level cube ÷ a standard pallet cube.
export const slotCapacity = (dims, levels) => {
  const perLevel = ((dims?.w || 0) * (dims?.d || 0) * ((dims?.h || 0) / Math.max(1, levels))) / 1_000_000;
  return Math.max(1, Math.round((perLevel / PALLET_M3) * Math.max(1, levels)));
};


const MS_DAY = 86400000;
const NOW = Date.UTC(2026, 4, 18);
const fmtDate = (daysAgo) => {
  const d = new Date(NOW - daysAgo * MS_DAY);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
};

// Wear prediction: estimated days until the label drops below the replace
// threshold, from current health and scan-fail pressure. Lower & noisier =
// sooner. 0 means already overdue.
export function predictDays(health, scanFail) {
  const headroom = health - 58;
  const decay = 0.6 + scanFail * 0.18; // health points lost per day (approx)
  return Math.max(0, Math.round(headroom / decay));
}

function history(r, ageDays, status) {
  const out = [];
  out.push({ t: fmtDate(ageDays), d: 'Label replaced', who: ['M. Patel', 'A. Ortiz', 'L. Kim'][Math.floor(r() * 3)] });
  if (status !== 'ok') out.push({ t: fmtDate(Math.floor(ageDays * 0.55)), d: 'Inspected — wear noted', who: 'M. Patel' });
  if (status === 'bad') out.push({ t: fmtDate(Math.floor(ageDays * 0.2)), d: 'Scan-fail spike flagged', who: 'auto' });
  return out;
}

// Per-zone "character": which module footprints (in cells) appear, how
// densely, and the type. Footprints vary widely so the floor never reads as
// tidy rows/columns.
const ZONE_PLAN = {
  A: { fill: 0.42, mods: [['bulk', 4, 3], ['bulk', 3, 3], ['rack', 4, 1], ['rack', 3, 1]] },
  B: { fill: 0.62, mods: [['rack', 1, 4], ['rack', 2, 4], ['rack', 2, 5], ['rack', 4, 2], ['bulk', 3, 3]] },
  C: { fill: 0.7, mods: [['cold', 1, 5], ['cold', 1, 6], ['cold', 2, 6]] },
  D: { fill: 0.66, mods: [['rack', 1, 2], ['rack', 2, 1], ['rack', 1, 3], ['rack', 3, 1], ['rack', 2, 2]] },
  E: { fill: 0.4, mods: [['rack', 2, 1], ['rack', 1, 2], ['corner', 2, 2], ['bulk', 3, 2], ['rack', 1, 3]] },
  F: { fill: 0.5, mods: [['bulk', 4, 3], ['bulk', 3, 3], ['corner', 2, 2], ['rack', 4, 1]] },
};

export function generateShelves(seed) {
  const r = rng(seed);
  const shelves = [];

  ZONES.forEach((z) => {
    const plan = ZONE_PLAN[z.id];
    const pad = 14;
    const x0 = z.x + pad;
    const y0 = z.y + 26; // clear the zone label
    const innerW = z.w - pad * 2;
    const innerH = z.h - 26 - pad;
    const u = 18; // zone cell unit
    const cols = Math.floor(innerW / u);
    const rows = Math.floor(innerH / u);
    const occ = Array.from({ length: rows }, () => new Array(cols).fill(false));
    let seq = 0;

    const fits = (cx, cy, cw, ch) => {
      if (cx + cw > cols || cy + ch > rows) return false;
      for (let yy = cy; yy < cy + ch; yy++)
        for (let xx = cx; xx < cx + cw; xx++) if (occ[yy][xx]) return false;
      return true;
    };
    const mark = (cx, cy, cw, ch) => {
      for (let yy = cy; yy < cy + ch; yy++)
        for (let xx = cx; xx < cx + cw; xx++) occ[yy][xx] = true;
    };

    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        if (occ[cy][cx]) continue;
        // Organic gaps: sometimes leave the cell empty (aisles / open floor).
        if (r() > plan.fill) continue;
        // Try module footprints in a shuffled order until one fits.
        const order = plan.mods
          .map((m) => ({ m, k: r() }))
          .sort((a, b) => a.k - b.k)
          .map((o) => o.m);
        let placed = null;
        for (const [type, cw, ch] of order) {
          // ~25% of rack modules flip orientation for more variety.
          let w = cw, h = ch, orient = w >= h ? 'H' : 'V';
          if (type === 'rack' && r() < 0.25) { [w, h] = [h, w]; orient = w >= h ? 'H' : 'V'; }
          if (fits(cx, cy, w, h)) { placed = { type, w, h, orient }; break; }
        }
        if (!placed) continue;
        mark(cx, cy, placed.w, placed.h);
        seq += 1;

        const px = Math.round(x0 + cx * u + 2);
        const py = Math.round(y0 + cy * u + 2);
        const pw = placed.w * u - 4;
        const ph = placed.h * u - 4;

        // Health distribution biased per zone (hot zones: D, F).
        const t = r();
        const bias = z.id === 'D' ? 0.26 : z.id === 'F' ? 0.18 : z.id === 'E' ? 0.15 : 0.08;
        const wbias = z.id === 'D' ? 0.3 : 0.22;
        let health;
        if (t < bias) health = 38 + Math.floor(r() * 21);
        else if (t < bias + wbias) health = 60 + Math.floor(r() * 19);
        else health = 80 + Math.floor(r() * 19);
        const st = statusOf(health);
        const ageDays = st === 'bad' ? 38 + Math.floor(r() * 14) : st === 'warn' ? 24 + Math.floor(r() * 14) : 4 + Math.floor(r() * 18);
        const scanFail = +(st === 'bad' ? 12 + r() * 16 : st === 'warn' ? 4 + r() * 6 : r() * 2).toFixed(1);
        const code = `${z.id}-${seq.toString().padStart(2, '0')}`;

        shelves.push({
          id: `SHELF-${code}`,
          code,
          zone: z.id,
          type: placed.type,
          orient: placed.orient,
          x: px, y: py, w: pw, h: ph,
          health,
          scanFail,
          skuCount: placed.type === 'bulk' ? 80 + Math.floor(r() * 120) : 8 + Math.floor(r() * 46),
          lastReplacedDays: ageDays,
          lastReplaced: fmtDate(ageDays),
          predictedDays: predictDays(health, scanFail),
          history: history(r, ageDays, st),
          label: { id: `LBL-${seed}${code}`, reordered: false },
        });
      }
    }
  });

  return shelves;
}

export const rectsOverlap = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const zoneAt = (x, y) =>
  ZONES.find((z) => x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h) || null;

// A shelf with `empty: true` is a placed slot that currently has no label
// or config — operators can re-label it later by moving an identity onto
// it. Empty containers are skipped in operational rollups.
export const isEmptyShelf = (s) => !!(s && s.empty);

// Operational rollup of a warehouse's shelves — used by the map zone-rail,
// the home cards, and the focused zone view so every surface reads the
// same live numbers. Empty containers are reported separately as `empty`
// so views can call them out without counting them as healthy.
export function summarizeShelves(list) {
  const total = list.length;
  const labeled = list.filter((s) => !isEmptyShelf(s));
  const n = labeled.length;
  const empty = total - n;
  if (!n) return { n: 0, empty, total, avg: 0, bad: 0, warn: 0, ok: 0, fail: 0, atRisk: 0, reordered: 0 };
  let h = 0, f = 0, bad = 0, warn = 0, ok = 0, atRisk = 0, reordered = 0;
  for (const s of labeled) {
    h += s.health; f += s.scanFail;
    const st = statusOf(s.health);
    if (st === 'bad') bad++; else if (st === 'warn') warn++; else ok++;
    if (s.predictedDays <= 10) atRisk++;
    if (s.label && s.label.reordered) reordered++;
  }
  return {
    n, empty, total,
    avg: Math.round(h / n),
    bad, warn, ok,
    fail: +(f / n).toFixed(1),
    atRisk,
    reordered,
  };
}

// Zone-scoped rollup — drives both the zone-rail mini-cards on the map and
// the focused zone view header.
export function summarizeZone(zoneId, allShelves) {
  const list = allShelves.filter((s) => s.zone === zoneId);
  return { zone: ZONE_BY_ID[zoneId], shelves: list, ...summarizeShelves(list) };
}

// ── Cfg helpers ──────────────────────────────────────────────────────────
// LAYOUT_VERSION keys the localStorage payload — bump on schema-breaking changes.
export const LAYOUT_VERSION = 1;
const TYPE_TO_CAT = { cold: 'cold', bulk: 'bulk', corner: 'standard', rack: 'standard', unit: 'standard' };

export const cfgFor = (category) => {
  const cat = CATEGORY_BY_ID[category] || CATEGORY_BY_ID.standard;
  const r = { ...DEFAULT_UNIT_CFG.rules, ...(cat.rules || {}) };
  const levels = 'levels' in r ? r.levels : DEFAULT_UNIT_CFG.levels;
  delete r.levels;
  return { category: cat.id, dims: { ...DEFAULT_UNIT_CFG.dims }, levels, rules: r };
};

// Returns the shelf's cfg if present, otherwise a sensible default derived
// from the shelf's shape/type so generated and authored shelves can be
// treated uniformly by the in-place editor.
export const shelfCfg = (shelf) =>
  shelf.cfg || cfgFor(shelf.category || TYPE_TO_CAT[shelf.type] || 'standard');














