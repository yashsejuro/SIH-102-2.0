import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { API_BASE } from './auth';

const labels: Record<string, string> = { 
  SANCTIONED_WORKS: 'Sanctioned works', 
  COMPLETED_WORKS: 'Completed works', 
  EXPENDITURE: 'Expenditure', 
  MP_ALLOCATION: 'MP allocation', 
  CALAMITY: 'Calamity relief',
  OTHER: 'Needs confirmation' 
};

export default function IntegrationPage() {
  const [run, setRun] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();
  const runId = new URLSearchParams(location.search).get('run_id');

  useEffect(() => {
    setLoading(true);
    setError(null);
    const request = runId
      ? axios.get(`${API_BASE}/api/analysis-runs/${runId}`)
      : axios.get(`${API_BASE}/api/analysis-runs/active`);

    request
      .then(response => setRun(response.data))
      .catch((err) => {
        setRun(null);
        setError(err.response?.data?.detail || err.message || 'Unable to load dataset lineage.');
      })
      .finally(() => setLoading(false));
  }, [runId]);

  if (loading) {
    return (
      <div className="page-stack">
        <div className="page-heading simple">
          <div>
            <div className="eyebrow">DATA INTEGRATION</div>
            <h1>Source relationships</h1>
            <p>Loading analysis and dataset lineage...</p>
          </div>
        </div>
        <div className="page-loading">Loading dataset mappings and lineage...</div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="page-stack">
        {error && (
          <div className="notice" style={{ color: '#b91c1c', background: '#fef2f2', borderColor: '#fca5a5', marginBottom: 12 }}>
            <span>⚠ {error}</span>
          </div>
        )}
        <div className="page-heading simple">
          <div>
            <div className="eyebrow">DATA INTEGRATION</div>
            <h1>Source relationships</h1>
            <p>No active analysis run available.</p>
          </div>
        </div>
        <div className="empty-state">
          <div className="empty-mark">/</div>
          <strong>No Active Analysis Run</strong>
          <span>Upload datasets in the Upload &amp; Analyze section to initiate cross-dataset reconciliation.</span>
        </div>
      </div>
    );
  }

  const summary = run.summary || {};
  const datasets = summary.datasets || [];
  const conflicts = summary.conflicts || [];

  return (
    <div className="page-stack">
      <div className="page-heading simple">
        <div>
          <div className="eyebrow">DATA INTEGRATION</div>
          <h1>Source relationships</h1>
          <p>Canonical project records, workbook roles, and join coverage for the latest analysis run.</p>
        </div>
      </div>

      <div className="notice">
        <strong>Run #{run.id || 'Active'}</strong>
        <span>Every analytical record retains the source datasets that contributed to it.</span>
        <span className="notice-tag">SOURCE LINEAGE</span>
      </div>

      <section className="kpi-grid">
        <div className="stat-block">
          <div className="stat-label">Rows processed</div>
          <div className="stat-value">{Number(summary.rows_processed || 0).toLocaleString('en-IN')}</div>
        </div>
        <div className="stat-block">
          <div className="stat-label">Projects created</div>
          <div className="stat-value">{Number(summary.projects_created || 0).toLocaleString('en-IN')}</div>
        </div>
        <div className="stat-block">
          <div className="stat-label">Completed matches</div>
          <div className="stat-value">{Number(summary.matched_completed || 0).toLocaleString('en-IN')}</div>
        </div>
        <div className="stat-block">
          <div className="stat-label">Expenditure matches</div>
          <div className="stat-value">{Number(summary.matched_expenditure || 0).toLocaleString('en-IN')}</div>
        </div>
        <div className="stat-block">
          <div className="stat-label">Allocation matched</div>
          <div className="stat-value">{Number(summary.allocation_matched || 0).toLocaleString('en-IN')}</div>
        </div>
        <div className="stat-block">
          <div className="stat-label">Calamity records</div>
          <div className="stat-value">{Number(summary.calamity_count || 0).toLocaleString('en-IN')}</div>
        </div>
        <div className="stat-block">
          <div className="stat-label">Conflicts</div>
          <div className="stat-value">{Number(conflicts.length || 0).toLocaleString('en-IN')}</div>
        </div>
      </section>

      <section className="panel">
        <div className="eyebrow">DATASETS PROCESSED</div>
        <h2>Workbook detection and mapping</h2>
        {datasets.length ? (
          <div className="dataset-list">
            {datasets.map((dataset: any) => (
              <div className="dataset-card" key={dataset.filename}>
                <div>
                  <strong>{dataset.filename}</strong>
                  <span>{(dataset.file_type || 'FILE').toUpperCase()} · {dataset.selected_sheet || 'Default sheet'}</span>
                </div>
                <div className="dataset-role">
                  <b>{labels[dataset.detected_role] || dataset.detected_role || 'Unmapped'}</b>
                  <span> · {Math.min(100, Math.max(0, Number(dataset.confidence || 0))).toFixed(0)}% confidence</span>
                  <small>
                    {(dataset.sheets || []).map((sheet: any) => `${sheet.sheet || 'Sheet'}: ${Number(sheet.rows || 0).toLocaleString('en-IN')} rows`).join(' · ')}
                  </small>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: '24px 16px' }}>
            <strong>No datasets recorded</strong>
            <span>No files were attached to this analysis run.</span>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="eyebrow">INTEGRATION RELATIONSHIP</div>
        <h2>How datasets were joined</h2>
        <p>{summary.relationship || 'No relationship information available for this run.'}</p>
      </section>

      {conflicts.length > 0 && (
        <section className="panel">
          <div className="eyebrow">CROSS-DATASET CONFLICTS</div>
          <h2>Data quality issues detected</h2>
          <div className="dataset-list">
            {conflicts.slice(0, 10).map((conflict: any, idx: number) => (
              <div className="dataset-card" key={idx}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong>Project: {conflict.project_id || 'N/A'}</strong>
                  <span style={{ color: 'var(--muted)' }}>·</span>
                  <span>Field: {conflict.field || 'General'}</span>
                </div>
                <div className="dataset-role">
                  <span>Source: {conflict.source || 'Uploaded workbook'}</span>
                  <small>Existing: {String(conflict.existing ?? 'None')} → Incoming: {String(conflict.incoming ?? 'None')}</small>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
