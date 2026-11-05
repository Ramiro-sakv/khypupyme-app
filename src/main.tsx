import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './app/App';
import { AuthProvider } from './features/auth/AuthProvider';
import { createServices } from './infrastructure/firebase';
import './styles.css';

const root = createRoot(document.getElementById('root')!);
try {
  const services = createServices();
    root.render(<StrictMode><BrowserRouter><AuthProvider service={services.authService}><App repository={services.businessRepository} inventory={services.inventoryService} /></AuthProvider></BrowserRouter></StrictMode>);
} catch {
  root.render(<main><h1>Revisa la configuración local</h1><p role="alert">Esta versión solo funciona con Firebase Emulator. Consulta el README y revisa .env.local.</p></main>);
}
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      console.warn('No se pudo preparar la instalación PWA. La aplicación requiere conexión.');
    });
  });
}
