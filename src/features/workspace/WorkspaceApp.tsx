import { errorMessage } from "../../shared/errors";
import { useState } from "react";
import { Link, Navigate, Route, Routes } from "react-router";
import { useAuth } from "../auth/auth-context";
import { AuthPage } from "../auth/AuthPage";
import { Icon } from "./Icon";
import { confirmDiscardChanges, useDraftProtection } from "./navigation";
import "./workspace.css";
import type { WorkspaceRepository } from "./WorkspaceRepository";
const message = (e: unknown) =>
  errorMessage(e, "No se pudo completar la solicitud.");

import Account from "./AccountPage";
export function WorkspaceApp({
  repository,
}: {
  repository: WorkspaceRepository;
}) {
  const { user, status, service, error: authError } = useAuth();
  const [logoutError, setLogoutError] = useState("");
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
        {import.meta.env.VITE_USE_EMULATORS === "false"
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
            <span className="version-label">0.5 beta 5</span>
            {user && (
              <button
                onClick={() => {
                  if (!confirmDiscardChanges()) return;
                  void service
                    .logout()
                    .catch((e) => setLogoutError(message(e)));
                }}
              >
                <Icon name="logout" />
                Salir
              </button>
            )}
          </div>
        </div>
      </header>
      <main id="main" className="app-main" tabIndex={-1}>
        {logoutError && (
          <p role="alert" className="notice notice-error">
            {logoutError}
          </p>
        )}
        {status === "loading" ? (
          <p role="status">Comprobando tu sesión…</p>
        ) : status === "error" ? (
          <p role="alert">{authError}</p>
        ) : (
          <Routes>
            <Route path="/ingresar" element={<AuthPage mode="login" />} />
            <Route path="/registro" element={<AuthPage mode="register" />} />
            <Route path="/recuperar" element={<AuthPage mode="reset" />} />
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
