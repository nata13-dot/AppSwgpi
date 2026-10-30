import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Error no controlado en SGPI:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="center-page">
        <section className="card-app narrow">
          <img src="/images/itssmt.webp" alt="ITSSMT" width="56" height="56" />
          <span className="eyebrow">Error de aplicación</span>
          <h1>No fue posible mostrar esta pantalla</h1>
          <p>{this.state.error.message || 'Ocurrió un error inesperado.'}</p>
          <button type="button" className="btn-app primary" onClick={() => window.location.reload()}>Volver a cargar</button>
        </section>
      </main>
    )
  }
}
