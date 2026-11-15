import { getAuth } from "firebase-admin/auth";
import { emailKey, registrationKey, sendEmail } from "./auth/sendEmail.js";
import { BusinessDeletionService } from "./workspace/BusinessDeletionService.js";
import { randomUUID } from "node:crypto";
import { AppError } from "../../shared/app-errors.js";
import { SensitiveApprovalService, protectedOperation } from "./workspace/SensitiveApprovalService.js";
import { sensitiveAction } from "../../shared/workspace/protection.js";
import { TimberTutorialService } from "./workspace/TimberTutorialService.js";
import { AccountService } from "./workspace/AccountService.js";
import { WorkspaceService } from "./workspace/WorkspaceService.js";
import { WorkspaceQueries } from "./workspace/WorkspaceQueries.js";
import { canonical } from "../../shared/commerce.js";
import { validateWorkspaceCommand } from "../../shared/workspace/validation.js";
import {
  identifier,
  object,
  optionalId,
  oneOf,
  text,
} from "../../shared/workspace/validation.js";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { onMessagePublished } from "firebase-functions/v2/pubsub";
import { BillingService } from "./billing/BillingService.js";
import { billingProviders, externalBillingEnabled, serverMode } from "./billing/runtime.js";
import type { PassId } from "../../shared/workspace/billing.js";
import { PLAY_PRODUCTS, SIMULATION_PASS_IDS } from "../../shared/workspace/billing.js";
import { secretMatch } from "./billing/ProductionPayments.js";
import { exportBusiness } from "./billing/exportBusiness.js";
import { requestAccountDeletion } from "./billing/AccountDeletionRequest.js";
import { DomainError } from "../../shared/commerce.js";
import type { DateFilter, QueryInput } from "../../shared/commerce.js";
import { CommerceService } from "./CommerceService.js";
import { CommerceQueries } from "./CommerceQueries.js";
import { validateCommand } from "./validation.js";

export { workspaceRegistration, requireVerifiedSignup } from "./auth/registration.js";
export { workspaceGoogleTransfer } from "./auth/desktopGoogle.js";

const qrBasic = defineSecret("KHYPU_QR_BASIC");
const qrWebhookSecret = defineSecret("KHYPU_QR_WEBHOOK_SECRET");

function services(includeBilling = false) {
  const projectId = process.env.GCLOUD_PROJECT ?? "";
  const mode = serverMode();
  const enforceBilling = mode !== "local";
  const app = getApps()[0] ?? initializeApp({ projectId });
  const db = getFirestore(app);
  return {
    mode,
    commands: new CommerceService(db, undefined, enforceBilling),
    billing: new BillingService(db, includeBilling ? billingProviders(mode) : { channels: [] }, Date.now, mode === "simulation", mode === "simulation" || (mode === "hosted" && process.env.KHYPU_MULTI_PASS === "true")),
    queries: new CommerceQueries(db),
    account: new AccountService(db),
    db,
    workspace: new WorkspaceService(db, undefined, enforceBilling),
    workspaceQueries: new WorkspaceQueries(db),
  };
}
const options = {
  region: "us-central1",
  cors: true,
  maxInstances: 2,
  timeoutSeconds: 60,
};
function failure(route: string, cause: unknown): never {
  if (cause instanceof HttpsError && cause.code !== "internal") throw cause;
  if (cause instanceof DomainError)
    throw new HttpsError("failed-precondition", cause.message);
  const incidentId = randomUUID().slice(0, 12);
  const code = cause && typeof cause === "object" && "code" in cause ? cause.code : undefined;
  const category = cause instanceof TypeError ? "TypeError" : cause instanceof RangeError ? "RangeError" : "Error";
  console.error("Fallo de Functions", { route, incidentId, category, sdkCode: typeof code === "number" ? code : undefined });
  throw new HttpsError(
    "internal",
    "No se pudo confirmar la operación. Consulta su estado antes de repetirla.",
    { incidentId },
  );
}
export const commerceCommand = onCall(options, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Inicia sesión.");
  try {
    let command;
    try {
      command = validateCommand(request.data);
    } catch (cause) {
      throw new HttpsError(
        "invalid-argument",
        cause instanceof Error ? cause.message : "Solicitud inválida.",
      );
    }
    return await services().commands.execute(request.auth.uid, command, request.auth.token.auth_time);
  } catch (cause) {
    return workspaceFailure("commerceCommand", cause);
  }
});
export const commerceQuery = onCall(options, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Inicia sesión.");
  try {
    const queries = services().queries;
    if (request.data?.operationId)
      return await queries.status(request.auth.uid, request.data.operationId);
    return await queries.list(request.auth.uid, request.data as QueryInput);
  } catch (cause) {
    return failure("commerceQuery", cause);
  }
});
export const commerceReport = onCall(options, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Inicia sesión.");
  try {
    return await services().queries.report(
      request.auth.uid,
      request.data as DateFilter,
    );
  } catch (cause) {
    return failure("commerceReport", cause);
  }
});

// Contratos v2: identidad del token, negocio explícito, validación en el servidor.
export const workspaceAccount = onCall(options, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Inicia sesión.");
  try {
    const envelope = object(request.data, {
        kind: oneOf(["list", "get", "create", "status"]),
        input: (v) => v,
      }),
      account = services().account;
    if (envelope.kind === "create")
      return await account.create(request.auth.uid, envelope.input);
    if (envelope.kind === "status")
      return await account.status(request.auth.uid, envelope.input);
    if (envelope.kind === "get")
      return await account.get(
        request.auth.uid,
        object(envelope.input, { id: identifier }).id as string,
      );
    return await account.bootstrap(
      request.auth.uid,
      object(envelope.input, { cursor: optionalId }).cursor as string,
    );
  } catch (cause) {
    return workspaceFailure("workspaceAccount", cause);
  }
});
export const workspaceDeletion = onCall({ ...options, secrets: [emailKey, registrationKey] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Inicia sesión.");
  try {
    const { db, mode } = services();
    const email = mode === "hosted" ? {
      key: async () => {
        const key = registrationKey.value();
        if (key.length < 32) throw new AppError("El servicio de correo todavía no está configurado.", 503, "EMAIL_UNAVAILABLE");
        return Buffer.from(key);
      },
      async deliver(id: string, mail: { email: string; code: string }) {
        await sendEmail(mail.email, "Confirma el borrado de tu negocio en KhypuPyme",
          "Tu código es " + mail.code + ". Caduca en diez minutos. Si no pediste el borrado, puedes ignorar este correo.",
          "khypu-business-deletion-" + id);
      },
      async discard() {},
    } : undefined;
    return await new BusinessDeletionService(db, getAuth(), email).handle(
      request.auth.uid, request.auth.token.auth_time, request.data,
    );
  } catch (cause) {
    return workspaceFailure("workspaceDeletion", cause);
  }
});

function workspaceFailure(route: string, cause: unknown): never {
  if (cause instanceof AppError) {
    if (cause.status === 500) return failure(route, cause);
    const codes: Record<number, ConstructorParameters<typeof HttpsError>[0]> = {
      400: "invalid-argument",
      401: "unauthenticated",
      403: "permission-denied",
      404: "not-found",
      409: "already-exists",
      429: "resource-exhausted",
      500: "internal",
      503: "unavailable",
      504: "deadline-exceeded",
    };
    throw new HttpsError(codes[cause.status] ?? "internal", cause.message, {
      appCode: cause.appCode,
      field: cause.field ?? "",
    });
  }
  if (cause instanceof HttpsError) return failure(route, cause);
  // Errores de dominio son mensajes propios; fallos del SDK conservan respuesta incierta.
  if (cause instanceof Error && cause.constructor === Error && !("code" in cause))
    throw new HttpsError("failed-precondition", cause.message);
  return failure(route, cause);
}
export const workspaceCommand = onCall(options, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Inicia sesión.");
  try {
    return await services().workspace.execute(request.auth.uid, request.data, request.auth.token.auth_time);
  } catch (cause) {
    return workspaceFailure("workspaceCommand", cause);
  }
});
export const workspaceApproval = onCall(options, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Inicia sesión.");
  try {
    services(); // Mantener la barrera demo/loopback para esta ruta administrativa.
    const raw = request.data as Record<string, unknown>;
    const envelope = object(raw, {
      phase: oneOf(["prepare", "approve"]), protocol: oneOf(["workspace", "commerce"]), command: (value) => value,
      ...(raw?.phase === "approve" ? { reason: (value: unknown) => value } : {}),
    });
    const command = envelope.protocol === "workspace" ? validateWorkspaceCommand(envelope.command) : validateCommand(envelope.command);
    if (envelope.protocol === "workspace" && !sensitiveAction(command as import("../../shared/workspace/model.js").WorkspaceCommand)) throw new AppError("Esta operación no requiere una autorización de corrección.");
    const operation = envelope.protocol === "workspace" ? protectedOperation(command as import("../../shared/workspace/model.js").WorkspaceCommand) : {
      businessId: request.auth.uid, operationId: command.operationId, signature: canonical(command), kind: "legacy:" + command.kind, input: command.input as unknown as Record<string, unknown>,
    };
    const protection = new SensitiveApprovalService(getFirestore());
    if (envelope.phase === "prepare") return await protection.prepare(request.auth.uid, operation, request.auth.token.auth_time);
    await protection.approve(request.auth.uid, operation, request.auth.token.auth_time, envelope.reason);
    return { approved: true };
  } catch (cause) { return workspaceFailure("workspaceApproval", cause); }
});
export const workspaceQuery = onCall(options, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Inicia sesión.");
  try {
    return await services().workspaceQueries.list(
      request.auth.uid,
      request.data,
    );
  } catch (cause) {
    return workspaceFailure("workspaceQuery", cause);
  }
});
export const workspaceReport = onCall(options, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Inicia sesión.");
  try {
    const input = object(request.data, {
      businessId: identifier,
      from: (v) => v,
      to: (v) => v,
    });
    return await services().workspaceQueries.report(
      request.auth.uid,
      input.businessId as string,
      input.from as string,
      input.to as string,
    );
  } catch (cause) {
    return workspaceFailure("workspaceReport", cause);
  }
});
export const workspaceStatus = onCall(options, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Inicia sesión.");
  try {
    const command = validateWorkspaceCommand(request.data);
    return await services().workspaceQueries.status(
      request.auth.uid,
      command.businessId,
      command.operationId,
      canonical(command),
    );
  } catch (cause) {
    return workspaceFailure("workspaceStatus", cause);
  }
});

export const workspaceBilling = onCall({ ...options, secrets: [qrBasic, qrWebhookSecret] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Inicia sesión.");
  try {
    const { uid, token } = request.auth;
    const { billing, mode } = services(true);
    const raw = request.data as Record<string, unknown> | null;
    const kind = oneOf(["plan", "activate", "start", "check", "current-qr", "restore-play", "simulate-qr", "simulate-trial-expiry"])(raw?.kind);
    if (kind === "restore-play") {
      const input = object(raw, { kind: () => kind, purchaseToken: (v) => text(v, 1, 4096) });
      return await billing.restorePlay(uid, input.purchaseToken as string);
    }
    const input = object(raw, {
      kind: () => kind, businessId: identifier,
      ...(kind === "start" ? { channel: oneOf(["play", "qr"]), ...(raw && Object.hasOwn(raw, "passId") ? { passId: oneOf(SIMULATION_PASS_IDS) } : {}) } : {}),
      ...(kind === "check" || kind === "simulate-qr" ? { intentId: identifier } : {}),
      ...(kind === "simulate-qr" ? { outcome: oneOf(["paid", "expired", "refunded"]) } : {}),
    });
    const id = input.businessId as string;
    if (mode === "local") {
      if (kind !== "plan") throw new AppError("El emulador habitual no emite licencias.", 403, "BILLING_LOCAL");
      return { ...await billing.plan(uid, id, token.email_verified === true), status: "unavailable", expiresAt: null };
    }
    if (kind === "simulate-qr" || kind === "simulate-trial-expiry") {
      if (mode !== "simulation") throw new AppError("La simulación solo está disponible en los emuladores aislados.", 403, "BILLING_SIMULATION");
      if (kind === "simulate-trial-expiry") return await billing.simulateTrialExpiry(uid, id, token.email_verified === true);
      return await billing.simulateQr(uid, id, input.intentId as string, input.outcome as "paid" | "expired" | "refunded");
    }
    if (kind === "activate") return await billing.activate(uid, id, token.email_verified === true);
    if (kind === "start") return await billing.start(uid, id, input.channel as "play" | "qr", input.passId as PassId | undefined);
    if (kind === "current-qr") return await billing.currentQr(uid, id);
    if (kind === "check") return await billing.check(uid, id, input.intentId as string);
    return await billing.plan(uid, id, token.email_verified === true);
  } catch (cause) { return workspaceFailure("workspaceBilling", cause); }
});

export const workspaceExport = onCall(options, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Inicia sesión.");
  try {
    const input = object(request.data, { businessId: identifier, collection: (v) => text(v, 0, 60), cursor: optionalId });
    return await exportBusiness(services().db, request.auth.uid, input.businessId as string, input.collection as string, input.cursor as string);
  } catch (cause) { return workspaceFailure("workspaceExport", cause); }
});

export const workspaceAccountDeletion = onCall(options, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Inicia sesión.");
  try {
    object(request.data, {});
    const { db } = services();
    return await requestAccountDeletion(db, request.auth.uid, request.auth.token.auth_time);
  } catch (cause) { return workspaceFailure("workspaceAccountDeletion", cause); }
});

export const qrPaymentNotice = onRequest({ ...options, cors: false, secrets: [qrBasic, qrWebhookSecret] }, async (request, response) => {
  if (request.method !== "POST" || !secretMatch(request.get("x-khypu-webhook") ?? "", process.env.KHYPU_QR_WEBHOOK_SECRET ?? "")) {
    response.sendStatus(403);
    return;
  }
  try {
    const { billing, mode } = services(true);
    if (mode !== "hosted" || !externalBillingEnabled()) { response.sendStatus(403); return; }
    const { numeroReferenciaOriginante, numeroReferencia } = request.body?.data ?? request.body ?? {};
    await billing.reconcileQr(identifier(numeroReferenciaOriginante), text(numeroReferencia, 1, 40));
    response.sendStatus(204);
  } catch (cause) {
    response.sendStatus(cause instanceof AppError && cause.status === 404 ? 404 : 503);
  }
});

export const playPaymentNotice = onMessagePublished({
  topic: "khypupyme-play-billing", region: options.region, retry: true, maxInstances: 2,
}, async (event) => {
  if (serverMode() !== "hosted" || !externalBillingEnabled()) return;
  const body = event.data.message.json;
  if (body?.packageName !== process.env.KHYPU_PLAY_PACKAGE) return;
  const { billing } = services(true);
  const voided = body.voidedPurchaseNotification;
  if (voided?.productType === 2 && voided.refundType === 1 && typeof voided.purchaseToken === "string") {
    await billing.refundPlay(voided.purchaseToken);
    return;
  }
  const payment = body.oneTimeProductNotification;
  if (typeof payment?.sku === "string" && Object.values(PLAY_PRODUCTS).includes(payment.sku) && typeof payment.purchaseToken === "string")
    await billing.reconcilePlay(payment.purchaseToken);
});

export const reconcileQrRefund = onCall(options, async (request) => {
  if (!request.auth || request.auth.token.billingOperator !== true)
    throw new HttpsError("permission-denied", "Se requiere un operador de cobros.");
  try {
    const { billing, mode } = services();
    if (mode !== "hosted" || process.env.KHYPU_BILLING_MODE !== "live")
      throw new AppError("La conciliación real no está habilitada.", 403, "BILLING_CHANNEL");
    const authTime = request.auth.token.auth_time * 1000;
    if (!authTime || authTime > Date.now() || Date.now() - authTime > 5 * 60_000)
      throw new AppError("Vuelve a autenticarte para conciliar un reembolso.", 401, "BILLING_OPERATOR_AUTH");
    const input = object(request.data, { reference: (v) => text(v, 1, 40), evidence: (v) => text(v, 6, 120) });
    await billing.refundQr(input.reference as string, request.auth.uid, input.evidence as string);
    return { recorded: true };
  } catch (cause) { return workspaceFailure("reconcileQrRefund", cause); }
});

export const timberTutorial = onCall(options, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Inicia sesión.");
  try {
    const current = services();
    return await new TimberTutorialService(current.workspaceQueries.db).handle(
      request.auth.uid,
      request.data,
    );
  } catch (cause) {
    return workspaceFailure("timberTutorial", cause);
  }
});
