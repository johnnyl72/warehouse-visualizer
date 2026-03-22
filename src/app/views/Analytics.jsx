// Operational intelligence — the same map under switchable overlays, plus
// derived hotspot summary and top offenders. Read-only canvas.
import React from 'react';
import { Icon, Spark } from '../../wf-primitives.jsx';
import { statusOf } from '../../model.js';
import { useStore, useShelves, useWarehouse } from '../../store.jsx';
import WarehouseCanvas from '../WarehouseCanvas.jsx';

const LAYERS = [
  { id: 'health', label: 'Label health' },
  { id: 'failures', label: 'Scan failure density' },
  { id: 'neutral', label: 'Footprint only' },
];

// Synthetic per-hour failure curve for the sparkline — deterministic and
// static, so it lives at module scope rather than being re-built per render.
const HOURS = Array.from({ length: 15 }, (_, i) => 2 + Math.round(i * 1.1 + (i > 9 ? 6 : 0)));

export default function Analytics() {
  const { state, dispatch } = useStore();
  const shelves = useShelves();
  const wh = useWarehouse();

  // Single pass over shelves for every derived metric — Analytics re-renders
  // on every store dispatch, and these don't change unless `shelves` does.
  const derived = React.useMemo(() => {
    const failByZone = {};
    let autoMatches = 0;
    let overThreshold = 0;
    for (const s of shelves) {
      failByZone[s.zone] = (failByZone[s.zone] || 0) + s.scanFail;
      if (s.scanFail > 12 && !s.label.reordered) autoMatches++;
      if (s.scanFail > 10) overThreshold++;
    }
    let hotZone;
    let hotZoneFail = -Infinity;
    for (const [z, f] of Object.entries(failByZone)) {
      if (f > hotZoneFail) { hotZoneFail = f; hotZone = z; }
    }
    const offenders = [...shelves].sort((a, b) => b.scanFail - a.scanFail).slice(0, 6);
    return { autoMatches, overThreshold, hotZone, offenders };
  }, [shelves]);
  const { autoMatches, overThreshold, hotZone, offenders } = derived;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 280px', height: '100%' }}>
      <div style={{ borderRight: '1px solid var(--wf-line)', padding: 20, background: '#fcfbf8', overflow: 'auto' }}>
        <div className="wf-row" style={{ gap: 6, fontSize: 11, color: 'var(--wf-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
          Analytics
          <span style={{ color: 'var(--wf-mute-2)' }}>·</span>
          <span className="wf-mono" style={{ color: 'var(--wf-ink-2)' }}>{wh.id}</span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 16 }}>{wh.name}</div>
        <div style={{ fontSize: 11, color: 'var(--wf-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Overlays</div>
        <div role="radiogroup" aria-label="Map overlay" className="wf-col" style={{ marginTop: 12, gap: 6 }}>
          {LAYERS.map((l) => {
            const on = state.overlay === l.id;
            return (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => dispatch({ type: 'setOverlay', overlay: l.id })}
                className="wf-row"
                style={{
                  padding: '8px 10px', border: '1px solid var(--wf-line)', borderRadius: 8,
                  background: on ? '#fff' : 'transparent', justifyContent: 'space-between',
                  cursor: 'pointer', font: 'inherit', textAlign: 'left',
                }}
              >
                <span className="wf-row" style={{ gap: 8 }}>
                  <span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: 4, background: on ? 'var(--wf-ink)' : 'var(--wf-tint-2)', display: 'grid', placeItems: 'center' }}>
                    {on && <Icon name="check" size={10} stroke="#fff" />}
                  </span>
                  <span style={{ fontSize: 12 }}>{l.label}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="wf-card" style={{ padding: 14, marginTop: 18 }}>
          <div style={{ fontSize: 10, color: 'var(--wf-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Failures per hour</div>
          <Spark width={210} height={50} data={HOURS} color="var(--wf-bad)" />
          <div className="wf-row" style={{ marginTop: 8, justifyContent: 'space-between', fontSize: 11, color: 'var(--wf-mute)' }}>
            <span>00:00</span><span>peak 14:00</span><span>23:59</span>
          </div>
        </div>

        {/* automation rule */}
        <div className="wf-card" style={{ padding: 14, marginTop: 14 }}>
          <div className="wf-row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--wf-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Automation</span>
            <button
              type="button"
              role="switch"
              aria-checked={state.autoRule}
              aria-label="Auto-reorder when scan-fail exceeds 12%"
              onClick={() => dispatch({ type: 'setAutoRule', on: !state.autoRule })}
              style={{ width: 34, height: 20, borderRadius: 10, background: state.autoRule ? 'var(--wf-ok)' : 'var(--wf-tint-2)', position: 'relative', cursor: 'pointer', transition: 'background .15s', border: 0, padding: 0 }}
            >
              <span aria-hidden="true" style={{ position: 'absolute', top: 2, left: state.autoRule ? 16 : 2, width: 16, height: 16, borderRadius: 8, background: '#fff', transition: 'left .15s' }} />
            </button>
          </div>
          <div style={{ fontSize: 12, marginTop: 8, lineHeight: 1.4 }}>
            Auto-reorder labels when scan-fail exceeds <span className="wf-mono">12%</span>.
          </div>
          <div style={{ fontSize: 11, color: 'var(--wf-mute)', marginTop: 6 }}>
            {autoMatches} {autoMatches === 1 ? 'shelf' : 'shelves'} currently match
          </div>
          <button
            className="wf-btn"
            style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}
            disabled={autoMatches === 0}
            onClick={() => dispatch({ type: 'runAutomation' })}
          >
            Run rule now
          </button>
        </div>
      </div>

      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <WarehouseCanvas readOnly />
      </div>

      <div style={{ borderLeft: '1px solid var(--wf-line)', padding: 20, background: '#fcfbf8', overflow: 'auto' }}>
        <div style={{ fontSize: 11, color: 'var(--wf-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Hotspot summary</div>
        <div className="wf-row" style={{ gap: 8, marginTop: 12 }}>
          <Icon name="flame" size={14} stroke="var(--wf-bad)" />
          <div style={{ fontSize: 13, fontWeight: 600 }}>Zone {hotZone}</div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--wf-mute)', marginTop: 4 }}>{overThreshold} shelves above 10% scan-fail</div>

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 11, color: 'var(--wf-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Top offenders</div>
          {offenders.map((s) => (
            <div key={s.id} className="wf-row" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--wf-line)', fontSize: 12 }}>
              <button
                type="button"
                className="wf-mono"
                title={`Open ${s.code} on the map`}
                onClick={() => { dispatch({ type: 'navigate', view: 'map' }); dispatch({ type: 'selectShelf', id: s.id }); }}
                style={{ cursor: 'pointer', border: 0, background: 'transparent', font: 'inherit', padding: 0, color: 'var(--wf-ink)', textDecoration: 'underline dotted', textAlign: 'left' }}
              >
                {s.code}
              </button>
              <span style={{ color: statusOf(s.health) === 'bad' ? 'var(--wf-bad)' : 'var(--wf-warn)' }}>{s.scanFail}% fail</span>
            </div>
          ))}
        </div>
        <button
          className="wf-btn wf-btn--primary"
          style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}
          onClick={() => offenders.filter((s) => !s.label.reordered).forEach((s) => dispatch({ type: 'reorderLabel', id: s.id, auto: true }))}
        >
          Create maintenance batch
        </button>
      </div>
    </div>
  );
}




