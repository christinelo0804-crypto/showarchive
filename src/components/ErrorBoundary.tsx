import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ShowArchive 运行时错误：', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: '#1A1A2E',
            color: '#F5EFE6',
            fontFamily: 'var(--font-body)'
          }}
        >
          <div style={{ maxWidth: 480, textAlign: 'center' }}>
            <p style={{ fontSize: 'var(--fs-sm)', letterSpacing: '0.2em', color: 'var(--color-amber)', textTransform: 'uppercase' }}>
              ShowArchive
            </p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-xl)', margin: '8px 0' }}>
              应用遇到了问题
            </h1>
            <p style={{ color: 'var(--color-text-1)', fontSize: 'var(--fs-base)', wordBreak: 'break-all' }}>
              {this.state.error.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                marginTop: 16,
                padding: '10px 24px',
                borderRadius: 999,
                border: 'none',
                background: '#d9a05b',
                color: '#1A1A2E',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              重新加载
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
