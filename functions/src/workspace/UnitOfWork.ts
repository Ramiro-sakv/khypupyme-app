import type {
  DocumentData,
  Firestore,
  Transaction,
} from "firebase-admin/firestore";
import { identifier } from "../../../shared/workspace/validation.js";

/** Se preparan cambios en memoria y se escriben al final: Firestore exige leer antes de escribir. */
export class UnitOfWork {
  private readonly staged = new Map<string, object>();
  private readonly cache = new Map<string, object | null>();
  affected = 0;
  readonly now = new Date().toISOString();
  constructor(
    readonly db: Firestore,
    readonly tx: Transaction,
    readonly businessId: string,
    readonly uid: string,
  ) {}
  path(collection: string, id: string) {
    return `businesses/${identifier(this.businessId)}/${collection}/${identifier(id)}`;
  }
  async getPath<T extends object>(path: string): Promise<T | null> {
    if (this.staged.has(path)) return this.staged.get(path) as T;
    if (this.cache.has(path)) return this.cache.get(path) as T | null;
    const doc = await this.tx.get(this.db.doc(path));
    const data = doc.exists ? { ...doc.data(), id: doc.id } : null;
    this.cache.set(path, data);
    return data as T | null;
  }
  get<T extends object>(collection: string, id: string) {
    return this.getPath<T>(this.path(collection, id));
  }
  setPath(path: string, value: object) {
    this.staged.set(path, value);
  }
  set(collection: string, id: string, value: object) {
    this.setPath(this.path(collection, id), value);
  }
  async list<T extends object>(
    collection: string,
    filters: [string, unknown][],
    max = 100,
  ): Promise<T[]> {
    let query = this.db
      .collection(`businesses/${identifier(this.businessId)}/${collection}`)
      .limit(max + 1);
    for (const [key, value] of filters) query = query.where(key, "==", value);
    const docs = await this.tx.get(query),
      entries = new Map<string, object>();
    for (const doc of docs.docs) {
      const path = doc.ref.path,
        value = this.staged.get(path) ?? { ...doc.data(), id: doc.id };
      this.cache.set(path, value);
      entries.set(path, value);
    }
    const prefix = `businesses/${this.businessId}/${collection}/`;
    for (const [path, value] of this.staged)
      if (path.startsWith(prefix)) entries.set(path, value);
    const results = [...entries.values()].filter((value) =>
      filters.every(
        ([key, expected]) =>
          (value as Record<string, unknown>)[key] === expected,
      ),
    );
    if (results.length > max)
      throw new Error(
        "La operación afecta demasiados registros. Divide la operación o depura los lotes agotados.",
      );
    return results as T[];
  }
  touchStock() {
    if (++this.affected > 100)
      throw new Error(
        "Una operación admite hasta 100 lotes o series. Divide la operación.",
      );
  }
  flush() {
    if (this.staged.size > 450)
      throw new Error(
        "La operación es demasiado grande. Divide sus registros.",
      );
    for (const [path, value] of this.staged)
      this.tx.set(this.db.doc(path), value as DocumentData);
  }
}
