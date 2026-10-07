import { ChangeEvent, FormEvent, useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from './auth';
const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.csv', '.xlsx', '.xls']);

type DatasetInfo = {
  filename: string;
  file_type: string;
  detected_role: string;
  confidence: number;
  selected_sheet?: string;
  sheets?: Array<{ sheet: string; rows: number; role: string; confidence: number }>;
  column_mapping?: Array<{ uploaded_column: string; canonical_field: string; confidence: number; status: string }>;
};

type DatasetIntegrity = {
  id: number;
  file_name: string;
  integrity_status: string;
  algorithm: string;
};

type PrivacyResult = {
  privacy_status: string;
  pii_detected: boolean;
  columns: Array<{ column: string; type: string; confidence: string; count: number }>;
};

type UndoStatus = {
  has_undoable_dataset: boolean;
  is_expired?: boolean;
  dataset_name?: string;
  files?: string[];
  uploaded_at?: string;
  grace_period_seconds?: number;
  seconds_remaining?: number;
  run_id?: number;
  records_count?: number;
};

const roleLabel: Record<string, string> = {
  SANCTIONED_WORKS: 'Sanctioned works',
  COMPLETED_WORKS: 'Completed works',
  EXPENDITURE: 'Expenditure',
  MP_ALLOCATION: 'MP allocation',
  CALAMITY: 'Calamity relief',
  OTHER: 'Needs confirmation',
};

export default function MultiUploadPage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [inspected, setInspected] = useState<DatasetInfo[]>([]);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('Upload');
  const [isDragging, setIsDragging] = useState(false);
  const [privacyResults, setPrivacyResults] = useState<Record<string, PrivacyResult>>({});
  const [privacyBusy, setPrivacyBusy] = useState<number | null>(null);
  const [undoStatus, setUndoStatus] = useState<UndoStatus | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [isUndoing, setIsUndoing] = useState(false);
  const [undoMessage, setUndoMessage] = useState<string>('');
  const [showUndoModal, setShowUndoModal] = useState(false);
  const stages = ['Upload', 'Detect', 'Map', 'Integrate', 'Validate', 'Analyze', 'Results'];

  const checkUndoStatus = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/datasets/undo-status`);
      setUndoStatus(res.data);
      if (typeof res.data?.seconds_remaining === 'number') {
        setSecondsRemaining(res.data.seconds_remaining);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    checkUndoStatus();
  }, []);

  // Real-time ticking countdown for undo grace period
  useEffect(() => {
    if (secondsRemaining <= 0) return;
    const timer = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          checkUndoStatus();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsRemaining]);

  const handleUndoDataset = async () => {
    if (!undoStatus?.has_undoable_dataset) return;
    setIsUndoing(true);
    try {
      const res = await axios.post(`${API_BASE}/api/datasets/undo`);
      setUndoMessage(res.data?.message || 'Dataset successfully removed and baseline register restored.');
      setShowUndoModal(false);
      setResult(null);
      setFiles([]);
      setInspected([]);
      setStage('Upload');
      await checkUndoStatus();
    } catch (err: any) {
      setUndoMessage(err.response?.data?.error || 'Failed to remove dataset or undo window expired.');
    } finally {
      setIsUndoing(false);
    }
  };

  const formatCountdown = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}m ${String(secs).padStart(2, '0')}s`;
  };

  const handleSelectedFiles = (selectedFiles: File[]) => {
    const invalid = selectedFiles.find(
      file => !ALLOWED_EXTENSIONS.has(file.name.slice(file.name.lastIndexOf('.')).toLowerCase()) || file.size > MAX_UPLOAD_SIZE_BYTES
    );
    if (invalid) {
      setResult({
        error: invalid.size > MAX_UPLOAD_SIZE_BYTES
          ? 'File exceeds the maximum allowed upload size (50 MB).'
          : 'Unsupported or invalid file type. Please upload .csv or .xlsx files.'
      });
      setStage('Results');
      return;
    }
    setFiles(previous => [
      ...previous,
      ...selectedFiles.filter(file => !previous.some(existing => existing.name === file.name))
    ]);
  };

  const addFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    handleSelectedFiles(selected);
    event.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleSelectedFiles(Array.from(e.dataTransfer.files));
    }
  };

  const downloadSampleDataset = () => {
    const csvContent = [
      'project_id,project_name,project_code,state,district,constituency,category,agency,sanction_amount,expenditure,expected_completion_date,actual_completion_date,status',
      'KA-BLR-001,Construction of Community Health Center,MPLADS-2024-001,Karnataka,Bengaluru Urban,Bengaluru Central,Health,PWD,2500000,2450000,2024-03-31,2024-04-15,Completed',
      'KA-BLR-002,Installation of Solar LED Street Lights,MPLADS-2024-002,Karnataka,Bengaluru Urban,Bengaluru Central,Community Infrastructure,Rural Development,1200000,1180000,2024-02-28,2024-03-10,Completed',
      'KA-BLR-003,Upgradation of Government Higher Primary School,MPLADS-2024-003,Karnataka,Bengaluru Urban,Bengaluru Central,Education,PWD,1800000,1950000,2023-12-31,2024-05-20,Delayed',
      'KA-BLR-004,Drinking Water Supply Pipeline Network,MPLADS-2024-004,Karnataka,Bengaluru Urban,Bengaluru Central,Water Supply,Water Resources,3500000,1200000,2024-08-31,,In Progress',
      'KA-BLR-005,Construction of Asphalt Road in Ward 12,MPLADS-2024-005,Karnataka,Bengaluru Urban,Bengaluru Central,Roads,PWD,1500000,1500000,2024-01-15,2024-02-15,Completed'
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'mplads_sample_register.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const removeFile = (name: string) => {
    setFiles(previous => (Array.isArray(previous) ? previous.filter(file => file.name !== name) : []));
    setInspected(previous => (Array.isArray(previous) ? previous.filter(file => file.filename !== name) : []));
  };

  const inspect = async () => {
    if (!files.length) return;
    setBusy(true);
    setStage('Detect');
    const form = new FormData();
    files.forEach(file => form.append('files', file));
    try {
      const response = await axios.post(`${API_BASE}/api/inspect-datasets`, form);
      setInspected(Array.isArray(response.data?.files) ? response.data.files : []);
      setStage('Map');
    } catch (error: any) {
      setInspected([]);
      setResult({ error: error.response?.data?.detail || error.message || 'Dataset inspection failed' });
      setStage('Results');
    } finally {
      setBusy(false);
    }
  };

  const analyze = async (event: FormEvent) => {
    event.preventDefault();
    if (!files.length) return;
    setBusy(true);
    setStage('Integrate');
    const form = new FormData();
    files.forEach(file => form.append('files', file));
    setStage('Validate');
    setStage('Analyze');
    try {
      const response = await axios.post(`${API_BASE}/api/analyze-multi`, form, { timeout: 0 });
      setResult(response.data);
      setStage('Results');
      const analysisRunId = response.data.analysis_run_id;
      if (analysisRunId) {
        navigate(`/?run_id=${encodeURIComponent(String(analysisRunId))}`, { replace: true });
      }
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      setResult({ error: typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : error.message || 'Analysis failed' });
      setStage('Results');
    } finally {
      setBusy(false);
    }
  };

  const scanPrivacy = async (datasetId: number) => {
    setPrivacyBusy(datasetId);
    try {
      const response = await axios.post(`${API_BASE}/api/datasets/${datasetId}/privacy-scan`);
      setPrivacyResults(previous => ({ ...previous, [datasetId]: response.data }));
    } catch (error: any) {
      setResult({ error: error.response?.data?.detail || 'Privacy scan failed' });
    } finally {
      setPrivacyBusy(null);
    }
  };

  return <div className="page-stack">
    <div className="page-heading simple"><div><div className="eyebrow">UPLOAD PROJECT FILES</div><h1>Upload project files</h1><p>Add one or more CSV or Excel files. The overview will use only the files you upload.</p></div></div>

    {undoMessage && (
      <div className="notice" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ecfdf5', borderColor: '#a7f3d0' }}>
        <span style={{ color: '#065f46', fontWeight: 600 }}>✓ {undoMessage}</span>
        <button type="button" onClick={() => setUndoMessage('')} style={{ background: 'transparent', border: 0, cursor: 'pointer', fontSize: 16 }}>×</button>
      </div>
    )}

    {/* ACTIVE DATASET UNDO GRACE PERIOD PANEL */}
    {undoStatus?.has_undoable_dataset && (
      <section className="panel" style={{ background: '#f8fafc', border: '1.5px solid #93c5fd', borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#1d4ed8', background: '#dbeafe', padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <span>⏱️</span> Undo Grace Period Active (15 Minutes)
            </div>
            <h2 style={{ fontSize: 16, margin: '6px 0 2px', color: '#0f172a' }}>
              Active Ingested Dataset: {undoStatus.dataset_name || 'Uploaded Register'}
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: '#475569' }}>
              {undoStatus.records_count || 180} records loaded into analysis engine. You have a 15-minute rollback window to remove this dataset if uploaded in error.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Time Remaining</div>
              <strong style={{ fontSize: 18, color: secondsRemaining < 120 ? '#dc2626' : '#2563eb', fontFamily: 'monospace' }}>
                {formatCountdown(secondsRemaining)}
              </strong>
            </div>

            <button
              type="button"
              className="button secondary"
              style={{ background: '#ffffff', color: '#b91c1c', borderColor: '#fca5a5', fontWeight: 700, padding: '8px 14px', cursor: 'pointer' }}
              onClick={() => setShowUndoModal(true)}
              disabled={isUndoing}
            >
              {isUndoing ? 'Reverting Ingestion...' : '↺ Remove Dataset (Undo)'}
            </button>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden', marginTop: 12 }}>
          <div
            style={{
              width: `${Math.min(100, Math.max(0, (secondsRemaining / (undoStatus.grace_period_seconds || 900)) * 100))}%`,
              height: '100%',
              background: secondsRemaining < 120 ? '#ef4444' : '#3b82f6',
              transition: 'width 1s linear',
            }}
          />
        </div>
      </section>
    )}

    {/* MultiUploadPage Undo Confirmation Modal */}
    {showUndoModal && undoStatus && (
      <div
        className="modal-backdrop"
        style={{ zIndex: 9999 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="multiupload-undo-title"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isUndoing) {
            setShowUndoModal(false);
          }
        }}
      >
        <section
          className="modal panel"
          style={{
            maxWidth: 540,
            width: '92%',
            background: '#ffffff',
            borderRadius: 12,
            padding: '24px 28px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          }}
        >
          <button
            className="modal-close"
            onClick={() => setShowUndoModal(false)}
            disabled={isUndoing}
            title="Close modal"
            style={{ fontSize: 20, cursor: 'pointer', background: 'transparent', border: 0, color: 'var(--muted)' }}
          >
            ×
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 26, lineHeight: 1 }}>⚠️</span>
            <div className="eyebrow" style={{ color: '#b91c1c', fontWeight: 800, letterSpacing: '0.08em' }}>
              DATASET ROLLBACK CONFIRMATION
            </div>
          </div>

          <h2 id="multiupload-undo-title" style={{ fontSize: 20, margin: '4px 0 10px', color: 'var(--deep)', fontWeight: 700 }}>
            Remove Ingested Dataset?
          </h2>

          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
            Are you sure you want to rollback this uploaded dataset during the 15-minute grace period? This action will immediately purge the dataset from the live analysis engine and restore the canonical baseline register.
          </p>

          <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 12 }}>
              <span style={{ color: '#991b1b', fontWeight: 600 }}>Target Dataset:</span>
              <span style={{ color: '#7f1d1d', fontWeight: 700, wordBreak: 'break-all' }}>{undoStatus.dataset_name || 'Uploaded Register'}</span>
            </div>
            {undoStatus.records_count && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 12 }}>
                <span style={{ color: '#991b1b', fontWeight: 600 }}>Records Ingested:</span>
                <span style={{ color: '#7f1d1d', fontWeight: 700 }}>{undoStatus.records_count} records</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <span style={{ color: '#991b1b', fontWeight: 600 }}>Remaining Grace Window:</span>
              <span style={{ color: '#dc2626', fontWeight: 800, fontFamily: 'monospace', fontSize: 13 }}>
                ⏱️ {formatCountdown(secondsRemaining)}
              </span>
            </div>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 14px', marginBottom: 22, fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
            🛡️ <strong>Safety Guarantee:</strong> Baseline verified projects will be completely preserved and remain available for analysis.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center' }}>
            <button
              type="button"
              className="button secondary"
              onClick={() => setShowUndoModal(false)}
              disabled={isUndoing}
              style={{ fontWeight: 600, padding: '8px 16px', cursor: 'pointer' }}
            >
              Cancel (Keep Dataset)
            </button>
            <button
              type="button"
              className="button"
              onClick={handleUndoDataset}
              disabled={isUndoing}
              style={{
                background: '#dc2626',
                color: '#ffffff',
                borderColor: '#b91c1c',
                fontWeight: 700,
                padding: '8px 18px',
                cursor: isUndoing ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {isUndoing ? 'Reverting Ingestion...' : '↺ Yes, Remove Dataset'}
            </button>
          </div>
        </section>
      </div>
    )}

    <div className="notice"><strong>Your files stay connected</strong><span>Files are kept together so project details, spending, progress, and review notes can be checked in one place.</span><span className="notice-tag">YOUR DATA</span></div>
    <section className="panel upload-panel"><div className="stage-line">{stages.map((item, index) => <div className={`stage ${stages.indexOf(stage) >= index ? 'complete' : ''}`} key={item}><span>{String(index + 1).padStart(2, '0')}</span>{item}</div>)}</div>
      <div className="upload-workspace">
        <div>
          <div className="upload-form">
            <div
              className={`drop-zone ${isDragging ? 'drag-over' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="upload-symbol">↑</div>
              <h2>Add project files</h2>
              <p>Drag & drop CSV or Excel files here, or click to browse.</p>
              <input
                id="multi-file-picker"
                type="file"
                multiple
                accept=".csv,.xlsx,.xls"
                onChange={addFiles}
                style={{ display: 'none' }}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <label className="button secondary" htmlFor="multi-file-picker">
                  Browse files
                </label>
                <button
                  type="button"
                  className="button ghost"
                  onClick={downloadSampleDataset}
                  title="Download standard MPLADS CSV register with sample records"
                >
                  Download Sample CSV
                </button>
              </div>
            </div>
            <div className="upload-side">
              <div className="eyebrow">PIPELINE STATUS</div>
              <strong>{busy ? `${stage}...` : stage}</strong>
              <span>{files.length} {files.length === 1 ? 'file' : 'files'} staged</span>
              <button className="button secondary" type="button" disabled={!files.length || busy} onClick={inspect}>
                Check files
              </button>
              <button className="button primary" type="button" disabled={!files.length || busy} onClick={analyze}>
                Run Isolation Forest Analysis
              </button>
            </div>
          </div>
        </div>
        <aside className="knowledge-context">
          <div className="eyebrow">DATA SPECIFICATION</div>
          <h2>Expected Register Fields</h2>
          <p>The ML model validates canonical fields: project identifier, name, sanction ceiling, cumulative expenditure, completion dates, and executing agency.</p>
          <h3>Audit Best Practices</h3>
          <ul>
            <li>Maintain uniform project ID across sanction and expenditure registers.</li>
            <li>Record sanctioned amount in INR without special currency symbols.</li>
            <li>Ensure completion dates follow ISO standard (YYYY-MM-DD).</li>
            <li>Preview auto-detected workbook mappings before analysis.</li>
          </ul>
          <div className="context-note">
            <strong>Explainable AI Principle</strong>
            <span>Model anomalies identify statistical and rule divergences for human officer review; they are strictly review prompts and not conclusive proof of wrongdoing.</span>
          </div>
        </aside>
      </div>
      <div className="dataset-list">
        {files.length ? (
          files.map(file => {
            const info = (inspected || []).find(item => item?.filename === file.name);
            return (
              <div className="dataset-card" key={file.name}>
                <div>
                  <strong>{file.name}</strong>
                  <span>{file.name.toLowerCase().endsWith('.xlsx') ? 'XLSX workbook' : 'CSV dataset'} · {(file.size / 1024).toFixed(1)} KB</span>
                </div>
                <div className="dataset-role">
                  {info ? (
                    <>
                      <b>{roleLabel[info.detected_role] || info.detected_role || 'Unmapped'}</b>
                      <span> · {Math.min(100, Math.max(0, Number(info.confidence || 0))).toFixed(0)}% confidence · {info.selected_sheet || 'sheet pending'}</span>
                      <small>{info.sheets?.map(sheet => `${sheet.sheet || 'Sheet'}: ${Number(sheet.rows || 0).toLocaleString('en-IN')} rows`).join(' · ')}</small>
                      {info.column_mapping?.length ? (
                        <details>
                          <summary>Detected column mapping</summary>
                          <table className="mapping-table">
                            <thead>
                              <tr>
                                <th>Uploaded column</th>
                                <th>Canonical field</th>
                                <th>Confidence</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(info.column_mapping || []).map(mapping => (
                                <tr key={`${mapping.uploaded_column}-${mapping.canonical_field}`}>
                                  <td>{mapping.uploaded_column}</td>
                                  <td>{mapping.canonical_field}</td>
                                  <td>{Math.min(100, Math.max(0, Number(mapping.confidence || 0))).toFixed(0)}%</td>
                                  <td>{mapping.status}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </details>
                      ) : null}
                    </>
                  ) : (
                    <span>Role not inspected</span>
                  )}
                </div>
                <button className="remove-file" onClick={() => removeFile(file.name)} aria-label={`Remove ${file.name}`}>×</button>
              </div>
            );
          })
        ) : (
          <div className="empty-state">
            <div className="empty-mark">+</div>
            <strong>No datasets selected</strong>
            <span>Select any supported CSV or Excel dataset to begin a new isolated analysis run.</span>
          </div>
        )}
      </div>
      {result && (
        <div className="result-panel">
          <div>
            <div className="eyebrow">FILES {result.error ? 'NEED ATTENTION' : 'READY'}</div>
            <h2>{result.error ? 'We could not use these files yet' : 'Your files are ready'}</h2>
          </div>
          {result.error ? (
            <p>{typeof result.error === 'string' ? result.error : JSON.stringify(result.error)}</p>
          ) : (
            <>
              <div className="result-stats">
                <span><strong>{String(result.files_processed || 0)}</strong> files</span>
                <span><strong>{Number(result.rows_processed || 0).toLocaleString('en-IN')}</strong> rows</span>
                <span><strong>{Number(result.projects_created || 0).toLocaleString('en-IN')}</strong> projects</span>
                <span><strong>{String(result.alerts_created || 0)}</strong> review prompts</span>
              </div>
              {Array.isArray(result.datasets) && (
                <div className="dataset-list">
                  {(result.datasets as DatasetIntegrity[]).map(dataset => {
                    const privacy = privacyResults[dataset.id];
                    return (
                      <div className="dataset-card" key={dataset.id}>
                        <div>
                          <strong>{dataset.file_name}</strong>
                          <span>{dataset.algorithm}</span>
                          {privacy && (
                            <small>
                              {privacy.privacy_status}
                              {(privacy.columns && privacy.columns.length > 0) ? ` · ${privacy.columns.length} sensitive ${privacy.columns.length === 1 ? 'column' : 'columns'}` : ''}
                            </small>
                          )}
                        </div>
                        <div>
                          <span className="signal-chip">
                            {dataset.integrity_status === 'VERIFIED' ? 'Integrity Verified' : dataset.integrity_status === 'FAILED' ? 'Integrity Check Failed' : 'Integrity Check Not Available'}
                          </span>
                          <button className="button ghost" type="button" disabled={privacyBusy === dataset.id} onClick={() => scanPrivacy(dataset.id)}>
                            {privacyBusy === dataset.id ? 'Scanning...' : privacy ? 'Rescan privacy' : 'Scan privacy'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  </div>;
}
