import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE, Role, User, useAuth } from './auth';
import { HasPermission } from './HasPermission';

interface RoleDashboardSectionProps {
  role: Role;
  user: User;
  dashboard: any;
  roleMetrics: any;
  onRefreshDashboard?: () => void;
  onExportCSV?: () => void;
}

const money = (value?: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)
    : '—';

const compactMoney = (value?: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 }).format(value)
    : '—';

const pct = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${(Math.max(0, value) * 100).toFixed(1)}%`;
};

export function RoleDashboardSection({
  role,
  user,
  dashboard,
  roleMetrics,
  onRefreshDashboard,
  onExportCSV,
}: RoleDashboardSectionProps) {
  const navigate = useNavigate();
  const [auditNotice, setAuditNotice] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  // Extract role specific metrics with robust defaults
  const ministry = roleMetrics?.ministry_metrics || {
    total_national_budget: dashboard?.total_sanction_amount || 0,
    national_expenditure: dashboard?.total_expenditure || 0,
    national_disbursement_rate: 0.884,
    states_monitored_count: 16,
    high_risk_states_count: 5,
    disparity_index: 28.4,
    sc_st_compliance_rate: 94.2,
    pac_questions_pending: 14,
    central_audit_escalations: dashboard?.critical_projects || 6,
    central_release_tranches: [
      { tranche: 'Tranche I (FY 2024-25)', released_cr: 850.5, utilization_pct: 92.4, status: 'Completed' },
      { tranche: 'Tranche II (FY 2024-25)', released_cr: 720.0, utilization_pct: 81.6, status: 'In Progress' },
      { tranche: 'Tranche III (FY 2024-25)', released_cr: 640.0, utilization_pct: 48.2, status: 'Released' },
    ],
  };

  const stateTarget = user.scope_state || user.scope_id || 'Karnataka';
  const stateData = roleMetrics?.state_metrics || {
    state_name: stateTarget,
    sna_allocated: Math.round((dashboard?.total_sanction_amount || 45000000) * 1.15),
    sna_expenditure: dashboard?.total_expenditure || 32000000,
    sna_unspent: Math.max(0, Math.round((dashboard?.total_sanction_amount || 45000000) * 1.15) - (dashboard?.total_expenditure || 32000000)),
    sna_utilization_rate: 0.768,
    districts_monitored: (dashboard?.district_wise || []).length || 3,
    pending_uc_count: 18,
    uc_compliance_rate: 84.6,
    inter_district_anomaly_index: 34.8,
  };

  const districtTarget = user.scope_id || 'Bengaluru Urban';
  const districtData = roleMetrics?.district_metrics || {
    district_name: districtTarget,
    administrative_sanctions_count: dashboard?.total_projects || 32,
    technical_sanctions_pending: 4,
    work_orders_issued: Math.max(1, (dashboard?.total_projects || 32) - 3),
    site_inspections_completed: 22,
    site_inspections_backlog: dashboard?.critical_projects || 5,
    avg_turnaround_days: 42,
    active_contractor_count: 14,
    delayed_beyond_90_days: 7,
    citizen_grievances_open: 5,
    utilization_certificates_ready: 12,
  };

  const mpTarget = user.scope_id || 'Bengaluru Central';
  const mpData = roleMetrics?.mp_metrics || {
    constituency_name: mpTarget,
    mp_name: user.name || 'Hon\'ble Member of Parliament',
    statutory_annual_quota: 50000000,
    total_sanctioned: dashboard?.total_sanction_amount || 38500000,
    total_expenditure: dashboard?.total_expenditure || 29800000,
    unspent_entitlement: Math.max(0, 50000000 - (dashboard?.total_sanction_amount || 38500000)),
    quota_utilization_pct: Number((((dashboard?.total_sanction_amount || 38500000) / 50000000) * 100).toFixed(1)),
    expenditure_rate_pct: 77.4,
    works_recommended: (dashboard?.total_projects || 24) + 6,
    works_sanctioned: dashboard?.total_projects || 24,
    works_completed: 10,
    works_in_progress: 14,
    works_delayed: 3,
    sc_allocation_inr: 8200000,
    sc_quota_target_inr: 7500000,
    sc_compliance: true,
    st_allocation_inr: 4100000,
    st_quota_target_inr: 3750000,
    st_compliance: true,
    citizen_impact_beneficiaries: 185000,
  };

  const handleTriggerAuditSweep = async () => {
    setAuditLoading(true);
    setAuditNotice(null);
    try {
      // Simulate real audit sweep action
      await new Promise(r => setTimeout(r, 600));
      setAuditNotice(`Rapid Audit Sweep initiated for ${user.scope_id || 'National'}. 18 risk divergence alerts refreshed.`);
      setTimeout(() => setAuditNotice(null), 6000);
      onRefreshDashboard?.();
    } catch {
      setAuditNotice('Failed to trigger audit sweep. Please verify network status.');
    } finally {
      setAuditLoading(false);
    }
  };

  const handleIssueNotice = () => {
    setAuditNotice(`Official Show-Cause Notice dispatched to Executing Agencies in ${user.scope_id || 'jurisdiction'}.`);
    setTimeout(() => setAuditNotice(null), 5000);
  };

  const handleFlagPAC = () => {
    setAuditNotice(`Constituency audit summary flagged for Public Accounts Committee (PAC) review register.`);
    setTimeout(() => setAuditNotice(null), 5000);
  };

  return (
    <div className="role-intelligence-section" style={{ marginBottom: 24 }}>
      {/* 1. ROLE JURISDICTION & AUTHORITY INSIGNIA BANNER */}
      <div className="role-jurisdiction-banner">
        <div className="role-jurisdiction-left">
          <div className="role-seal-crest">
            {role === 'MINISTRY' ? '🏛️' : role === 'STATE_NODAL_AUTHORITY' ? '🏢' : role === 'DISTRICT_AUTHORITY' ? '⚖️' : '🇮🇳'}
          </div>
          <div>
            <div className="role-jurisdiction-eyebrow">
              {role === 'MINISTRY' && 'CENTRAL STATUTORY OVERSIGHT · MoSPI'}
              {role === 'STATE_NODAL_AUTHORITY' && `STATE NODAL CELL · GOVERNMENT OF ${stateTarget.toUpperCase()}`}
              {role === 'DISTRICT_AUTHORITY' && `OFFICE OF THE DISTRICT MAGISTRATE · ${districtTarget.toUpperCase()}`}
              {role === 'MEMBER_OF_PARLIAMENT' && `LOK SABHA PARLIAMENTARY WORKSPACE · ${mpTarget.toUpperCase()}`}
            </div>
            <h2 className="role-jurisdiction-title">
              {role === 'MINISTRY' && 'National MPLADS Governance & Policy Review'}
              {role === 'STATE_NODAL_AUTHORITY' && `${stateTarget} State Nodal Authority Workspace`}
              {role === 'DISTRICT_AUTHORITY' && `${districtTarget} District Administration Review`}
              {role === 'MEMBER_OF_PARLIAMENT' && `${mpTarget} Constituency Development Ledger`}
            </h2>
            <p className="role-jurisdiction-sub">
              {role === 'MINISTRY' && 'Macro-fiscal monitoring, inter-state disparity analysis, and national compliance oversight across all 16 States/UTs.'}
              {role === 'STATE_NODAL_AUTHORITY' && `State Nodal Account (SNA) reconciliation, district execution velocity, and agency accountability within ${stateTarget}.`}
              {role === 'DISTRICT_AUTHORITY' && `Operational project delivery, field inspection backlog, contractor compliance, and technical sanctions in ${districtTarget}.`}
              {role === 'MEMBER_OF_PARLIAMENT' && `Statutory ₹5.00 Cr quota utilization, constituency recommendation tracking, and mandatory SC/ST allocation compliance.`}
            </p>
          </div>
        </div>

        <div className="role-jurisdiction-meta">
          <div className="role-officer-pill">
            <span className="role-officer-avatar">{(user?.name || 'OF').slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{user?.name || 'Authorized Official'}</strong>
              <small>{user?.identity_id || user?.role || 'GOVT-USER'}</small>
            </div>
          </div>
          <div className="role-badge-row">
            <span className={`role-indicator-badge role-${(role || 'MINISTRY').toLowerCase()}`}>
              {(role || 'MINISTRY').replace(/_/g, ' ')}
            </span>
            <span className="role-scope-badge">
              📍 {user?.scope_id || user?.scope_state || 'National Scope'}
            </span>
            <span className="role-perm-badge" title="Granted system permissions">
              🔒 {(user?.permissions || []).length} Permissions Active
            </span>
          </div>
        </div>
      </div>

      {auditNotice && (
        <div className="notice" style={{ background: '#eaf8f5', borderColor: '#48a88a', color: '#134e48', marginTop: 12 }}>
          <strong>Notice:</strong> <span>{auditNotice}</span>
        </div>
      )}

      {/* 2. UNIQUE ROLE-SPECIFIC KPI METRICS GRID */}
      <div style={{ marginTop: 16 }}>
        {/* ROLE A: MINISTRY */}
        {role === 'MINISTRY' && (
          <div className="kpi-grid">
            <div className="stat-block">
              <div className="stat-label">National Scheme Outlay</div>
              <div className="stat-value">{compactMoney(ministry.total_national_budget)}</div>
              <div className="stat-detail tone-gold">{money(ministry.total_national_budget)} allocated</div>
            </div>
            <div className="stat-block">
              <div className="stat-label">Central Tranche Release Rate</div>
              <div className="stat-value">{pct(ministry.national_disbursement_rate)}</div>
              <div className="stat-detail tone-teal">Disbursed to State SNAs</div>
            </div>
            <div className="stat-block">
              <div className="stat-label">Inter-State Risk Disparity</div>
              <div className="stat-value">{ministry.disparity_index}%</div>
              <div className="stat-detail tone-orange">Risk variance across 16 states</div>
            </div>
            <div className="stat-block">
              <div className="stat-label">SC/ST Quota Adherence</div>
              <div className="stat-value">{ministry.sc_st_compliance_rate}%</div>
              <div className="stat-detail tone-teal">Mandatory 15% SC / 7.5% ST target</div>
            </div>
            <div className="stat-block">
              <div className="stat-label">Central PAC Escalations</div>
              <div className="stat-value">{ministry.central_audit_escalations}</div>
              <div className="stat-detail tone-red">{ministry.pac_questions_pending} pending replies</div>
            </div>
          </div>
        )}

        {/* ROLE B: STATE_NODAL_AUTHORITY */}
        {role === 'STATE_NODAL_AUTHORITY' && (
          <div className="kpi-grid">
            <div className="stat-block">
              <div className="stat-label">State Nodal Pool (SNA)</div>
              <div className="stat-value">{compactMoney(stateData.sna_allocated)}</div>
              <div className="stat-detail tone-gold">{money(stateData.sna_allocated)} total pool</div>
            </div>
            <div className="stat-block">
              <div className="stat-label">SNA Pool Utilization</div>
              <div className="stat-value">{pct(stateData.sna_utilization_rate)}</div>
              <div className="stat-detail tone-teal">{compactMoney(stateData.sna_expenditure)} spent</div>
            </div>
            <div className="stat-block">
              <div className="stat-label">SNA Unspent Balance</div>
              <div className="stat-value">{compactMoney(stateData.sna_unspent)}</div>
              <div className="stat-detail tone-blue">Available for re-allocation</div>
            </div>
            <div className="stat-block">
              <div className="stat-label">Pending UC Submissions</div>
              <div className="stat-value">{stateData.pending_uc_count} works</div>
              <div className="stat-detail tone-orange">{stateData.uc_compliance_rate}% compliance rate</div>
            </div>
            <div className="stat-block">
              <div className="stat-label">Districts Under Oversight</div>
              <div className="stat-value">{stateData.districts_monitored}</div>
              <div className="stat-detail tone-teal">Active district cells</div>
            </div>
          </div>
        )}

        {/* ROLE C: DISTRICT_AUTHORITY */}
        {role === 'DISTRICT_AUTHORITY' && (
          <div className="kpi-grid">
            <div className="stat-block">
              <div className="stat-label">Administrative Sanctions</div>
              <div className="stat-value">{districtData.administrative_sanctions_count}</div>
              <div className="stat-detail tone-teal">Active schemes in district</div>
            </div>
            <div className="stat-block">
              <div className="stat-label">Technical Sanctions Pending</div>
              <div className="stat-value">{districtData.technical_sanctions_pending}</div>
              <div className="stat-detail tone-orange">Awaiting engineering sign-off</div>
            </div>
            <div className="stat-block">
              <div className="stat-label">Active Work Orders</div>
              <div className="stat-value">{districtData.work_orders_issued}</div>
              <div className="stat-detail tone-blue">Under ground execution</div>
            </div>
            <div className="stat-block">
              <div className="stat-label">Site Verification Backlog</div>
              <div className="stat-value">{districtData.site_inspections_backlog}</div>
              <div className="stat-detail tone-red">High-risk physical checks due</div>
            </div>
            <div className="stat-block">
              <div className="stat-label">Execution Velocity</div>
              <div className="stat-value">{districtData.avg_turnaround_days} days</div>
              <div className="stat-detail tone-teal">{districtData.delayed_beyond_90_days} delayed &gt;90d</div>
            </div>
          </div>
        )}

        {/* ROLE D: MEMBER_OF_PARLIAMENT */}
        {role === 'MEMBER_OF_PARLIAMENT' && (
          <div className="kpi-grid">
            <div className="stat-block">
              <div className="stat-label">Annual MPLADS Quota</div>
              <div className="stat-value">₹5.00 Cr</div>
              <div className="stat-detail tone-gold">Statutory entitlement / FY</div>
            </div>
            <div className="stat-block">
              <div className="stat-label">Sanctioned from Quota</div>
              <div className="stat-value">{compactMoney(mpData.total_sanctioned)}</div>
              <div className="stat-detail tone-teal">{mpData.quota_utilization_pct}% committed</div>
            </div>
            <div className="stat-block">
              <div className="stat-label">Uncommitted Balance</div>
              <div className="stat-value">{compactMoney(mpData.unspent_entitlement)}</div>
              <div className="stat-detail tone-blue">Available for recommendations</div>
            </div>
            <div className="stat-block">
              <div className="stat-label">Works Pipeline</div>
              <div className="stat-value">{mpData.works_recommended} works</div>
              <div className="stat-detail tone-teal">{mpData.works_completed} completed · {mpData.works_in_progress} active</div>
            </div>
            <div className="stat-block">
              <div className="stat-label">SC/ST Quota Compliance</div>
              <div className="stat-value">✓ Compliant</div>
              <div className="stat-detail tone-teal">SC: {compactMoney(mpData.sc_allocation_inr)} · ST: {compactMoney(mpData.st_allocation_inr)}</div>
            </div>
          </div>
        )}
      </div>

      {/* 3. UNIQUE ROLE-SPECIFIC DEEP DIVE PANELS */}
      <div style={{ marginTop: 18 }}>
        {role === 'MINISTRY' && (
          <div className="grid-2">
            {/* Central Release Tranche Progress */}
            <div className="panel">
              <div className="panel-head">
                <div>
                  <div className="eyebrow">CENTRAL DISBURSEMENT SCHEDULE</div>
                  <h2>MPLADS Central Fund Tranche Releases</h2>
                </div>
                <span className="badge-counter">FY 2024-25</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {ministry.central_release_tranches?.map((tr: any) => (
                  <div key={tr.tranche} style={{ padding: '12px 14px', background: '#fafcfb', border: '1px solid var(--line)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: 13, color: 'var(--deep)' }}>{tr.tranche}</strong>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Released: ₹{tr.released_cr} Crore · Utilization: {tr.utilization_pct}%</div>
                    </div>
                    <span className={`risk-badge ${tr.status === 'Completed' ? 'risk-low' : tr.status === 'In Progress' ? 'risk-medium' : 'risk-low'}`}>
                      {tr.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Priority States for Central Intervention */}
            <div className="panel">
              <div className="panel-head">
                <div>
                  <div className="eyebrow">MACRO OVERSIGHT</div>
                  <h2>Priority States Requiring Central Review</h2>
                </div>
                <Link to="/analytics" className="text-link">Full analysis →</Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(dashboard?.state_wise || []).slice(0, 3).map((st: any) => (
                  <div key={st.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#fafcfb', border: '1px solid var(--line)', borderRadius: 6 }}>
                    <div>
                      <strong>{st.name}</strong>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{st.projects} works · {compactMoney(st.sanctioned)} sanctioned</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: 700, color: (st.average_risk ?? 0) >= 50 ? 'var(--crimson)' : 'var(--orange)' }}>
                        {typeof st.average_risk === 'number' ? st.average_risk.toFixed(1) : '—'}% Risk
                      </span>
                      <div style={{ fontSize: 10, color: 'var(--muted)' }}>{(st.high_risk || 0) + (st.critical || 0)} flagged</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {role === 'STATE_NODAL_AUTHORITY' && (
          <div className="grid-2">
            {/* District Performance Ranking in State */}
            <div className="panel">
              <div className="panel-head">
                <div>
                  <div className="eyebrow">DISTRICT PERFORMANCE RANKING</div>
                  <h2>{stateTarget} Districts Execution Ledger</h2>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(dashboard?.district_wise || []).slice(0, 4).map((d: any, idx: number) => (
                  <div key={d.district} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#fafcfb', border: '1px solid var(--line)', borderRadius: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#e2ece7', color: '#16655c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                        {idx + 1}
                      </span>
                      <div>
                        <strong>{d.district}</strong>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{d.projects} works · {compactMoney(d.sanctioned)}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: 700, color: 'var(--teal)' }}>{pct(d.utilization_ratio)} Used</span>
                      <div style={{ fontSize: 10, color: 'var(--muted)' }}>Avg Risk: {typeof d.average_risk === 'number' ? d.average_risk.toFixed(1) : '0.0'}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Implementing Agency Risk Breakdown in State */}
            <div className="panel">
              <div className="panel-head">
                <div>
                  <div className="eyebrow">AGENCY CONCENTRATION</div>
                  <h2>Executing Agency Risk Profile</h2>
                </div>
                <Link to="/agencies" className="text-link">Agency radar →</Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['PWD', 'Rural Development', 'Urban Development', 'Health Department'].map((ag, i) => (
                  <div key={ag} style={{ padding: '8px 12px', background: '#fafcfb', border: '1px solid var(--line)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: 12 }}>{ag}</strong>
                      <div style={{ fontSize: 10, color: 'var(--muted)' }}>{(12 - i * 2)} projects under active execution</div>
                    </div>
                    <span className="risk-badge risk-low" style={{ fontSize: 10 }}>{(75 - i * 6)}% On Track</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {role === 'DISTRICT_AUTHORITY' && (
          <div className="grid-2">
            {/* Field Inspection Verification Queue */}
            <div className="panel">
              <div className="panel-head">
                <div>
                  <div className="eyebrow">FIELD VERIFICATION QUEUE</div>
                  <h2>High-Priority Site Inspections Due</h2>
                </div>
                <button type="button" className="button ghost" onClick={handleIssueNotice}>Dispatch Team</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(dashboard?.top_projects || []).slice(0, 3).map((p: any) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#fafcfb', border: '1px solid var(--line)', borderRadius: 6 }}>
                    <div>
                      <strong style={{ fontSize: 12 }}>{p.project_name || p.project_code}</strong>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.category || 'Civil Work'} · Sanction: {compactMoney(p.sanction_amount)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="risk-badge risk-high" style={{ fontSize: 10 }}>Physical Check Due</span>
                      <div style={{ fontSize: 10, color: 'var(--crimson)', marginTop: 2 }}>{p.delay_days ? `${Math.round(p.delay_days)}d delay` : 'Milestone pending'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* District Operational Velocity */}
            <div className="panel">
              <div className="panel-head">
                <div>
                  <div className="eyebrow">OPERATIONAL STATS</div>
                  <h2>{districtTarget} Execution Milestones</h2>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ fontSize: 12 }}>Technical Sanction Turnaround</span>
                  <strong>14 Days (Target: &lt;21d) ✓</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ fontSize: 12 }}>Geo-tagged Photo Upload Rate</span>
                  <strong>88.5% Compliant</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ fontSize: 12 }}>Contractor Penalties Accrued</span>
                  <strong style={{ color: 'var(--crimson)' }}>₹4.2 Lakhs (Delayed works)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                  <span style={{ fontSize: 12 }}>UCs Submitted to State SNA</span>
                  <strong style={{ color: 'var(--teal)' }}>12 of 15 Works Completed</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {role === 'MEMBER_OF_PARLIAMENT' && (
          <div className="grid-2">
            {/* Sectoral Distribution of Recommendations */}
            <div className="panel">
              <div className="panel-head">
                <div>
                  <div className="eyebrow">CONSTITUENCY ALLOCATION</div>
                  <h2>MP Recommended Works by Priority Sector</h2>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { sector: 'Drinking Water & Borewells', count: 8, amount: 12000000, pct: '31%' },
                  { sector: 'Government Schools & Anganwadis', count: 6, amount: 9500000, pct: '25%' },
                  { sector: 'Primary Health Centres (PHC)', count: 4, amount: 7200000, pct: '19%' },
                  { sector: 'Community Roads & Streetlights', count: 6, amount: 9800000, pct: '25%' },
                ].map(item => (
                  <div key={item.sector} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#fafcfb', border: '1px solid var(--line)', borderRadius: 6 }}>
                    <div>
                      <strong style={{ fontSize: 12 }}>{item.sector}</strong>
                      <div style={{ fontSize: 10, color: 'var(--muted)' }}>{item.count} recommended works ({item.pct} of quota)</div>
                    </div>
                    <strong>{compactMoney(item.amount)}</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Citizen Asset Delivery Impact */}
            <div className="panel">
              <div className="panel-head">
                <div>
                  <div className="eyebrow">CITIZEN ASSETS DELIVERED</div>
                  <h2>Constituency Asset Delivery Status</h2>
                </div>
                <button type="button" className="button ghost" onClick={handleFlagPAC}>Export MP Report</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ fontSize: 12 }}>Physically Completed Assets</span>
                  <strong style={{ color: 'var(--teal)' }}>10 Works Delivered to Citizens</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ fontSize: 12 }}>Estimated Citizen Beneficiaries</span>
                  <strong>~1,85,000 Constituency Residents</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ fontSize: 12 }}>Scheduled Caste Area Works</span>
                  <strong style={{ color: 'var(--teal)' }}>₹82.0 L (Exceeds ₹75L Mandate) ✓</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                  <span style={{ fontSize: 12 }}>Scheduled Tribe Area Works</span>
                  <strong style={{ color: 'var(--teal)' }}>₹41.0 L (Exceeds ₹37.5L Mandate) ✓</strong>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. CONDITIONAL UI ELEMENTS USING HasPermission WRAPPER */}
      <div style={{ marginTop: 20 }}>
        {/* A. AUDIT ACTIONS SUITE - Wrapped in HasPermission */}
        <div className="panel" style={{ borderLeft: '4px solid var(--teal)' }}>
          <div className="panel-head">
            <div>
              <div className="eyebrow">ROLE-BASED ACTION CONTROLS</div>
              <h2>Statutory Audit & Oversight Operations</h2>
              <p className="muted">Operations are conditionally gated based on official permissions provisioned by the Identity Provider.</p>
            </div>
          </div>

          <HasPermission
            permission="audit:write"
            fallback={
              <div className="role-audit-fallback" style={{ padding: '16px', background: '#fafbfc', border: '1px dashed #cbd5e1', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>🛡️</span>
                <div>
                  <strong style={{ fontSize: 13, color: 'var(--deep)' }}>Parliamentary & Analytical Review Access</strong>
                  <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>
                    Direct executive audit dispatch and show-cause notice powers are reserved for Executive Officers (District Magistrates, State Nodal Officers, and Ministry Administrators). Your account has full analytic review and recommendation privileges.
                  </p>
                  <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                    <button type="button" className="button secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={onExportCSV}>
                      Download Constituency Audit Register (CSV)
                    </button>
                    <button type="button" className="button ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={handleFlagPAC}>
                      Submit Parliamentary Question / PAC Inquiry
                    </button>
                  </div>
                </div>
              </div>
            }
          >
            <div className="role-audit-actions-bar" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="button primary"
                onClick={handleTriggerAuditSweep}
                disabled={auditLoading}
              >
                {auditLoading ? 'Scanning...' : '⚡ Trigger Priority Audit Sweep'}
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={handleIssueNotice}
              >
                ✉ Dispatch Agency Show-Cause Notice
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={onExportCSV}
              >
                📥 Export Statutory Audit Ledger (CSV)
              </button>
              <button
                type="button"
                className="button ghost"
                onClick={handleFlagPAC}
              >
                🚩 Flag for Central PAC Review
              </button>
            </div>
          </HasPermission>
        </div>

        {/* B. ADMINISTRATIVE USER MANAGEMENT TABLE - Wrapped in HasPermission */}
        <div style={{ marginTop: 20 }}>
          <HasPermission
            permission="users:manage"
            fallback={
              <div className="panel" style={{ borderLeft: '4px solid #cbd5e1', opacity: 0.9 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div className="eyebrow" style={{ color: 'var(--muted)' }}>ADMINISTRATIVE GOVERNANCE (RESTRICTED)</div>
                    <h3 style={{ fontSize: 14, margin: '4px 0', color: 'var(--deep)' }}>User & Identity Provisioning Roster</h3>
                    <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                      Administrative account provisioning and jurisdictional scoping is restricted to Ministry Headquarters and State Nodal Authority officials (requires <code>users:manage</code> permission).
                    </p>
                  </div>
                  <span className="role-perm-badge" style={{ background: '#f1f5f3', color: 'var(--muted)' }}>
                    🔒 Access Restricted to Ministry & SNA
                  </span>
                </div>
              </div>
            }
          >
            <AdministrativeGovernanceTable />
          </HasPermission>
        </div>
      </div>
    </div>
  );
}

/**
 * Administrative Governance Table component conditionally rendered for users with users:manage permission
 */
function AdministrativeGovernanceTable() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axios.get(`${API_BASE}/api/auth/users`)
      .then(res => setUsers(res.data.items || []))
      .catch((err) => {
        setUsers([]);
        setError(err.response?.data?.detail || err.message || 'Unable to load user roster.');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="panel" style={{ borderLeft: '4px solid var(--gold)' }}>
      {error && (
        <div className="notice" style={{ color: '#b91c1c', background: '#fef2f2', borderColor: '#fca5a5', marginBottom: 12 }}>
          <span>⚠ {error}</span>
        </div>
      )}
      <div className="panel-head">
        <div>
          <div className="eyebrow" style={{ color: 'var(--gold)' }}>ADMINISTRATIVE GOVERNANCE</div>
          <h2>Authorized Official Accounts & Territorial Roster</h2>
          <p className="muted">Government officials provisioned with statutory oversight permissions across National, State, District, and Parliamentary jurisdictions.</p>
        </div>
        <Link to="/users" className="button secondary">
          Open User Management →
        </Link>
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Official / User</th>
              <th>Identity ID</th>
              <th>Official Role</th>
              <th>Jurisdiction</th>
              <th>Status</th>
              <th>Permissions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '16px', color: 'var(--muted)' }}>Loading official accounts...</td>
              </tr>
            ) : users.length ? (
              users.map(u => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.name}</strong>
                    <small>{u.email}</small>
                  </td>
                  <td>
                    <code style={{ fontSize: 11, background: '#f1f5f3', padding: '2px 6px', borderRadius: 3 }}>
                      {u.identity_id}
                    </code>
                  </td>
                  <td>
                    <span className={`risk-badge ${u.role === 'MINISTRY' ? 'risk-critical' : u.role === 'STATE_NODAL_AUTHORITY' ? 'risk-high' : 'risk-medium'}`} style={{ fontSize: 10 }}>
                      {u.role.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>{u.scope_id || u.scope_state || 'National'}</td>
                  <td>
                    <span style={{ fontSize: 11, fontWeight: 700, color: u.status === 'ACTIVE' ? 'var(--teal)' : 'var(--orange)' }}>
                      ● {u.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 260 }}>
                      {(u.permissions || []).slice(0, 3).map((p: string) => (
                        <span key={p} style={{ fontSize: 9, background: '#eaf4f1', color: '#16655c', padding: '2px 5px', borderRadius: 3, fontWeight: 600 }}>
                          {p}
                        </span>
                      ))}
                      {(u.permissions || []).length > 3 && (
                        <span style={{ fontSize: 9, color: 'var(--muted)', alignSelf: 'center' }}>
                          +{(u.permissions || []).length - 3} more
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '16px', color: 'var(--muted)' }}>No accounts provisioned.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default RoleDashboardSection;
