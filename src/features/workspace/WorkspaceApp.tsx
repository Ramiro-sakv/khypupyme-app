import { Link, Navigate, Route, Routes } from "react-router";
import { version } from "../../../package.json";
import { useAuth } from "../auth/auth-context";
import { AuthPage } from "../auth/AuthPage";
import GoogleTransferPage from "../auth/GoogleTransferPage";
import { googleAvailable, nativeGoogle } from "../auth/googlePortal";
import { useDraftProtection } from "./navigation";
import "./workspace.css";
import "./industry-layout.css";
import type { WorkspaceRepository } from "./WorkspaceRepository";
import Account from "./AccountPage";
import AccountDeletion, { PrivacyNotice } from "../billing/AccountDeletion";
import WebCheckout from "../billing/WebCheckout";
import { isBillingEnabled, isBillingSimulation, isRenderPilot } from "../billing/profile";
export function WorkspaceApp({
  repository,
}: {
  repository: WorkspaceRepository;
}) {
  const { user, status, error: authError } = useAuth();
  useDraftProtection();
  return (
    <>
      <a
        href="#main"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Saltar al contenido
      </a>
      <div className="environment-banner">
        {isRenderPilot ? "Piloto privado · Datos ficticios · Pagos de prueba" : isBillingSimulation
          ? "Simulación · Usa una cuenta ficticia · Sin cobros reales"
          : import.meta.env.VITE_USE_EMULATORS === "false"
            ? "Beta de KhypuPyme · Servicio alojado"
            : "Entorno local de pruebas · Usa datos ficticios"}
      </div>
      <header className="app-header">
        <div className="header-inner">
          <Link className="brand" to="/">
            <span className="brand-mark" aria-hidden="true">
              K
            </span>
            KhypuPyme
          </Link>
          <div className="header-actions">
            <span className="version-label">{version}</span>
          </div>
        </div>
      </header>
      <main id="main" className="app-main" tabIndex={-1}>
        {status === "loading" ? (
          <p role="status">Comprobando tu sesión…</p>
        ) : status === "error" ? (
          <p role="alert">{authError}</p>
        ) : (
          <Routes>
            <Route path="/ingresar" element={<AuthPage key="login" mode="login" />} />
            <Route path="/registro" element={isRenderPilot ? <Navigate to="/ingresar" replace /> : <AuthPage key="register" mode="register" />} />
            <Route path="/recuperar" element={<AuthPage key="reset" mode="reset" />} />
            {googleAvailable && !nativeGoogle && <Route path="/autorizar-app" element={<GoogleTransferPage />} />}
            {isBillingEnabled && <>
              <Route path="/privacidad" element={<PrivacyNotice />} />
              <Route path="/eliminar-cuenta" element={<AccountDeletion repository={repository} />} />
              {!import.meta.env.VITE_RUNTIME_TARGET || import.meta.env.VITE_RUNTIME_TARGET === "web" ? <Route path="/pago/:businessId" element={<WebCheckout repository={repository} />} /> : null}
            </>}
            <Route
              path="/*"
              element={
                user ? (
                  <Account
                    key={user.uid}
                    uid={user.uid}
                    repository={repository}
                  />
                ) : (
                  <Navigate to="/ingresar" replace />
                )
              }
            />
          </Routes>
        )}
      </main>
    </>
  );
}
