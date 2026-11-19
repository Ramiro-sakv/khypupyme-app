import { useState } from "react";
import type { FormEvent } from "react";
import { change } from "../api/client";
import { Alert, Button, TextField } from "../ui/Primitives";
import shopPhoto from "../assets/comercio-khypupyme.jpg";

type Mode = "login" | "register" | "recover";
const auth = "/api/v1/auth";

export function AuthPage({ google, localMailbox, returnTo, notice, onSignIn }: {
  google: boolean;
  localMailbox: boolean;
  returnTo: string | null;
  notice: string;
  onSignIn: () => Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    setShowPassword(false);
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
    setFeedback(localMailbox ? "Si el correo corresponde a esta solicitud, encontrarás el código en el buzón local." :
      "Si el correo corresponde a esta solicitud, recibirás el código por correo. Revisa también la carpeta de spam.");
  }

  const title = mode === "login" ? "Ingresa a KhypuPyme" : mode === "register" ? "Crea tu cuenta" : "Recupera tu contraseña";
  return (
    <section className="auth-layout">
      <div className="intro">
        <img src={shopPhoto} alt="" fetchPriority="high" />
        <div className="intro-copy"><h1>Tu negocio, en orden.</h1>
          <p>Ventas, inventario y caja para cada negocio, desde una sola cuenta.</p></div>
      </div>
      <div className="account-card">
        <h2>{title}</h2>
        {returnTo && mode === "login" && <p>Ingresa para autorizar la aplicación instalada.</p>}
        {error && <Alert tone="error">{error}</Alert>}
        {feedback && <Alert>{feedback}</Alert>}
        <form className="account-form" onSubmit={(event) => void submit(event)}>
          <TextField label="Correo electrónico" type="email" maxLength={256} autoComplete="email" required value={email}
            onChange={(event) => setEmail(event.target.value)} />
          {verified && mode !== "login" && (
            <TextField label="Código de cinco dígitos" inputMode="numeric" pattern="[0-9]{5}" autoComplete="one-time-code" maxLength={5}
              required value={code} onChange={(event) => setCode(event.target.value)} />
          )}
          {(mode === "login" || verified) && <>
            <TextField label={mode === "recover" ? "Nueva contraseña" : "Contraseña"} type={showPassword ? "text" : "password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "login" ? undefined : 12}
              maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} />
            <Button className="password-toggle" variant="plain" disabled={busy}
              onClick={() => setShowPassword((current) => !current)}>{showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}</Button>
          </>}
          <Button type="submit" disabled={busy}>{busy ? "Procesando…" :
            mode === "login" ? "Ingresar" : !verified ? "Enviar código" :
              mode === "register" ? "Crear cuenta" : "Guardar contraseña"}</Button>
          {mode !== "login" && verified && <Button variant="secondary"
            disabled={busy} onClick={() => void run(sendCode)}>Reenviar código</Button>}
        </form>
        {mode === "login" ? (
          <div className="account-actions">
            {google ? <a className="secondary link-button" href={auth + "/google/start" +
              (returnTo ? "?returnTo=" + encodeURIComponent(returnTo) : "")}>Continuar con Google</a>
              : <p className="muted">Continuar con Google estará disponible al configurar Google.</p>}
            <Button variant="plain" disabled={busy} onClick={() => open("register")}>Crear cuenta</Button>
            <Button variant="plain" disabled={busy} onClick={() => open("recover")}>Olvidé mi contraseña</Button>
          </div>
        ) : <Button variant="plain" disabled={busy} onClick={() => open("login")}>Volver al ingreso</Button>}
      </div>
    </section>
  );
}
