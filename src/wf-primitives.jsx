import React from 'react';

// ─────────────────────────────────────────────────────────────────────────
// Shared wireframe primitives: icons, frame chrome, shelf grid, etc.
// All components are exposed via Object.assign(window, ...) at bottom.
// ─────────────────────────────────────────────────────────────────────────

// Minimal stroke icons (Tabler-ish but original — single-stroke shapes only).
function Icon({ name, size = 18, stroke = 'currentColor', strokeWidth = 1.5 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke,
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  switch (name) {
    case 'map':
      return (
        <svg {...common}>
          <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
          <path d="M9 4v16M15 6v16" />
        </svg>
      );
    case 'grid':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case 'tag':
      return (
        <svg {...common}>
          <path d="M3 12l9-9 9 9-9 9z" />
          <circle cx="15" cy="9" r="1" />
        </svg>
      );
    case 'chart':
      return (
        <svg {...common}>
          <path d="M4 20V8M10 20V4M16 20v-8M22 20H2" />
        </svg>
      );
    case 'wrench':
      return (
        <svg {...common}>
          <path d="M14 6a4 4 0 1 0 4 4l3 3-2 2-3-3a4 4 0 0 1-4-4z" />
          <path d="M14 10l-9 9-2-2 9-9" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
        </svg>
      );
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6" />
          <path d="M20 20l-4-4" />
        </svg>
      );
    case 'bell':
      return (
        <svg {...common}>
          <path d="M6 9a6 6 0 1 1 12 0v4l2 3H4l2-3z" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case 'filter':
      return (
        <svg {...common}>
          <path d="M3 5h18l-7 9v6l-4-2v-4z" />
        </svg>
      );
    case 'arrow-right':
      return (
        <svg {...common}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      );
    case 'arrow-down':
      return (
        <svg {...common}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      );
    case 'arrow-up-right':
      return (
        <svg {...common}>
          <path d="M7 17L17 7M9 7h8v8" />
        </svg>
      );
    case 'edit':
      return (
        <svg {...common}>
          <path d="M4 20h4l11-11-4-4L4 16z" />
        </svg>
      );
    case 'eye':
      return (
        <svg {...common}>
          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      );
    case 'building':
      return (
        <svg {...common}>
          <rect x="4" y="3" width="16" height="18" rx="1" />
          <path d="M9 8h2M9 12h2M9 16h2M13 8h2M13 12h2M13 16h2" />
        </svg>
      );
    case 'home':
      return (
        <svg {...common}>
          <path d="M3 12l9-8 9 8v9H3z" />
          <path d="M10 21v-6h4v6" />
        </svg>
      );
    case 'layers':
      return (
        <svg {...common}>
          <path d="M12 3l9 5-9 5-9-5z" />
          <path d="M3 13l9 5 9-5M3 17l9 5 9-5" />
        </svg>
      );
    case 'history':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case 'print':
      return (
        <svg {...common}>
          <path d="M6 9V3h12v6" />
          <rect x="4" y="9" width="16" height="9" rx="1" />
          <rect x="7" y="14" width="10" height="6" />
        </svg>
      );
    case 'box':
      return (
        <svg {...common}>
          <path d="M3 7l9-4 9 4-9 4z" />
          <path d="M3 7v10l9 4 9-4V7M12 11v10" />
        </svg>
      );
    case 'check':
      return (
        <svg {...common}>
          <path d="M5 12l5 5L20 7" />
        </svg>
      );
    case 'x':
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      );
    case 'dots':
      return (
        <svg {...common}>
          <circle cx="6" cy="12" r="1" fill="currentColor" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
          <circle cx="18" cy="12" r="1" fill="currentColor" />
        </svg>
      );
    case 'minus':
      return (
        <svg {...common}>
          <path d="M5 12h14" />
        </svg>
      );
    case 'cursor':
      return (
        <svg {...common}>
          <path d="M5 3l5 16 2-7 7-2z" />
        </svg>
      );
    case 'rect':
      return (
        <svg {...common}>
          <rect x="4" y="6" width="16" height="12" rx="1" />
        </svg>
      );
    case 'aisle':
      return (
        <svg {...common}>
          <path d="M4 4h16M4 20h16" />
          <path d="M8 8h2v8H8zM14 8h2v8h-2z" />
        </svg>
      );
    case 'flame':
      return (
        <svg {...common}>
          <path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4-1 4 1 5 1 5s-1-4 2-6c0 2 1 3 1 5" />
        </svg>
      );
    case 'pin':
      return (
        <svg {...common}>
          <path d="M12 21s-7-7-7-12a7 7 0 0 1 14 0c0 5-7 12-7 12z" />
          <circle cx="12" cy="9" r="2.5" />
        </svg>
      );
    case 'truck':
      return (
        <svg {...common}>
          <rect x="2" y="7" width="12" height="9" />
          <path d="M14 10h4l3 3v3h-7z" />
          <circle cx="7" cy="18" r="2" />
          <circle cx="17" cy="18" r="2" />
        </svg>
      );
    case 'snowflake':
      return (
        <svg {...common}>
          <path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" />
        </svg>
      );
    default:
      return <svg {...common} />;
  }
}

// Left sidebar with module icons — mode toggle lives in the topbar.
function SideNav({ active = 'map' }) {
  const items = [
    { id: 'home', icon: 'home', label: 'Home' },
    { id: 'map', icon: 'map', label: 'Warehouse Map' },
    { id: 'tag', icon: 'tag', label: 'Labels' },
    { id: 'chart', icon: 'chart', label: 'Analytics' },
    { id: 'wrench', icon: 'wrench', label: 'Maintenance' },
  ];
  return (
    <div className="wf-side">
      <div className="wf-side__logo">W</div>
      {items.map((it) => (
        <div key={it.id} className={`wf-side__btn ${active === it.id ? 'is-active' : ''}`}>
          <Icon name={it.icon} size={18} />
        </div>
      ))}
      <div className="wf-side__spacer" />
      <div className="wf-side__btn">
        <Icon name="settings" size={18} />
      </div>
    </div>
  );
}

// Top bar — breadcrumb on the left, mode toggle in the centre/right,
// utility icons on the far right.
function TopBar({ crumbs = [], mode = null, onMode, right = null }) {
  return (
    <div className="wf-top">
      <div className="wf-top__crumb">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span style={{ opacity: 0.4 }}>/</span>}
            {i === crumbs.length - 1 ? <b>{c}</b> : <span>{c}</span>}
          </React.Fragment>
        ))}
      </div>
      <div className="wf-top__spacer" />
      {mode && (
        <div className="wf-mode" style={{ marginRight: 12 }}>
          <span className={`wf-mode__opt ${mode === 'edit' ? 'is-on' : ''}`}>
            <Icon name="edit" size={13} /> Edit
          </span>
          <span className={`wf-mode__opt ${mode === 'monitor' ? 'is-on' : ''}`}>
            <Icon name="eye" size={13} /> Monitor
          </span>
        </div>
      )}
      {right}
      <div className="wf-row" style={{ gap: 4, color: 'var(--wf-mute)' }}>
        <div style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          <Icon name="search" size={16} />
        </div>
        <div style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          <Icon name="bell" size={16} />
        </div>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            background: '#c7c2b8',
            marginLeft: 4,
          }}
        />
      </div>
    </div>
  );
}

// Wraps the standard frame; child is rendered into .wf-main.
function Frame({ active, crumbs, mode, right, children, noSide, noTop }) {
  const cls = [
    'wf-frame',
    noSide ? 'wf-frame--no-side' : '',
    noTop ? 'wf-frame--no-top' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls}>
      {!noSide && <SideNav active={active} />}
      {!noTop && <TopBar crumbs={crumbs} mode={mode} right={right} />}
      <div className="wf-main">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Procedural shelf grid — a realistic-looking warehouse map.
// Renders zones with background tint, then aisles of shelves.
// Each shelf gets a deterministic health (seeded from coords) so the
// heatmap looks the same across reloads.
// ─────────────────────────────────────────────────────────────────────────
function rng(seed) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 1000) / 1000;
  };
}

// One configurable grid. Returns absolute-positioned divs.
function WarehouseGrid({
  width = 900,
  height = 540,
  showLabels = true,
  showZoneFills = true,
  hotspot = null, // {x,y,r}
  selected = null, // {aisle, rack}
  onShelf,
  seed = 7,
  mode = 'health', // 'health' | 'failures' | 'neutral'
}) {
  const r = rng(seed);
  // 6 zones across the warehouse
  const zones = [
    { id: 'A', label: 'A · Receiving', x: 30, y: 30, w: 260, h: 210, tint: '#eef0e5' },
    { id: 'B', label: 'B · Bulk Storage', x: 310, y: 30, w: 360, h: 210, tint: '#eaeae1' },
    { id: 'C', label: 'C · Cold Storage', x: 690, y: 30, w: 180, h: 210, tint: '#e2eaeb' },
    { id: 'D', label: 'D · Pick & Pack', x: 30, y: 260, w: 360, h: 250, tint: '#f0ece2' },
    { id: 'E', label: 'E · Returns', x: 410, y: 260, w: 220, h: 250, tint: '#ecebe5' },
    { id: 'F', label: 'F · Shipping', x: 650, y: 260, w: 220, h: 250, tint: '#e9ebe3' },
  ];

  const shelves = [];
  // Build aisles inside each zone — vertical pairs of racks.
  zones.forEach((z, zi) => {
    const aisles = z.id === 'C' ? 2 : z.id === 'A' ? 3 : 4;
    const aisleW = (z.w - 40) / aisles;
    const racksPerAisle = z.id === 'A' ? 5 : z.id === 'C' ? 6 : 7;
    const rackH = (z.h - 50) / racksPerAisle;
    for (let a = 0; a < aisles; a++) {
      for (let k = 0; k < racksPerAisle; k++) {
        const x = z.x + 20 + a * aisleW + 4;
        const y = z.y + 28 + k * rackH;
        const w = aisleW - 12;
        const h = rackH - 6;
        const v = r();
        let cls = 'wf-shelf';
        if (mode === 'neutral') {
          cls += ' wf-shelf--idle';
        } else {
          // health distribution: 70% ok, 22% warn, 8% bad — biased per zone
          const bias = z.id === 'D' ? 0.25 : z.id === 'F' ? 0.18 : 0.08;
          const wbias = z.id === 'D' ? 0.3 : 0.22;
          const t = v;
          if (t < bias) cls += ' wf-shelf--bad';
          else if (t < bias + wbias) cls += ' wf-shelf--warn';
          else cls += ' wf-shelf--ok';
        }
        const isSel =
          selected && selected.zone === z.id && selected.aisle === a && selected.rack === k;
        if (isSel) cls += ' wf-shelf--sel';
        shelves.push({ x, y, w, h, cls, id: `${z.id}-${a + 1}-${(k + 1).toString().padStart(2, '0')}`, zone: z.id });
      }
    }
  });

  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        background:
          'repeating-linear-gradient(0deg, transparent 0 23px, rgba(0,0,0,0.025) 23px 24px), repeating-linear-gradient(90deg, transparent 0 23px, rgba(0,0,0,0.025) 23px 24px), #fbfaf8',
        borderRadius: 8,
        border: '1px solid var(--wf-line)',
        overflow: 'hidden',
      }}
    >
      {/* zone fills */}
      {showZoneFills &&
        zones.map((z) => (
          <div
            key={z.id}
            style={{
              position: 'absolute',
              left: z.x,
              top: z.y,
              width: z.w,
              height: z.h,
              background: z.tint,
              borderRadius: 4,
              border: '1px dashed rgba(0,0,0,0.08)',
            }}
          />
        ))}
      {/* zone labels */}
      {showLabels &&
        zones.map((z) => (
          <div
            key={z.id + 'l'}
            style={{
              position: 'absolute',
              left: z.x + 10,
              top: z.y + 8,
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--wf-mute)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            {z.label}
          </div>
        ))}
      {/* hotspot wash */}
      {hotspot && (
        <div
          style={{
            position: 'absolute',
            left: hotspot.x - hotspot.r,
            top: hotspot.y - hotspot.r,
            width: hotspot.r * 2,
            height: hotspot.r * 2,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(192,70,58,0.35) 0%, rgba(192,70,58,0.15) 40%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
      )}
      {/* shelves */}
      {shelves.map((s, i) => (
        <div
          key={i}
          className={s.cls}
          title={s.id}
          onClick={() => onShelf && onShelf(s)}
          style={{
            position: 'absolute',
            left: s.x,
            top: s.y,
            width: s.w,
            height: s.h,
          }}
        />
      ))}
    </div>
  );
}

// Compact shelf hover tooltip — used inline beside the map.
function ShelfTooltip({ style }) {
  return (
    <div
      className="wf-card"
      style={{
        position: 'absolute',
        width: 240,
        padding: 14,
        boxShadow: '0 12px 32px rgba(0,0,0,0.10)',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="wf-mono" style={{ fontSize: 12, fontWeight: 600 }}>
          SHELF-D-03-04
        </div>
        <span className="wf-pill wf-pill--warn">Aging</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--wf-mute)', marginTop: 2 }}>
        Pick &amp; Pack · Aisle 3
      </div>
      <hr className="wf-hr" style={{ margin: '10px 0' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
        <div>
          <div style={{ color: 'var(--wf-mute)' }}>Label health</div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>72 / 100</div>
        </div>
        <div>
          <div style={{ color: 'var(--wf-mute)' }}>Scan fail rate</div>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--wf-warn)' }}>18 %</div>
        </div>
        <div>
          <div style={{ color: 'var(--wf-mute)' }}>Last replaced</div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Apr 10, 2026</div>
        </div>
        <div>
          <div style={{ color: 'var(--wf-mute)' }}>SKUs</div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>34</div>
        </div>
      </div>
      <div className="wf-row" style={{ marginTop: 12, gap: 6 }}>
        <button className="wf-btn wf-btn--primary" style={{ flex: 1, justifyContent: 'center' }}>
          Reorder label
        </button>
        <button className="wf-btn" style={{ padding: '6px 8px' }}>
          <Icon name="dots" size={14} />
        </button>
      </div>
    </div>
  );
}

// Mini stat tile.
function Stat({ label, value, delta, deltaTone = 'mute' }) {
  const tone =
    deltaTone === 'ok'
      ? 'var(--wf-ok)'
      : deltaTone === 'bad'
      ? 'var(--wf-bad)'
      : 'var(--wf-mute)';
  return (
    <div className="wf-card" style={{ padding: 14 }}>
      <div style={{ fontSize: 11, color: 'var(--wf-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6, letterSpacing: '-0.02em' }}>
        {value}
      </div>
      {delta && (
        <div style={{ fontSize: 11, color: tone, marginTop: 4 }}>{delta}</div>
      )}
    </div>
  );
}

// Sparkline (super low-fi).
function Spark({ data = [4, 5, 3, 6, 5, 7, 6, 8, 7, 9, 8, 10], width = 100, height = 28, color = '#4a4844' }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  const d = data
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${height - ((v - min) / span) * (height - 4) - 2}`)
    .join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <path d={d} stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" />
    </svg>
  );
}

// Hand-drawn margin note (yellow post-it).
function Note({ children, top, left, right, bottom, rotate = -2, width }) {
  return (
    <div
      className="wf-callout"
      style={{
        top,
        left,
        right,
        bottom,
        transform: `rotate(${rotate}deg)`,
        width,
        maxWidth: 220,
      }}
    >
      {children}
    </div>
  );
}

export {
  Icon,
  SideNav,
  TopBar,
  Frame,
  WarehouseGrid,
  ShelfTooltip,
  Stat,
  Spark,
  Note,
};

export { rng };



