import React, { ChangeEvent, FormEvent, useState, useEffect, useRef } from 'react';
import axios, { AxiosProgressEvent } from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from './auth';
import { UploadProgressBar, UploadProgressState } from './UploadProgressBar';

const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
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

interface ValidationErrorItem {
  filename: string;
  reason: string;
}

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragCounterRef = useRef<number>(0);

  const [files, setFiles] = useState<File[]>([]);
  const [inspected, setInspected] = useState<DatasetInfo[]>([]);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('Upload');
  
  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const [dragReject, setDragReject] = useState(false);

  // Validation feedback state
  const [validationErrors, setValidationErrors] = useState<ValidationErrorItem[]>([]);
  const [validationNotice, setValidationNotice] = useState<string | null>(null);
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);

  // Privacy & Undo state
  const [privacyResults, setPrivacyResults] = useState<Record<string, PrivacyResult>>({});
  const [privacyBusy, setPrivacyBusy] = useState<number | null>(null);
  const [undoStatus, setUndoStatus] = useState<UndoStatus | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [isUndoing, setIsUndoing] = useState(false);
  const [undoMessage, setUndoMessage] = useState<string>('');
  const [showUndoModal, setShowUndoModal] = useState(false);

  // Real-time Upload Progress Stream State
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState>({
    loaded: 0,
    total: 0,
    percentage: 0,
    bytesPerSecond: 0,
    estimatedSecondsRemaining: null,
    status: 'idle',
  });
  const uploadAbortControllerRef = useRef<AbortController | null>(null);
  const uploadStartTimeRef = useRef<number>(0);
  const lastLoadedBytesRef = useRef<number>(0);
  const lastProgressTimeRef = useRef<number>(0);

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
      setValidationErrors([]);
      setValidationNotice(null);
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

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Comprehensive File Validator
  const handleSelectedFiles = (selectedFiles: File[]) => {
    if (!selectedFiles.length) return;

    const newErrors: ValidationErrorItem[] = [];
    const validToAdd: File[] = [];
    let dupesCount = 0;

    selectedFiles.forEach(file => {
      const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();

      // 1. Check extension
      if (!ALLOWED_EXTENSIONS.has(extension)) {
        newErrors.push({
          filename: file.name,
          reason: `Invalid format (${extension || 'unknown'}). Only .csv, .xlsx, and .xls files are supported.`
        });
        return;
      }

      // 2. Check maximum size (50MB)
      if (file.size > MAX_UPLOAD_SIZE_BYTES) {
        newErrors.push({
          filename: file.name,
          reason: `File size exceeds the 50 MB ceiling (${formatFileSize(file.size)}).`
        });
        return;
      }

      // 3. Check for empty file
      if (file.size === 0) {
        newErrors.push({
          filename: file.name,
          reason: `File contains 0 bytes (empty document).`
        });
        return;
      }

      // 4. Check for duplicates in currently staged files
      const isDuplicate = files.some(
        existing => existing.name === file.name && existing.size === file.size
      );
      if (isDuplicate) {
        dupesCount++;
        return;
      }

      // Valid file passed all criteria
      validToAdd.push(file);
    });

    setValidationErrors(newErrors);

    if (dupesCount > 0) {
      setDuplicateNotice(`${dupesCount} duplicate ${dupesCount === 1 ? 'file was' : 'files were'} skipped.`);
    } else {
      setDuplicateNotice(null);
    }

    if (validToAdd.length > 0) {
      setFiles(prev => [...prev, ...validToAdd]);
      const totalSize = validToAdd.reduce((acc, f) => acc + f.size, 0);
      setValidationNotice(
        `✓ ${validToAdd.length} ${validToAdd.length === 1 ? 'file' : 'files'} (${formatFileSize(totalSize)}) verified and staged for ML pipeline.`
      );
      // Reset any previous high-level result errors
      if (result?.error) {
        setResult(null);
      }
    } else if (newErrors.length > 0 && files.length === 0) {
      setValidationNotice(null);
    }
  };

  const handleNativeFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    handleSelectedFiles(selected);
    event.target.value = '';
  };

  // Drag and Drop Events
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    setIsDragging(true);

    // Inspect drag items if available
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      let hasSupported = false;
      let hasUnsupported = false;
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];
        if (item.kind === 'file') {
          const type = (item.type || '').toLowerCase();
          // Check known mime types or fallback
          if (
            type.includes('csv') ||
            type.includes('spreadsheet') ||
            type.includes('excel') ||
            type.includes('vnd.ms-excel') ||
            type.includes('octet-stream') ||
            type === ''
          ) {
            hasSupported = true;
          } else {
            hasUnsupported = true;
          }
        }
      }
      setDragReject(hasUnsupported && !hasSupported);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDragging) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
      setDragReject(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);
    setDragReject(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleSelectedFiles(Array.from(e.dataTransfer.files));
    }
  };

  const triggerFileBrowser = () => {
    fileInputRef.current?.click();
  };

  const handleKeyDownDropZone = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      triggerFileBrowser();
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

  const loadSampleDatasetDirectly = () => {
    const csvContent = [
      'project_id,project_name,project_code,state,district,constituency,category,agency,sanction_amount,expenditure,expected_completion_date,actual_completion_date,status',
      'KA-BLR-001,Construction of Community Health Center,MPLADS-2024-001,Karnataka,Bengaluru Urban,Bengaluru Central,Health,PWD,2500000,2450000,2024-03-31,2024-04-15,Completed',
      'KA-BLR-002,Installation of Solar LED Street Lights,MPLADS-2024-002,Karnataka,Bengaluru Urban,Bengaluru Central,Community Infrastructure,Rural Development,1200000,1180000,2024-02-28,2024-03-10,Completed',
      'KA-BLR-003,Upgradation of Government Higher Primary School,MPLADS-2024-003,Karnataka,Bengaluru Urban,Bengaluru Central,Education,PWD,1800000,1950000,2023-12-31,2024-05-20,Delayed',
      'KA-BLR-004,Drinking Water Supply Pipeline Network,MPLADS-2024-004,Karnataka,Bengaluru Urban,Bengaluru Central,Water Supply,Water Resources,3500000,1200000,2024-08-31,,In Progress',
      'KA-BLR-005,Construction of Asphalt Road in Ward 12,MPLADS-2024-005,Karnataka,Bengaluru Urban,Bengaluru Central,Roads,PWD,1500000,1500000,2024-01-15,2024-02-15,Completed'
    ].join('\n');
    const sampleFile = new File([csvContent], 'mplads_sample_register.csv', { type: 'text/csv' });
    handleSelectedFiles([sampleFile]);
  };

  const removeFile = (name: string) => {
    setFiles(previous => (Array.isArray(previous) ? previous.filter(file => file.name !== name) : []));
    setInspected(previous => (Array.isArray(previous) ? previous.filter(file => file.filename !== name) : []));
  };

  const clearAllFiles = () => {
    if (uploadAbortControllerRef.current) {
      uploadAbortControllerRef.current.abort();
      uploadAbortControllerRef.current = null;
    }
    setFiles([]);
    setInspected([]);
    setValidationErrors([]);
    setValidationNotice(null);
    setDuplicateNotice(null);
    setResult(null);
    setStage('Upload');
    setUploadProgress({
      loaded: 0,
      total: 0,
      percentage: 0,
      bytesPerSecond: 0,
      estimatedSecondsRemaining: null,
      status: 'idle',
    });
  };

  const cancelUpload = () => {
    if (uploadAbortControllerRef.current) {
      uploadAbortControllerRef.current.abort();
      uploadAbortControllerRef.current = null;
    }
    setBusy(false);
    setUploadProgress(prev => ({
      ...prev,
      status: 'error',
      errorMessage: 'Upload aborted by user.',
    }));
  };

  const handleUploadProgressEvent = (progressEvent: AxiosProgressEvent, operationName: string) => {
    const loaded = progressEvent.loaded || 0;
    const total = progressEvent.total || (files.reduce((acc, f) => acc + f.size, 0) || loaded || 1);
    const now = Date.now();
    const elapsedSecondsTotal = Math.max((now - uploadStartTimeRef.current) / 1000, 0.05);

    // Calculate instantaneous speed using smoothed moving average
    const timeDelta = (now - lastProgressTimeRef.current) / 1000;
    const bytesDelta = loaded - lastLoadedBytesRef.current;

    let currentSpeed = 0;
    if (timeDelta > 0.08 && bytesDelta >= 0) {
      const instantSpeed = bytesDelta / timeDelta;
      const averageSpeed = loaded / elapsedSecondsTotal;
      // Exponential smoothing (weighted towards recent chunks)
      currentSpeed = instantSpeed * 0.7 + averageSpeed * 0.3;
      lastLoadedBytesRef.current = loaded;
      lastProgressTimeRef.current = now;
    } else {
      currentSpeed = loaded / elapsedSecondsTotal;
    }

    const remainingBytes = Math.max(0, total - loaded);
    const estimatedSecondsRemaining = currentSpeed > 0 ? remainingBytes / currentSpeed : null;
    const percentage = Math.min(99, Math.max(1, (loaded / total) * 100));

    setUploadProgress(prev => ({
      ...prev,
      loaded,
      total,
      percentage,
      bytesPerSecond: currentSpeed,
      estimatedSecondsRemaining,
      status: percentage >= 99 ? 'processing' : 'uploading',
      stageName: percentage >= 99 ? `Server verifying & parsing ${operationName}...` : undefined,
    }));
  };

  const inspect = async () => {
    if (!files.length) return;
    setBusy(true);
    setStage('Detect');

    const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
    const controller = new AbortController();
    uploadAbortControllerRef.current = controller;
    uploadStartTimeRef.current = Date.now();
    lastLoadedBytesRef.current = 0;
    lastProgressTimeRef.current = Date.now();

    setUploadProgress({
      loaded: 0,
      total: totalBytes,
      percentage: 0,
      bytesPerSecond: 0,
      estimatedSecondsRemaining: null,
      status: 'uploading',
      currentFileName: files.length === 1 ? files[0].name : `${files.length} register files`,
      totalFiles: files.length,
      stageName: 'Inspecting schema & mapping...',
    });

    const form = new FormData();
    files.forEach(file => form.append('files', file));
    try {
      const response = await axios.post(`${API_BASE}/api/inspect-datasets`, form, {
        signal: controller.signal,
        onUploadProgress: (progressEvent: AxiosProgressEvent) => {
          handleUploadProgressEvent(progressEvent, 'datasets');
        },
      });

      setUploadProgress(prev => ({
        ...prev,
        loaded: totalBytes,
        total: totalBytes,
        percentage: 100,
        bytesPerSecond: 0,
        estimatedSecondsRemaining: 0,
        status: 'completed',
      }));

      setInspected(Array.isArray(response.data?.files) ? response.data.files : []);
      setStage('Map');
    } catch (error: any) {
      if (axios.isCancel(error) || error?.name === 'CanceledError') {
        // Handled in cancelUpload
        return;
      }
      setInspected([]);
      const errMsg = error.response?.data?.detail || error.message || 'Dataset inspection failed';
      setResult({ error: errMsg });
      setUploadProgress(prev => ({
        ...prev,
        status: 'error',
        errorMessage: errMsg,
      }));
      setStage('Results');
    } finally {
      setBusy(false);
      uploadAbortControllerRef.current = null;
    }
  };

  const analyze = async (event?: FormEvent | React.MouseEvent) => {
    if (event && 'preventDefault' in event) {
      event.preventDefault();
    }
    if (!files.length) return;
    setBusy(true);
    setStage('Integrate');

    const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
    const controller = new AbortController();
    uploadAbortControllerRef.current = controller;
    uploadStartTimeRef.current = Date.now();
    lastLoadedBytesRef.current = 0;
    lastProgressTimeRef.current = Date.now();

    setUploadProgress({
      loaded: 0,
      total: totalBytes,
      percentage: 0,
      bytesPerSecond: 0,
      estimatedSecondsRemaining: null,
      status: 'uploading',
      currentFileName: files.length === 1 ? files[0].name : `${files.length} registers`,
      totalFiles: files.length,
      stageName: 'Streaming multipart datasets...',
    });

    const form = new FormData();
    files.forEach(file => form.append('files', file));
    setStage('Validate');
    setStage('Analyze');
    try {
      const response = await axios.post(`${API_BASE}/api/analyze-multi`, form, {
        timeout: 0,
        signal: controller.signal,
        onUploadProgress: (progressEvent: AxiosProgressEvent) => {
          handleUploadProgressEvent(progressEvent, 'Isolation Forest ML analysis');
        },
      });

      setUploadProgress(prev => ({
        ...prev,
        loaded: totalBytes,
        total: totalBytes,
        percentage: 100,
        bytesPerSecond: 0,
        estimatedSecondsRemaining: 0,
        status: 'completed',
      }));

      setResult(response.data);
      setStage('Results');
      const analysisRunId = response.data.analysis_run_id;
      if (analysisRunId) {
        navigate(`/?run_id=${encodeURIComponent(String(analysisRunId))}`, { replace: true });
      }
    } catch (error: any) {
      if (axios.isCancel(error) || error?.name === 'CanceledError') {
        return;
      }
      const detail = error.response?.data?.detail;
      const errMsg = typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : error.message || 'Analysis failed';
      setResult({ error: errMsg });
      setUploadProgress(prev => ({
        ...prev,
        status: 'error',
        errorMessage: errMsg,
      }));
      setStage('Results');
    } finally {
      setBusy(false);
      uploadAbortControllerRef.current = null;
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

  const totalStagedSize = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="page-stack">
      {/* Header */}
      <div className="page-heading simple">
        <div>
          <div className="eyebrow" style={{ color: '#0f766e', fontWeight: 700, letterSpacing: '0.06em' }}>
            CIVIC AUDIT DATA INGESTION · SIH 2026
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: '4px 0 6px' }}>
            Upload Project Registers & Datasets
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: '#475569' }}>
            Ingest tabular audit records (.csv, .xlsx, .xls) for multi-source reconciliation, anomaly detection, and Isolation Forest analysis.
          </p>
        </div>
      </div>

      {/* Undo Message Toast */}
      {undoMessage && (
        <div
          className="notice"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#ecfdf5',
            borderColor: '#a7f3d0',
            padding: '12px 16px',
            borderRadius: 8,
          }}
        >
          <span style={{ color: '#065f46', fontWeight: 600, fontSize: 13 }}>✓ {undoMessage}</span>
          <button
            type="button"
            onClick={() => setUndoMessage('')}
            style={{ background: 'transparent', border: 0, cursor: 'pointer', fontSize: 18, color: '#065f46' }}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      {/* ACTIVE DATASET UNDO GRACE PERIOD PANEL */}
      {undoStatus?.has_undoable_dataset && (
        <section
          className="panel"
          style={{
            background: '#f8fafc',
            border: '1.5px solid #93c5fd',
            borderRadius: 8,
            padding: '16px 20px',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#1d4ed8',
                  background: '#dbeafe',
                  padding: '3px 8px',
                  borderRadius: 4,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
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
                style={{
                  background: '#ffffff',
                  color: '#b91c1c',
                  borderColor: '#fca5a5',
                  fontWeight: 700,
                  padding: '8px 14px',
                  cursor: 'pointer',
                }}
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

      {/* Undo Confirmation Modal */}
      {showUndoModal && undoStatus && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 9999 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="multiupload-undo-title"
          onClick={e => {
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

      {/* Main Upload Workspace Panel */}
      <section className="panel upload-panel" style={{ padding: '24px 28px', background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
        {/* Pipeline Stage Breadcrumbs */}
        <div className="stage-line">
          {stages.map((item, index) => (
            <div className={`stage ${stages.indexOf(stage) >= index ? 'complete' : ''}`} key={item}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              {item}
            </div>
          ))}
        </div>

        <div className="upload-workspace">
          <div>
            <div className="upload-form">
              {/* ACCESSIBLE HEADLESS FILE INPUT */}
              <input
                ref={fileInputRef}
                id="multi-file-picker"
                type="file"
                multiple
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleNativeFileInput}
                style={{ display: 'none' }}
                aria-hidden="true"
              />

              {/* ENHANCED INTERACTIVE DRAG & DROP ZONE */}
              <div
                className={`drop-zone ${isDragging ? (dragReject ? 'drag-reject' : 'drag-over') : ''}`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={triggerFileBrowser}
                onKeyDown={handleKeyDownDropZone}
                tabIndex={0}
                role="button"
                aria-label="Upload files drop zone. Click or drag and drop CSV or Excel files here"
              >
                {/* Upload Visual Indicator */}
                <div
                  className="upload-symbol"
                  style={{
                    background: isDragging
                      ? dragReject
                        ? '#fee2e2'
                        : '#dbeafe'
                      : '#e6f4f1',
                    color: isDragging
                      ? dragReject
                        ? '#dc2626'
                        : '#0284c7'
                      : '#0f766e',
                  }}
                >
                  {isDragging ? (
                    dragReject ? (
                      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : (
                      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    )
                  ) : (
                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  )}
                </div>

                {/* Primary Drag Status Heading */}
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: '4px 0 6px', color: '#0f172a' }}>
                  {isDragging ? (
                    dragReject ? (
                      <span style={{ color: '#dc2626' }}>Unsupported file type detected!</span>
                    ) : (
                      <span style={{ color: '#0284c7' }}>Release to drop and stage files for audit</span>
                    )
                  ) : (
                    'Drag & drop project registers here'
                  )}
                </h2>

                <p style={{ margin: '0 0 14px', fontSize: 13, color: '#64748b', maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}>
                  {isDragging
                    ? 'Only CSV (.csv) and Microsoft Excel (.xlsx, .xls) files will be ingested.'
                    : 'Click anywhere to browse from your device, or drag tabular data files into this drop area.'}
                </p>

                {/* VISUAL FEEDBACK FOR ACCEPTED FILE TYPES */}
                <div className="format-badges-row" onClick={e => e.stopPropagation()}>
                  <div className="format-pill csv" title="Comma-Separated Values (RFC 4180 / UTF-8)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span>.CSV</span>
                    <span style={{ fontSize: 10, background: '#dcfce7', padding: '1px 5px', borderRadius: 4, color: '#15803d' }}>
                      Accepted
                    </span>
                  </div>

                  <div className="format-pill xlsx" title="Microsoft Excel OpenXML Spreadsheet">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="8" y1="13" x2="16" y2="13" />
                      <line x1="8" y1="17" x2="16" y2="17" />
                    </svg>
                    <span>.XLSX</span>
                    <span style={{ fontSize: 10, background: '#d1fae5', padding: '1px 5px', borderRadius: 4, color: '#047857' }}>
                      Accepted
                    </span>
                  </div>

                  <div className="format-pill xls" title="Microsoft Excel 97-2004 Legacy Spreadsheet">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span>.XLS</span>
                    <span style={{ fontSize: 10, background: '#e0f2fe', padding: '1px 5px', borderRadius: 4, color: '#0369a1' }}>
                      Accepted
                    </span>
                  </div>

                  <div
                    className="format-pill rejected"
                    title="PDF, Word, zip, and image documents are rejected automatically by pre-flight validation"
                  >
                    <span style={{ color: '#ef4444' }}>✕</span>
                    <span style={{ color: '#991b1b', fontSize: 10 }}>PDF / ZIP / DOCX Rejected</span>
                  </div>
                </div>

                {/* Constraint Specification Notice */}
                <div style={{ marginTop: 12, fontSize: 11, color: '#94a3b8' }}>
                  Maximum file size: <strong>50 MB per file</strong> · Multi-file batching supported · Schemas auto-mapped
                </div>

                {/* ACTION BUTTONS ROW */}
                <div
                  style={{
                    display: 'flex',
                    gap: 10,
                    marginTop: 18,
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="button primary"
                    onClick={triggerFileBrowser}
                    style={{
                      padding: '8px 18px',
                      fontSize: 13,
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: '#0f766e',
                      borderColor: '#0f766e',
                      color: '#ffffff',
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                  >
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Browse Files
                  </button>

                  <button
                    type="button"
                    className="button secondary"
                    onClick={loadSampleDatasetDirectly}
                    title="Instant 1-click test with official 6-project MPLADS register"
                    style={{
                      padding: '8px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      background: '#ffffff',
                      borderColor: '#cbd5e1',
                      color: '#0f172a',
                      borderRadius: 6,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>⚡</span>
                    Load Sample Register
                  </button>

                  <button
                    type="button"
                    className="button ghost"
                    onClick={downloadSampleDataset}
                    title="Download canonical MPLADS CSV register with sample records"
                    style={{
                      padding: '8px 14px',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#64748b',
                      borderRadius: 6,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Template
                  </button>
                </div>
              </div>

              {/* LIVE VALIDATION STATE FEEDBACK ALERTS */}
              {validationErrors.length > 0 && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1.5px solid #fecaca',
                    borderRadius: 8,
                    padding: '14px 18px',
                    marginTop: 14,
                  }}
                  role="alert"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18, color: '#dc2626' }}>⚠️</span>
                      <strong style={{ fontSize: 13, color: '#991b1b' }}>
                        Validation Error ({validationErrors.length} {validationErrors.length === 1 ? 'file rejected' : 'files rejected'})
                      </strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => setValidationErrors([])}
                      style={{ background: 'transparent', border: 0, color: '#991b1b', cursor: 'pointer', fontSize: 16 }}
                      title="Dismiss error notice"
                    >
                      ×
                    </button>
                  </div>

                  <ul style={{ margin: 0, paddingLeft: 22, fontSize: 12, color: '#b91c1c', lineHeight: 1.6 }}>
                    {validationErrors.map((err, idx) => (
                      <li key={idx}>
                        <strong>{err.filename}</strong>: {err.reason}
                      </li>
                    ))}
                  </ul>
                  <div style={{ marginTop: 8, fontSize: 11, color: '#7f1d1d' }}>
                    Please convert the document to <code>.csv</code> or <code>.xlsx</code> format, ensure file size is under 50 MB, and re-upload.
                  </div>
                </div>
              )}

              {/* Validation Success Notification */}
              {validationNotice && (
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1.5px solid #bbf7d0',
                    borderRadius: 8,
                    padding: '12px 16px',
                    marginTop: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#166534', fontWeight: 600 }}>
                    <span style={{ fontSize: 16 }}>✓</span>
                    <span>{validationNotice}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setValidationNotice(null)}
                    style={{ background: 'transparent', border: 0, color: '#166534', cursor: 'pointer', fontSize: 16 }}
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Duplicate Notice */}
              {duplicateNotice && (
                <div
                  style={{
                    background: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    borderRadius: 8,
                    padding: '10px 14px',
                    marginTop: 10,
                    fontSize: 12,
                    color: '#0369a1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>ℹ️ {duplicateNotice}</span>
                  <button
                    type="button"
                    onClick={() => setDuplicateNotice(null)}
                    style={{ background: 'transparent', border: 0, color: '#0369a1', cursor: 'pointer' }}
                  >
                    ×
                  </button>
                </div>
              )}

              {/* REAL-TIME UPLOAD PROGRESS BAR COMPONENT */}
              <UploadProgressBar
                progress={uploadProgress}
                onCancel={cancelUpload}
                onRetry={() => {
                  if (stage === 'Detect') {
                    inspect();
                  } else {
                    analyze();
                  }
                }}
              />

              {/* PIPELINE CONTROLS SIDE PANEL */}
              <div className="upload-side" style={{ marginTop: 16, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="eyebrow" style={{ color: '#64748b', fontSize: 11, fontWeight: 700 }}>
                    PIPELINE VALIDATION & EXECUTION
                  </div>
                  {files.length > 0 && (
                    <button
                      type="button"
                      onClick={clearAllFiles}
                      style={{
                        background: 'transparent',
                        border: 0,
                        color: '#ef4444',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '2px 6px',
                      }}
                    >
                      Clear all files
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
                  <strong style={{ fontSize: 16, color: '#0f172a' }}>
                    {busy ? `${stage}...` : stage} Stage
                  </strong>
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                    {files.length} {files.length === 1 ? 'file' : 'files'} ({formatFileSize(totalStagedSize)})
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                  <button
                    className="button secondary"
                    type="button"
                    disabled={!files.length || busy}
                    onClick={inspect}
                    style={{
                      padding: '10px 14px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: !files.length || busy ? 'not-allowed' : 'pointer',
                      borderRadius: 6,
                    }}
                  >
                    {busy && stage === 'Detect' ? 'Inspecting...' : '1. Check Schema'}
                  </button>

                  <button
                    className="button primary"
                    type="button"
                    disabled={!files.length || busy}
                    onClick={analyze}
                    style={{
                      padding: '10px 14px',
                      fontSize: 13,
                      fontWeight: 700,
                      background: !files.length || busy ? '#94a3b8' : '#0f766e',
                      borderColor: !files.length || busy ? '#94a3b8' : '#0f766e',
                      color: '#ffffff',
                      cursor: !files.length || busy ? 'not-allowed' : 'pointer',
                      borderRadius: 6,
                    }}
                  >
                    {busy && stage === 'Analyze' ? 'Analyzing...' : '2. Run Isolation Forest'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* AUDIT KNOWLEDGE & CANONICAL SPECIFICATION */}
          <aside className="knowledge-context" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 22 }}>
            <div className="eyebrow" style={{ color: '#0f766e', fontWeight: 700, fontSize: 11 }}>
              AUDIT DATA SPECIFICATION
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '6px 0 10px', color: '#0f172a' }}>
              Canonical Register Schema
            </h2>
            <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.6, margin: '0 0 12px' }}>
              The ingestion engine automatically maps varied column aliases into canonical auditor dimensions: project identifier, work title, sanction ceiling, cumulative expenditure, completion timeline, and implementing agency.
            </p>

            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#334155', margin: '14px 0 6px' }}>
              Validation Guidelines
            </h3>
            <ul style={{ margin: '0 0 16px', paddingLeft: 18, fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
              <li>Unified primary key: maintain consistent <code>project_id</code> across financial registers.</li>
              <li>Currency figures: Sanction & expenditure should be in numeric INR without symbol prefixes.</li>
              <li>Temporal milestones: format dates as standard ISO <code>YYYY-MM-DD</code>.</li>
              <li>Multi-sheet Excel: the system will scan and recommend the relevant work register sheet.</li>
            </ul>

            <div
              className="context-note"
              style={{
                background: '#fefce8',
                borderLeft: '4px solid #ca8a04',
                padding: '12px 14px',
                borderRadius: '0 6px 6px 0',
                fontSize: 11,
                color: '#854d0e',
                lineHeight: 1.5,
              }}
            >
              <strong style={{ display: 'block', marginBottom: 3 }}>Explainable AI Audit Mandate (CAG / CVC)</strong>
              <span>
                Machine learning anomalies detect statistical and procedural variances for vigilant officer review. Model flags serve as investigatory leads rather than definitive judgments.
              </span>
            </div>
          </aside>
        </div>

        {/* STAGED DATASETS WORKSPACE LIST */}
        <div className="dataset-list" style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Staged Files ({files.length})
            </h3>
            {files.length > 0 && (
              <span style={{ fontSize: 12, color: '#64748b' }}>
                Total Payload: <strong>{formatFileSize(totalStagedSize)}</strong>
              </span>
            )}
          </div>

          {files.length ? (
            files.map(file => {
              const info = (inspected || []).find(item => item?.filename === file.name);
              const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');

              return (
                <div
                  className="dataset-card"
                  key={file.name}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 16,
                    padding: '16px 20px',
                    background: '#ffffff',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: 8,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: 1 }}>
                    {/* File Icon */}
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        background: isExcel ? '#ecfdf5' : '#f0fdf4',
                        color: isExcel ? '#059669' : '#16a34a',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                        border: `1px solid ${isExcel ? '#a7f3d0' : '#bbf7d0'}`,
                      }}
                    >
                      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: 14, color: '#0f172a' }}>{file.name}</strong>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: '#f1f5f9',
                            color: '#475569',
                            textTransform: 'uppercase',
                          }}
                        >
                          {isExcel ? 'Excel Workbook' : 'CSV Dataset'}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: '#dcfce7',
                            color: '#166534',
                          }}
                        >
                          ✓ Pre-flight Verified
                        </span>
                      </div>

                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                        Size: {formatFileSize(file.size)} · Type: {file.type || 'text/tabular'}
                      </div>

                      {/* Inspected Metadata */}
                      <div className="dataset-role" style={{ marginTop: 8 }}>
                        {info ? (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#0f766e' }}>
                                Detected Role: {roleLabel[info.detected_role] || info.detected_role || 'Unmapped'}
                              </span>
                              <span style={{ fontSize: 11, color: '#64748b' }}>
                                · {Math.min(100, Math.max(0, Number(info.confidence || 0))).toFixed(0)}% confidence
                              </span>
                              <span style={{ fontSize: 11, color: '#64748b' }}>
                                · {info.selected_sheet || 'sheet pending'}
                              </span>
                            </div>

                            {info.sheets?.length ? (
                              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
                                Sheets: {info.sheets.map(s => `${s.sheet || 'Sheet'}: ${Number(s.rows || 0).toLocaleString('en-IN')} rows`).join(' · ')}
                              </div>
                            ) : null}

                            {info.column_mapping?.length ? (
                              <details style={{ marginTop: 6, fontSize: 12 }}>
                                <summary style={{ cursor: 'pointer', color: '#2563eb', fontWeight: 600 }}>
                                  View Detected Column Mapping ({info.column_mapping.length} columns)
                                </summary>
                                <table className="mapping-table" style={{ width: '100%', marginTop: 8, fontSize: 11 }}>
                                  <thead>
                                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Uploaded Column</th>
                                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Canonical Field</th>
                                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Confidence</th>
                                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(info.column_mapping || []).map(mapping => (
                                      <tr key={`${mapping.uploaded_column}-${mapping.canonical_field}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '6px 8px' }}><code>{mapping.uploaded_column}</code></td>
                                        <td style={{ padding: '6px 8px', fontWeight: 600, color: '#0f766e' }}>{mapping.canonical_field}</td>
                                        <td style={{ padding: '6px 8px' }}>{Math.min(100, Math.max(0, Number(mapping.confidence || 0))).toFixed(0)}%</td>
                                        <td style={{ padding: '6px 8px' }}>
                                          <span style={{ color: mapping.status === 'EXACT' ? '#16a34a' : '#d97706', fontWeight: 600 }}>
                                            {mapping.status}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </details>
                            ) : null}
                          </>
                        ) : (
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>
                            Role and column mappings will be generated when you click "1. Check Schema".
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    className="remove-file"
                    onClick={() => removeFile(file.name)}
                    aria-label={`Remove ${file.name}`}
                    title={`Remove ${file.name}`}
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#dc2626',
                      borderRadius: 6,
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontSize: 16,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })
          ) : (
            <div
              className="empty-state"
              style={{
                border: '1.5px dashed #cbd5e1',
                borderRadius: 8,
                padding: '36px 20px',
                textAlign: 'center',
                background: '#f8fafc',
              }}
            >
              <div
                className="empty-mark"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  background: '#e2e8f0',
                  color: '#64748b',
                  display: 'inline-grid',
                  placeItems: 'center',
                  fontSize: 18,
                  margin: '0 auto 8px',
                }}
              >
                +
              </div>
              <strong style={{ display: 'block', fontSize: 14, color: '#334155', marginBottom: 4 }}>
                No datasets currently staged
              </strong>
              <span style={{ fontSize: 12, color: '#64748b', display: 'block', maxWidth: 460, margin: '0 auto 12px' }}>
                Drag and drop your project work register files (.csv, .xlsx) above, browse from your system, or load the official sample dataset.
              </span>
              <button
                type="button"
                className="button secondary"
                onClick={loadSampleDatasetDirectly}
                style={{ fontSize: 12, padding: '6px 14px', cursor: 'pointer' }}
              >
                ⚡ Load Sample MPLADS Register
              </button>
            </div>
          )}
        </div>

        {/* ANALYSIS RESULTS PANEL */}
        {result && (
          <div
            className="result-panel"
            style={{
              marginTop: 24,
              padding: '20px 24px',
              background: result.error ? '#fef2f2' : '#f0fdf4',
              border: `1.5px solid ${result.error ? '#fecaca' : '#bbf7d0'}`,
              borderRadius: 8,
            }}
          >
            <div>
              <div
                className="eyebrow"
                style={{
                  color: result.error ? '#dc2626' : '#166534',
                  fontWeight: 700,
                  fontSize: 11,
                }}
              >
                FILES {result.error ? 'REQUIRE ATTENTION' : 'PROCESSED & READY'}
              </div>
              <h2 style={{ fontSize: 18, margin: '4px 0 10px', color: '#0f172a' }}>
                {result.error ? 'We could not analyze these files yet' : 'Your analysis pipeline is ready'}
              </h2>
            </div>

            {result.error ? (
              <p style={{ color: '#b91c1c', fontSize: 13, margin: 0 }}>
                {typeof result.error === 'string' ? result.error : JSON.stringify(result.error)}
              </p>
            ) : (
              <>
                <div
                  className="result-stats"
                  style={{
                    display: 'flex',
                    gap: 16,
                    flexWrap: 'wrap',
                    padding: '12px 16px',
                    background: '#ffffff',
                    borderRadius: 6,
                    border: '1px solid #dcfce7',
                    marginBottom: 16,
                  }}
                >
                  <span style={{ fontSize: 13, color: '#334155' }}>
                    <strong style={{ color: '#0f172a' }}>{String(result.files_processed || 0)}</strong> files
                  </span>
                  <span style={{ fontSize: 13, color: '#334155' }}>
                    <strong style={{ color: '#0f172a' }}>{Number(result.rows_processed || 0).toLocaleString('en-IN')}</strong> rows
                  </span>
                  <span style={{ fontSize: 13, color: '#334155' }}>
                    <strong style={{ color: '#0f172a' }}>{Number(result.projects_created || 0).toLocaleString('en-IN')}</strong> projects
                  </span>
                  <span style={{ fontSize: 13, color: '#334155' }}>
                    <strong style={{ color: '#0f172a' }}>{String(result.alerts_created || 0)}</strong> review prompts
                  </span>
                </div>

                {Array.isArray(result.datasets) && (
                  <div className="dataset-list">
                    {(result.datasets as DatasetIntegrity[]).map(dataset => {
                      const privacy = privacyResults[dataset.id];
                      return (
                        <div
                          className="dataset-card"
                          key={dataset.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            background: '#ffffff',
                            borderRadius: 6,
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          <div>
                            <strong style={{ fontSize: 13, color: '#0f172a' }}>{dataset.file_name}</strong>
                            <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>{dataset.algorithm}</span>
                            {privacy && (
                              <div style={{ fontSize: 11, color: privacy.pii_detected ? '#dc2626' : '#166534', marginTop: 2 }}>
                                {privacy.privacy_status}
                                {privacy.columns && privacy.columns.length > 0
                                  ? ` · ${privacy.columns.length} sensitive ${privacy.columns.length === 1 ? 'column' : 'columns'}`
                                  : ''}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: 4,
                                background: dataset.integrity_status === 'VERIFIED' ? '#dcfce7' : '#fee2e2',
                                color: dataset.integrity_status === 'VERIFIED' ? '#166534' : '#dc2626',
                              }}
                            >
                              {dataset.integrity_status === 'VERIFIED'
                                ? 'Integrity Verified'
                                : dataset.integrity_status === 'FAILED'
                                ? 'Integrity Failed'
                                : 'Integrity Pending'}
                            </span>
                            <button
                              className="button ghost"
                              type="button"
                              disabled={privacyBusy === dataset.id}
                              onClick={() => scanPrivacy(dataset.id)}
                              style={{ fontSize: 12, padding: '4px 10px', cursor: 'pointer' }}
                            >
                              {privacyBusy === dataset.id ? 'Scanning...' : privacy ? 'Rescan Privacy' : 'Scan Privacy'}
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
    </div>
  );
}
