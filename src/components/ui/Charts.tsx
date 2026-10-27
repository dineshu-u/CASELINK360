import React from 'react';
import { Link } from 'react-router-dom';

export interface ChartSegment {
  label: string;
  value: number;
  color: string;
  to?: string;
  sub?: string;
}

function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutArcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number
): string {
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  const so = polarPoint(cx, cy, rOuter, startAngle);
  const eo = polarPoint(cx, cy, rOuter, endAngle);
  const si = polarPoint(cx, cy, rInner, endAngle);
  const ei = polarPoint(cx, cy, rInner, startAngle);
  return [
    `M ${so.x.toFixed(2)} ${so.y.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${eo.x.toFixed(2)} ${eo.y.toFixed(2)}`,
    `L ${si.x.toFixed(2)} ${si.y.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${ei.x.toFixed(2)} ${ei.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

export const DonutChart: React.FC<{
  segments: ChartSegment[];
  centerValue: string | number;
  centerLabel: string;
  size?: number;
}> = ({ segments, centerValue, centerLabel, size = 168 }) => {
  const visible = segments.filter((s) => s.value > 0);
  const total = visible.reduce((acc, s) => acc + s.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 4;
  const rInner = rOuter - 26;

  let cursor = 0;
  const arcs = visible.map((seg) => {
    const sweep = total > 0 ? (seg.value / total) * 360 : 0;
    const start = cursor;
    // Clamp a full-circle single segment slightly below 360° so the arc renders.
    const end = cursor + Math.min(sweep, 359.98);
    cursor += sweep;
    return { seg, start, end };
  });

  return (
    <div className="chart-donut-wrap">
      <div className="chart-donut-svg" style={{ width: size, height: size }}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          role="img"
          aria-label={`${centerLabel}: ${centerValue}`}
        >
          {total === 0 && (
            <circle
              cx={cx}
              cy={cy}
              r={(rOuter + rInner) / 2}
              fill="none"
              stroke="var(--border-subtle)"
              strokeWidth={rOuter - rInner}
            />
          )}
          {arcs.map(({ seg, start, end }) => (
            <path
              key={seg.label}
              d={donutArcPath(cx, cy, rOuter, rInner, start, end)}
              fill={seg.color}
              stroke="rgba(255,255,255,0.85)"
              strokeWidth="1"
            >
              <title>{`${seg.label}: ${seg.value}`}</title>
            </path>
          ))}
        </svg>
        <div className="chart-donut-center">
          <span className="chart-donut-value mono">{centerValue}</span>
          <span className="chart-donut-label">{centerLabel}</span>
        </div>
      </div>
      <ul className="chart-legend">
        {segments.map((seg) => {
          const body = (
            <>
              <span className="chart-legend-dot" style={{ background: seg.color }} aria-hidden="true" />
              <span className="chart-legend-label">{seg.label}</span>
              <span className="chart-legend-value mono">{seg.value}</span>
            </>
          );
          return (
            <li key={seg.label}>
              {seg.to ? (
                <Link to={seg.to} className="chart-legend-item chart-legend-link" title={`Open filtered view: ${seg.label}`}>
                  {body}
                </Link>
              ) : (
                <span className="chart-legend-item">{body}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export const HBarChart: React.FC<{
  rows: ChartSegment[];
  valueSuffix?: string;
  emptyLabel?: string;
}> = ({ rows, valueSuffix = '', emptyLabel = 'No records in scope' }) => {
  const max = Math.max(...rows.map((r) => r.value), 1);
  if (rows.length === 0) {
    return <p className="text-xs text-muted">{emptyLabel}</p>;
  }
  return (
    <div className="chart-hbar">
      {rows.map((row) => {
        const pct = Math.max((row.value / max) * 100, row.value > 0 ? 3 : 0);
        const body = (
          <>
            <div className="chart-hbar-head">
              <span className="chart-hbar-label" title={row.label}>
                {row.label}
              </span>
              <span className="chart-hbar-value mono">
                {row.value}
                {valueSuffix}
              </span>
            </div>
            <div className="chart-hbar-track">
              <div
                className="chart-hbar-fill"
                style={{ width: `${pct}%`, background: row.color }}
                aria-hidden="true"
              />
            </div>
            {row.sub && <div className="chart-hbar-sub">{row.sub}</div>}
          </>
        );
        return row.to ? (
          <Link key={row.label} to={row.to} className="chart-hbar-row chart-hbar-link" title={`Open filtered view: ${row.label}`}>
            {body}
          </Link>
        ) : (
          <div key={row.label} className="chart-hbar-row">
            {body}
          </div>
        );
      })}
    </div>
  );
};

export const STATUS_CHART_COLORS: Record<string, string> = {
  Open: '#2563eb',
  'In Progress': '#0e7490',
  'Pending Bureau': '#b45309',
  'Awaiting Review': '#0d9488',
  Escalated: '#dc2626',
  Resolved: '#16a34a',
  Closed: '#64748b',
};

export const BUREAU_CHART_COLORS = [
  '#1d4ed8',
  '#0e7490',
  '#b45309',
  '#15803d',
  '#be123c',
  '#4338ca',
  '#52525b',
];
