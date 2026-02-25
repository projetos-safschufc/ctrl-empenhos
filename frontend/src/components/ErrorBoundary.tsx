import React from 'react';

interface State {
  hasError: boolean;
  error: Error | null;
}

/** Fallback em HTML puro para não depender de Chakra (evita tela branca se o erro for no theme/provider). */
function FallbackUI({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: 'sans-serif',
        background: '#F5F0E6',
      }}
    >
      <div style={{ maxWidth: 400, textAlign: 'center' }}>
        <h1 style={{ color: '#c53030', marginBottom: 8 }}>Algo deu errado</h1>
        <p style={{ color: '#4a5568', fontSize: 14, marginBottom: 16 }}>{error.message}</p>
        <button
          type="button"
          onClick={onRetry}
          style={{
            padding: '8px 16px',
            background: '#145D50',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <FallbackUI
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      );
    }
    return this.props.children;
  }
}
