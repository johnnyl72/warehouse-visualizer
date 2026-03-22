// Focused zone view — opened from the Operations Map by clicking a zone
// badge. Two modes:
//   • View — live KPIs, open tasks raised against the zone, sortable shelf
//     list; selecting a shelf opens the shared ShelfDrawer.
//   • Edit zone — add new shelves into this zone, drag to move (clamped to
//     the zone bbox), delete, and reconfigure category / physical bay /
//     levels / rules per shelf. Edits write through `shelvesByWh` and
//     `custom` immediately so the change persists on reload.
import React from 'react';
import { Icon, Stat } from '../../wf-primitives.jsx';
import {
  ZONE_BY_ID, ZONES, WORLD, statusOf, STATUS_LABEL, SHELF_TYPE_LABEL, SHELF_CATEGORIES,
  CATEGORY_BY_ID, summarizeZone, shelfCfg, volumeM3, slotCapacity, isEmptyShelf,
} from '../../model.js';
import { useStore, useShelves, useTasks } from '../../store.jsx';
import WarehouseCanvas from '../WarehouseCanvas.jsx';
import ShelfDrawer from '../ShelfDrawer.jsx';

const SORTS = [
  { id: 'health-asc', label: 'Worst health first', cmp: (a, b) => a.health - b.health },
  { id: 'fail-desc', label: 'Highest scan fail', cmp: (a, b) => b.scanFail - a.scanFail },
  { id: 'predict-asc', label: 'Soonest replace', cmp: (a, b) => a.predictedDays - b.predictedDays },
  { id: 'code-asc', label: 'Shelf code', cmp: (a, b) => a.code.localeCompare(b.code) },
];

// ── Shelf row (view + edit) ──────────────────────────────────────────────
function ShelfRow({ s, selected, edit, onSelect, onDelete }) {
  const empty = isEmptyShelf(s);
  const st = empty ? null : statusOf(s.health);
  const cat = empty ? null : (CATEGORY_BY_ID[s.cfg?.category || s.category] || CATEGORY_BY_ID.standard);
  return (
    <div
      className="wf-row"
      style={{
        gap: 0, padding: 0, borderTop: '1px solid var(--wf-line)',
        background: selected ? 'var(--wf-tint)' : 'transparent',
      }}
    >
      <button
        type="button"
        onClick={() => onSelect(s.id)}
        className="wf-row"
        style={{
          flex: 1, justifyContent: 'space-between', gap: 10, padding: '10px 12px',
          border: 0, background: 'transparent', font: 'inherit', cursor: 'pointer',
          textAlign: 'left', minWidth: 0,
        }}
        aria-pressed={selected}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {empty ? (
            <span style={{ width: 10, height: 10, borderRadius: 2, background: 'transparent', border: '1.5px dashed rgba(0,0,0,0.35)', flex: '0 0 auto' }} />
          ) : edit ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '0 0 auto' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: cat.color, border: '1px solid rgba(0,0,0,0.18)' }} />
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: `var(--wf-${st})` }} />
            </span>
          ) : (
            <span style={{ width: 8, height: 8, borderRadius: 4, background: `var(--wf-${st})`, flex: '0 0 auto' }} />
          )}
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span className="wf-mono" style={{ fontSize: 12, fontWeight: 600, color: empty ? 'var(--wf-mute)' : 'inherit' }}>
              {empty ? 'Empty container' : s.code}
            </span>
            <span style={{ fontSize: 11, color: 'var(--wf-mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {empty ? 'No label · click to assign' : edit ? cat.label : `${SHELF_TYPE_LABEL[s.type] || 'Shelf'} · ${s.skuCount} SKUs`}
            </span>
          </span>
        </span>
        {!edit && !empty && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '0 0 auto' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--wf-tint-2)', overflow: 'hidden' }}>
                <span style={{ display: 'block', width: `${s.health}%`, height: '100%', background: `var(--wf-${st})` }} />
              </span>
              <span className="wf-mono" style={{ fontSize: 11, minWidth: 22, textAlign: 'right' }}>{s.health}</span>
            </span>
            <span className="wf-mono" style={{ fontSize: 11, color: s.scanFail > 10 ? 'var(--wf-bad)' : s.scanFail > 4 ? 'var(--wf-warn)' : 'var(--wf-mute)', minWidth: 38, textAlign: 'right' }}>
              {s.scanFail}%
            </span>
            <span className={`wf-pill wf-pill--${st}`} style={{ fontSize: 10 }}>{STATUS_LABEL[st]}</span>
          </span>
        )}
        {empty && <span className="wf-pill" style={{ fontSize: 10 }}>empty</span>}
      </button>
      {edit && (
        <button
          type="button"
          onClick={() => onDelete(s.id)}
          aria-label={`Delete ${empty ? 'empty container' : s.code}`}
          title="Delete shelf"
          style={{
            padding: '0 12px', border: 0, background: 'transparent', cursor: 'pointer',
            color: 'var(--wf-mute)', display: 'grid', placeItems: 'center',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--wf-bad)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--wf-mute)')}
        >
          <Icon name="x" size={12} stroke="currentColor" />
        </button>
      )}
    </div>
  );
}

// ── In-place shelf inspector (Edit mode) ─────────────────────────────────
const inputStyle = {
  width: '100%', padding: '6px 8px', border: '1px solid var(--wf-line-2)',
  borderRadius: 6, background: '#fff', font: 'inherit', fontSize: 12, color: 'var(--wf-ink)',
};

function NumRow({ label, value, onChange, min = 1, max = 9999, suffix }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 10, color: 'var(--wf-mute)', marginBottom: 3 }}>{label}</div>
      <div style={{ position: 'relative' }}>
        <input
          type="number" inputMode="numeric" value={value} min={min} max={max}
          onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
          style={{ ...inputStyle, paddingRight: suffix ? 28 : 8 }}
        />
        {suffix && <span style={{ position: 'absolute', right: 8, top: 7, fontSize: 10, color: 'var(--wf-mute)' }}>{suffix}</span>}
      </div>
    </label>
  );
}

function Toggle({ label, on, onChange }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-label={label}
      onClick={() => onChange(!on)}
      className="wf-row"
      style={{ justifyContent: 'space-between', width: '100%', padding: '7px 2px', border: 0, background: 'transparent', font: 'inherit', cursor: 'pointer' }}
    >
      <span style={{ fontSize: 12 }}>{label}</span>
      <span style={{ width: 32, height: 18, borderRadius: 9, background: on ? 'var(--wf-ok)' : 'var(--wf-tint-2)', position: 'relative', flex: '0 0 auto', transition: 'background .15s' }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 16 : 2, width: 14, height: 14, borderRadius: 7, background: '#fff', transition: 'left .15s' }} />
      </span>
    </button>
  );
}

const Section = ({ title, children }) => (
  <div style={{ padding: '14px 18px', borderTop: '1px solid var(--wf-line)' }}>
    <div style={{ fontSize: 11, color: 'var(--wf-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{title}</div>
    {children}
  </div>
);

function EditPanel({ shelf, allShelves, onClose }) {
  const { dispatch } = useStore();
  const empty = isEmptyShelf(shelf);
  const cfg = React.useMemo(() => (empty ? null : shelfCfg(shelf)), [shelf, empty]);
  const cat = cfg ? (CATEGORY_BY_ID[cfg.category] || CATEGORY_BY_ID.standard) : null;
  const vol = cfg ? volumeM3(cfg.dims) : 0;
  const slots = cfg ? slotCapacity(cfg.dims, cfg.levels) : 0;
  const set = (patch) => dispatch({ type: 'whUpdateShelf', id: shelf.id, patch });
  const [moveOpen, setMoveOpen] = React.useState(false);

  // Empty containers get a slimmer panel — the only action is to label
  // the slot (giving it a fresh code/cfg) or to receive a moved label
  // (handled from the source's panel). Delete is still available.
  if (empty) {
    return (
      <div style={{ width: 380, borderLeft: '1px solid var(--wf-line)', background: '#fff', overflow: 'auto', boxShadow: '-8px 0 24px rgba(0,0,0,0.04)' }}>
        <div className="wf-row" style={{ justifyContent: 'space-between', padding: '18px 18px 0' }}>
          <div style={{ fontSize: 11, color: 'var(--wf-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Empty container</div>
          <button type="button" onClick={onClose} aria-label="Close editor" style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--wf-mute)' }}>
            <Icon name="x" size={16} stroke="currentColor" />
          </button>
        </div>
        <div style={{ padding: '8px 18px 16px' }}>
          <div className="wf-mono" style={{ fontSize: 11, color: 'var(--wf-mute)' }}>{shelf.id}</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, letterSpacing: '-0.02em' }}>
            Zone {shelf.zone} · unlabeled slot
          </div>
          <div style={{ fontSize: 12, color: 'var(--wf-mute)', marginTop: 4, lineHeight: 1.5 }}>
            This container has no label or configuration. Give it a fresh label, or move an existing shelf's label here from another shelf's inspector.
          </div>
        </div>
        <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            className="wf-btn wf-btn--primary"
            style={{ justifyContent: 'center' }}
            onClick={() => dispatch({ type: 'whLabelEmpty', id: shelf.id })}
          >
            <Icon name="tag" size={12} /> Label this slot
          </button>
          <button
            type="button"
            className="wf-btn"
            style={{ justifyContent: 'center', color: 'var(--wf-bad)', borderColor: 'var(--wf-bad)' }}
            onClick={() => {
              if (!window.confirm('Delete this empty container?')) return;
              dispatch({ type: 'whDeleteShelf', id: shelf.id });
            }}
          >
            <Icon name="x" size={12} stroke="currentColor" /> Delete slot
          </button>
        </div>
      </div>
    );
  }

  // Category change: re-apply the category's defaults onto the existing
  // cfg (everything you've manually set stays — only the rule keys the
  // category owns are merged in).
  const onCategory = (catId) => {
    const next = CATEGORY_BY_ID[catId];
    const r = { ...(next.rules || {}) };
    const patch = { category: catId };
    if ('levels' in r) { patch.levels = r.levels; delete r.levels; }
    patch.rules = r;
    set(patch);
  };

  const st = statusOf(shelf.health);

  return (
    <div style={{ width: 380, borderLeft: '1px solid var(--wf-line)', background: '#fff', overflow: 'auto', boxShadow: '-8px 0 24px rgba(0,0,0,0.04)' }}>
      <div className="wf-row" style={{ justifyContent: 'space-between', padding: '18px 18px 0' }}>
        <div style={{ fontSize: 11, color: 'var(--wf-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Edit shelf</div>
        <button type="button" onClick={onClose} aria-label="Close editor" style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--wf-mute)' }}>
          <Icon name="x" size={16} stroke="currentColor" />
        </button>
      </div>
      <div style={{ padding: '8px 18px 16px' }}>
        <div className="wf-mono" style={{ fontSize: 11, color: 'var(--wf-mute)' }}>{shelf.id}</div>
        <div className="wf-row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Zone {shelf.zone} · {shelf.code}</div>
          <span className={`wf-pill wf-pill--${st}`} style={{ fontSize: 10 }}>{STATUS_LABEL[st]}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--wf-mute)', marginTop: 2 }}>
          Drag the shelf on the canvas to move within this zone.
        </div>
      </div>

      <Section title="Category">
        <div className="wf-row" style={{ gap: 8 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, background: cat.color, border: '1px solid rgba(0,0,0,0.2)', flex: '0 0 auto' }} />
          <select value={cfg.category} onChange={(e) => onCategory(e.target.value)} style={inputStyle}>
            {SHELF_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
      </Section>

      <Section title="Physical bay → cubic volume">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <NumRow label="Width"  value={cfg.dims.w} onChange={(w) => set({ dims: { w } })} suffix="cm" max={2000} />
          <NumRow label="Depth"  value={cfg.dims.d} onChange={(d) => set({ dims: { d } })} suffix="cm" max={2000} />
          <NumRow label="Height" value={cfg.dims.h} onChange={(h) => set({ dims: { h } })} suffix="cm" max={2000} />
        </div>
        <div className="wf-card" style={{ marginTop: 10, padding: 10, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--wf-mute)' }}>Cubic volume</div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{vol} m³</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'var(--wf-mute)' }}>Est. pallet slots</div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{slots}</div>
          </div>
        </div>
      </Section>

      <Section title="Capacity & limits">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <NumRow label="Levels" value={cfg.levels} onChange={(v) => set({ levels: v })} min={1} max={12} />
          <NumRow label="Max load" value={cfg.rules.maxWeightKg ?? 1000} onChange={(v) => set({ rules: { maxWeightKg: v } })} min={50} max={20000} suffix="kg" />
        </div>
      </Section>

      <Section title="Rules">
        <Toggle
          label="Temperature-controlled"
          on={!!cfg.rules.temperatureControlled}
          onChange={(v) => set({ rules: { temperatureControlled: v, targetTempC: v ? (cfg.rules.targetTempC ?? 2) : null } })}
        />
        {cfg.rules.temperatureControlled && (
          <div style={{ margin: '2px 0 6px' }}>
            <NumRow label="Target temp" value={cfg.rules.targetTempC ?? 2} onChange={(v) => set({ rules: { targetTempC: v } })} min={-30} max={25} suffix="°C" />
          </div>
        )}
        <Toggle label="Hazmat"   on={!!cfg.rules.hazmat}   onChange={(v) => set({ rules: { hazmat: v } })} />
        <Toggle label="Pickable" on={cfg.rules.pickable !== false} onChange={(v) => set({ rules: { pickable: v } })} />
        <Toggle label="Locked"   on={!!cfg.rules.locked}   onChange={(v) => set({ rules: { locked: v } })} />
        {cfg.rules.hazmat && (
          <div style={{ fontSize: 11, color: 'var(--wf-warn)', marginTop: 6 }}>⚠ Hazmat — segregation &amp; access controls apply.</div>
        )}
      </Section>

      <Section title="Move label">
        <div style={{ fontSize: 11, color: 'var(--wf-mute)', lineHeight: 1.5, marginBottom: 8 }}>
          Transfer this label + its config + history to another shelf in this warehouse.
          This slot becomes an empty container; positions don't change.
        </div>
        {!moveOpen && (
          <button
            type="button"
            className="wf-btn"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => setMoveOpen(true)}
          >
            <Icon name="arrow-right" size={12} /> Move label to another shelf…
          </button>
        )}
        {moveOpen && (
          <MoveLabelPicker
            source={shelf}
            shelves={allShelves}
            onCancel={() => setMoveOpen(false)}
            onPick={(targetId) => {
              setMoveOpen(false);
              dispatch({ type: 'whMoveLabel', fromId: shelf.id, toId: targetId });
            }}
          />
        )}
      </Section>

      <div style={{ padding: 16 }}>
        <button
          type="button"
          className="wf-btn"
          style={{ width: '100%', justifyContent: 'center', color: 'var(--wf-bad)', borderColor: 'var(--wf-bad)' }}
          onClick={() => {
            if (!window.confirm(`Delete ${shelf.code}? This removes the shelf and any open tasks tied to it.`)) return;
            dispatch({ type: 'whDeleteShelf', id: shelf.id });
          }}
        >
          <Icon name="x" size={12} stroke="currentColor" /> Delete shelf
        </button>
      </div>
    </div>
  );
}

// Picker shown inline in the EditPanel when moving a label. Lists every
// other shelf in the warehouse with a hint of where it sits + whether it's
// empty (preferred targets first).
function MoveLabelPicker({ source, shelves, onCancel, onPick }) {
  const [q, setQ] = React.useState('');
  const candidates = React.useMemo(() => {
    const others = shelves.filter((s) => s.id !== source.id);
    // Empty containers sort to the top — they're the natural targets.
    const ranked = [...others].sort((a, b) => {
      if (!!a.empty !== !!b.empty) return a.empty ? -1 : 1;
      const az = a.zone || ''; const bz = b.zone || '';
      if (az !== bz) return az.localeCompare(bz);
      return (a.code || '').localeCompare(b.code || '');
    });
    const ql = q.trim().toLowerCase();
    if (!ql) return ranked;
    return ranked.filter((s) =>
      (s.code || '').toLowerCase().includes(ql)
      || (s.zone || '').toLowerCase().includes(ql)
      || s.id.toLowerCase().includes(ql)
    );
  }, [shelves, source.id, q]);

  return (
    <div className="wf-card" style={{ padding: 8, marginTop: 8, background: '#fcfbf8' }}>
      <input
        autoFocus
        placeholder="Search code, zone, id…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{
          width: '100%', padding: '6px 8px', border: '1px solid var(--wf-line-2)',
          borderRadius: 6, background: '#fff', font: 'inherit', fontSize: 12, color: 'var(--wf-ink)',
        }}
      />
      <div style={{ maxHeight: 240, overflow: 'auto', marginTop: 6 }}>
        {candidates.length === 0 && (
          <div style={{ padding: 10, fontSize: 11, color: 'var(--wf-mute)' }}>No matches.</div>
        )}
        {candidates.map((s) => {
          const isEmpty = !!s.empty;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onPick(s.id)}
              className="wf-row"
              style={{
                width: '100%', justifyContent: 'space-between', gap: 8,
                padding: '6px 8px', border: 0, background: 'transparent',
                borderRadius: 4, font: 'inherit', cursor: 'pointer', textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--wf-tint)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span className="wf-mono" style={{ fontSize: 12, fontWeight: 600, color: isEmpty ? 'var(--wf-mute)' : 'inherit' }}>
                  {isEmpty ? `Empty · ${s.zone}` : s.code}
                </span>
                <span style={{ fontSize: 10, color: 'var(--wf-mute)' }}>
                  {isEmpty ? s.id : `Zone ${s.zone} · ${SHELF_TYPE_LABEL[s.type] || 'Shelf'}`}
                </span>
              </span>
              {isEmpty ? (
                <span className="wf-pill" style={{ fontSize: 10 }}>empty</span>
              ) : (
                <span className="wf-pill wf-pill--warn" style={{ fontSize: 10 }}>will be overwritten</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="wf-row" style={{ marginTop: 6, gap: 6, justifyContent: 'flex-end' }}>
        <button type="button" className="wf-btn" style={{ padding: '4px 8px', fontSize: 11 }} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// Floating tool rail — mirrors the Editor's tool palette but its state
// lives locally on the ZoneView (these are workspace controls, not global
// store state). Keyboard shortcuts match the Editor: V / B / E / H / space.
const TOOLS = [
  { id: 'select', icon: 'cursor', label: 'Select / move (V)' },
  { id: 'draw',   icon: 'plus',   label: 'Add — drag to place (B)' },
  { id: 'erase',  icon: 'minus',  label: 'Erase (E)' },
  { id: 'pan',    icon: 'aisle',  label: 'Pan (H · space)' },
];
const KEY_TOOL = { v: 'select', b: 'draw', e: 'erase', h: 'pan', ' ': 'pan' };

function ZoneToolRail({ tool, setTool }) {
  return (
    <div
      role="toolbar"
      aria-label="Zone edit tools"
      aria-orientation="vertical"
      style={{
        position: 'absolute', left: 12, top: 12, zIndex: 11,
        display: 'flex', flexDirection: 'column', gap: 4,
        padding: 6, background: '#fff', borderRadius: 8,
        border: '1px solid var(--wf-line)', boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
      }}
    >
      {TOOLS.map((t) => {
        const on = tool === t.id;
        return (
          <button
            key={t.id}
            type="button"
            title={t.label}
            aria-label={t.label}
            aria-pressed={on}
            onClick={() => setTool(t.id)}
            style={{
              width: 34, height: 34, borderRadius: 6, display: 'grid', placeItems: 'center',
              cursor: 'pointer', border: 0, font: 'inherit',
              background: on ? 'var(--wf-ink)' : 'transparent',
              color: on ? '#fbfaf8' : 'var(--wf-ink-2)',
            }}
          >
            <Icon name={t.icon} size={16} stroke="currentColor" />
          </button>
        );
      })}
    </div>
  );
}

// Small floor-plan overview shown on top of the zone canvas so the operator
// keeps spatial context (where this zone sits in the warehouse) while
// working in an isolated zone sheet. Click another zone to jump to it.
function ZoneMinimap({ focusedId, onJump }) {
  const W = 148;
  const H = Math.round(W * (WORLD.h / WORLD.w));
  const sx = W / WORLD.w;
  const sy = H / WORLD.h;
  return (
    <div
      role="navigation"
      aria-label="Warehouse minimap"
      className="wf-card"
      style={{
        position: 'absolute', right: 12, top: 12, zIndex: 11,
        padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
      }}
    >
      <div style={{ fontSize: 9, color: 'var(--wf-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        Warehouse
      </div>
      <div style={{ position: 'relative', width: W, height: H, background: 'var(--wf-bg)', border: '1px solid var(--wf-line-2)', borderRadius: 3 }}>
        {ZONES.map((z) => {
          const on = z.id === focusedId;
          return (
            <button
              key={z.id}
              type="button"
              onClick={() => !on && onJump(z.id)}
              title={z.label}
              aria-label={`Jump to ${z.label}`}
              aria-current={on ? 'true' : undefined}
              style={{
                position: 'absolute',
                left: z.x * sx, top: z.y * sy,
                width: z.w * sx, height: z.h * sy,
                background: on ? 'var(--wf-ink)' : z.tint,
                border: on ? '1px solid var(--wf-ink)' : '1px solid rgba(0,0,0,0.12)',
                borderRadius: 2, padding: 0,
                color: on ? '#fbfaf8' : 'var(--wf-mute)',
                font: 'inherit', fontSize: 9, fontWeight: 700,
                cursor: on ? 'default' : 'pointer',
                display: 'grid', placeItems: 'center',
              }}
            >
              {z.id}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Right-panel shown when 2+ shelves are selected in zone-edit mode.
// Single shelf still opens the full inspector; this trades depth for breadth.
function BulkPanel({ ids, onClear, onDelete }) {
  return (
    <div style={{ width: 380, borderLeft: '1px solid var(--wf-line)', background: '#fff', overflow: 'auto', boxShadow: '-8px 0 24px rgba(0,0,0,0.04)' }}>
      <div style={{ background: 'var(--wf-ink)', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 30, height: 30, borderRadius: 15, background: '#fff', color: 'var(--wf-ink)', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 700, flex: '0 0 auto' }}>
            {ids.length}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fbfaf8' }}>shelves selected</span>
        </div>
        <button type="button" onClick={onClear} aria-label="Clear selection" style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'rgba(255,255,255,0.65)', display: 'grid', placeItems: 'center' }}>
          <Icon name="x" size={16} stroke="currentColor" />
        </button>
      </div>
      <div style={{ padding: '14px 18px 16px' }}>
        <div style={{ fontSize: 12, color: 'var(--wf-mute)', lineHeight: 1.5 }}>
          Drag any selected shelf on the canvas to move the whole group (relative spacing preserved). Shift-click to add or remove individual shelves. Press Delete to remove them all.
        </div>
      </div>
      <div style={{ padding: '0 18px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          type="button"
          className="wf-btn"
          style={{ justifyContent: 'center', color: 'var(--wf-bad)', borderColor: 'var(--wf-bad)' }}
          onClick={onDelete}
        >
          <Icon name="x" size={12} stroke="currentColor" /> Delete {ids.length} shelves
        </button>
        <button type="button" className="wf-btn" style={{ justifyContent: 'center' }} onClick={onClear}>
          Clear selection
        </button>
      </div>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────
export default function ZoneView({ zoneId }) {
  const { state, dispatch } = useStore();
  const shelves = useShelves();
  const tasks = useTasks();
  const [sortId, setSortId] = React.useState('health-asc');
  const [editMode, setEditMode] = React.useState(false);
  const [editTool, setEditTool] = React.useState('select');

  // Keyboard shortcuts only fire while the zone is in edit mode and the
  // operator isn't typing. Ctrl/Cmd combos are left alone (undo/redo etc).
  React.useEffect(() => {
    if (!editMode) return;
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const k = e.key === ' ' ? ' ' : e.key.toLowerCase();
      const next = KEY_TOOL[k];
      if (next) { e.preventDefault(); setEditTool(next); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const ids = state.selectedIds && state.selectedIds.length
          ? state.selectedIds
          : (state.selectedId ? [state.selectedId] : []);
        if (ids.length === 0) return;
        e.preventDefault();
        if (ids.length === 1) {
          dispatch({ type: 'whDeleteShelf', id: ids[0] });
        } else if (window.confirm(`Delete ${ids.length} shelves? This removes them and any open tasks tied to them.`)) {
          dispatch({ type: 'whDeleteShelves', ids });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editMode, state.selectedId, state.selectedIds, dispatch]);

  const zone = ZONE_BY_ID[zoneId];
  const summary = React.useMemo(() => summarizeZone(zoneId, shelves), [zoneId, shelves]);
  const sorted = React.useMemo(() => {
    const cmp = (SORTS.find((s) => s.id === sortId) || SORTS[0]).cmp;
    return [...summary.shelves].sort(cmp);
  }, [summary.shelves, sortId]);

  const zoneShelfIds = React.useMemo(
    () => new Set(summary.shelves.map((s) => s.id)),
    [summary.shelves],
  );
  const openInZone = tasks.filter((t) => t.status !== 'done' && zoneShelfIds.has(t.shelf));

  const selectedIds = React.useMemo(
    () => (state.selectedIds || []).filter((id) => zoneShelfIds.has(id)),
    [state.selectedIds, zoneShelfIds],
  );
  const primaryId = selectedIds.length ? selectedIds[selectedIds.length - 1] : null;
  const selectedShelf = primaryId
    ? summary.shelves.find((s) => s.id === primaryId)
    : null;
  const multiSelected = selectedIds.length > 1;

  // Exiting edit mode clears any open editor selection so the operator
  // doesn't pop back into view-mode with a stale right panel.
  const toggleEdit = () => {
    setEditMode((v) => {
      if (v) dispatch({ type: 'selectShelf', id: null });
      return !v;
    });
  };

  if (!zone) {
    return (
      <div style={{ padding: 24 }}>
        <button className="wf-btn" onClick={() => dispatch({ type: 'closeZone' })}>
          <Icon name="arrow-right" size={12} /> Back to warehouse
        </button>
      </div>
    );
  }

  const reorderAll = () => {
    summary.shelves
      .filter((s) => statusOf(s.health) !== 'ok' && !s.label.reordered)
      .forEach((s) => dispatch({ type: 'reorderLabel', id: s.id, auto: true }));
  };

  // Right column gates: edit mode → EditPanel for selected, otherwise the
  // shared ShelfDrawer. Width is the same so the grid template stays stable.
  const showRight = !!selectedShelf || multiSelected;
  const rightColWidth = 380;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: showRight ? `360px 1fr ${rightColWidth}px` : '360px 1fr',
        height: '100%',
      }}
    >
      {/* Left rail — zone identity, KPIs, open tasks, shelf list */}
      <div style={{ borderRight: '1px solid var(--wf-line)', display: 'flex', flexDirection: 'column', background: '#fcfbf8', minWidth: 0 }}>
        <div style={{ padding: 18, borderBottom: '1px solid var(--wf-line)' }}>
          <div className="wf-row" style={{ justifyContent: 'space-between' }}>
            <button
              type="button"
              className="wf-row"
              onClick={() => dispatch({ type: 'closeZone' })}
              style={{
                gap: 6, padding: '4px 8px', border: '1px solid var(--wf-line)',
                borderRadius: 6, background: '#fff', font: 'inherit', fontSize: 11,
                color: 'var(--wf-mute)', cursor: 'pointer',
              }}
              aria-label="Back to warehouse map"
            >
              <span aria-hidden="true">←</span> Warehouse map
            </button>
            <button
              type="button"
              onClick={toggleEdit}
              aria-pressed={editMode}
              className="wf-row"
              style={{
                gap: 6, padding: '4px 10px', borderRadius: 6, font: 'inherit', fontSize: 11,
                cursor: 'pointer',
                border: '1px solid ' + (editMode ? 'var(--wf-ink)' : 'var(--wf-line-2)'),
                background: editMode ? 'var(--wf-ink)' : '#fff',
                color: editMode ? '#fbfaf8' : 'var(--wf-ink)',
              }}
            >
              {editMode ? <><Icon name="check" size={11} stroke="currentColor" /> Done editing</> : <><Icon name="edit" size={11} stroke="currentColor" /> Edit zone</>}
            </button>
          </div>
          <div className="wf-row" style={{ justifyContent: 'space-between', marginTop: 14 }}>
            <div>
              <div className="wf-mono" style={{ fontSize: 11, color: 'var(--wf-mute)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Zone {zone.id}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, letterSpacing: '-0.02em' }}>
                {zone.label.split(' · ')[1] || zone.label}
              </div>
              <div style={{ fontSize: 12, color: 'var(--wf-mute)', marginTop: 2 }}>
                {summary.n} labeled
                {summary.empty > 0 ? ` · ${summary.empty} empty` : ''}
                {' · '}{summary.reordered} reorder{summary.reordered === 1 ? '' : 's'} in flight
              </div>
            </div>
            <span
              className={`wf-pill wf-pill--${summary.bad > 0 ? 'bad' : summary.warn > 0 ? 'warn' : 'ok'}`}
              style={{ alignSelf: 'flex-start' }}
            >
              {summary.bad > 0 ? `${summary.bad} replace` : summary.warn > 0 ? `${summary.warn} aging` : 'Healthy'}
            </span>
          </div>
        </div>

        {!editMode && (
          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, borderBottom: '1px solid var(--wf-line)' }}>
            <Stat label="Avg health" value={summary.avg} />
            <Stat label="Avg scan fail" value={`${summary.fail}%`} deltaTone={summary.fail > 4 ? 'bad' : 'mute'} />
            <Stat label="At risk (≤10d)" value={summary.atRisk} deltaTone={summary.atRisk > 0 ? 'bad' : 'mute'} />
            <Stat label="Open tasks" value={openInZone.length} deltaTone={openInZone.length > 0 ? 'bad' : 'mute'} />
          </div>
        )}

        {editMode && (
          <div style={{ padding: 16, borderBottom: '1px solid var(--wf-line)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="wf-row" style={{ gap: 6, fontSize: 11, color: 'var(--wf-mute)' }}>
              <span className="wf-pill" style={{ fontSize: 10, background: 'var(--wf-ink)', color: '#fbfaf8', borderColor: 'var(--wf-ink)' }}>
                {TOOLS.find((t) => t.id === editTool)?.label.split(' (')[0]}
              </span>
              <span>· active tool</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--wf-mute)', lineHeight: 1.5 }}>
              <b>V</b> select / move · <b>B</b> add (drag) · <b>E</b> erase · <b>H</b> pan.
              Click an empty container to label it, or use <b>Move label</b> in the inspector to transfer a label.
            </div>
            <button
              type="button"
              className="wf-btn"
              style={{ justifyContent: 'center' }}
              onClick={() => dispatch({ type: 'whAddShelfInZone', zoneId: zone.id })}
              title="Drop one shelf at the first free cell in the zone"
            >
              <Icon name="plus" size={12} /> Quick-add 1 shelf
            </button>
          </div>
        )}

        {!editMode && openInZone.length > 0 && (
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--wf-line)' }}>
            <div className="wf-row" style={{ justifyContent: 'space-between' }}>
              <div style={{ fontSize: 11, color: 'var(--wf-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Open tasks in this zone
              </div>
              <button
                type="button"
                className="wf-btn wf-btn--ghost"
                style={{ padding: '2px 6px', fontSize: 11 }}
                onClick={() => dispatch({ type: 'navigate', view: 'maintenance' })}
              >
                Queue <Icon name="arrow-right" size={11} />
              </button>
            </div>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {openInZone.slice(0, 4).map((t) => {
                const targetMissing = !zoneShelfIds.has(t.shelf);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => !targetMissing && dispatch({ type: 'selectShelf', id: t.shelf })}
                    disabled={targetMissing}
                    aria-pressed={state.selectedId === t.shelf}
                    className="wf-row"
                    title={`Open shelf ${t.shelf}`}
                    style={{
                      justifyContent: 'space-between', gap: 8,
                      padding: '6px 8px', border: 0, borderRadius: 6,
                      background: state.selectedId === t.shelf ? 'var(--wf-tint)' : 'transparent',
                      font: 'inherit', fontSize: 12, cursor: targetMissing ? 'default' : 'pointer',
                      textAlign: 'left', minWidth: 0, opacity: targetMissing ? 0.6 : 1,
                    }}
                    onMouseEnter={(e) => { if (!targetMissing && state.selectedId !== t.shelf) e.currentTarget.style.background = 'var(--wf-tint)'; }}
                    onMouseLeave={(e) => { if (state.selectedId !== t.shelf) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                      <span className="wf-mono" style={{ fontSize: 10, color: 'var(--wf-mute)' }}>{t.shelf}</span>
                    </span>
                    <span className={`wf-pill wf-pill--${t.prio === 'high' ? 'bad' : 'warn'}`} style={{ fontSize: 10, flex: '0 0 auto' }}>{t.prio}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ padding: '12px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 11, color: 'var(--wf-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Shelves · {summary.total}{summary.empty > 0 ? ` (${summary.empty} empty)` : ''}
          </div>
          {!editMode && (
            <select
              value={sortId}
              onChange={(e) => setSortId(e.target.value)}
              aria-label="Sort shelves"
              style={{
                padding: '4px 6px', border: '1px solid var(--wf-line-2)', borderRadius: 6,
                font: 'inherit', fontSize: 11, background: '#fff', color: 'var(--wf-ink)',
              }}
            >
              {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          )}
        </div>
        <div style={{ flex: 1, overflow: 'auto', borderTop: '1px solid var(--wf-line)' }}>
          {sorted.length === 0 && (
            <div style={{ padding: 16, fontSize: 12, color: 'var(--wf-mute)' }}>
              {editMode ? 'No shelves yet — use "Add shelf" to drop one into this zone.' : 'No shelves placed in this zone yet.'}
            </div>
          )}
          {sorted.map((s) => (
            <ShelfRow
              key={s.id}
              s={s}
              selected={selectedIds.includes(s.id)}
              edit={editMode}
              onSelect={(id) => dispatch({ type: 'selectShelf', id })}
              onDelete={(id) => {
                if (!window.confirm(`Delete ${s.code}? This removes the shelf and any open tasks tied to it.`)) return;
                dispatch({ type: 'whDeleteShelf', id });
              }}
            />
          ))}
        </div>

        {!editMode && (summary.bad > 0 || summary.warn > 0) && (
          <div style={{ padding: 14, borderTop: '1px solid var(--wf-line)' }}>
            <button
              type="button"
              className="wf-btn wf-btn--primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={reorderAll}
              disabled={summary.shelves.every((s) => statusOf(s.health) === 'ok' || s.label.reordered)}
            >
              <Icon name="print" size={12} /> Reorder all aging / replace labels
            </button>
          </div>
        )}
      </div>

      {/* Centre — focused canvas of just this zone */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <WarehouseCanvas
          surface="monitor"
          focusZoneId={zoneId}
          editInPlace={editMode}
          editTool={editTool}
        />
        <ZoneMinimap focusedId={zoneId} onJump={(id) => dispatch({ type: 'focusZone', id })} />
        {editMode && <ZoneToolRail tool={editTool} setTool={setEditTool} />}
        {editMode && (
          <div
            className="wf-card"
            style={{
              position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 18,
              padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12,
              zIndex: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
            }}
          >
            <span className="wf-pill" style={{ background: 'var(--wf-ink)', color: '#fbfaf8', borderColor: 'var(--wf-ink)' }}>Edit mode</span>
            <span style={{ color: 'var(--wf-ink)' }}>
              {editTool === 'draw' ? 'Drag inside the zone to stamp new shelves · out-of-zone cells are skipped'
                : editTool === 'erase' ? 'Click a shelf to delete it'
                : editTool === 'pan' ? 'Drag the background to pan'
                : 'Click a shelf to reconfigure · drag to move · changes save instantly'}
            </span>
          </div>
        )}
      </div>

      {/* Right — BulkPanel for multi-select, EditPanel in edit mode, ShelfDrawer otherwise */}
      {showRight && (
        editMode && multiSelected
          ? (
            <BulkPanel
              ids={selectedIds}
              onClear={() => dispatch({ type: 'selectShelf', id: null })}
              onDelete={() => {
                if (!window.confirm(`Delete ${selectedIds.length} shelves? This removes them and any open tasks tied to them.`)) return;
                dispatch({ type: 'whDeleteShelves', ids: selectedIds });
              }}
            />
          )
          : editMode
            ? (
              <EditPanel
                shelf={selectedShelf}
                allShelves={shelves}
                onClose={() => dispatch({ type: 'selectShelf', id: null })}
              />
            )
            : <ShelfDrawer />
      )}
    </div>
  );
}




