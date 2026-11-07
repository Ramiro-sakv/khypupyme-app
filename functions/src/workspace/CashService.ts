import { today } from "../../../shared/commerce.js";
import type { CashSession, Method } from "../../../shared/workspace/model.js";
import { money } from "../../../shared/workspace/validation.js";
import type { UnitOfWork } from "./UnitOfWork.js";
import type { Documents } from "./Documents.js";

export class CashService {
  constructor(
    private readonly work: UnitOfWork,
    private readonly operationId: string,
  ) {}
  async current(): Promise<CashSession | null> {
    const control = await this.work.get<{ activeId: string | null }>(
      "cashControl",
      "current",
    );
    return control?.activeId
      ? this.work.get<CashSession>("cashSessions", control.activeId)
      : null;
  }
  async open(amountMinor: number) {
    if (await this.current())
      throw new Error("Ya existe una caja abierta en este negocio.");
    const session: CashSession = {
      id: this.operationId,
      openedAt: this.work.now,
      openingMinor: amountMinor,
      balanceMinor: amountMinor,
      status: "open",
      closedAt: "",
      countedMinor: null,
      differenceMinor: null,
      reason: "",
      createdAt: this.work.now,
    };
    this.work.set("cashSessions", session.id, session);
    this.work.set("cashControl", "current", { activeId: session.id });
    return session;
  }
  async post(
    amountMinor: number,
    method: Method,
    source: string,
    reference: string,
    suffix = "payment",
  ) {
    if (!Number.isSafeInteger(amountMinor) || Math.abs(amountMinor) > 1e12)
      throw new Error("Movimiento monetario fuera de límites.");
    if (amountMinor === 0) return;
    let session: CashSession | null = null;
    if (method === "cash") {
      session = await this.current();
      if (!session || session.status !== "open")
        throw new Error(
          "Abre la caja del negocio antes de registrar efectivo.",
        );
      session = {
        ...session,
        balanceMinor: money(session.balanceMinor + amountMinor),
      };
      this.work.set("cashSessions", session.id, session);
    }
    const id = `${this.operationId}-${suffix}`;
    this.work.set("cashEntries", id, {
      id,
      sessionId: session?.id ?? "",
      method,
      source,
      reference,
      amountMinor,
      date: today(),
      createdAt: this.work.now,
      authorUid: this.work.uid,
    });
  }
  async close(countedMinor: number, reason: string, documents: Documents) {
    const session = await this.current();
    if (!session || session.status !== "open")
      throw new Error("No hay una caja abierta.");
    const differenceMinor = countedMinor - session.balanceMinor;
    if (differenceMinor !== 0 && reason.trim().length < 3)
      throw new Error(
        "Explica la diferencia entre el efectivo esperado y contado.",
      );
    this.work.set("cashSessions", session.id, {
      ...session,
      status: "closed",
      closedAt: this.work.now,
      countedMinor,
      differenceMinor,
      reason,
    });
    this.work.set("cashControl", "current", { activeId: null });
    return documents.issue(
      "CAJ",
      "Cierre de caja",
      ["Apertura", "Cierre"],
      [[session.openedAt, this.work.now]],
      [
        { label: "Fondo inicial", minor: session.openingMinor },
        { label: "Efectivo esperado", minor: session.balanceMinor },
        { label: "Efectivo contado", minor: countedMinor },
        { label: "Diferencia", minor: differenceMinor },
      ],
      reason,
    );
  }
}
