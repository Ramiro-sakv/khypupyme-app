import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import type { Auth } from "firebase-admin/auth";
import type { DocumentReference, DocumentSnapshot, Firestore, Query, Transaction } from "firebase-admin/firestore";
import { AppError } from "../../../shared/app-errors.js";
import type { DeletionResult } from "../../../shared/workspace/business-deletion.js";
import type { WorkspaceReset } from "../../../shared/workspace/model.js";
import { identifier, object, oneOf } from "../../../shared/workspace/validation.js";
import { LocalDeletionInbox } from "./LocalDeletionInbox.js";

const MINUTE = 60_000;
const CHUNK = 100;

interface Challenge {
  id: string;
  name: string;
  preparedAt: number;
  expiresAt: number;
  initialAuth: number;
  authTime?: number;
  digest?: string;
  attempts?: number;
}
interface Job {
  state: "deleting" | "deleted";
  name?: string;
  practiceIds?: string[];
  creationIds?: string[];
}
const invalid = () => new AppError("El código no está vigente. Solicita otro.", 400, "DELETION_CODE_EXPIRED");

type DeletionInbox = Pick<LocalDeletionInbox, "key" | "deliver" | "discard">;

export class BusinessDeletionService {
  constructor(private readonly db: Firestore, private readonly auth: Auth, private readonly email?: DeletionInbox) {}

  private async requireBusiness(tx: Transaction, root: DocumentReference, uid: string, name: string) {
    const [business, cash] = await tx.getAll(root, root.collection("cashControl").doc("current"));
    if (business?.data()?.ownerUid !== uid || business.data()?.tutorialSessionId || business.data()?.deletionPending)
      throw new AppError("Este negocio no está disponible para eliminar.", 403, "DELETION_OWNER");
    if (business.data()?.name !== name)
      throw new AppError("Escribe el nombre exacto del negocio.", 400, "DELETION_NAME");
    if (cash?.data()?.activeId)
      throw new AppError("Cierra la caja de este negocio antes de eliminarlo.", 400, "DELETION_CASH");
  }

  async handle(uid: string, authTime: number, raw: unknown): Promise<DeletionResult> {
    const request = raw as Record<string, unknown> | null;
    const kind = oneOf(["prepare", "send", "confirm", "resume"])(request?.kind);
    const decodeText = (value: unknown, max: number) => {
      if (typeof value !== "string" || !value.length || value.length > max)
        throw new AppError("Comprueba los datos de confirmación.");
      return value;
    };
    const input = object(raw, {
      kind: (value) => value,
      businessId: identifier,
      ...(kind === "prepare" ? { name: (value: unknown) => decodeText(value, 80) } : {}),
      ...(kind === "send" || kind === "confirm" ? { challengeId: identifier } : {}),
      ...(kind === "confirm" ? { code: (value: unknown) => decodeText(value, 6) } : {}),
    });
    const businessId = input.businessId as string;
    const account = this.db.doc("users/" + identifier(uid));
    const root = this.db.doc("businesses/" + businessId);
    const job = account.collection("businessDeletions").doc(businessId);
    const challenge = account.collection("deletionChallenges").doc(businessId);

    if (kind === "resume") return this.resume(uid, root, job);

    const inbox = this.email ?? new LocalDeletionInbox();
    const identity = await this.auth.getUser(uid);
    if (identity.disabled || !identity.email || !identity.emailVerified)
      throw new AppError("Verifica el correo de tu cuenta antes de eliminar un negocio.", 403, "DELETION_EMAIL");
    const now = Date.now();
    if (!Number.isSafeInteger(authTime) || authTime < 1 || authTime * 1000 > now)
      throw new AppError("Vuelve a ingresar con tu cuenta.", 401, "DELETION_REAUTH");

    if (kind === "prepare") {
      const name = input.name as string, challengeId = randomUUID();
      const previous = await this.db.runTransaction(async (tx) => {
        await this.requireBusiness(tx, root, uid, name);
        const old = (await tx.get(challenge)).data() as Challenge | undefined;
        tx.set(challenge, { id: challengeId, name, preparedAt: now, expiresAt: now + 10 * MINUTE, initialAuth: authTime });
        return old?.id;
      });
      await inbox.discard(previous);
      return { state: "prepared", challengeId };
    }

    const key = await inbox.key();
    const sign = (id: string, code: string) => createHmac("sha256", key)
      .update(JSON.stringify([uid, businessId, identity.email, id, code])).digest("hex");
    if (kind === "send") {
      const challengeId = randomUUID();
      const code = String(randomInt(1_000_000)).padStart(6, "0");
      const rate = account.collection("securityState").doc("deletionEmail");
      const { oldId, expiresAt } = await this.db.runTransaction(async (tx) => {
        const [current, usage] = await tx.getAll(challenge, rate);
        const old = current?.data() as Challenge | undefined;
        if (!old || old.id !== input.challengeId) throw invalid();
        await this.requireBusiness(tx, root, uid, old.name);
        const issuedAt = Date.now();
        if (old.expiresAt <= issuedAt) throw invalid();
        if (authTime <= old.initialAuth || authTime * 1000 < old.preparedAt - 999 ||
            issuedAt - authTime * 1000 > 10 * MINUTE || (old.authTime !== undefined && old.authTime !== authTime))
          throw new AppError("Confirma la contraseña después de iniciar esta solicitud.", 401, "DELETION_REAUTH");
        const sends = ((usage?.data()?.sends ?? []) as number[]).filter((time) => issuedAt - time < 60 * MINUTE);
        if (sends.length >= 3 || (sends.at(-1) ?? 0) > issuedAt - MINUTE)
          throw new AppError("Espera al menos un minuto entre envíos. Puedes solicitar hasta tres códigos por hora.", 429, "DELETION_RATE");
        const expiresAt = issuedAt + 10 * MINUTE;
        tx.set(rate, { sends: [...sends, issuedAt] });
        tx.set(challenge, { ...old, id: challengeId, authTime, expiresAt, digest: sign(challengeId, code), attempts: 0 });
        return { oldId: old.id, expiresAt };
      });
      try {
        await inbox.discard(oldId);
        await inbox.deliver(challengeId, { email: identity.email, code, expiresAt });
      } catch {
        throw new AppError("No se pudo escribir el código en el buzón local. Abre una nueva solicitud cuando termine la espera.", 503, "DELETION_INBOX");
      }
      return { state: "sent", challengeId, expiresAt };
    }

    const code = input.code as string;
    if (!/^\d{6}$/.test(code)) throw new AppError("Escribe los seis dígitos del código.");
    const outcome = await this.db.runTransaction(async (tx) => {
      const old = (await tx.get(challenge)).data() as Challenge | undefined;
      if (!old || old.id !== input.challengeId || !old.digest || old.authTime !== authTime ||
          (old.attempts ?? 0) >= 5) throw invalid();
      await this.requireBusiness(tx, root, uid, old.name);
      if (old.expiresAt <= Date.now()) throw invalid();
      if (!timingSafeEqual(Buffer.from(old.digest, "hex"), Buffer.from(sign(old.id, code), "hex"))) {
        const attempts = (old.attempts ?? 0) + 1;
        tx.update(challenge, { attempts });
        return { accepted: false, attempts, id: old.id };
      }
      tx.update(root, { deletionPending: true });
      tx.delete(account.collection("businesses").doc(businessId));
      tx.delete(challenge);
      tx.create(job, { state: "deleting", name: old.name, practiceIds: [], creationIds: [] });
      return { accepted: true, attempts: 0, id: old.id };
    });
    if (outcome.accepted || outcome.attempts >= 5) await inbox.discard(outcome.id);
    if (!outcome.accepted) {
      const remaining = 5 - outcome.attempts;
      throw new AppError(remaining > 0 ? `Código incorrecto. Quedan ${remaining} intentos.` : "Se agotaron los intentos. Solicita otro código.", 400, "DELETION_CODE");
    }
    return { state: "deleting" };
  }

  private async clearChildren(root: DocumentReference) {
    const collections = await root.listCollections();
    const first = collections[0];
    if (!first) return true;
    const page = await first.limit(CHUNK).get();
    if (page.empty) {
      // Firestore can retain descendants whose parent document is missing.
      await this.db.recursiveDelete(first);
      return false;
    }
    const batch = this.db.batch();
    const children = await Promise.all(page.docs.map((doc) => doc.ref.listCollections()));
    for (const [index, doc] of page.docs.entries()) {
      if (children[index]?.length) await this.db.recursiveDelete(doc.ref);
      else batch.delete(doc.ref);
    }
    await batch.commit();
    return false;
  }

  private async clearLinks(query: Query, job: DocumentReference) {
    return this.db.runTransaction(async (tx) => {
      const current = (await tx.get(job)).data() as Job | undefined;
      if (current?.state !== "deleting") return true;
      const page = await tx.get(query.limit(CHUNK));
      if (page.empty) return true;
      const creations = page.docs.filter((doc) => doc.data().kind === "create-business").map((doc) => doc.id);
      if (creations.length) tx.update(job, { creationIds: [...new Set([...(current.creationIds ?? []), ...creations])] });
      for (const doc of page.docs) tx.delete(doc.ref);
      return false;
    });
  }

  private async addIds(job: DocumentReference, ids: string[]) {
    await this.db.runTransaction(async (tx) => {
      const current = (await tx.get(job)).data() as Job | undefined;
      if (current?.state === "deleting") tx.update(job, { practiceIds: [...new Set([...(current.practiceIds ?? []), ...ids])] });
    });
  }

  private async clearPractice(uid: string, sourceId: string, session: DocumentSnapshot, job: DocumentReference) {
    const id = session.data()?.practiceBusinessId as string | undefined;
    if (id) {
      if (id !== "practice-" + session.id || id === sourceId)
        throw new AppError("No se pudo comprobar la relación de una práctica. El borrado sigue pendiente.", 409, "DELETION_PRACTICE");
      const ref = this.db.doc("businesses/" + id), current = await ref.get();
      if (current.exists && (current.data()?.ownerUid !== uid || current.data()?.tutorialSourceBusinessId !== sourceId ||
          current.data()?.tutorialSessionId !== session.id))
        throw new AppError("La práctica pertenece a otro espacio. El borrado sigue pendiente.", 409, "DELETION_PRACTICE");
      await this.addIds(job, [id]);
      if (!await this.clearChildren(ref)) return;
      if (!await this.clearLinks(job.parent.parent!.collection("operationKeys").where("businessId", "==", id), job)) return;
      await ref.delete();
    }
    await session.ref.delete();
  }

  private async resume(uid: string, root: DocumentReference, job: DocumentReference): Promise<DeletionResult> {
    const account = job.parent.parent!, businessId = root.id;
    const [record, business] = await this.db.getAll(job, root);
    const saved = record?.data() as Job | undefined;
    if (saved?.state === "deleted") {
      const reset = (await account.get()).data()?.workspaceReset as WorkspaceReset;
      return { state: "deleted", reset };
    }
    if (saved?.state !== "deleting" || business?.data()?.ownerUid !== uid || business.data()?.deletionPending !== true)
      throw new AppError("No hay un borrado autorizado para este negocio.", 403, "DELETION_OWNER");
    const pending = { state: "deleting" } as const;
    if (!await this.clearChildren(root)) return pending;
    const session = (await account.collection("tutorialSessions").where("sourceBusinessId", "==", businessId).limit(1).get()).docs[0];
    if (session) {
      await this.clearPractice(uid, businessId, session, job);
      return pending;
    }
    for (const name of ["operationKeys", "sensitiveApprovals"]) {
      if (!await this.clearLinks(account.collection(name).where("businessId", "==", businessId), job)) return pending;
    }
    return this.db.runTransaction(async (tx) => {
      const [current, parent, owner] = await tx.getAll(job, root, account);
      const data = current?.data() as Job | undefined;
      const previous = owner?.data()?.workspaceReset as WorkspaceReset | undefined;
      if (data?.state === "deleted" && previous) return { state: "deleted", reset: previous };
      if (data?.state !== "deleting" || parent?.data()?.ownerUid !== uid || parent.data()?.deletionPending !== true)
        throw new AppError("No se pudo confirmar el estado del borrado.", 409, "DELETION_STATE");
      const reset: WorkspaceReset = {
        id: randomUUID(),
        removedBusinessIds: [...new Set([...(previous?.removedBusinessIds ?? []), businessId, ...(data.practiceIds ?? [])])],
        removedCreationOperationIds: [...new Set([...(previous?.removedCreationOperationIds ?? []), ...(data.creationIds ?? [])])],
      };
      tx.delete(account.collection("businesses").doc(businessId));
      tx.delete(account.collection("tutorialPointers").doc(businessId));
      tx.delete(root);
      tx.set(account, { workspaceReset: reset }, { merge: true });
      tx.set(job, { state: "deleted", deletedAt: new Date().toISOString() });
      return { state: "deleted", reset };
    });
  }
}
