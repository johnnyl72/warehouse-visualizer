// Multi-warehouse home. Each card carries live KPIs derived from that
// warehouse's shelf set (custom layout if assigned, otherwise the seeded
// baseline) plus its open maintenance count from `tasksByWh`. Clicking a
// card opens that warehouse's Operations Map.
import React from 'react';
import { Icon, Stat } from '../../wf-primitives.jsx';
import {
  WAREHOUSES, generateShelves, statusOf, ZONES, WORLD, summarizeShelves,
} from '../../model.js';
import { useStore } from '../../store.jsx';

// True scaled-down render of the Operations Map: same ZONES and same
// shelf entities at their real positions, so the card preview matches the
// map 1:1 (coordinates expressed as % of the WORLD so it stays exact at
// any card width).
const pctX = (v) => `${(v / WORLD.w) * 100}%`;
const pctY = (v) => `${(v / WORLD.h) * 100}%`;

const MiniMap = React.memo(function MiniMap({ shelves }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'relative', width: '100%', aspectRatio: `${WORLD.w} / ${WORLD.h}`,
        marginTop: 12, background: '#fbfaf8', border: '1px solid var(--wf-line)',
        borderRadius: 6, overflow: 'hidden',
      }}
    >
      {ZONES.map((z) => (
        <div key={z.id} style={{ position: 'absolute', left: pctX(z.x), top: pctY(z.y), width: pctX(z.w), height: pctY(z.h), background: z.tint, borderRadius: 2 }} />
      ))}
      {shelves.map((s) => (
        <div
          key={s.id}
          className={`wf-shelf wf-shelf--${statusOf(s.health)}`}
          style={{
            position: 'absolute', left: pctX(s.x), top: pctY(s.y), width: pctX(s.w), height: pctY(s.h),
            borderRadius: 1,
            clipPath: s.type === 'corner' ? 'polygon(0 0,60% 0,60% 40%,100% 40%,100% 100%,0 100%)' : 'none',
          }}
        />
      ))}
    </div>
  );
});

export default function Overview() {
  const { state, dispatch } = useStore();
  const { custom, tasksByWh, warehouseId: activeWh } = state;
  // Assigned (editor-provisioned) layouts take precedence over the
  // generated baseline so the home matches what the map will show. Each
  // card also gets the live count of open tasks for that warehouse so the
  // home reflects the same maintenance queue the side nav opens.
  // Split memos so a task tick doesn't re-derive shelf summaries for all
  // six warehouses — only the openTasks count changes when tasksByWh moves.
  const bases = React.useMemo(
    () => WAREHOUSES.map((w) => {
      const shelves = custom[w.id] || generateShelves(w.seed);
      return { ...w, shelves, ...summarizeShelves(shelves), custom: !!custom[w.id] };
    }),
    [custom],
  );
  const cards = React.useMemo(
    () => bases.map((b) => ({
      ...b,
      openTasks: (tasksByWh[b.id] || []).filter((t) => t.status !== 'done').length,
    })),
    [bases, tasksByWh],
  );
  const totals = React.useMemo(() => {
    const n = cards.reduce((a, c) => a + c.n, 0);
    const open = cards.reduce((a, c) => a + c.bad, 0);
    const avg = Math.round(cards.reduce((a, c) => a + c.avg, 0) / cards.length);
    const fail = +(cards.reduce((a, c) => a + c.fail, 0) / cards.length).toFixed(1);
    const tasks = cards.reduce((a, c) => a + c.openTasks, 0);
    return { n, open, avg, fail, tasks };
  }, [cards]);

  return (
    <div style={{ padding: 28, height: '100%', overflow: 'auto' }}>
      <div style={{ fontSize: 11, color: 'var(--wf-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Portfolio
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 4 }}>
        {cards.length} warehouses · {totals.n.toLocaleString()} shelves
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 20 }}>
        <Stat label="Avg label health" value={totals.avg} />
        <Stat label="Avg scan fail" value={`${totals.fail}%`} deltaTone={totals.fail > 3 ? 'bad' : 'mute'} />
        <Stat label="Shelves needing attention" value={totals.open} deltaTone="bad" />
        <Stat label="Open maintenance" value={totals.tasks} deltaTone={totals.tasks > 0 ? 'bad' : 'mute'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 24 }}>
        {cards.map((w) => {
          const tone = w.avg >= 84 ? 'ok' : w.avg >= 74 ? 'warn' : 'bad';
          const isActive = w.id === activeWh;
          return (
            <div
              key={w.id}
              role="button"
              tabIndex={0}
              className="wf-card"
              onClick={() => dispatch({ type: 'openWarehouse', id: w.id })}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dispatch({ type: 'openWarehouse', id: w.id }); } }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
              style={{
                padding: 16, cursor: 'pointer', transition: 'box-shadow .12s, border-color .12s',
                borderColor: isActive ? 'var(--wf-ink)' : undefined,
              }}
              aria-label={`Open ${w.name}`}
            >
              <div className="wf-row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <div className="wf-row" style={{ gap: 6 }}>
                    <span className="wf-mono" style={{ fontSize: 11, color: 'var(--wf-mute)' }}>{w.id}</span>
                    {isActive && <span className="wf-pill" style={{ fontSize: 9, padding: '1px 6px', background: 'var(--wf-ink)', color: '#fbfaf8', borderColor: 'var(--wf-ink)' }}>Active</span>}
                    {w.custom && <span className="wf-pill" style={{ fontSize: 9, padding: '1px 6px' }}>Custom layout</span>}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{w.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--wf-mute)', marginTop: 2 }}>{w.region}</div>
                </div>
                <span className={`wf-pill wf-pill--${tone}`}>
                  {tone === 'ok' ? 'Healthy' : tone === 'warn' ? 'Watch' : 'Attention'}
                </span>
              </div>
              <MiniMap shelves={w.shelves} />
              {/* health distribution strip — green/amber/red proportional bar */}
              <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 8, gap: 1 }}>
                {w.ok > 0 && <div style={{ flex: w.ok, background: 'var(--wf-ok)', minWidth: 4 }} />}
                {w.warn > 0 && <div style={{ flex: w.warn, background: 'var(--wf-warn)', minWidth: 4 }} />}
                {w.bad > 0 && <div style={{ flex: w.bad, background: 'var(--wf-bad)', minWidth: 4 }} />}
              </div>
              <div className="wf-row" style={{ marginTop: 10, justifyContent: 'space-between', fontSize: 12 }}>
                {[
                  ['Health', w.avg, tone === 'ok' ? 'var(--wf-ok)' : tone === 'warn' ? 'var(--wf-warn)' : 'var(--wf-bad)'],
                  ['Attention', w.bad, w.bad > 0 ? 'var(--wf-bad)' : 'inherit'],
                  ['Scan fail', `${w.fail}%`, w.fail > 5 ? 'var(--wf-bad)' : w.fail > 2 ? 'var(--wf-warn)' : 'inherit'],
                  ['Open tasks', w.openTasks, w.openTasks > 0 ? 'var(--wf-warn)' : 'inherit'],
                ].map(([k, v, c]) => (
                  <div key={k}>
                    <div style={{ color: 'var(--wf-mute)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k}</div>
                    <div style={{ fontWeight: 600, marginTop: 2, color: c }}>{v}</div>
                  </div>
                ))}
              </div>
              <div className="wf-row" style={{ marginTop: 12, color: 'var(--wf-mute)', fontSize: 12, justifyContent: 'space-between' }}>
                <span>{w.n} shelves</span>
                <span className="wf-row" style={{ gap: 6 }}>
                  Open map <Icon name="arrow-right" size={14} />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}











