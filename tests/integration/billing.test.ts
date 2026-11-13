import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { afterAll, expect, it } from "vitest";
import { BillingService } from "../../functions/src/billing/BillingService";
import type { PaymentProviders, VerifiedPayment } from "../../functions/src/billing/providers";
import { requestAccountDeletion } from "../../functions/src/billing/AccountDeletionRequest";
import { exportBusiness } from "../../functions/src/billing/exportBusiness";
import { WorkspaceService } from "../../functions/src/workspace/WorkspaceService";
import { AccountService } from "../../functions/src/workspace/AccountService";
import { DEFAULT_ANSWERS } from "../../shared/workspace/catalog";
import { DAY_MS } from "../../shared/workspace/billing";
import { requireTestEmulators, testProjectId } from "../emulator-environment";

requireTestEmulators();
const requireFunctions = createRequire(new URL("../../functions/package.json", import.meta.url));
const { deleteApp, initializeApp } = requireFunctions("firebase-admin/app");
const { getFirestore } = requireFunctions("firebase-admin/firestore");
const app = initializeApp({ projectId: testProjectId }, "billing-" + randomUUID());
const db = getFirestore(app);
afterAll(() => deleteApp(app));

it("prueba única, expiración, consulta, descarga, cierre y aislamiento", async () => {
  let now = Date.now() - 20 * DAY_MS;
  const owner = randomUUID(), outsider = randomUUID();
  const account = new AccountService(db);
  const first = await account.create(owner, { operationId: randomUUID(), name: "Barraca de revisión", industryId: "timber", answers: DEFAULT_ANSWERS });
  const second = await account.create(owner, { operationId: randomUUID(), name: "Tienda de revisión", industryId: "convenience", answers: DEFAULT_ANSWERS });
  const billing = new BillingService(db, { channels: [] }, () => now);
  await expect(billing.activate(owner, second.id, true)).rejects.toMatchObject({ appCode: "BILLING_TRIAL_USED" });
  await expect(billing.activate(outsider, first.id, true)).rejects.toMatchObject({ appCode: "BILLING_OWNER" });
  await expect(billing.activate(owner, first.id, false)).rejects.toMatchObject({ appCode: "BILLING_EMAIL" });
  const trial = await billing.activate(owner, first.id, true);
  expect(trial).toMatchObject({ status: "trial", expiresAt: now + 14 * DAY_MS });
  now += DAY_MS;
  expect((await billing.activate(owner, first.id, true)).expiresAt).toBe(trial.expiresAt);
  const billingClock = new BillingService(db, { channels: [] });
  expect((await billingClock.plan(owner, first.id, true)).status).toBe("expired");
  const commands = new WorkspaceService(db, undefined, true);
  const demo = new WorkspaceService(db);
  const open = { apiVersion: 2, businessId: first.id, operationId: randomUUID(), kind: "open-cash", input: { amountMinor: 0 } };
  await expect(commands.execute(owner, open)).rejects.toMatchObject({ appCode: "BUSINESS_PLAN_REQUIRED" });
  await demo.execute(owner, open);
  expect(await commands.execute(owner, open)).toMatchObject({ id: open.operationId });
  const close = { ...open, operationId: randomUUID(), kind: "close-cash", input: { countedMinor: 0, reason: "" } };
  expect(await commands.execute(owner, close)).toHaveProperty("documentId");
  await expect(commands.execute(owner, { ...close, operationId: randomUUID() })).rejects.toThrow();
  expect(await exportBusiness(db, owner, first.id, "cashSessions", "")).toMatchObject({ items: [{ status: "closed" }] });
  expect(await exportBusiness(db, owner, first.id, "documentsV2", "")).toMatchObject({ items: [{ title: expect.any(String) }] });
  await expect(exportBusiness(db, outsider, first.id, "documentsV2", "")).rejects.toMatchObject({ appCode: "EXPORT_OWNER" });
  const requested = await requestAccountDeletion(db, owner, Math.floor(Date.now() / 1000));
  expect(await requestAccountDeletion(db, owner, Math.floor(Date.now() / 1000))).toEqual(requested);
});

it("QR y Play acreditan una vez, se recuperan y revierten solo su vigencia", async () => {
  let now = Date.now();
  const owner = randomUUID(), stranger = randomUUID();
  const account = new AccountService(db);
  const first = await account.create(owner, { operationId: randomUUID(), name: "Tienda de pagos", industryId: "convenience", answers: DEFAULT_ANSWERS });
  const second = await account.create(owner, { operationId: randomUUID(), name: "Otro negocio", industryId: "timber", answers: DEFAULT_ANSWERS });
  const playEvent: VerifiedPayment = { reference: "", intentId: "", channel: "play", status: "paid" };
  let qrState: VerifiedPayment["status"] = "pending";
  let unavailable = true;
  const providers: PaymentProviders = {
    channels: ["qr", "play"],
    qr: {
      async create(id, _amount, expiresAt) { return { reference: "qr-" + id, image: "demo", expiresAt }; },
      async check(id, reference) { return { reference, intentId: id, channel: "qr", status: qrState, confirmedAt: now }; },
    },
    play: {
      async check() { return playEvent; },
      async consume() { if (unavailable) throw new Error("respuesta interrumpida"); },
    },
  };
  const billing = new BillingService(db, providers, () => now);
  const qr = await billing.start(owner, first.id, "qr");
  expect((await billing.start(owner, first.id, "qr")).id).toBe(qr.id);
  expect((await billing.currentQr(owner, first.id))?.status).toBe("pending");
  await expect(billing.check(owner, second.id, qr.id)).rejects.toMatchObject({ appCode: "BILLING_OWNER" });
  now = qr.expiresAt;
  await expect(billing.start(owner, first.id, "qr")).rejects.toMatchObject({ appCode: "BILLING_QR_PENDING" });
  qrState = "expired";
  expect((await billing.currentQr(owner, first.id))?.status).toBe("expired");
  const renewed = await billing.start(owner, first.id, "qr");
  expect(renewed.id).not.toBe(qr.id);
  qrState = "paid";
  await Promise.all([billing.currentQr(owner, first.id), billing.currentQr(owner, first.id)]);
  expect((await billing.plan(owner, first.id, true)).expiresAt).toBe(now + 30 * DAY_MS);
  const play = await billing.start(owner, first.id, "play");
  Object.assign(playEvent, { reference: "play-" + randomUUID(), intentId: play.id, confirmedAt: now });
  await expect(billing.restorePlay(stranger, playEvent.reference)).rejects.toMatchObject({ appCode: "BILLING_OWNER" });
  await expect(billing.restorePlay(owner, playEvent.reference)).rejects.toThrow("interrumpida");
  const secondDevice = new BillingService(db, providers, () => now);
  expect((await secondDevice.plan(owner, first.id, true)).expiresAt).toBe(now + 60 * DAY_MS);
  expect((await secondDevice.plan(owner, second.id, true)).status).toBe("expired");
  unavailable = false;
  expect((await secondDevice.restorePlay(owner, playEvent.reference)).status).toBe("paid");
  expect((await secondDevice.plan(owner, first.id, true)).expiresAt).toBe(now + 60 * DAY_MS);
  await secondDevice.refundPlay(playEvent.reference);
  await secondDevice.record(playEvent);
  expect((await billing.plan(owner, first.id, true)).expiresAt).toBe(now + 30 * DAY_MS);
  await billing.refundQr("qr-" + renewed.id, "operador-ficticio", "comprobante de revisión");
  await billing.refundQr("qr-" + renewed.id, "operador-ficticio", "comprobante de revisión");
  expect((await billing.plan(owner, first.id, true)).status).toBe("expired");
});
