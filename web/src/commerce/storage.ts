import type { Command } from "./models";

export type DraftStamp = { key: string; revision: string };
export type DraftRecord<T> = DraftStamp & { value: T };
export type PendingRecord = { scope: string; command: Command; draft?: DraftStamp };
type Store = "drafts" | "pending";

let opened: Promise<IDBDatabase> | undefined;
function database() {
  opened ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("khypupyme2-commerce", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("drafts");
      request.result.createObjectStore("pending");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { opened = undefined; reject(request.error); };
  });
  return opened;
}

async function edit<T, R>(name: Store, key: string, mode: IDBTransactionMode,
  apply: (store: IDBObjectStore, value: T | undefined, transaction: IDBTransaction) => R): Promise<R> {
  const db = await database();
  const stores: Store[] = name === "pending" && mode === "readwrite" ? ["pending", "drafts"] : [name];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    const store = tx.objectStore(name);
    const request = store.get(key);
    let result: R;
    let failure: unknown;
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(failure ?? tx.error);
    request.onsuccess = () => {
      try { result = apply(store, request.result as T | undefined, tx); }
      catch (error) { failure = error; tx.abort(); }
    };
  });
}

export function readDraft<T>(key: string) {
  return edit<DraftRecord<T>, DraftRecord<T> | undefined>("drafts", key, "readonly", (_, value) => value);
}

export function saveDraft<T>(key: string, value: T, expected: string | undefined) {
  return edit<DraftRecord<T>, DraftStamp>("drafts", key, "readwrite", (store, current) => {
    if (current?.revision !== expected) throw new Error("El borrador guardado cambió en otra ventana. Carga su versión antes de continuar.");
    const stamp = { key, revision: crypto.randomUUID() };
    store.put({ ...stamp, value }, key);
    return stamp;
  });
}

export function pendingRequest(scope: string) {
  return edit<PendingRecord, PendingRecord | undefined>("pending", scope, "readonly", (_, value) => value);
}

export function reserveRequest(record: PendingRecord) {
  return edit<PendingRecord, PendingRecord>("pending", record.scope, "readwrite", (store, current) => {
    if (current) return current;
    store.add(record, record.scope);
    return record;
  });
}

export function clearRequest(record: PendingRecord, confirmed: boolean) {
  return edit<PendingRecord, void>("pending", record.scope, "readwrite", (store, current, tx) => {
    if (current?.command.operationId !== record.command.operationId) return;
    store.delete(record.scope);
    const stamp = current.draft;
    if (!confirmed || !stamp) return;
    const drafts = tx.objectStore("drafts");
    const get = drafts.get(stamp.key);
    get.onsuccess = () => {
      if ((get.result as DraftStamp | undefined)?.revision === stamp.revision) drafts.delete(stamp.key);
    };
  });
}
