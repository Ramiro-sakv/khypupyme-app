import type { Item, WorkspaceCommand } from "../../../shared/workspace/model";
import type { CartLine } from "./Cart";
import type {
  DraftKind,
  DraftRepository,
  TradeDraft,
  TradeDraftInput,
} from "./DraftRepository";
import type { PendingRequestStore } from "./PendingRequestStore";
import type { WorkspaceIdentity } from "./WorkspaceCommandService";
import type { WorkspaceRepository } from "./WorkspaceRepository";
export interface RestoredTrade {
  draft: TradeDraft;
  lines: CartLine[];
  priceChanges: { name: string; before: number; after: number }[];
  requiresNewQuote: boolean;
  serialsCleared: boolean;
}
export class TradeDraftService {
  private saved: TradeDraft | null = null;
  private sequence: Promise<unknown> = Promise.resolve();
  readonly context: WorkspaceIdentity;
  constructor(
    private readonly drafts: DraftRepository,
    private readonly repository: WorkspaceRepository,
    private readonly pending: PendingRequestStore,
    context: WorkspaceIdentity,
    readonly kind: DraftKind,
  ) {
    this.context = Object.freeze({ ...context });
  }
  get current() {
    return this.saved;
  }
  private enqueue<T>(task: () => Promise<T>) {
    const next = this.sequence.then(task);
    this.sequence = next.catch(() => {});
    return next;
  }
  async load() {
    this.saved = await this.drafts.get(this.context, this.kind);
    return this.saved;
  }
  save(input: TradeDraftInput) {
    return this.enqueue(async () => {
      this.saved = await this.drafts.save(
        this.context,
        this.kind,
        input,
        this.saved,
      );
      return this.saved;
    });
  }
  replace(input: TradeDraftInput) {
    return this.enqueue(async () => {
      const current = await this.drafts.get(this.context, this.kind);
      this.saved = await this.drafts.save(
        this.context,
        this.kind,
        input,
        current,
      );
      return this.saved;
    });
  }
  discard() {
    return this.enqueue(async () => {
      if (this.saved)
        await this.drafts.remove(this.context, this.kind, this.saved);
      this.saved = null;
    });
  }
  async inspect(): Promise<RestoredTrade> {
    if (!navigator.onLine)
      throw new Error(
        "Conéctate para consultar los productos actuales antes de restaurar.",
      );
    if (await this.pending.get(this.context.uid, this.context.businessId))
      throw new Error(
        "Resuelve primero la solicitud pendiente de este negocio.",
      );
    const draft = await this.drafts.get(this.context, this.kind);
    if (!draft) throw new Error("El borrador ya no existe.");
    if (draft.submitted)
      throw new Error(
        "Consulta el resultado de la solicitud enviada antes de restaurarla.",
      );
    const business = await this.repository.business(this.context.businessId);
    if (business.ownerUid !== this.context.uid)
      throw new Error("El negocio no corresponde a esta cuenta.");
    if (draft.input.origin) {
      const origin = draft.input.origin;
      const record = (
        await this.repository.list<{
          revision: number;
          saleId?: string;
          customerId: string;
          customerName: string;
        }>({
          apiVersion: 2,
          businessId: this.context.businessId,
          resource:
            origin.kind === "appointment" ? "appointments" : "workOrders",
          id: origin.id,
        })
      ).items[0];
      if (
        !record ||
        record.saleId ||
        record.revision !== origin.revision ||
        record.customerId !== draft.input.customerId ||
        record.customerName !== draft.input.customerName
      )
        throw new Error(
          "La atención u orden del borrador cambió o ya fue vendida. Conserva este borrador y vuelve a revisar su origen.",
        );
    }
    const priceChanges: RestoredTrade["priceChanges"] = [];
    const lines = await Promise.all(
      draft.input.lines.map(async (line) => {
        const item = (
          await this.repository.list<Item>({
            apiVersion: 2,
            businessId: this.context.businessId,
            resource: "items",
            id: line.itemId,
          })
        ).items[0];
        if (!item || !item.active)
          throw new Error(
            "Un producto del borrador no existe o está archivado. Revisa el catálogo antes de restaurar.",
          );
        if (!item.units[line.unit])
          throw new Error(
            "Una unidad del borrador ya no es compatible. No se modificó el original.",
          );
        if (item.priceMinor !== line.priceMinor)
          priceChanges.push({
            name: item.name,
            before: line.priceMinor,
            after: item.priceMinor,
          });
        return {
          item,
          qty: line.qty,
          unit: line.unit,
          cost: line.cost,
          lot: line.lot,
          expiresOn: line.expiresOn,
          serials: this.kind === "purchase" ? [...line.serials] : [],
          fullBoxes: line.fullBoxes,
          wastePercent: line.wastePercent,
        };
      }),
    );
    return {
      draft,
      lines,
      priceChanges,
      requiresNewQuote: !!draft.input.quoteId && priceChanges.length > 0,
      serialsCleared:
        this.kind !== "purchase" &&
        lines.some((line) => line.item.kind === "appliance"),
    };
  }
  accept(restored: RestoredTrade) {
    this.saved = restored.draft;
  }
  beforeSubmit(input: TradeDraftInput, command: WorkspaceCommand) {
    return this.enqueue(async () => {
      if (!navigator.onLine)
        throw new Error("Recupera la conexión antes de confirmar.");
      if (await this.pending.get(this.context.uid, this.context.businessId))
        throw new Error("Resuelve primero la solicitud pendiente.");
      this.saved = await this.drafts.save(
        this.context,
        this.kind,
        input,
        this.saved,
      );
      this.saved = await this.drafts.link(
        this.context,
        this.kind,
        this.saved,
        command,
      );
      return this.saved;
    });
  }
  failed(command: WorkspaceCommand, rejected = false) {
    return this.enqueue(async () => {
      const pending = await this.pending.get(
        this.context.uid,
        this.context.businessId,
      );
      // La ausencia del registro no demuestra rechazo: otra pestaña pudo confirmar.
      if (
        rejected &&
        !pending &&
        this.saved?.submitted?.operationId === command.operationId
      )
        this.saved = await this.drafts.unlink(
          this.context,
          this.kind,
          this.saved,
          command.operationId,
        );
      return this.saved;
    });
  }
  async confirmed(command: WorkspaceCommand) {
    await this.sequence;
    await this.drafts.removeLinked(this.context, command.operationId);
    // Otra pestaña puede haber comenzado un borrador nuevo: no adoptar su revisión.
    this.saved = null;
  }
  async inspectSubmission() {
    const draft = this.saved?.submitted
      ? this.saved
      : await this.drafts.get(this.context, this.kind);
    this.saved = draft;
    if (!draft?.submitted)
      throw new Error("Este borrador no tiene una solicitud enviada.");
    const result = await this.repository.status(draft.submitted);
    if (result) {
      await this.drafts.removeLinked(this.context, draft.submitted.operationId);
      this.saved = null;
    }
    return { draft, result };
  }
}
