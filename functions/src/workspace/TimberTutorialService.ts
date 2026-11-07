import type { Firestore } from "firebase-admin/firestore";
import { canonical, today } from "../../../shared/commerce.js";
import { DEFAULT_ANSWERS } from "../../../shared/workspace/catalog.js";
import {
  TIMBER_STEPS,
  TUTORIAL_VERSION,
} from "../../../shared/workspace/timber-tutorial.js";
import type {
  TutorialControl,
  TutorialReply,
  TutorialSession,
  TutorialState,
} from "../../../shared/workspace/timber-tutorial.js";
import {
  identifier,
  object,
  oneOf,
  optionalId,
  text,
  validateWorkspaceCommand,
} from "../../../shared/workspace/validation.js";
import { integer } from "../../../shared/workspace/operations-validation.js";
import { sessionPath } from "./TutorialAccess.js";
import type { StoredTutorial } from "./TutorialAccess.js";
import { AccountService, businessView } from "./AccountService.js";
import { WorkspaceService } from "./WorkspaceService.js";
import { WorkspaceQueries } from "./WorkspaceQueries.js";
const sevenDays = (iso: string) =>
  new Date(Date.parse(iso) + 7 * 86400000).toISOString();
const view = (data: Partial<StoredTutorial>): TutorialSession => ({
  id: data.id!,
  sourceBusinessId: data.sourceBusinessId!,
  practiceBusinessId: data.practiceBusinessId ?? null,
  version: data.version!,
  status: data.status!,
  stepIndex: data.stepIndex ?? TIMBER_STEPS.length,
  revision: data.revision ?? 0,
  references: data.references ?? {},
  startedOn: data.startedOn ?? "",
  expiresAt: data.expiresAt ?? "",
  finishedAt: data.finishedAt ?? null,
});
export class TimberTutorialService {
  constructor(private readonly db: Firestore) {}
  private async source(uid: string, id: string) {
    const business = await new AccountService(this.db).get(uid, id);
    if (business.industryId !== "timber" || !business.typeConfirmed)
      throw new Error(
        "La práctica está disponible en un negocio de maderas confirmado.",
      );
    return business;
  }
  private async stored(uid: string, sourceId: string, id: string) {
    const doc = await this.db.doc(sessionPath(uid, id)).get();
    if (!doc.exists || doc.data()!.sourceBusinessId !== sourceId)
      throw new Error("La sesión no pertenece a este negocio y cuenta.");
    return doc.data() as StoredTutorial;
  }
  private async state(
    uid: string,
    s: Partial<StoredTutorial>,
  ): Promise<TutorialState> {
    const session = view(s);
    let business = null;
    if (
      session.practiceBusinessId &&
      ["active", "paused"].includes(session.status)
    ) {
      const doc = await this.db
        .doc("businesses/" + session.practiceBusinessId)
        .get();
      if (
        doc.exists &&
        doc.data()?.ownerUid === uid &&
        doc.data()?.tutorialSessionId === session.id
      )
        business = businessView(doc.id, doc.data()!);
    }
    return { session, business };
  }
  private async cleanup(uid: string, s: StoredTutorial) {
    const id = s.practiceBusinessId;
    if (!id || id !== "practice-" + s.id || id === s.sourceBusinessId)
      throw new Error(
        "No se puede verificar el espacio temporal. No se borró ningún negocio.",
      );
    const ref = this.db.doc("businesses/" + id),
      doc = await ref.get();
    if (
      doc.exists &&
      (doc.data()?.ownerUid !== uid ||
        doc.data()?.tutorialSessionId !== s.id ||
        doc.data()?.tutorialSourceBusinessId !== s.sourceBusinessId)
    )
      throw new Error("El destino de limpieza no es esta práctica.");
    // Solo esta raíz temporal; cerrar primero serializa cualquier registro en curso.
    if (doc.exists) await this.db.recursiveDelete(ref);
    const keys = await this.db
      .collection("users/" + uid + "/operationKeys")
      .where("businessId", "==", id)
      .get();
    for (let i = 0; i < keys.size; i += 400) {
      const batch = this.db.batch();
      for (const key of keys.docs.slice(i, i + 400)) batch.delete(key.ref);
      await batch.commit();
    }
    const receipt = {
      id: s.id,
      sourceBusinessId: s.sourceBusinessId,
      version: s.version,
      status: s.cleanupGoal ?? "abandoned",
      finishedAt: new Date().toISOString(),
    };
    await this.db.doc(sessionPath(uid, s.id)).set(receipt);
    return this.state(uid, receipt as Partial<StoredTutorial>);
  }
  private async closing(
    uid: string,
    s: StoredTutorial,
    goal: "completed" | "abandoned",
  ) {
    const ref = this.db.doc(sessionPath(uid, s.id));
    const closing = await this.db.runTransaction(async (tx) => {
      const doc = await tx.get(ref),
        current = doc.data() as StoredTutorial;
      if (["completed", "abandoned"].includes(current.status)) return current;
      if (current.status === "closing") return current;
      const next: StoredTutorial = {
        ...current,
        status: "closing",
        cleanupGoal: goal,
        revision: current.revision + 1,
      };
      tx.set(ref, next);
      return next;
    });
    return closing.status === "closing"
      ? this.cleanup(uid, closing)
      : this.state(uid, closing);
  }
  private async refreshQuote(
    uid: string,
    s: StoredTutorial,
  ): Promise<StoredTutorial> {
    if (
      !["active", "paused"].includes(s.status) ||
      TIMBER_STEPS[s.stepIndex]?.id !== "sale" ||
      !s.references.quote ||
      !s.practiceBusinessId
    )
      return s;
    return this.db.runTransaction(async (tx) => {
      const ref = this.db.doc(sessionPath(uid, s.id)),
        doc = await tx.get(ref),
        latest = doc.data() as StoredTutorial;
      if (
        !["active", "paused"].includes(latest.status) ||
        TIMBER_STEPS[latest.stepIndex]?.id !== "sale" ||
        !latest.references.quote ||
        !latest.practiceBusinessId
      )
        return latest;
      const quote = await tx.get(
        this.db.doc(
          "businesses/" +
            latest.practiceBusinessId +
            "/quotes/" +
            latest.references.quote,
        ),
      );
      if (quote.exists && quote.data()!.validUntil >= today()) return latest;
      const references = { ...latest.references };
      delete references.quote;
      const next: StoredTutorial = {
        ...latest,
        references,
        stepIndex: TIMBER_STEPS.findIndex((step) => step.id === "quote"),
        revision: latest.revision + 1,
      };
      tx.set(ref, next);
      return next;
    });
  }
  private async current(uid: string, sourceId: string): Promise<TutorialState> {
    await this.source(uid, sourceId);
    const pointer = await this.db
      .doc("users/" + uid + "/tutorialPointers/" + sourceId)
      .get();
    if (!pointer.exists) return { session: null, business: null };
    const s = await this.stored(
      uid,
      sourceId,
      identifier(pointer.data()!.sessionId),
    );
    if (s.status === "closing") return this.cleanup(uid, s);
    if (
      ["active", "paused"].includes(s.status) &&
      s.expiresAt < new Date().toISOString()
    )
      return this.closing(uid, s, "abandoned");
    if (
      ["active", "paused"].includes(s.status) &&
      s.practiceBusinessId &&
      !(await this.db.doc("businesses/" + s.practiceBusinessId).get()).exists
    )
      return this.closing(uid, s, "abandoned");
    return this.state(uid, await this.refreshQuote(uid, s));
  }
  private async control(
    uid: string,
    sourceId: string,
    input: unknown,
  ): Promise<TutorialReply> {
    const c = object(input, {
      kind: oneOf(["start", "resume", "pause", "advance", "finish", "abandon"]),
      operationId: (v) => {
        const id = identifier(v);
        if (id.length > 80)
          throw new Error("Identificador de tutorial demasiado largo.");
        return id;
      },
      sessionId: identifier,
      expectedRevision: (v) => integer(v),
      stepId: optionalId,
    }) as unknown as TutorialControl;
    const signature = canonical(c),
      now = new Date().toISOString();
    if (c.kind === "start") {
      const source = await this.source(uid, sourceId);
      await this.current(uid, sourceId);
      if (c.sessionId !== c.operationId)
        throw new Error("Conserva el identificador original de inicio.");
      const id = await this.db.runTransaction(async (tx) => {
        const sessionRef = this.db.doc(sessionPath(uid, c.sessionId)),
          pointerRef = this.db.doc(
            "users/" + uid + "/tutorialPointers/" + sourceId,
          ),
          sourceRef = this.db.doc("businesses/" + sourceId);
        const [own, pointer, parent] = await tx.getAll(
          sessionRef,
          pointerRef,
          sourceRef,
        );
        if (
          parent?.data()?.ownerUid !== uid ||
          parent.data()?.industryId !== "timber" ||
          parent.data()?.tutorialSessionId
        )
          throw new Error("El negocio de origen no está autorizado.");
        if (own?.exists) {
          if (own.data()!.sourceBusinessId !== sourceId)
            throw new Error("El ID de inicio pertenece a otro negocio.");
          const original = own.data()!.controlOperations?.[c.operationId];
          if (original && original !== signature)
            throw new Error("El ID pertenece a otra solicitud.");
          return own.id;
        }
        if (pointer?.exists) {
          const previousRef = this.db.doc(
              sessionPath(uid, identifier(pointer.data()!.sessionId)),
            ),
            previous = await tx.get(previousRef);
          if (
            previous.exists &&
            ["active", "paused"].includes(previous.data()!.status)
          ) {
            const old = previous.data() as StoredTutorial;
            if (Object.keys(old.controlOperations).length >= 512)
              throw new Error(
                "Abandona la práctica anterior antes de iniciar otra.",
              );
            tx.set(previousRef, {
              ...old,
              controlOperations: {
                ...old.controlOperations,
                [c.operationId]: signature,
              },
            });
            return old.id;
          }
        }
        const practiceBusinessId = "practice-" + c.sessionId;
        const s: StoredTutorial = {
          id: c.sessionId,
          sourceBusinessId: sourceId,
          practiceBusinessId,
          version: TUTORIAL_VERSION,
          status: "active",
          stepIndex: 0,
          revision: 0,
          references: {},
          startedOn: today(),
          expiresAt: sevenDays(now),
          finishedAt: null,
          lastActivityAt: now,
          controlOperations: { [c.operationId]: signature },
        };
        tx.create(sessionRef, s);
        tx.set(pointerRef, { sessionId: s.id });
        tx.create(this.db.doc("businesses/" + practiceBusinessId), {
          name: "Maderas · práctica",
          ownerUid: uid,
          industryId: "timber",
          typeConfirmed: true,
          workflowVersion: 2,
          workspaceVersion: 2,
          legacy: false,
          currency: "BOB",
          timeZone: "America/La_Paz",
          answers: {
            ...DEFAULT_ANSWERS,
            documentFooter: "PRÁCTICA — DATOS FICTICIOS",
          },
          timberSystem: source.timberSystem ?? "imperial",
          tutorialSessionId: s.id,
          tutorialSourceBusinessId: sourceId,
          createdAt: now,
          updatedAt: now,
        });
        return s.id;
      });
      return {
        state: await this.state(uid, await this.stored(uid, sourceId, id)),
        acknowledged: true,
      };
    }
    const ref = this.db.doc(sessionPath(uid, c.sessionId));
    const next = await this.db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists || doc.data()!.sourceBusinessId !== sourceId)
        throw new Error("Sesión no autorizada.");
      const s = doc.data() as StoredTutorial;
      if (["completed", "abandoned", "closing"].includes(s.status)) return s;
      if (s.controlOperations[c.operationId]) {
        if (s.controlOperations[c.operationId] !== signature)
          throw new Error("El ID pertenece a otra solicitud.");
        return s;
      }
      if (s.revision !== c.expectedRevision)
        throw new Error(
          "La práctica cambió en otra pestaña. Consulta el progreso antes de continuar.",
        );
      const step = TIMBER_STEPS[s.stepIndex];
      if (c.kind === "finish" && s.stepIndex !== TIMBER_STEPS.length)
        throw new Error("Completa los capítulos antes de finalizar.");
      if (
        c.kind === "advance" &&
        (s.status !== "active" || !step || step.id !== c.stepId || step.kind)
      )
        throw new Error(
          "Completa primero la acción confirmada del paso actual.",
        );
      const closing = c.kind === "finish" || c.kind === "abandon";
      if (!closing && s.expiresAt < now)
        throw new Error(
          "La práctica caducó. Consulta su estado para limpiarla.",
        );
      if (!closing && Object.keys(s.controlOperations).length >= 512)
        throw new Error(
          "Se alcanzó el límite de cambios de sesión. Abandona y vuelve a iniciar.",
        );
      const updated: StoredTutorial = {
        ...s,
        status: closing
          ? "closing"
          : c.kind === "pause"
            ? "paused"
            : c.kind === "resume"
              ? "active"
              : s.status,
        stepIndex: s.stepIndex + (c.kind === "advance" ? 1 : 0),
        revision: s.revision + 1,
        controlOperations: {
          ...s.controlOperations,
          [c.operationId]: signature,
        },
        lastActivityAt: now,
        expiresAt: sevenDays(now),
        ...(closing
          ? {
              cleanupGoal:
                c.kind === "finish"
                  ? ("completed" as const)
                  : ("abandoned" as const),
            }
          : {}),
      };
      tx.set(ref, updated);
      return updated;
    });
    return {
      state:
        next.status === "closing"
          ? await this.cleanup(uid, next)
          : await this.state(uid, await this.refreshQuote(uid, next)),
      acknowledged: true,
    };
  }
  async handle(uid: string, raw: unknown): Promise<TutorialReply> {
    const e = object(raw, {
        action: oneOf([
          "current",
          "control",
          "business",
          "command",
          "status",
          "list",
          "report",
        ]),
        sourceBusinessId: identifier,
        payload: (v) => v,
      }),
      sourceId = e.sourceBusinessId as string;
    if (e.action === "current") {
      object(e.payload, {});
      return { state: await this.current(uid, sourceId) };
    }
    if (e.action === "control") return this.control(uid, sourceId, e.payload);
    const p = e.payload as Record<string, unknown>;
    if (!p || typeof p !== "object" || Array.isArray(p))
      throw new Error("Solicitud de práctica inválida.");
    const fields: Record<string, (value: unknown) => unknown> =
      e.action === "business"
        ? { sessionId: identifier }
        : e.action === "report"
          ? {
              sessionId: identifier,
              from: (v: unknown) => text(v, 10, 10),
              to: (v: unknown) => text(v, 10, 10),
            }
          : e.action === "list"
            ? { sessionId: identifier, query: (v: unknown) => v }
            : { sessionId: identifier, command: (v: unknown) => v };
    const input = object(p, fields),
      s = await this.stored(uid, sourceId, input.sessionId as string);
    if (
      !s.practiceBusinessId ||
      !["active", "paused"].includes(s.status) ||
      s.expiresAt < new Date().toISOString()
    )
      throw new Error(
        "Consulta el estado de la práctica para reanudarla o limpiarla.",
      );
    const access = { sessionId: s.id, sourceBusinessId: sourceId },
      queries = new WorkspaceQueries(this.db, access);
    await queries.owner(uid, s.practiceBusinessId);
    if (e.action === "business") return { state: await this.state(uid, s) };
    if (e.action === "report") {
      const report = await queries.report(
        uid,
        s.practiceBusinessId,
        input.from as string,
        input.to as string,
      );
      return { state: await this.state(uid, s), report };
    }
    if (e.action === "list") {
      const query = input.query as { businessId?: string };
      if (query?.businessId !== s.practiceBusinessId)
        throw new Error("La consulta no corresponde a la práctica.");
      const page = await queries.list(uid, query);
      return { state: await this.state(uid, s), page };
    }
    const command = validateWorkspaceCommand(input.command);
    if (command.businessId !== s.practiceBusinessId)
      throw new Error("El comando no corresponde a la práctica.");
    const result =
      e.action === "status"
        ? await queries.status(
            uid,
            command.businessId,
            command.operationId,
            canonical(command),
          )
        : await new WorkspaceService(this.db, access).execute(uid, command);
    return {
      state: await this.state(uid, await this.stored(uid, sourceId, s.id)),
      result,
    };
  }
}
