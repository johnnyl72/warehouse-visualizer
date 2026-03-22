// Maintenance queue — scoped to the active warehouse. Reorder actions from
// the map / labels registry land here; completing a task "installs" the new
// label so the source shelf's health resets in the reducer. Switching the
// warehouse in the top bar swaps the queue underneath.
import React from 'react';
import { Icon, Stat } from '../../wf-primitives.jsx';
import { ZONE_BY_ID } from '../../model.js';
import { useStore, useTasks, useWarehouse } from '../../store.jsx';

const PRIO = { high: ['bad', 'High'], med: ['warn', 'Med'], low: ['ok', 'Low'] };

function Row({ t, onDone, onOpenShelf }) {
  const [tone, txt] = PRIO[t.prio] || PRIO.med;
  const done = t.status === 'done';
  const zoneLabel = t.zone && ZONE_BY_ID[t.zone] ? ZONE_BY_ID[t.zone].label.split(' · ')[1] : null;
  return (
    <div
      style={{
        display: 'grid', gridTemplateColumns: '24px 1fr auto auto auto', gap: 14,
        padding: '12px 16px', borderTop: '1px solid var(--wf-line)', alignItems: 'center',
        opacity: done ? 0.55 : 1,
        borderLeft: `3px solid ${done ? 'transparent' : t.prio === 'high' ? 'var(--wf-bad)' : t.prio === 'low' ? 'var(--wf-ok)' : 'var(--wf-warn)'}`,
      }}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Completed: ${t.title}` : `Mark complete: ${t.title}`}
        disabled={done}
        onClick={() => !done && onDone(t.id)}
        title={done ? 'Completed' : 'Mark complete'}
        style={{
          width: 18, height: 18, borderRadius: 9, cursor: done ? 'default' : 'pointer',
          border: done ? 'none' : '1.5px solid var(--wf-line-2)',
          background: done ? 'var(--wf-ok)' : 'transparent',
          display: 'grid', placeItems: 'center', padding: 0,
        }}
      >
        {done && <Icon name="check" size={11} stroke="#fff" strokeWidth={2.4} />}
      </button>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, textDecoration: done ? 'line-through' : 'none' }}>{t.title}</div>
        <div className="wf-row" style={{ gap: 8, marginTop: 3, fontSize: 11, color: 'var(--wf-mute)' }}>
          <span className="wf-mono">{t.id}</span><span>·</span>
          <button
            type="button"
            onClick={() => onOpenShelf(t.shelf)}
            className="wf-mono"
            style={{ border: 0, background: 'transparent', font: 'inherit', color: 'var(--wf-ink-2)', padding: 0, cursor: 'pointer', textDecoration: 'underline dotted' }}
          >
            {t.shelf}
          </button>
          {zoneLabel && (<><span>·</span><span>Zone {t.zone} · {zoneLabel}</span></>)}
          {t.auto && <><span>·</span><span>auto-generated</span></>}
        </div>
      </div>
      <span className={`wf-pill wf-pill--${tone}`}>{txt}</span>
      <span className="wf-pill">{t.status}</span>
      {!done ? (
        <button className="wf-btn" onClick={() => onDone(t.id)}>
          <Icon name="check" size={12} /> Complete
        </button>
      ) : (
        <span style={{ width: 92 }} />
      )}
    </div>
  );
}

export default function Maintenance() {
  const { dispatch } = useStore();
  const wh = useWarehouse();
  const tasks = useTasks();
  const { open, done } = React.useMemo(() => {
    const o = [], d = [];
    for (const t of tasks) (t.status === 'done' ? d : o).push(t);
    return { open: o, done: d };
  }, [tasks]);
  const onDone = (id) => dispatch({ type: 'completeTask', id });
  const onOpenShelf = (id) => {
    dispatch({ type: 'navigate', view: 'map' });
    dispatch({ type: 'selectShelf', id });
  };

  return (
    <div style={{ padding: 24, height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div className="wf-row" style={{ gap: 8, fontSize: 11, color: 'var(--wf-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Maintenance queue
            <span style={{ color: 'var(--wf-mute-2)' }}>·</span>
            <span className="wf-mono" style={{ color: 'var(--wf-ink-2)' }}>{wh.id}</span>
            <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--wf-ink-2)' }}>{wh.name}</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 2 }}>
            {open.length} open · {done.length} completed
          </div>
        </div>
        <div className="wf-row" style={{ gap: 8 }}>
          <Stat label="Open" value={open.length} />
          <Stat label="Completed" value={done.length} deltaTone="ok" />
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--wf-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '6px 0 8px' }}>
        Open · {open.length}
      </div>
      <div className="wf-card" style={{ padding: 0 }}>
        {open.length === 0 && (
          <div style={{ padding: 20, fontSize: 13, color: 'var(--wf-mute)' }}>
            Nothing open for {wh.name}. Reorder a label from the map or label registry to create work — each warehouse has its own queue.
          </div>
        )}
        {open.map((t) => <Row key={t.id} t={t} onDone={onDone} onOpenShelf={onOpenShelf} />)}
      </div>

      {done.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: 'var(--wf-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '22px 0 8px' }}>
            Completed · {done.length}
          </div>
          <div className="wf-card" style={{ padding: 0 }}>
            {done.map((t) => <Row key={t.id} t={t} onDone={onDone} onOpenShelf={onOpenShelf} />)}
          </div>
        </>
      )}
    </div>
  );
}

