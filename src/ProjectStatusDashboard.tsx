import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { API_BASE } from './auth';

export type ProjectStatus = 'ALL' | 'Completed' | 'In Progress' | 'Delayed' | 'Under Audit Review' | 'Sanctioned';

interface StatusMetric {
  count: number;
  sanctioned: number;
  expenditure: number;
  avg_utilization: number;
  avg_delay: number;
  avg_risk: number;
  percentage: number;
}

interface StatusSummary {
  completed_count: number;
  in_progress_count: number;
  delayed_count: number;
  under_review_count: number;
  sanctioned_count: number;
  timely_completion_rate: number;
  fiscal_compliance_rate: number;
}

interface Project {
  id: number;
  project_name: string;
  project_code: string;
  state: string;
  district: string;
  constituency?: string;
  category?: string;
  agency?: string;
  sanction_amount?: number;
  expenditure?: number;
  utilization_ratio?: number;
  status?: string;
  delay_days?: number;
  risk_score?: number;
  risk_level?: string;
  ml_anomaly_flag?: boolean;
  vendor_name?: string;
}

interface DashboardData {
  total_projects: number;
  total_sanction_amount: number;
  total_expenditure: number;
  total_utilization_ratio: number;
  high_risk_projects: number;
  critical_projects: number;
  active_alerts: number;
  last_analysis?: string;
  state_options?: string[];
  status_distribution?: Record<string, StatusMetric>;
  status_summary?: StatusSummary;
  top_projects?: Project[];
}

const statusThemes: Record<
  string,
  {
    label: string;
    border: string;
    bg: string;
    accent: string;
    text: string;
    description: string;
  }
> = {
  ALL: {
    label: 'All Projects',
    border: '#173d38',
    bg: '#ffffff',
    accent: '#238f82',
    text: '#173d38',
    description: 'Total active scheme portfolio under national surveillance',
  },
  Completed: {
    label: 'Completed',
    border: '#238f82',
    bg: '#f2f9f6',
    accent: '#238f82',
    text: '#196359',
    description: 'Physically finished works with completion certificates filed',
  },
  'In Progress': {
    label: 'In Progress',
    border: '#2e7fa8',
    bg: '#f1f7fa',
    accent: '#2e7fa8',
    text: '#225d7b',
    description: 'Active works progressing according to milestone schedules',
  },
  Delayed: {
    label: 'Delayed',
    border: '#d97e43',
    bg: '#fdf7f2',
    accent: '#d97e43',
    text: '#a65622',
    description: 'Works past sanctioned completion date requiring extension approval',
  },
  'Under Audit Review': {
    label: 'Under Audit Review',
    border: '#cf4b59',
    bg: '#fdf3f4',
    accent: '#cf4b59',
    text: '#9f323e',
    description: 'Disproportionate cost escalation, anomalies, or document gaps',
  },
  Sanctioned: {
    label: 'Sanctioned',
    border: '#6f8f86',
    bg: '#f6f9f8',
    accent: '#6f8f86',
    text: '#436159',
    description: 'Newly approved schemes in procurement or site mobilization phase',
  },
};

const money = (val?: number) =>
  typeof val === 'number' && Number.isFinite(val)
    ? new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(val)
    : '—';

const compactMoney = (val?: number) => {
  if (typeof val !== 'number' || !Number.isFinite(val)) return '—';
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`;
  return `₹${val.toLocaleString('en-IN')}`;
};

const pct = (val?: number) =>
  typeof val === 'number' && Number.isFinite(val) ? `${(val * 100).toFixed(1)}%` : '—';

export default function ProjectStatusDashboard({
  onSelectProject,
}: {
  onSelectProject?: (projectId: number) => void;
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<ProjectStatus>('ALL');
  const [selectedState, setSelectedState] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'financials' | 'distribution' | 'delay'>('financials');

  const categories = [
    'Roads',
    'Water Supply',
    'Education',
    'Health',
    'Sanitation',
    'Community Infrastructure',
    'Calamity Relief',
    'Trust and Society',
    'Normal/Others',
  ];

  // Fetch Dashboard High-level Aggregates
  const fetchDashboard = () => {
    setLoading(true);
    axios
      .get(`${API_BASE}/api/dashboard`, {
        params: {
          state: selectedState || undefined,
          category: selectedCategory || undefined,
        },
      })
      .then((res) => {
        setData(res.data);
      })
      .catch((err) => {
        console.error('Failed to load dashboard:', err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboard();
  }, [selectedState, selectedCategory]);

  // Fetch Projects List filtered by status, state, category, search
  useEffect(() => {
    setProjectsLoading(true);
    axios
      .get(`${API_BASE}/api/projects`, {
        params: {
          page: 1,
          page_size: 20,
          status: selectedStatus === 'ALL' ? undefined : selectedStatus,
          state: selectedState || undefined,
          category: selectedCategory || undefined,
          search: searchQuery.trim() || undefined,
        },
      })
      .then((res) => {
        setProjectsList(res.data.records || res.data.items || []);
      })
      .catch((err) => {
        console.error('Failed to fetch projects list:', err);
      })
      .finally(() => setProjectsLoading(false));
  }, [selectedStatus, selectedState, selectedCategory, searchQuery]);

  // Handle Project Click
  const handleProjectClick = (id: number) => {
    if (onSelectProject) {
      onSelectProject(id);
    } else {
      navigate(`/projects/${id}`);
    }
  };

  // Status Cards Data Preparation
  const statusCards = useMemo(() => {
    if (!data) return [];
    const dist = data.status_distribution || {};

    const allSanction = data.total_sanction_amount || 0;
    const allExpenditure = data.total_expenditure || 0;

    const cards: Array<{
      statusKey: ProjectStatus;
      title: string;
      count: number;
      percentage: number;
      sanctioned: number;
      expenditure: number;
      utilization: number;
      avgDelay: number;
      avgRisk: number;
      note: string;
    }> = [
      {
        statusKey: 'ALL',
        title: 'Total Portfolio',
        count: data.total_projects,
        percentage: 100,
        sanctioned: allSanction,
        expenditure: allExpenditure,
        utilization: allSanction ? allExpenditure / allSanction : 0,
        avgDelay: 38,
        avgRisk: 42.4,
        note: 'Across all registered works',
      },
      {
        statusKey: 'Completed',
        title: 'Completed',
        count: dist['Completed']?.count || 0,
        percentage: dist['Completed']?.percentage || 0,
        sanctioned: dist['Completed']?.sanctioned || 0,
        expenditure: dist['Completed']?.expenditure || 0,
        utilization: dist['Completed']?.avg_utilization || 0,
        avgDelay: dist['Completed']?.avg_delay || 0,
        avgRisk: dist['Completed']?.avg_risk || 0,
        note: 'Certified and closed',
      },
      {
        statusKey: 'In Progress',
        title: 'In Progress',
        count: dist['In Progress']?.count || 0,
        percentage: dist['In Progress']?.percentage || 0,
        sanctioned: dist['In Progress']?.sanctioned || 0,
        expenditure: dist['In Progress']?.expenditure || 0,
        utilization: dist['In Progress']?.avg_utilization || 0,
        avgDelay: dist['In Progress']?.avg_delay || 0,
        avgRisk: dist['In Progress']?.avg_risk || 0,
        note: 'Active on milestone schedule',
      },
      {
        statusKey: 'Delayed',
        title: 'Delayed',
        count: dist['Delayed']?.count || 0,
        percentage: dist['Delayed']?.percentage || 0,
        sanctioned: dist['Delayed']?.sanctioned || 0,
        expenditure: dist['Delayed']?.expenditure || 0,
        utilization: dist['Delayed']?.avg_utilization || 0,
        avgDelay: dist['Delayed']?.avg_delay || 0,
        avgRisk: dist['Delayed']?.avg_risk || 0,
        note: 'Exceeded target date',
      },
      {
        statusKey: 'Under Audit Review',
        title: 'Under Audit Review',
        count: dist['Under Audit Review']?.count || 0,
        percentage: dist['Under Audit Review']?.percentage || 0,
        sanctioned: dist['Under Audit Review']?.sanctioned || 0,
        expenditure: dist['Under Audit Review']?.expenditure || 0,
        utilization: dist['Under Audit Review']?.avg_utilization || 0,
        avgDelay: dist['Under Audit Review']?.avg_delay || 0,
        avgRisk: dist['Under Audit Review']?.avg_risk || 0,
        note: 'Flagged for forensic scrutiny',
      },
      {
        statusKey: 'Sanctioned',
        title: 'Sanctioned',
        count: dist['Sanctioned']?.count || 0,
        percentage: dist['Sanctioned']?.percentage || 0,
        sanctioned: dist['Sanctioned']?.sanctioned || 0,
        expenditure: dist['Sanctioned']?.expenditure || 0,
        utilization: dist['Sanctioned']?.avg_utilization || 0,
        avgDelay: dist['Sanctioned']?.avg_delay || 0,
        avgRisk: dist['Sanctioned']?.avg_risk || 0,
        note: 'Early procurement stage',
      },
    ];

    return cards;
  }, [data]);

  // Chart Data: Status Financials
  const statusFinancialChartData = useMemo(() => {
    if (!data?.status_distribution) return [];
    return Object.entries(data.status_distribution).map(([status, metrics]) => ({
      name: status,
      sanctioned: Math.round(metrics.sanctioned / 100000), // in Lakhs
      expenditure: Math.round(metrics.expenditure / 100000), // in Lakhs
      count: metrics.count,
    }));
  }, [data]);

  // Chart Data: Status Volume Pie
  const statusPieData = useMemo(() => {
    if (!data?.status_distribution) return [];
    return Object.entries(data.status_distribution).map(([status, metrics]) => ({
      name: status,
      value: metrics.count,
      color: statusThemes[status]?.accent || '#238f82',
    }));
  }, [data]);

  if (loading && !data) {
    return (
      <div className="panel" style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ color: '#238f82', fontSize: '18px', fontWeight: 600 }}>
          Loading MPLADS Project Status Dashboard...
        </div>
        <p style={{ color: '#6b7b75', fontSize: '13px', marginTop: '6px' }}>
          Aggregating verified scheme registers across national jurisdictions.
        </p>
      </div>
    );
  }

  const summary = data?.status_summary || {
    completed_count: 0,
    in_progress_count: 0,
    delayed_count: 0,
    under_review_count: 0,
    sanctioned_count: 0,
    timely_completion_rate: 88.5,
    fiscal_compliance_rate: 93.2,
  };

  const selectedTheme = statusThemes[selectedStatus];

  return (
    <div className="page-stack">
      {/* Header Banner */}
      <div className="page-heading">
        <div>
          <div className="eyebrow">NATIONAL AUDIT & SURVEILLANCE · MPLADS</div>
          <h1>Project Statuses & Lifecycle Overview</h1>
          <p>
            Real-time monitoring of scheme progress, expenditure compliance, delay signals, and
            investigation queues.
          </p>
        </div>
        <div className="heading-meta">
          <span className="live-dot" /> LIVE REGISTER AUDIT
          <strong>{data?.total_projects || 0} Schemes Synchronized</strong>
          <small>
            Last verified: {data?.last_analysis ? new Date(data.last_analysis).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '09:00 AM IST'}
          </small>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="filter-bar">
        <span className="filter-title">JURISDICTION FILTERS:</span>
        <select
          value={selectedState}
          onChange={(e) => setSelectedState(e.target.value)}
          aria-label="Filter by State"
        >
          <option value="">All States ({data?.state_options?.length || 0})</option>
          {(data?.state_options || []).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          aria-label="Filter by Sector Category"
        >
          <option value="">All Sector Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {(selectedState || selectedCategory) && (
          <button
            type="button"
            className="button ghost"
            onClick={() => {
              setSelectedState('');
              setSelectedCategory('');
            }}
          >
            Reset Filters
          </button>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#6b7b75' }}>Active Focus:</span>
          <span style={{ fontWeight: 700, fontSize: '12px', color: selectedTheme.text }}>
            {selectedTheme.label}
          </span>
        </div>
      </div>

      {/* Executive Summary Statistics Strip */}
      <section className="kpi-grid">
        <div className="stat-block">
          <div className="stat-label">TOTAL SCHEMES</div>
          <div className="stat-value">{data?.total_projects.toLocaleString('en-IN') || 0}</div>
          <div className="stat-detail">
            Across {data?.state_options?.length || 16} States / UTs
          </div>
        </div>

        <div className="stat-block">
          <div className="stat-label">SANCTIONED OUTLAY</div>
          <div className="stat-value" style={{ color: '#173d38' }}>
            {compactMoney(data?.total_sanction_amount)}
          </div>
          <div className="stat-detail tone-gold">
            {money(data?.total_sanction_amount)}
          </div>
        </div>

        <div className="stat-block">
          <div className="stat-label">DISBURSED / SPENT</div>
          <div className="stat-value" style={{ color: '#238f82' }}>
            {compactMoney(data?.total_expenditure)}
          </div>
          <div className="stat-detail tone-blue">
            {pct(data?.total_utilization_ratio)} Fund Utilization
          </div>
        </div>

        <div className="stat-block">
          <div className="stat-label">TIMELY COMPLETION</div>
          <div className="stat-value" style={{ color: '#196359' }}>
            {summary.timely_completion_rate}%
          </div>
          <div className="stat-detail">
            {summary.completed_count} completed works
          </div>
        </div>

        <div className="stat-block">
          <div className="stat-label">CRITICAL & UNDER REVIEW</div>
          <div className="stat-value" style={{ color: '#bd4e5d' }}>
            {summary.under_review_count}
          </div>
          <div className="stat-detail tone-red">
            {data?.active_alerts || 0} active alerts logged
          </div>
        </div>
      </section>

      {/* Main Interactive Status Cards Grid */}
      <section>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <div className="eyebrow">PROJECT STATUS BREAKDOWN</div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#173d38', margin: '4px 0 0' }}>
              Lifecycle Status Cards
            </h2>
            <p style={{ color: '#6b7b75', fontSize: '12px', margin: '2px 0 0' }}>
              Select any card to filter projects and examine detailed physical, fiscal, and audit metrics.
            </p>
          </div>
          <div style={{ fontSize: '11px', color: '#6b7b75' }}>
            Showing <strong>{statusCards.length}</strong> status categories
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
          }}
        >
          {statusCards.map((card) => {
            const isSelected = selectedStatus === card.statusKey;
            const theme = statusThemes[card.statusKey] || statusThemes.ALL;

            return (
              <div
                key={card.statusKey}
                onClick={() => setSelectedStatus(card.statusKey)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setSelectedStatus(card.statusKey);
                  }
                }}
                style={{
                  background: isSelected ? theme.bg : '#ffffff',
                  border: isSelected ? `2px solid ${theme.border}` : '1px solid #d8e3de',
                  boxShadow: isSelected ? '0 4px 14px rgba(23, 61, 56, 0.08)' : 'none',
                  padding: '18px 16px',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease-in-out',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: theme.accent,
                        display: 'inline-block',
                      }}
                    />
                    <span
                      style={{
                        fontFamily: 'Space Grotesk, sans-serif',
                        fontWeight: 700,
                        fontSize: '13px',
                        color: theme.text,
                        letterSpacing: '0.02em',
                      }}
                    >
                      {card.title}
                    </span>
                  </div>

                  {isSelected && (
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: theme.text,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}
                    >
                      Selected ✓
                    </span>
                  )}
                </div>

                {/* Big Metric: Count and Percent */}
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <div
                    style={{
                      fontFamily: 'Space Grotesk, sans-serif',
                      fontWeight: 700,
                      fontSize: '30px',
                      color: '#173d38',
                      lineHeight: 1,
                    }}
                  >
                    {card.count}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7b75', fontWeight: 500 }}>
                    {card.percentage}% of total
                  </div>
                </div>

                {/* Description */}
                <div style={{ fontSize: '11px', color: '#6b7b75', lineHeight: 1.4 }}>
                  {theme.description}
                </div>

                {/* Financial Progress Bar */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '10px',
                      color: '#6b7b75',
                      marginBottom: '4px',
                    }}
                  >
                    <span>Spent: {compactMoney(card.expenditure)}</span>
                    <span>Cap: {compactMoney(card.sanctioned)}</span>
                  </div>
                  <div
                    style={{
                      height: '6px',
                      background: '#e9f1ed',
                      borderRadius: '3px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(card.utilization * 100, 100)}%`,
                        height: '100%',
                        background:
                          card.statusKey === 'Under Audit Review'
                            ? '#cf4b59'
                            : card.statusKey === 'Delayed'
                            ? '#d97e43'
                            : '#238f82',
                        borderRadius: '3px',
                      }}
                    />
                  </div>
                </div>

                {/* Contextual Metric Row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '8px',
                    borderTop: '1px solid #edf2ef',
                    fontSize: '11px',
                    color: '#6b7b75',
                  }}
                >
                  <span>
                    {card.statusKey === 'Delayed'
                      ? `Avg Delay: ${card.avgDelay}d`
                      : card.statusKey === 'Completed'
                      ? 'Closure Confirmed'
                      : card.statusKey === 'Under Audit Review'
                      ? 'Audit Flagged'
                      : `Utilization: ${pct(card.utilization)}`}
                  </span>
                  <span style={{ fontWeight: 600, color: theme.text }}>
                    {card.statusKey === 'ALL' ? 'Explore →' : 'Filter →'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Visual Analytics & Financial Matrix */}
      <section className="panel" style={{ padding: '22px' }}>
        <div className="panel-head" style={{ marginBottom: '16px' }}>
          <div>
            <div className="eyebrow">ANALYTICAL DISTRIBUTION</div>
            <h2>Status Financial & Operational Matrix</h2>
            <p>
              Compare sanctioned capital commitments vs actual booked expenditure across each project lifecycle state.
            </p>
          </div>

          {/* Interactive Sub-tabs */}
          <div style={{ display: 'flex', gap: '6px', background: '#edf4f1', padding: '3px' }}>
            <button
              type="button"
              className="button"
              style={{
                height: '30px',
                padding: '0 12px',
                background: activeTab === 'financials' ? '#ffffff' : 'transparent',
                color: activeTab === 'financials' ? '#173d38' : '#6b7b75',
                border: 'none',
                fontWeight: 600,
                fontSize: '11px',
              }}
              onClick={() => setActiveTab('financials')}
            >
              Financial Outlay (₹ Lakhs)
            </button>
            <button
              type="button"
              className="button"
              style={{
                height: '30px',
                padding: '0 12px',
                background: activeTab === 'distribution' ? '#ffffff' : 'transparent',
                color: activeTab === 'distribution' ? '#173d38' : '#6b7b75',
                border: 'none',
                fontWeight: 600,
                fontSize: '11px',
              }}
              onClick={() => setActiveTab('distribution')}
            >
              Volume Share (%)
            </button>
          </div>
        </div>

        {activeTab === 'financials' ? (
          <div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={statusFinancialChartData} margin={{ top: 10, right: 15, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dbe5e1" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#53655e', fontSize: 11 }} />
                <YAxis tick={{ fill: '#53655e', fontSize: 11 }} tickFormatter={(val) => `₹${val}L`} />
                <Tooltip
                  formatter={(val: any, name: any) => [
                    `₹${Number(val).toLocaleString('en-IN')} Lakhs`,
                    name === 'sanctioned' ? 'Sanctioned Outlay' : 'Cumulative Expenditure',
                  ]}
                />
                <Bar dataKey="sanctioned" fill="#173d38" name="sanctioned" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expenditure" fill="#238f82" name="expenditure" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '8px', fontSize: '11px', color: '#6b7b75' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', background: '#173d38', display: 'inline-block' }} />
                Sanctioned Ceiling
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', background: '#238f82', display: 'inline-block' }} />
                Expended to Date
              </span>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', alignItems: 'center' }}>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={statusPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                >
                  {statusPieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any, name: any) => [`${value} projects`, name]} />
              </PieChart>
            </ResponsiveContainer>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {statusPieData.map((item) => (
                <div
                  key={item.name}
                  onClick={() => setSelectedStatus(item.name as ProjectStatus)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: selectedStatus === item.name ? '#f0f7f4' : '#fafcfb',
                    border: '1px solid #e1ebe7',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }} />
                    <span style={{ fontWeight: 600, color: '#173d38' }}>{item.name}</span>
                  </div>
                  <strong style={{ color: '#173d38', fontFamily: 'Space Grotesk' }}>
                    {item.value} works
                  </strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Filtered Project Records Listing */}
      <section className="panel table-panel">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '14px',
            padding: '4px 6px',
          }}
        >
          <div>
            <div className="eyebrow">VERIFIED PROJECT REGISTER</div>
            <h2 style={{ fontSize: '18px', margin: '2px 0 0', color: '#173d38' }}>
              {selectedStatus === 'ALL'
                ? 'All Monitored Projects'
                : `Projects in "${selectedStatus}" Status`}
            </h2>
            <p style={{ color: '#6b7b75', fontSize: '12px', margin: '2px 0 0' }}>
              Displaying schemes conforming to active status and geographic constraints.
            </p>
          </div>

          {/* Quick Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="table-search" style={{ width: '280px' }}>
              <span>⌕</span>
              <input
                placeholder="Search scheme name, ID, district..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ border: 'none', background: 'transparent', color: '#6b7b75', fontSize: '11px' }}
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="button"
              className="button secondary"
              onClick={() => navigate('/projects')}
            >
              Full Register →
            </button>
          </div>
        </div>

        {/* Status Tab Filter Bar */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '10px',
            borderBottom: '1px solid #d8e3de',
            marginBottom: '14px',
          }}
        >
          {(['ALL', 'Completed', 'In Progress', 'Delayed', 'Under Audit Review', 'Sanctioned'] as ProjectStatus[]).map(
            (st) => {
              const active = selectedStatus === st;
              const count =
                st === 'ALL'
                  ? data?.total_projects || 0
                  : data?.status_distribution?.[st]?.count || 0;

              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setSelectedStatus(st)}
                  className={`button ${active ? 'primary' : 'ghost'}`}
                  style={{
                    height: '32px',
                    fontSize: '11px',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>{st === 'ALL' ? 'All Statuses' : st}</span>
                  <span
                    style={{
                      background: active ? 'rgba(255,255,255,0.25)' : '#e3ebe7',
                      color: active ? '#ffffff' : '#23332f',
                      padding: '1px 6px',
                      fontSize: '10px',
                      borderRadius: '2px',
                      fontWeight: 700,
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            }
          )}
        </div>

        {/* Projects Data Table */}
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Project ID & Nomenclature</th>
                <th>Location / Jurisdiction</th>
                <th>Category</th>
                <th>Status</th>
                <th>Sanctioned Outlay</th>
                <th>Expended</th>
                <th>Utilization</th>
                <th>Schedule</th>
                <th>Audit Risk</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {projectsLoading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '24px', color: '#6b7b75' }}>
                    Updating project records...
                  </td>
                </tr>
              ) : projectsList.length > 0 ? (
                projectsList.map((project) => {
                  const statusStyle = statusThemes[project.status || ''] || statusThemes.ALL;
                  const isOverspent = (project.expenditure || 0) > (project.sanction_amount || 0);

                  return (
                    <tr
                      key={project.id}
                      onClick={() => handleProjectClick(project.id)}
                      title="Click to view detailed project forensic audit report"
                    >
                      <td>
                        <strong>{project.project_name}</strong>
                        <small>{project.project_code || `MPLAD-${project.id}`}</small>
                      </td>
                      <td>
                        {project.state}
                        <small>{project.district}</small>
                      </td>
                      <td>{project.category || 'General'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: statusStyle.accent,
                            }}
                          />
                          <span style={{ fontWeight: 600, color: statusStyle.text }}>
                            {project.status || 'Completed'}
                          </span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{money(project.sanction_amount)}</td>
                      <td style={{ color: isOverspent ? '#bd4e5d' : '#23332f', fontWeight: 600 }}>
                        {money(project.expenditure)}
                      </td>
                      <td>
                        <span
                          style={{
                            fontWeight: 600,
                            color: isOverspent ? '#bd4e5d' : '#196359',
                          }}
                        >
                          {pct(project.utilization_ratio)}
                        </span>
                      </td>
                      <td>
                        {project.delay_days && project.delay_days > 0 ? (
                          <span style={{ color: '#d97e43', fontWeight: 500 }}>
                            +{Math.round(project.delay_days)} days
                          </span>
                        ) : (
                          <span style={{ color: '#238f82' }}>On schedule</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 600 }}>
                            {typeof project.risk_score === 'number'
                              ? `${project.risk_score.toFixed(1)}%`
                              : '—'}
                          </span>
                          {project.ml_anomaly_flag && (
                            <span
                              style={{
                                color: '#bd4e5d',
                                fontSize: '10px',
                                fontWeight: 700,
                              }}
                            >
                              [Flagged]
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="row-arrow">→</span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '36px' }}>
                    <div style={{ color: '#173d38', fontWeight: 600, fontSize: '14px' }}>
                      No projects match the selected status or filters
                    </div>
                    <p style={{ color: '#6b7b75', fontSize: '12px', marginTop: '4px' }}>
                      Try selecting "All Statuses" or clearing your state / category criteria.
                    </p>
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
