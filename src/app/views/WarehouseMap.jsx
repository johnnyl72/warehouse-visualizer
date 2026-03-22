// Operations map (Monitor). The operator's primary live view of a single
// warehouse. Two levels:
//   • Warehouse level — full floor with all zones; the zone-rail at the
//     top gives each zone a live KPI card; either the card or the
//     in-canvas zone badge focuses a zone.
//   • Zone level — handed off to ZoneView for a focused canvas + shelf
//     list + open task summary for that zone.
import React from 'react';
import { ZONES, statusOf, summarizeZone } from '../../model.js';
import { useStore, useShelves, useTasks, useWarehouse } from '../../store.jsx';
import WarehouseCanvas from '../WarehouseCanvas.jsx';
import ShelfDrawer from '../ShelfDrawer.jsx';
import ZoneView from './ZoneView.jsx';

function ZoneCard({ z, summary, onOpen }) {
  // The mini-card mirrors what's on the canvas: each zone has a name, a
  // health pill, and a couple of one-glance numbers. Tone follows the
  // worst-thing-first rule so red beats amber beats green.
  const tone = summary.bad > 0 ? 'bad' : summary.warn > 0 ? 'warn' : 'ok';
  return (
    <button
      type="button"
      className="wf-zonecard"
      onClick={onOpen}
      aria-label={`Open ${z.label}`}
      style={{ minWidth: 168, display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      <div className="wf-row" style={{ justifyContent: 'space-between' }}>
        <span className="wf-zonecard__title">{z.label.split(' · ')[1] || z.label}</span>
        <span className={`wf-pill wf-pill--${tone}`} style={{ fontSize: 10 }}>
          {summary.bad > 0 ? `${summary.bad} replace` : summary.warn > 0 ? `${summary.warn} aging` : 'Healthy'}
        </span>
      </div>
      <div className="wf-zonecard__meta wf-row" style={{ justifyContent: 'space-between' }}>
        <span>
          {summary.total} shelves{summary.empty > 0 ? ` · ${summary.empty} empty` : ''}
        </span>
        <span>Avg {summary.avg}</span>
        <span style={{ color: summary.fail > 4 ? 'var(--wf-bad)' : 'var(--wf-mute)' }}>{summary.fail}% fail</span>
      </div>
    </button>
  );
}

function ZoneRail({ summaries }) {
  const { dispatch } = useStore();
  return (
    <div
      role="list"
      aria-label="Zones"
      style={{
        position: 'absolute', left: 16, right: 16, top: 12,
        display: 'flex', gap: 8, overflowX: 'auto', zIndex: 8,
        padding: '2px 0', scrollbarWidth: 'thin',
      }}
    >
      {summaries.map(({ zone, ...summary }) => (
        <ZoneCard
          key={zone.id}
          z={zone}
          summary={summary}
          onOpen={() => dispatch({ type: 'focusZone', id: zone.id })}
        />
      ))}
    </div>
  );
}

function StatusBar({ count, wh, healthy, warning, replace }) {
  return (
    <div
      className="wf-card"
      style={{
        position: 'absolute', left: '50%', transform: 'translateX(-50%)',
        bottom: 18, padding: '8px 14px', display: 'flex', alignItems: 'center',
        gap: 12, fontSize: 12, zIndex: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
      }}
    >
      <span className="wf-mono" style={{ color: 'var(--wf-mute)', fontSize: 11 }}>{wh.id}</span>
      <span style={{ width: 1, height: 14, background: 'var(--wf-line)' }} />
      <span className="wf-pill">{count} shelves</span>
      <span className="wf-pill wf-pill--ok">{healthy} healthy</span>
      <span className="wf-pill wf-pill--warn">{warning} aging</span>
      <span className="wf-pill wf-pill--bad">{replace} replace</span>
      <span style={{ width: 1, height: 14, background: 'var(--wf-line)' }} />
      <span style={{ color: 'var(--wf-mute)' }}>Click a zone to drill in · hover a shelf for a glance · scroll to zoom</span>
    </div>
  );
}

export default function WarehouseMap() {
  const { state } = useStore();
  const shelves = useShelves();
  const tasks = useTasks();
  const wh = useWarehouse();

  // When a zone is focused, hand the entire surface to ZoneView — it owns
  // its own layout (left rail + focused canvas + optional drawer).
  if (state.focusedZoneId) {
    return <ZoneView zoneId={state.focusedZoneId} />;
  }

  // Pre-compute per-zone summaries once; the rail and the canvas both use
  // these so the cards and the floor always agree.
  const summaries = React.useMemo(
    () => ZONES.map((z) => summarizeZone(z.id, shelves)),
    [shelves],
  );
  const counts = React.useMemo(() => {
    const out = { healthy: 0, warning: 0, replace: 0 };
    for (const s of shelves) {
      const t = statusOf(s.health);
      if (t === 'ok') out.healthy++;
      else if (t === 'warn') out.warning++;
      else if (t === 'bad') out.replace++;
    }
    return out;
  }, [shelves]);
  const openTasks = React.useMemo(
    () => tasks.reduce((n, t) => n + (t.status !== 'done' ? 1 : 0), 0),
    [tasks],
  );

  const showDrawer = !!state.selectedId;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: showDrawer ? '1fr 380px' : '1fr', height: '100%' }}>
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <ZoneRail summaries={summaries} />
        <WarehouseCanvas surface="monitor" zonesClickable />
        {openTasks > 0 && (
          <div
            className="wf-card"
            style={{
              position: 'absolute', right: 16, top: 78, padding: '6px 10px',
              fontSize: 11, color: 'var(--wf-mute)', zIndex: 8,
              boxShadow: '0 6px 20px rgba(0,0,0,0.05)',
            }}
            aria-live="polite"
          >
            <span className="wf-pill wf-pill--warn" style={{ fontSize: 10 }}>{openTasks} open</span>
            <span style={{ marginLeft: 8 }}>maintenance task{openTasks === 1 ? '' : 's'} at {wh.name}</span>
          </div>
        )}
        <StatusBar count={shelves.length} wh={wh} healthy={counts.healthy} warning={counts.warning} replace={counts.replace} />
      </div>
      {showDrawer && <ShelfDrawer />}
    </div>
  );
}



