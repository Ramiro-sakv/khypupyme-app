import { canonical } from "../../../../shared/commerce";
import type { TutorialControl } from "../../../../shared/workspace/timber-tutorial";
export class TutorialControlStore {
  private database: Promise<IDBDatabase> | undefined;
  private open() {
    return (this.database ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("khypupyme-tutorial-control-v1", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("requests");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        this.database = undefined;
        reject(
          new Error(
            "Habilita el almacenamiento local para conservar esta solicitud.",
          ),
        );
      };
    }));
  }
  private key(uid: string, businessId: string) {
    return JSON.stringify([uid, businessId]);
  }
  async get(uid: string, businessId: string) {
    const db = await this.open();
    return new Promise<TutorialControl | null>((resolve, reject) => {
      const tx = db.transaction("requests", "readonly"),
        r = tx.objectStore("requests").get(this.key(uid, businessId));
      tx.oncomplete = () => resolve(r.result ?? null);
      tx.onabort = tx.onerror = () =>
        reject(new Error("No se pudo leer la solicitud de tutorial."));
    });
  }
  async save(uid: string, businessId: string, request: TutorialControl) {
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("requests", "readwrite"),
        store = tx.objectStore("requests"),
        key = this.key(uid, businessId),
        r = store.get(key);
      r.onsuccess = () => {
        if (r.result && canonical(r.result) !== canonical(request)) {
          tx.abort();
          return;
        }
        store.put(request, key);
      };
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () =>
        reject(
          new Error(
            "Otra pestaña conserva una solicitud de tutorial. Consúltala antes de continuar.",
          ),
        );
    });
  }
  async clear(uid: string, businessId: string, request: TutorialControl) {
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("requests", "readwrite"),
        store = tx.objectStore("requests"),
        key = this.key(uid, businessId),
        r = store.get(key);
      r.onsuccess = () => {
        if (r.result && canonical(r.result) === canonical(request))
          store.delete(key);
      };
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () =>
        reject(new Error("No se pudo confirmar la limpieza local."));
    });
  }
}
export const tutorialControlStore = new TutorialControlStore();
