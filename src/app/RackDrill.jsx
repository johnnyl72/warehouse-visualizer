// Rack drill-down — focus overlay for one shelf, exploding it into its
// levels × bays with per-bay label health (synthesized deterministically
// from the shelf so it's stable). Mirrors the wireframe's rack-focus board.
import React from 'react';
import { Icon, Stat, rng } from '../wf-primitives.jsx';
import { statusOf, STATUS_LABEL, SHELF_TYPE_LABEL } from '../model.js';
import { useStore, useShelves } from '../store.jsx';

const seedFrom = (str) => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h;
};

export default function RackDrill() {
  const { state, dispatch } = useStore();
  const shelves = useShelves();
  const shelf = shelves.find((s) => s.id === state.drillId);

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') dispatch({ type: 'closeDrill' }); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);

  // Bay grid layout + per-bay health is deterministic from shelf id/health,
  // so only recompute when the focused shelf changes (not on every dispatch).
  const grid = React.useMemo(() => {
    if (!shelf) return null;
    const levels = shelf.h >= shelf.w ? 5 : 3;
    const bays = Math.max(4, Math.round((shelf.w * shelf.h) / 1400));
    const r = rng(seedFrom(shelf.id));
    const cells = Array.from({ length: levels * bays }, () => {
      const jitter = Math.round((r() - 0.5) * 26);
      return Math.max(20, Math.min(100, shelf.health + jitter));
    });
    const avg = Math.round(cells.reduce((a, b) => a + b, 0) / cells.length);
    return { levels, bays, cells, avg };
  }, [shelf && shelf.id, shelf && shelf.health, shelf && shelf.w, shelf && shelf.h]);

  if (!shelf) return null;
  const { levels, bays, cells, avg } = grid;
  const st = statusOf(shelf.health);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Rack drill-down: ${shelf.code}`}
      onClick={() => dispatch({ type: 'closeDrill' })}
      style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(24,20,16,0.55)', backdropFilter: 'blur(10px)', display: 'grid', placeItems: 'center', padding: 40 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="wf-card"
        style={{ width: 'min(1000px, 92vw)', maxHeight: '88vh', overflow: 'auto', padding: 24, boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }}
      >
        <div className="wf-row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="wf-mono" style={{ fontSize: 11, color: 'var(--wf-mute)' }}>{shelf.id}</div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 2 }}>
              Rack {shelf.code} · {levels} levels × {bays} bays
            </div>
            <div style={{ fontSize: 12, color: 'var(--wf-mute)', marginTop: 2 }}>
              {SHELF_TYPE_LABEL[shelf.type] || 'Shelf'} · Zone {shelf.zone}
            </div>
          </div>
          <div className="wf-row" style={{ gap: 10 }}>
            <span className={`wf-pill wf-pill--${st}`}>{STATUS_LABEL[st]}</span>
            <button
              type="button"
              aria-label="Close rack drill-down"
              onClick={() => dispatch({ type: 'closeDrill' })}
              style={{ cursor: 'pointer', color: 'var(--wf-mute)', border: 0, background: 'transparent', padding: 4, display: 'grid', placeItems: 'center' }}
            >
              <Icon name="x" size={18} stroke="var(--wf-mute)" />
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, margin: '18px 0' }}>
          <Stat label="Avg bay health" value={avg} />
          <Stat label="Scan fail" value={`${shelf.scanFail}%`} deltaTone={shelf.scanFail > 10 ? 'bad' : 'mute'} />
          <Stat label="Predicted life" value={`${shelf.predictedDays}d`} deltaTone={shelf.predictedDays <= 10 ? 'bad' : 'mute'} />
          <Stat label="Bays at risk" value={cells.filter((c) => c < 60).length} deltaTone="bad" />
        </div>

        <div style={{ background: 'repeating-linear-gradient(0deg, transparent 0 31px, rgba(0,0,0,0.025) 31px 32px), #f7f5f0', border: '1px solid var(--wf-line)', borderRadius: 8, padding: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${bays}, 1fr)`, gridTemplateRows: `repeat(${levels}, 1fr)`, gap: 8, minHeight: levels * 70 }}>
            {cells.map((hp, i) => {
              const t = statusOf(hp);
              const level = levels - Math.floor(i / bays);
              const bay = (i % bays) + 1;
              return (
                <div
                  key={i}
                  title={`L${level} · Bay ${bay} · health ${hp}`}
                  style={{ borderRadius: 4, padding: 8, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: t === 'ok' ? '#cfe0bf' : t === 'warn' ? '#f0d99f' : '#e9b4ab', border: '1px solid rgba(0,0,0,0.06)' }}
                >
                  <div className="wf-mono" style={{ fontSize: 9, color: 'rgba(0,0,0,0.6)' }}>{shelf.code}-L{level}-{bay.toString().padStart(2, '0')}</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{hp}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="wf-row" style={{ marginTop: 16, gap: 8, justifyContent: 'flex-end' }}>
          <button className="wf-btn" onClick={() => dispatch({ type: 'closeDrill' })}>Close</button>
          <button
            className="wf-btn wf-btn--primary"
            disabled={shelf.label.reordered}
            onClick={() => { dispatch({ type: 'reorderLabel', id: shelf.id }); dispatch({ type: 'closeDrill' }); }}
          >
            <Icon name="print" size={12} /> {shelf.label.reordered ? 'Reorder queued' : 'Reorder rack labels'}
          </button>
        </div>
      </div>
    </div>
  );
}


