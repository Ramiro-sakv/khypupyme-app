import { canonical } from "../../../shared/commerce";
import type { WorkspaceCommand } from "../../../shared/workspace/model";
import type { PendingRequestStore } from "./PendingRequestStore";
import type { NewBusiness } from "./WorkspaceRepository";

export type SavedRequest = {
  scope: string;
  uid: string;
  businessId: string;
  request: WorkspaceCommand | NewBusiness;
  creation: boolean;
};
// El registro conserva solicitudes inciertas. Nunca ejecuta ni reenvía operaciones.
export class OperationJournal implements PendingRequestStore {
  private database: Promise<IDBDatabase> | undefined;
  private open() {
    return (this.database ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("khypupyme-workspaces-v2", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("requests", { keyPath: "scope" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(
          new Error(
            "No se puede abrir el registro local. Habilita el almacenamiento de la aplicación.",
          ),
        );
    }));
  }
  private async access<T>(
    mode: IDBTransactionMode,
    callback: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("requests", mode),
        request = callback(tx.objectStore("requests"));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () =>
        reject(
          new Error("No se pudo conservar la solicitud en este dispositivo."),
        );
      tx.onabort = () =>
        reject(
          new Error("No se pudo conservar la solicitud en este dispositivo."),
        );
    });
  }
  scope(uid: string, businessId: string) {
    return `${uid}:${businessId}`;
  }
  get(uid: string, businessId: string) {
    return this.access<SavedRequest | undefined>("readonly", (s) =>
      s.get(this.scope(uid, businessId)),
    );
  }
  async save(
    uid: string,
    businessId: string,
    request: WorkspaceCommand | NewBusiness,
    creation = false,
  ) {
    const db = await this.open(),
      scope = this.scope(uid, businessId);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("requests", "readwrite"),
        store = tx.objectStore("requests"),
        read = store.get(scope);
      let conflict = false;
      read.onsuccess = () => {
        if (read.result) {
          conflict = true;
          tx.abort();
          return;
        }
        store.add({
          scope,
          uid,
          businessId,
          request,
          creation,
        } satisfies SavedRequest);
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () =>
        reject(
          new Error(
            conflict
              ? "Otra pestaña ya conserva una solicitud pendiente en este negocio. Vuelve a abrir este espacio para resolverla."
              : "No se pudo conservar la solicitud. No se envió al servidor.",
          ),
        );
      tx.onerror = () =>
        reject(
          new Error(
            "No se pudo conservar la solicitud. No se envió al servidor.",
          ),
        );
    });
  }

  async clear(
    uid: string,
    businessId: string,
    expected?: WorkspaceCommand | NewBusiness,
  ) {
    const db = await this.open(),
      scope = this.scope(uid, businessId);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("requests", "readwrite"),
        store = tx.objectStore("requests"),
        read = store.get(scope);
      read.onsuccess = () => {
        if (
          read.result &&
          (!expected || canonical(read.result.request) === canonical(expected))
        )
          store.delete(scope);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(
          new Error(
            "No se pudo limpiar el registro local. Consulta su estado.",
          ),
        );
      tx.onabort = () =>
        reject(
          new Error(
            "No se pudo limpiar el registro local. Consulta su estado.",
          ),
        );
    });
  }
}
export const operationJournal = new OperationJournal();
