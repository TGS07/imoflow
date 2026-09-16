'use client'

import { Component, type ReactNode } from 'react'

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
}

// Error boundary de topo da app. Tem de ser um class component — React 19
// ainda não tem equivalente funcional para getDerivedStateFromError /
// componentDidCatch.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, errorInfo: unknown): void {
    console.error('[ErrorBoundary] erro não tratado na aplicação:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg)',
            padding: 'var(--space-8)',
          }}
        >
          <div className="card" style={{ maxWidth: 420, padding: 'var(--space-8)', textAlign: 'center' }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 9999,
                background: 'var(--gold-glow)',
                border: '1px solid rgba(176,125,46,0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--gold)',
                margin: '0 auto var(--space-4)',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                <path d="M12 9v4M12 17h.01" />
              </svg>
            </div>
            <h1 className="font-display" style={{ fontSize: 'var(--fs-xl)', color: 'var(--text)', marginBottom: 'var(--space-2)' }}>
              Algo correu mal.
            </h1>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', marginBottom: 'var(--space-6)' }}>
              Ocorreu um erro inesperado nesta página. Podes tentar recarregar — se o
              problema persistir, contacta o suporte.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => window.location.reload()}
              style={{ width: '100%' }}
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
