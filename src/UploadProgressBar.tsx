import React from 'react';

export interface UploadProgressState {
  loaded: number;
  total: number;
  percentage: number;
  bytesPerSecond: number;
  estimatedSecondsRemaining: number | null;
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
  currentFileName?: string;
  totalFiles?: number;
  stageName?: string;
  errorMessage?: string;
}

interface UploadProgressBarProps {
  progress: UploadProgressState;
  onCancel?: () => void;
  onRetry?: () => void;
}

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const formatSpeed = (bytesPerSec: number): string => {
  if (bytesPerSec <= 0) return '0 KB/s';
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`;
};

export const formatTimeRemaining = (seconds: number | null): string => {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return 'Calculating...';
  }
  if (seconds < 1) {
    return '< 1 sec';
  }
  if (seconds < 60) {
    return `${Math.ceil(seconds)}s remaining`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `${mins}m ${secs}s remaining`;
};

export const UploadProgressBar: React.FC<UploadProgressBarProps> = ({
  progress,
  onCancel,
  onRetry,
}) => {
  if (progress.status === 'idle') {
    return null;
  }

  const isUploading = progress.status === 'uploading';
  const isProcessing = progress.status === 'processing';
  const isCompleted = progress.status === 'completed';
  const isError = progress.status === 'error';

  // Dynamic bar styling according to status
  const barColor = isError
    ? '#ef4444'
    : isCompleted
    ? '#10b981'
    : isProcessing
    ? '#0f766e'
    : '#0284c7';

  const badgeBackground = isError
    ? '#fee2e2'
    : isCompleted
    ? '#d1fae5'
    : isProcessing
    ? '#ccfbf1'
    : '#e0f2fe';

  const badgeColor = isError
    ? '#991b1b'
    : isCompleted
    ? '#065f46'
    : isProcessing
    ? '#0f766e'
    : '#0369a1';

  return (
    <div
      className="upload-progress-container"
      role="region"
      aria-label="Upload Progress"
      style={{
        marginTop: 18,
        background: '#ffffff',
        border: `1.5px solid ${isError ? '#fecaca' : isCompleted ? '#a7f3d0' : '#bae6fd'}`,
        borderRadius: 10,
        padding: '16px 20px',
        boxShadow: '0 4px 12px -2px rgba(15, 23, 42, 0.05)',
        transition: 'all 0.25s ease',
      }}
    >
      {/* Header Row: Status badge, title, and action controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: badgeBackground,
              color: badgeColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            {isError ? (
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : isCompleted ? (
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : isProcessing ? (
              <svg
                width="18"
                height="18"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                className="animate-spin"
                style={{ animation: 'spin 1.5s linear infinite' }}
              >
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeDasharray="32" strokeLinecap="round" opacity="0.3" />
                <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            )}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: badgeBackground,
                  color: badgeColor,
                }}
              >
                {isError
                  ? 'Stream Interrupted'
                  : isCompleted
                  ? 'Ingestion Complete'
                  : isProcessing
                  ? 'ML Pipeline Active'
                  : 'Streaming Multipart Buffer'}
              </span>

              {progress.totalFiles && progress.totalFiles > 1 && (
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                  Batch of {progress.totalFiles} datasets
                </span>
              )}
            </div>

            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 2 }}>
              {isError
                ? (progress.errorMessage || 'Upload failed during transfer')
                : isCompleted
                ? 'Dataset streamed and ingested into audit memory'
                : isProcessing
                ? (progress.stageName || 'Executing Isolation Forest anomaly model...')
                : `Uploading ${progress.currentFileName || 'project registers'}`}
            </div>
          </div>
        </div>

        {/* Right action control: Cancel or Retry */}
        <div>
          {isUploading && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#64748b',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                padding: '4px 10px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
              title="Abort in-flight upload"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              Cancel Transfer
            </button>
          )}

          {isError && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#ffffff',
                background: '#dc2626',
                border: '1px solid #b91c1c',
                borderRadius: 6,
                padding: '4px 10px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M23 4v6h-6"></path>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
              Retry Upload
            </button>
          )}
        </div>
      </div>

      {/* Progress Track & Animated Bar */}
      <div
        className="upload-progress-track"
        style={{
          width: '100%',
          height: 10,
          background: '#f1f5f9',
          borderRadius: 6,
          overflow: 'hidden',
          position: 'relative',
        }}
        role="progressbar"
        aria-valuenow={progress.percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Upload progress bar"
      >
        <div
          className="upload-progress-fill"
          style={{
            width: `${Math.min(100, Math.max(0, progress.percentage))}%`,
            height: '100%',
            backgroundColor: barColor,
            backgroundImage: isUploading
              ? 'linear-gradient(45deg, rgba(255, 255, 255, 0.2) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, 0.2) 50%, rgba(255, 255, 255, 0.2) 75%, transparent 75%, transparent)'
              : undefined,
            backgroundSize: '24px 24px',
            animation: isUploading ? 'progressStripes 1s linear infinite' : undefined,
            borderRadius: 6,
            transition: 'width 0.2s ease-out, background-color 0.3s ease',
          }}
        />
      </div>

      {/* Bottom Telemetry Metrics: Transferred, Percent, Speed, and Estimated Time Remaining */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 8,
          fontSize: 12,
          color: '#475569',
          flexWrap: 'wrap',
          gap: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Transferred / Total bytes */}
          <span>
            <strong style={{ color: '#0f172a', fontWeight: 600 }}>
              {formatBytes(progress.loaded)}
            </strong>
            {' '}/ {formatBytes(progress.total)}
          </span>

          {/* Transfer Rate / Speed */}
          {isUploading && progress.bytesPerSecond > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                color: '#0284c7',
                fontWeight: 600,
                background: '#f0f9ff',
                padding: '1px 6px',
                borderRadius: 4,
                fontSize: 11,
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polyline>
              </svg>
              {formatSpeed(progress.bytesPerSecond)}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Real-time Estimated Time Remaining */}
          {isUploading && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                color: '#475569',
                fontFamily: 'monospace',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              {formatTimeRemaining(progress.estimatedSecondsRemaining)}
            </span>
          )}

          {isProcessing && (
            <span style={{ color: '#0f766e', fontWeight: 600, fontSize: 11 }}>
              Server processing payload...
            </span>
          )}

          {/* Percentage */}
          <span
            style={{
              fontWeight: 700,
              color: isError ? '#dc2626' : isCompleted ? '#059669' : '#0f172a',
              minWidth: 42,
              textAlign: 'right',
            }}
          >
            {Math.round(progress.percentage)}%
          </span>
        </div>
      </div>
    </div>
  );
};
