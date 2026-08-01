import React from 'react'
import {
  clearDecisionIndexedRecords,
  isDecisionStorageError
} from '../read-model/decision-indexed-storage.service'

type RouteErrorBoundaryProps = {
  boundaryKey: string
  routeLabel: string
  children: React.ReactNode
}

type RouteErrorBoundaryState = {
  hasError: boolean
  isStorageError: boolean
  message: string
}

export default class RouteErrorBoundary extends React.Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = {
    hasError: false,
    isStorageError: false,
    message: ''
  }

  static getDerivedStateFromError(error: unknown): RouteErrorBoundaryState {
    const storageError = isDecisionStorageError(error)
    return {
      hasError: true,
      isStorageError: storageError,
      message: error instanceof Error ? error.message : 'Beklenmeyen runtime hatasi.'
    }
  }

  componentDidCatch(error: unknown) {
    if(isDecisionStorageError(error)){
      clearDecisionIndexedRecords()
    }
  }

  componentDidUpdate(previousProps: RouteErrorBoundaryProps) {
    if(previousProps.boundaryKey !== this.props.boundaryKey && this.state.hasError){
      this.setState({ hasError: false, isStorageError: false, message: '' })
    }
  }

  render() {
    if(!this.state.hasError) return this.props.children

    return (
      <section className="card route-error-card" role="alert">
        <span>{this.state.isStorageError ? 'Karar Destek Önbelleği' : 'Runtime Stabilization'}</span>
        <h2>{this.props.routeLabel || 'Sayfa acilamadi'}</h2>
        <p>
          {this.state.isStorageError
            ? 'Karar Destek önbelleği temizleniyor. Sayfayı yeniden açabilirsiniz.'
            : 'Bu sayfanın analiz modeli hesabı güvenli moda alındı. Diğer menüler açık kalır.'}
        </p>
        {this.state.message && <small>{this.state.message}</small>}
      </section>
    )
  }
}
