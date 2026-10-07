import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface DashboardErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onReset?: () => void;
}

interface DashboardErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global Error Boundary specifically engineered for DashboardPage and its API operations.
 * Catches render-time crashes triggered by corrupt/unexpected API responses, network rejections,
 * or component failures, and displays an authoritative, accessible error state with retry actions.
 */
export class DashboardErrorBoundary extends Component<
  DashboardErrorBoundaryProps,
  DashboardErrorBoundaryState
> {
  constructor(props: DashboardErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): DashboardErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[DashboardErrorBoundary] Caught unhandled dashboard API / render error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      return (
        <DashboardApiErrorFallback
          error={this.state.error}
          onRetry={this.handleReset}
          isErrorBoundary
        />
      );
    }

    return this.props.children;
  }
}

export interface DashboardApiErrorFallbackProps {
  error: Error | string;
  onRetry?: () => void;
  isRetrying?: boolean;
  isErrorBoundary?: boolean;
}

/**
 * Polished, user-friendly fallback screen for dashboard API failures.
 * Matches the official SIH 2026 MPLADS Intelligence design system.
 */
export function DashboardApiErrorFallback({
  error,
  onRetry,
  isRetrying = false,
  isErrorBoundary = false,
}: DashboardApiErrorFallbackProps) {
  const [showTechnicalDetails, setShowTechnicalDetails] = React.useState(false);

  const errorMessage = typeof error === 'string' ? error : error?.message || 'An unknown network error occurred';
  const errorStack = typeof error !== 'string' ? error?.stack : undefined;

  return (
    <div className="page-stack" role="alert" aria-live="assertive">
      {/* Top Breadcrumb / Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626' }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#dc2626' }} />
          API CONNECTIVITY INTERRUPTION · DASHBOARD WORKSPACE
        </div>
        <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono, monospace)' }}>
          STATUS: HTTP_REQ_FAILED
        </span>
      </div>

      <section
        className="panel"
        style={{
          borderLeft: '4px solid #ef4444',
          background: '#ffffff',
          boxShadow: '0 4px 18px rgba(0, 0, 0, 0.05)',
          padding: '28px 24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
          {/* Visual Alert Icon Badge */}
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              flexShrink: 0,
            }}
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>

          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 20, color: '#111827', margin: '0 0 6px', fontWeight: 700 }}>
              {isErrorBoundary
                ? 'Dashboard Intelligence Component Crash'
                : 'Unable to Load Dashboard Intelligence'}
            </h2>
            <p style={{ fontSize: 14, color: '#4b5563', lineHeight: 1.5, margin: '0 0 16px' }}>
              We were unable to complete data fetching for the national and state intelligence workspace.
              This typically happens if the backend API service is temporarily unreachable, network connectivity was interrupted, or an analysis run dataset is undergoing re-indexing.
            </p>

            {/* Error Message Pill */}
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 6,
                padding: '10px 14px',
                fontSize: 13,
                color: '#991b1b',
                fontFamily: 'var(--font-mono, monospace)',
                marginBottom: 18,
                wordBreak: 'break-word',
              }}
            >
              <strong>Error Notice:</strong> {errorMessage}
            </div>

            {/* Troubleshooting Checklist */}
            <div
              style={{
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                padding: '14px 16px',
                marginBottom: 20,
              }}
            >
              <strong style={{ fontSize: 12, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 8 }}>
                Suggested Troubleshooting Steps
              </strong>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#4b5563', lineHeight: 1.6 }}>
                <li>Ensure your network connection is active and stable.</li>
                <li>Verify whether an automated dataset upload or integrity scan is currently active.</li>
                <li>Click <strong>Retry Connection</strong> below to re-fetch the dashboard intelligence data.</li>
                <li>If the problem persists, navigate to the <strong>Projects</strong> tab to inspect offline records.</li>
              </ul>
            </div>

            {/* Interactive Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {onRetry && (
                <button
                  type="button"
                  className="button primary"
                  onClick={onRetry}
                  disabled={isRetrying}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 140 }}
                >
                  {isRetrying ? (
                    <>
                      <span
                        style={{
                          display: 'inline-block',
                          width: 14,
                          height: 14,
                          border: '2px solid rgba(255,255,255,0.3)',
                          borderTopColor: '#ffffff',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite',
                        }}
                      />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10" />
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                      </svg>
                      Retry Connection
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                className="button secondary"
                onClick={() => window.location.reload()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 2v6h-6" />
                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                  <path d="M3 22v-6h6" />
                  <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                </svg>
                Reload Window
              </button>

              <Link
                to="/projects"
                className="button secondary"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <span>Browse Projects Register</span>
                <span aria-hidden="true">→</span>
              </Link>

              <Link
                to="/alerts"
                className="button secondary"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <span>View System Alerts</span>
              </Link>
            </div>

            {/* Collapsible Technical Details for Auditors/Engineers */}
            <div style={{ marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#6b7280',
                  fontSize: 12,
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  textDecoration: 'underline',
                }}
              >
                {showTechnicalDetails ? '▼ Hide technical diagnostic stack' : '▶ Show technical diagnostic stack'}
              </button>

              {showTechnicalDetails && (
                <div
                  style={{
                    marginTop: 10,
                    padding: 12,
                    background: '#111827',
                    color: '#e5e7eb',
                    borderRadius: 6,
                    fontSize: 11,
                    fontFamily: 'var(--font-mono, monospace)',
                    overflowX: 'auto',
                    maxHeight: 180,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  <div><strong>Diagnostic Target:</strong> /api/dashboard</div>
                  <div><strong>Error String:</strong> {errorMessage}</div>
                  {errorStack && <div><strong>Stack Trace:</strong>{'\n'}{errorStack}</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
