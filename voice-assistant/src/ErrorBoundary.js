import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-main, #0f0f1a)',
          color: 'var(--text-main, #fff)',
          fontFamily: 'Inter, sans-serif',
          gap: '24px',
          padding: '40px',
          textAlign: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Echo AI</h2>
          <h1 style={{ fontSize: '2rem', margin: 0 }}>Something went wrong</h1>
          <p style={{ color: 'var(--text-muted, #888)', maxWidth: 480 }}>
            An unexpected error occurred. Don't worry — your chat history is safe in your browser.
          </p>
          <code style={{
            background: 'rgba(255,100,100,0.1)',
            border: '1px solid rgba(255,100,100,0.3)',
            borderRadius: 8,
            padding: '12px 20px',
            fontSize: '0.85rem',
            color: '#ff6b6b',
            maxWidth: 600,
            wordBreak: 'break-word'
          }}>
            {this.state.error?.message || 'Unknown error'}
          </code>
          <button
            onClick={this.handleReset}
            style={{
              background: 'linear-gradient(135deg, #6c63ff, #8b5cf6)',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '12px 28px',
              fontSize: '1rem',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Return to Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
