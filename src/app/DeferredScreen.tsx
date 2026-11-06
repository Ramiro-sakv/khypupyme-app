import { Component, Suspense } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
class ScreenErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <section className="card" role="alert">
          <h1>No pudimos abrir esta herramienta</h1>
          <p>
            Comprueba la conexión y vuelve a cargar. Las operaciones pendientes conservan su
            identificador en esta pestaña.
          </p>
          <div className="actions">
            <button onClick={() => window.location.reload()}>Volver a cargar</button>

            <Link to="/">Volver al inicio</Link>
          </div>
        </section>
      );
    return this.props.children;
  }
}
export function DeferredScreen({ children }: { children: ReactNode }) {
  return (
    <ScreenErrorBoundary>
      <Suspense
        fallback={
          <section className="card" role="status">
            Abriendo herramienta…
          </section>
        }
      >
        {children}
      </Suspense>
    </ScreenErrorBoundary>
  );
}
