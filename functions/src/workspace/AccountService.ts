import { randomUUID } from "node:crypto";
import type { Firestore, DocumentData } from "firebase-admin/firestore";
import { canonical } from "../../../shared/commerce.js";
import { DEFAULT_ANSWERS } from "../../../shared/workspace/catalog.js";
import { INDUSTRY_IDS } from "../../../shared/business-industries.js";
import type { IndustryId } from "../../../shared/business-industries.js";
import type { WorkspaceBusiness } from "../../../shared/workspace/model.js";
import {
  answers,
  identifier,
  industryId,
  object,
  optionalId,
  text,
} from "../../../shared/workspace/validation.js";

export function businessView(
  id: string,
  data: DocumentData,
): WorkspaceBusiness {
  const candidate = data.industryId ?? data.configuration?.industryId;
  return {
    id,
    name: data.name,
    ownerUid: data.ownerUid,
    industryId: INDUSTRY_IDS.includes(candidate)
      ? (candidate as IndustryId)
      : null,
    typeConfirmed: data.typeConfirmed === true,
    workflowVersion: 2,
    currency: "BOB",
    timeZone: "America/La_Paz",
    answers: data.answers ?? { ...DEFAULT_ANSWERS, address: "", phone: "" },
    legacy: data.legacy === true || data.workspaceVersion !== 2,
    createdAt:
      typeof data.createdAt === "string"
        ? data.createdAt
        : (data.createdAt?.toDate?.().toISOString() ?? ""),
  };
}
export class AccountService {
  constructor(private readonly db: Firestore) {}
  async bootstrap(uid: string, cursor = "") {
    const legacyRef = this.db.doc(`businesses/${identifier(uid)}`),
      indexRef = this.db.doc(`users/${uid}/businesses/${uid}`);
    await this.db.runTransaction(async (tx) => {
      const [legacy, index] = await tx.getAll(legacyRef, indexRef);
      if (legacy?.exists && legacy.data()?.ownerUid === uid && !index?.exists)
        tx.create(indexRef, {
          businessId: uid,
          createdAt: new Date().toISOString(),
        });
    });
    let query = this.db
      .collection(`users/${uid}/businesses`)
      .orderBy("__name__")
      .limit(26);
    if (cursor) query = query.startAfter(identifier(cursor));
    const page = await query.get(),
      entries = page.docs.slice(0, 25),
      refs = entries.map((doc) => this.db.doc(`businesses/${doc.id}`));
    const docs = refs.length ? await this.db.getAll(...refs) : [];
    return {
      items: docs
        .filter((doc) => doc.exists && doc.data()?.ownerUid === uid)
        .map((doc) => businessView(doc.id, doc.data()!)),
      next: page.size > 25 ? entries.at(-1)!.id : null,
    };
  }
  async create(uid: string, raw: unknown) {
    const input = object(raw, {
        operationId: identifier,
        name: (v) => text(v, 2, 80),
        industryId,
        answers,
      }),
      signature = canonical(input);
    const id = randomUUID(),
      key = this.db.doc(
        `users/${identifier(uid)}/operationKeys/${input.operationId}`,
      );
    const result = await this.db.runTransaction(async (tx) => {
      const previous = await tx.get(key);
      if (previous.exists) {
        if (
          previous.data()?.signature !== signature ||
          previous.data()?.kind !== "create-business"
        )
          throw new Error("El identificador pertenece a otra solicitud.");
        return previous.data()!.businessId as string;
      }
      const now = new Date().toISOString();
      const data = {
        name: input.name,
        ownerUid: uid,
        industryId: input.industryId,
        typeConfirmed: true,
        workflowVersion: 2,
        workspaceVersion: 2,
        currency: "BOB",
        timeZone: "America/La_Paz",
        answers: input.answers,
        legacy: false,
        createdAt: now,
        updatedAt: now,
      };
      tx.create(this.db.doc(`businesses/${id}`), data);
      tx.create(this.db.doc(`users/${uid}/businesses/${id}`), {
        businessId: id,
        createdAt: now,
      });
      tx.create(key, {
        signature,
        kind: "create-business",
        businessId: id,
        createdAt: now,
      });
      return id;
    });
    return businessView(
      result,
      (await this.db.doc(`businesses/${result}`).get()).data()!,
    );
  }
  async get(uid: string, id: string) {
    const doc = await this.db.doc(`businesses/${identifier(id)}`).get();
    if (!doc.exists || doc.data()?.ownerUid !== uid)
      throw new Error("No tienes acceso a este negocio.");
    return businessView(doc.id, doc.data()!);
  }
  async status(uid: string, raw: unknown) {
    const input = object(raw, {
        operationId: identifier,
        name: (v) => text(v, 2, 80),
        industryId,
        answers,
      }),
      key = await this.db
        .doc(`users/${identifier(uid)}/operationKeys/${input.operationId}`)
        .get();
    if (!key.exists) return null;
    if (
      key.data()?.signature !== canonical(input) ||
      key.data()?.kind !== "create-business"
    )
      throw new Error("Identificador usado en otra solicitud.");
    return this.get(uid, key.data()!.businessId);
  }
  validateList(raw: unknown) {
    return object(raw, { cursor: optionalId });
  }
}
