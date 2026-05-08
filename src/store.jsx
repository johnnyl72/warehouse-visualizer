// ─────────────────────────────────────────────────────────────────────────
// App store. One surface — the monitor (per-warehouse shelves shown on the
// map / analytics) — plus navigation, the maintenance queue, analytics
// overlay, automation, and zone-edit selection. Plain reducer + context.
// ─────────────────────────────────────────────────────────────────────────
import React from 'react';
import {
  WAREHOUSES, generateShelves, statusOf, rectsOverlap, CELL, WORLD,
  predictDays, LAYOUT_VERSION,
  ZONE_BY_ID, shelfCfg, cfgFor,
} from './model.js';

// ── Persistence (localStorage; no backend in this build) ─────────────────
// Persisted slices: assigned per-warehouse layouts + the currently-active
// warehouse + per-warehouse maintenance tasks. The active warehouse is
// persisted so navigation feels "stuck" to that site across reloads — the
// side nav reads it for Map / Labels / Analytics / Maintenance.
const PERSIST_KEY = 'wdt:v1';
function loadPersisted() {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || p.v !== LAYOUT_VERSION) return null;
    return p;
  } catch { return null; }
}
function persist(state) {
  try {
    localStorage.setItem(PERSIST_KEY, JSON.stringify({
      v: LAYOUT_VERSION,
      custom: state.custom,
      warehouseId: state.warehouseId,
      tasksByWh: state.tasksByWh,
    }));
  } catch { /* quota / unavailable — non-fatal */ }
}

const StoreCtx = React.createContext(null);
const AUTO_THRESHOLD = 12;
const COLS = Math.floor(WORLD.w / CELL);
const ROWS = Math.floor(WORLD.h / CELL);

let taskSeq = 1043;

const whSeed = (id) => (WAREHOUSES.find((w) => w.id === id) || WAREHOUSES[0]).seed;
const isValidWh = (id) => WAREHOUSES.some((w) => w.id === id);

// Maintenance tasks are scoped per warehouse — each warehouse has its own
// queue, since a label-reorder for SHELF-D-03 at Atlanta is unrelated to
// any shelf at Dallas. The default seeds give Atlanta a couple of live
// items so Maintenance isn't empty on first paint.
function seedTasksByWh() {
  return {
    'ATL-01': [
      { id: 'T-1042', title: 'Reorder label — D-03', shelf: 'SHELF-D-03', prio: 'high', status: 'open', auto: false, createdAt: Date.now() - 2 * 3600e3 },
      { id: 'T-1038', title: 'Inspect scan failures — B-02', shelf: 'SHELF-B-02', prio: 'med', status: 'open', auto: false, createdAt: Date.now() - 8 * 3600e3 },
    ],
  };
}

function init() {
  const p = loadPersisted();
  const custom = (p && p.custom) || {};
  // Restore the last warehouse the operator was viewing so they land back
  // in the same site on reload — only fall through to the first warehouse
  // if nothing persisted or the stored id has since been removed.
  const warehouseId = p && isValidWh(p.warehouseId) ? p.warehouseId : WAREHOUSES[0].id;
  const tasksByWh = (p && p.tasksByWh) || seedTasksByWh();
  return {
    view: 'overview', // overview | map | labels | analytics | maintenance
    warehouseId,
    overlay: 'health',
    custom, // { [whId]: shelves[] } — persisted per-warehouse layouts
    shelvesByWh: { [warehouseId]: custom[warehouseId] || generateShelves(whSeed(warehouseId)) },
    hoverId: null,
    selectedId: null,
    // Multi-selection set for zone-edit (Stage 4). `selectedId` stays in
    // lockstep with the last entry — single-select behavior elsewhere
    // (drawer, monitor list rows) is unchanged.
    selectedIds: [],
    drillId: null,
    focusedZoneId: null, // when set on the map: render the focused zone view
    autoRule: false,
    tasksByWh,
    toast: null,
  };
}

// Tasks helpers — every reducer branch that touches tasks goes through these
// so a task always lives on the warehouse it was raised against.
const getTasks = (state, whId = state.warehouseId) => state.tasksByWh[whId] || [];
const setTasks = (state, whId, tasks) => ({ ...state.tasksByWh, [whId]: tasks });

// In-place CRUD helpers — every warehouse-shelf mutation writes through
// `shelvesByWh` (the live view) AND `custom` (the persisted layout) so the
// change survives reload.
function persistWhShelves(state, whId, shelves, toast) {
  return {
    ...state,
    shelvesByWh: { ...state.shelvesByWh, [whId]: shelves },
    custom: { ...state.custom, [whId]: shelves },
    toast: toast || state.toast,
  };
}

function ensureShelves(state, whId) {
  if (state.shelvesByWh[whId]) return state.shelvesByWh;
  return { ...state.shelvesByWh, [whId]: state.custom[whId] || generateShelves(whSeed(whId)) };
}

function reducer(state, action) {
  switch (action.type) {
    case 'navigate':
      // Zone focus is a map-only state — leaving the map clears it so the
      // operator doesn't get stuck inside a zone after a side-nav jump.
      return {
        ...state,
        view: action.view,
        selectedId: null,
        selectedIds: [],
        hoverId: null,
        drillId: null,
        focusedZoneId: action.view === 'map' ? state.focusedZoneId : null,
      };

    case 'switchWarehouse':
      // Like openWarehouse but preserves the current view — switcher used
      // from the top bar should keep you on Labels/Analytics/etc., not
      // teleport to the map.
      if (!isValidWh(action.id) || action.id === state.warehouseId) return state;
      return {
        ...state,
        warehouseId: action.id,
        shelvesByWh: ensureShelves(state, action.id),
        selectedId: null,
        selectedIds: [],
        drillId: null,
        focusedZoneId: null,
      };

    case 'openWarehouse':
      return {
        ...state,
        warehouseId: action.id,
        shelvesByWh: ensureShelves(state, action.id),
        view: 'map',
        selectedId: null,
        selectedIds: [],
        drillId: null,
        focusedZoneId: null,
      };

    case 'setOverlay':
      return { ...state, overlay: action.overlay };

    case 'hoverShelf':
      return state.hoverId === action.id ? state : { ...state, hoverId: action.id };
    case 'selectShelf': {
      // additive=true (shift-click) toggles the id in the multi-selection set
      // without disturbing the rest. Plain selects collapse to a single id.
      const id = action.id;
      if (id == null) return { ...state, selectedId: null, selectedIds: [] };
      if (action.additive) {
        const has = state.selectedIds.includes(id);
        const ids = has ? state.selectedIds.filter((x) => x !== id) : [...state.selectedIds, id];
        return { ...state, selectedIds: ids, selectedId: ids.length ? ids[ids.length - 1] : null };
      }
      return { ...state, selectedId: id, selectedIds: [id] };
    }

    case 'selectShelves': {
      // Replace the full selection set in one go (used by marquee-select).
      const ids = Array.isArray(action.ids) ? action.ids.filter(Boolean) : [];
      return { ...state, selectedIds: ids, selectedId: ids.length ? ids[ids.length - 1] : null };
    }

    case 'focusZone':
      return { ...state, focusedZoneId: action.id, selectedId: null, selectedIds: [], drillId: null };
    case 'closeZone':
      return { ...state, focusedZoneId: null };

    // ── In-place edits on the active warehouse's shelves ─────────────────
    // The ZoneView "Edit zone" mode dispatches these. Every mutation writes
    // through both `shelvesByWh` (the live view) and `custom` (the persisted
    // assigned layout) so changes survive reload and round-trip through the
    // Layout Editor's Load action.
    case 'whUpdateShelf': {
      const whId = state.warehouseId;
      const list = state.shelvesByWh[whId] || [];
      if (!list.some((s) => s.id === action.id)) return state;
      const next = list.map((s) => {
        if (s.id !== action.id) return s;
        const baseCfg = shelfCfg(s);
        const patch = action.patch || {};
        const cfg = {
          ...baseCfg,
          ...patch,
          dims: patch.dims ? { ...baseCfg.dims, ...patch.dims } : baseCfg.dims,
          rules: patch.rules ? { ...baseCfg.rules, ...patch.rules } : baseCfg.rules,
        };
        // Keep the visual `type` aligned to the category so the canvas
        // re-tints correctly (cold/bulk/standard render differently).
        const nextType = cfg.category === 'cold' ? 'cold'
          : cfg.category === 'bulk' ? 'bulk'
          : (s.type === 'corner' ? 'corner' : s.type === 'cold' || s.type === 'bulk' ? 'rack' : s.type);
        return { ...s, cfg, category: cfg.category, type: nextType };
      });
      return persistWhShelves(state, whId, next, { kind: 'ok', msg: 'Shelf updated' });
    }

    case 'whDeleteShelf': {
      const whId = state.warehouseId;
      const list = state.shelvesByWh[whId] || [];
      const shelf = list.find((s) => s.id === action.id);
      if (!shelf) return state;
      const next = list.filter((s) => s.id !== action.id);
      // Drop any open tasks tied to this shelf so the maintenance queue
      // doesn't carry phantom work against a deleted shelf.
      const tasks = (state.tasksByWh[whId] || []).filter((t) => t.shelf !== action.id);
      const partial = persistWhShelves(state, whId, next, { kind: 'mute', msg: `Deleted ${shelf.code}` });
      return {
        ...partial,
        tasksByWh: setTasks(state, whId, tasks),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
        selectedIds: state.selectedIds.filter((id) => id !== action.id),
        drillId: state.drillId === action.id ? null : state.drillId,
      };
    }

    case 'whDeleteShelves': {
      const whId = state.warehouseId;
      const list = state.shelvesByWh[whId] || [];
      const ids = new Set((action.ids || []).filter(Boolean));
      if (ids.size === 0) return state;
      const removed = list.filter((s) => ids.has(s.id));
      if (removed.length === 0) return state;
      const next = list.filter((s) => !ids.has(s.id));
      const tasks = (state.tasksByWh[whId] || []).filter((t) => !ids.has(t.shelf));
      const partial = persistWhShelves(state, whId, next, {
        kind: 'mute',
        msg: removed.length === 1 ? `Deleted ${removed[0].code || 'shelf'}` : `Deleted ${removed.length} shelves`,
      });
      return {
        ...partial,
        tasksByWh: setTasks(state, whId, tasks),
        selectedId: state.selectedId && ids.has(state.selectedId) ? null : state.selectedId,
        selectedIds: state.selectedIds.filter((id) => !ids.has(id)),
        drillId: state.drillId && ids.has(state.drillId) ? null : state.drillId,
      };
    }

    case 'whAddShelfInZone': {
      const whId = state.warehouseId;
      const zone = ZONE_BY_ID[action.zoneId];
      if (!zone) return state;
      const list = state.shelvesByWh[whId] || [];
      const wh = WAREHOUSES.find((w) => w.id === whId);
      // Find the first free CELL-sized slot inside the zone (left-to-right,
      // top-to-bottom). Skips the top strip where the zone label sits.
      const labelPad = 28;
      const inset = 6;
      const startX = Math.ceil((zone.x + inset) / CELL) * CELL;
      const startY = Math.ceil((zone.y + labelPad) / CELL) * CELL;
      const endX = Math.floor((zone.x + zone.w - inset) / CELL) * CELL;
      const endY = Math.floor((zone.y + zone.h - inset) / CELL) * CELL;
      let placed = null;
      for (let y = startY; y < endY && !placed; y += CELL) {
        for (let x = startX; x < endX; x += CELL) {
          const rect = { x, y, w: CELL, h: CELL };
          if (!list.some((s) => rectsOverlap(rect, s))) { placed = rect; break; }
        }
      }
      if (!placed) return { ...state, toast: { kind: 'bad', msg: 'No free cell in this zone' } };
      const cfg = cfgFor('standard');
      // Find a free shelf code within the zone — uses the highest existing
      // numeric suffix in this zone plus one. Falls back to a U-prefixed id
      // if no peers exist yet.
      const peers = list.filter((s) => s.zone === zone.id);
      const maxN = peers.reduce((m, s) => {
        const n = parseInt((s.code || '').split('-').pop(), 10);
        return Number.isFinite(n) && n > m ? n : m;
      }, 0);
      const seq = maxN + 1;
      const code = `${zone.id}-${seq.toString().padStart(2, '0')}`;
      const shelf = {
        id: `SHELF-${whId}-${code}`,
        code,
        zone: zone.id,
        type: 'rack',
        x: placed.x, y: placed.y, w: CELL, h: CELL,
        health: 96,
        scanFail: 0.2,
        skuCount: 0,
        lastReplacedDays: 0,
        lastReplaced: 'today',
        predictedDays: predictDays(96, 0.2),
        history: [{ t: 'today', d: 'Provisioned in zone', who: 'you' }],
        label: { id: `LBL-${whId}-${code}`, reordered: false },
        cfg,
        category: cfg.category,
      };
      return {
        ...persistWhShelves(state, whId, [...list, shelf], { kind: 'ok', msg: `Added ${shelf.code}` }),
        selectedId: shelf.id,
        selectedIds: [shelf.id],
      };
    }

    // Assign a fresh label + default config to an empty container. Used
    // when the operator clicks "Label this slot" on an empty shelf — the
    // resulting shelf can then be reconfigured normally.
    case 'whLabelEmpty': {
      const whId = state.warehouseId;
      const list = state.shelvesByWh[whId] || [];
      const s = list.find((x) => x.id === action.id);
      if (!s || !s.empty) return state;
      const peers = list.filter((x) => x.zone === s.zone && !x.empty);
      const maxN = peers.reduce((m, x) => {
        const n = parseInt((x.code || '').split('-').pop(), 10);
        return Number.isFinite(n) && n > m ? n : m;
      }, 0);
      const seq = maxN + 1;
      const code = `${s.zone}-${seq.toString().padStart(2, '0')}`;
      const cfg = cfgFor('standard');
      const next = list.map((x) => (x.id === action.id ? {
        id: x.id, code, zone: x.zone, type: 'rack',
        x: x.x, y: x.y, w: x.w, h: x.h,
        health: 96, scanFail: 0.2, skuCount: 0,
        lastReplacedDays: 0, lastReplaced: 'today',
        predictedDays: predictDays(96, 0.2),
        history: [{ t: 'today', d: 'Slot relabeled', who: 'you' }],
        label: { id: `LBL-${whId}-${code}`, reordered: false },
        cfg,
        category: cfg.category,
        empty: false,
      } : x));
      return persistWhShelves(state, whId, next, { kind: 'ok', msg: `Labeled ${code}` });
    }

    // Transfer a shelf's identity (label, code, cfg, history, health) to
    // another shelf in the same warehouse. The source is left as an empty
    // container — same position and footprint, no label, no config. Any
    // open tasks against the source follow the label to the target.
    case 'whMoveLabel': {
      const whId = state.warehouseId;
      const list = state.shelvesByWh[whId] || [];
      const src = list.find((s) => s.id === action.fromId);
      const dst = list.find((s) => s.id === action.toId);
      if (!src || !dst || src.id === dst.id) return state;
      if (src.empty) return { ...state, toast: { kind: 'bad', msg: `${src.id} has no label to move` } };
      const next = list.map((s) => {
        if (s.id === src.id) {
          // Source becomes an empty container — keep id/zone/x/y/w/h so
          // React keys stay stable and the slot stays visible/relabelable.
          return {
            id: s.id, zone: s.zone, x: s.x, y: s.y, w: s.w, h: s.h,
            type: 'rack', empty: true,
          };
        }
        if (s.id === dst.id) {
          // Target inherits the identity bundle; geometry stays its own.
          return {
            id: s.id,
            zone: s.zone, x: s.x, y: s.y, w: s.w, h: s.h,
            code: src.code,
            type: src.type,
            health: src.health,
            scanFail: src.scanFail,
            skuCount: src.skuCount,
            lastReplacedDays: src.lastReplacedDays,
            lastReplaced: src.lastReplaced,
            predictedDays: src.predictedDays,
            history: [
              { t: 'today', d: `Label moved from ${src.code} → ${dst.code || s.code || s.id}`, who: 'you' },
              ...(src.history || []),
            ],
            label: src.label,
            cfg: src.cfg,
            category: src.category,
            empty: false,
          };
        }
        return s;
      });
      // Tasks raised against the source follow the label to its new home.
      const tasks = (state.tasksByWh[whId] || []).map((t) =>
        t.shelf === src.id ? { ...t, shelf: dst.id, zone: dst.zone } : t,
      );
      return {
        ...persistWhShelves(state, whId, next, { kind: 'ok', msg: `Label moved · ${src.code} → ${dst.code || dst.id}` }),
        tasksByWh: setTasks(state, whId, tasks),
        selectedId: dst.id,
        selectedIds: [dst.id],
      };
    }

    // Marquee placement of fresh 1-cell shelves inside the focused zone.
    // Mirrors the editor's `editorPlaceRun` but writes through to the
    // warehouse layout and clamps to the zone's interior bbox.
    case 'whPlaceRunInZone': {
      const whId = state.warehouseId;
      const zone = ZONE_BY_ID[action.zoneId];
      if (!zone) return state;
      const list = state.shelvesByWh[whId] || [];
      const { x0, y0, x1, y1 } = action.cells;
      const cx0 = Math.min(x0, x1), cx1 = Math.max(x0, x1);
      const cy0 = Math.min(y0, y1), cy1 = Math.max(y0, y1);
      // Zone interior in cell coords (skip the 24px label strip up top).
      const iMin = Math.ceil((zone.x + 4) / CELL);
      const iMax = Math.floor((zone.x + zone.w - 4) / CELL) - 1;
      const jMin = Math.ceil((zone.y + 24) / CELL);
      const jMax = Math.floor((zone.y + zone.h - 4) / CELL) - 1;
      const added = [];
      let skipped = 0;
      const peers = list.filter((s) => s.zone === zone.id && !s.empty);
      let seq = peers.reduce((m, s) => {
        const n = parseInt((s.code || '').split('-').pop(), 10);
        return Number.isFinite(n) && n > m ? n : m;
      }, 0) + 1;
      const RUN_CAP_ZONE = 200;
      outer:
      for (let j = cy0; j <= cy1; j++) {
        for (let i = cx0; i <= cx1; i++) {
          if (added.length >= RUN_CAP_ZONE) break outer;
          // Clamp out-of-zone cells.
          if (i < iMin || i > iMax || j < jMin || j > jMax) { skipped++; continue; }
          const rect = { x: i * CELL, y: j * CELL, w: CELL, h: CELL };
          if (list.some((s) => rectsOverlap(rect, s)) || added.some((s) => rectsOverlap(rect, s))) {
            skipped++; continue;
          }
          const cfg = cfgFor('standard');
          const code = `${zone.id}-${seq.toString().padStart(2, '0')}`;
          added.push({
            id: `SHELF-${whId}-${code}`,
            code,
            zone: zone.id,
            type: 'rack',
            x: rect.x, y: rect.y, w: CELL, h: CELL,
            health: 96, scanFail: 0.2, skuCount: 0,
            lastReplacedDays: 0, lastReplaced: 'today',
            predictedDays: predictDays(96, 0.2),
            history: [{ t: 'today', d: 'Provisioned in zone', who: 'you' }],
            label: { id: `LBL-${whId}-${code}`, reordered: false },
            cfg,
            category: cfg.category,
          });
          seq++;
        }
      }
      if (added.length === 0) {
        return { ...state, toast: { kind: 'bad', msg: skipped ? 'All cells occupied or out of zone' : 'Drag inside the zone to place shelves' } };
      }
      return persistWhShelves(
        state,
        whId,
        [...list, ...added],
        { kind: 'ok', msg: `Placed ${added.length} shelf${added.length > 1 ? 'es' : ''}${skipped ? ` · ${skipped} skipped` : ''}` },
      );
    }

    case 'whMoveShelf': {
      // Generated shelves come from a different grid (u=18 in model.js) than
      // the editor's CELL=22, and the same warehouse will mix sizes from
      // organic seed layouts with later-added CELL-sized shelves. Snapping
      // moves to CELL forces existing shelves into their neighbours on every
      // drag. Instead: snap to a fine 2px grid so positions stay tidy
      // without enforcing a coordinate system the shelves don't live on.
      const FINE = 2;
      const whId = state.warehouseId;
      const list = state.shelvesByWh[whId] || [];
      const cur = list.find((s) => s.id === action.id);
      if (!cur) return state;
      let x = Math.round(action.x / FINE) * FINE;
      let y = Math.round(action.y / FINE) * FINE;
      // Confine to the focused zone's bbox when one is set — otherwise
      // a stray drag could fling the shelf into a different zone.
      const zoneId = action.zoneId || cur.zone;
      const z = ZONE_BY_ID[zoneId];
      if (z) {
        const pad = 4;
        x = Math.max(z.x + pad, Math.min(z.x + z.w - cur.w - pad, x));
        y = Math.max(z.y + 24, Math.min(z.y + z.h - cur.h - pad, y));
      } else {
        x = Math.max(0, Math.min(WORLD.w - cur.w, x));
        y = Math.max(0, Math.min(WORLD.h - cur.h, y));
      }
      // Nudge resolution: if the snapped target collides, slide the shelf
      // along the dominant drag axis until we find a gap (or run out of
      // room). This makes "drop near a neighbour" feel like a soft bump
      // rather than a hard rejection — the operator's intent is preserved.
      const collides = (px, py) => list.some((s) => s.id !== action.id && rectsOverlap({ x: px, y: py, w: cur.w, h: cur.h }, s));
      let tx = x, ty = y;
      if (collides(tx, ty)) {
        const dx = x - cur.x, dy = y - cur.y;
        const stepX = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? -FINE : FINE) : 0;
        const stepY = stepX === 0 ? (dy >= 0 ? -FINE : FINE) : 0;
        // Slide back toward the original position until we clear, capped so
        // we never travel further than the requested drag distance.
        const maxSteps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / FINE);
        let found = false;
        for (let i = 1; i <= maxSteps; i++) {
          const px = tx + stepX * i;
          const py = ty + stepY * i;
          if (!collides(px, py)) { tx = px; ty = py; found = true; break; }
        }
        if (!found) {
          return { ...state, toast: { kind: 'bad', msg: 'No room — try a wider gap' } };
        }
      }
      if (cur.x === tx && cur.y === ty) return state;
      const next = list.map((s) => (s.id === action.id ? { ...s, x: tx, y: ty } : s));
      return persistWhShelves(state, whId, next, null);
    }

    case 'whMoveShelves': {
      // Group drag — translate every selected shelf by the same (dx, dy).
      // Same 2px fine snap + nudge-resolution as the single move, but the
      // collision test treats the moving group as a single body: each
      // moved rect must clear every shelf NOT in the group.
      const FINE = 2;
      const whId = state.warehouseId;
      const list = state.shelvesByWh[whId] || [];
      const idSet = new Set((action.ids || []).filter((id) => list.some((s) => s.id === id)));
      if (idSet.size === 0) return state;
      const movers = list.filter((s) => idSet.has(s.id));
      const others = list.filter((s) => !idSet.has(s.id));
      let dx = Math.round((action.dx || 0) / FINE) * FINE;
      let dy = Math.round((action.dy || 0) / FINE) * FINE;
      if (dx === 0 && dy === 0) return state;

      // Group bbox for clamping. When a zone is in focus we keep the whole
      // group inside that zone's interior; otherwise inside the world.
      const minX = Math.min(...movers.map((s) => s.x));
      const minY = Math.min(...movers.map((s) => s.y));
      const maxX = Math.max(...movers.map((s) => s.x + s.w));
      const maxY = Math.max(...movers.map((s) => s.y + s.h));
      const z = ZONE_BY_ID[action.zoneId];
      if (z) {
        const pad = 4;
        dx = Math.max(z.x + pad - minX, Math.min(z.x + z.w - pad - maxX, dx));
        dy = Math.max(z.y + 24 - minY, Math.min(z.y + z.h - pad - maxY, dy));
      } else {
        dx = Math.max(-minX, Math.min(WORLD.w - maxX, dx));
        dy = Math.max(-minY, Math.min(WORLD.h - maxY, dy));
      }

      const collides = (ddx, ddy) => movers.some((m) => others.some((o) =>
        rectsOverlap({ x: m.x + ddx, y: m.y + ddy, w: m.w, h: m.h }, o)
      ));
      let tx = dx, ty = dy;
      if (collides(tx, ty)) {
        const stepX = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? -FINE : FINE) : 0;
        const stepY = stepX === 0 ? (dy >= 0 ? -FINE : FINE) : 0;
        const maxSteps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / FINE);
        let found = false;
        for (let i = 1; i <= maxSteps; i++) {
          const px = tx + stepX * i;
          const py = ty + stepY * i;
          if (!collides(px, py)) { tx = px; ty = py; found = true; break; }
        }
        if (!found) {
          return { ...state, toast: { kind: 'bad', msg: 'No room for group — try a wider gap' } };
        }
      }
      if (tx === 0 && ty === 0) return state;
      const next = list.map((s) => (idSet.has(s.id) ? { ...s, x: s.x + tx, y: s.y + ty } : s));
      return persistWhShelves(state, whId, next, null);
    }

    case 'drill':
      return { ...state, drillId: action.id };
    case 'closeDrill':
      return { ...state, drillId: null };

    case 'clearSelections':
      if (
        !state.selectedId && state.selectedIds.length === 0
        && !state.drillId && !state.focusedZoneId
      ) return state;
      return {
        ...state,
        selectedId: null,
        selectedIds: [],
        drillId: null,
        focusedZoneId: null,
      };

    // ── Monitor data: labels / maintenance / automation ────────────────
    // All task mutations are scoped to the active warehouse via tasksByWh
    // so each site's maintenance queue is independent.
    case 'reorderLabel': {
      const whId = state.warehouseId;
      const list = state.shelvesByWh[whId] || [];
      const shelf = list.find((s) => s.id === action.id);
      if (!shelf || shelf.label.reordered) return state;
      const updated = list.map((s) =>
        s.id === action.id ? { ...s, label: { ...s.label, reordered: true } } : s,
      );
      const task = {
        id: `T-${taskSeq++}`,
        title: `Reorder label — ${shelf.code}`,
        shelf: shelf.id,
        whId,
        zone: shelf.zone,
        prio: statusOf(shelf.health) === 'bad' ? 'high' : 'med',
        status: 'open',
        auto: !!action.auto,
        createdAt: Date.now(),
      };
      return {
        ...state,
        shelvesByWh: { ...state.shelvesByWh, [whId]: updated },
        tasksByWh: setTasks(state, whId, [task, ...getTasks(state, whId)]),
        toast: { kind: 'ok', msg: `Label reorder queued · ${task.id}` },
      };
    }

    case 'completeTask': {
      // A task carries its own whId so completing one from a different
      // active warehouse (e.g. from a future cross-site queue) still
      // resolves the right shelf set.
      const whId = state.warehouseId;
      const current = getTasks(state, whId);
      const task = current.find((t) => t.id === action.id);
      if (!task) return state;
      const tasks = current.map((t) => (t.id === action.id ? { ...t, status: 'done' } : t));
      let shelvesByWh = state.shelvesByWh;
      if (task.shelf) {
        const list = state.shelvesByWh[whId] || [];
        if (list.some((s) => s.id === task.shelf)) {
          shelvesByWh = {
            ...state.shelvesByWh,
            [whId]: list.map((s) =>
              s.id === task.shelf
                ? {
                    ...s,
                    health: 96, scanFail: 0.2, lastReplacedDays: 0, lastReplaced: 'today',
                    predictedDays: predictDays(96, 0.2),
                    history: [{ t: 'today', d: 'Label replaced', who: 'M. Patel' }, ...(s.history || [])],
                    label: { ...s.label, reordered: false },
                  }
                : s,
            ),
          };
        }
      }
      return {
        ...state,
        tasksByWh: setTasks(state, whId, tasks),
        shelvesByWh,
        toast: { kind: 'ok', msg: `${action.id} completed` },
      };
    }

    case 'setAutoRule':
    case 'runAutomation': {
      const on = action.type === 'setAutoRule' ? action.on : state.autoRule;
      const whId = state.warehouseId;
      const list = state.shelvesByWh[whId] || [];
      const hits = list.filter((s) => s.scanFail > AUTO_THRESHOLD && !s.label.reordered);
      if (!on || hits.length === 0) {
        return {
          ...state,
          autoRule: on,
          toast: action.type === 'setAutoRule'
            ? { kind: on ? 'ok' : 'mute', msg: on ? 'Automation on — no shelves over threshold' : 'Automation off' }
            : state.toast,
        };
      }
      const hitIds = new Set(hits.map((s) => s.id));
      const updated = list.map((s) =>
        hitIds.has(s.id) ? { ...s, label: { ...s.label, reordered: true } } : s,
      );
      const newTasks = hits.map((s) => ({
        id: `T-${taskSeq++}`,
        title: `Auto-reorder — ${s.code} (scan-fail ${s.scanFail}%)`,
        shelf: s.id,
        whId,
        zone: s.zone,
        prio: statusOf(s.health) === 'bad' ? 'high' : 'med',
        status: 'open',
        auto: true,
        createdAt: Date.now(),
      }));
      return {
        ...state,
        autoRule: on,
        shelvesByWh: { ...state.shelvesByWh, [whId]: updated },
        tasksByWh: setTasks(state, whId, [...newTasks, ...getTasks(state, whId)]),
        toast: { kind: 'ok', msg: `Automation queued ${hits.length} reorder${hits.length > 1 ? 's' : ''}` },
      };
    }

    case 'toast':
      return { ...state, toast: action.toast };
    case 'dismissToast':
      return { ...state, toast: null };
    default:
      return state;
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = React.useReducer(reducer, undefined, init);
  React.useEffect(() => {
    if (!state.toast) return;
    const t = setTimeout(() => dispatch({ type: 'dismissToast' }), 2600);
    return () => clearTimeout(t);
  }, [state.toast]);

  // Global keyboard: Escape clears overlays (drawer / drill / zone focus /
  // multi-selection). Ignored while the operator is typing.
  React.useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'Escape') dispatch({ type: 'clearSelections' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Autosave persisted slices (debounced). Active warehouse and per-warehouse
  // layouts/tasks survive reload so the operator lands back where they left off.
  React.useEffect(() => {
    const t = setTimeout(() => persist(state), 400);
    return () => clearTimeout(t);
  }, [state.custom, state.warehouseId, state.tasksByWh]);

  const value = React.useMemo(() => ({ state, dispatch }), [state]);
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = React.useContext(StoreCtx);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

export const useShelves = () => {
  const { state } = useStore();
  return state.shelvesByWh[state.warehouseId] || [];
};
export const useWarehouse = () => {
  const { state } = useStore();
  return WAREHOUSES.find((w) => w.id === state.warehouseId) || WAREHOUSES[0];
};
// Tasks for the active warehouse only. Maintenance / drawer / overview
// badges all read through this so cross-site bleed is impossible.
export const useTasks = () => {
  const { state } = useStore();
  return state.tasksByWh[state.warehouseId] || [];
};
export const useFocusedZone = () => {
  const { state } = useStore();
  return state.focusedZoneId;
};














