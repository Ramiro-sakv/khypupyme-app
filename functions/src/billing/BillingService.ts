import { createHash, randomUUID } from "node:crypto";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { AppError } from "../../../shared/app-errors.js";
import {
  creditPeriod, PASS_DAYS, PASS_PRICE_MINOR, reversePeriod, TRIAL_DAYS,
} from "../../../shared/workspace/billing.js";
import type { BusinessPlan, PaymentChannel, PaymentIntent } from "../../../shared/workspace/billing.js";
import { identifier } from "../../../shared/workspace/validation.js";
import { licensePath, trialPath } from "./access.js";
import type { License } from "./access.js";
import type { PaymentProviders, VerifiedPayment } from "./providers.js";

const MINUTE = 60_000;
const intentPath = (id: string) => `billingIntents/${id}`;
const pendingPath = (businessId: string, channel: PaymentChannel) => `businessLicenses/${businessId}/checkout/${channel}`;
const receiptPath = (event: VerifiedPayment) => "billingReceipts/" + createHash("sha256")
  .update(event.channel + ":" + event.reference).digest("hex");

interface Trial { businessId: string; activatedAt: number }
interface Checkout extends PaymentIntent {
  ownerUid: string;
  createdAt: number;
  qrReference?: string;
  qrRequestedAt?: number;
}
interface Receipt {
  intentId: string;
  ownerUid: string;
  businessId: string;
  state: "paid" | "refunded";
}
const publicIntent = ({ id, businessId, channel, status, priceMinor, expiresAt, qrImage }: Checkout): PaymentIntent =>
  ({ id, businessId, channel, status, priceMinor, expiresAt, ...(qrImage && status === "pending" ? { qrImage } : {}) });

export class BillingService {
  constructor(
    private readonly db: Firestore,
    private readonly providers: PaymentProviders,
    private readonly now = Date.now,
  ) {}

  private async business(uid: string, businessId: string, tx?: Transaction) {
    const ref = this.db.doc("businesses/" + identifier(businessId));
    const snapshot = await (tx ? tx.get(ref) : ref.get());
    const data = snapshot.data();
    if (!data || data.ownerUid !== uid || data.tutorialSessionId || data.deletionPending)
      throw new AppError("El negocio no está disponible para esta cuenta.", 403, "BILLING_OWNER");
    return data;
  }

  async plan(uid: string, businessId: string, emailVerified: boolean): Promise<BusinessPlan> {
    await this.business(uid, businessId);
    const [license, trial, account] = await this.db.getAll(
      this.db.doc(licensePath(businessId)), this.db.doc(trialPath(uid)), this.db.doc("users/" + uid),
    );
    const serverTime = this.now();
    const periods = (license?.data() as License | undefined)?.periods ?? [];
    const first = account?.get("firstBusinessId") ?? (await this.db.collection("users/" + uid + "/businesses").orderBy("createdAt").limit(1).get()).docs[0]?.id;
    const active = periods.find((period) => period.startsAt <= serverTime && serverTime < period.endsAt);
    const status = active ? (active.id === "trial" ? "trial" : "active")
      : !license?.exists && !trial?.exists && (!first || first === businessId) ? "trial-available" : "expired";
    return {
      status, expiresAt: periods.at(-1)?.endsAt ?? null,
      serverTime, emailVerified, channels: this.providers.channels, priceMinor: PASS_PRICE_MINOR,
    };
  }

  async activate(uid: string, businessId: string, emailVerified: boolean) {
    if (!emailVerified) throw new AppError("Verifica el correo antes de activar la prueba.", 403, "BILLING_EMAIL");
    const account = this.db.doc("users/" + uid);
    const trial = this.db.doc(trialPath(uid));
    const license = this.db.doc(licensePath(businessId));
    await this.db.runTransaction(async (tx) => {
      await this.business(uid, businessId, tx);
      const [used, plan, profile] = await tx.getAll(trial, license, account);
      if (used?.get("businessId") === businessId) return;
      const older = profile?.get("firstBusinessId") ? null : await tx.get(account.collection("businesses").orderBy("createdAt").limit(1));
      const first = profile?.get("firstBusinessId") ?? older?.docs[0]?.id;
      if (used?.exists || (first && first !== businessId))
        throw new AppError("La prueba se ofrece una vez por cuenta, en el primer negocio.", 409, "BILLING_TRIAL_USED");
      if (plan?.exists) throw new AppError("Este negocio ya tiene un plan registrado.", 409, "BILLING_PLAN_EXISTS");
      const now = this.now();
      if (!profile?.get("firstBusinessId")) tx.set(account, { firstBusinessId: businessId }, { merge: true });
      tx.create(trial, { businessId, activatedAt: now } satisfies Trial);
      tx.set(license, { ownerUid: uid, periods: creditPeriod([], "trial", now, TRIAL_DAYS) } satisfies License);
    });
    return this.plan(uid, businessId, true);
  }

  async start(uid: string, businessId: string, channel: PaymentChannel): Promise<PaymentIntent> {
    if (!this.providers.channels.includes(channel))
      throw new AppError("Este medio de pago todavía no está disponible.", 503, "BILLING_CHANNEL");
    const pointer = this.db.doc(pendingPath(businessId, channel));
    if (channel === "qr") {
      await this.business(uid, businessId);
      const pending = (await pointer.get()).get("id");
      if (typeof pending === "string") {
        const previous = await this.ownedIntent(uid, pending);
        if (previous.status === "pending" && previous.qrReference && previous.expiresAt <= this.now()) {
          const checked = await this.check(uid, businessId, pending);
          if (checked.status === "paid") return checked;
          if (checked.status === "pending")
            throw new AppError("El proveedor todavía no confirma el vencimiento de este QR. Consulta su estado.", 503, "BILLING_QR_PENDING");
        }
      }
    }
    const freshId = randomUUID();
    const checkout = await this.db.runTransaction(async (tx) => {
      await this.business(uid, businessId, tx);
      const pending = (await tx.get(pointer)).get("id");
      const existing = typeof pending === "string" ? (await tx.get(this.db.doc(intentPath(pending)))).data() as Checkout | undefined : undefined;
      const now = this.now();
      if (existing?.ownerUid === uid && existing.status === "pending" &&
          (existing.expiresAt > now || (channel === "qr" && existing.qrReference))) return existing;
      const next: Checkout = {
        id: freshId, ownerUid: uid, businessId, channel, status: "pending", priceMinor: PASS_PRICE_MINOR,
        createdAt: now, expiresAt: now + 15 * MINUTE,
      };
      tx.create(this.db.doc(intentPath(freshId)), next);
      tx.set(pointer, { id: freshId });
      return next;
    });
    if (channel !== "qr" || checkout.qrReference || !this.providers.qr) return publicIntent(checkout);
    const ref = this.db.doc(intentPath(checkout.id));
    const lease = await this.db.runTransaction(async (tx) => {
      const current = (await tx.get(ref)).data() as Checkout;
      if (current.qrReference || current.qrRequestedAt) return null;
      tx.update(ref, { qrRequestedAt: this.now() });
      return true;
    });
    if (lease === null) return publicIntent((await ref.get()).data() as Checkout);
    // No se vuelve a emitir un QR de resultado incierto. El intento sigue consultable.
    const qr = await this.providers.qr.create(checkout.id, checkout.priceMinor, checkout.expiresAt);
    return this.db.runTransaction(async (tx) => {
      const latest = (await tx.get(ref)).data() as Checkout;
      if (latest.qrReference && latest.qrReference !== qr.reference)
        throw new AppError("El QR recibido no coincide con la solicitud.", 409, "BILLING_REFERENCE");
      const update = { qrReference: qr.reference, qrImage: qr.image, expiresAt: qr.expiresAt };
      tx.update(ref, update);
      return publicIntent({ ...latest, ...update });
    });
  }

  async currentQr(uid: string, businessId: string) {
    await this.business(uid, businessId);
    const id = (await this.db.doc(pendingPath(businessId, "qr")).get()).get("id");
    return typeof id === "string" ? this.check(uid, businessId, id) : null;
  }

  async check(uid: string, businessId: string, intentId: string): Promise<PaymentIntent> {
    await this.business(uid, businessId);
    const checkout = await this.ownedIntent(uid, intentId);
    if (checkout.businessId !== businessId) throw new AppError("La solicitud pertenece a otro negocio.", 403, "BILLING_OWNER");
    if (checkout.channel === "qr" && checkout.qrReference && this.providers.qr) {
      const event = await this.providers.qr.check(checkout.id, checkout.qrReference, checkout.priceMinor);
      if (event) await this.record(event);
    }
    const current = await this.ownedIntent(uid, intentId);
    if (current.status === "pending" && current.expiresAt <= this.now() && current.channel === "qr" && !current.qrReference)
      return publicIntent({ ...current, status: "expired" });
    return publicIntent(current);
  }

  private async ownedIntent(uid: string, id: string) {
    const current = (await this.db.doc(intentPath(identifier(id))).get()).data() as Checkout | undefined;
    if (!current || current.ownerUid !== uid) throw new AppError("No tienes acceso a esta solicitud de pago.", 403, "BILLING_OWNER");
    return current;
  }

  async refundQr(reference: string, actor: string, evidence: string) {
    const lookup: VerifiedPayment = { reference, channel: "qr", intentId: "", status: "refunded" };
    const receipt = (await this.db.doc(receiptPath(lookup)).get()).data() as Receipt | undefined;
    if (!receipt) throw new AppError("No existe un cobro confirmado con esa referencia.", 404, "BILLING_REFERENCE");
    await this.record({ ...lookup, intentId: receipt.intentId }, false, { actor, evidence });
  }

  async refundPlay(token: string) {
    if (!this.providers.play) return;
    const receipt = await this.db.doc(receiptPath({ reference: token, channel: "play", intentId: "", status: "refunded" })).get();
    const known = receipt.data() as Receipt | undefined;
    const event = known ? { reference: token, channel: "play" as const, intentId: known.intentId } : await this.providers.play.check(token);
    await this.record({ ...event, status: "refunded" });
  }

  async restorePlay(uid: string, token: string) {
    if (!this.providers.play) throw new AppError("Google Play no está habilitado.", 503, "BILLING_CHANNEL");
    const event = await this.providers.play.check(token);
    const intent = await this.ownedIntent(uid, event.intentId);
    await this.business(uid, intent.businessId);
    await this.record(event);
    if (event.status === "paid" && (await this.ownedIntent(uid, event.intentId)).status === "paid")
      await this.providers.play.consume(token);
    return publicIntent(await this.ownedIntent(uid, event.intentId));
  }

  async reconcilePlay(token: string) {
    if (!this.providers.play) throw new AppError("Google Play no está habilitado.", 503, "BILLING_CHANNEL");
    const event = await this.providers.play.check(token);
    await this.record(event);
    if (event.status === "paid") {
      const checkout = (await this.db.doc(intentPath(event.intentId)).get()).get("status");
      if (checkout === "paid") await this.providers.play.consume(token);
    }
  }

  async reconcileQr(id: string, reference: string) {
    const intent = (await this.db.doc(intentPath(identifier(id))).get()).data() as Checkout | undefined;
    if (!intent || intent.channel !== "qr" || (intent.qrReference && intent.qrReference !== reference) || !this.providers.qr)
      throw new AppError("Referencia de cobro desconocida.", 404, "BILLING_REFERENCE");
    const event = await this.providers.qr.check(intent.id, reference, intent.priceMinor);
    if (event) await this.record(event, true);
  }

  async record(event: VerifiedPayment, reconcileUncertainQr = false, refundAudit?: { actor: string; evidence: string }): Promise<void> {
    const intent = this.db.doc(intentPath(identifier(event.intentId)));
    const receipt = this.db.doc(receiptPath(event));
    await this.db.runTransaction(async (tx) => {
      const [candidate, seen] = await tx.getAll(intent, receipt);
      const checkout = candidate?.data() as Checkout | undefined;
      const previous = seen?.data() as Receipt | undefined;
      if (!checkout || checkout.channel !== event.channel || (previous && previous.intentId !== checkout.id) ||
          (event.channel === "qr" && checkout.qrReference !== event.reference &&
            (!reconcileUncertainQr || checkout.qrReference || !checkout.qrRequestedAt)))
        throw new AppError("El pago no coincide con la solicitud original.", 409, "BILLING_REFERENCE");
      if (event.status === "pending" || previous?.state === "refunded" ||
          (!previous && checkout.status === "refunded" && event.status === "refunded")) return;
      if (event.status === "expired") {
        if (!previous && checkout.status === "pending") tx.update(intent, { status: "expired" });
        return;
      }
      if (event.status === "paid" && previous) return;
      if (event.status === "paid" && (checkout.status === "paid" || checkout.status === "refunded"))
        throw new AppError("Esta solicitud ya se usó con otro pago.", 409, "BILLING_REFERENCE");
      const license = this.db.doc(licensePath(checkout.businessId));
      const current = (await tx.get(license)).data() as License | undefined;
      const business = (await tx.get(this.db.doc("businesses/" + checkout.businessId))).data();
      const now = this.now();
      if (event.status === "paid" && (business?.ownerUid !== checkout.ownerUid || business.deletionPending))
        throw new AppError("El negocio ya no admite este pago. Solicita asistencia.", 409, "BILLING_OWNER");
      if (event.status === "paid" && (!event.confirmedAt || event.confirmedAt < checkout.createdAt - MINUTE || event.confirmedAt > now + MINUTE || (checkout.channel === "qr" && event.confirmedAt > checkout.expiresAt + MINUTE)))
        throw new AppError("La fecha del pago no coincide con la solicitud.", 409, "BILLING_REFERENCE");
      const periods = current?.periods ?? [];
      if (event.status === "paid" && periods.filter((period) => period.endsAt > now).length >= 120)
        throw new AppError("El negocio ya tiene demasiados periodos adelantados.", 409, "BILLING_PERIODS");
      if (event.status === "paid" || current) tx.set(license, {
        ownerUid: checkout.ownerUid,
        periods: event.status === "paid"
          ? creditPeriod(periods, receipt.id, now, PASS_DAYS)
          : reversePeriod(periods, receipt.id, now),
      } satisfies License);
      tx.set(receipt, {
        intentId: checkout.id, ownerUid: checkout.ownerUid, businessId: checkout.businessId,
        state: event.status, confirmedAt: event.confirmedAt ?? seen?.get("confirmedAt") ?? null, updatedAt: now,
        ...(refundAudit ? { refundAudit } : {}),
      });
      tx.update(intent, { status: event.status, ...(event.channel === "qr" ? { qrReference: event.reference } : {}) });
    });
  }
}
