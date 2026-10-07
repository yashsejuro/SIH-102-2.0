import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  circle?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Atomic Skeleton component with smooth shimmer effect
 * Renders as a semantic inline phrasing element (<span> by default) with display: inline-block,
 * preventing React validateDOMNesting errors when placed inside <p>, <h1>, <strong>, etc.
 * Follows WCAG accessibility with aria-hidden="true" and role="status" on root.
 */
export function Skeleton({
  as: Component = 'span',
  width,
  height,
  borderRadius,
  circle = false,
  className = '',
  style,
  ...props
}: SkeletonProps) {
  const inlineStyles: React.CSSProperties = {
    display: 'inline-block',
    width: width ?? '100%',
    height: height ?? '16px',
    borderRadius: circle ? '50%' : (borderRadius ?? '4px'),
    verticalAlign: 'middle',
    ...style,
  };

  return (
    <Component
      className={`skeleton ${className}`.trim()}
      style={inlineStyles}
      aria-hidden="true"
      {...props}
    />
  );
}

/**
 * Skeleton component mirroring DashboardPage layout
 * Eliminates Cumulative Layout Shift (CLS) during initial intelligence fetch.
 */
export function DashboardSkeleton() {
  return (
    <div className="page-stack" role="status" aria-label="Loading intelligence workspace...">
      <span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}>
        Loading intelligence workspace...
      </span>

      {/* Header / Page Heading */}
      <div className="page-heading">
        <div>
          <div className="eyebrow" style={{ display: 'flex', alignItems: 'center' }}>
            <Skeleton width={140} height={12} />
          </div>
          <h1 style={{ marginTop: 6, marginBottom: 6 }}>
            <Skeleton width={320} height={32} />
          </h1>
          <p style={{ margin: 0 }}>
            <Skeleton width={480} height={16} />
          </p>
        </div>
        <div className="heading-meta" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Skeleton width={130} height={22} borderRadius={12} />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
        <Skeleton width={60} height={14} />
        <Skeleton width={140} height={36} borderRadius={4} />
        <Skeleton width={150} height={36} borderRadius={4} />
        <Skeleton width={140} height={36} borderRadius={4} />
        <div style={{ marginLeft: 'auto' }}>
          <Skeleton width={90} height={36} borderRadius={4} />
        </div>
      </div>

      {/* KPI 5-Column Grid */}
      <section className="kpi-grid">
        {[
          { label: 'PROJECTS ANALYZED', valWidth: 70 },
          { label: 'SANCTIONED VALUE', valWidth: 95 },
          { label: 'EXPENDITURE', valWidth: 90 },
          { label: 'HIGH RISK', valWidth: 50 },
          { label: 'OPEN ALERTS', valWidth: 50 },
        ].map((item, idx) => (
          <div className="stat-block" key={idx} style={{ padding: '18px 20px', minHeight: 110 }}>
            <div className="stat-label">
              <Skeleton width={item.label.length * 7.5} height={11} />
            </div>
            <div className="stat-value" style={{ margin: '6px 0 2px' }}>
              <Skeleton width={item.valWidth} height={28} />
            </div>
            <div className="stat-detail">
              <Skeleton width={120} height={12} />
            </div>
          </div>
        ))}
      </section>

      {/* Compliance & Fraud Risk Triage Panel */}
      <section className="panel compliance-panel">
        <div className="panel-head">
          <div style={{ width: '80%' }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              <Skeleton width={200} height={12} />
            </div>
            <h2 style={{ margin: '4px 0 8px' }}>
              <Skeleton width={380} height={22} />
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              <Skeleton width="90%" height={14} />
            </p>
          </div>
          <div>
            <Skeleton width={110} height={34} borderRadius={4} />
          </div>
        </div>

        {/* Severity Badges Row */}
        <div className="risk-summary" style={{ marginTop: 14 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Skeleton width={60} height={20} borderRadius={10} />
              <Skeleton width={70} height={14} />
              <Skeleton width={30} height={16} />
            </div>
          ))}
        </div>

        {/* Fraud Indicator Chips */}
        <div style={{ marginTop: 18 }}>
          <div style={{ marginBottom: 8 }}>
            <Skeleton width={190} height={13} />
          </div>
          <div
            className="fraud-chips-grid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}
          >
            {[1, 2, 3, 4, 5].map((idx) => (
              <div
                key={idx}
                className="stat-block"
                style={{ padding: '12px 14px', background: '#fafcfb', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)' }}
              >
                <span className="stat-label">
                  <Skeleton width={110} height={10} />
                </span>
                <strong className="stat-value" style={{ fontSize: 20, marginTop: 6 }}>
                  <Skeleton width={45} height={22} />
                </strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Map (2) & Donut (1) Split Grid */}
      <div className="grid-2-1">
        {/* Map Panel */}
        <section className="panel map-panel">
          <div className="panel-head">
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>
                <Skeleton width={130} height={12} />
              </div>
              <h2 style={{ margin: '4px 0' }}>
                <Skeleton width={260} height={22} />
              </h2>
            </div>
            <div>
              <Skeleton width={130} height={32} borderRadius={4} />
            </div>
          </div>
          <div className="map-layout" style={{ minHeight: 380, display: 'flex', gap: 16 }}>
            <div style={{ flex: 1.4, background: '#f8faf9', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%' }}>
                <Skeleton width={180} height={180} borderRadius={16} />
                <Skeleton width={140} height={14} />
              </div>
            </div>
            <div className="state-insight" style={{ flex: 1, padding: '10px 14px' }}>
              <Skeleton width={160} height={18} style={{ marginBottom: 12 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Skeleton width="100%" height={14} />
                <Skeleton width="90%" height={14} />
                <Skeleton width="75%" height={14} />
                <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                  <Skeleton width={80} height={28} borderRadius={4} />
                  <Skeleton width={80} height={28} borderRadius={4} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Donut Chart Panel */}
        <section className="panel">
          <div className="panel-head">
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>
                <Skeleton width={150} height={12} />
              </div>
              <h2 style={{ margin: '4px 0' }}>
                <Skeleton width={180} height={22} />
              </h2>
            </div>
            <Skeleton width={90} height={14} />
          </div>
          <div className="donut-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', minHeight: 260, padding: 16 }}>
            <Skeleton width={140} height={140} circle />
            <div className="risk-list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((lvl) => (
                <div key={lvl} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Skeleton width={12} height={12} borderRadius={2} />
                  <Skeleton width={60} height={14} />
                  <Skeleton width={30} height={14} />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Grid 2: Bar & Line Chart Panels */}
      <div className="grid-2">
        <section className="panel chart-panel">
          <div className="panel-head">
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>
                <Skeleton width={120} height={12} />
              </div>
              <h2 style={{ margin: '4px 0' }}>
                <Skeleton width={170} height={20} />
              </h2>
            </div>
          </div>
          <div style={{ height: 220, padding: '16px 10px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: 10 }}>
            {[45, 70, 30, 85, 60, 95, 40, 65].map((h, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                <Skeleton width="80%" height={`${h}%`} borderRadius="4px 4px 0 0" />
                <Skeleton width={28} height={10} />
              </div>
            ))}
          </div>
        </section>

        <section className="panel chart-panel">
          <div className="panel-head">
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>
                <Skeleton width={130} height={12} />
              </div>
              <h2 style={{ margin: '4px 0' }}>
                <Skeleton width={190} height={20} />
              </h2>
            </div>
          </div>
          <div style={{ height: 220, padding: '16px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 160, paddingBottom: 10, borderBottom: '1px solid var(--line)' }}>
              {[25, 45, 80, 50, 65, 90, 75].map((h, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Skeleton width={10} height={10} circle style={{ marginBottom: `${h}px` }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              {['0-30d', '31-60d', '61-90d', '91-180d', '180d+'].map((t, idx) => (
                <Skeleton key={idx} width={34} height={10} />
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Projects Register Table Panel */}
      <section className="panel attention-panel">
        <div className="panel-head">
          <div style={{ width: '75%' }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              <Skeleton width={140} height={12} />
            </div>
            <h2 style={{ margin: '4px 0 6px' }}>
              <Skeleton width={260} height={22} />
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              <Skeleton width={380} height={14} />
            </p>
          </div>
          <div>
            <Skeleton width={170} height={34} borderRadius={4} />
          </div>
        </div>

        {/* Table scroll mock */}
        <div className="table-scroll" style={{ marginTop: 12 }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                {['Project', 'Location', 'Category', 'Sanctioned', 'Expenditure', 'Used', 'Delay', 'Review Score'].map((th, i) => (
                  <th key={i} style={{ padding: '10px 14px' }}>
                    <Skeleton width={i === 0 ? 110 : 70} height={12} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((row) => (
                <tr key={row}>
                  <td style={{ padding: '12px 14px' }}>
                    <Skeleton width={180} height={14} style={{ marginBottom: 4 }} />
                    <Skeleton width={90} height={11} />
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <Skeleton width={100} height={13} />
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <Skeleton width={80} height={13} />
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <Skeleton width={75} height={13} />
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <Skeleton width={75} height={13} />
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <Skeleton width={45} height={13} />
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <Skeleton width={55} height={13} />
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <Skeleton width={68} height={20} borderRadius={10} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/**
 * Skeleton component mirroring ProjectDetailPage layout
 * Eliminates Cumulative Layout Shift (CLS) during project investigation load.
 */
export function ProjectDetailSkeleton() {
  return (
    <div className="page-stack" role="status" aria-label="Loading investigation workspace...">
      <span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}>
        Loading investigation workspace...
      </span>

      {/* Page Actions Navigation */}
      <div className="page-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton width={130} height={18} />
        <div className="action-row" style={{ display: 'flex', gap: 10 }}>
          <Skeleton width={160} height={34} borderRadius={4} />
          <Skeleton width={140} height={34} borderRadius={4} />
          <Skeleton width={110} height={34} borderRadius={4} />
        </div>
      </div>

      {/* Project Header Panel */}
      <section className="panel project-header">
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          <Skeleton width={200} height={12} />
        </div>
        <h1 style={{ margin: '4px 0 8px' }}>
          <Skeleton width="60%" height={32} />
        </h1>
        <p style={{ margin: '0 0 16px' }}>
          <Skeleton width="45%" height={16} />
        </p>

        <div className="risk-summary" style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <div>
            <Skeleton width={80} height={12} style={{ marginBottom: 4 }} />
            <Skeleton width={60} height={24} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Skeleton width={90} height={26} borderRadius={12} />
          </div>
        </div>
      </section>

      {/* Project At A Glance Panel */}
      <section className="panel project-intro-panel">
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          <Skeleton width={160} height={12} />
        </div>
        <div className="project-intro-grid">
          <div>
            <h2 style={{ margin: '0 0 12px' }}>
              <Skeleton width="75%" height={24} />
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              <Skeleton width="100%" height={15} />
              <Skeleton width="96%" height={15} />
              <Skeleton width="88%" height={15} />
              <Skeleton width="92%" height={15} style={{ marginTop: 8 }} />
              <Skeleton width="70%" height={15} />
            </div>
          </div>

          <div className="project-facts">
            {[
              'Project number',
              'Sector',
              'State',
              'District',
              'Constituency',
              'MP',
              'Supplier',
              'Implementing office',
            ].map((fact, idx) => (
              <div key={idx} style={{ padding: '10px 14px' }}>
                <span style={{ marginBottom: 4 }}>
                  <Skeleton width={fact.length * 6.5} height={10} />
                </span>
                <strong>
                  <Skeleton width={idx % 2 === 0 ? 90 : 120} height={14} />
                </strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Physical vs Financial Progress Reconciliation Panel */}
      <section className="panel">
        <div className="panel-head">
          <div style={{ width: '80%' }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              <Skeleton width={260} height={12} />
            </div>
            <h2 style={{ margin: '4px 0 6px' }}>
              <Skeleton width={320} height={20} />
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              <Skeleton width={440} height={14} />
            </p>
          </div>
        </div>
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: '#f8faf9', padding: '16px', borderRadius: 6 }}>
            <Skeleton width={140} height={14} style={{ marginBottom: 10 }} />
            <Skeleton width="100%" height={18} borderRadius={4} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <Skeleton width={80} height={12} />
              <Skeleton width={50} height={12} />
            </div>
          </div>
          <div style={{ background: '#f8faf9', padding: '16px', borderRadius: 6 }}>
            <Skeleton width={150} height={14} style={{ marginBottom: 10 }} />
            <Skeleton width="100%" height={18} borderRadius={4} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <Skeleton width={90} height={12} />
              <Skeleton width={50} height={12} />
            </div>
          </div>
        </div>
      </section>

      {/* Microphone Voice Dictation / Auditor Field Notes */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              <Skeleton width={180} height={12} />
            </div>
            <h2 style={{ margin: '4px 0 6px' }}>
              <Skeleton width={280} height={20} />
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              <Skeleton width={450} height={14} />
            </p>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <Skeleton width="100%" height={90} borderRadius={6} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <Skeleton width={130} height={34} borderRadius={4} />
          </div>
        </div>
      </section>

      {/* Document Verification Checklist */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              <Skeleton width={190} height={12} />
            </div>
            <h2 style={{ margin: '4px 0 6px' }}>
              <Skeleton width={240} height={20} />
            </h2>
          </div>
          <Skeleton width={110} height={14} />
        </div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Skeleton width={18} height={18} borderRadius={3} />
              <Skeleton width={i === 1 ? 160 : i === 2 ? 220 : i === 3 ? 180 : 150} height={15} />
            </div>
          ))}
        </div>
      </section>

      {/* Project Progress Metric Bars */}
      <section className="panel progress-panel">
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          <Skeleton width={140} height={12} />
        </div>
        <h2 style={{ margin: '4px 0 16px' }}>
          <Skeleton width={200} height={20} />
        </h2>
        <div className="metric-grid">
          {[
            'Use of funds',
            'Delay',
            'Cost increase',
            'Comparison with similar works',
            'Repeated record check',
            'Missing information',
          ].map((signal) => (
            <div className="metric-card" key={signal}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Skeleton width={signal.length * 6} height={12} />
                <Skeleton width={36} height={14} />
              </div>
              <div className="metric-bar">
                <Skeleton width="100%" height={8} borderRadius={4} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Comparable Projects */}
      <section className="panel comparable-panel">
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          <Skeleton width={160} height={12} />
        </div>
        <h2 style={{ margin: '4px 0 16px' }}>
          <Skeleton width={210} height={20} />
        </h2>
        <div className="similar-list">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="similar-item" style={{ cursor: 'default' }}>
              <Skeleton width={110} height={14} style={{ marginBottom: 4 }} />
              <Skeleton width={180} height={13} style={{ marginBottom: 4 }} />
              <Skeleton width={120} height={12} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
