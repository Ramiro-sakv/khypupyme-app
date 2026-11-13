import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { DAY_MS, PASS_DAYS, TRIAL_DAYS } from "../../../shared/workspace/billing";
import type { BusinessPlan, PaymentIntent } from "../../../shared/workspace/billing";
import { useAuth } from "../auth/auth-context";
import { errorMessage } from "../../shared/errors";
import { bob, localDate } from "../workspace/format";
import { useWorkspace } from "../workspace/context";
import { playBilling } from "./play";
import { isBillingSimulation } from "./profile";

const date = (value: number) => localDate(new Date(value).toISOString(), true);
const labels = {
  unavailable: "Entorno de desarrollo", "trial-available": "Prueba disponible", trial: "Prueba activa",
  active: "Acceso activo", expired: "Modo de consulta",
};

export function BusinessPlanBanner({ plan, error, refresh }: { plan: BusinessPlan | null; error: string; refresh: () => void }) {
  if (error) return <div className="notice notice-warning" role="status">{error} <button onClick={refresh}>Consultar plan</button></div>;
  if (!plan || plan.status === "unavailable") return null;
  const remaining = plan.expiresAt ? Math.ceil((plan.expiresAt - plan.serverTime) / DAY_MS) : null;
  return <div className={`notice ${remaining !== null && remaining <= 7 || plan.status === "expired" ? "notice-warning" : "notice-info"}`} role="status">
    <strong>{labels[plan.status]}</strong>{" "}
    {plan.expiresAt && <span>{plan.status === "expired" ? "Venció el " : "Vence el "}{date(plan.expiresAt)}{remaining === 1 ? " · queda un día" : remaining !== null && remaining > 0 && remaining <= 7 ? ` · quedan ${remaining} días` : ""}</span>}
    {plan.status === "expired" && <span>Puedes consultar y exportar tus registros.</span>}{" "}
    <Link to="?vista=negocio#plan-negocio">Ver plan</Link>
  </div>;
}

export default function BusinessPlanPanel({ qrOnly = false }: { qrOnly?: boolean }) {
  const { business, repository, billing } = useWorkspace();
  const { service } = useAuth();
  const plan = billing?.plan;
  const callable = repository.billing?.bind(repository);
  const android = import.meta.env.VITE_RUNTIME_TARGET === "android";
  const windows = import.meta.env.VITE_RUNTIME_TARGET === "windows";
  const playEnabled = !!plan?.channels.includes("play") && android;
  const qrEnabled = !!plan?.channels.includes("qr") && !android;
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [price, setPrice] = useState("");
  const [priceAttempt, setPriceAttempt] = useState(0);
  const [priceError, setPriceError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const running = useRef(false);

  useEffect(() => {
    if (!playEnabled) return;
    let current = true;
    playBilling.price().then((result) => { if (current) { setPrice(result.formatted); setPriceError(""); } },
      () => { if (current) setPriceError("Google Play no pudo cargar el precio. Abre la app desde Google Play y vuelve a entrar."); });
    return () => { current = false; };
  }, [playEnabled, priceAttempt]);

  if (!billing || !callable || plan?.status === "unavailable") return null;
  const { refresh } = billing;
  const checkoutOrigin = import.meta.env.VITE_KHYPU_CHECKOUT_ORIGIN as string | undefined;
  const externalCheckout = windows && !!checkoutOrigin;
  async function execute(action: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setWorking(true);
    setError("");
    setFeedback("");
    try { await action(); }
    catch (cause) { setError(errorMessage(cause, "No se pudo completar la solicitud. Consulta antes de repetir el pago.")); }
    finally { running.current = false; setWorking(false); }
  }
  function displayPayment(payment: PaymentIntent) {
    if (payment.businessId !== business.id) {
      setFeedback("Esta compra corresponde a otro negocio de tu cuenta. Consulta su plan para ver la vigencia.");
      return;
    }
    setIntent(payment);
    if (payment.status === "paid") setFeedback("Pago confirmado. El acceso se actualizó.");
    if (payment.status === "pending") setFeedback(payment.qrImage ? "Escanea el QR desde tu banca móvil y consulta el pago." : "El proveedor todavía no confirma el pago.");
    if (payment.status === "expired") setFeedback("La solicitud venció. Puedes volver a consultar o generar otra.");
    if (payment.status === "refunded") setFeedback("El pago fue devuelto y su vigencia fue actualizada.");
    refresh();
  }

  return <section className="card" id="plan-negocio">
    <h2>{qrOnly ? `Pago de ${business.name}` : "Plan del negocio"}</h2>
    {plan && <p><strong>{labels[plan.status]}</strong>{plan.expiresAt ? ` · ${plan.status === "expired" ? "Venció" : "Vence"} el ${date(plan.expiresAt)}` : ""}</p>}
    {billing.error && <p role="alert">{billing.error} <button onClick={refresh}>Reintentar</button></p>}
    {!plan && !billing.error && <p role="status">Consultando el plan…</p>}
    {plan && <p>{PASS_DAYS} días de acceso · renovación manual{!android ? ` · ${bob(plan.priceMinor)}` : ""}</p>}
    {!qrOnly && plan?.status === "trial-available" && <div className="actions">
      {!plan.emailVerified && service.verifyEmail && <button disabled={working} onClick={() => void execute(async () => {
        const verified = await service.verifyEmail!();
        setFeedback(verified ? "Correo confirmado. Ya puedes activar la prueba." : "Enlace enviado. Después de verificar tu correo, vuelve a este botón.");
        refresh();
      })}>Verificar correo</button>}
      <button className="primary" disabled={working || !plan.emailVerified} onClick={() => void execute(async () => {
        await callable<BusinessPlan>({ kind: "activate", businessId: business.id });
        setFeedback("Prueba activada.");
        refresh();
      })}>Activar prueba de {TRIAL_DAYS} días</button>
    </div>}
    {playEnabled && <div className="actions">
      <button className="primary" disabled={working || !price} onClick={() => void execute(async () => {
        const checkout = await callable<PaymentIntent>({ kind: "start", businessId: business.id, channel: "play" });
        const result = await playBilling.buy({ intentId: checkout.id });
        if (result.status === "cancelled") { setFeedback("Compra cancelada."); return; }
        if (!result.token) { setFeedback("Compra pendiente. Consulta su estado antes de repetirla."); return; }
        displayPayment(await callable<PaymentIntent>({ kind: "restore-play", purchaseToken: result.token }));
      })}>{price ? `Comprar 30 días · ${price}` : "Cargando precio de Google Play…"}</button>
      <button disabled={working} onClick={() => void execute(async () => {
        const { purchases } = await playBilling.pending();
        if (!purchases.length) setFeedback("Google Play no tiene compras por confirmar en este dispositivo.");
        for (const purchase of purchases)
          displayPayment(await callable<PaymentIntent>({ kind: "restore-play", purchaseToken: purchase.token }));
        refresh();
      })}>Consultar compras de Google Play</button>
    </div>}
    {isBillingSimulation && !qrOnly && plan?.status === "trial" && <div className="actions">
      <button type="button" disabled={working} onClick={() => void execute(async () => {
        await callable<BusinessPlan>({ kind: "simulate-trial-expiry", businessId: business.id });
        setFeedback("La prueba ficticia venció. Puedes revisar el modo de consulta.");
        refresh();
      })}>Simular fin de la prueba</button>
    </div>}
    {plan?.status === "expired" && <p>Puedes consultar el historial, descargar tus datos y cerrar una caja abierta.</p>}
    {priceError && <p className="notice notice-warning" role="status">{priceError} <button onClick={() => setPriceAttempt((n) => n + 1)}>Consultar precio</button></p>}
    {qrEnabled && externalCheckout && <button className="primary" disabled={working} onClick={() => void execute(async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_checkout", { businessId: business.id });
      setFeedback("Completa el pago en el navegador. Al volver, consulta el plan.");
    })}>Abrir pago por QR</button>}
    {qrEnabled && !externalCheckout && <div className="actions">
      <button disabled={working} onClick={() => void execute(async () => {
        displayPayment(await callable<PaymentIntent>({ kind: "start", businessId: business.id, channel: "qr" }));
      })}>{intent?.status === "pending" ? "Recuperar QR pendiente" : "Generar QR"}</button>
      <button disabled={working} onClick={() => void execute(async () => {
        const payment = intent ? await callable<PaymentIntent>({ kind: "check", businessId: business.id, intentId: intent.id })
          : await callable<PaymentIntent | null>({ kind: "current-qr", businessId: business.id });
        if (payment) displayPayment(payment);
        else setFeedback("Este negocio no tiene un QR reciente.");
      })}>Consultar pago</button>
    </div>}
    {isBillingSimulation && intent?.channel === "qr" && ["pending", "paid"].includes(intent.status) && <div className="notice">
      <p>Simulación local · sin cobro real</p>
      {(intent.status === "paid" ? [{ label: "Simular reembolso", outcome: "refunded" }] as const
        : [{ label: "Simular pago", outcome: "paid" }, { label: "Simular vencimiento", outcome: "expired" }] as const).map(({ label, outcome }) =>
          <button key={outcome} type="button" disabled={working} onClick={() => void execute(async () => {
            displayPayment(await callable<PaymentIntent>({ kind: "simulate-qr", businessId: business.id, intentId: intent.id, outcome }));
          })}>{label}</button>)}
    </div>}
    {intent?.qrImage && <img width="240" height="240" alt="Código QR para pagar el pase de KhypuPyme" src={intent.qrImage} />}
    {intent?.status === "pending" && intent.channel === "qr" && <p>Solicitud válida hasta {localDate(new Date(intent.expiresAt).toISOString(), true)}</p>}
    {feedback && <p role="status">{feedback}</p>}
    {error && <p className="notice notice-error" role="alert">{error}</p>}
  </section>;
}
