import React from 'react';
import { colors } from '@/lib/colors';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
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
  }

  handleReset = () => {
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
