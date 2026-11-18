import { useState } from "react";
import type { FormEvent } from "react";
import { change } from "../api/client";

type Mode = "login" | "register" | "recover";
const auth = "/api/v1/auth";

export function AuthPage({ google, returnTo, notice, onSignIn }: {
  google: boolean;
  returnTo: string | null;
  notice: string;
  onSignIn: () => Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState(notice);
  const verified = sentTo !== "" && sentTo === email.trim();

  async function run(action: () => Promise<void>) {
    setError("");
    setFeedback("");
    setBusy(true);
    try { await action(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Comprueba tu conexión."); }
    finally { setBusy(false); }
  }

  function open(next: Mode) {
    setMode(next);
    setPassword("");
    setCode("");
    setSentTo("");
    setError("");
    setFeedback("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      if (mode === "login") {
        await change(auth + "/login", "POST", { email, password });
        if (returnTo) location.assign(returnTo);
        else await onSignIn();
        return;
      }
      if (!verified) {
        await sendCode();
        return;
      }
      await change(auth + "/" + mode, "POST", { email, password, code });
      const success = mode === "register" ? "Cuenta creada. Ya puedes ingresar." : "Contraseña actualizada. Ingresa de nuevo.";
      open("login");
      setFeedback(success);
    });
  }

  async function sendCode() {
    await change(auth + "/" + mode + "/code", "POST", { email });
    setSentTo(email.trim());
    setCode("");
    setFeedback("Si el correo corresponde a esta solicitud, encontrarás el código en el buzón local.");
  }

  const title = mode === "login" ? "Ingresa a KhypuPyme" : mode === "register" ? "Crea tu cuenta" : "Recupera tu contraseña";
  return (
    <section className="auth-layout">
      <div className="intro">
        <h1>Un espacio para cada negocio.</h1>
        <p>Administra tus negocios de Bolivia desde la misma cuenta.</p>
      </div>
      <div className="account-card">
        <h2>{title}</h2>
        {returnTo && mode === "login" && <p>Ingresa para autorizar la aplicación instalada.</p>}
        {error && <p role="alert" className="form-error">{error}</p>}
        {feedback && <p role="status" className="form-notice">{feedback}</p>}
        <form className="account-form" onSubmit={(event) => void submit(event)}>
          <label>Correo electrónico
            <input type="email" maxLength={256} autoComplete="email" required value={email}
              onChange={(event) => setEmail(event.target.value)} />
          </label>
          {verified && mode !== "login" && (
            <label>Código de cinco dígitos
              <input inputMode="numeric" pattern="[0-9]{5}" autoComplete="one-time-code" maxLength={5}
                required value={code} onChange={(event) => setCode(event.target.value)} />
            </label>
          )}
          {(mode === "login" || verified) && (
            <label>{mode === "recover" ? "Nueva contraseña" : "Contraseña"}
              <input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={mode === "login" ? undefined : 12} maxLength={128} required value={password}
                onChange={(event) => setPassword(event.target.value)} />
            </label>
          )}
          <button type="submit" disabled={busy}>{busy ? "Procesando…" :
            mode === "login" ? "Ingresar" : !verified ? "Enviar código" :
              mode === "register" ? "Crear cuenta" : "Guardar contraseña"}</button>
          {mode !== "login" && verified && <button type="button" className="secondary"
            disabled={busy} onClick={() => void run(sendCode)}>Reenviar código</button>}
        </form>
        {mode === "login" ? (
          <div className="account-actions">
            {google ? <a className="secondary link-button" href={auth + "/google/start" +
              (returnTo ? "?returnTo=" + encodeURIComponent(returnTo) : "")}>Continuar con Google</a>
              : <p className="muted">Continuar con Google estará disponible al configurar Google.</p>}
            <button type="button" className="text-button" disabled={busy} onClick={() => open("register")}>Crear cuenta</button>
            <button type="button" className="text-button" disabled={busy} onClick={() => open("recover")}>Olvidé mi contraseña</button>
          </div>
        ) : <button type="button" className="text-button" disabled={busy} onClick={() => open("login")}>Volver al ingreso</button>}
      </div>
    </section>
  );
}
