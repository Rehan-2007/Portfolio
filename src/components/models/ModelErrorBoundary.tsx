import { Component, Fragment } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import type { ModelId } from '../../config/models'
import { useModelAssets } from '../../stores/useModelAssets'

interface Props { id: ModelId; children: ReactNode; fallback?: ReactNode }

/** Canvas-safe boundary: it never creates a DOM element inside the Three scene. */
export class ModelErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) {
    useModelAssets.getState().setStatus(this.props.id, { phase: 'error', message: error.message })
    console.error(`Model slot ${this.props.id} failed`, error, info.componentStack)
  }
  render(): ReactNode { return this.state.failed ? this.props.fallback ?? null : <Fragment>{this.props.children}</Fragment> }
}
