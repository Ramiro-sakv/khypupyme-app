import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { change, get } from "../api/client";
import type { components } from "../api/schema";
import { Alert, Button, TextField } from "../ui/Primitives";

type Methods = components["schemas"]["SecurityMethods"];
type Reply = components["schemas"]["ProofResult"];
export type ProofRequest = Omit<components["schemas"]["ProofInput"], "password" | "code" | "sendCode">;
export const securityPath = "/api/v1/security";

export function IdentityDialog({ request, title, effect, done, cancel }: {
  request: ProofRequest; title: string; effect: string; done: () => void; cancel: () => void;
}) {
  const panel = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [methods, setMethods] = useState<Methods>();
  const [reason, setReason] = useState(request.reason ?? "");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    panel.current?.showModal();
    const controller = new AbortController();
    void get<Methods>(securityPath + "/methods", controller.signal).then(setMethods).catch((failure: unknown) => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "No se pudo consultar cómo confirmar tu identidad.");
    });
    return () => controller.abort();
  }, []);

  async function confirm(event: FormEvent) {
    event.preventDefault();
    if (!methods || busy) return;
    setBusy(true);
    setError("");
    try {
      const input = { ...request, reason: request.purpose === "correction" ? reason : undefined,
        ...(methods.password ? { password } : sent ? { code } : { sendCode: true }) };
      const result = await change<Reply>(securityPath + "/proof", "POST", input);
      setPassword("");
      setCode("");
      if (result.stage === "approved") done();
      else setSent(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo confirmar tu identidad.");
    } finally { setBusy(false); }
  }

  return <dialog ref={panel} className="review-dialog security-dialog" aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); if (!busy) cancel(); }}>
    <div className="review-heading"><h2 id={titleId}>{title}</h2></div>
    <div className="review-content">
      <p>{effect}</p>
      <form className="account-form" onSubmit={(event) => void confirm(event)}>
        {request.purpose === "correction" && <TextField label="Motivo de la corrección" required maxLength={240} value={reason}
          readOnly={sent} onChange={(event) => setReason(event.target.value)} />}
        {!!methods?.password && <TextField label="Contraseña de tu cuenta" type="password" autoComplete="current-password" required
          value={password} maxLength={128} onChange={(event) => setPassword(event.target.value)} />}
        {sent && <TextField label="Código de identidad" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{5}"
          value={code} onChange={(event) => setCode(event.target.value)} maxLength={5} />}
        {methods && !methods.password && !methods.email && <Alert tone="error">El correo de verificación todavía requiere configuración.</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
        <div className="inline-actions"><Button variant="secondary" disabled={busy} onClick={cancel}>Cancelar</Button>
          <Button type="submit" disabled={busy || (!methods?.password && !methods?.email)}>
            {methods?.password || sent ? "Confirmar identidad" : "Enviarme un código de identidad"}</Button></div>
      </form>
    </div>
  </dialog>;
}
