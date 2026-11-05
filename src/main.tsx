import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router';
import { App } from './app/App';
import { AuthProvider } from './features/auth/AuthProvider';
import { createServices } from './infrastructure/firebase';
import './styles.css';

const root = createRoot(document.getElementById('root')!);
try {
  const services = createServices();
  const Router = import.meta.env.VITE_RUNTIME_TARGET === 'android' || import.meta.env.VITE_RUNTIME_TARGET === 'windows' ? HashRouter : BrowserRouter;
  root.render(<StrictMode><Router><AuthProvider service={services.authService}><App repository={services.businessRepository} inventory={services.inventoryService} purchases={services.purchaseService} commerce={services.commerceService} /></AuthProvider></Router></StrictMode>);
} catch {
  root.render(<main><h1>Revisa la configuración local</h1><p role="alert">Esta versión solo funciona con Firebase Emulator. Consulta el README y revisa .env.local.</p></main>);
}
if (import.meta.env.PROD && !['android', 'windows'].includes(import.meta.env.VITE_RUNTIME_TARGET ?? '') && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      console.warn('No se pudo preparar la instalación PWA. La aplicación requiere conexión.');
    });
  });
}
