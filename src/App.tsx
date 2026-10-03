import React, { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import indiaMap from '@svg-maps/india';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import './index.css';
import MultiUploadPage from './MultiUploadPage';
import IntegrationPage from './IntegrationPage';
import { API_BASE, Role, useAuth } from './auth';
import { VoiceDictation } from './VoiceDictation';
import LandingPage from './LandingPage';
const levels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const palette: Record<string, string> = { LOW: '#48a88a', MEDIUM: '#d7a64a', HIGH: '#e4774c', CRITICAL: '#d95b67' };

type Project = {
  id: number; project_name: string; project_code?: string; state: string; district: string; constituency?: string;
  category?: string; agency?: string; sanction_amount?: number; expenditure?: number; utilization_ratio?: number;
  expected_completion_date?: string; actual_completion_date?: string;
  anomaly_score?: number; normalized_ml_score?: number; ml_anomaly_flag?: boolean; risk_score?: number; risk_level?: string;
  status?: string; delay_days?: number; peer_median?: number; contextual_cost_deviation?: number;
  reasons?: string[]; primary_reason?: string; signal_components?: Record<string, number>; duplicate_flag?: boolean; source_datasets?: string[]; source_lineage?: Record<string, unknown>; cross_dataset_conflict?: boolean;
  calamity_type?: string; calamity_name?: string; consent_date?: string; consent_amount?: number; mp_name?: string; allocation_limit?: number; vendor_name?: string; payment_status?: string;
};
type Dashboard = {
  total_projects: number; total_sanction_amount: number; total_expenditure: number; total_utilization_ratio: number;
  high_risk_projects: number; critical_projects: number; active_alerts: number; risk_distribution: Record<string, number>; alert_distribution?: Record<string, number>;
  state_wise: any[]; district_wise: any[]; category_wise: any[]; risk_score_distribution: any[];
  utilization_distribution: any[]; delay_distribution: any[]; last_analysis?: string; model_status: string;
  dataset_status: string; top_projects: Project[];
  state_options?: string[];
};
type Alert = { id: number; project_id: number; project_name: string; severity: string; title: string; message: string; state: string; district: string };
type AuditCase = { id: number; project_id: number; title: string; priority: string; status: string; notes?: string; assigned_authority?: string; created_at?: string; updated_at?: string };

const money = (value?: number) => typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value) : '—';
const compactMoney = (value?: number) => typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 }).format(value) : '—';
const compactCurrency = (value?: number) => typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 }).format(value) : '—';
const pct = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const nonNegative = Math.max(0, value);
  return `${(nonNegative * 100).toFixed(1)}%`;
};
const dateText = (value?: string) => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not available';
const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ');
const projectTitle = (project: Project) => {
  const name = project.project_name?.trim();
  const code = project.project_code?.trim();
  return name && name !== code ? name : `${project.category || 'Public'} project in ${project.district || 'the recorded district'}, ${project.state || 'the recorded state'}`;
};
const reviewLevel = (project: Project) => {
  if (project.risk_level === 'DATA_QUALITY_REVIEW') return project.risk_level;
  const score = project.risk_score;
  if (typeof score !== 'number' || !Number.isFinite(score)) return project.risk_level || 'LOW';
  return score >= 80 ? 'CRITICAL' : score >= 60 ? 'HIGH' : score >= 35 ? 'MEDIUM' : 'LOW';
};

function RiskBadge({ level = 'LOW' }: { level?: string }) {
  const raw = String(level || 'LOW').trim();
  let normalizedClass = raw.toLowerCase().replace(/[\s-]+/g, '_');
  if (normalizedClass.includes('data_quality')) {
    normalizedClass = 'data_quality_review';
  } else if (normalizedClass === 'critical_risk' || normalizedClass === 'critical') {
    normalizedClass = 'critical';
  } else if (normalizedClass === 'high_risk' || normalizedClass === 'high') {
    normalizedClass = 'high';
  } else if (normalizedClass === 'medium_risk' || normalizedClass === 'moderate' || normalizedClass === 'medium') {
    normalizedClass = 'medium';
  } else if (normalizedClass === 'low_risk' || normalizedClass === 'low') {
    normalizedClass = 'low';
  } else {
    normalizedClass = 'medium';
  }
  const displayLabel = raw.toUpperCase().replace(/_/g, ' ');
  return (
    <span className={cx('risk-badge', `risk-${normalizedClass}`)}>
      <span className="risk-dot" />
      {displayLabel}
    </span>
  );
}
function Stat({ label, value, detail, tone = 'teal' }: { label: string; value: string; detail?: string; tone?: string }) {
  return <div className="stat-block"><div className="stat-label">{label}</div><div className="stat-value">{value}</div>{detail && <div className={cx('stat-detail', `tone-${tone}`)}>{detail}</div>}</div>;
}
function EmptyState({ title, text }: { title: string; text: string }) { return <div className="empty-state"><div className="empty-mark">/</div><strong>{title}</strong><span>{text}</span></div>; }
class ProjectPageBoundary extends React.Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() { return this.state.error ? <div className="page-stack"><section className="panel"><h2>Project page could not be displayed</h2><p>{this.state.error.message}</p></section></div> : this.props.children; }
}

const navGroups = [
  { label: 'MONITOR', items: [['Overview', '/', '01'], ['Risk Intelligence', '/risk', '02'], ['Projects', '/projects', '03']] },
  { label: 'OPERATE', items: [['Upload & Analyze', '/upload', '04'], ['Audit Copilot', '/audit-search', '05'], ['Alerts', '/alerts', '06'], ['Audit Cases', '/cases', '07']] },
  { label: 'INSIGHT', items: [['Analytics', '/analytics', '08'], ['Agency Intelligence', '/agencies', '09'], ['Fund Reconciliation', '/reconciliation', '10'], ['Duplicate Detection', '/duplicates', '11'], ['Data Integration', '/integration', '12'], ['Data Quality', '/data-quality', '13']] },
];
const roleTitles: Record<Role, string> = { MINISTRY: 'Ministry / National', STATE_NODAL_AUTHORITY: 'State Nodal Authority', DISTRICT_AUTHORITY: 'District Authority', MEMBER_OF_PARLIAMENT: 'Member of Parliament' };

function Shell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const { user, logout, can } = useAuth();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    axios.get(`${API_BASE}/api/alerts`).then(res => {
      setAlertCount(res.data?.items?.length || 0);
    }).catch(() => {});
  }, []);

  const visible = (path: string) => path !== '/upload' && path !== '/integration' || can('dataset:upload');
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    if (search.trim()) navigate(`/projects?search=${encodeURIComponent(search.trim())}`);
  };

  const currentDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();

  return <div className="app-shell">
    {/* Mobile Header Bar */}
    <div className="mobile-header md:hidden">
      <button className="mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle navigation menu">
        {mobileOpen ? '✕' : '☰'}
      </button>
      <div className="brand" style={{ padding: 0 }}>
        <div className="brand-seal" style={{ width: 28, height: 28, fontSize: 13 }}>M</div>
        <div>
          <div className="brand-kicker" style={{ fontSize: 8 }}>MPLADS AI</div>
          <div className="brand-title" style={{ fontSize: 13, marginTop: 0 }}>Audit Intelligence</div>
        </div>
      </div>
      <button className="icon-button" style={{ border: 'none', background: 'transparent', color: '#fff' }} onClick={() => navigate('/alerts')}>
        🔔{alertCount > 0 && <span className="badge-counter">{alertCount}</span>}
      </button>
    </div>

    {/* Backdrop for mobile drawer */}
    {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}

    <aside className={cx('sidebar', mobileOpen && 'open')}>
      <div className="brand">
        <div className="brand-seal">M</div>
        <div>
          <div className="brand-kicker">MPLADS AI</div>
          <div className="brand-title">Audit Intelligence</div>
        </div>
      </div>
      <div className="side-rule" />
      {navGroups.map(group => (
        <div className="nav-group" key={group.label}>
          <div className="nav-label">{group.label}</div>
          {group.items.filter(([, path]) => visible(path)).map(([label, path, number]) => (
            <Link
              key={path}
              to={path}
              className={cx('nav-item', location.pathname === path || (path !== '/' && location.pathname.startsWith(path)) ? 'active' : '')}
            >
              <span className="nav-number">{number}</span>
              <span>{label}</span>
            </Link>
          ))}
        </div>
      ))}
      {(user?.role === 'MINISTRY' || user?.role === 'STATE_NODAL_AUTHORITY') && (
        <div className="nav-group">
          <div className="nav-label">ADMINISTRATION</div>
          <Link to="/users" className={cx('nav-item', location.pathname.startsWith('/users') ? 'active' : '')}>
            <span className="nav-number">14</span>
            <span>User Management</span>
          </Link>
        </div>
      )}
      <div className="nav-group">
        <div className="nav-label">PRESENTATION</div>
        <Link to="/landing" className={cx('nav-item', location.pathname === '/landing' ? 'active' : '')}>
          <span className="nav-number">★</span>
          <span>SIH Project Brief</span>
        </Link>
      </div>
      <div className="sidebar-bottom">
        <div className="system-card">
          <div className="status-line"><span className="live-dot" />System active & verified</div>
          <div className="system-row"><span>Status</span><strong>Isolation Forest Online</strong></div>
          <div className="system-row"><span>Jurisdiction</span><strong>{user?.scope_id || 'National'}</strong></div>
        </div>
        <div className="authority">
          <span className="avatar">{(user?.name || 'AD').slice(0, 2).toUpperCase()}</span>
          <div>
            <strong>{user?.name || 'Authorized Officer'}</strong>
            <small>{user ? roleTitles[user.role] : 'Official Access'}</small>
            <button className="logout-link" onClick={logout}>Sign out</button>
          </div>
        </div>
      </div>
    </aside>

    <div className="workspace">
      <header className="topbar">
        <div className="crumb">
          {user?.scope_type === 'NATIONAL' ? 'NATIONAL MONITORING' : `${user?.scope_type || 'OFFICIAL'} MONITORING`}
          <span>/</span>
          {location.pathname === '/' ? 'OVERVIEW' : location.pathname.replace('/', '').replace(/-/g, ' ').toUpperCase()}
        </div>
        <form className="global-search" onSubmit={submitSearch}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#729b92', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search projects, states, districts..."
          />
          <kbd>Enter</kbd>
        </form>
        <div className="top-actions">
          <button className="icon-button" title="Open Notifications" onClick={() => navigate('/alerts')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#16655c' }}>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {alertCount > 0 && <span className="badge-counter">{alertCount}</span>}
          </button>
          <div className="timestamp">
            {currentDate}<br />
            <span>{user?.scope_id || 'National'} workspace</span>
          </div>
        </div>
      </header>
      <main className="content">{children}</main>
    </div>
  </div>;
}

function FilterBar({ onChange, values }: { onChange: (key: string, value: string) => void; values: Record<string, string> }) {
  const categories = ['Roads', 'Water Supply', 'Education', 'Health', 'Sanitation', 'Community Infrastructure', 'Trust and Society', 'Normal/Others', 'Calamity Relief'];
  const hasActiveFilters = Boolean(values.state || values.category || values.risk_level);
  return (
    <div className="filter-bar">
      <div className="filter-title">FILTERS</div>
      <select value={values.state || ''} onChange={event => onChange('state', event.target.value)}>
        <option value="">All states</option>
        {(values.stateOptions?.split('|') || []).filter(Boolean).sort((a, b) => a.localeCompare(b)).map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      <select value={values.category || ''} onChange={event => onChange('category', event.target.value)}>
        <option value="">All categories</option>
        {categories.sort((a, b) => a.localeCompare(b)).map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      <select value={values.risk_level || ''} onChange={event => onChange('risk_level', event.target.value)}>
        <option value="">All review levels</option>
        {levels.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      {hasActiveFilters && (
        <button
          className="button ghost"
          type="button"
          onClick={() => { onChange('state', ''); onChange('category', ''); onChange('risk_level', ''); }}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function useDashboardFilters() {
  const [filters, setFilters] = useState<Record<string, string>>({ state: '', category: '', risk_level: '', stateOptions: '' });
  const change = (key: string, value: string) => setFilters(previous => ({ ...previous, [key]: value }));
  return { filters, change };
}

function StateMap({ dashboard, selected, onSelect }: { dashboard: Dashboard; selected: string; onSelect: (state: string) => void }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const [generatingState, setGeneratingState] = useState<string | null>(null);
  const [generatedCases, setGeneratedCases] = useState<Record<string, { id: number; priority: string; title: string }>>({});
  const leaveTimeoutRef = useRef<number | null>(null);
  const stateRows = new Map((dashboard.state_wise || []).map(row => [row.name, row]));
  const maxRisk = Math.max(...(dashboard.state_wise || []).map(row => row.average_risk || 0), 1);
  const locations = (indiaMap as any).locations || [];
  const hoveredRow = hovered ? stateRows.get(hovered) : null;

  const nationalAvgRisk = useMemo(() => {
    if (typeof (dashboard as any).national_average_risk === 'number') {
      return (dashboard as any).national_average_risk;
    }
    const states = dashboard.state_wise || [];
    const totalProjects = states.reduce((sum: number, s: any) => sum + (s.projects || 0), 0);
    const totalRiskWeighted = states.reduce((sum: number, s: any) => sum + ((s.average_risk || 0) * (s.projects || 0)), 0);
    return totalProjects > 0 ? Number((totalRiskWeighted / totalProjects).toFixed(1)) : 0;
  }, [dashboard]);

  const handleMouseMove = (e: React.MouseEvent<SVGElement>, stateName: string) => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    const container = e.currentTarget.closest('.map-wrap');
    if (container) {
      const rect = container.getBoundingClientRect();
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;
      const tooltipWidth = 260;
      const tooltipHeight = 280;
      const x = rawX + tooltipWidth + 16 > rect.width ? Math.max(8, rawX - tooltipWidth - 12) : rawX + 16;
      const y = Math.min(Math.max(8, rawY - 40), Math.max(8, rect.height - tooltipHeight));
      setCoords({ x, y });
    }
    setHovered(stateName);
  };

  const handleMouseLeave = () => {
    leaveTimeoutRef.current = window.setTimeout(() => {
      setHovered(null);
      setCoords(null);
    }, 280);
  };

  const handleTooltipMouseEnter = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
  };

  const handleTooltipMouseLeave = () => {
    leaveTimeoutRef.current = window.setTimeout(() => {
      setHovered(null);
      setCoords(null);
    }, 280);
  };

  const topSectors = useMemo(() => {
    if (!hoveredRow) return [];
    if (hoveredRow.top_sectors && Array.isArray(hoveredRow.top_sectors) && hoveredRow.top_sectors.length > 0) {
      return hoveredRow.top_sectors;
    }
    if (hovered && dashboard.top_projects) {
      const counts: Record<string, number> = {};
      for (const p of dashboard.top_projects) {
        if (p.state === hovered && p.category) {
          counts[p.category] = (counts[p.category] || 0) + 1;
        }
      }
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([sector, count]) => ({ sector, count }));
    }
    return [];
  }, [hovered, hoveredRow, dashboard.top_projects]);

  const riskLevel = hoveredRow ? (
    hoveredRow.average_risk >= 70 ? 'CRITICAL' :
    hoveredRow.average_risk >= 50 ? 'HIGH' :
    hoveredRow.average_risk >= 30 ? 'MEDIUM' : 'LOW'
  ) : 'LOW';

  const totalSanctionedAmount = hoveredRow
    ? (typeof hoveredRow.total_sanctioned_amount === 'number'
        ? hoveredRow.total_sanctioned_amount
        : (typeof hoveredRow.sanctioned === 'number' ? hoveredRow.sanctioned : 0))
    : 0;

  const riskDiff = hoveredRow ? Number((hoveredRow.average_risk - nationalAvgRisk).toFixed(1)) : 0;
  const isHigher = riskDiff > 0.1;
  const isLower = riskDiff < -0.1;

  const handleMarkForReview = async (e: React.MouseEvent, stateName: string, row: any) => {
    e.stopPropagation();
    if (generatingState) return;

    setGeneratingState(stateName);
    try {
      // 1. Fetch real project data for this state to populate specific case details & priority
      let candidateProject: any = null;
      try {
        const projRes = await axios.get(`${API_BASE}/api/projects`, {
          params: { state: stateName, page_size: 20 }
        });
        const records = projRes.data?.records || projRes.data?.items || [];
        if (records.length > 0) {
          candidateProject = records.slice().sort((a: any, b: any) => (b.risk_score || 0) - (a.risk_score || 0))[0];
        }
      } catch {
        // Fallback if projects request fails
      }

      if (!candidateProject) {
        const stateProjects = (dashboard.top_projects || []).filter(p => p.state === stateName);
        candidateProject = stateProjects.sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))[0] || dashboard.top_projects?.[0] || {
          id: 1,
          project_name: `${stateName} State Civil Works Scheme`,
          sanction_amount: totalSanctionedAmount,
          expenditure: row.expenditure || 0,
          risk_score: row.average_risk,
          risk_level: riskLevel,
          category: topSectors[0]?.sector || 'Community Works',
        };
      }

      // 2. Determine priority level from project data & state metrics
      const projectScore = typeof candidateProject.risk_score === 'number' ? candidateProject.risk_score : row.average_risk;
      const priorityLevel = (candidateProject.risk_level === 'CRITICAL' || projectScore >= 70 || row.average_risk >= 70) ? 'CRITICAL'
        : (candidateProject.risk_level === 'HIGH' || projectScore >= 50 || row.average_risk >= 50) ? 'HIGH'
        : (candidateProject.risk_level === 'MEDIUM' || projectScore >= 30 || row.average_risk >= 30) ? 'MEDIUM'
        : 'LOW';

      // 3. Utilize project data to populate case details
      const diffText = isHigher ? `+${riskDiff}% higher than national average` : isLower ? `${Math.abs(riskDiff)}% below national average` : 'At national average';
      const sectorNames = topSectors.map(s => `${s.sector} (${s.count})`).join(', ');
      const utilizationText = candidateProject.sanction_amount && candidateProject.expenditure
        ? `${((candidateProject.expenditure / candidateProject.sanction_amount) * 100).toFixed(1)}%`
        : candidateProject.utilization_ratio ? `${(candidateProject.utilization_ratio * 100).toFixed(1)}%` : 'N/A';

      const delayText = candidateProject.delay_days !== undefined
        ? (candidateProject.delay_days > 0 ? `${candidateProject.delay_days} days overrun` : 'On schedule')
        : 'Timeline pending site verification';

      const reasonsText = candidateProject.reasons && candidateProject.reasons.length > 0
        ? candidateProject.reasons.join('; ')
        : (candidateProject.primary_reason || `Outlier risk signal flagged by Isolation Forest (${projectScore.toFixed(1)}%)`);

      const caseTitle = `Audit Case: [${stateName}] ${candidateProject.project_name} (${priorityLevel} Priority)`;

      const notes = [
        `Automated audit case generated from State Risk Map.`,
        `• Target Project: ${candidateProject.project_name} (ID: ${candidateProject.id}${candidateProject.project_code ? `, Code: ${candidateProject.project_code}` : ''})`,
        `• Jurisdiction: ${candidateProject.district ? `${candidateProject.district}, ` : ''}${stateName}`,
        `• Category & Agency: ${candidateProject.category || topSectors[0]?.sector || 'Civil Works'} | ${candidateProject.agency || 'District Executing Authority'}`,
        `• Priority Level: ${priorityLevel} (Score: ${projectScore.toFixed(1)}%)`,
        `• Sanctioned: ${money(candidateProject.sanction_amount || 0)} | Expenditure: ${money(candidateProject.expenditure || 0)} (Utilization: ${utilizationText})`,
        `• Timeline Delay: ${delayText}`,
        `• Anomaly Indicators: ${reasonsText}`,
        `• State Aggregate Context: ${row.projects} works monitored, ₹${(totalSanctionedAmount / 10000000).toFixed(2)} Cr total sanctions`,
        `• Primary Sectors: ${sectorNames || 'General Infrastructure'}`,
        `• Directive: Initiate physical inspection of Measurement Book (MB) recordings, contractor invoices, and site milestones.`
      ].join('\n');

      const payload = {
        project_id: candidateProject.id,
        title: caseTitle,
        priority: priorityLevel,
        assigned_authority: candidateProject.agency || `${stateName} State Nodal Inspection Cell`,
        notes,
        state: stateName,
      };

      const res = await axios.post(`${API_BASE}/api/audit-cases`, payload);
      setGeneratedCases(prev => ({
        ...prev,
        [stateName]: {
          id: res.data.id,
          priority: priorityLevel,
          title: caseTitle,
        }
      }));
    } catch (err) {
      console.error('Failed to create audit case for state', err);
    } finally {
      setGeneratingState(null);
    }
  };

  return (
    <div className="map-wrap">
      <div className="map-legend">
        <span>Lower risk</span>
        <i className="legend-low" />
        <i className="legend-mid" />
        <i className="legend-high" />
        <span>Higher risk</span>
      </div>
      {hovered && (
        <div
          key={hovered}
          className="state-map-tooltip"
          style={{
            left: coords ? `${coords.x}px` : '12px',
            top: coords ? `${coords.y}px` : '12px',
          }}
          role="tooltip"
          aria-live="polite"
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        >
          <div className="state-map-tooltip-header">
            <span className="state-map-tooltip-title">{hovered}</span>
            {hoveredRow && (
              <span
                className="state-map-tooltip-badge"
                style={{
                  background: palette[riskLevel] || '#48a88a',
                  color: '#ffffff',
                }}
              >
                {riskLevel}
              </span>
            )}
          </div>

          {hoveredRow ? (
            <>
              <div className="state-map-tooltip-stats">
                <div>
                  <span className="state-map-tooltip-stat-label">Projects</span>
                  <div className="state-map-tooltip-stat-val">{hoveredRow.projects.toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <span className="state-map-tooltip-stat-label">Avg Risk</span>
                  <div className="state-map-tooltip-stat-val state-map-tooltip-risk-val">
                    <span style={{ color: palette[riskLevel] || '#48a88a' }}>
                      {hoveredRow.average_risk.toFixed(1)}%
                    </span>
                    <span
                      className={`state-map-trend-indicator ${isHigher ? 'trend-up' : isLower ? 'trend-down' : 'trend-neutral'}`}
                      title={`National avg: ${nationalAvgRisk.toFixed(1)}% (${isHigher ? `+${riskDiff}% higher` : isLower ? `${Math.abs(riskDiff)}% lower` : 'Equal'})`}
                      aria-label={isHigher ? 'Up vs national average' : isLower ? 'Down vs national average' : 'Equal to national average'}
                    >
                      {isHigher ? (
                        <>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="18 15 12 9 6 15" />
                          </svg>
                          <span>Up</span>
                        </>
                      ) : isLower ? (
                        <>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                          <span>Down</span>
                        </>
                      ) : (
                        <span style={{ fontSize: '10px' }}>—</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="state-map-tooltip-sanctioned">
                <span className="state-map-tooltip-stat-label">Total Sanctioned</span>
                <div className="state-map-tooltip-sanctioned-val" title={`Total sanctioned: ${money(totalSanctionedAmount)}`}>
                  <span className="total-sanctioned-amount">{money(totalSanctionedAmount)}</span>
                  <span className="total-sanctioned-compact">({compactCurrency(totalSanctionedAmount)})</span>
                </div>
              </div>

              <div className="state-map-tooltip-sectors">
                <div className="state-map-tooltip-sectors-title">Top 3 Sectors</div>
                {topSectors.length > 0 ? (
                  <div className="state-map-tooltip-sector-list">
                    {topSectors.map((s: any, idx: number) => (
                      <div className="state-map-tooltip-sector-item" key={s.sector || idx}>
                        <span className="state-map-tooltip-sector-name">
                          <span style={{ opacity: 0.6, marginRight: 4 }}>{idx + 1}.</span>
                          {s.sector}
                        </span>
                        <span className="state-map-tooltip-sector-count">
                          {s.count} {s.count === 1 ? 'work' : 'works'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', padding: '2px 0' }}>
                    Sector details not recorded
                  </div>
                )}
              </div>

              {/* MARK FOR REVIEW ACTION */}
              <div className="state-map-tooltip-actions">
                <button
                  type="button"
                  className={`state-map-review-btn ${generatedCases[hovered] ? 'created' : ''}`}
                  onClick={(e) => handleMarkForReview(e, hovered, hoveredRow)}
                  disabled={generatingState === hovered}
                  title={`Automatically generate an Audit Case for ${hovered} using project statistics & anomaly data`}
                >
                  {generatingState === hovered ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spin-icon">
                        <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                      </svg>
                      <span>Generating Case...</span>
                    </>
                  ) : generatedCases[hovered] ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>Case #{String(generatedCases[hovered].id).padStart(4, '0')} Generated</span>
                    </>
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      <span>Mark for Review</span>
                    </>
                  )}
                </button>

                {generatedCases[hovered] && (
                  <div className="state-map-case-success">
                    <span>Priority: <strong>{generatedCases[hovered].priority}</strong></span>
                    <Link to="/cases" className="state-map-case-link" onClick={(e) => e.stopPropagation()}>
                      View in Cases →
                    </Link>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', padding: '4px 0' }}>
              No analyzed projects for this state.
            </div>
          )}
        </div>
      )}
      <svg
        className="india-map"
        viewBox={(indiaMap as any).viewBox}
        role="img"
        aria-label="Interactive India state risk map"
        onMouseLeave={handleMouseLeave}
      >
        {locations.map((location: any) => {
          const row = stateRows.get(location.name);
          const intensity = row ? Math.min((row.average_risk || 0) / maxRisk, 1) : 0;
          const isSelected = selected === location.name;
          const fill = isSelected ? '#f2c66d' : `rgba(28, 124, 112, ${0.2 + intensity * 0.75})`;
          return (
            <path
              key={location.id}
              d={location.path}
              fill={fill}
              className="state-shape"
              onMouseEnter={(e) => handleMouseMove(e, location.name)}
              onMouseMove={(e) => handleMouseMove(e, location.name)}
              onMouseLeave={handleMouseLeave}
              onClick={() => onSelect(isSelected ? '' : location.name)}
            >
              <title>{location.name}: {row ? `${row.projects} projects, avg risk ${row.average_risk.toFixed(1)}%` : 'No analyzed projects'}</title>
            </path>
          );
        })}
      </svg>
      <div className="map-note">
        {selected ? (
          <span>Selected state: <strong style={{ color: 'var(--deep)' }}>{selected}</strong> (Click to deselect)</span>
        ) : (
          <span>Hover or select a state to inspect jurisdictional risk concentration.</span>
        )}
      </div>
    </div>
  );
}

function DashboardPage() {
  const location = useLocation();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null); const [compliance, setCompliance] = useState<any>(null); const [coverage, setCoverage] = useState<any>(null); const [fraudSummary, setFraudSummary] = useState<any>(null); const [reviewError, setReviewError] = useState(''); const { filters, change } = useDashboardFilters(); const [selectedState, setSelectedState] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const selectedRunId = new URLSearchParams(location.search).get('run_id');

  const handleDownloadStateCSV = async () => {
    setIsExporting(true);
    try {
      const currentState = selectedState || filters.state || '';
      const params: Record<string, any> = {
        page: 1,
        page_size: 5000,
      };
      if (currentState) {
        params.state = currentState;
      }
      if (selectedRunId) {
        params.run_id = selectedRunId;
      }
      if (filters.category) {
        params.category = filters.category;
      }
      if (filters.risk_level) {
        params.risk_level = filters.risk_level;
      }
      const response = await axios.get(`${API_BASE}/api/projects`, { params });
      const records = response.data?.records || response.data?.items || [];
      const filename = currentState
        ? `${currentState.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_projects_audit.csv`
        : 'all_states_projects_audit.csv';
      exportProjectsCSV(records, filename);
    } catch (err) {
      console.error('Failed to export state projects CSV', err);
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => { axios.get(`${API_BASE}/api/dashboard`, { params: { run_id: selectedRunId || undefined, state: selectedState || filters.state || undefined, category: filters.category || undefined, risk_level: filters.risk_level || undefined } }).then(response => { setDashboard(response.data); change('stateOptions', (response.data.state_options || []).join('|')); }); }, [selectedRunId, selectedState, filters.state, filters.category, filters.risk_level]);
  useEffect(() => { const params = { run_id: selectedRunId || undefined }; setReviewError(''); Promise.all([axios.get(`${API_BASE}/api/compliance/summary`, { params }), axios.get(`${API_BASE}/api/integration/coverage`, { params }), axios.get(`${API_BASE}/api/fraud-risk/summary`, { params })]).then(([findings, sourceCoverage, fraud]) => { setCompliance(findings.data); setCoverage(sourceCoverage.data); setFraudSummary(fraud.data); }).catch(() => setReviewError('Compliance, fraud-risk, and source coverage could not be loaded for this analysis run.')); }, [selectedRunId]);
  if (!dashboard) return <div className="page-loading">Loading intelligence workspace...</div>;
    const riskData = levels.map(level => ({ name: level, value: dashboard.risk_distribution?.[level] || 0 }));
  const stateData = (dashboard.state_wise || []).slice(0, 8).map(row => ({ name: row.name.replace(' Pradesh', ''), risk: Number(row.average_risk.toFixed(1)), projects: row.projects }));
  return <div className="page-stack"><div className="page-heading"><div><div className="eyebrow">NATIONAL PROJECT REVIEW</div><h1>Public project review</h1><p>Clear, evidence-based information to help officers decide what needs a closer look.</p></div><div className="heading-meta"><span className="live-dot" />DATA UPDATED<small>{dateText(dashboard.last_analysis)}</small></div></div>
    {dashboard.total_projects === 0 && <div className="notice demo-notice"><strong>No project data yet</strong><span>Upload one or more project files to begin. The overview will update from your files.</span></div>}
    <FilterBar values={filters} onChange={change} />
    <section className="kpi-grid"><Stat label="Projects analyzed" value={dashboard.total_projects.toLocaleString('en-IN')} detail="Across monitored records" /><Stat label="Sanctioned value" value={compactMoney(dashboard.total_sanction_amount)} detail={money(dashboard.total_sanction_amount)} tone="gold" /><Stat label="Expenditure" value={compactMoney(dashboard.total_expenditure)} detail={`${pct(dashboard.total_utilization_ratio)} overall utilization`} tone="blue" /><Stat label="High risk" value={String(dashboard.high_risk_projects)} detail={`${dashboard.critical_projects} critical cases`} tone="orange" /><Stat label="Open alerts" value={String(dashboard.active_alerts)} detail="Signals requiring review" tone="red" /></section>
    {reviewError ? <section className="notice">{reviewError}</section> : compliance && (
      <section className="panel compliance-panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">COMPLIANCE & FRAUD RISK TRIAGE</div>
            <h2>{compliance.total_findings} findings flagged for administrative verification</h2>
            <p className="muted">Statistical divergences and deterministic checks serve as verification prompts for authorized officers, not automatic confirmation of irregularities.</p>
          </div>
          <Link to="/alerts" className="button secondary">View all alerts</Link>
        </div>
        <div className="risk-summary">
          {Object.entries(compliance.by_severity || {}).map(([level, count]) => (
            <div key={level}>
              <RiskBadge level={level} />
              <span>{level} findings</span>
              <strong>{String(count)}</strong>
            </div>
          ))}
        </div>
        {fraudSummary && (
          <div className="fraud-summary-section" style={{ marginTop: 18 }}>
            <h3 style={{ fontSize: 13, color: 'var(--deep)', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fraud-Risk Pattern Indicators</h3>
            <div className="fraud-chips-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <div className="stat-block" style={{ padding: '12px 14px', background: '#fafcfb', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)' }}>
                <span className="stat-label">Projects with signals</span>
                <strong className="stat-value" style={{ fontSize: 20 }}>{fraudSummary.projects_with_signals}</strong>
              </div>
              <div className="stat-block" style={{ padding: '12px 14px', background: '#fafcfb', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)' }}>
                <span className="stat-label">Project splitting</span>
                <strong className="stat-value" style={{ fontSize: 20 }}>{fraudSummary.project_splitting_count}</strong>
              </div>
              <div className="stat-block" style={{ padding: '12px 14px', background: '#fafcfb', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)' }}>
                <span className="stat-label">Payment timing</span>
                <strong className="stat-value" style={{ fontSize: 20 }}>{fraudSummary.payment_timing_anomaly_count}</strong>
              </div>
              <div className="stat-block" style={{ padding: '12px 14px', background: '#fafcfb', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)' }}>
                <span className="stat-label">Duplicate payments</span>
                <strong className="stat-value" style={{ fontSize: 20 }}>{fraudSummary.duplicate_payment_count}</strong>
              </div>
              <div className="stat-block" style={{ padding: '12px 14px', background: '#fafcfb', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)' }}>
                <span className="stat-label">Repeated works</span>
                <strong className="stat-value" style={{ fontSize: 20 }}>{fraudSummary.repeated_work_count}</strong>
              </div>
            </div>
          </div>
        )}
        <div style={{ marginTop: 18 }}>
          <h3 style={{ fontSize: 13, color: 'var(--deep)', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Top Review Guidance</h3>
          <ul className="plain-list">
            {(compliance.items || []).slice(0, 5).map((item: any, index: number) => (
              <li key={`${item.rule_code}-${index}`}>
                <strong>{item.title}</strong> — {item.recommended_action}
              </li>
            ))}
          </ul>
        </div>
        {coverage && <p className="muted" style={{ marginTop: 12, fontSize: 11 }}>Source coverage: {Object.entries(coverage.coverage_percentages || {}).map(([role, value]) => `${role}: ${value}%`).join(' · ') || 'Not available'}. Ambiguous records: {(coverage.ambiguous_matches || []).length}; unmatched rows: {(coverage.unmatched_rows || []).length}.</p>}
      </section>
    )}
    <div className="grid-2-1"><section className="panel map-panel"><div className="panel-head"><div><div className="eyebrow">STATE VIEW</div><h2>Where do projects need attention?</h2></div><div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}><button className="button secondary" onClick={handleDownloadStateCSV} disabled={isExporting} title={selectedState ? `Download CSV project register for ${selectedState}` : 'Download CSV project register for all states'}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>{isExporting ? 'Exporting...' : selectedState ? `Download CSV (${selectedState})` : 'Download CSV'}</button><button className="button ghost" onClick={() => { setSelectedState(''); change('state', ''); }}>All states</button></div></div><div className="map-layout"><StateMap dashboard={dashboard} selected={selectedState} onSelect={state => { setSelectedState(state); change('state', state); }} /><div className="state-insight"><div className="eyebrow">SELECTED STATE</div><h3>{selectedState || 'All India'}</h3>{selectedState ? <>{(() => { const row = dashboard.state_wise.find(item => item.name === selectedState); return row ? <><div className="insight-number">{row.average_risk.toFixed(1)}<small> avg risk</small></div><div className="insight-list"><div><span>Projects</span><strong>{row.projects}</strong></div><div><span>Sanctioned</span><strong>{compactMoney(row.sanctioned)}</strong></div><div><span>High risk</span><strong>{row.high_risk}</strong></div><div><span>Critical</span><strong>{row.critical}</strong></div></div><div style={{ marginTop: 14 }}><button className="button secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleDownloadStateCSV} disabled={isExporting}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>{isExporting ? 'Preparing export...' : `Export ${selectedState} CSV`}</button></div></> : <EmptyState title="No records" text="This state has no analyzed records." />; })()}</> : <><div className="insight-number">{dashboard.total_utilization_ratio ? pct(dashboard.total_utilization_ratio) : '—'}<small> national utilization</small></div><div className="insight-list"><div><span>States covered</span><strong>{dashboard.state_wise.length}</strong></div><div><span>High risk</span><strong>{dashboard.high_risk_projects}</strong></div><div><span>Alerts</span><strong>{dashboard.active_alerts}</strong></div></div><div style={{ marginTop: 14 }}><button className="button secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleDownloadStateCSV} disabled={isExporting}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>{isExporting ? 'Preparing export...' : 'Export National CSV'}</button></div></>}</div></div></section>
      <section className="panel"><div className="panel-head"><div><div className="eyebrow">RISK PROFILE</div><h2>Projects by review level</h2></div><Link to="/alerts" className="text-link">Open reminders →</Link></div><div className="donut-wrap"><ResponsiveContainer width="60%" height={220}><PieChart><Pie data={riskData} dataKey="value" innerRadius={62} outerRadius={88} paddingAngle={3}>{riskData.map(item => <Cell key={item.name} fill={palette[item.name]} />)}</Pie><Tooltip formatter={(value: any, name: any) => [`${value} projects`, name]} /></PieChart></ResponsiveContainer><div className="risk-list">{riskData.map(item => <div key={item.name}><span className="risk-key" style={{ background: palette[item.name] }} />{item.name}<strong>{item.value}</strong></div>)}</div></div></section></div>
    <div className="grid-2"><section className="panel chart-panel"><div className="panel-head"><div><div className="eyebrow">STATE COMPARISON</div><h2>Average risk by state</h2></div></div><ResponsiveContainer width="100%" height={250}><BarChart data={stateData} margin={{ left: 0, right: 10, bottom: 25 }}><CartesianGrid strokeDasharray="3 3" stroke="#dbe5e1" vertical={false} /><XAxis dataKey="name" angle={-25} textAnchor="end" height={55} tick={{ fill: '#65736e', fontSize: 11 }} /><YAxis tick={{ fill: '#65736e', fontSize: 11 }} /><Tooltip /><Bar dataKey="risk" fill="#238f82" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></section><section className="panel chart-panel"><div className="panel-head"><div><div className="eyebrow">OPERATIONAL SIGNAL</div><h2>Delayed completion profile</h2></div></div><ResponsiveContainer width="100%" height={250}><LineChart data={dashboard.delay_distribution}><CartesianGrid strokeDasharray="3 3" stroke="#dbe5e1" vertical={false} /><XAxis dataKey="range" tick={{ fill: '#65736e', fontSize: 11 }} /><YAxis tick={{ fill: '#65736e', fontSize: 11 }} /><Tooltip /><Line type="monotone" dataKey="projects" stroke="#d57c4c" strokeWidth={3} dot={{ fill: '#d57c4c', r: 4 }} /></LineChart></ResponsiveContainer></section></div>
    <section className="panel attention-panel"><div className="panel-head"><div><div className="eyebrow">PROJECTS TO CHECK</div><h2>Priority attention required</h2><p>Projects with the strongest reasons for a closer review.</p></div><Link to="/risk" className="button secondary">View all projects to check</Link></div><ProjectTable projects={dashboard.top_projects} compact /></section>
  </div>;
}

function ProjectTable({ projects, compact = false }: { projects: Project[]; compact?: boolean }) { 
  const navigate = useNavigate(); 
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Project</th>
            <th>Location</th>
            <th>Category</th>
            <th>Sanctioned</th>
            <th>Expenditure</th>
            <th>Used</th>
            <th>Delay</th>
            <th>Review Score</th>
            <th>Review Level</th>
            <th aria-label="Open project" />
          </tr>
        </thead>
        <tbody>
          {projects.length ? (
            projects.map(project => (
              <tr key={project.id} onClick={() => navigate(`/projects/${project.id}`)}>
                <td>
                  <strong>{projectTitle(project)}</strong>
                  <small>{project.project_code || `PROJECT-${project.id}`}</small>
                </td>
                <td>
                  {project.state || 'Not recorded'}
                  <small>{project.district || 'Not recorded'}</small>
                </td>
                <td>{project.category || 'Not recorded'}</td>
                <td className="tabular-nums"><strong>{compactMoney(project.sanction_amount)}</strong></td>
                <td className="tabular-nums">{compactMoney(project.expenditure)}</td>
                <td className="tabular-nums">{pct(typeof project.utilization_ratio === 'number' ? Math.max(0, project.utilization_ratio) : 0)}</td>
                <td className="tabular-nums">{typeof project.delay_days === 'number' && project.delay_days > 0 ? `${Math.round(project.delay_days)}d delay` : 'On time'}</td>
                <td className="tabular-nums">
                  {typeof project.risk_score === 'number' && Number.isFinite(project.risk_score) ? `${Math.min(100, Math.max(0, project.risk_score)).toFixed(1)}%` : '—'}{' '}
                  {project.ml_anomaly_flag && <span className="signal-chip">Anomaly</span>}
                </td>
                <td><RiskBadge level={reviewLevel(project)} /></td>
                <td><span className="row-arrow">→</span></td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={10}><EmptyState title="No projects match" text="Clear a filter or broaden the search." /></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  ); 
}

function exportProjectsCSV(projects: Project[], filename = 'mplads_audit_export.csv') {
  const headers = ['Project Code', 'Project Name', 'State', 'District', 'Category', 'Sanctioned (INR)', 'Expenditure (INR)', 'Utilization', 'Delay (Days)', 'Risk Score', 'Risk Level'];
  const rows = projects.map(p => [
    `"${p.project_code || p.id}"`,
    `"${(p.project_name || '').replace(/"/g, '""')}"`,
    `"${p.state || ''}"`,
    `"${p.district || ''}"`,
    `"${p.category || ''}"`,
    p.sanction_amount ?? 0,
    p.expenditure ?? 0,
    p.utilization_ratio ? `${(p.utilization_ratio * 100).toFixed(1)}%` : '0%',
    p.delay_days ? Math.round(p.delay_days) : 0,
    p.risk_score ? `${p.risk_score.toFixed(1)}%` : '0%',
    `"${p.risk_level || 'LOW'}"`
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function RiskPage() { 
  const [projects, setProjects] = useState<Project[]>([]); 
  const [query, setQuery] = useState(''); 
  const [level, setLevel] = useState(''); 
  const [state, setState] = useState('');
  const [states, setStates] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [riskCounts, setRiskCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    axios.get(`${API_BASE}/api/dashboard`).then(res => {
      if (res.data?.state_options) setStates(res.data.state_options);
    }).catch(() => {});
  }, []);

  useEffect(() => { 
    axios.get(`${API_BASE}/api/projects`, {
      params: {
        page,
        page_size: pageSize,
        search: query || undefined,
        risk_level: level || undefined,
        state: state || undefined
      }
    }).then(response => {
      setProjects(response.data.records || response.data.items || []);
      setTotal(response.data.filtered_count ?? response.data.total_count ?? response.data.total ?? 0);
      setRiskCounts(response.data.risk_counts || {});
    }); 
  }, [query, level, state, page, pageSize]); 

  useEffect(() => setPage(1), [query, level, state, pageSize]);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="page-stack">
      <PageTitle eyebrow="AUDIT TRIAGE WORKSPACE" title="Risk Intelligence" subtitle="Prioritize human review using explainable model and rule signals." />
      <div className="risk-summary">
        {levels.map(item => (
          <div
            key={item}
            style={{ cursor: 'pointer', background: level === item ? '#f0f7f4' : undefined }}
            onClick={() => setLevel(level === item ? '' : item)}
            title={`Filter by ${item}`}
          >
            <span className="risk-key" style={{ background: palette[item] }} />
            <span>{item}</span>
            <strong>{riskCounts[item] || 0}</strong>
          </div>
        ))}
      </div>
      <div className="toolbar">
        <div className="table-search">
          ⌕<input placeholder="Search project, location, constituency..." value={query} onChange={event => setQuery(event.target.value)} />
        </div>
        <select value={state} onChange={event => setState(event.target.value)}>
          <option value="">All states</option>
          {states.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={level} onChange={event => setLevel(event.target.value)}>
          <option value="">All risk levels</option>
          {levels.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={pageSize} onChange={event => setPageSize(Number(event.target.value))}>
          <option value={25}>25 per page</option>
          <option value={50}>50 per page</option>
          <option value={100}>100 per page</option>
        </select>
        <span className="toolbar-count">{(total || 0).toLocaleString('en-IN')} matching {total === 1 ? 'project' : 'projects'}</span>
        <button className="button secondary" onClick={() => exportProjectsCSV(projects, 'risk_intelligence_projects.csv')}>Export CSV</button>
        <button className="button ghost" onClick={() => window.print()}>Print view</button>
      </div>
      <section className="panel table-panel">
        <ProjectTable projects={projects} />
        <div className="pagination">
          <button className="button ghost" disabled={page === 1 || total === 0} onClick={() => setPage(value => value - 1)}>Previous</button>
          <span>{total > 0 ? `Page ${page} of ${pages} · Showing ${projects.length} of ${(total || 0).toLocaleString('en-IN')}` : '0 matching projects'}</span>
          <button className="button ghost" disabled={page >= pages || total === 0} onClick={() => setPage(value => value + 1)}>Next</button>
        </div>
      </section>
    </div>
  ); 
}
function PageTitle({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) { 
  return <div className="page-heading simple"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div></div>; 
}

function downloadProjectReport(project: Project, explanation: any, similar: any[]) {
  const escapeHtml = (value: unknown) => String(value ?? 'Not available').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character] || character));
  const rows = [
    ['Project ID', project.project_code || project.id],
    ['Project name', projectTitle(project)],
    ['State', project.state || 'Not recorded'],
    ['District', project.district || 'Not recorded'],
    ['Constituency', project.constituency || 'Not recorded'],
    ['MP', project.mp_name || 'Not recorded'],
    ['Category', project.category || 'Not recorded'],
    ['Vendor', project.vendor_name || 'Not recorded'],
    ['Status', project.status || 'Active'],
    ['Sanctioned amount', money(project.sanction_amount)],
    ['Amount spent', money(project.expenditure)],
    ['Amount used', pct(typeof project.utilization_ratio === 'number' ? Math.max(0, project.utilization_ratio) : undefined)],
    ['Delay', project.delay_days && project.delay_days > 0 ? `${Math.round(project.delay_days)} days` : 'No delay recorded'],
    ['Review level', reviewLevel(project)],
    ['Review score', typeof project.risk_score === 'number' && Number.isFinite(project.risk_score) ? `${Math.min(100, Math.max(0, project.risk_score)).toFixed(1)}%` : '—'],
    ['Payment status', project.payment_status || 'Standard'],
  ];
  const issues = (explanation?.why_flagged || project.reasons || ['No specific issue recorded.']).map((item: string) => `<li>${escapeHtml(item)}</li>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Project report - ${escapeHtml(project.project_name)}</title><style>body{font:15px Arial;color:#173f3b;max-width:900px;margin:40px auto;line-height:1.5}h1{margin-bottom:4px}h2{border-bottom:2px solid #dce8e3;padding-bottom:8px;margin-top:28px}table{border-collapse:collapse;width:100%}td{padding:9px;border-bottom:1px solid #dce8e3}td:first-child{font-weight:700;width:32%}li{margin:8px 0}.card{background:#f5f8f6;padding:16px;border-radius:8px}</style></head><body><h1>${escapeHtml(project.project_name)}</h1><p>Project report for field review</p><h2>Project details</h2><table>${rows.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`).join('')}</table><h2>What needs checking</h2><div class="card"><ul>${issues}</ul></div><h2>Records to request</h2><div class="card"><ul>${(explanation?.recommended_verification || ['Approval papers', 'Bills and payment records', 'Completion proof', 'Site photographs']).map((item: string) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div><h2>Comparable projects</h2><table>${similar.slice(0, 10).map(item => `<tr><td>${escapeHtml(item.project_code || item.id)}</td><td>${escapeHtml(item.project_name)}</td><td>${escapeHtml(item.state || 'Not recorded')} · ${escapeHtml(item.category || 'General')}</td><td>${escapeHtml(Math.min(100, Math.max(0, Math.round(Number(item.similarity || 0)))))}% similar</td></tr>`).join('') || '<tr><td colspan="4">No comparable projects found.</td></tr>'}</table><p>Prepared from the uploaded project records. Review signals are prompts for checking records, not proof of wrongdoing.</p></body></html>`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  link.download = `${project.project_code || `project-${project.id}`}-report.html`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function ProjectOverview({ project, explanation }: { project: Project; explanation: any }) {
  const title = projectTitle(project);
  const approved = project.sanction_amount || 0;
  const spent = project.expenditure || 0;
  const remaining = approved - spent;
  const financialData = [
    { name: 'Approved', amount: approved },
    { name: 'Spent', amount: spent },
    { name: 'Remaining', amount: Math.max(remaining, 0) },
  ];
  const checks = explanation?.recommended_verification || ['Approval papers', 'Bills and payment records', 'Completion proof', 'Site photographs'];
  return <><section className="panel project-intro-panel"><div className="eyebrow">PROJECT AT A GLANCE</div><div className="project-intro-grid"><div><h2>{title}</h2><p className="project-description">This is a {project.category || 'public'} project being carried out in {project.district || 'the recorded district'}, {project.state || 'the recorded state'}. It falls under {project.constituency || 'the recorded constituency'} and is linked to {project.mp_name || 'the recorded MP'}.</p><p className="project-description">The review team should confirm that the approved work, spending, supplier, progress, and completion evidence all describe the same project.</p></div><div className="project-facts"><div><span>Project number</span><strong>{project.project_code || `PROJECT-${project.id}`}</strong></div><div><span>Sector</span><strong>{project.category || 'Not recorded'}</strong></div><div><span>State</span><strong>{project.state || 'Not recorded'}</strong></div><div><span>District</span><strong>{project.district || 'Not recorded'}</strong></div><div><span>Constituency</span><strong>{project.constituency || 'Not recorded'}</strong></div><div><span>MP</span><strong>{project.mp_name || 'Not recorded'}</strong></div><div><span>Supplier</span><strong>{project.vendor_name || 'Not recorded'}</strong></div><div><span>Implementing office</span><strong>{project.agency || 'Not recorded'}</strong></div></div></div></section><div className="project-insight-grid"><section className="panel chart-panel"><div className="eyebrow">MONEY BREAKDOWN</div><h2>Approved, spent, and remaining</h2><ResponsiveContainer width="100%" height={220}><BarChart data={financialData} margin={{ left: 10, right: 10, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="#dbe5e1" vertical={false} /><XAxis dataKey="name" tick={{ fill: '#65736e', fontSize: 11 }} /><YAxis tick={{ fill: '#65736e', fontSize: 11 }} tickFormatter={value => `₹${Math.round(Number(value) / 100000)}L`} /><Tooltip formatter={(value: any) => [money(Number(value)), 'Amount']} /><Bar dataKey="amount" fill="#238f82" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer><table className="detail-table"><tbody><tr><th>Approved amount</th><td>{money(approved)}</td></tr><tr><th>Spent so far</th><td>{money(spent)}</td></tr><tr><th>Amount left</th><td>{remaining >= 0 ? money(remaining) : `Overspent by ${money(Math.abs(remaining))}`}</td></tr><tr><th>Use of approved amount</th><td>{pct(typeof project.utilization_ratio === 'number' ? Math.max(0, project.utilization_ratio) : undefined)}</td></tr></tbody></table></section><section className="panel"><div className="eyebrow">AUDITOR'S CHECKLIST</div><h2>What to look for</h2><div className="audit-checklist">{checks.slice(0, 6).map((item: string, index: number) => <div key={item}><span>{index + 1}</span><div><strong>{item}</strong><small>Confirm this record matches the project number, location, amount, and dates.</small></div></div>)}</div></section></div></>;
}

function ProjectDetailPage() { 
  const { id } = useParams(); 
  const location = useLocation(); const runId = new URLSearchParams(location.search).get('run_id');
  const [project, setProject] = useState<Project | null>(null); 
  const [modal, setModal] = useState(false); 
  const [saved, setSaved] = useState(''); 
  const [authority, setAuthority] = useState('District audit officer'); 
  const [notes, setNotes] = useState(''); 
  const [projectNotes, setProjectNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [explanation, setExplanation] = useState<any>(null);
  const [similar, setSimilar] = useState<any[]>([]);
  const [auditFile, setAuditFile] = useState<any>(null);
  const [compliance, setCompliance] = useState<any[]>([]);
  const [fraudRisk, setFraudRisk] = useState<any>(null);
  const [fraudDisposition, setFraudDisposition] = useState('Requires Evidence');
  const [fraudReason, setFraudReason] = useState('');
  const [fraudEvidence, setFraudEvidence] = useState('');
  const [loadError, setLoadError] = useState('');
  const params = { run_id: runId || undefined };
  const reloadAuditFile = async () => setAuditFile((await axios.get(`${API_BASE}/api/projects/${id}/audit-file`, { params })).data);

  useEffect(() => { 
    Promise.all([
      axios.get(`${API_BASE}/api/projects/${id}`, { params }),
      axios.get(`${API_BASE}/api/projects/${id}/explanation`, { params }),
      axios.get(`${API_BASE}/api/projects/${id}/similar`, { params }),
      axios.get(`${API_BASE}/api/projects/${id}/audit-file`, { params }),
      axios.get(`${API_BASE}/api/projects/${id}/compliance`, { params }),
      axios.get(`${API_BASE}/api/projects/${id}/fraud-risk`, { params })
    ]).then(([projectResponse, explanationResponse, similarResponse, auditResponse, complianceResponse, fraudResponse]) => {
      setProject(projectResponse.data);
      setExplanation(explanationResponse.data);
      setSimilar(similarResponse.data.items || []);
      setAuditFile(auditResponse.data);
      if (auditResponse.data?.notes) setProjectNotes(auditResponse.data.notes);
      setCompliance(complianceResponse.data.items || []);
      setFraudRisk(fraudResponse.data);
    }).catch(error => setLoadError(error instanceof Error ? error.message : 'Unable to load this project.'));
  }, [id, runId]);

  if (loadError) return <div className="page-stack"><section className="panel"><h2>Unable to open this project</h2><p>{loadError}</p><Link className="text-link" to="/projects">Return to projects</Link></section></div>;
  if (!project) return <div className="page-loading">Loading investigation workspace...</div>; 

  const saveProjectNotes = async () => {
    setSavingNotes(true);
    try {
      await axios.post(`${API_BASE}/api/projects/${project.id}/notes`, { notes: projectNotes });
      await reloadAuditFile();
      setSaved('Auditor notes saved to project file');
    } catch {
      setSaved('Failed to save project notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const createCase = async () => { 
    await axios.post(`${API_BASE}/api/audit-cases`, {
      project_id: project.id,
      title: `Review: ${project.project_name}`,
      priority: project.risk_level === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      assigned_authority: authority,
      notes: notes || projectNotes
    }); 
    setSaved('Audit case created and assigned'); 
    setModal(false); 
  }; 
  const markReviewed = async () => { await axios.patch(`${API_BASE}/api/projects/${project.id}/audit-status`, { status: 'Under Review' }); await reloadAuditFile(); setSaved('Project review status saved'); };
  const toggleChecklist = async (item: string, completed: boolean) => { await axios.post(`${API_BASE}/api/projects/${project.id}/documents/checklist`, { item, completed }); await reloadAuditFile(); };
  const reviewFraudSignal = async (signalCode: string) => { await axios.post(`${API_BASE}/api/projects/${project.id}/fraud-risk/reviews`, { signal_code: signalCode, disposition: fraudDisposition, decision_reason: fraudReason, evidence_reference: fraudEvidence }, { params }); const refreshed = await axios.get(`${API_BASE}/api/projects/${project.id}/fraud-risk`, { params }); setFraudRisk(refreshed.data); setSaved('Fraud-risk signal review saved'); };
  const components = project.signal_components || {}; 
  const isCalamity = project.category === 'Calamity Relief' || project.calamity_type; 
  const level = reviewLevel(project);
  const utilization = Math.max(0, Number(project.utilization_ratio || 0));
  const signalRows = [
    ['Use of funds', utilization],
    ['Delay', components.delay_score_component ?? 0],
    ['Cost increase', components.cost_overrun_score_component ?? 0],
    ['Comparison with similar works', components.peer_deviation_score_component ?? 0],
    ['Repeated record check', components.duplicate_score_component ?? 0],
    ['Missing information', components.data_quality_score_component ?? 0],
  ];
  const signalPercent = (value: unknown) => {
    const numeric = Math.max(0, Number(value || 0));
    return `${(numeric * 100).toFixed(1)}%`;
  };
  const verificationItems = explanation?.recommended_verification || ['Approval papers', 'Bills and payment records', 'Completion proof', 'Site photographs'];
  const completedChecksCount = verificationItems.filter((item: string) => Boolean(auditFile?.checklist?.find((entry: any) => entry.item === item)?.completed)).length;

  return <div className="page-stack">
    <div className="page-actions"><Link className="text-link" to="/projects">← Back to projects</Link><div className="action-row"><button className="button secondary" onClick={() => downloadProjectReport(project, explanation, similar)}>Download project report</button><button className="button secondary" onClick={() => { setNotes(projectNotes || ''); setModal(true); }}>Create review case</button><button className="button primary" onClick={markReviewed}>Mark reviewed</button></div></div>
    {saved && (
      <div className="notice" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{saved}</span>
        <button type="button" onClick={() => setSaved('')} style={{ background: 'transparent', border: 0, cursor: 'pointer', fontSize: 16 }}>×</button>
      </div>
    )}
    <section className="panel project-header">
      <div className="eyebrow">PROJECT REPORT · {project.project_code || `PROJECT-${project.id}`}</div>
      <h1>{projectTitle(project)}</h1>
      <p>{[project.state, project.district, project.constituency, project.category, project.mp_name && `MP: ${project.mp_name}`].filter(Boolean).join(' · ') || 'Location details not recorded'}</p>
      <div className="risk-summary"><div><span>Review level</span><strong>{typeof project.risk_score === 'number' && Number.isFinite(project.risk_score) ? `${Math.min(100, Math.max(0, project.risk_score)).toFixed(1)}%` : '—'}</strong></div><div style={{ display: 'flex', alignItems: 'center' }}><RiskBadge level={level} /></div></div>
    </section>
    <ProjectOverview project={project} explanation={explanation} />

    {/* AUDITOR FIELD NOTES & VOICE DICTATION */}
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">MICROPHONE VOICE DICTATION</div>
          <h2>Auditor Field Notes & Observations</h2>
          <p>Dictate inspection observations using your microphone or record physical verification findings hands-free.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              setNotes(projectNotes);
              setModal(true);
            }}
            title="Open review case modal with these notes"
          >
            Transfer to Review Case →
          </button>
        </div>
      </div>
      <VoiceDictation
        id="project-field-notes"
        value={projectNotes}
        onChange={setProjectNotes}
        onSave={saveProjectNotes}
        isSaving={savingNotes}
        placeholder="Click 'Dictate with voice' and speak observations (e.g. site inspection, physical measurement, voucher reconciliation, contractor delays)..."
        minHeight={120}
      />
    </section>

    <section className="panel"><div className="eyebrow">POTENTIAL FRAUD-RISK SIGNALS</div><h2>Evidence requiring review</h2><p className="muted">{fraudRisk?.disclaimer || 'Loading review signals…'}</p>{fraudRisk?.signals?.length ? <><div className="toolbar"><select value={fraudDisposition} onChange={event => setFraudDisposition(event.target.value)}><option>Requires Evidence</option><option>Cleared</option><option>Escalated</option><option>Irregularity Confirmed</option><option>Referred for Investigation</option><option>False Positive</option></select><input placeholder="Decision reason" value={fraudReason} onChange={event => setFraudReason(event.target.value)} /><input placeholder="Evidence reference" value={fraudEvidence} onChange={event => setFraudEvidence(event.target.value)} /></div><ul className="plain-list">{fraudRisk.signals.map((item: any, index: number) => <li key={`${item.signal_code}-${index}`}><strong>{item.title}</strong> ({item.severity}, {Math.min(100, Math.max(0, Math.round((Number(item.confidence) || 0) * 100)))}%) — {item.explanation || 'Signal flagged for audit inspection'}<small>{item.recommended_verification || 'Verify supporting documents.'}</small><button className="button ghost" type="button" onClick={() => reviewFraudSignal(item.signal_code)}>Save review disposition</button></li>)}</ul></> : <EmptyState title="No potential fraud-risk signals" text="No deterministic indicator was available for this project." />}</section>
    <section className="panel"><div className="eyebrow">PROJECT COMPLIANCE</div><h2>Review findings</h2><p className="muted">Each item is a human-review signal, not a confirmed finding.</p>{compliance.length ? <ul className="plain-list">{compliance.map((item, index) => <li key={`${item.rule_code}-${index}`}><strong>{item.title}</strong> ({item.severity}) — {item.explanation || 'Rule variance flagged'}<small>{item.recommended_action || 'Review record details.'}</small></li>)}</ul> : <EmptyState title="No compliance findings" text="No deterministic compliance issue was available for this project." />}</section>
    <section className="panel"><div className="eyebrow">WHY THIS PROJECT NEEDS A CLOSER LOOK</div><h2>Things to check</h2><p className="muted">Audit status: <strong>{auditFile?.audit_status || 'Not Reviewed'}</strong></p><ul className="plain-list">{(explanation?.why_flagged || project.reasons || ['No specific issue recorded.']).map((reason: string) => <li key={reason}>{reason}</li>)}</ul><div style={{ marginTop: 16 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}><h3 style={{ margin: 0 }}>Records to request</h3><span className="notice-tag">{completedChecksCount} of {verificationItems.length} verified</span></div><ul className="plain-list">{verificationItems.map((item: string) => { const completed = Boolean(auditFile?.checklist?.find((entry: any) => entry.item === item)?.completed); return <li key={item}><label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><input type="checkbox" checked={completed} onChange={event => toggleChecklist(item, event.target.checked)} /> <span style={{ textDecoration: completed ? 'line-through' : undefined, color: completed ? 'var(--muted)' : undefined }}>{item}</span></label></li>; })}</ul></div></section>
    <section className="panel progress-panel"><div className="eyebrow">PROJECT PROGRESS</div><h2>Timeline and checks</h2><div className="metric-grid">{signalRows.map(([label, value]) => <div className="metric-card" key={label}><span>{label}</span><strong>{signalPercent(value)}</strong><div className="metric-bar"><i style={{ width: `${Math.min(100, Math.max(0, Number(value || 0) * 100))}%` }} /></div></div>)}</div><p className="muted">{project.delay_days && project.delay_days > 0 ? `${Math.round(project.delay_days)} days recorded between planned and actual completion.` : 'No delay recorded in the uploaded dates.'}</p></section>
    <section className="panel comparable-panel"><div className="eyebrow">COMPARABLE PROJECTS</div><h2>Other works to compare</h2><div className="similar-list">{similar.length ? similar.slice(0, 10).map(item => <Link className="similar-item" to={`/projects/${item.id}${runId ? `?run_id=${encodeURIComponent(runId)}` : ''}`} key={item.id}><strong>{item.project_code || item.id}</strong><span>{projectTitle(item)}</span><span>{money(item.expenditure)} · <b>{item.risk_level || reviewLevel(item)}</b></span></Link>) : <p className="muted">No comparable projects found.</p>}</div></section>

    {/* CREATE REVIEW CASE MODAL WITH VOICE DICTATION */}
    {modal && (
      <div className="modal-backdrop">
        <section className="modal panel" style={{ maxWidth: 580, width: '92%' }}>
          <button className="modal-close" onClick={() => setModal(false)}>×</button>
          <div className="eyebrow">AUDIT CASE CREATION</div>
          <h2>Create review case</h2>
          <p className="muted" style={{ margin: '0 0 16px', fontSize: 12 }}>
            Assign a case for closer investigation. Dictate observations using your microphone or type instructions.
          </p>

          <div className="provision-field" style={{ marginBottom: 14 }}>
            <label className="provision-label">Responsible Authority / Officer</label>
            <input className="provision-input" value={authority} onChange={event => setAuthority(event.target.value)} />
          </div>

          <div style={{ marginTop: 12 }}>
            <VoiceDictation
              id="modal-case-notes"
              label="Case Notes & Instructions"
              value={notes}
              onChange={setNotes}
              placeholder="Speak or type auditor instructions, vouchers requiring verification, or physical inspection directives..."
              minHeight={110}
            />
          </div>

          <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="button ghost" onClick={() => setModal(false)}>Cancel</button>
            <button className="button primary" onClick={createCase}>Save review case</button>
          </div>
        </section>
      </div>
    )}
  </div>;
}

function UploadPage() { 
  const [file, setFile] = useState<File | null>(null); 
  const [status, setStatus] = useState('Upload'); 
  const [result, setResult] = useState<any>(null); 
  const stages = ['Upload', 'Map', 'Validate', 'Analyze', 'Results']; 
  const submit = async (event: FormEvent) => { 
    event.preventDefault(); 
    if (!file) return; 
    const form = new FormData(); 
    form.append('file', file); 
    try { 
      setStatus('Validate'); 
      const validation = await axios.post(`${API_BASE}/api/validate`, form); 
      setResult(validation.data); 
      if (!validation.data.valid) { 
        setStatus('Map'); 
        return; 
      } 
      setStatus('Analyze'); 
      const analysis = await axios.post(`${API_BASE}/api/analyze`, form); 
      setResult({ ...validation.data, ...analysis.data }); 
      setStatus('Results'); 
    } catch (error: any) { 
      setStatus('Results'); 
      setResult({ error: error.response?.data?.detail || 'Analysis failed' }); 
    } 
  }; 
  return <div className="page-stack"><PageTitle eyebrow="DATA INGESTION" title="Upload & Analyze" subtitle="Bring a project register into the monitored evidence pipeline." /><section className="panel upload-panel"><div className="stage-line">{stages.map((stage, index) => <div className={cx('stage', stages.indexOf(status) >= index ? 'complete' : '')} key={stage}><span>{String(index + 1).padStart(2, '0')}</span>{stage}</div>)}</div><form onSubmit={submit} className="upload-form"><div className="drop-zone"><div className="upload-symbol">↑</div><h2>Drop a CSV or XLSX register here</h2><p>Schema validation runs before any model analysis.</p><input type="file" accept=".csv,.xlsx,.xls" onChange={event => setFile(event.target.files?.[0] || null)} /><label className="button secondary" htmlFor="file-picker">Choose dataset</label></div><input id="file-picker" type="file" accept=".csv,.xlsx,.xls" onChange={event => setFile(event.target.files?.[0] || null)} hidden /><div className="upload-side"><div className="eyebrow">SELECTED FILE</div><strong>{file?.name || 'No file selected'}</strong><span>{file ? `${(file.size / 1024).toFixed(1)} KB ready` : 'Supported: CSV, XLSX'}</span><button className="button primary" type="submit" disabled={!file}>Run analysis</button></div></form>{result && <div className="result-panel"><div><div className="eyebrow">ANALYSIS {status.toUpperCase()}</div><h2>{result.error ? 'Validation requires attention' : 'Analysis complete'}</h2></div><div className="result-stats"><span><strong>{result.total_projects || result.rows || 0}</strong> projects</span><span><strong>{result.high_risk_count || 0}</strong> high risk</span><span><strong>{result.critical_count || 0}</strong> critical</span><span><strong>{result.alerts_created || 0}</strong> alerts</span></div><pre>{JSON.stringify(result, null, 2)}</pre></div>}</section></div>; 
}

function AlertsPage() { 
  const [alerts, setAlerts] = useState<Alert[]>([]); 
  const [loading, setLoading] = useState(true);
  useEffect(() => { 
    axios.get(`${API_BASE}/api/alerts`)
      .then(response => setAlerts(response.data?.items || []))
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false)); 
  }, []); 

  if (loading) return <div className="page-loading">Loading review reminders...</div>;

  return (
    <div className="page-stack">
      <PageTitle eyebrow="PROJECTS TO CHECK" title="Review reminders" subtitle="These reminders point to records that may need a closer look." />
      <div className="alert-summary">
        {['CRITICAL', 'HIGH', 'MEDIUM'].map(level => (
          <div key={level} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <RiskBadge level={level} />
            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
              <strong>{alerts.filter(alert => (alert.severity || '').toUpperCase() === level).length}</strong>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>open reminders</span>
            </div>
          </div>
        ))}
      </div>
      <section className="panel alert-panel">
        {alerts.length ? (
          <div className="alert-list">
            {alerts.map(alert => (
              <div className="alert-row" key={alert.id}>
                <RiskBadge level={alert.severity} />
                <div>
                  <strong>{alert.project_name || 'Project record'}</strong>
                  <span>{alert.state || 'Not recorded'} · {alert.district || 'Not recorded'}</span>
                </div>
                <p>{alert.message || 'Review signal identified'}</p>
                <Link to={`/projects/${alert.project_id}`} className="text-link">Open project →</Link>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No reminders" text="There are no project records needing extra attention right now." />
        )}
      </section>
    </div>
  ); 
}

const DEMO_PERSONAS = [
  {
    title: 'Ministry National Admin',
    desc: 'National oversight · Full audit privileges',
    role: 'MINISTRY' as Role,
    login: 'ministry.demo',
    identity_id: 'MINISTRY-DEMO',
    password: 'password123',
  },
  {
    title: 'State Nodal Authority',
    desc: 'State jurisdiction · Karnataka Nodal Cell',
    role: 'STATE_NODAL_AUTHORITY' as Role,
    login: 'karnataka.nodal.demo',
    identity_id: 'STATE-DEMO-KA',
    state: 'Karnataka',
    password: 'password123',
  },
  {
    title: 'District Authority',
    desc: 'District jurisdiction · Bengaluru Urban',
    role: 'DISTRICT_AUTHORITY' as Role,
    login: 'bengaluru.district.demo',
    identity_id: 'DISTRICT-DEMO-BLR',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    password: 'password123',
  },
  {
    title: 'Member of Parliament',
    desc: 'Constituency scope · Bengaluru Central',
    role: 'MEMBER_OF_PARLIAMENT' as Role,
    login: 'mp.demo',
    identity_id: 'MP-DEMO-001',
    state: 'Karnataka',
    constituency: 'Bengaluru Central',
    password: 'password123',
  },
];

function CasesPage() { 
  const [cases, setCases] = useState<AuditCase[]>([]); 
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedCase, setSelectedCase] = useState<AuditCase | null>(null);
  const [caseNotes, setCaseNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [savedNotice, setSavedNotice] = useState('');
  const [newCaseModal, setNewCaseModal] = useState(false);
  const [newCaseDraft, setNewCaseDraft] = useState({
    project_id: '',
    title: '',
    priority: 'HIGH',
    assigned_authority: 'District audit officer',
    notes: '',
  });

  const refresh = () => { 
    axios.get(`${API_BASE}/api/audit-cases`)
      .then(response => setCases(response.data.items || []))
      .catch(() => setCases([]))
      .finally(() => setLoading(false)); 
  }; 

  useEffect(() => { 
    refresh(); 
  }, []); 

  if (loading) return <div className="page-loading">Loading audit cases...</div>; 

  const update = async (id: number, status: string) => { 
    await axios.patch(`${API_BASE}/api/audit-cases/${id}`, { status }); 
    refresh(); 
  }; 

  const openCaseNotes = (item: AuditCase) => {
    setSelectedCase(item);
    setCaseNotes(item.notes || '');
    setSavedNotice('');
  };

  const saveCaseNotes = async () => {
    if (!selectedCase) return;
    setSavingNotes(true);
    try {
      await axios.patch(`${API_BASE}/api/audit-cases/${selectedCase.id}`, { notes: caseNotes });
      setSavedNotice(`Notes saved for CASE-${String(selectedCase.id).padStart(4, '0')}`);
      setTimeout(() => setSavedNotice(''), 4000);
      refresh();
      // Update selected case notes locally
      setSelectedCase(prev => prev ? { ...prev, notes: caseNotes } : null);
    } catch {
      setSavedNotice('Failed to save case notes.');
    } finally {
      setSavingNotes(false);
    }
  };

  const createNewCase = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCaseDraft.project_id) return;
    try {
      await axios.post(`${API_BASE}/api/audit-cases`, newCaseDraft);
      setSavedNotice('New audit case registered with voice notes.');
      setTimeout(() => setSavedNotice(''), 4000);
      setNewCaseModal(false);
      setNewCaseDraft({
        project_id: '',
        title: '',
        priority: 'HIGH',
        assigned_authority: 'District audit officer',
        notes: '',
      });
      refresh();
    } catch {
      setSavedNotice('Unable to create audit case.');
    }
  };

  const filteredCases = statusFilter === 'ALL'
    ? cases
    : cases.filter(item => item.status === statusFilter || (statusFilter === 'OPEN' && item.status === 'Pending Review'));

  return (
    <div className="page-stack">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <PageTitle eyebrow="CASE MANAGEMENT" title="Audit Cases" subtitle="Track human review from open signal to resolution with voice-dictated notes." />
        <button
          className="button primary"
          type="button"
          onClick={() => setNewCaseModal(true)}
          style={{ height: 38 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          + New Audit Case
        </button>
      </div>

      {savedNotice && (
        <div className="notice" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{savedNotice}</span>
          <button type="button" onClick={() => setSavedNotice('')} style={{ background: 'transparent', border: 0, cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
      )}

      <div className="case-summary">
        <div
          style={{ cursor: 'pointer', background: statusFilter === 'ALL' ? '#f0f7f4' : undefined }}
          onClick={() => setStatusFilter('ALL')}
        >
          <span>ALL CASES</span>
          <strong>{cases.length}</strong>
        </div>
        {['OPEN', 'UNDER_REVIEW', 'ESCALATED', 'RESOLVED'].map(status => (
          <div
            key={status}
            style={{ cursor: 'pointer', background: statusFilter === status ? '#f0f7f4' : undefined }}
            onClick={() => setStatusFilter(statusFilter === status ? 'ALL' : status)}
          >
            <span>{status.replace('_', ' ')}</span>
            <strong>{cases.filter(item => item.status === status || (status === 'OPEN' && item.status === 'Pending Review')).length}</strong>
          </div>
        ))}
      </div>

      {/* SELECTED CASE VOICE NOTES INSPECTOR */}
      {selectedCase && (
        <section className="panel" style={{ border: '2px solid var(--teal-border)', background: '#ffffff' }}>
          <div className="panel-head">
            <div>
              <div className="eyebrow" style={{ color: 'var(--teal)' }}>ACTIVE AUDIT CASE INSPECTION</div>
              <h2>CASE-{String(selectedCase.id).padStart(4, '0')}: {selectedCase.title}</h2>
              <p>
                Project: <strong>PROJECT-{selectedCase.project_id}</strong> · Authority: <strong>{selectedCase.assigned_authority || 'Unassigned'}</strong> · Status: <strong>{selectedCase.status}</strong>
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Link to={`/projects/${selectedCase.project_id}`} className="button secondary" style={{ fontSize: 11 }}>
                Open Project Details →
              </Link>
              <button className="button ghost" onClick={() => setSelectedCase(null)}>
                Close Inspector ✕
              </button>
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <VoiceDictation
              id="selected-case-dictation"
              label="Auditor Case Notes & Field Observations (Microphone Enabled)"
              value={caseNotes}
              onChange={setCaseNotes}
              onSave={saveCaseNotes}
              isSaving={savingNotes}
              placeholder="Click 'Dictate with voice' and speak auditor directives, voucher discrepancies, field findings, or resolution notes..."
              minHeight={130}
            />
          </div>
        </section>
      )}

      {/* CASES DATA TABLE */}
      <section className="panel table-panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Project ID</th>
                <th>Priority</th>
                <th>Assigned Authority</th>
                <th>Status</th>
                <th>Case Notes</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.length ? (
                filteredCases.map(item => {
                  const isSelected = selectedCase?.id === item.id;
                  return (
                    <tr key={item.id} style={{ background: isSelected ? '#f2f8f6' : undefined }}>
                      <td>
                        <strong>CASE-{String(item.id).padStart(4, '0')}</strong>
                        <small>{item.title}</small>
                      </td>
                      <td>
                        <Link to={`/projects/${item.project_id}`} className="text-link" style={{ fontWeight: 600 }}>
                          PROJECT-{item.project_id} →
                        </Link>
                      </td>
                      <td>
                        <RiskBadge level={item.priority === 'CRITICAL' ? 'CRITICAL' : item.priority === 'HIGH' ? 'HIGH' : 'MEDIUM'} />
                      </td>
                      <td>{item.assigned_authority || 'Unassigned'}</td>
                      <td>
                        <select className="inline-select" value={item.status} onChange={event => update(item.id, event.target.value)}>
                          <option>OPEN</option>
                          <option>UNDER_REVIEW</option>
                          <option>ESCALATED</option>
                          <option>RESOLVED</option>
                          <option>Pending Review</option>
                        </select>
                      </td>
                      <td>
                        {item.notes ? (
                          <div style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, color: 'var(--ink)' }} title={item.notes}>
                            {item.notes}
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>No notes yet</span>
                        )}
                      </td>
                      <td>{dateText(item.created_at)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="button secondary"
                          style={{
                            fontSize: 11,
                            padding: '3px 8px',
                            height: 'auto',
                            minHeight: 26,
                            background: isSelected ? 'var(--teal)' : undefined,
                            color: isSelected ? '#ffffff' : undefined,
                          }}
                          onClick={() => openCaseNotes(item)}
                          title="Dictate or view notes for this audit case"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" y1="19" x2="12" y2="23" />
                            <line x1="8" y1="23" x2="16" y2="23" />
                          </svg>
                          {isSelected ? 'Editing Notes' : 'Dictate Notes'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8}>
                    <EmptyState title="No audit cases in this view" text="Select another status filter or create a case from any project." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* CREATE NEW AUDIT CASE MODAL WITH VOICE DICTATION */}
      {newCaseModal && (
        <div className="modal-backdrop">
          <section className="modal panel" style={{ maxWidth: 580, width: '92%' }}>
            <button className="modal-close" onClick={() => setNewCaseModal(false)}>×</button>
            <div className="eyebrow">NEW AUDIT CASE</div>
            <h2>Register Audit Review Case</h2>
            <p className="muted" style={{ margin: '0 0 16px', fontSize: 12 }}>
              Initialize an audit investigation for a specific project. You can dictate case notes directly using your microphone.
            </p>

            <form onSubmit={createNewCase}>
              <div className="provision-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="provision-field">
                  <label className="provision-label">Project ID *</label>
                  <input
                    type="number"
                    className="provision-input"
                    required
                    placeholder="e.g. 1"
                    value={newCaseDraft.project_id}
                    onChange={e => setNewCaseDraft({ ...newCaseDraft, project_id: e.target.value })}
                  />
                </div>
                <div className="provision-field">
                  <label className="provision-label">Priority</label>
                  <select
                    className="provision-select"
                    value={newCaseDraft.priority}
                    onChange={e => setNewCaseDraft({ ...newCaseDraft, priority: e.target.value })}
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
              </div>

              <div className="provision-field" style={{ marginBottom: 12 }}>
                <label className="provision-label">Case Title *</label>
                <input
                  className="provision-input"
                  required
                  placeholder="e.g. Verification of expenditure vouchers and foundation progress"
                  value={newCaseDraft.title}
                  onChange={e => setNewCaseDraft({ ...newCaseDraft, title: e.target.value })}
                />
              </div>

              <div className="provision-field" style={{ marginBottom: 14 }}>
                <label className="provision-label">Assigned Authority / Inspection Unit</label>
                <input
                  className="provision-input"
                  value={newCaseDraft.assigned_authority}
                  onChange={e => setNewCaseDraft({ ...newCaseDraft, assigned_authority: e.target.value })}
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <VoiceDictation
                  id="new-case-notes"
                  label="Initial Case Observations (Voice Dictation Enabled)"
                  value={newCaseDraft.notes}
                  onChange={text => setNewCaseDraft({ ...newCaseDraft, notes: text })}
                  placeholder="Click 'Dictate with voice' and speak why this review is initiated, specific documents to examine, or field instructions..."
                  minHeight={110}
                />
              </div>

              <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="button ghost" onClick={() => setNewCaseModal(false)}>Cancel</button>
                <button type="submit" className="button primary">Create Case</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  ); 
}

function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>('MINISTRY');
  const [form, setForm] = useState<Record<string, string>>({
    role: 'MINISTRY',
    login: 'ministry.demo',
    identity_id: 'MINISTRY-DEMO',
    password: 'password123',
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { if (user) navigate('/', { replace: true }); }, [user, navigate]);
  const set = (key: string, value: string) => setForm(previous => ({ ...previous, [key]: value, role }));

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    setIsSubmitting(true);
    try {
      await login({ ...form, role });
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Unable to sign in. Please verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const loginAsPersona = async (p: typeof DEMO_PERSONAS[0]) => {
    setRole(p.role);
    const pForm: Record<string, string> = {
      role: p.role,
      login: p.login,
      identity_id: p.identity_id,
      password: p.password,
    };
    if (p.state) pForm.state = p.state;
    if (p.district) pForm.district = p.district;
    if (p.constituency) pForm.constituency = p.constituency;
    setForm(pForm);
    setError('');
    setIsSubmitting(true);
    try {
      await login(pForm);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Unable to sign in with demo credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fields = role === 'MINISTRY' ? [] : role === 'STATE_NODAL_AUTHORITY' ? ['state'] : role === 'DISTRICT_AUTHORITY' ? ['state', 'district'] : ['state', 'constituency'];

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ marginBottom: 14 }}>
          <Link to="/landing" className="text-link" style={{ fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            ← View SIH Solution Brief & Architecture
          </Link>
        </div>
        <header className="auth-header">
          <div className="auth-brand">
            <div className="brand-seal" aria-hidden="true">M</div>
            <div className="brand-text">
              <span className="brand-kicker">MPLADS AI</span>
              <strong className="brand-title">Audit Intelligence</strong>
            </div>
          </div>
          <span className="auth-eyebrow">INTERNAL GOVERNMENT ACCESS</span>
          <h1 className="auth-title">Official Portal Sign In</h1>
          <p className="auth-subtitle">Select your official authority pathway. Your provisioned account and jurisdiction are verified by the server.</p>
        </header>

        <section className="auth-demo-section" aria-label="Quick Demo Access">
          <div className="auth-demo-header">
            <span className="auth-demo-label">QUICK DEMO ACCESS (1-CLICK)</span>
            <span className="auth-demo-hint">Select a test persona</span>
          </div>
          <div className="auth-demo-grid">
            {DEMO_PERSONAS.map(p => (
              <button
                key={p.role}
                type="button"
                className={`auth-demo-btn ${role === p.role ? 'active-persona' : ''}`}
                onClick={() => loginAsPersona(p)}
                disabled={isSubmitting}
                title={`Sign in as ${p.title}`}
              >
                <div className="auth-demo-top">
                  <span className="auth-demo-title">{p.title}</span>
                  <span className="auth-demo-badge">{p.role.split('_')[0]}</span>
                </div>
                <span className="auth-demo-desc">{p.desc}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="auth-divider" role="separator">
          <span>OR SIGN IN MANUALLY</span>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <div className="auth-field">
            <label htmlFor="auth-role" className="auth-label">Official Role</label>
            <select
              id="auth-role"
              className="auth-select"
              value={role}
              onChange={event => {
                const next = event.target.value as Role;
                setRole(next);
                const persona = DEMO_PERSONAS.find(p => p.role === next);
                if (persona) {
                  const pForm: Record<string, string> = {
                    role: persona.role,
                    login: persona.login,
                    identity_id: persona.identity_id,
                    password: persona.password,
                  };
                  if (persona.state) pForm.state = persona.state;
                  if (persona.district) pForm.district = persona.district;
                  if (persona.constituency) pForm.constituency = persona.constituency;
                  setForm(pForm);
                } else {
                  setForm(prev => ({ ...prev, role: next }));
                }
              }}
            >
              <option value="MINISTRY">Ministry / National Authority</option>
              <option value="STATE_NODAL_AUTHORITY">State Nodal Authority</option>
              <option value="DISTRICT_AUTHORITY">District Authority</option>
              <option value="MEMBER_OF_PARLIAMENT">Member of Parliament (MP)</option>
            </select>
          </div>

          <div className="auth-field">
            <label htmlFor="auth-login" className="auth-label">Official Government Email / User ID</label>
            <input
              id="auth-login"
              className="auth-input"
              type="text"
              required
              value={form.login || ''}
              onChange={event => set('login', event.target.value)}
              placeholder="e.g. ministry.demo"
              autoComplete="username"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="auth-identity" className="auth-label">
              {role === 'MINISTRY' ? 'Ministry Identity ID' : role === 'MEMBER_OF_PARLIAMENT' ? 'MP Identity ID' : 'Authority / Employee Identity ID'}
            </label>
            <input
              id="auth-identity"
              className="auth-input"
              type="text"
              required
              value={form.identity_id || ''}
              onChange={event => set('identity_id', event.target.value)}
              placeholder={role === 'MINISTRY' ? 'e.g. MINISTRY-DEMO' : role === 'STATE_NODAL_AUTHORITY' ? 'e.g. STATE-DEMO-KA' : 'e.g. DISTRICT-DEMO-BLR'}
            />
          </div>

          {fields.map(field => (
            <div className="auth-field" key={field}>
              <label htmlFor={`auth-${field}`} className="auth-label">
                {field === 'state' ? 'State Jurisdiction' : field === 'district' ? 'District Jurisdiction' : 'Parliamentary Constituency'}
              </label>
              <input
                id={`auth-${field}`}
                className="auth-input"
                type="text"
                required
                value={form[field] || ''}
                onChange={event => set(field, event.target.value)}
                placeholder={field === 'state' ? 'Assigned State (e.g. Karnataka)' : field === 'district' ? 'Assigned District (e.g. Bengaluru Urban)' : 'Assigned Constituency (e.g. Bengaluru Central)'}
              />
            </div>
          ))}

          <div className="auth-field">
            <label htmlFor="auth-password" className="auth-label">Password</label>
            <input
              id="auth-password"
              className="auth-input"
              required
              type="password"
              value={form.password || ''}
              onChange={event => set('password', event.target.value)}
              placeholder="••••••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="auth-error" role="alert">
              <span className="auth-error-icon" aria-hidden="true">⚠</span>
              <span>{error}</span>
            </div>
          )}

          <button className="button primary auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in securely...' : 'Sign in to Workspace'}
          </button>
        </form>

        <footer className="auth-footer">
          <p>No public registration. Access is provisioned by authorized authorities.</p>
        </footer>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Checking secure session...</div>;
  return user ? <>{children}</> : <LoginPage />;
}

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

function generateSecurePassword() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const specials = '@#$%&!';
  const p1 = letters[Math.floor(Math.random() * letters.length)];
  const p2 = letters[Math.floor(Math.random() * letters.length)];
  const spec = specials[Math.floor(Math.random() * specials.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `GovAuth${spec}${p1}${p2}${num}`;
}

function AuditIntegrityPanel() {
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const verify = async () => {
    setBusy(true);
    try {
      setResult((await axios.get(`${API_BASE}/api/auth/audit-log/integrity`)).data);
    } catch (error: any) {
      setResult({ error: error.response?.data?.detail || 'Unable to verify audit log integrity.' });
    } finally {
      setBusy(false);
    }
  };

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">SECURITY VERIFICATION</div>
          <h2>Audit Log Integrity & Immutability</h2>
          <p>Cryptographically verify that sequential audit records remain untampered via SHA-256 hash chaining.</p>
        </div>
        <button className="button secondary" type="button" onClick={verify} disabled={busy}>
          {busy ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spin-icon" style={{ marginRight: 6 }}>
                <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
              </svg>
              Verifying hash chain...
            </>
          ) : (
            'Verify chain integrity'
          )}
        </button>
      </div>

      {result && (
        result.error ? (
          <div className="provision-error-banner">
            <span style={{ fontWeight: 700 }}>Notice:</span>
            <span>{result.error}</span>
          </div>
        ) : (
          <div className="security-audit-card">
            <div className="security-stat-box">
              <span className="security-stat-label">Chain Status</span>
              <div className="security-stat-value" style={{ color: '#16655c', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#238f82', display: 'inline-block' }} />
                {result.status || 'VALID'}
              </div>
            </div>
            <div className="security-stat-box">
              <span className="security-stat-label">Records Checked</span>
              <div className="security-stat-value">
                {result.verified_records} <small style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>/ {result.total_records}</small>
              </div>
            </div>
            <div className="security-stat-box">
              <span className="security-stat-label">Integrity Confidence</span>
              <div className="security-stat-value" style={{ color: '#16655c' }}>
                100.0%
              </div>
            </div>

            {result.chain_head && (
              <div className="security-hash-row">
                <span className="security-stat-label">Current Chain Head (SHA-256 Digest)</span>
                <div className="security-hash-code">
                  <span>{result.chain_head}</span>
                  <button
                    type="button"
                    className="button ghost"
                    style={{ fontSize: 11, padding: '2px 8px', height: 'auto', minHeight: 24 }}
                    onClick={() => copyHash(result.chain_head)}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            {result.first_failure && (
              <div className="provision-error-banner" style={{ gridColumn: '1 / -1' }}>
                <strong>Issue detected:</strong> Log #{result.first_failure.audit_log_id} — {result.first_failure.reason}
              </div>
            )}
          </div>
        )
      )}
    </section>
  );
}

function UserManagementContent() {
  const { can, user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activatingId, setActivatingId] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const defaultRole = user?.role === 'STATE_NODAL_AUTHORITY' ? 'DISTRICT_AUTHORITY' : 'STATE_NODAL_AUTHORITY';
  const [draft, setDraft] = useState({
    name: '',
    email: '',
    identity_id: '',
    role: defaultRole,
    state: user?.scope_id || 'Karnataka',
    scope_id: '',
    temporary_password: generateSecurePassword(),
  });

  const refresh = () => {
    axios.get(`${API_BASE}/api/auth/users`)
      .then(response => setUsers(response.data.items || []))
      .catch(() => setErrorMessage('Unable to load provisioned accounts.'));
  };

  useEffect(() => {
    if (can('users:manage')) refresh();
  }, [can]);

  const activate = async (id: number) => {
    setActivatingId(id);
    try {
      await axios.patch(`${API_BASE}/api/auth/users/${id}`, { status: 'ACTIVE' });
      setSuccessMessage('Account activated successfully.');
      setTimeout(() => setSuccessMessage(''), 4000);
      refresh();
    } catch {
      setErrorMessage('Failed to activate account.');
    } finally {
      setActivatingId(null);
    }
  };

  const handleRoleChange = (newRole: string) => {
    setDraft(prev => ({
      ...prev,
      role: newRole,
      state: newRole === 'MINISTRY' ? 'National' : prev.state === 'National' ? 'Karnataka' : prev.state,
      scope_id: newRole === 'MINISTRY' ? 'National' : newRole === 'STATE_NODAL_AUTHORITY' ? prev.state : '',
    }));
  };

  const handleStateChange = (newState: string) => {
    setDraft(prev => ({
      ...prev,
      state: newState,
      scope_id: prev.role === 'STATE_NODAL_AUTHORITY' ? newState : prev.scope_id,
    }));
  };

  const generateNewPassword = () => {
    setDraft(prev => ({ ...prev, temporary_password: generateSecurePassword() }));
  };

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const payload = {
        name: draft.name.trim(),
        email: draft.email.trim(),
        identity_id: draft.identity_id.trim(),
        role: draft.role,
        state: draft.role === 'MINISTRY' ? 'National' : draft.state,
        scope_id: draft.role === 'MINISTRY' ? 'National' : draft.role === 'STATE_NODAL_AUTHORITY' ? draft.state : (draft.scope_id.trim() || draft.state),
        temporary_password: draft.temporary_password,
      };

      await axios.post(`${API_BASE}/api/auth/users`, payload);
      setSuccessMessage(`Account for "${draft.name}" provisioned in PENDING_ACTIVATION status. Temporary password: ${draft.temporary_password}`);
      setDraft({
        name: '',
        email: '',
        identity_id: '',
        role: defaultRole,
        state: user?.scope_id || 'Karnataka',
        scope_id: '',
        temporary_password: generateSecurePassword(),
      });
      refresh();
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || 'Unable to provision account. Please check all fields.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const allowedRoles = user?.role === 'STATE_NODAL_AUTHORITY'
    ? ['DISTRICT_AUTHORITY', 'MEMBER_OF_PARLIAMENT']
    : ['MINISTRY', 'STATE_NODAL_AUTHORITY', 'DISTRICT_AUTHORITY', 'MEMBER_OF_PARLIAMENT'];

  const scopeLabel = draft.role === 'MEMBER_OF_PARLIAMENT'
    ? 'Parliamentary Constituency'
    : draft.role === 'DISTRICT_AUTHORITY'
      ? 'Assigned District'
      : draft.role === 'STATE_NODAL_AUTHORITY'
        ? 'Statewide Scope'
        : 'National Oversight Scope';

  const scopePlaceholder = draft.role === 'MEMBER_OF_PARLIAMENT'
    ? 'e.g. Bengaluru Central, Lucknow, Baramati'
    : draft.role === 'DISTRICT_AUTHORITY'
      ? 'e.g. Bengaluru Urban, Mysuru, Varanasi'
      : 'All jurisdictions within state';

  // Filter accounts
  const filteredUsers = useMemo(() => {
    return users.filter(account => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery = !q ||
        (account.name && account.name.toLowerCase().includes(q)) ||
        (account.email && account.email.toLowerCase().includes(q)) ||
        (account.identity_id && account.identity_id.toLowerCase().includes(q)) ||
        (account.scope_id && account.scope_id.toLowerCase().includes(q));

      const matchesRole = roleFilter === 'ALL' || account.role === roleFilter;
      const matchesStatus = statusFilter === 'ALL' || account.status === statusFilter;

      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  const activeCount = users.filter(u => u.status === 'ACTIVE').length;
  const pendingCount = users.filter(u => u.status === 'PENDING_ACTIVATION').length;

  const getInitials = (name: string) => {
    if (!name) return 'GO';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'MINISTRY': return 'role-badge role-ministry';
      case 'STATE_NODAL_AUTHORITY': return 'role-badge role-state';
      case 'DISTRICT_AUTHORITY': return 'role-badge role-district';
      case 'MEMBER_OF_PARLIAMENT': return 'role-badge role-mp';
      default: return 'role-badge';
    }
  };

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="ACCESS GOVERNANCE"
        title="User Management"
        subtitle="Provisioned administrative accounts, role delegations, and territorial scopes."
      />

      {/* PROVISION AN ACCOUNT PANEL */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">ACCOUNT ENROLLMENT</div>
            <h2>Provision an account</h2>
            <p>Assign administrative role and territorial scope. Provisioned accounts require confirmation before active access.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="role-badge role-state" style={{ fontSize: 11 }}>
              Server-Side RBAC
            </span>
          </div>
        </div>

        <form className="provision-form" onSubmit={create}>
          <div className="provision-grid">
            {/* Field 1: Name */}
            <div className="provision-field">
              <label className="provision-label" htmlFor="user-name">
                <span>Official Full Name</span>
                <span className="provision-label-req">*</span>
              </label>
              <input
                id="user-name"
                className="provision-input"
                required
                placeholder="e.g. Dr. Sunita Sharma"
                value={draft.name}
                onChange={event => setDraft({ ...draft, name: event.target.value })}
              />
              <span className="provision-help">Full name as recorded in official government orders.</span>
            </div>

            {/* Field 2: Official user ID / email */}
            <div className="provision-field">
              <label className="provision-label" htmlFor="user-email">
                <span>Official User ID / Email</span>
                <span className="provision-label-req">*</span>
              </label>
              <input
                id="user-email"
                type="email"
                className="provision-input"
                required
                placeholder="e.g. sunita.sharma@nic.in"
                value={draft.email}
                onChange={event => setDraft({ ...draft, email: event.target.value })}
              />
              <span className="provision-help">Official departmental email or system login identifier.</span>
            </div>

            {/* Field 3: Identity ID */}
            <div className="provision-field">
              <label className="provision-label" htmlFor="user-identity">
                <span>Identity / Service ID</span>
                <span className="provision-label-req">*</span>
              </label>
              <input
                id="user-identity"
                className="provision-input"
                required
                placeholder="e.g. GOV-KA-9482 or MP-2024-KA07"
                value={draft.identity_id}
                onChange={event => setDraft({ ...draft, identity_id: event.target.value })}
              />
              <span className="provision-help">Government employee ID, PARICHAY ID, or parliament badge.</span>
            </div>

            {/* Field 4: Role */}
            <div className="provision-field">
              <label className="provision-label" htmlFor="user-role">
                <span>Administrative Role</span>
                <span className="provision-label-req">*</span>
              </label>
              <select
                id="user-role"
                className="provision-select"
                value={draft.role}
                onChange={event => handleRoleChange(event.target.value)}
              >
                {allowedRoles.map(role => (
                  <option key={role} value={role}>
                    {roleTitles[role as Role]}
                  </option>
                ))}
              </select>
              <span className="provision-help">Determines data review permissions and audit scope.</span>
            </div>

            {/* Field 5: State */}
            <div className="provision-field">
              <label className="provision-label" htmlFor="user-state">
                <span>Jurisdiction State</span>
                {draft.role !== 'MINISTRY' && <span className="provision-label-req">*</span>}
              </label>
              {draft.role === 'MINISTRY' ? (
                <input
                  id="user-state"
                  className="provision-input"
                  disabled
                  value="National (All States & UTs)"
                />
              ) : (
                <select
                  id="user-state"
                  className="provision-select"
                  required
                  value={draft.state}
                  onChange={event => handleStateChange(event.target.value)}
                  disabled={user?.role === 'STATE_NODAL_AUTHORITY'}
                >
                  {INDIAN_STATES.map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              )}
              <span className="provision-help">State of authority or administrative oversight.</span>
            </div>

            {/* Field 6: Specific Scope */}
            <div className="provision-field">
              <label className="provision-label" htmlFor="user-scope">
                <span>{scopeLabel}</span>
                {draft.role !== 'MINISTRY' && draft.role !== 'STATE_NODAL_AUTHORITY' && (
                  <span className="provision-label-req">*</span>
                )}
              </label>
              {draft.role === 'MINISTRY' ? (
                <input
                  id="user-scope"
                  className="provision-input"
                  disabled
                  value="National Monitoring Access"
                />
              ) : draft.role === 'STATE_NODAL_AUTHORITY' ? (
                <input
                  id="user-scope"
                  className="provision-input"
                  disabled
                  value={`All Districts in ${draft.state}`}
                />
              ) : (
                <input
                  id="user-scope"
                  className="provision-input"
                  required
                  placeholder={scopePlaceholder}
                  value={draft.scope_id}
                  onChange={event => setDraft({ ...draft, scope_id: event.target.value })}
                />
              )}
              <span className="provision-help">
                {draft.role === 'MEMBER_OF_PARLIAMENT'
                  ? 'Constituency representation for project monitoring.'
                  : draft.role === 'DISTRICT_AUTHORITY'
                    ? 'Assigned administrative district jurisdiction.'
                    : 'Territorial boundary for data access.'}
              </span>
            </div>

            {/* Field 7: Temporary Password */}
            <div className="provision-field full-width">
              <label className="provision-label" htmlFor="user-password">
                <span>Temporary Password</span>
                <span className="provision-label-req">*</span>
                <span className="provision-label-hint">Must be changed upon initial login</span>
              </label>
              <div className="provision-password-wrap">
                <input
                  id="user-password"
                  type={showPassword ? 'text' : 'password'}
                  className="provision-input"
                  required
                  value={draft.temporary_password}
                  onChange={event => setDraft({ ...draft, temporary_password: event.target.value })}
                />
                <div className="provision-password-actions">
                  <button
                    type="button"
                    className="provision-password-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                  <button
                    type="button"
                    className="provision-password-btn"
                    onClick={generateNewPassword}
                    title="Generate random secure password"
                  >
                    Generate
                  </button>
                </div>
              </div>
              <span className="provision-help">Single-use credential delivered securely to the government official.</span>
            </div>
          </div>

          <div className="provision-actions">
            <button className="button primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spin-icon" style={{ marginRight: 6 }}>
                    <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                  </svg>
                  Provisioning account...
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <line x1="20" y1="8" x2="20" y2="14" />
                    <line x1="23" y1="11" x2="17" y2="11" />
                  </svg>
                  Create pending account
                </>
              )}
            </button>
            <button
              type="button"
              className="button ghost"
              onClick={() => {
                setDraft({
                  name: '',
                  email: '',
                  identity_id: '',
                  role: defaultRole,
                  state: user?.scope_id || 'Karnataka',
                  scope_id: '',
                  temporary_password: generateSecurePassword(),
                });
                setErrorMessage('');
                setSuccessMessage('');
              }}
            >
              Reset
            </button>
          </div>
        </form>

        {successMessage && (
          <div className="provision-success-banner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <div>
              <strong>Account Provisioned:</strong> {successMessage}
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="provision-error-banner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <strong>Action required:</strong> {errorMessage}
            </div>
          </div>
        )}
      </section>

      {/* AUTHORIZED ACCOUNTS PANEL */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">DIRECTORY</div>
            <h2>Authorized accounts</h2>
            <p>Internal accounts assigned to government roles and jurisdictions. No public self-registration.</p>
          </div>
        </div>

        {/* Summary Chips */}
        <div className="accounts-summary-chips">
          <div className="accounts-summary-item">
            <span className="accounts-summary-label">Total Users:</span>
            <span className="accounts-summary-val">{users.length}</span>
          </div>
          <div className="accounts-summary-item">
            <span className="accounts-summary-label">Active:</span>
            <span className="accounts-summary-val" style={{ color: '#16655c' }}>{activeCount}</span>
          </div>
          <div className="accounts-summary-item">
            <span className="accounts-summary-label">Pending Activation:</span>
            <span className="accounts-summary-val" style={{ color: '#b8862d' }}>{pendingCount}</span>
          </div>
          <div className="accounts-summary-item" style={{ marginLeft: 'auto' }}>
            <span className="accounts-summary-label">Filtered:</span>
            <span className="accounts-summary-val">{filteredUsers.length}</span>
          </div>
        </div>

        {/* Toolbar: Search and Filters */}
        <div className="accounts-toolbar">
          <div className="accounts-search-wrap">
            <div className="accounts-search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              type="text"
              className="accounts-search-input"
              placeholder="Search by name, email, identity ID, or jurisdiction..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="accounts-filters">
            <select
              className="inline-select"
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
            >
              <option value="ALL">All Roles</option>
              <option value="MINISTRY">Ministry / National</option>
              <option value="STATE_NODAL_AUTHORITY">State Nodal Authority</option>
              <option value="DISTRICT_AUTHORITY">District Authority</option>
              <option value="MEMBER_OF_PARLIAMENT">Member of Parliament</option>
            </select>

            <select
              className="inline-select"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING_ACTIVATION">Pending Activation</option>
            </select>
          </div>
        </div>

        {/* Accounts Data Table */}
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Officer / User</th>
                <th>Identity ID</th>
                <th>Role</th>
                <th>Territorial Scope</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length ? (
                filteredUsers.map(account => {
                  const initials = getInitials(account.name);
                  const isPending = account.status === 'PENDING_ACTIVATION';

                  return (
                    <tr key={account.id}>
                      <td>
                        <div className="account-user-cell">
                          <div className="account-avatar-badge">
                            {initials}
                          </div>
                          <div className="account-name-group">
                            <strong>{account.name}</strong>
                            <small>{account.email}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, background: '#f1f5f3', padding: '2px 6px', borderRadius: 3 }}>
                          {account.identity_id || 'ID-PENDING'}
                        </span>
                      </td>
                      <td>
                        <span className={getRoleBadgeClass(account.role)}>
                          {roleTitles[account.role as Role] || account.role}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)' }}>
                          {account.scope_id || account.scope_state || 'National'}
                        </span>
                      </td>
                      <td>
                        <span className={`account-status-pill ${isPending ? 'status-pending' : 'status-active'}`}>
                          <span className="account-status-dot" />
                          {isPending ? 'Pending Activation' : 'Active'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {isPending ? (
                          <button
                            className="button secondary"
                            style={{ fontSize: 11, padding: '4px 10px', height: 'auto', minHeight: 28 }}
                            onClick={() => activate(account.id)}
                            disabled={activatingId === account.id}
                            title="Activate account for immediate sign in"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            {activatingId === account.id ? 'Activating...' : 'Activate'}
                          </button>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
                            Active
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title="No accounts match current criteria"
                      text="Try clearing the search query or adjusting role and status filters."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function UserManagementPage() {
  const { can } = useAuth();
  return <><UserManagementContent />{can('audit:integrity') && <AuditIntegrityPanel />}</>;
}

function ProjectsPage() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState(params.get('search') || '');
  const [state, setState] = useState('');
  const [category, setCategory] = useState('');
  const [level, setLevel] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [states, setStates] = useState<string[]>([]);
  const categories = ['Roads', 'Water Supply', 'Education', 'Health', 'Sanitation', 'Community Infrastructure', 'Trust and Society', 'Normal/Others', 'Calamity Relief'];

  useEffect(() => {
    axios.get(`${API_BASE}/api/dashboard`).then(res => {
      if (res.data?.state_options) setStates(res.data.state_options);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    axios.get(`${API_BASE}/api/projects`, {
      params: {
        page,
        page_size: pageSize,
        search: query || undefined,
        state: state || undefined,
        category: category || undefined,
        risk_level: level || undefined
      }
    }).then(response => {
      setProjects(response.data.records || response.data.items || []);
      setTotal(response.data.filtered_count ?? response.data.total_count ?? response.data.total ?? 0);
    });
  }, [query, state, category, level, page, pageSize]);

  useEffect(() => setPage(1), [query, state, category, level, pageSize]);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="page-stack">
      <PageTitle eyebrow="PROJECT REGISTER" title="Projects" subtitle="Search the complete analyzed register across location, constituency, and category." />
      <div className="toolbar">
        <div className="table-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--muted)', flexShrink: 0, marginRight: 6 }}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search project, ID, state, district..." />
        </div>
        <select value={state} onChange={event => setState(event.target.value)}>
          <option value="">All states</option>
          {states.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={category} onChange={event => setCategory(event.target.value)}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={level} onChange={event => setLevel(event.target.value)}>
          <option value="">All risk levels</option>
          {levels.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={pageSize} onChange={event => setPageSize(Number(event.target.value))}>
          <option value={25}>25 per page</option>
          <option value={50}>50 per page</option>
          <option value={100}>100 per page</option>
        </select>
        {(query || state || category || level) && (
          <button className="button ghost" onClick={() => { setQuery(''); setState(''); setCategory(''); setLevel(''); }}>
            Clear filters
          </button>
        )}
        <span className="toolbar-count">{(total || 0).toLocaleString('en-IN')} matching {total === 1 ? 'project' : 'projects'}</span>
        <button className="button secondary" onClick={() => exportProjectsCSV(projects, 'projects_register.csv')}>Export CSV</button>
      </div>
      <section className="panel table-panel">
        <ProjectTable projects={projects} />
        <div className="pagination">
          <button className="button ghost" disabled={page === 1 || total === 0} onClick={() => setPage(v => v - 1)}>Previous</button>
          <span>{total > 0 ? `Page ${page} of ${pages} · Showing ${projects.length} of ${(total || 0).toLocaleString('en-IN')}` : '0 matching projects'}</span>
          <button className="button ghost" disabled={page >= pages || total === 0} onClick={() => setPage(v => v + 1)}>Next</button>
        </div>
      </section>
    </div>
  );
}

function AnalyticsPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  useEffect(() => {
    axios.get(`${API_BASE}/api/dashboard`).then(response => setDashboard(response.data));
  }, []);
  if (!dashboard) return <div className="page-loading">Loading analytics...</div>;
  const stateData = (dashboard.state_wise || []).slice(0, 12);
  const categoryData = (dashboard.category_wise || []).slice(0, 9);
  return (
    <div className="page-stack">
      <PageTitle eyebrow="ANALYTICS" title="Evidence patterns" subtitle="Understand where expenditure, utilization, and completion signals diverge." />
      <div className="analytics-kpis">
        <Stat label="Records analyzed" value={dashboard.total_projects.toLocaleString('en-IN')} detail="Uploaded project records" />
        <Stat label="Overall utilization" value={pct(dashboard.total_utilization_ratio)} detail={money(dashboard.total_expenditure)} tone="blue" />
        <Stat label="High-risk share" value={pct(dashboard.total_projects ? (dashboard.high_risk_projects / dashboard.total_projects) : 0)} detail={`${dashboard.high_risk_projects} high or critical`} tone="orange" />
        <Stat label="Open alerts" value={dashboard.active_alerts.toLocaleString('en-IN')} detail="Signals requiring review" tone="red" />
      </div>
      <div className="grid-2">
        <section className="panel chart-panel">
          <div className="eyebrow">RISK SCORE DISTRIBUTION</div>
          <h2>How many projects sit in each band?</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dashboard.risk_score_distribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dbe5e1" vertical={false} />
              <XAxis dataKey="range" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="projects" fill="#238f82" />
            </BarChart>
          </ResponsiveContainer>
        </section>
        <section className="panel chart-panel">
          <div className="eyebrow">UTILIZATION DISTRIBUTION</div>
          <h2>Where is spend approaching sanction?</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dashboard.utilization_distribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dbe5e1" vertical={false} />
              <XAxis dataKey="range" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="projects" fill="#d6a64f" />
            </BarChart>
          </ResponsiveContainer>
        </section>
        <section className="panel chart-panel">
          <div className="eyebrow">RISK BY STATE</div>
          <h2>Where is average risk concentrated?</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stateData} margin={{ bottom: 48, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dbe5e1" vertical={false} />
              <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={65} />
              <YAxis domain={[0, 100]} />
              <Tooltip formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Average risk']} />
              <Bar dataKey="average_risk" fill="#d95b67" />
            </BarChart>
          </ResponsiveContainer>
        </section>
        <section className="panel chart-panel">
          <div className="eyebrow">DELAY PROFILE</div>
          <h2>How long are projects delayed?</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dashboard.delay_distribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dbe5e1" vertical={false} />
              <XAxis dataKey="range" angle={-20} textAnchor="end" interval={0} height={58} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="projects" fill="#e4774c" />
            </BarChart>
          </ResponsiveContainer>
        </section>
        <section className="panel chart-panel wide-chart">
          <div className="eyebrow">CATEGORY FINANCIALS</div>
          <h2>Sanctioned value versus expenditure</h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={categoryData} margin={{ bottom: 48, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dbe5e1" vertical={false} />
              <XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} height={70} />
              <YAxis tickFormatter={(value) => `₹${(Number(value) / 10000000).toFixed(1)}Cr`} />
              <Tooltip formatter={(value: any) => money(Number(value))} />
              <Bar dataKey="sanctioned" fill="#238f82" name="Sanctioned" />
              <Bar dataKey="expenditure" fill="#d6a64f" name="Expenditure" />
            </BarChart>
          </ResponsiveContainer>
        </section>
        <section className="panel chart-panel wide-chart">
          <div className="eyebrow">STATE PROJECT VOLUME</div>
          <h2>Project count and high-risk cases</h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={stateData} margin={{ bottom: 48, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dbe5e1" vertical={false} />
              <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={65} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="projects" fill="#4b8ca3" name="Projects" />
              <Bar dataKey="high_risk" fill="#d95b67" name="High risk" />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>
    </div>
  );
}

function DataQualityPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [quality, setQuality] = useState<any>(null);
  useEffect(() => {
    Promise.all([
      axios.get(`${API_BASE}/api/projects`, { params: { page: 1, page_size: 50, risk_level: 'DATA_QUALITY_REVIEW' } }),
      axios.get(`${API_BASE}/api/data-quality`)
    ]).then(([projectResponse, qualityResponse]) => {
      setProjects(projectResponse.data.records || projectResponse.data.items || []);
      setQuality(qualityResponse.data);
    });
  }, []);
  if (!quality) return <div className="page-loading">Loading data quality...</div>;
  return (
    <div className="page-stack">
      <PageTitle eyebrow="DATA QUALITY" title="Evidence quality" subtitle="Inspect records that may need clarification before audit interpretation." />
      <div className="kpi-grid quality">
        <Stat label="Records analyzed" value={Number(quality.total_records || 0).toLocaleString('en-IN')} />
        <Stat label="Completeness" value={pct(quality.completeness)} detail={`${Number((quality.total_records || 0) - (quality.data_quality_records || 0)).toLocaleString('en-IN')} records complete`} tone="blue" />
        <Stat label="Validity" value={pct(quality.validity)} detail={`${Number(quality.data_quality_records || 0).toLocaleString('en-IN')} records needing review`} tone="orange" />
        <Stat label="Uniqueness" value={pct(quality.uniqueness)} detail={`${Number(quality.duplicate_project_ids || 0).toLocaleString('en-IN')} duplicate IDs`} tone="red" />
      </div>
      <section className="panel">
        <div className="eyebrow">REVIEW QUEUE</div>
        <h2>Records needing administrative context</h2>
        <p className="muted">These records have incomplete fields or anomalous data formats that require manual field verification.</p>
        <ProjectTable projects={projects} />
      </section>
    </div>
  );
}

function IntelligenceTable({ records }: { records: Project[] }) {
  return <ProjectTable projects={records} />;
}

function AgenciesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [sortField, setSortField] = useState('average_risk');
  const location = useLocation();
  const runId = new URLSearchParams(location.search).get('run_id');
  const params = { run_id: runId || undefined };

  useEffect(() => {
    Promise.all([
      axios.get(`${API_BASE}/api/agencies`, { params }),
      axios.get(`${API_BASE}/api/fraud-risk/vendors`, { params })
    ]).then(([agencyResponse, vendorResponse]) => {
      setItems(agencyResponse.data.items || []);
      setVendors(vendorResponse.data.items || []);
    });
  }, [runId]);

  const sortedAgencies = [...items].sort((a, b) => {
    if (sortField === 'average_risk') return (b.average_risk || 0) - (a.average_risk || 0);
    if (sortField === 'projects') return (b.projects || 0) - (a.projects || 0);
    if (sortField === 'sanctioned') return (b.sanctioned || 0) - (a.sanctioned || 0);
    if (sortField === 'expenditure') return (b.expenditure || 0) - (a.expenditure || 0);
    if (sortField === 'delayed') return (b.delayed || 0) - (a.delayed || 0);
    if (sortField === 'high_risk') return ((b.high_risk || 0) + (b.critical || 0)) - ((a.high_risk || 0) + (a.critical || 0));
    return 0;
  });

  return (
    <div className="page-stack">
      <PageTitle eyebrow="AGENCY INTELLIGENCE" title="Implementation performance" subtitle="Aggregated from the active MPLADS analysis run." />
      <section className="panel table-panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">EXECUTING AGENCIES</div>
            <h2>Public Agency Performance & Risk Ranking</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>SORT BY:</span>
            <select className="inline-select" value={sortField} onChange={e => setSortField(e.target.value)}>
              <option value="average_risk">Highest Average Risk</option>
              <option value="high_risk">Most High/Critical Cases</option>
              <option value="delayed">Most Delayed Projects</option>
              <option value="projects">Total Projects</option>
              <option value="sanctioned">Sanctioned Value</option>
              <option value="expenditure">Total Expenditure</option>
            </select>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Executing Agency</th>
                <th>Projects</th>
                <th>Sanctioned</th>
                <th>Expenditure</th>
                <th>Utilization</th>
                <th>Delayed</th>
                <th>High/Critical</th>
                <th>Average Risk</th>
              </tr>
            </thead>
            <tbody>
              {sortedAgencies.length ? (
                sortedAgencies.map(item => {
                  const combinedRisk = (item.high_risk || 0) + (item.critical || 0);
                  return (
                    <tr key={item.name}>
                      <td><strong>{item.name || 'Not recorded'}</strong></td>
                      <td className="tabular-nums">{Number(item.projects || 0).toLocaleString('en-IN')}</td>
                      <td className="tabular-nums">{money(item.sanctioned)}</td>
                      <td className="tabular-nums">{money(item.expenditure)}</td>
                      <td className="tabular-nums">{pct(item.average_utilization)}</td>
                      <td className="tabular-nums">{Number(item.delayed || 0).toLocaleString('en-IN')}</td>
                      <td className="tabular-nums" style={{ color: combinedRisk > 0 ? 'var(--crimson)' : undefined, fontWeight: combinedRisk > 0 ? 700 : undefined }}>
                        {combinedRisk}
                      </td>
                      <td className="tabular-nums">
                        <strong>{Math.min(100, Math.max(0, Number(item.average_risk || 0))).toFixed(1)}%</strong>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8}>
                    <EmptyState title="No executing agencies" text="No agency performance data was identified in this run." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel table-panel">
        <div className="eyebrow">POTENTIAL VENDOR-RISK SIGNALS</div>
        <h2>Vendor concentration requiring review</h2>
        <p className="muted">Aggregates are review signals and are not proof of wrongdoing.</p>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Projects</th>
                <th>Concentration</th>
                <th>Districts</th>
                <th>Agencies</th>
                <th>High/Critical</th>
                <th>Anomalies</th>
              </tr>
            </thead>
            <tbody>
              {vendors.length ? vendors.slice(0, 20).map(item => (
                <tr key={item.vendor}>
                  <td><strong>{item.vendor || 'Unknown Vendor'}</strong></td>
                  <td className="tabular-nums">{Number(item.projects || 0).toLocaleString('en-IN')}</td>
                  <td className="tabular-nums">
                    {typeof item.concentration_percentage === 'number'
                      ? `${Math.min(100, Math.max(0, item.concentration_percentage)).toFixed(1)}%`
                      : '—'}
                  </td>
                  <td className="tabular-nums">{Number(item.district_count || 0).toLocaleString('en-IN')}</td>
                  <td className="tabular-nums">{Number(item.agency_count || 0).toLocaleString('en-IN')}</td>
                  <td className="tabular-nums">{item.high_risk_count ?? 0} / {item.critical_count ?? 0}</td>
                  <td className="tabular-nums">{Number(item.anomaly_count || 0).toLocaleString('en-IN')}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7}>
                    <EmptyState title="No vendor signals" text="No vendor concentration anomalies were identified in this run." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ReconciliationPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    axios.get(`${API_BASE}/api/reconciliation`).then(response => setData(response.data));
  }, []);
  if (!data) return <div className="page-loading">Loading fund checks...</div>;

  const mismatches = data.mismatches || [];
  const totalOverspent = mismatches.reduce((sum: number, item: any) => sum + Math.max(0, (item.expenditure || 0) - (item.sanction_amount || 0)), 0);

  return (
    <div className="page-stack">
      <PageTitle eyebrow="FUND CHECKS" title="Fund Reconciliation Workspace" subtitle="Automated cross-reconciliation identifying expenditure exceeding sanctioned ceiling amounts." />
      <div className="kpi-grid">
        <Stat label="Projects with Overspend" value={String(data.total_mismatches ?? mismatches.length)} detail="Expenditure > Sanction" tone="red" />
        <Stat label="Total Overrun Value" value={money(totalOverspent)} detail="Cumulative excess expenditure" tone="red" />
        <Stat label="Audited Fields Verified" value={String(data.available_fields?.length || 0)} detail="Mathematically reconciled" tone="teal" />
        <Stat label="Unsupplied Fields" value={String(data.unavailable_fields?.length || 0)} detail="Pending workbook join" tone="orange" />
      </div>
      <section className="panel table-panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">VARIANCE DISCREPANCY REGISTER</div>
            <h2>Projects exceeding approved financial ceiling</h2>
          </div>
        </div>
        <IntelligenceTable
          records={mismatches.map((item: any) => ({
            ...item,
            project_name: item.project_name || item.project_code,
            project_code: item.project_code,
            state: item.state || 'Not recorded',
            district: item.district || 'Not recorded',
            category: item.category || 'Not recorded',
            utilization_ratio: item.utilization_ratio,
            delay_days: item.delay_days,
            anomaly_score: item.anomaly_score,
            risk_level: item.risk_level || 'HIGH',
            id: item.project_id
          }))}
        />
      </section>
    </div>
  );
}

function DuplicatesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    axios.get(`${API_BASE}/api/duplicates`)
      .then(response => setItems(response.data.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading">Checking duplicate candidates...</div>;

  return (
    <div className="page-stack">
      <PageTitle eyebrow="DUPLICATE WORK DETECTION" title="Potential duplicate candidates" subtitle="Similarity signals require human verification; records are never automatically merged without officer sanction." />
      <section className="panel">
        {items.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map((item, index) => (
              <div
                className="alert-row duplicate-alert-row"
                key={`${item.project_a?.id || index}-${item.project_b?.id || index}`}
                style={{ display: 'grid', gridTemplateColumns: '110px 1fr 1fr auto', gap: 16, alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 13, color: 'var(--deep)' }}>#{index + 1}</strong>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>·</span>
                  <span style={{ fontSize: 11, color: 'var(--crimson)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {Math.min(100, Math.max(0, Math.round(item.similarity || 0)))}% match
                  </span>
                </div>
                <div>
                  <strong>{item.project_a?.code || (item.project_a?.id ? `PROJECT-${item.project_a.id}` : 'Project A')}</strong>
                  <span>{item.project_a?.name || 'Unnamed project'}</span>
                  {item.project_a?.id && (
                    <Link to={`/projects/${item.project_a.id}`} className="text-link" style={{ fontSize: 11, marginTop: 4, display: 'inline-block' }}>
                      Inspect Project A →
                    </Link>
                  )}
                </div>
                <div>
                  <strong>{item.project_b?.code || (item.project_b?.id ? `PROJECT-${item.project_b.id}` : 'Project B')}</strong>
                  <span>{item.project_b?.name || 'Unnamed project'}</span>
                  {item.project_b?.id && (
                    <Link to={`/projects/${item.project_b.id}`} className="text-link" style={{ fontSize: 11, marginTop: 4, display: 'inline-block' }}>
                      Inspect Project B →
                    </Link>
                  )}
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--muted)' }}>{(item.reasons || []).join(' · ') || 'Potential duplicate records identified'}</p>
                </div>
                <RiskBadge level={item.similarity >= 90 ? 'CRITICAL' : 'HIGH'} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No potential duplicates" text="No high-similarity project pairs were identified in the active analysis run." />
        )}
      </section>
    </div>
  );
}

function AuditCopilotPage() {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const sampleQueries = [
    'Show delayed projects in Karnataka above the approved amount',
    'High risk projects in Health and Education',
    'Projects with expenditure greater than sanctioned ceiling',
    'Road works with completion delay over 90 days',
  ];

  const executeSearch = async (q: string) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/api/audit-search`, { query: q });
      setResult(response.data);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const search = async (event: FormEvent) => {
    event.preventDefault();
    if (question.trim()) executeSearch(question.trim());
  };

  return (
    <div className="page-stack">
      <PageTitle eyebrow="NATURAL LANGUAGE AUDIT SEARCH" title="Audit Copilot" subtitle="Query the monitored register using administrative search criteria, categories, or risk constraints." />
      <section className="panel">
        <form className="copilot-form" onSubmit={search}>
          <input
            value={question}
            onChange={event => setQuestion(event.target.value)}
            placeholder="e.g. Show delayed road projects in Karnataka above approved amount"
          />
          <button className="button primary" disabled={loading}>
            {loading ? 'Searching...' : 'Search projects'}
          </button>
        </form>

        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Suggested Queries:</span>
          {sampleQueries.map(sq => (
            <button
              key={sq}
              type="button"
              className="button ghost"
              style={{ fontSize: 11, padding: '4px 10px', height: 'auto', minHeight: 28 }}
              onClick={() => { setQuestion(sq); executeSearch(sq); }}
            >
              {sq}
            </button>
          ))}
        </div>

        {result && (
          <div style={{ marginTop: 20 }}>
            <div className="integration-note" style={{ marginBottom: 14 }}>
              <strong>INTERPRETED AUDIT CONSTRAINTS</strong><br />
              {result.interpreted?.length ? result.interpreted.join(' · ') : 'Keyword search'}<br />
              <strong>{Number(result.total_count ?? result.records?.length ?? 0).toLocaleString('en-IN')} matching {result.total_count === 1 ? 'project' : 'projects'} identified</strong>
            </div>
            {result.records?.length ? (
              <IntelligenceTable
                records={result.records.map((item: any) => ({
                  ...item,
                  state: item.state || 'Not recorded',
                  district: item.district || 'Not recorded',
                  risk_score: item.risk_score,
                  risk_level: item.risk_level
                }))}
              />
            ) : (
              <EmptyState title="No matching projects" text="Try broadening the query terms, locations, or review thresholds." />
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function RootRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Checking secure session...</div>;
  if (!user) return <LandingPage />;
  return (
    <ProtectedRoute>
      <Shell>
        <DashboardPage />
      </Shell>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="*"
        element={
          <ProtectedRoute>
            <Shell>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/risk" element={<RiskPage />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/projects/:id" element={<ProjectPageBoundary><ProjectDetailPage /></ProjectPageBoundary>} />
                <Route path="/upload" element={<MultiUploadPage />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/cases" element={<CasesPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/agencies" element={<AgenciesPage />} />
                <Route path="/reconciliation" element={<ReconciliationPage />} />
                <Route path="/duplicates" element={<DuplicatesPage />} />
                <Route path="/audit-search" element={<AuditCopilotPage />} />
                <Route path="/integration" element={<IntegrationPage />} />
                <Route path="/data-quality" element={<DataQualityPage />} />
                <Route path="/users" element={<UserManagementPage />} />
              </Routes>
            </Shell>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
export default App;
