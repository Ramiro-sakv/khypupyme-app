import { validateWorkspaceCommand } from "../../../shared/workspace/validation";
import type { WorkspaceCommand } from "../../../shared/workspace/model";
import type {
  DraftKind,
  DraftRepository,
  DraftVersion,
  TradeDraft,
  TradeDraftInput,
} from "./DraftRepository";
import { DraftConflict } from "./DraftRepository";
import type { WorkspaceIdentity } from "./WorkspaceCommandService";

export class IndexedDbDraftRepository implements DraftRepository {
  private database: Promise<IDBDatabase> | undefined;
  private scope(context: WorkspaceIdentity, kind: DraftKind) {
    return JSON.stringify([context.uid, context.businessId, kind]);
  }
  private open() {
    return (this.database ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("khypupyme-drafts-v1", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("drafts", { keyPath: "scope" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        this.database = undefined;
        reject(new Error("No se pudo abrir el almacén de borradores."));
      };
      request.onblocked = () =>
        reject(
          new Error(
            "Cierra otras ventanas antiguas para abrir los borradores.",
          ),
        );
    }));
  }
  private decode(
    value: unknown,
    context: WorkspaceIdentity,
    kind: DraftKind,
  ): TradeDraft | null {
    if (!value) return null;
    const data = value as TradeDraft;
    if (
      data.version !== 1 ||
      data.scope !== this.scope(context, kind) ||
      data.uid !== context.uid ||
      data.businessId !== context.businessId ||
      data.kind !== kind ||
      !Number.isSafeInteger(data.revision) ||
      data.revision < 1 ||
      typeof data.id !== "string" ||
      !data.input ||
      !Array.isArray(data.input.lines) ||
      data.input.lines.length > 20
    )
      throw new Error("Borrador incompatible. No se cargó ni se modificó.");
    for (const line of data.input.lines) {
      const entry = line.widthsEntry;
      if (
        entry &&
        (entry.version !== 2 ||
          !["imperial", "metric"].includes(entry.system) ||
          !["text", "selection"].includes(entry.source) ||
          typeof entry.text !== "string" ||
          entry.text.length > 20000)
      )
        throw new Error(
          "La captura del borrador no es compatible. El original se conserva y no se enviará.",
        );
    }
    if (
      data.submitted &&
      validateWorkspaceCommand(data.submitted).businessId !== context.businessId
    )
      throw new Error("La solicitud guardada pertenece a otro negocio.");
    return data;
  }
  async get(context: WorkspaceIdentity, kind: DraftKind) {
    const db = await this.open();
    return new Promise<TradeDraft | null>((resolve, reject) => {
      const tx = db.transaction("drafts", "readonly"),
        read = tx.objectStore("drafts").get(this.scope(context, kind));
      tx.oncomplete = () => {
        try {
          resolve(this.decode(read.result, context, kind));
        } catch (e) {
          reject(e);
        }
      };
      tx.onerror = () => reject(new Error("No se pudo leer el borrador."));
      tx.onabort = () => reject(new Error("No se pudo leer el borrador."));
    });
  }
  private async change<T>(
    context: WorkspaceIdentity,
    kind: DraftKind,
    update: (current: TradeDraft | null) => {
      value: TradeDraft | null;
      result: T;
    },
  ) {
    const db = await this.open(),
      scope = this.scope(context, kind);
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction("drafts", "readwrite"),
        store = tx.objectStore("drafts"),
        read = store.get(scope);
      let result: T, error: unknown;
      read.onsuccess = () => {
        try {
          const changed = update(this.decode(read.result, context, kind));
          result = changed.result;
          if (changed.value) store.put(changed.value);
          else store.delete(scope);
        } catch (e) {
          error = e;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () =>
        reject(error ?? new Error("No se pudo guardar el borrador."));
      tx.onabort = () =>
        reject(error ?? new Error("No se pudo guardar el borrador."));
    });
  }
  private compare(current: TradeDraft | null, expected: DraftVersion | null) {
    if (
      current
        ? current.id !== expected?.id || current.revision !== expected.revision
        : expected !== null
    )
      throw new DraftConflict(current);
  }
  private validate(input: TradeDraftInput) {
    if (
      input.lines.length > 20 ||
      new TextEncoder().encode(JSON.stringify(input)).length > 160000
    )
      throw new Error(
        "El borrador supera el tamaño permitido. Reduce las líneas o referencias.",
      );
    for (const line of input.lines) {
      if (
        !Number.isSafeInteger(line.priceMinor) ||
        line.priceMinor < 1 ||
        line.priceMinor > 1e12 ||
        ![line.itemId, line.qty, line.cost, line.lot, line.expiresOn].every(
          (v) => typeof v === "string" && v.length <= 128,
        ) ||
        line.serials.length > 100 ||
        line.serials.some((s) => typeof s !== "string" || s.length > 80)
      )
        throw new Error("Revisa los campos y series del borrador.");
    }
  }
  save(
    context: WorkspaceIdentity,
    kind: DraftKind,
    input: TradeDraftInput,
    expected: DraftVersion | null,
  ) {
    this.validate(input);
    return this.change(context, kind, (current) => {
      this.compare(current, expected);
      if (current?.submitted)
        throw new Error(
          "Resuelve la solicitud enviada antes de cambiar su borrador.",
        );
      const value: TradeDraft = {
        version: 1,
        scope: this.scope(context, kind),
        ...context,
        kind,
        id: current?.id ?? crypto.randomUUID(),
        revision: (current?.revision ?? 0) + 1,
        updatedAt: new Date().toISOString(),
        input: structuredClone(input),
        submitted: null,
      };
      return { value, result: value };
    });
  }
  link(
    context: WorkspaceIdentity,
    kind: DraftKind,
    expected: DraftVersion,
    command: WorkspaceCommand,
  ) {
    return this.change(context, kind, (current) => {
      this.compare(current, expected);
      if (
        !current ||
        current.submitted ||
        command.businessId !== context.businessId
      )
        throw new Error("El borrador cambió o ya fue enviado.");
      const value = {
        ...current,
        revision: current.revision + 1,
        submitted: structuredClone(command),
        updatedAt: new Date().toISOString(),
      };
      return { value, result: value };
    });
  }
  unlink(
    context: WorkspaceIdentity,
    kind: DraftKind,
    expected: DraftVersion,
    operationId: string,
  ) {
    return this.change(context, kind, (current) => {
      this.compare(current, expected);
      if (!current || current.submitted?.operationId !== operationId)
        throw new Error("El borrador no corresponde a esta solicitud.");
      const value = {
        ...current,
        revision: current.revision + 1,
        submitted: null,
        updatedAt: new Date().toISOString(),
      };
      return { value, result: value };
    });
  }
  async remove(
    context: WorkspaceIdentity,
    kind: DraftKind,
    expected: DraftVersion,
  ) {
    await this.change(context, kind, (current) => {
      this.compare(current, expected);
      if (current?.submitted)
        throw new Error(
          "Consulta la solicitud enviada antes de descartar este borrador.",
        );
      return { value: null, result: undefined };
    });
  }
  async purgeRemoved(uid: string, ids: string[]) {
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("drafts", "readwrite"),
        store = tx.objectStore("drafts");
      for (const businessId of ids)
        for (const kind of ["sale", "purchase", "quote"] as const)
          store.delete(this.scope({ uid, businessId }, kind));
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () =>
        reject(
          new Error(
            "No se pudieron retirar los borradores de negocios eliminados.",
          ),
        );
    });
  }
  async removeLinked(context: WorkspaceIdentity, operationId: string) {
    for (const kind of ["sale", "purchase", "quote"] as const)
      await this.change(context, kind, (current) => ({
        value: current?.submitted?.operationId === operationId ? null : current,
        result: undefined,
      }));
  }
}
export const draftRepository = new IndexedDbDraftRepository();
