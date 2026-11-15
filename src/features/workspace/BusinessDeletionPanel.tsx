import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../auth/auth-context";
import { useIdentityConfirmation } from "../auth/useIdentityConfirmation";
import { errorMessage } from "../../shared/errors";
import { finishBusinessDeletion } from "./businessDeletion";
import { useCashState } from "./cash-context";
import { useWorkspace } from "./context";
import { useWorkspaceNavigation } from "./navigation";
import { operationJournal } from "./OperationJournal";
import { Panel } from "./Panel";
import { resetLocalWorkspace } from "./resetLocalWorkspace";

export default function BusinessDeletionPanel({ onExit }: { onExit: () => void }) {
  const { business, repository, identity, busy, pending } = useWorkspace();
  const { service } = useAuth();
  const confirmation = useIdentityConfirmation();
  const cash = useCashState();
  const { go } = useWorkspaceNavigation();
  const [step, setStep] = useState<"name" | "password" | "code" | "deleting" | "done" | null>(null);
  const [challengeId, setChallengeId] = useState("");
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [needsEmail, setNeedsEmail] = useState(false);
  const [verification, setVerification] = useState("");
  const running = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const deletion = repository.deletion?.bind(repository);
  if (!deletion || !confirmation.available || business.tutorialSessionId) return null;

  async function work(action: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setWorking(true);
    setFeedback("");
    try { await action(); }
    catch (cause) {
      const details = (cause as { details?: { appCode?: string } } | null)?.details;
      setNeedsEmail(details?.appCode === "DELETION_EMAIL");
      setFeedback(errorMessage(cause, "No se pudo completar la confirmación."));
    } finally {
      running.current = false;
      setWorking(false);
    }
  }
  async function checkPending() {
    if (pending || await operationJournal.get(identity.uid, business.id))
      throw new Error("Resuelve la solicitud pendiente de este negocio antes de continuar.");
  }
  async function send() {
    const result = await deletion!({ kind: "send", businessId: business.id, challengeId });
    if (result.state !== "sent") throw new Error("Vuelve a iniciar la confirmación.");
    setChallengeId(result.challengeId);
    setStep("code");
  }
  async function finish() {
    const reset = await finishBusinessDeletion(deletion!, business.id, () => mounted.current);
    if (!reset) return;
    await resetLocalWorkspace(identity.uid, reset);
    if (mounted.current) setStep("done");
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, data = new FormData(form);
    void work(async () => {
      if (step === "name") {
        await checkPending();
        const result = await deletion!({ kind: "prepare", businessId: business.id, name: String(data.get("name") ?? "") });
        if (result.state !== "prepared") throw new Error("Vuelve a iniciar la confirmación.");
        setChallengeId(result.challengeId);
        setNeedsEmail(false);
        setStep("password");
      } else if (step === "password") {
        form.reset();
        await confirmation.confirm(data);
        await send();
      } else if (step === "code") {
        await checkPending();
        try {
          const result = await deletion!({ kind: "confirm", businessId: business.id, challengeId, code: String(data.get("code") ?? "") });
          if (result.state !== "deleting") throw new Error("Consulta el estado del borrado.");
        } catch (cause) {
          const code = (cause as { code?: string } | null)?.code;
          if (["functions/internal", "functions/unknown", "functions/deadline-exceeded", "functions/unavailable"].includes(code ?? ""))
            setStep("deleting");
          throw cause;
        }
        setStep("deleting");
        await finish();
      }
    });
  }
  function close() {
    if (running.current) return;
    if (step === "deleting" || step === "done") { onExit(); return; }
    setStep(null);
    setFeedback("");
    setNeedsEmail(false);
    setVerification("");
  }
  return <section className="card danger-zone">
    <h2>Eliminar negocio</h2>
    <p>Borrado definitivo del inventario, operaciones, caja y documentos de <strong>{business.name}</strong>. Tu cuenta y tus otros negocios se conservan. Las copias anteriores siguen su retención local.</p>
    {pending && <p className="notice notice-warning">Resuelve la solicitud pendiente que aparece arriba antes de eliminar el negocio.</p>}
    {cash.open && <p className="notice notice-warning">Cierra la caja antes de continuar. <button type="button" onClick={() => go("caja")}>Ir a Caja</button></p>}
    {cash.error && <p className="notice notice-warning">{cash.error} <button type="button" onClick={cash.refresh}>Reintentar consulta de caja</button></p>}
    <button type="button" className="danger-action" disabled={busy || !!cash.open || cash.loading || !!cash.error}
      onClick={() => setStep("name")}>Eliminar este negocio</button>
    {step && <Panel title={step === "done" ? "Negocio eliminado" : "Confirmar borrado definitivo"} onClose={close}>
      {feedback && <p className="notice notice-error" role="alert">{feedback}</p>}
      {verification && <p className="notice notice-info" role="status">{verification}</p>}
      {step === "done" ? <button type="button" className="primary" onClick={onExit}>Volver a Mis negocios</button>
        : step === "deleting" ? <div>
          <p role="status">{working ? "Comprobando y limpiando los registros del negocio…" : "Consulta el estado para continuar un borrado autorizado."}</p>
          <button type="button" disabled={working} onClick={() => void work(finish)}>Consultar y continuar</button>
          {!working && <button type="button" onClick={onExit}>Volver a Mis negocios</button>}
        </div> : <form onSubmit={submit}>
          {step === "name" && <label>Escribe {business.name} exactamente como aparece
            <input name="name" autoComplete="off" required maxLength={80} />
          </label>}
          {step === "password" && confirmation.field}
          {step === "code" && <>
            <p>{import.meta.env.VITE_USE_EMULATORS === "false" ? "Revisa el correo de tu cuenta. El código caduca en diez minutos." : <>Consulta el código con <code>pnpm inbox</code> en la terminal local de KhypuPyme. Caduca en diez minutos.</>}</p>
            <label>Código de seis dígitos
              <input key={challengeId} name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
            </label>
          </>}
          <div className="actions">
            <button type="submit" className={step === "code" ? "danger-action" : "primary"} disabled={working}>
              {step === "name" ? "Continuar" : step === "password" ? "Solicitar código" : "Eliminar definitivamente"}
            </button>
            {step === "code" && <button type="button" disabled={working} onClick={() => void work(send)}>Reenviar código</button>}
            {step !== "name" && <button type="button" disabled={working} onClick={() => { setStep("name"); setFeedback(""); }}>Iniciar otra solicitud</button>}
          </div>
        </form>}
      {needsEmail && service.verifyEmail && <button type="button" disabled={working} onClick={() => void work(async () => {
        const verified = await service.verifyEmail!();
        setVerification(verified ? "Correo verificado. Puedes continuar." : (import.meta.env.VITE_USE_EMULATORS === "false"
          ? "Abre el enlace de verificación que llegó a tu correo y vuelve a continuar."
          : "Abre el enlace de verificación en la terminal de Firebase y vuelve a continuar."));
        setNeedsEmail(false);
      })}>Verificar correo</button>}
    </Panel>}
  </section>;
}
