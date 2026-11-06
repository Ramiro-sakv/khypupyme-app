import { lazy, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router';
import { useAuth } from '../features/auth/auth-context';
import { BusinessPage } from '../features/business/BusinessPage';
import type { BusinessRepository } from '../features/business/domain';
import { useOnline } from '../shared/hooks/useOnline';
import { errorMessage } from '../shared/errors';
import { Feedback } from '../shared/components/Feedback';
import type { InventoryService } from '../features/inventory/InventoryService';
import type { PurchaseService } from '../features/purchases/PurchaseService';
import type { CommerceService } from '../features/commerce/CommerceRepository';
import { CommerceArea } from '../features/commerce/CommerceArea';

import { DeferredScreen } from './DeferredScreen';
import { ToolGate } from './ToolGate';
import { useBusiness } from '../features/business/business-context';
import { enabledTools } from '../../shared/business-configuration';
import type { ToolId } from '../../shared/business-configuration';
import { usePendingRequests } from '../shared/pendingRequests';
const routeTools: Record<string, ToolId> = {
  '/inventario': 'inventory',
  '/compras': 'purchases',
  '/servicios': 'services',
  '/clientes': 'customers',
  '/fiados': 'receivables',
};

const AuthPage = lazy(() =>
  import('../features/auth/AuthPage').then((module) => ({ default: module.AuthPage })),
);
const InventoryPage = lazy(() =>
  import('../features/inventory/InventoryPage').then((module) => ({
    default: module.InventoryPage,
  })),
);
const PurchasesPage = lazy(() =>
  import('../features/purchases/PurchasesPage').then((module) => ({
    default: module.PurchasesPage,
  })),
);
const DashboardPage = lazy(() =>
  import('../features/commerce/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
);
const RecordsPage = lazy(() =>
  import('../features/commerce/RecordsPage').then((module) => ({ default: module.RecordsPage })),
);
const BusinessActivity = lazy(() =>
  import('../features/commerce/BusinessActivity').then((module) => ({
    default: module.BusinessActivity,
  })),
);

function Protected({ children }: { children: ReactNode }) {
  const { status, user, error } = useAuth();
  if (status === 'loading') return <p role="status">Comprobando tu sesión…</p>;
  if (status === 'error') return <Feedback error={error} />;
  return user ? children : <Navigate to="/ingresar" replace />;
}

export function App({
  repository,
  inventory,
  purchases,
  commerce,
}: {
  repository: BusinessRepository;
  inventory: InventoryService;
  purchases: PurchaseService;
  commerce: CommerceService;
}) {
  const { user, service } = useAuth();
  const pendingRequests = usePendingRequests(user?.uid);
  const online = useOnline();
  const { business } = useBusiness();
  const tools = enabledTools(business ?? {});
  const location = useLocation();
  const [error, setError] = useState('');
  const [exiting, setExiting] = useState(false);
  const [menu, setMenu] = useState(false);
  async function logout() {
    setExiting(true);
    setError('');
    try {
      await service.logout();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setExiting(false);
    }
  }
  return (
    <div className={user ? 'app-shell' : 'public-shell'}>
      <a href="#main" className="skip-link">
        Saltar al contenido
      </a>
      <div className="environment-banner">
        BETA LOCAL · Usa solo datos ficticios · Requiere los servicios locales encendidos
      </div>
      <header>
        <div className="header-inner">
          <Link className="brand" to="/" aria-label="KhypuPyme, inicio">
            <span className="brand-mark" aria-hidden="true">
              K
            </span>
            <span>
              Khypu<span className="brand-light">Pyme</span>
            </span>
          </Link>
          {user && (
            <>
              <button
                className="menu-toggle"
                aria-expanded={menu}
                aria-controls="workspace-navigation"
                onClick={() => setMenu(!menu)}
              >
                {menu ? 'Cerrar menú' : '☰ Menú'}
              </button>
              <nav
                id="workspace-navigation"
                className={menu ? 'expanded' : ''}
                aria-label="Navegación principal"
              >
                <span className="nav-caption">ESPACIO DE TRABAJO</span>
                {[
                  ['/', 'Inicio', '◈'],
                  ['/ventas', 'Ventas', '↗'],
                  ['/inventario', 'Inventario', '▦'],
                  ['/compras', 'Compras', '↓'],
                  ['/gastos', 'Gastos', '↙'],
                  ['/fiados', 'Fiados y cobros', '◷'],
                  ['/clientes', 'Clientes', '♧'],
                  ['/servicios', 'Servicios', '◇'],
                  ['/informes', 'Informes', '▥'],
                  ['/negocio', 'Mi negocio', '⚙'],
                ]
                  .filter(([path]) => !routeTools[path!] || tools.includes(routeTools[path!]!))
                  .map(([path, label, icon]) => (
                    <NavLink
                      key={path}
                      to={path!}
                      end={path === '/'}
                      onClick={() => setMenu(false)}
                    >
                      <span aria-hidden="true" className="nav-icon">
                        {icon}
                      </span>
                      {label}
                    </NavLink>
                  ))}
                <button className="quiet" onClick={logout} disabled={exiting}>
                  {exiting ? 'Saliendo…' : 'Cerrar sesión'}
                </button>
                <small className="sidebar-version">
                  KhypuPyme · 0.3.0 beta 2
                  <br />
                  Bolivia · BOB
                </small>
              </nav>
            </>
          )}
        </div>
      </header>
      {!online && (
        <p className="offline" role="alert">
          Sin conexión. No se pueden guardar cambios. Recupera la conexión y vuelve a consultar.
        </p>
      )}
      <main id="main" tabIndex={-1}>
        {user && (pendingRequests.inventory || pendingRequests.commerce) && (
          <aside className="pending-operation" role="alert">
            <strong>Tienes una solicitud por confirmar.</strong>
            <p>Resuélvela antes de registrar otra operación o cambiar tus herramientas.</p>
            <div className="actions">
              {pendingRequests.inventory && (
                <Link to="/inventario">Revisar inventario o compras</Link>
              )}
              {pendingRequests.commerce && <Link to="/ventas">Revisar solicitud comercial</Link>}
            </div>
          </aside>
        )}
        <Feedback error={error} />
        <DeferredScreen key={location.pathname}>
          <Routes>
            <Route path="/ingresar" element={<AuthPage key="login" mode="login" />} />
            <Route path="/registro" element={<AuthPage key="register" mode="register" />} />
            <Route path="/recuperar" element={<AuthPage key="reset" mode="reset" />} />
            <Route
              path="/"
              element={
                <Protected>
                  <CommerceArea key={user?.uid} repository={repository}>
                    {(business) => <DashboardPage service={commerce} business={business} />}
                  </CommerceArea>
                </Protected>
              }
            />
            <Route
              path="/negocio"
              element={
                <Protected>
                  <CommerceArea key={user?.uid} repository={repository}>
                    {(business, uid) => (
                      <>
                        <BusinessPage repository={repository} settings />
                        <BusinessActivity
                          key={business.configurationRevision ?? 0}
                          business={business}
                          uid={uid}
                          service={commerce}
                        />
                      </>
                    )}
                  </CommerceArea>
                </Protected>
              }
            />
            <Route
              path="/inventario"
              element={
                <Protected>
                  <ToolGate tool="inventory">
                    <InventoryPage
                      key={user?.uid}
                      businessRepository={repository}
                      service={inventory}
                      purchases={purchases}
                    />
                  </ToolGate>
                </Protected>
              }
            />
            <Route
              path="/compras"
              element={
                <Protected>
                  <ToolGate tool="purchases">
                    <PurchasesPage
                      key={user?.uid}
                      businessRepository={repository}
                      inventory={inventory}
                      service={purchases}
                    />
                  </ToolGate>
                </Protected>
              }
            />
            {(['sales', 'expenses', 'receivables', 'customers', 'services'] as const).map(
              (resource, index) => (
                <Route
                  key={resource}
                  path={['/ventas', '/gastos', '/fiados', '/clientes', '/servicios'][index]!}
                  element={
                    <Protected>
                      <ToolGate
                        tool={
                          routeTools[
                            ['/ventas', '/gastos', '/fiados', '/clientes', '/servicios'][index]!
                          ] ?? null
                        }
                      >
                        <CommerceArea key={user?.uid} repository={repository}>
                          {(business, uid) => (
                            <RecordsPage
                              key={`${uid}:${resource}`}
                              resource={resource}
                              uid={uid}
                              business={business}
                              service={commerce}
                              inventory={inventory}
                            />
                          )}
                        </CommerceArea>
                      </ToolGate>
                    </Protected>
                  }
                />
              ),
            )}
            <Route
              path="/informes"
              element={
                <Protected>
                  <CommerceArea key={user?.uid} repository={repository}>
                    {(business) => <DashboardPage service={commerce} business={business} reports />}
                  </CommerceArea>
                </Protected>
              }
            />
            <Route
              path="*"
              element={
                <section className="card">
                  <h1>No encontramos esta página</h1>
                  <Link to="/">Volver al inicio</Link>
                </section>
              }
            />
          </Routes>
        </DeferredScreen>
      </main>
      <footer>
        <span>KhypuPyme</span>
        <span>Hecho para el día a día de tu negocio.</span>
      </footer>
    </div>
  );
}
