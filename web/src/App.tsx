import { useEffect, useState } from "react";
import type { components } from "./api/schema";
import { change, get, linkGoogle } from "./api/client";
import { AuthPage } from "./accounts/AuthPage";
import { BusinessesPage } from "./businesses/BusinessesPage";
import { StatusPage } from "./StatusPage";
import { Alert, Button } from "./ui/Primitives";

type Session = components["schemas"]["SessionInfo"];
const auth = "/api/v1/auth";
const query = new URLSearchParams(location.search);
const target = query.get("returnTo");
const returnTo = target?.startsWith("/connect/authorize?") ? target : null;
const googleNotice = ({
  "link-required": "Ya existe una cuenta con ese correo. Ingresa con tu contraseña y luego vincula Google.",
  "google-failed": "No se pudo completar el ingreso con Google.",
  "google-linked": "Google quedó vinculado a tu cuenta.",
} as Record<string, string>)[query.get("auth") ?? ""] ?? "";

export function App() {
  if (query.get("view") === "status") return <StatusPage />;
  return <AccountApp />;
}

function AccountApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    void get<Session>(auth + "/session", abort.signal).then((result) => {
      if (!abort.signal.aborted) {
        if (result.email && returnTo) { location.assign(returnTo); return; }
        setSession(result);
        setLoading(false);
      }
    }).catch(() => {
      if (!abort.signal.aborted) {
        setError("No se pudo consultar la sesión. Comprueba que el servidor esté disponible.");
        setLoading(false);
      }
    });
    return () => abort.abort();
  }, [revision]);

  async function refreshSession() {
    setSession(await get<Session>(auth + "/session"));
  }

  async function accountAction(action: () => Promise<void>) {
    setActing(true);
    setError("");
    try { await action(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "No se pudo completar la solicitud."); }
    finally { setActing(false); }
  }

  return <main className="app-shell">
    <header className="app-header">
      <div className="brand"><span className="brand-mark" aria-hidden="true">K</span><strong>KhypuPyme 2.0</strong></div>
      <a href="/?view=status">Estado local</a>
    </header>
    {loading && <p role="status">Consultando sesión…</p>}
    {error && <Alert tone="error">{error}</Alert>}
    {!loading && !session && <Button onClick={() => {
      setError(""); setLoading(true); setRevision((value) => value + 1);
    }}>Reintentar</Button>}
    {!loading && session && (session.email ? (
      <>
        <div className="session-bar">
          <span>{session.email}</span>
          <div className="inline-actions">
            {session.googleConfigured && !session.googleLinked && <Button variant="secondary"
              disabled={acting} onClick={() => void accountAction(linkGoogle)}>Vincular Google</Button>}
            <Button variant="secondary" disabled={acting} onClick={() => void accountAction(async () => {
              await change(auth + "/logout", "POST");
              setSession({ ...session, email: null, googleLinked: false });
              history.replaceState(null, "", "/");
            })}>Cerrar sesión</Button>
          </div>
        </div>
        {googleNotice && <Alert>{googleNotice}</Alert>}
        <BusinessesPage key={session.email} />
      </>
    ) : (
      <AuthPage google={session.googleConfigured} notice={googleNotice} returnTo={returnTo} onSignIn={refreshSession} />
    ))}
  </main>;
}
