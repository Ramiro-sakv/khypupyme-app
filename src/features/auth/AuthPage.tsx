import { Icon } from "../workspace/Icon";
import { useState } from "react";
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
    const email = String(data.get("email") ?? "").trim();
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
      } else if (register) await service.register(email, password);
      else await service.login(email, password);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-grid">
      <div className="intro">
        <span className="eyebrow">TU CUADERNO DIGITAL</span>
        <h1>{title}</h1>
        <p>
          Un lugar para llevar las cuentas de tu comercio, paso a paso y sin
          complicarte.
        </p>
        <div className="intro-note">
          <Icon name="chart" />
          <p>
            Desde la primera venta,
            <br />
            <strong>hasta entender tus números.</strong>
          </p>
        </div>
        <p className="muted">
          Inventario, compras, ventas, servicios y fiados. Una vista clara de tu
          día a día.
        </p>
        <div className="intro-trust">
          <Icon name="shield" />
          Cada negocio, en su propio espacio.
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
            : "Usa tu correo para administrar tu negocio."}
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
          <Feedback error={error} message={message} />
          <button className="primary" disabled={busy || !online}>
            {busy
              ? "Espera un momento…"
              : reset
                ? "Solicitar recuperación"
                : register
                  ? "Crear mi cuenta"
                  : "Ingresar"}
          </button>
        </form>
        {!reset && (
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
