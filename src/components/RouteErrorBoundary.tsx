import React from 'react'

type RouteErrorBoundaryProps = {
  boundaryKey: string
  routeLabel: string
  children: React.ReactNode
}

type RouteErrorBoundaryState = {
  hasError: boolean
  message: string
}

export default class RouteErrorBoundary extends React.Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = {
    hasError: false,
    message: ''
  }

  static getDerivedStateFromError(error: unknown): RouteErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Beklenmeyen runtime hatasi.'
    }
  }

  componentDidUpdate(previousProps: RouteErrorBoundaryProps) {
    if(previousProps.boundaryKey !== this.props.boundaryKey && this.state.hasError){
      this.setState({ hasError: false, message: '' })
    }
  }

  render() {
    if(!this.state.hasError) return this.props.children

    return (
      <section className="card route-error-card" role="alert">
        <span>Runtime Stabilization</span>
        <h2>{this.props.routeLabel || 'Sayfa acilamadi'}</h2>
        <p>Bu sayfanin read-model hesabi guvenli moda alindi. Diger menuler acik kalir.</p>
        {this.state.message && <small>{this.state.message}</small>}
      </section>
    )
  }
}
