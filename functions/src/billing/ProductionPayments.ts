import { timingSafeEqual } from "node:crypto";
import { AppError } from "../../../shared/app-errors.js";
import { PLAY_PRODUCTS } from "../../../shared/workspace/billing.js";
import type { PaymentProviders, QrCheckout, VerifiedPayment } from "./providers.js";

const invalid = () => new AppError("El proveedor devolvió una referencia de pago inválida.", 409, "BILLING_PROVIDER_DATA");
const unavailable = () => new AppError("No se pudo consultar el proveedor. Revisa el pago antes de repetirlo.", 503, "BILLING_PROVIDER");
const publisher = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";
type Payload = Record<string, unknown>;
const data = (value: unknown): Payload => value && typeof value === "object" ? value as Payload : {};
const amountMatches = (value: unknown, minor: number) =>
  /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(String(value)) && Math.round(Number(value) * 100) === minor;
const bolivianTime = (value: unknown) => typeof value === "string"
  ? Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : value + "-04:00") : NaN;
const secretMatch = (received: string, expected: string) =>
  !!expected && Buffer.byteLength(received) === Buffer.byteLength(expected) &&
  timingSafeEqual(Buffer.from(received), Buffer.from(expected));

async function json(url: string, init?: RequestInit): Promise<Payload> {
  try {
    const response = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(9000) });
    if (!response.ok) throw unavailable();
    const body = await response.text();
    return body ? data(JSON.parse(body)) : {};
  } catch {
    throw unavailable();
  }
}

class RedEnlace {
  private auth?: { token: string; expires: number };
  private readonly base: string;
  constructor(
    base: string, private readonly basic: string, private readonly clientId: string,
    private readonly establishmentId: number, private readonly establishmentName: string,
    private readonly webhook: string, private readonly webhookSecret: string,
  ) {
    this.base = base.replace(/\/+$/, "");
  }

  private async headers() {
    if (!this.auth || this.auth.expires <= Date.now()) {
      const response = await json(this.base + "/oauth-client-credentials/access-token?grant_type=client_credentials", {
        method: "POST", headers: { Authorization: "Basic " + this.basic, "Content-Type": "application/x-www-form-urlencoded" },
      });
      if (typeof response.access_token !== "string" || !response.access_token) throw unavailable();
      this.auth = { token: response.access_token, expires: Date.now() + Math.max(0, Number(response.expires_in) - 30) * 1000 };
    }
    return { access_token: this.auth.token, client_id: this.clientId, "Content-Type": "application/json" };
  }

  async create(id: string, amountMinor: number, expiresAt: number): Promise<QrCheckout> {
    const response = await json(this.base + "/qr/simple/v2/generate", {
      method: "POST", headers: await this.headers(),
      body: JSON.stringify({
        glosa: "KhypuPyme · 30 días", moneda: "BOB", monto: amountMinor / 100, numeroReferencia: id,
        vigencia: Math.max(1, Math.floor((expiresAt - Date.now()) / 1000)),
        idEstablecimiento: this.establishmentId, nombreEstablecimiento: this.establishmentName,
        webhook: { url: this.webhook, key: "x-khypu-webhook", value: this.webhookSecret },
      }),
    });
    const qr = data(response.data);
    const expires = bolivianTime(qr.fechaExpiracion);
    if (response.success !== true || qr.estado !== "PENDIENTE" || qr.numeroReferenciaOriginante !== id ||
        !amountMatches(qr.monto, amountMinor) || (qr.moneda !== undefined && qr.moneda !== "BOB") ||
        typeof qr.numeroReferencia !== "string" || !/^\d{1,40}$/.test(qr.numeroReferencia) ||
        typeof qr.qr !== "string" || !/^iVBORw0KGgo[A-Za-z0-9+/]+={0,2}$/.test(qr.qr) || qr.qr.length > 180_000 ||
        !Number.isFinite(expires) || expires <= Date.now() || expires > expiresAt + 60_000)
      throw invalid();
    return { reference: qr.numeroReferencia, image: "data:image/png;base64," + qr.qr, expiresAt: expires };
  }

  async check(id: string, reference: string, amountMinor: number): Promise<VerifiedPayment> {
    const response = await json(this.base + "/qr/simple/v2/verify/" + encodeURIComponent(reference), { headers: await this.headers() });
    const payment = data(response.data);
    if (response.success !== true || payment.numeroReferenciaOriginante !== id || payment.numeroReferencia !== reference ||
        payment.moneda !== "BOB" || !amountMatches(payment.importe, amountMinor))
      throw invalid();
    const state = String(payment.estado);
    const status = state === "PAGADO" ? "paid" : state === "PENDIENTE" ? "pending" :
      ["EXPIRADO", "CANCELADO"].includes(state) ? "expired" : null;
    if (!status) throw unavailable();
    const confirmedAt = bolivianTime(data(payment.bancoOrigen).fechaTransaccion);
    if (status === "paid" && !Number.isFinite(confirmedAt)) throw invalid();
    return { reference, intentId: id, channel: "qr", status, ...(status === "paid" ? { confirmedAt } : {}) };
  }
}

class GooglePlay {
  private access?: { token: string; expires: number };
  constructor(private readonly packageName: string, private readonly publisherAccount: string) {}
  private async headers() {
    if (!this.access || this.access.expires <= Date.now()) {
      const result = await json("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", {
        headers: { "Metadata-Flavor": "Google" },
      });
      if (typeof result.access_token !== "string" || !result.access_token) throw unavailable();
      const scoped = await json("https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/" +
        encodeURIComponent(this.publisherAccount) + ":generateAccessToken", {
        method: "POST", headers: { Authorization: "Bearer " + result.access_token, "Content-Type": "application/json" },
        body: JSON.stringify({ scope: ["https://www.googleapis.com/auth/androidpublisher"], lifetime: "900s" }),
      });
      const expires = Date.parse(String(scoped.expireTime));
      if (typeof scoped.accessToken !== "string" || !Number.isFinite(expires)) throw unavailable();
      this.access = { token: scoped.accessToken, expires: expires - 30_000 };
    }
    return { Authorization: "Bearer " + this.access.token };
  }
  private async lookup(token: string) {
    const response = await json(`${publisher}/${this.packageName}/purchases/productsv2/tokens/${encodeURIComponent(token)}`, { headers: await this.headers() });
    const lines: unknown[] = Array.isArray(response.productLineItem) ? response.productLineItem : [];
    const line = data(lines[0]);
    const intentId = response.obfuscatedExternalAccountId;
    if (lines.length !== 1 || (typeof line.productId !== "string" || !Object.values(PLAY_PRODUCTS).includes(line.productId)) || data(line.productOfferDetails).quantity !== 1 ||
        typeof intentId !== "string" || !/^[a-f0-9-]{36}$/.test(intentId)) throw invalid();
    return { response, line, intentId, productId: line.productId };
  }
  async check(token: string): Promise<VerifiedPayment> {
    const { response, line, intentId, productId } = await this.lookup(token);
    const state = data(response.purchaseStateContext).purchaseState;
    const status = state === "PENDING" ? "pending" :
      state === "CANCELLED" || (state === "PURCHASED" && data(line.productOfferDetails).refundableQuantity === 0) ? "refunded" :
      state === "PURCHASED" ? "paid" : null;
    if (!status) throw unavailable();
    const testing = process.env.KHYPU_BILLING_MODE === "staging";
    if (testing !== (data(response.testPurchaseContext).fopType === "TEST"))
      throw new AppError(testing ? "Usa una compra de prueba de Google Play." : "Esta compilación solo acepta pagos de producción.", 403, "BILLING_TEST_PURCHASE");
    const confirmedAt = Date.parse(String(response.purchaseCompletionTime));
    if (status === "paid" && !Number.isFinite(confirmedAt)) throw invalid();
    return { reference: token, intentId, channel: "play", status, productId, ...(status === "paid" ? { confirmedAt } : {}) };
  }
  async consume(token: string) {
    const { line, productId } = await this.lookup(token);
    if (data(line.productOfferDetails).consumptionState === "CONSUMPTION_STATE_CONSUMED") return;
    await json(`${publisher}/${this.packageName}/purchases/products/${productId}/tokens/${encodeURIComponent(token)}:consume`, {
      method: "POST", headers: await this.headers(),
    });
  }
}

const httpsUrl = (value: string) => {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new Error("La URL del proveedor requiere HTTPS.");
  return url.href;
};

export function productionPayments(env = process.env): PaymentProviders {
  const {
    KHYPU_PLAY_PACKAGE, KHYPU_PLAY_ACCOUNT, KHYPU_QR_BASE, KHYPU_QR_BASIC, KHYPU_QR_CLIENT, KHYPU_QR_ESTABLISHMENT,
    KHYPU_QR_NAME, KHYPU_QR_WEBHOOK, KHYPU_QR_WEBHOOK_SECRET,
  } = env;
  const play = KHYPU_PLAY_PACKAGE && /^[a-zA-Z][\w]*(?:\.[\w]+)+$/.test(KHYPU_PLAY_PACKAGE)
    && KHYPU_PLAY_ACCOUNT && /^[\w.-]+@[\w.-]+\.gserviceaccount\.com$/.test(KHYPU_PLAY_ACCOUNT)
    ? new GooglePlay(KHYPU_PLAY_PACKAGE, KHYPU_PLAY_ACCOUNT) : undefined;
  const establishment = Number(KHYPU_QR_ESTABLISHMENT);
  const qr = KHYPU_QR_BASE && KHYPU_QR_BASIC && KHYPU_QR_CLIENT && Number.isSafeInteger(establishment) && establishment > 0 &&
    KHYPU_QR_NAME && KHYPU_QR_WEBHOOK && KHYPU_QR_WEBHOOK_SECRET && KHYPU_QR_WEBHOOK_SECRET.length >= 32
    ? new RedEnlace(httpsUrl(KHYPU_QR_BASE), KHYPU_QR_BASIC, KHYPU_QR_CLIENT, establishment,
      KHYPU_QR_NAME, httpsUrl(KHYPU_QR_WEBHOOK), KHYPU_QR_WEBHOOK_SECRET) : undefined;
  return { channels: [...(play ? ["play" as const] : []), ...(qr ? ["qr" as const] : [])], ...(play ? { play } : {}), ...(qr ? { qr } : {}) };
}

export { secretMatch };
