// Right-side detail drawer — opens when a shelf is clicked in Monitor mode
// (the "hover tooltip + click side-panel" pattern). Shows live metrics,
// wear prediction, maintenance/print history, rack drill-down, and the
// reorder workflow.
import React from 'react';
import { Icon, Stat, Spark } from '../wf-primitives.jsx';
import { statusOf, STATUS_LABEL, SHELF_TYPE_LABEL, CATEGORY_BY_ID, isEmptyShelf } from '../model.js';
import { useStore, useShelves, useTasks } from '../store.jsx';

// Slim variant of the drawer for empty containers (no label / health / cfg).
// Clicking an empty slot on the map opens this so the click path doesn't
// crash on the missing fields; from here the operator can label the slot.
function EmptyDrawer({ shelf, onClose, onLabel }) {
  return (
    <div style={{ width: 380, borderLeft: '1px solid var(--wf-line)', background: '#fff', padding: 22, overflow: 'auto', boxShadow: '-8px 0 24px rgba(0,0,0,0.04)' }}>
      <div className="wf-row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--wf-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Empty container</div>
        <button
          type="button"
          aria-label="Close empty container drawer"
          onClick={onClose}
          style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: 4, display: 'grid', placeItems: 'center' }}
        >
          <Icon name="x" size={16} stroke="var(--wf-mute)" />
        </button>
      </div>
      <div className="wf-mono" style={{ fontSize: 11, color: 'var(--wf-mute)' }}>{shelf.id}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, letterSpacing: '-0.02em' }}>
        Zone {shelf.zone} · unlabeled slot
      </div>
      <div style={{ fontSize: 12, color: 'var(--wf-mute)', marginTop: 6, lineHeight: 1.5 }}>
        This slot has no label or config. Give it a fresh label here, or use a labeled shelf's
        <b> Move label</b> action (Edit zone mode) to transfer an existing identity onto this slot.
      </div>
      <button
        type="button"
        className="wf-btn wf-btn--primary"
        style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
        onClick={onLabel}
      >
        <Icon name="tag" size={12} /> Label this slot
      </button>
    </div>
  );
}

export default function ShelfDrawer() {
  const { state, dispatch } = useStore();
  const shelves = useShelves();
  const tasks = useTasks();
  const shelf = shelves.find((s) => s.id === state.selectedId);
  if (!shelf) return null;

  if (isEmptyShelf(shelf)) {
    return (
      <EmptyDrawer
        shelf={shelf}
        onClose={() => dispatch({ type: 'selectShelf', id: null })}
        onLabel={() => dispatch({ type: 'whLabelEmpty', id: shelf.id })}
      />
    );
  }

  const st = statusOf(shelf.health);
  const task = tasks.find((t) => t.shelf === shelf.id && t.status === 'open');
  const trend = React.useMemo(
    () => Array.from({ length: 24 }, (_, i) =>
      Math.max(1, Math.round((shelf.scanFail || 1) * (0.4 + (i / 24) * 0.9) + (i % 4)))),
    [shelf.scanFail],
  );
  const atRisk = shelf.predictedDays <= 10;
  const cat = shelf.cfg ? (CATEGORY_BY_ID[shelf.category || shelf.cfg.category] || CATEGORY_BY_ID.standard) : null;

  return (
    <div style={{ width: 380, borderLeft: '1px solid var(--wf-line)', background: '#fff', padding: 22, overflow: 'auto', boxShadow: '-8px 0 24px rgba(0,0,0,0.04)' }}>
      <div className="wf-row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--wf-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Shelf detail</div>
        <button
          type="button"
          aria-label="Close shelf detail"
          onClick={() => dispatch({ type: 'selectShelf', id: null })}
          style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: 4, display: 'grid', placeItems: 'center' }}
        >
          <Icon name="x" size={16} stroke="var(--wf-mute)" />
        </button>
      </div>

      <div className="wf-row" style={{ justifyContent: 'space-between' }}>
        <div>
          <div className="wf-mono" style={{ fontSize: 11, color: 'var(--wf-mute)' }}>{shelf.id}</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, letterSpacing: '-0.02em' }}>Zone {shelf.zone} · {shelf.code}</div>
          <div style={{ fontSize: 12, color: 'var(--wf-mute)', marginTop: 2 }}>
            {SHELF_TYPE_LABEL[shelf.type] || 'Shelf'} · {shelf.skuCount} SKUs · {shelf.label.id}
          </div>
        </div>
        <span className={`wf-pill wf-pill--${st}`}>{STATUS_LABEL[st]}</span>
      </div>

      {shelf.cfg && cat && (
        <div className="wf-card" style={{ padding: 12, marginTop: 14, fontSize: 12 }}>
          <div className="wf-row" style={{ justifyContent: 'space-between' }}>
            <span className="wf-row" style={{ gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: cat.color, border: '1px solid rgba(0,0,0,0.18)' }} />
              {cat.label}
            </span>
            <span className="wf-mono" style={{ color: 'var(--wf-mute)' }}>
              {shelf.cfg.dims.w}×{shelf.cfg.dims.d}×{shelf.cfg.dims.h} cm · {shelf.cfg.levels}L
            </span>
          </div>
          {(shelf.cfg.rules.temperatureControlled || shelf.cfg.rules.hazmat || shelf.cfg.rules.locked || shelf.cfg.rules.pickable === false) && (
            <div className="wf-row" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {shelf.cfg.rules.temperatureControlled && <span className="wf-pill">{shelf.cfg.rules.targetTempC ?? 2}°C</span>}
              {shelf.cfg.rules.hazmat && <span className="wf-pill wf-pill--bad">Hazmat</span>}
              {shelf.cfg.rules.locked && <span className="wf-pill">Locked</span>}
              {shelf.cfg.rules.pickable === false && <span className="wf-pill">No-pick</span>}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 16 }}>
        <Stat label="Label health" value={shelf.health} />
        <Stat label="Scan fail" value={`${shelf.scanFail}%`} deltaTone={shelf.scanFail > 10 ? 'bad' : 'mute'} />
        <Stat label="Last replaced" value={shelf.lastReplaced} delta={`${shelf.lastReplacedDays}d ago`} />
      </div>

      {/* wear prediction */}
      <div className="wf-card" style={{ padding: 14, marginTop: 14, borderColor: atRisk ? 'var(--wf-bad)' : 'var(--wf-line)' }}>
        <div className="wf-row" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: 'var(--wf-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Wear prediction</span>
          {atRisk && <span className="wf-pill wf-pill--bad">Within SLA</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
          <span style={{ fontSize: 26, fontWeight: 700, color: atRisk ? 'var(--wf-bad)' : 'inherit' }}>{shelf.predictedDays}</span>
          <span style={{ fontSize: 12, color: 'var(--wf-mute)' }}>days to replacement threshold</span>
        </div>
        <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: 'var(--wf-tint-2)', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, (shelf.predictedDays / 90) * 100)}%`, height: '100%', background: atRisk ? 'var(--wf-bad)' : st === 'warn' ? 'var(--wf-warn)' : 'var(--wf-ok)' }} />
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--wf-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Scan reliability — 24h</div>
        <div className="wf-card" style={{ padding: 14 }}>
          <Spark width={320} height={52} data={trend} color={st === 'bad' ? 'var(--wf-bad)' : st === 'warn' ? 'var(--wf-warn)' : 'var(--wf-ok)'} />
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--wf-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Maintenance &amp; print history</div>
        <div className="wf-card">
          {(shelf.history || []).map((e, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 1fr auto', gap: 10, padding: '10px 14px', borderTop: i === 0 ? 'none' : '1px solid var(--wf-line)', fontSize: 12, alignItems: 'center' }}>
              <div className="wf-mono" style={{ color: 'var(--wf-mute)' }}>{e.t}</div>
              <div>{e.d}</div>
              <div style={{ color: 'var(--wf-mute)', fontSize: 11 }}>{e.who}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="wf-col" style={{ marginTop: 18, gap: 8 }}>
        <button className="wf-btn wf-btn--primary" style={{ justifyContent: 'center' }} disabled={shelf.label.reordered} onClick={() => dispatch({ type: 'reorderLabel', id: shelf.id })}>
          <Icon name="print" size={12} /> {shelf.label.reordered ? 'Label reorder queued' : 'Reorder label & queue task'}
        </button>
        <button className="wf-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => dispatch({ type: 'drill', id: shelf.id })}>
          <Icon name="layers" size={12} /> Drill into rack
        </button>
        {task && (
          <div className="wf-card" style={{ padding: 10, fontSize: 12 }}>
            <div className="wf-row" style={{ justifyContent: 'space-between' }}>
              <span className="wf-mono">{task.id}</span>
              <span className="wf-pill wf-pill--warn">{task.status}</span>
            </div>
            <div style={{ color: 'var(--wf-mute)', marginTop: 4 }}>{task.title}</div>
          </div>
        )}
      </div>
    </div>
  );
}





