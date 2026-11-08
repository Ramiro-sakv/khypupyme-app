import type { Firestore } from "firebase-admin/firestore";
import { AppError } from "../../../shared/app-errors.js";
import { add, compare, decimal, ZERO } from "../../../shared/workspace/exact.js";
import { exactDecimal } from "../../../shared/workspace/timber-measures.js";
import { timberCategory, timberThickness } from "../../../shared/workspace/timber-species.js";
import { timberTotals } from "../../../shared/workspace/timber-groups.js";
import { identifier } from "../../../shared/workspace/validation.js";
import type { TimberStockGroup, TimberStockRow, WorkspaceQuery } from "../../../shared/workspace/model.js";

type Key = [string, string, string, string];
const key = (row: TimberStockRow): Key => [row.lengthMm, row.thicknessMm, row.widthMm, row.id];
function compareKey(a: Key, b: Key) {
  for (let i = 0; i < 3; i++) { const order = compare(decimal(a[i]!, 6), decimal(b[i]!, 6)); if (order) return order; }
  return a[3].localeCompare(b[3]);
}
export class TimberStockQueries {
  constructor(private readonly db: Firestore) { }
  async list(input: WorkspaceQuery) {
    if (!input.itemId || Object.keys(input).some((k) => !["apiVersion", "businessId", "resource", "itemId", "category", "lengthMm", "thicknessMm", "widthMm", "cursor"].includes(k)))
      throw new AppError("Selecciona un producto para consultar sus existencias.");
    const productId = identifier(input.itemId), root = `businesses/${identifier(input.businessId)}`;
    if (!(await this.db.doc(`${root}/timberSpecies/${productId}`).get()).exists) throw new AppError("El producto no pertenece a este negocio.");
    if (input.category !== undefined && !["superShort", "short", "long"].includes(input.category)) throw new AppError("Categoría inválida.");
    let query = this.db.collection(`${root}/timberGroups`).where("speciesId", "==", productId).where("active", "==", true);
    if (input.lengthMm !== undefined) { timberCategory(input.lengthMm); query = query.where("lengthMm", "==", exactDecimal(decimal(input.lengthMm, 6))); }
    if (input.thicknessMm !== undefined) query = query.where("thicknessMm", "==", timberThickness(input.thicknessMm));
    if (input.widthMm !== undefined) query = query.where("widthMm", "==", timberThickness(input.widthMm));
    const docs = await query.limit(10001).get();
    if (docs.size > 10000) throw new AppError("Hay más de 10.000 medidas. Acota largo, espesor o ancho para consultarlas.");
    const rows: TimberStockRow[] = [];
    for (const doc of docs.docs) {
      const group = doc.data() as TimberStockGroup;
      if (!group.pieces || !group.thicknessMm) continue;
      const category = timberCategory(group.lengthMm);
      if (input.category && input.category !== category) continue;
      rows.push({
        id: doc.id, lengthMm: group.lengthMm, thicknessMm: group.thicknessMm, widthMm: group.widthMm, pieces: group.pieces, category,
        volume: timberTotals(group.thicknessMm, { lengthMm: group.lengthMm, widths: [{ widthMm: group.widthMm, pieces: group.pieces }] }).volume
      });
    }
    rows.sort((a, b) => compareKey(key(a), key(b)));
    let cursor: Key | undefined;
    if (input.cursor) {
      try {
        if (typeof input.cursor !== "string" || input.cursor.length > 512) throw new Error();
        const value = JSON.parse(Buffer.from(input.cursor, "base64url").toString("utf8"));
        if (input.cursor.length > 512 || !Array.isArray(value) || value.length !== 4 || value.some((x) => typeof x !== "string")) throw new Error();
        timberCategory(value[0]); timberThickness(value[1]); timberThickness(value[2]); identifier(value[3]);
        cursor = value as Key;
      } catch { throw new AppError("Cursor de existencias inválido. Reinicia el listado."); }
    }
    const page = (cursor ? rows.filter((row) => compareKey(key(row), cursor!) > 0) : rows).slice(0, 101);
    return {
      items: page.slice(0, 100), next: page.length > 100 ? Buffer.from(JSON.stringify(key(page[99]!))).toString("base64url") : null,
      totals: { pieces: rows.reduce((sum, row) => sum + row.pieces, 0), volume: rows.reduce((sum, row) => add(sum, row.volume), ZERO), combinations: rows.length }
    };
  }
}
