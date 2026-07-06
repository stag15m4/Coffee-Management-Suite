import React from 'react';
import { colors } from '@/lib/colors';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Module-loading failures happen when the running app is from an older deploy
// than the chunks on the server (stale index.html on iPad Safari / home-screen
// apps). Re-rendering can't fix those — only a full reload can.
function isStaleChunkError(error: Error | null): boolean {
  if (!error) return false;
  return /Importing binding|Exporting binding|dynamically imported module|import\(\) failed|not a valid JavaScript MIME type|Load failed/i.test(
    error.message
  );
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    // Auto-recover from stale-chunk errors with one reload (guarded against loops)
    if (isStaleChunkError(error)) {
      const lastReload = sessionStorage.getItem('chunk-error-reload');
      if (!lastReload || Date.now() - Number(lastReload) > 30000) {
        sessionStorage.setItem('chunk-error-reload', String(Date.now()));
        window.location.reload();
      }
    }
  }

  handleReset = () => {
    if (isStaleChunkError(this.state.error)) {
      // Re-rendering keeps the broken module graph — reload to get fresh chunks
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            backgroundColor: colors.cream,
            color: colors.brown,
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              marginBottom: '0.75rem',
              color: colors.brown,
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: '1rem',
              color: colors.brownLight,
              marginBottom: '1.5rem',
              maxWidth: '400px',
            }}
          >
            An unexpected error occurred. Please try again.
          </p>
          {this.state.error && (
            <pre
              style={{
                fontSize: '0.75rem',
                color: colors.brownLight,
                marginBottom: '1rem',
                maxWidth: '600px',
                textAlign: 'left',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                padding: '0.75rem',
                backgroundColor: '#f5f5f5',
                borderRadius: '0.375rem',
              }}
            >
              {this.state.error.message}
              {import.meta.env.DEV && (
                <>
                  {'\n'}
                  {this.state.error.stack}
                </>
              )}
            </pre>
          )}
          <button
            onClick={this.handleReset}
            style={{
              padding: '0.625rem 1.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: colors.white,
              backgroundColor: colors.gold,
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
