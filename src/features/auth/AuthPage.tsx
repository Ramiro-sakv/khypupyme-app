import { useState } from "react";
import shopPhoto from "../../assets/comercio-khypupyme.jpg";
import { isRenderPilot } from "../billing/profile";
import { openGooglePortal } from "./googlePortal";
import type { GoogleTransfer, RegistrationChallenge } from "./types";
import type { SubmitEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router";
import { useAuth } from "./auth-context";
import { validateCredentials } from "./validation";
import { errorMessage } from "../../shared/errors";
import { Feedback } from "../../shared/components/Feedback";
import { useOnline } from "../../shared/hooks/useOnline";

export function AuthPage({ mode }: { mode: "login" | "register" | "reset" }) {
  const { user, service, status, error: sessionError } = useAuth();
  const online = useOnline();
  const [params] = useSearchParams();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [challenge, setChallenge] = useState<(RegistrationChallenge & { email: string }) | null>(null);
  const [transfer, setTransfer] = useState<GoogleTransfer | null>(null);
  const reset = mode === "reset";
  const register = mode === "register";
  const title = reset
    ? "Recupera tu contraseña"
    : register
      ? "Empecemos con tu negocio"
      : "Tu negocio, en orden.";
  if (status === "loading") return <p role="status">Comprobando tu sesión…</p>;
  if (status === "error")
    return (
      <section className="card">
        <h1>No pudimos comprobar tu sesión</h1>
        <Feedback error={sessionError} />
        <button onClick={() => window.location.reload()}>
          Volver a intentar
        </button>
      </section>
    );
  if (user) {
    const destination = params.get("volver");
    const business = params.get("negocio") ?? "";
    return <Navigate to={destination === "baja" ? "/eliminar-cuenta"
      : destination === "pago" && /^[a-zA-Z0-9_-]{1,100}$/.test(business) ? "/pago/" + business : "/"} replace />;
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !online) return;
    const data = new FormData(event.currentTarget);
    const email = (challenge?.email ?? String(data.get("email") ?? "")).trim();
    const password = String(data.get("password") ?? "");
    const validation = validateCredentials(
      email,
      reset ? "reset" : password,
      register,
    );
    setError(validation ?? "");
    setMessage("");
    if (validation) return;
    setBusy(true);
    try {
      if (reset) {
        await service.resetPassword(email);
        setMessage(
          import.meta.env.VITE_USE_EMULATORS === "false"
            ? "Si existe una cuenta, recibirás el enlace de recuperación."
            : "Si existe una cuenta, el enlace de recuperación aparece en la terminal del emulador local.",
        );
      } else if (register && service.requestRegistrationCode && service.completeRegistration) {
        if (challenge) await service.completeRegistration(email, challenge.id, String(data.get("code") ?? ""), password);
        else await sendCode(email);
      } else if (register) await service.register(email, password);
      else await service.login(email, password);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function sendCode(email: string) {
    const sent = await service.requestRegistrationCode!(email);
    setChallenge({ ...sent, email });
    setMessage(import.meta.env.VITE_USE_EMULATORS === "false"
      ? "Revisa tu correo. El código caduca en diez minutos."
      : "Consulta el código de cinco dígitos en la terminal de simulación.");
  }

  async function action(run: () => Promise<void>) {
    if (busy || !online) return;
    setBusy(true);
    setError("");
    setMessage("");
    try { await run(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  return (
    <section className="auth-grid">
      <div className="intro auth-photo">
        <img src={shopPhoto} alt="" width="960" height="1200" fetchPriority="high" />
        <div className="auth-photo-text">
          <h1>{title}</h1>
          <p>Inventario, ventas y caja para tu negocio.</p>
        </div>
      </div>
      <div className="card auth-card">
        <h2>
          {reset
            ? "Volver a ingresar"
            : register
              ? "Crea tu cuenta"
              : "Bienvenido de nuevo"}
        </h2>
        <p>
          {reset
            ? "Escribe el correo de tu cuenta."
            : isRenderPilot ? "Ingresa con la cuenta habilitada para el piloto." : "Usa tu correo para administrar tu negocio."}
        </p>
        <form onSubmit={submit} aria-busy={busy}>
          <label htmlFor="email">Correo electrónico</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            readOnly={!!challenge}
          />
          {!reset && (
            <>
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={register ? "new-password" : "current-password"}
                minLength={register ? 12 : 1}
                maxLength={128}
                required
                aria-describedby={register ? "password-help" : undefined}
              />
              <button
                type="button"
                className="text-button password-toggle"
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              </button>
              {register && (
                <small id="password-help">
                  Al menos 12 caracteres. Evita reutilizar otra contraseña.
                </small>
              )}
            </>
          )}
          {challenge && <label>Código de cinco dígitos
            <input key={challenge.id} name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{5}" maxLength={5} required />
          </label>}
          <Feedback error={error} message={message} />
          <button className="primary" disabled={busy || !online}>
            {busy
              ? "Espera un momento…"
              : reset
                ? "Solicitar recuperación"
                : register
                  ? challenge ? "Verificar y crear cuenta" : service.requestRegistrationCode ? "Enviar código" : "Crear mi cuenta"
                  : "Ingresar"}
          </button>
        </form>
        {challenge && <div className="actions">
          <button type="button" disabled={busy || !online} onClick={() => void action(() => sendCode(challenge.email))}>Reenviar código</button>
          <button type="button" disabled={busy} onClick={() => { setChallenge(null); setError(""); setMessage(""); }}>Cambiar correo</button>
        </div>}
        {!reset && (service.googleLogin || service.beginGoogle) && <div className="actions">
          {!transfer ? <button type="button" disabled={busy || !online} onClick={() => void action(async () => {
            if (service.googleLogin) await service.googleLogin();
            else {
              const pending = await service.beginGoogle!();
              setTransfer(pending);
              await openGooglePortal(pending.id);
            }
          })}>Continuar con Google</button> : <div className="notice notice-info">
            <p>En el navegador, escribe este código para autorizar esta app: <strong>{transfer.pairing}</strong></p>
            <button type="button" disabled={busy || !online} onClick={() => void action(async () => {
              if (Date.now() >= transfer.expiresAt) { setTransfer(null); throw new Error("La solicitud venció. Vuelve a abrir Google."); }
              if (!await service.pollGoogle!(transfer)) setMessage("Completa la autorización en el navegador y vuelve a este botón.");
            })}>Ya autoricé · continuar</button>
            <button type="button" disabled={busy} onClick={() => void action(() => openGooglePortal(transfer.id))}>Abrir navegador</button>
            <button type="button" disabled={busy} onClick={() => setTransfer(null)}>Cancelar</button>
          </div>}
        </div>}
        {!reset && !isRenderPilot && (
          <p className="auth-switch">
            {register ? "¿Ya tienes cuenta?" : "¿Es tu primera visita?"}{" "}
            <Link to={register ? "/ingresar" : "/registro"}>
              {register ? "Ingresar" : "Crear una cuenta"}
            </Link>
          </p>
        )}
        <Link to={reset ? "/ingresar" : "/recuperar"}>
          {reset ? "Volver al inicio de sesión" : "Olvidé mi contraseña"}
        </Link>
      </div>
    </section>
  );
}
