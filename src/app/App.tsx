import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, Navigate, Route, Routes } from 'react-router';
import { AuthPage } from '../features/auth/AuthPage';
import { useAuth } from '../features/auth/auth-context';
import { BusinessPage } from '../features/business/BusinessPage';
import type { BusinessRepository } from '../features/business/domain';
import { useOnline } from '../shared/hooks/useOnline';
import { errorMessage } from '../shared/errors';
import { Feedback } from '../shared/components/Feedback';
import type { InventoryService } from '../features/inventory/InventoryService';
import { InventoryPage } from '../features/inventory/InventoryPage';

function Protected({ children }: { children: ReactNode }) {
  const { status, user, error } = useAuth();
  if (status === 'loading') return <p role="status">Comprobando tu sesión…</p>;
  if (status === 'error') return <Feedback error={error} />;
  return user ? children : <Navigate to="/ingresar" replace />;
}

export function App({ repository, inventory }: { repository: BusinessRepository; inventory: InventoryService }) {
  const { user, service } = useAuth();
  const online = useOnline();
  const [error, setError] = useState('');
  const [exiting, setExiting] = useState(false);
  async function logout() {
    setExiting(true); setError('');
    try { await service.logout(); } catch (cause) { setError(errorMessage(cause)); }
    finally { setExiting(false); }
  }
  return <>
    <a href="#main" className="skip-link">Saltar al contenido</a>
    <div className="environment-banner">Entorno local de pruebas · Usa solo datos ficticios</div>
    <header><div className="header-inner"><Link className="brand" to="/" aria-label="KhypuPyme, inicio"><span className="brand-mark" aria-hidden="true">K</span><span>Khypu<span className="brand-light">Pyme</span></span></Link>
      {user && <nav aria-label="Navegación principal"><NavLink to="/" end>Inicio</NavLink><NavLink to="/negocio">Mi negocio</NavLink><NavLink to="/inventario">Inventario</NavLink><button className="quiet" onClick={logout} disabled={exiting}>{exiting ? 'Saliendo…' : 'Salir'}</button></nav>}
    </div></header>
    {!online && <p className="offline" role="alert">Sin conexión. No se pueden guardar cambios. Recupera la conexión y vuelve a consultar.</p>}
    <main id="main" tabIndex={-1}><Feedback error={error} /><Routes>
      <Route path="/ingresar" element={<AuthPage key="login" mode="login" />} />
      <Route path="/registro" element={<AuthPage key="register" mode="register" />} />
      <Route path="/recuperar" element={<AuthPage key="reset" mode="reset" />} />
      <Route path="/" element={<Protected><BusinessPage key={user?.uid} repository={repository} /></Protected>} />
      <Route path="/negocio" element={<Protected><BusinessPage key={user?.uid} repository={repository} settings /></Protected>} />
      <Route path="/inventario" element={<Protected><InventoryPage key={user?.uid} businessRepository={repository} service={inventory} /></Protected>} />
      <Route path="*" element={<section className="card"><h1>No encontramos esta página</h1><Link to="/">Volver al inicio</Link></section>} />
    </Routes></main>
    <footer><span>KhypuPyme</span><span>Hecho para el día a día de tu negocio.</span></footer>
  </>;
}
