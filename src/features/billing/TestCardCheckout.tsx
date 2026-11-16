import { useEffect, useRef, useState } from "react";
import type { BillingRequest, PassOffer, PaymentIntent } from "../../../shared/workspace/billing";
import { errorMessage } from "../../shared/errors";
import { bob } from "../workspace/format";

type CardRequest = (request: BillingRequest) => Promise<PaymentIntent | null>;

export function TestCardCheckout({ businessId, offer, offers, request, refresh }: {
  businessId: string; offer: PassOffer | undefined; offers: PassOffer[]; request: CardRequest; refresh: () => void;
}) {
  const [payment, setPayment] = useState<PaymentIntent | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [decline, setDecline] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const running = useRef(false);

  useEffect(() => {
    let current = true;
    request({ kind: "current-card-test", businessId }).then(
      (result) => { if (current) { setPayment(result); setStatus("ready"); } },
      () => { if (current) setStatus("error"); },
    );
    return () => { current = false; };
  }, [request, businessId, attempt]);

  async function send(input: BillingRequest) {
    if (running.current) return;
    running.current = true;
    setWorking(true);
    setError("");
    try {
      const result = await request(input);
      setPayment(result);
      if (result?.status === "paid" || result?.status === "refunded") refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      running.current = false;
      setWorking(false);
    }
  }

  const pending = payment?.status === "pending";
  const paid = payment?.status === "paid";
  const pass = offers.find(({ id }) => id === (payment?.passId ?? "30-days"));
  const simulate = (outcome: "paid" | "declined" | "expired" | "refunded") => {
    if (payment) void send({ kind: "simulate-card", businessId, intentId: payment.id, outcome });
  };
  return <section className="card-test-checkout" aria-label="Pagar con tarjeta de prueba" aria-busy={working}>
    <div className="card-test-visual" aria-hidden="true"><span>KhypuPyme</span><strong>•••• 0426</strong><span>Tarjeta de prueba</span></div>
    <div className="card-test-details">
      <h3>Pagar con tarjeta de prueba</h3>
      <p>Elige una tarjeta ficticia para probar el cobro. Aquí no se ingresan datos bancarios.</p>
      {status === "loading" && <p role="status">Consultando pagos de prueba…</p>}
      {status === "error" && <p role="alert">No se pudo consultar el pago. <button type="button" onClick={() => { setStatus("loading"); setAttempt(attempt + 1); }}>Reintentar</button></p>}
      {status === "ready" && payment && <p role="status"><strong>{pending ? "Pendiente" : paid ? "Pago ficticio confirmado" : payment.status === "refunded" ? "Reembolso simulado" : "Solicitud cerrada"}</strong> · {pass?.label} · {bob(payment.priceMinor)}</p>}
      {status === "ready" && pending && <label>Resultado de la tarjeta de prueba
        <select value={decline ? "declined" : "paid"} disabled={working} onChange={(event) => setDecline(event.target.value === "declined")}>
          <option value="paid">Aprobar</option><option value="declined">Rechazar</option>
        </select>
      </label>}
      {status === "ready" && <div className="actions">
        {pending ? <>
          <button type="button" className="primary" disabled={working} onClick={() => simulate(decline ? "declined" : "paid")}>Confirmar {bob(payment.priceMinor)} de prueba</button>
          <button type="button" disabled={working} onClick={() => simulate("expired")}>Cancelar solicitud</button>
        </> : <button type="button" className="primary" disabled={working || !offer} onClick={() => {
          if (offer) void send({ kind: "start", businessId, channel: "card-test", passId: offer.id });
        }}>{offer ? `Revisar pago · ${bob(offer.priceMinor)}` : "Elige un pase"}</button>}
        {paid && <button type="button" disabled={working} onClick={() => simulate("refunded")}>Simular reembolso</button>}
        {payment && <button type="button" disabled={working} onClick={() => void send({ kind: "check", businessId, intentId: payment.id })}>Consultar tarjeta</button>}
      </div>}
      {error && <p className="notice notice-error" role="alert">{error}</p>}
    </div>
  </section>;
}
