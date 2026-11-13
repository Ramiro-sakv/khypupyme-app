import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router';
import { WorkspaceApp } from './features/workspace/WorkspaceApp';
import { AuthProvider } from './features/auth/AuthProvider';
import { createWorkspaceServices } from './infrastructure/workspace';
import './styles.css';

const root = createRoot(document.getElementById('root')!);
try {
  const services = createWorkspaceServices();
  const Router =
    import.meta.env.VITE_RUNTIME_TARGET === 'android' ||
    import.meta.env.VITE_RUNTIME_TARGET === 'windows'
      ? HashRouter
      : BrowserRouter;
  root.render(
    <StrictMode>
      <Router>
        <AuthProvider service={services.authService}>
          <WorkspaceApp repository={services.repository}/>
        </AuthProvider>
      </Router>
    </StrictMode>,
  );
} catch {
  root.render(
    <main>
      <h1>Revisa la configuración</h1>
      <p role="alert">
        Revisa el perfil de Firebase y la configuración de este paquete.
      </p>
    </main>,
  );
}
if (
  import.meta.env.PROD && import.meta.env.VITE_USE_EMULATORS !== "false" &&
  !['android', 'windows'].includes(import.meta.env.VITE_RUNTIME_TARGET ?? '') &&
  'serviceWorker' in navigator
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      console.warn('No se pudo preparar la instalación PWA. La aplicación requiere conexión.');
    });
  });
}
