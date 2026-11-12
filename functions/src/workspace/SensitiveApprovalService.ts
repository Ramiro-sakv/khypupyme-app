import { createHash } from "node:crypto";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { AppError } from "../../../shared/app-errors.js";
import { canonical } from "../../../shared/commerce.js";
import { sensitiveAction } from "../../../shared/workspace/protection.js";
import type { CorrectionChallenge } from "../../../shared/workspace/protection.js";
import type { WorkspaceCommand } from "../../../shared/workspace/model.js";
import { identifier, text } from "../../../shared/workspace/validation.js";
import type { UnitOfWork } from "./UnitOfWork.js";
import { auditValues } from "./UnitOfWork.js";

export interface ProtectedOperation { businessId: string; operationId: string; signature: string; kind: string; input: Record<string, unknown> }
interface Approval { businessId: string; digest: string; kind: string; reason: string; issuedAt: number; expiresAt: number; state: "prepared" | "approved" | "consumed"; authTime: number; challenge: CorrectionChallenge }
export const protectedOperation = (command: WorkspaceCommand): ProtectedOperation => ({ businessId: command.businessId, operationId: command.operationId, signature: canonical(command), kind: command.kind, input: command.input as unknown as Record<string, unknown> });
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export class SensitiveApprovalService {
  constructor(private readonly db: Firestore) { }
  private ref(uid: string, id: string) { return this.db.doc(`users/${identifier(uid)}/sensitiveApprovals/${identifier(id)}`); }
  private identity(authTime: number | undefined) {
    if (!authTime || !Number.isSafeInteger(authTime) || authTime > Math.floor(Date.now() / 1000) + 5) throw new AppError("Tu sesión no es válida. Vuelve a ingresar.", 401, "AUTH_REQUIRED");
    return authTime;
  }
  targets(operation: ProtectedOperation): { collection: string; id: string }[] {
    const input = operation.input;
    if (["legacy-commerce", "recover-legacy"].includes(operation.kind)) {
      const nested = (input.command ?? input.request) as { kind?: string; input?: Record<string, unknown> } | undefined;
      if (nested?.input && typeof nested.kind === "string") return this.targets({ ...operation, kind: "legacy:" + nested.kind, input: nested.input });
    }
    const id = input.id ?? input.saleId ?? input.itemId ?? input.productId ?? input.serialId;
    if (typeof id !== "string") return [];
    const legacyCollections: Record<string, string> = { "legacy:cancel-sale": "sales", "legacy:cancel-expense": "expenses", "legacy:cancel-receivable": "receivables", "legacy:customer": "customers", "legacy:service": "services" };
    const collection = legacyCollections[operation.kind] ?? (operation.kind === "release-serial" ? "serials" : operation.kind === "timber-species" ? "timberSpecies" : operation.kind === "edit-item" || operation.kind === "stock-adjust" ? "items" : operation.kind === "cancel-debt" ? "debts" : operation.kind === "cancel-expense" ? "expensesV2" : operation.kind === "return" || operation.kind === "exchange" ? "salesV2" : "products");
    return [{ collection, id: identifier(id) }];
  }
  async prepare(uid: string, operation: ProtectedOperation, authTime: number | undefined) {
    const time = this.identity(authTime), now = Date.now();
    return this.db.runTransaction(async (tx) => {
      const business = await tx.get(this.db.doc(`businesses/${identifier(operation.businessId)}`));
      if (!business.exists || business.data()!.ownerUid !== uid || (business.data()!.tutorialSessionId || business.data()!.deletionPending)) throw new AppError("No tienes acceso a este negocio.", 403, "OWNER_REQUIRED");
      const records: CorrectionChallenge["records"] = [];
      for (const target of this.targets(operation)) {
        let record = await tx.get(this.db.doc(`businesses/${operation.businessId}/${target.collection}/${target.id}`));
        let collection = target.collection;
        if (!record.exists && operation.kind === "stock-adjust") { collection = "timberSpecies"; record = await tx.get(this.db.doc(`businesses/${operation.businessId}/${collection}/${target.id}`)); }
        if (record.exists) records.push({ collection, id: target.id, values: auditValues(record.data()) ?? {} });
      }
      if (["cash-adjust", "close-cash"].includes(operation.kind)) {
        const control = await tx.get(this.db.doc(`businesses/${operation.businessId}/cashControl/current`));
        if (control.data()?.activeId) { const record = await tx.get(this.db.doc(`businesses/${operation.businessId}/cashSessions/${identifier(control.data()!.activeId)}`)); if (record.exists) records.push({ collection: "cashSessions", id: record.id, values: auditValues(record.data()) ?? {} }); }
      }
      const reference = this.ref(uid, operation.operationId), existing = await tx.get(reference);
      if (existing.exists && (existing.data()!.businessId !== operation.businessId || existing.data()!.digest !== digest(operation.signature))) throw new AppError("El identificador pertenece a otra solicitud.", 409, "APPROVAL_CONFLICT");
      const challenge: CorrectionChallenge = { businessName: String(business.data()!.name), operationId: operation.operationId, kind: operation.kind, issuedAt: now, expiresAt: now + 300000, records };
      tx.set(reference, { businessId: operation.businessId, kind: operation.kind, digest: digest(operation.signature), issuedAt: now, expiresAt: now + 300000, authTime: time, state: "prepared", reason: "", challenge });
      return challenge;
    });
  }
  async approve(uid: string, operation: ProtectedOperation, authTime: number | undefined, reason: unknown) {
    const time = this.identity(authTime), motive = text(reason, 3, 200), now = Date.now();
    await this.db.runTransaction(async (tx) => {
      const reference = this.ref(uid, operation.operationId), snapshot = await tx.get(reference), approval = snapshot.data() as Approval | undefined;
      const business = await tx.get(this.db.doc(`businesses/${identifier(operation.businessId)}`));
      const usageRef = this.db.doc(`users/${identifier(uid)}/securityState/lastCorrectionAuth`), usage = await tx.get(usageRef);
      if (business.data()?.ownerUid !== uid || (business.data()?.tutorialSessionId || business.data()?.deletionPending)) throw new AppError("No tienes acceso a este negocio.", 403, "OWNER_REQUIRED");
      if (!approval || approval.businessId !== operation.businessId || approval.digest !== digest(operation.signature) || approval.state !== "prepared" || approval.expiresAt < now) throw new AppError("La confirmación caducó. Vuelve a revisar la operación.", 403, "APPROVAL_REQUIRED");
      if (time <= Math.floor(approval.issuedAt / 1000) || time <= approval.authTime) throw new AppError("Confirma tu contraseña después de abrir esta revisión.", 401, "REAUTH_REQUIRED");
      if (time <= (usage.data()?.authTime ?? 0)) throw new AppError("Esta autenticación ya confirmó otra corrección. Vuelve a confirmar tu contraseña.", 401, "REAUTH_REQUIRED");
      const nested = (operation.input.command ?? operation.input.request) as { input?: { reason?: unknown } } | undefined;
      const commandReason = operation.input.reason ?? nested?.input?.reason;
      if (typeof commandReason === "string" && commandReason.trim() && commandReason.trim() !== motive) throw new AppError("El motivo debe coincidir con la solicitud original.", 400, "REASON_MISMATCH");
      tx.set(reference, { ...approval, state: "approved", reason: motive, authTime: time, approvedAt: now, expiresAt: now + 120000 });
      tx.set(usageRef, { authTime: time, operationId: operation.operationId, approvedAt: now });
    });
  }
  async read(tx: Transaction, uid: string, operation: ProtectedOperation, authTime: number | undefined) {
    const time = this.identity(authTime), record = await tx.get(this.ref(uid, operation.operationId)), approval = record.data() as Approval | undefined;
    if (!approval || approval.businessId !== operation.businessId || approval.digest !== digest(operation.signature) || approval.state !== "approved" || approval.expiresAt < Date.now() || approval.authTime !== time) throw new AppError("Esta corrección requiere confirmar de nuevo la contraseña y el motivo.", 403, "APPROVAL_REQUIRED");
    if ((await tx.get(this.db.doc(`businesses/${operation.businessId}/auditEvents/${operation.operationId}`))).exists) throw new AppError("La corrección ya tiene historial. Consulta su confirmación.", 409, "CORRECTION_EXISTS");
    return approval;
  }
  consume(tx: Transaction, uid: string, operation: ProtectedOperation, approval: Approval) {
    if (approval.expiresAt < Date.now()) throw new AppError("La autorización venció antes de confirmar. Vuelve a revisar la corrección.", 403, "APPROVAL_REQUIRED");
    tx.set(this.ref(uid, operation.operationId), { ...approval, state: "consumed", consumedAt: Date.now() });
  }
  async protect(work: UnitOfWork, command: WorkspaceCommand, authTime: number | undefined) {
    const existingProduct = command.kind === "timber-species" && await work.get("timberSpecies", command.input.id);
    if (!existingProduct && !sensitiveAction(command)) return null;
    return this.read(work.tx, work.uid, protectedOperation(command), authTime);
  }
  audit(work: UnitOfWork, command: WorkspaceCommand, approval: Approval) {
    const operation = protectedOperation(command);
    this.consume(work.tx, work.uid, operation, approval);
    const changes = work.auditChanges();
    const lineIds: string[] = [];
    for (const change of changes) for (const snapshot of [change.before, change.after]) {
      if (!Array.isArray(snapshot?.lines)) continue;
      for (const line of snapshot.lines as { itemId?: unknown; timber?: { speciesId?: unknown } }[]) {
        for (const value of [line.itemId, line.timber?.speciesId]) if (typeof value === "string") lineIds.push(value);
      }
    }
    work.set("auditEvents", command.operationId, { id: command.operationId, kind: command.kind, authorUid: work.uid, businessId: work.businessId, reason: approval.reason, operationId: command.operationId, createdAt: work.now, changes, targetIds: [...new Set([...this.targets(operation).map((x) => x.id), ...changes.map((x) => x.id), ...lineIds])] });
  }
}
