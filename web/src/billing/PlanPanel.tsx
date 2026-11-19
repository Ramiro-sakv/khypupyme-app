import { useState } from "react";
import { change } from "../api/client";
import type { components } from "../api/schema";
import { industryTheme } from "../businesses/industryThemes";
import type { BusinessProfile } from "../businesses/models";
import { bob, timestamp } from "../commerce/models";
import { Icon } from "../ui/Icon";
import { Alert, Button, Card } from "../ui/Primitives";
import type { PlanStatus } from "./PlanGate";
import planPhoto from "../assets/planes-khypupyme.jpg";

type Plan = components["schemas"]["PlanOption"];
type Payment = components["schemas"]["PaymentInfo"];
const outcomes: Record<string, string> = {
  pending: "Pago pendiente", approved: "Pago aprobado", declined: "Tarjeta rechazada",
  cancelled: "Pago cancelado", expired: "Intento vencido", refunded: "Pago reembolsado",
};
const period = (plan: Plan) => plan.months ? plan.months + " meses calendario" : plan.days + " días";
const cardLabel = (card: Payment["card"]) => card.brand + " · •••• " + card.lastFour;
const terminalMessage: Record<string, string> = {
  approved: "El pase se acreditó a este negocio.", declined: "Puedes iniciar otro intento con una tarjeta de demostración distinta.",
  cancelled: "Puedes volver a elegir un pase.", expired: "Genera un intento nuevo para continuar.", refunded: "Se retiró el tiempo restante de este pase.",
};

export function PlanPanel({ business, path, status, error, reload, back, enter, changed }: {
  business: BusinessProfile; path: string; status?: PlanStatus; error: string; reload: () => void;
  back: () => void; enter: () => void; changed: () => void;
}) {
  const [step, setStep] = useState<"plan" | "review" | "checkout">("plan");
  const [planId, setPlanId] = useState("");
  const [cardId, setCardId] = useState("");
  const [attemptId, setAttemptId] = useState("");
  const [result, setResult] = useState<Payment>();
  const [refund, setRefund] = useState("");
  const [trialReview, setTrialReview] = useState(false);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const theme = industryTheme(business.industry);
  const plan = status?.plans.find((option) => option.id === planId);
  const recent = status?.payments[0];
  const pending = status?.payments.find((item) => item.state === "pending");
  const persisted = status?.payments.find((item) => item.id === result?.id);
  const latest = result && (!persisted || (persisted.state === "pending" && result.state !== "pending")) ? result : persisted ?? recent;
  const current = pending && (pending.id !== latest?.id || latest?.state === "pending") ? pending : latest;
  const active = !!status?.active && !error;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setFailure("");
    setMessage("");
    try { await action(); }
    catch (failure) {
      setFailure(failure instanceof Error ? failure.message : "No se pudo confirmar el intento. Consulta el estado antes de repetir.");
      reload();
    } finally { setBusy(false); }
  }

  function begin() {
    if (!plan || !cardId) return;
    const id = attemptId || crypto.randomUUID();
    setAttemptId(id);
    void run(async () => {
      setResult(await change<Payment>(path + "/attempts", "POST", { id, planId, cardId }));
      setStep("plan");
      changed();
    });
  }

  function transition(payment: Payment, action: string) {
    void run(async () => {
      const updated = await change<Payment>(path + "/attempts/" + payment.id, "POST", { action });
      setResult(updated);
      setRefund("");
      changed();
    });
  }

  return <section className="plan-page" style={theme.style}>
    <header className="plan-banner">
      <span className="plan-business-icon"><Icon name={theme.icon} /></span>
      <div><span className="plan-demo">Demostración · Sin cargos</span><h1>Plan de {business.name}</h1>
        <p>{active && status?.accessUntil ? "Acceso vigente hasta " + timestamp(status.accessUntil) :
          status?.accessUntil ? "Último vencimiento · " + timestamp(status.accessUntil) : "Elige el acceso para este negocio."}</p>
      </div>
      <img className="plan-photo" src={planPhoto} alt="" />
    </header>
    <div className="inline-actions plan-navigation">
      <Button icon="back" variant="secondary" onClick={back}>Volver a mis negocios</Button>
      <Button variant="secondary" onClick={enter}>{active ? "Ir al negocio" : "Entrar en modo de consulta"}</Button>
    </div>
    {error && <Card><Alert tone="error">{error}</Alert><Button variant="secondary" onClick={reload}>Reintentar</Button></Card>}
    {(!status && !error) && <p role="status">Consultando vigencia y pases…</p>}
    {message && <Alert tone="success">{message}</Alert>}
    {failure && <Alert tone="error">{failure}</Alert>}
    {status && !error && <>
      {current && (current.state === "pending" || step === "plan") && <Card className="plan-payment">
        <div className="page-heading"><h2>{outcomes[current.state]}</h2><strong>{bob(current.amountMinor)}</strong></div>
        <p>{current.planName} · {cardLabel(current.card)}</p>
        {current.state === "pending" ? <>
          <p>Disponible hasta {timestamp(current.expiresAt)}. El intento se puede recuperar al volver.</p>
          <div className="inline-actions">
            <Button disabled={busy} onClick={() => transition(current, "confirm")}>Confirmar pago de prueba</Button>
            <Button variant="secondary" disabled={busy} onClick={() => transition(current, "cancel")}>Cancelar pago</Button>
            <Button variant="plain" disabled={busy} onClick={() => transition(current, "expire")}>Simular vencimiento</Button>
          </div>
        </> : <p role="status">{terminalMessage[current.state]}</p>}
      </Card>}
      {current?.state !== "pending" && step === "plan" && <>
        <Card className="plan-trial">
          <div><h2>Prueba gratuita · 30 días</h2>
            <p>{status.trialUntil ? "Activada hasta " + timestamp(status.trialUntil) :
              status.trialUsed ? "La cuenta ya usó su prueba." :
              !status.firstBusiness ? "Disponible en el primer negocio de la cuenta." :
              !status.emailVerified ? "Verifica tu correo para activar la prueba." : active ?
              "Disponible cuando termine tu acceso vigente." : "Una vez por cuenta, con correo verificado."}</p></div>
          <strong>{bob(0)}</strong>
          {status.firstBusiness && !status.trialUsed && status.emailVerified && !active &&
            (trialReview ? <div className="inline-actions"><Button variant="secondary" disabled={busy} onClick={() => setTrialReview(false)}>Volver</Button>
              <Button disabled={busy} onClick={() => void run(async () => {
                await change(path + "/trial", "POST");
                setTrialReview(false);
                setMessage("Prueba activada por 30 días.");
                changed();
              })}>Confirmar prueba gratuita</Button></div> :
              <Button disabled={busy} onClick={() => setTrialReview(true)}>Activar prueba</Button>)}
        </Card>
        <h2>Elige un pase</h2>
        <div className="plan-choices">
          {status.plans.map((option) => <Card className={option.id === "1-year" ? "plan-option plan-option--annual" : "plan-option"} key={option.id}>
            <h3>{option.name}</h3>
            <strong className="plan-price">{bob(option.amountMinor)}</strong>
            {option.savingMinor > 0 && <span>Ahorra {bob(option.savingMinor)} frente a pases de 30 días</span>}
            <span>Vigencia estimada hasta {timestamp(option.estimatedEnd)}</span>
            <Button variant="secondary" disabled={busy} onClick={() => {
              setPlanId(option.id); setCardId(""); setAttemptId(""); setResult(undefined); setFailure(""); setStep("review");
            }}>Elegir {option.name}</Button>
          </Card>)}
        </div>
        <p className="plan-note">Todos los pases habilitan las mismas herramientas. La renovación es manual por negocio.</p>
      </>}
      {current?.state !== "pending" && plan && step !== "plan" && <Card className="plan-checkout">
        <div className="page-heading"><h2>{step === "review" ? "Revisar pase" : "Pago con tarjeta de demostración"}</h2>
          <strong>{bob(plan.amountMinor)}</strong></div>
        <dl className="business-summary">
          <dt>Negocio</dt><dd>{business.name}</dd><dt>Periodo</dt><dd>{period(plan)}</dd>
          <dt>Vigencia estimada hasta</dt><dd>{timestamp(plan.estimatedEnd)}</dd>
        </dl>
        {step === "checkout" && <fieldset className="demo-cards">
          <legend>Tarjetas de ejemplo</legend>
          {status.cards.map((card) => <label className="demo-card" key={card.id}>
            <input type="radio" name="demo-card" value={card.id} checked={cardId === card.id}
              disabled={busy || !!attemptId} onChange={() => setCardId(card.id)} />
            <span><strong>{cardLabel(card)}</strong><small>{card.testResult === "approved" ? "Prueba de aprobación" : "Prueba de rechazo"}</small></span>
          </label>)}
        </fieldset>}
        <div className="inline-actions">
          <Button variant="secondary" disabled={busy} onClick={() => {
            setAttemptId(""); setStep(step === "checkout" ? "review" : "plan");
          }}>Volver</Button>
          {step === "review" ? <Button onClick={() => setStep("checkout")}>Continuar al pago</Button> :
            <Button disabled={busy || !cardId} onClick={begin}>Preparar pago de prueba</Button>}
        </div>
      </Card>}
      {status.payments.length > 0 && <Card>
        <h2>Historial de pagos de demostración</h2>
        <ul className="plan-history">
          {status.payments.map((payment) => <li key={payment.id}>
            <div><strong>{payment.planName} · {bob(payment.amountMinor)}</strong><small>{outcomes[payment.state]} · {cardLabel(payment.card)}</small>
              {payment.accessUntil && payment.state === "approved" && <small>Vigente hasta {timestamp(payment.accessUntil)}</small>}</div>
            {payment.state === "approved" && (refund === payment.id ?
              <div className="inline-actions"><Button variant="plain" disabled={busy} onClick={() => setRefund("")}>Volver</Button>
                <Button disabled={busy} onClick={() => transition(payment, "refund")}>Confirmar reembolso de prueba</Button></div> :
              <Button variant="secondary" disabled={busy} onClick={() => setRefund(payment.id)}>Simular reembolso</Button>)}
          </li>)}
        </ul>
      </Card>}
    </>}
  </section>;
}
