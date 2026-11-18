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
  apply: (store: IDBObjectStore, value: T | undefined, transaction: IDBTransaction) => R,
  writableScope?: string): Promise<R> {
  const db = await database();
  const stores: Store[] = mode === "readwrite" && (name === "pending" || writableScope) ? ["pending", "drafts"] : [name];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    const store = tx.objectStore(name);
    const request = store.get(key);
    let result: R;
    let failure: unknown;
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(failure ?? tx.error);
    function applyChange() {
      try { result = apply(store, request.result as T | undefined, tx); }
      catch (error) { failure = error; tx.abort(); }
    }
    request.onsuccess = () => {
      if (!writableScope) { applyChange(); return; }
      const retired = tx.objectStore("pending").get("retired:" + writableScope);
      retired.onsuccess = () => {
        if (retired.result) { failure = new Error("La práctica ya fue eliminada. Vuelve al negocio."); tx.abort(); }
        else applyChange();
      };
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
  }, key.slice(0, key.lastIndexOf(":")));
}

export function pendingRequest(scope: string) {
  return edit<PendingRecord, PendingRecord | undefined>("pending", scope, "readonly", (_, value) => value);
}

export function clearPracticeScope(scope: string) {
  return edit<PendingRecord, void>("pending", scope, "readwrite", (store, _, tx) => {
    store.delete(scope);
    store.put(true, "retired:" + scope);
    const drafts = tx.objectStore("drafts");
    for (const kind of ["sale", "purchase", "quote"]) drafts.delete(scope + ":" + kind);
  });
}

export function reserveRequest(record: PendingRecord) {
  return edit<PendingRecord, PendingRecord>("pending", record.scope, "readwrite", (store, current) => {
    if (current) return current;
    store.add(record, record.scope);
    return record;
  }, record.scope);
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
