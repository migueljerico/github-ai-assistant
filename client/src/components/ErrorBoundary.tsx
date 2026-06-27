import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// ── ErrorBoundary (#39) ─────────────────────────────────────────────────────────
// Red de seguridad de UI: si cualquier componente lanza durante el render, en vez
// de dejar la SPA en blanco mostramos una pantalla de error amable con opción de
// recargar. Debe ser un componente de CLASE (React no ofrece un hook equivalente).
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Solo a consola (no exponemos el stack al usuario).
    console.error('Error de render capturado por ErrorBoundary:', error, info);
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-icon">😵</div>
          <h1 className="auth-title">Algo ha fallado</h1>
          <p className="auth-subtitle">
            Ha ocurrido un error inesperado en la aplicación.<br />
            No te preocupes: tus datos no se han enviado a ningún sitio. Recarga la
            página para volver a empezar.
          </p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            🔄 Recargar
          </button>
        </div>
      </div>
    );
  }
}
