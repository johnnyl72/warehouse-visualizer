// Pan/zoom canvas for the monitor (warehouse map) surface.
//   • Read-only view: zones + shelves; hover → tooltip, click → detail drawer.
//   • Zone focus (focusZoneId): auto-fits to one zone's bbox; non-focus zones
//     dim and become non-interactive.
//   • In-place edit mode (editInPlace): zone-edit tools — select / draw /
//     erase / pan, plus shift-marquee for multi-select and group drag.
//   • Wheel = zoom at cursor. Grid + sheet live inside the world transform
//     so they scale/pan with content and align with shelf snapping.
import React from 'react';
import { WORLD, ZONES, CELL, statusOf, rectsOverlap, SHELF_TYPE_LABEL } from '../model.js';
import { useStore, useShelves } from '../store.jsx';

const MIN_S = 0.2, MAX_S = 4, PAD = 56, EDGE = 90; // EDGE: keep this much sheet on-screen
const GRID_LINE = 'rgba(0,0,0,0.05)';
const CTL_BTN_STYLE = {
  width: 28, height: 28, border: '1px solid var(--wf-line-2)', background: '#fff',
  borderRadius: 6, cursor: 'pointer', display: 'grid', placeItems: 'center',
  font: 'inherit', fontSize: 15, color: 'var(--wf-ink)', lineHeight: 1,
};

const tone = (s, overlay) => {
  if (overlay === 'neutral') return 'idle';
  if (overlay === 'failures') return s.scanFail > 10 ? 'bad' : s.scanFail > 4 ? 'warn' : 'idle';
  return statusOf(s.health);
};

function BulkGrid({ s }) {
  const cols = Math.max(2, Math.round(s.w / 20));
  const rows = Math.max(2, Math.round(s.h / 20));
  return (
    <div style={{ position: 'absolute', inset: 3, display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gridTemplateRows: `repeat(${rows},1fr)`, gap: 2, pointerEvents: 'none', opacity: 0.5 }}>
      {Array.from({ length: cols * rows }).map((_, i) => (
        <div key={i} style={{ background: 'rgba(0,0,0,0.10)', borderRadius: 1 }} />
      ))}
    </div>
  );
}

function Tooltip({ shelf, sx, sy }) {
  const st = statusOf(shelf.health);
  return (
    <div className="wf-card" style={{ position: 'absolute', left: sx, top: sy, width: 232, padding: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.14)', pointerEvents: 'none', zIndex: 20 }}>
      <div className="wf-row" style={{ justifyContent: 'space-between' }}>
        <span className="wf-mono" style={{ fontSize: 12, fontWeight: 600 }}>{shelf.id}</span>
        <span className={`wf-pill wf-pill--${st}`}>{st === 'ok' ? 'Healthy' : st === 'warn' ? 'Aging' : 'Replace'}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--wf-mute)', marginTop: 2 }}>
        {SHELF_TYPE_LABEL[shelf.type] || 'Shelf'} · Zone {shelf.zone} · {shelf.skuCount} SKUs
      </div>
      <hr className="wf-hr" style={{ margin: '8px 0' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11 }}>
        <div><div style={{ color: 'var(--wf-mute)' }}>Health</div><div style={{ fontWeight: 600 }}>{shelf.health} / 100</div></div>
        <div><div style={{ color: 'var(--wf-mute)' }}>Scan fail</div><div style={{ fontWeight: 600 }}>{shelf.scanFail}%</div></div>
        <div><div style={{ color: 'var(--wf-mute)' }}>Last replaced</div><div style={{ fontWeight: 600 }}>{shelf.lastReplaced}</div></div>
        <div><div style={{ color: 'var(--wf-mute)' }}>Predicted life</div><div style={{ fontWeight: 600, color: shelf.predictedDays <= 10 ? 'var(--wf-bad)' : 'inherit' }}>{shelf.predictedDays}d</div></div>
      </div>
      <div style={{ fontSize: 10, color: 'var(--wf-mute)', marginTop: 8 }}>Click to open detail →</div>
    </div>
  );
}

export default function WarehouseCanvas({
  readOnly = false,
  overlayOverride,
  // When set, the canvas auto-fits to this zone's bbox and dims the rest of
  // the floor so the operator sees a focused view of one zone — used by
  // ZoneView. Zones outside the focus are non-interactive.
  focusZoneId = null,
  // Monitor-only: clicking a zone background dispatches `focusZone` so the
  // map drills into that zone. Off when readOnly (e.g. Analytics).
  zonesClickable = false,
  // Zone-edit mode: shelves become interactive workspace targets. The
  // active tool decides what pointer events do, mirroring the editor:
  //   • 'select' — click selects, drag emits `whMoveShelf` (clamped to zone)
  //   • 'draw'   — drag-marquee on background stamps new shelves via
  //                `whPlaceRunInZone`; single click = one cell
  //   • 'erase'  — click a shelf dispatches `whDeleteShelf`
  //   • 'pan'    — background drag pans; shelves non-interactive
  // Hover tooltips stay suppressed so the surface reads as a workspace,
  // not a live monitor.
  editInPlace = false,
  editTool = 'select',
}) {
  const { state, dispatch } = useStore();
  const shelves = useShelves();
  const overlay = overlayOverride || state.overlay;
  const [hoverZone, setHoverZone] = React.useState(null);
  const focusZone = focusZoneId ? ZONES.find((z) => z.id === focusZoneId) : null;

  const wrapRef = React.useRef(null);
  const [tf, setTf] = React.useState({ scale: 1, tx: PAD, ty: PAD });
  const tfRef = React.useRef(tf);
  tfRef.current = tf;
  const drag = React.useRef(null);
  // Group-drag overlay for zone-edit multi-select: every id in `ids` is
  // rendered at its original position + (dx, dy). Collapses to a
  // one-element group for single-shelf drags.
  const [groupGhost, setGroupGhost] = React.useState(null);
  const [run, setRun] = React.useState(null);
  // World-space marquee for zone-edit Select tool — drag on empty floor
  // selects every overlapping shelf in this zone on release.
  const [selectMarquee, setSelectMarquee] = React.useState(null);

  const size = () => {
    const el = wrapRef.current;
    const r = el ? el.getBoundingClientRect() : { width: 800, height: 600 };
    return { cw: r.width, ch: r.height };
  };

  // Keep the sheet from being panned/zoomed entirely off-screen.
  // In zone-sheet mode the "sheet" is the focused zone's bbox, so the
  // clamp follows that smaller rectangle instead of the whole world.
  const clamp = React.useCallback((t) => {
    const { cw, ch } = size();
    const sheet = focusZone
      ? { x: focusZone.x, y: focusZone.y, w: focusZone.w, h: focusZone.h }
      : { x: 0, y: 0, w: WORLD.w, h: WORLD.h };
    const W = sheet.w * t.scale, H = sheet.h * t.scale;
    // Keep ≥ EDGE px of the sheet within the viewport on every side.
    // `pos` is the screen-space top/left of the sheet (= tf.t + sheet.x*scale).
    const axis = (sheetScreenPos, span, view) => {
      const a = EDGE - span;       // sheet far edge stays past EDGE
      const b = view - EDGE;       // sheet near edge stays before view-EDGE
      const lo = Math.min(a, b), hi = Math.max(a, b);
      return Math.max(lo, Math.min(hi, sheetScreenPos));
    };
    const sx = axis(t.tx + sheet.x * t.scale, W, cw);
    const sy = axis(t.ty + sheet.y * t.scale, H, ch);
    return { scale: t.scale, tx: sx - sheet.x * t.scale, ty: sy - sheet.y * t.scale };
  }, [focusZone]);

  // Default fit: whole sheet centred. Focused fit: zoom on one zone's
  // bbox so it dominates the viewport (ZoneView uses this).
  const fit = React.useCallback(() => {
    const { cw, ch } = size();
    if (focusZone) {
      const pad = 40;
      const scale = Math.max(MIN_S, Math.min(MAX_S, Math.min(
        (cw - pad * 2) / focusZone.w,
        (ch - pad * 2) / focusZone.h,
      )));
      setTf({
        scale,
        tx: (cw - focusZone.w * scale) / 2 - focusZone.x * scale,
        ty: (ch - focusZone.h * scale) / 2 - focusZone.y * scale,
      });
      return;
    }
    const scale = Math.max(MIN_S, Math.min(MAX_S, Math.min((cw - PAD * 2) / WORLD.w, (ch - PAD * 2) / WORLD.h)));
    setTf({ scale, tx: (cw - WORLD.w * scale) / 2, ty: (ch - WORLD.h * scale) / 2 });
  }, [focusZone]);

  React.useLayoutEffect(() => {
    fit();
    const ro = new ResizeObserver(fit);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [fit]);

  const toWorld = (cx, cy) => {
    const r = wrapRef.current.getBoundingClientRect();
    const { scale, tx, ty } = tfRef.current;
    return { x: (cx - r.left - tx) / scale, y: (cy - r.top - ty) / scale };
  };
  const cellAt = (cx, cy) => {
    const w = toWorld(cx, cy);
    return { i: Math.floor(w.x / CELL), j: Math.floor(w.y / CELL) };
  };

  const zoomAround = (px, py, factor) => setTf((t) => {
    const next = Math.min(MAX_S, Math.max(MIN_S, t.scale * factor));
    const k = next / t.scale;
    return clamp({ scale: next, tx: px - (px - t.tx) * k, ty: py - (py - t.ty) * k });
  });

  const onWheel = (e) => {
    e.preventDefault();
    const r = wrapRef.current.getBoundingClientRect();
    zoomAround(e.clientX - r.left, e.clientY - r.top, Math.exp(-Math.sign(e.deltaY) * 0.12));
  };
  const zoomBtn = (factor) => { const { cw, ch } = size(); zoomAround(cw / 2, ch / 2, factor); };

  const startPan = (e) => {
    drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, t0: { ...tfRef.current } };
    wrapRef.current.setPointerCapture(e.pointerId);
  };

  const onPointerDownBg = (e) => {
    if (e.button !== 0) return;
    if (editInPlace && editTool === 'draw') {
      // Marquee on the warehouse surface, scoped to the focused zone in
      // the reducer. Out-of-zone cells get skipped silently.
      const c = cellAt(e.clientX, e.clientY);
      drag.current = { kind: 'drawWh' };
      setRun({ x0: c.i, y0: c.j, x1: c.i, y1: c.j });
      wrapRef.current.setPointerCapture(e.pointerId);
      return;
    }
    if (editInPlace && editTool === 'select') {
      // Background drag in Select tool = marquee-select. Pan is on the H
      // tool (or hold Space). Shift held = union with existing selection.
      const w0 = toWorld(e.clientX, e.clientY);
      drag.current = { kind: 'selectMarquee', x0: w0.x, y0: w0.y, additive: e.shiftKey, moved: false };
      setSelectMarquee({ x0: w0.x, y0: w0.y, x1: w0.x, y1: w0.y, additive: e.shiftKey });
      wrapRef.current.setPointerCapture(e.pointerId);
      return;
    }
    startPan(e);
  };

  const onShelfPointerDown = (e, s) => {
    if (!editInPlace) return;
    // Monitor surface, in-place edit mode: the active tool decides what
    // happens. Erase deletes; select arms a potential move drag.
    if (editTool === 'erase') {
      e.stopPropagation();
      dispatch({ type: 'whDeleteShelf', id: s.id });
      return;
    }
    if (editTool === 'select') {
      e.stopPropagation();
      const ids = state.selectedIds || [];
      const alreadySelected = ids.includes(s.id);

      // Shift+click is selection-only: toggle this shelf in the set and
      // do not initiate a drag. Single-click on a shelf already in the
      // multi-selection keeps the set intact and starts a group drag.
      if (e.shiftKey) {
        dispatch({ type: 'selectShelf', id: s.id, additive: true });
        return;
      }
      if (!alreadySelected) {
        dispatch({ type: 'selectShelf', id: s.id });
      }
      // Empty containers are positional only — they're targets for
      // relabel / receive-moved-label, not draggable.
      if (s.empty) return;

      // Decide which shelves move together. If the clicked shelf was
      // already part of a multi-selection, drag every (non-empty,
      // in-zone) shelf in that selection as a group. Otherwise drag
      // just this shelf.
      const inZone = (sh) => !focusZone || sh.zone === focusZone.id;
      const groupIds = alreadySelected && ids.length > 1
        ? ids.filter((id) => {
            const sh = shelves.find((x) => x.id === id);
            return sh && !sh.empty && inZone(sh);
          })
        : [s.id];
      if (groupIds.length === 0) return;
      const w0 = toWorld(e.clientX, e.clientY);
      drag.current = {
        kind: 'whGroupMove',
        ids: groupIds,
        anchorId: s.id,
        ox: w0.x - s.x, oy: w0.y - s.y,
        baseX: s.x, baseY: s.y,
      };
      setGroupGhost({ ids: groupIds, dx: 0, dy: 0 });
      wrapRef.current.setPointerCapture(e.pointerId);
    }
    // 'draw' and 'pan' let the event bubble up to the background.
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === 'pan') {
      setTf(clamp({ ...d.t0, tx: d.t0.tx + (e.clientX - d.sx), ty: d.t0.ty + (e.clientY - d.sy) }));
    } else if (d.kind === 'drawWh') {
      const c = cellAt(e.clientX, e.clientY);
      setRun((r) => (r ? { ...r, x1: c.i, y1: c.j } : r));
    } else if (d.kind === 'whGroupMove') {
      const w = toWorld(e.clientX, e.clientY);
      const dx = (w.x - d.ox) - d.baseX;
      const dy = (w.y - d.oy) - d.baseY;
      setGroupGhost({ ids: d.ids, dx, dy });
    } else if (d.kind === 'selectMarquee') {
      const w = toWorld(e.clientX, e.clientY);
      d.moved = true;
      setSelectMarquee((m) => (m ? { ...m, x1: w.x, y1: w.y } : m));
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) {
      setRun(null);
      setGroupGhost(null);
      setSelectMarquee(null);
      return;
    }
    if (d.kind === 'drawWh' && run) dispatch({ type: 'whPlaceRunInZone', cells: run, zoneId: focusZoneId });
    else if (d.kind === 'whGroupMove' && groupGhost && (groupGhost.dx || groupGhost.dy)) {
      dispatch({
        type: 'whMoveShelves',
        ids: d.ids,
        dx: groupGhost.dx,
        dy: groupGhost.dy,
        zoneId: focusZoneId,
      });
    } else if (d.kind === 'selectMarquee' && selectMarquee) {
      // Resolve to a set of shelves whose bounds overlap the marquee.
      // A click-without-drag clears the selection (unless shift held).
      if (!d.moved) {
        if (!d.additive) dispatch({ type: 'selectShelf', id: null });
      } else {
        const x0 = Math.min(selectMarquee.x0, selectMarquee.x1);
        const y0 = Math.min(selectMarquee.y0, selectMarquee.y1);
        const x1 = Math.max(selectMarquee.x0, selectMarquee.x1);
        const y1 = Math.max(selectMarquee.y0, selectMarquee.y1);
        const inZone = (s) => !focusZone || s.zone === focusZone.id;
        const hit = shelves
          .filter((s) => inZone(s) && !s.empty && rectsOverlap(
            { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, s,
          ))
          .map((s) => s.id);
        const baseIds = d.additive ? (state.selectedIds || []) : [];
        const merged = [...baseIds];
        for (const id of hit) if (!merged.includes(id)) merged.push(id);
        dispatch({ type: 'selectShelves', ids: merged });
      }
    }
    setRun(null);
    setGroupGhost(null);
    setSelectMarquee(null);
  };

  // Tooltip is metric-driven, so it only makes sense for labeled shelves.
  const hoveredShelf = !editInPlace && shelves.find((s) => s.id === state.hoverId);
  const hover = hoveredShelf && !hoveredShelf.empty ? hoveredShelf : null;

  let marquee = null;
  if (editInPlace && editTool === 'draw' && run) {
    const i0 = Math.min(run.x0, run.x1), i1 = Math.max(run.x0, run.x1);
    const j0 = Math.min(run.y0, run.y1), j1 = Math.max(run.y0, run.y1);
    const x = i0 * CELL, y = j0 * CELL, w = (i1 - i0 + 1) * CELL, h = (j1 - j0 + 1) * CELL;
    // For zone-edit, a marquee that extends past the zone is "partial":
    // the reducer drops out-of-zone cells. We flag fully-out-of-zone
    // (nothing landable) as bad; partial overlap stays neutral.
    let bad = shelves.some((s) => rectsOverlap({ x, y, w, h }, s));
    if (focusZone) {
      const insideZone = !(x + w <= focusZone.x || x >= focusZone.x + focusZone.w
        || y + h <= focusZone.y || y >= focusZone.y + focusZone.h);
      if (!insideZone) bad = true;
    }
    marquee = { x, y, w, h, cols: i1 - i0 + 1, rows: j1 - j0 + 1, bad };
  }

  const cursorStyle = editInPlace
    ? editTool === 'draw' ? 'crosshair' : editTool === 'erase' ? 'not-allowed' : editTool === 'pan' ? 'grab' : 'default'
    : drag.current?.kind === 'pan' ? 'grabbing' : 'grab';

  return (
    <div
      ref={wrapRef}
      role="application"
      aria-label="Warehouse map canvas"
      onWheel={onWheel}
      onPointerDown={onPointerDownBg}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', cursor: cursorStyle, background: focusZone ? '#eceae4' : 'var(--wf-bg)', touchAction: 'none' }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, width: WORLD.w, height: WORLD.h, transform: `translate(${tf.tx}px, ${tf.ty}px) scale(${tf.scale})`, transformOrigin: '0 0' }}>
        {/* canvas sheet — full warehouse sheet, or just the focused zone's
            rectangle when ZoneView opens a zone as its own canvas. Grid is
            aligned to CELL in world space so shelves still snap correctly. */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: focusZone ? focusZone.x : 0,
            top: focusZone ? focusZone.y : 0,
            width: focusZone ? focusZone.w : WORLD.w,
            height: focusZone ? focusZone.h : WORLD.h,
            background: focusZone ? focusZone.tint : 'var(--wf-bg)',
            border: '1px solid var(--wf-line-2)',
            boxShadow: focusZone ? '0 2px 14px rgba(0,0,0,0.07)' : 'none',
            backgroundImage: `repeating-linear-gradient(0deg, transparent 0 ${CELL - 1}px, ${GRID_LINE} ${CELL - 1}px ${CELL}px), repeating-linear-gradient(90deg, transparent 0 ${CELL - 1}px, ${GRID_LINE} ${CELL - 1}px ${CELL}px)`,
            // Keep the grid pattern phase-aligned to world coordinates so it
            // lines up with shelf snapping even when the sheet starts at a
            // non-multiple-of-CELL offset (most zones do).
            backgroundPosition: focusZone
              ? `${-(focusZone.x % CELL)}px ${-(focusZone.y % CELL)}px`
              : '0 0',
          }}
        />

        {!focusZone && ZONES.map((z) => {
          const isFocus = focusZone && focusZone.id === z.id;
          const dim = focusZone && !isFocus;
          const hot = hoverZone === z.id && zonesClickable && !focusZone;
          const canEnter = zonesClickable && !focusZone;
          // The zone tile itself stays "pannable" — its label is the
          // clickable affordance so background-drag can still pan the map
          // without pointer-capture stealing the zone click.
          return (
            <div
              key={z.id}
              onPointerEnter={() => zonesClickable && setHoverZone(z.id)}
              onPointerLeave={() => zonesClickable && setHoverZone((h) => (h === z.id ? null : h))}
              style={{
                position: 'absolute', left: z.x, top: z.y, width: z.w, height: z.h,
                background: z.tint, borderRadius: 4,
                border: hot || isFocus ? '1px solid var(--wf-ink)' : '1px dashed rgba(0,0,0,0.08)',
                opacity: dim ? 0.35 : 1,
                transition: 'opacity 0.15s, border-color 0.1s',
                pointerEvents: dim ? 'none' : 'auto',
              }}
            >
              {canEnter ? (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: 'focusZone', id: z.id }); }}
                  aria-label={`Open ${z.label}`}
                  className="wf-mono wf-row"
                  style={{
                    position: 'absolute', left: 8, top: 8, gap: 6,
                    padding: '4px 8px', borderRadius: 6,
                    background: hot ? 'var(--wf-ink)' : 'rgba(255,255,255,0.7)',
                    color: hot ? '#fbfaf8' : 'var(--wf-ink-2)',
                    border: '1px solid ' + (hot ? 'var(--wf-ink)' : 'var(--wf-line)'),
                    font: 'inherit', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
                    textTransform: 'uppercase', cursor: 'pointer', boxShadow: hot ? '0 4px 12px rgba(0,0,0,0.12)' : 'none',
                    transition: 'background 0.12s, color 0.12s, box-shadow 0.12s',
                  }}
                >
                  {z.label}
                  <span aria-hidden="true" style={{ opacity: 0.8 }}>→</span>
                </button>
              ) : (
                <div className="wf-mono" style={{ position: 'absolute', left: 10, top: 8, fontSize: 10, fontWeight: 600, color: 'var(--wf-mute)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{z.label}</div>
              )}
            </div>
          );
        })}

        {(focusZone ? shelves.filter((s) => s.zone === focusZone.id) : shelves).map((s) => {
          const inGroupGhost = groupGhost && groupGhost.ids.includes(s.id);
          const selIds = state.selectedIds || [];
          const sel = selIds.includes(s.id) || state.selectedId === s.id;
          const offZone = focusZone && s.zone !== focusZone.id;
          const ghosted = editInPlace && inGroupGhost;
          // In view mode the same hover that drives the metric tooltip
          // doubles as a "this is clickable" affordance — we lift the
          // shelf with a subtle outline so the operator sees it as a
          // hit target instead of background art.
          const hovered = !editInPlace && !readOnly && !offZone && state.hoverId === s.id;
          const x = ghosted ? s.x + groupGhost.dx : s.x;
          const y = ghosted ? s.y + groupGhost.dy : s.y;
          const isEmpty = !!s.empty;
          // Cursor follows the active edit tool when on the shelf surface.
          const shelfCursor = readOnly || offZone ? 'inherit'
            : editInPlace
              ? editTool === 'erase' ? 'not-allowed'
                : editTool === 'select' ? (isEmpty ? 'pointer' : 'move')
                : editTool === 'draw' ? 'crosshair'
                : 'grab'
              : 'pointer';
          return (
            <div
              key={s.id}
              className={isEmpty ? '' : `wf-shelf wf-shelf--${tone(s, overlay)}${sel ? ' wf-shelf--sel' : ''}`}
              title={isEmpty ? `${s.id} · empty container · click to label` : `${s.id} · ${SHELF_TYPE_LABEL[s.type] || ''}`}
              // Hover state powers both the clickable-affordance lift
              // and the metric tooltip. Empties get the lift but no
              // tooltip (guarded below in the Tooltip render).
              onMouseEnter={() => !readOnly && !offZone && !editInPlace && dispatch({ type: 'hoverShelf', id: s.id })}
              onMouseLeave={() => !readOnly && !editInPlace && dispatch({ type: 'hoverShelf', id: null })}
              // Selection fires on pointer-down + stopPropagation so the
              // background's pan capture never steals the click. Pan from
              // empty floor / aisles between shelves still works; for fast
              // navigation use the wheel / zoom controls.
              onPointerDown={
                editInPlace && !offZone
                  ? (e) => onShelfPointerDown(e, s)
                  : !readOnly && !offZone
                    ? (e) => {
                        if (e.button !== 0) return;
                        e.stopPropagation();
                        dispatch({ type: 'selectShelf', id: s.id });
                      }
                    : undefined
              }
              onClick={(e) => {
                // Keep stopPropagation for any residual synthesized clicks
                // (e.g. assistive tech "click" events) but the work is
                // already done on pointer-down above.
                if (!editInPlace) e.stopPropagation();
              }}
              style={{
                position: 'absolute', left: x, top: y, width: s.w, height: s.h,
                cursor: shelfCursor,
                outlineOffset: 1,
                // Empty container visual: dashed gray slot, no health colour.
                background: isEmpty ? 'repeating-linear-gradient(135deg, rgba(0,0,0,0.04) 0 6px, transparent 6px 12px), #ecebe5' : undefined,
                boxShadow: hovered
                  ? '0 0 0 2px var(--wf-ink) inset, 0 4px 12px rgba(0,0,0,0.18)'
                  : !isEmpty && s.label && s.label.reordered
                    ? '0 0 0 2px var(--wf-warn) inset'
                    : 'none',
                border: editInPlace && sel ? '2px solid var(--wf-ink)'
                  : sel && !editInPlace ? '2px solid var(--wf-ink)'
                  : isEmpty ? '1.5px dashed rgba(0,0,0,0.35)'
                  : s.type === 'cold' ? '1px solid rgba(60,110,120,0.35)'
                  : '1px solid rgba(0,0,0,0.10)',
                borderRadius: 2,
                clipPath: s.type === 'corner' && !isEmpty ? 'polygon(0 0,60% 0,60% 40%,100% 40%,100% 100%,0 100%)' : 'none',
                opacity: offZone ? 0.18 : ghosted ? 0.65 : 1,
                pointerEvents: offZone ? 'none' : 'auto',
                zIndex: sel ? 2 : 1,
                transition: ghosted ? 'none' : 'opacity 0.18s',
              }}
            >
              {!isEmpty && s.type === 'bulk' && <BulkGrid s={s} />}
              {isEmpty && (
                <div
                  className="wf-mono"
                  aria-hidden="true"
                  style={{
                    position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                    fontSize: 9, color: 'var(--wf-mute)', letterSpacing: '0.06em', textTransform: 'uppercase',
                    pointerEvents: 'none',
                  }}
                >
                  empty
                </div>
              )}
            </div>
          );
        })}

        {marquee && (
          <div style={{
            position: 'absolute', left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h,
            border: `1.5px dashed ${marquee.bad ? '#c0463a' : '#46945a'}`, borderRadius: 2, zIndex: 6, pointerEvents: 'none',
            background: marquee.bad
              ? 'repeating-linear-gradient(135deg, rgba(192,70,58,0.20) 0 6px, transparent 6px 12px)'
              : `repeating-linear-gradient(0deg, rgba(70,148,90,0.16) 0 ${CELL - 1}px, rgba(70,148,90,0.30) ${CELL - 1}px ${CELL}px), repeating-linear-gradient(90deg, rgba(70,148,90,0.16) 0 ${CELL - 1}px, rgba(70,148,90,0.30) ${CELL - 1}px ${CELL}px)`,
          }}>
            <div className="wf-mono" style={{ position: 'absolute', top: -20, left: 0, fontSize: 10, background: marquee.bad ? '#c0463a' : '#46945a', color: '#fff', padding: '2px 7px', borderRadius: 3, whiteSpace: 'nowrap' }}>
              {marquee.cols} × {marquee.rows} · {marquee.cols * marquee.rows} units
            </div>
          </div>
        )}

        {selectMarquee && (() => {
          const sx = Math.min(selectMarquee.x0, selectMarquee.x1);
          const sy = Math.min(selectMarquee.y0, selectMarquee.y1);
          const sw = Math.abs(selectMarquee.x1 - selectMarquee.x0);
          const sh = Math.abs(selectMarquee.y1 - selectMarquee.y0);
          return (
            <div style={{
              position: 'absolute', left: sx, top: sy, width: sw, height: sh,
              border: '1.5px dashed var(--wf-ink)', borderRadius: 2, zIndex: 6,
              pointerEvents: 'none',
              background: 'rgba(34,28,22,0.06)',
            }} />
          );
        })()}
      </div>

      {hover && !readOnly && (
        <Tooltip
          shelf={hover}
          sx={Math.min(tf.tx + (hover.x + hover.w / 2) * tf.scale, (wrapRef.current?.clientWidth || 9999) - 244)}
          sy={Math.max(8, tf.ty + (hover.y + hover.h) * tf.scale + 8)}
        />
      )}

      {/* zoom / fit controls */}
      <div style={{ position: 'absolute', right: 16, bottom: 16, display: 'flex', alignItems: 'center', gap: 6, zIndex: 15 }}>
        <button type="button" aria-label="Zoom out" style={CTL_BTN_STYLE} onClick={() => zoomBtn(1 / 1.2)}>−</button>
        <button type="button" aria-label="Fit to view" onClick={fit}
          style={{ ...CTL_BTN_STYLE, width: 'auto', padding: '0 10px', fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(tf.scale * 100)}% · Fit
        </button>
        <button type="button" aria-label="Zoom in" style={CTL_BTN_STYLE} onClick={() => zoomBtn(1.2)}>+</button>
      </div>
    </div>
  );
}















