import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Guardian Portal Runtime Error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#06101e',
          color: '#34d399',
          padding: '2rem',
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            maxWidth: '750px',
            width: '100%',
            backgroundColor: '#0f172a',
            border: '1px solid #10b981',
            borderRadius: '12px',
            padding: '2rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
          }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34d399', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🛡️ Guardian Portal Application Error
            </h1>
            <p style={{ color: '#e2e8f0', marginBottom: '1rem', fontSize: '1rem', lineHeight: '1.5' }}>
              {this.state.error?.message || 'An unexpected rendering error occurred in this view.'}
            </p>
            {this.state.error?.stack && (
              <pre style={{
                backgroundColor: '#06101e',
                padding: '1rem',
                borderRadius: '6px',
                overflowX: 'auto',
                fontSize: '0.8rem',
                color: '#94a3b8',
                maxHeight: '260px'
              }}>
                {this.state.error.stack}
              </pre>
            )}
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => {
                  localStorage.removeItem('gb_map_engine');
                  window.location.reload();
                }}
                style={{
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.6rem 1.25rem',
                  borderRadius: '6px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Reset Map &amp; Reload
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  backgroundColor: '#334155',
                  color: '#f1f5f9',
                  border: 'none',
                  padding: '0.6rem 1.25rem',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Simple Reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

