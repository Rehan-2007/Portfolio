import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface SceneErrorBoundaryProps {
  children: ReactNode
  fallback: (error: Error, retry: () => void) => ReactNode
}

interface SceneErrorBoundaryState {
  error: Error | null
  retryKey: number
}

export class SceneErrorBoundary extends Component<
  SceneErrorBoundaryProps,
  SceneErrorBoundaryState
> {
  state: SceneErrorBoundaryState = { error: null, retryKey: 0 }

  static getDerivedStateFromError(error: Error): SceneErrorBoundaryState {
    return { error, retryKey: 0 }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('The 3D experience failed safely.', error, info.componentStack)
  }

  private retry = (): void => {
    this.setState((state) => ({ error: null, retryKey: state.retryKey + 1 }))
  }

  render(): ReactNode {
    if (this.state.error) {
      return this.props.fallback(this.state.error, this.retry)
    }
    return <div key={this.state.retryKey}>{this.props.children}</div>
  }
}
