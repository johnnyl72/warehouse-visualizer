// App shell: persistent left rail, top bar (breadcrumb + warehouse switcher
// + live indicator), and the active module view. The warehouse selected in
// the top bar is the operating context for every page in the side nav —
// Map / Labels / Analytics / Maintenance all read its shelves and tasks.
import React from 'react';
import { Icon } from '../wf-primitives.jsx';
import { useStore } from '../store.jsx';
import { WAREHOUSES, ZONE_BY_ID } from '../model.js';
import Overview from './views/Overview.jsx';
import WarehouseMap from './views/WarehouseMap.jsx';
import Labels from './views/Labels.jsx';
import Analytics from './views/Analytics.jsx';
import Maintenance from './views/Maintenance.jsx';
import RackDrill from './RackDrill.jsx';

const NAV = [
  { view: 'overview', icon: 'home', label: 'Home' },
  { view: 'map', icon: 'map', label: 'Warehouse Map' },
  { view: 'labels', icon: 'tag', label: 'Labels' },
  { view: 'analytics', icon: 'chart', label: 'Analytics' },
  { view: 'maintenance', icon: 'wrench', label: 'Maintenance' },
];

const VIEWS = {
  overview: Overview,
  map: WarehouseMap,
  labels: Labels,
  analytics: Analytics,
  maintenance: Maintenance,
};

const CRUMB = {
  overview: 'Warehouses',
  map: 'Operations map',
  labels: 'Labels',
  analytics: 'Analytics',
  maintenance: 'Maintenance',
};

function SideNav() {
  const { state, dispatch } = useStore();
  return (
    <nav className="wf-side" aria-label="Primary">
      <div className="wf-side__logo" title="Acme Logistics" aria-hidden="true">W</div>
      {NAV.map((n) => (
        <button
          type="button"
          key={n.view}
          className={`wf-side__btn ${state.view === n.view ? 'is-active' : ''}`}
          aria-label={n.label}
          aria-current={state.view === n.view ? 'page' : undefined}
          onClick={() => dispatch({ type: 'navigate', view: n.view })}
        >
          <Icon name={n.icon} size={18} />
        </button>
      ))}
      <div className="wf-side__spacer" />
      <button type="button" className="wf-side__btn" aria-label="Settings">
        <Icon name="settings" size={18} />
      </button>
    </nav>
  );
}

// Compact dropdown that switches the active warehouse from any page in the
// side nav. Anchors to the breadcrumb so the active site is always one
// click away — closes on outside-click and Escape.
function WarehouseSwitcher() {
  const { state, dispatch } = useStore();
  const active = WAREHOUSES.find((w) => w.id === state.warehouseId) || WAREHOUSES[0];
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const choose = (id) => {
    setOpen(false);
    dispatch({ type: 'switchWarehouse', id });
  };

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Active warehouse: ${active.name}. Click to switch.`}
        onClick={() => setOpen((v) => !v)}
        className="wf-row"
        style={{
          gap: 6, padding: '4px 8px', border: '1px solid var(--wf-line)',
          background: open ? 'var(--wf-tint)' : '#fff', borderRadius: 6, cursor: 'pointer',
          font: 'inherit', fontSize: 12, color: 'var(--wf-ink)',
        }}
      >
        <Icon name="building" size={12} />
        <b style={{ fontWeight: 600 }}>{active.name}</b>
        <span className="wf-mono" style={{ fontSize: 10, color: 'var(--wf-mute)' }}>{active.id}</span>
        <Icon name="arrow-down" size={12} stroke="var(--wf-mute)" />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Warehouses"
          className="wf-card"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: 280,
            padding: 6, zIndex: 60, boxShadow: '0 14px 36px rgba(0,0,0,0.12)',
          }}
        >
          <div style={{ padding: '6px 10px 8px', fontSize: 10, color: 'var(--wf-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Switch warehouse
          </div>
          {WAREHOUSES.map((w) => {
            const on = w.id === state.warehouseId;
            return (
              <button
                key={w.id}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => choose(w.id)}
                className="wf-row"
                style={{
                  width: '100%', justifyContent: 'space-between', padding: '8px 10px',
                  border: 0, background: on ? 'var(--wf-tint)' : 'transparent', borderRadius: 6,
                  font: 'inherit', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: on ? 600 : 500, fontSize: 13 }}>{w.name}</span>
                  <span className="wf-mono" style={{ fontSize: 10, color: 'var(--wf-mute)' }}>{w.id} · {w.region}</span>
                </span>
                <span className={`wf-pill wf-pill--${w.tone}`} style={{ fontSize: 10 }}>
                  {w.tone === 'ok' ? 'Healthy' : w.tone === 'warn' ? 'Watch' : 'Attention'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
}

// Debug chip — shows the source file(s) backing whatever's on screen, so
// when something breaks you can paste the path straight into a bug report.
// The primary file follows the active view; any overlay/panel components
// that are also mounted are listed after it.
function SourceBadge() {
  const { state } = useStore();
  const [copied, setCopied] = React.useState(null);

  const primary = state.view === 'map' && state.focusedZoneId
    ? 'src/app/views/ZoneView.jsx'
    : ({
        overview: 'src/app/views/Overview.jsx',
        map: 'src/app/views/WarehouseMap.jsx',
        labels: 'src/app/views/Labels.jsx',
        analytics: 'src/app/views/Analytics.jsx',
        maintenance: 'src/app/views/Maintenance.jsx',
      }[state.view] || 'src/app/App.jsx');

  // Overlay components that may be layered on top of the primary view.
  // Order here mirrors visual stacking (top-most first).
  const overlays = [];
  if (state.drillId) overlays.push('src/app/RackDrill.jsx');
  if (state.selectedId) {
    // EditPanel lives inside ZoneView; ShelfDrawer is used everywhere else
    // the selection drawer opens.
    overlays.push('src/app/ShelfDrawer.jsx');
  }
  if (state.view === 'map' || state.view === 'analytics') {
    overlays.push('src/app/WarehouseCanvas.jsx');
  }

  const copy = (path) => {
    try {
      navigator.clipboard.writeText(path);
      setCopied(path);
      setTimeout(() => setCopied((c) => (c === path ? null : c)), 1200);
    } catch { /* clipboard may be blocked; non-fatal */ }
  };

  const chipStyle = (path) => ({
    padding: '3px 8px',
    border: '1px solid var(--wf-line)',
    borderRadius: 4,
    background: copied === path ? 'var(--wf-ok-bg)' : '#fff',
    color: copied === path ? 'var(--wf-ok)' : 'var(--wf-ink-2)',
    font: 'inherit',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 10,
    cursor: 'pointer',
    transition: 'background 0.12s, color 0.12s',
  });

  return (
    <div
      className="wf-row"
      style={{ gap: 4, marginRight: 12, flexWrap: 'wrap', maxWidth: 540 }}
      title="Source file(s) backing this view. Click to copy."
    >
      <span style={{ fontSize: 9, color: 'var(--wf-mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: 2 }}>
        src
      </span>
      <button type="button" style={chipStyle(primary)} onClick={() => copy(primary)}>
        {copied === primary ? '✓ copied' : primary}
      </button>
      {overlays.map((p) => (
        <button key={p} type="button" style={chipStyle(p)} onClick={() => copy(p)}>
          {copied === p ? '✓ copied' : p}
        </button>
      ))}
    </div>
  );
}

// Small pulsing "live" indicator that anchors the SaaS framing — these
// numbers update as you act, so the dot reinforces that idea.
function LiveBadge() {
  return (
    <span
      title="Live data — updates as scans, reorders, and completions occur"
      className="wf-row"
      style={{ gap: 6, fontSize: 11, color: 'var(--wf-mute)', marginRight: 8 }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 7, height: 7, borderRadius: 4, background: 'var(--wf-ok)',
          boxShadow: '0 0 0 0 rgba(70,148,90,0.6)',
          animation: 'wfPulse 1.6s ease-out infinite',
        }}
      />
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>Live</span>
    </span>
  );
}

function TopBar() {
  const { state, dispatch } = useStore();
  const onMap = state.view === 'map';
  const focusedZone = state.focusedZoneId ? ZONE_BY_ID[state.focusedZoneId] : null;
  return (
    <div className="wf-top">
      <div className="wf-top__crumb" style={{ gap: 8 }}>
        <span>Acme Logistics</span>
        <span style={{ opacity: 0.4 }}>/</span>
        <WarehouseSwitcher />
        <span style={{ opacity: 0.4 }}>/</span>
        {focusedZone && onMap ? (
          <>
            <button
              type="button"
              onClick={() => dispatch({ type: 'closeZone' })}
              className="wf-btn--ghost"
              style={{ padding: 0, border: 0, background: 'transparent', font: 'inherit', color: 'var(--wf-mute)', cursor: 'pointer' }}
            >
              {CRUMB[state.view]}
            </button>
            <span style={{ opacity: 0.4 }}>/</span>
            <b>{focusedZone.label}</b>
          </>
        ) : (
          <b>{CRUMB[state.view]}</b>
        )}
      </div>
      <div className="wf-top__spacer" />
      <SourceBadge />
      <LiveBadge />
      <div className="wf-row" style={{ gap: 4, color: 'var(--wf-mute)' }}>
        <div style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          <Icon name="search" size={16} />
        </div>
        <div style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          <Icon name="bell" size={16} />
        </div>
        <div style={{ width: 28, height: 28, borderRadius: 14, background: '#c7c2b8', marginLeft: 4 }} />
      </div>
    </div>
  );
}

function Toast() {
  const { state, dispatch } = useStore();
  if (!state.toast) return null;
  const t = state.toast;
  const color = t.kind === 'bad' ? 'var(--wf-bad)' : t.kind === 'ok' ? 'var(--wf-ok)' : 'var(--wf-ink)';
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      onClick={() => dispatch({ type: 'dismissToast' })}
      className="wf-card"
      style={{
        position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)',
        zIndex: 200, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
        fontSize: 13, fontWeight: 500, boxShadow: '0 12px 32px rgba(0,0,0,0.16)', cursor: 'pointer',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 4, background: color }} />
      {t.msg}
    </div>
  );
}

export default function App() {
  const { state } = useStore();
  const View = VIEWS[state.view] || Overview;
  return (
    <div className="wf-frame" style={{ height: '100vh' }}>
      <SideNav />
      <TopBar />
      <div className="wf-main">
        <View />
      </div>
      {state.drillId && <RackDrill />}
      <Toast />
    </div>
  );
}






