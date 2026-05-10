// Label registry — every shelf's label with lifecycle status. Filter tabs
// scope the table; Reorder queues a print + maintenance task (store action).
import React from 'react';
import { Icon } from '../../wf-primitives.jsx';
import { statusOf, LABEL_STATE, ZONE_BY_ID } from '../../model.js';
import { useStore, useShelves, useWarehouse } from '../../store.jsx';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'healthy', label: 'Healthy' },
  { id: 'aging', label: 'Aging' },
  { id: 'replace', label: 'Replace soon' },
];

// Shared grid template — header and rows must stay in lockstep, so name it once.
const GRID = '1.1fr 0.9fr 1fr 0.6fr 0.8fr 0.8fr 0.8fr';
const STATE_LABEL = { ok: 'Healthy', warn: 'Aging', bad: 'Replace' };

export default function Labels() {
  const { dispatch } = useStore();
  const shelves = useShelves();
  const wh = useWarehouse();
  const [tab, setTab] = React.useState('all');

  const { counts, rows } = React.useMemo(() => {
    const c = { healthy: 0, aging: 0, replace: 0 };
    const enriched = shelves.map((s) => {
      const lstate = LABEL_STATE[statusOf(s.health)];
      c[lstate] = (c[lstate] || 0) + 1;
      return { ...s, lstate };
    });
    const r = enriched
      .filter((s) => tab === 'all' || s.lstate === tab)
      .sort((a, b) => a.health - b.health);
    return { counts: c, rows: r };
  }, [shelves, tab]);

  const openShelf = (id) => {
    dispatch({ type: 'navigate', view: 'map' });
    dispatch({ type: 'selectShelf', id });
  };

  return (
    <div style={{ padding: 24, height: '100%', overflow: 'auto' }}>
      <div className="wf-row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div className="wf-row" style={{ gap: 8, fontSize: 11, color: 'var(--wf-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Label registry
            <span style={{ color: 'var(--wf-mute-2)' }}>·</span>
            <span className="wf-mono" style={{ color: 'var(--wf-ink-2)' }}>{wh.id}</span>
            <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--wf-ink-2)' }}>{wh.name}</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 2 }}>
            {shelves.length} labels
          </div>
        </div>
      </div>

      <div role="tablist" aria-label="Label status filter" className="wf-row" style={{ gap: 4, marginBottom: 14, borderBottom: '1px solid var(--wf-line)' }}>
        {TABS.map((t) => {
          const n = t.id === 'all' ? shelves.length : counts[t.id] || 0;
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.id)}
              style={{
                padding: '10px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                color: on ? 'var(--wf-ink)' : 'var(--wf-mute)',
                borderTop: 0, borderLeft: 0, borderRight: 0,
                borderBottom: on ? '2px solid var(--wf-ink)' : '2px solid transparent',
                background: 'transparent', font: 'inherit',
              }}
            >
              {t.label}
              <span className="wf-mono" style={{ marginLeft: 6, fontSize: 10, color: 'var(--wf-mute)' }}>{n}</span>
            </button>
          );
        })}
      </div>

      <div className="wf-card" style={{ padding: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, padding: '10px 14px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--wf-mute)', borderBottom: '1px solid var(--wf-line)' }}>
          <div>Label ID</div><div>Shelf</div><div>Zone</div><div>Age</div><div>Health</div><div>Scan fail</div><div>Status</div>
        </div>
        {rows.map((s) => {
          const st = statusOf(s.health);
          return (
            <div key={s.id} style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, padding: '12px 14px', borderBottom: '1px solid var(--wf-line)', alignItems: 'center', fontSize: 12 }}>
              <button
                type="button"
                onClick={() => openShelf(s.id)}
                title={`Open ${s.code} on the map`}
                className="wf-mono"
                style={{
                  fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                  border: 0, background: 'transparent', font: 'inherit', padding: 0,
                  color: 'var(--wf-ink)', textDecoration: 'underline dotted',
                }}
              >
                {s.label.id}
              </button>
              <div className="wf-mono" style={{ color: 'var(--wf-ink-2)' }}>{s.code}</div>
              <div>{(ZONE_BY_ID[s.zone] && ZONE_BY_ID[s.zone].label.split(' · ')[1]) || s.zone}</div>
              <div>{s.lastReplacedDays}d</div>
              <div className="wf-row" style={{ gap: 6 }}>
                <div style={{ width: 44, height: 4, borderRadius: 2, background: 'var(--wf-tint-2)', overflow: 'hidden' }}>
                  <div style={{ width: `${s.health}%`, height: '100%', background: `var(--wf-${st})` }} />
                </div>
                <span className="wf-mono" style={{ fontSize: 11 }}>{s.health}</span>
              </div>
              <div className="wf-mono" style={{ fontSize: 11, color: s.scanFail > 10 ? 'var(--wf-bad)' : s.scanFail > 4 ? 'var(--wf-warn)' : 'var(--wf-ink-2)' }}>{s.scanFail}%</div>
              <div className="wf-row" style={{ justifyContent: 'space-between', gap: 8 }}>
                <span className={`wf-pill wf-pill--${st}`}>{STATE_LABEL[st]}</span>
                <button
                  className="wf-btn"
                  style={{ padding: '4px 8px' }}
                  disabled={s.label.reordered}
                  onClick={() => dispatch({ type: 'reorderLabel', id: s.id })}
                >
                  <Icon name="print" size={11} /> {s.label.reordered ? 'Queued' : 'Reorder'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}




