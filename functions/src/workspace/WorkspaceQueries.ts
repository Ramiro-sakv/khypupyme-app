import { TimberStockQueries } from "./TimberStockQueries.js";
import { IndustryQueries } from "./IndustryQueries.js";
import { withMassUnits } from "../../../shared/workspace/catalog.js";
import { timberSpeciesItem } from "../../../shared/workspace/timber-species.js";
import { timberVariantId } from "./TimberSpeciesService.js";
import { timberThickness } from "../../../shared/workspace/timber-species.js";
import { timberCategory } from "../../../shared/workspace/timber-species.js";
import { timberTotals } from "../../../shared/workspace/timber-groups.js";
import type { TimberStockGroup, TimberSummary } from "../../../shared/workspace/model.js";
import { authorizePracticeRead } from "./TutorialAccess.js";
import type { PracticeAccess } from "./TutorialAccess.js";
import { normalizeSearch } from "../../../shared/workspace/search.js";
import type {
  DocumentData,
  Firestore,
  Query,
  Transaction,
} from "firebase-admin/firestore";

import { add, compare, ZERO } from "../../../shared/workspace/exact.js";
import type {
  Item,
  WorkspaceQuery,
  WorkspaceReport,
  WorkspaceResource,
} from "../../../shared/workspace/model.js";
import {
  date,
  identifier,
  text,
} from "../../../shared/workspace/validation.js";
import { businessView } from "./AccountService.js";
import { CommerceQueries } from "../CommerceQueries.js";

export const RESOURCES: WorkspaceResource[] = [
  "timberStock",
  "auditEvents",
  "timberSummary",
  "appointments",
  "workOrders",
  "workflowEvents",
  "deliveries",
  "containerTypes",
  "containerBalances",
  "containerMovements",
  "timberSpecies",
  "items",
  "salesV2",
  "purchasesV2",
  "returns",
  "quotes",
  "customersV2",
  "expensesV2",
  "expenseReversals",
  "debts",
  "paymentsV2",
  "cashSessions",
  "cashEntries",
  "documentsV2",
  "warrantyClaims",
  "movementsV2",
  "serials",
  "serialHistory",
  "saleAvailability",
  "setupProgress",
  "timberGroups",
  "lots",
  "inventoryMovements",
  "products",
  "sales",
  "purchases",
  "expenses",
  "receivables",
];
export function serialize(value: unknown): unknown {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  )
    return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    const result = Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, serialize(v)]),
    );
    if (Array.isArray(result.columns) && Array.isArray(result.rows))
      result.rows = result.rows.map((row: unknown) =>
        row &&
        typeof row === "object" &&
        !Array.isArray(row) &&
        "cells" in row &&
        Array.isArray(row.cells)
          ? row.cells
          : row,
      );
    return result;
  }
  return value;
}
export class WorkspaceQueries {
  constructor(
    readonly db: Firestore,
    private readonly practiceAccess?: PracticeAccess,
  ) {}
  async owner(uid: string, businessId: string) {
    const doc = await this.db.doc(`businesses/${identifier(businessId)}`).get();
    if (!doc.exists || doc.data()?.ownerUid !== uid)
      throw new Error("No tienes acceso a este negocio.");
    await authorizePracticeRead(
      this.db,
      uid,
      businessId,
      doc.data()!,
      this.practiceAccess,
    );
    return businessView(doc.id, doc.data()!);
  }
  async list(uid: string, raw: unknown) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new Error("Consulta inválida.");
    const input = raw as WorkspaceQuery & { barcode?: string; status?: string };
    if (
      Object.keys(input).some(
        (key) =>
          ![
            "apiVersion",
            "businessId",
            "resource",
            "id",
            "cursor",
            "itemId",
            "lengthMm",
            "thicknessMm",
            "widthMm",
            "category",
            "from",
            "to",
            "barcode",
            "status",
            "search",
            "recordId",
            "expiresBefore",
            "active",
            "reorder",
            "variantModel",
            "serialNumber",
          ].includes(key),
      ) ||
      input.apiVersion !== 2 ||
      !RESOURCES.includes(input.resource)
    )
      throw new Error("Consulta desconocida.");
    const business = await this.owner(uid, input.businessId);
    const collection = (name: string) => this.db.collection(`businesses/${input.businessId}/${name}`);
    if (input.resource === "setupProgress") {
      if (Object.keys(input).some((key) => !["apiVersion", "businessId", "resource"].includes(key)))
        throw new Error("Consulta de primeros pasos inválida.");
      return new IndustryQueries(collection).setupProgress(business);
    }
    if (input.resource === "serialHistory" || input.resource === "saleAvailability") {
      const serial = input.resource === "serialHistory";
      if (business.industryId !== (serial ? "appliances" : "convenience") ||
          Object.keys(input).some((key) => !["apiVersion", "businessId", "resource", "id"].includes(key)))
        throw new Error("Consulta especializada no disponible para este negocio.");
      const queries = new IndustryQueries(collection);
      return serial ? queries.equipmentHistory(input.id) : queries.saleAvailability(input.id);
    }
    if (input.reorder !== undefined && (business.industryId !== "convenience" || input.resource !== "items" || input.reorder !== true || input.active !== true))
      throw new Error("Reposición requiere productos activos de la tienda.");
    if (input.variantModel !== undefined && (business.industryId !== "clothing" || input.resource !== "items" || input.active !== true))
      throw new Error("El modelo solo filtra variantes activas de ropa.");
    if (input.serialNumber !== undefined && (business.industryId !== "appliances" || input.resource !== "serials"))
      throw new Error("La búsqueda por serie solo está disponible para electrodomésticos.");
    if (input.resource === "timberStock") return new TimberStockQueries(this.db).list(input);
    if (input.widthMm !== undefined) throw new Error("El ancho solo filtra las existencias detalladas.");
    if (input.resource === "timberSummary") {
      if (!input.itemId || Object.keys(input).some((key) => !["apiVersion", "businessId", "resource", "itemId", "cursor", "category", "thicknessMm"].includes(key)))
        throw new Error("Indica la especie para consultar su resumen.");
      if (input.category && !["superShort", "short", "long"].includes(input.category)) throw new Error("Categoría de madera inválida.");
      const thickness = input.thicknessMm ? timberThickness(input.thicknessMm) : "";
      const speciesId = identifier(input.itemId);
      if (!(await this.db.doc(`businesses/${input.businessId}/timberSpecies/${speciesId}`).get()).exists)
        throw new Error("La especie no pertenece a este negocio.");
      const groups = await this.db.collection(`businesses/${input.businessId}/timberGroups`).where("speciesId", "==", speciesId).limit(10001).get();
      if (groups.size > 10000) throw new Error("El resumen supera 10.000 medidas. Requiere una consulta más acotada.");
      const rows = new Map<string, TimberSummary>();
      for (const doc of groups.docs) {
        const group = doc.data() as TimberStockGroup & { thicknessMm: string };
        if (!group.pieces) continue;
        const category = timberCategory(group.lengthMm), id = category + "-" + group.thicknessMm.replace(".", "_");
        const previous = rows.get(id), volume = timberTotals(group.thicknessMm, { lengthMm: group.lengthMm, widths: [{ widthMm: group.widthMm, pieces: group.pieces }] }).volume;
        rows.set(id, { id, thicknessMm: group.thicknessMm, category, pieces: (previous?.pieces ?? 0) + group.pieces, volume: add(previous?.volume ?? ZERO, volume) });
      }
      const all = [...rows.values()].filter((row) => (!input.category || row.category === input.category) && (!thickness || row.thicknessMm === thickness)).sort((a, b) => a.id.localeCompare(b.id));
      const offset = input.cursor ? all.findIndex((row) => row.id === identifier(input.cursor)) + 1 : 0;
      if (input.cursor && !offset) throw new Error("Las existencias cambiaron. Reinicia el resumen.");
      return { items: all.slice(offset, offset + 25), next: all.length > offset + 25 ? all[offset + 24]!.id : null };
    }
    if (input.category !== undefined) throw new Error("La categoría solo filtra el resumen de madera.");
    const root = collection(input.resource);
    const row = (doc: { id: string; data: () => DocumentData | undefined }) => {
      const data = { ...(serialize(doc.data()) as object), id: doc.id };
      return input.resource === "items" ? withMassUnits(data as Item) : data;
    };
    if (input.id) {
      const doc = await root.doc(identifier(input.id)).get();
      return {
        items: doc.exists
          ? [row(doc)]
          : [],
        next: null,
      };
    }
    if (input.barcode !== undefined) {
      if (input.resource !== "items")
        throw new Error("Consulta de código inválida.");
      const { hashKey } = await import("./InventoryService.js"),
        index = await this.db
          .doc(
            `businesses/${input.businessId}/barcodeIndex/${hashKey(text(input.barcode, 1, 40))}`,
          )
          .get();
      if (!index.exists || index.data()!.retired) return { items: [], next: null };
      if (index.data()!.timberSpeciesId) {
        const product = await this.db.doc(`businesses/${input.businessId}/timberSpecies/${identifier(index.data()!.timberSpeciesId)}`).get();
        return { items: product.exists ? [timberSpeciesItem({ ...product.data(), id: product.id } as import("../../../shared/workspace/model.js").TimberSpecies)] : [], next: null };
      }
      const doc = await root.doc(index.data()!.itemId).get();
      return {
        items: doc.exists ? [row(doc)] : [],
        next: null,
      };
    }
    let query: Query = root;
    if (input.variantModel !== undefined) {
      query = query.where("kind", "==", "apparel").where("fields.model", "==", text(input.variantModel, 1, 80));
    }
    if (input.serialNumber !== undefined) query = query.where("serial", "==", text(input.serialNumber, 1, 80));
    if (input.active !== undefined) {
      if (
        !["items", "customersV2", "timberGroups", "timberSpecies"].includes(input.resource) ||
        typeof input.active !== "boolean"
      )
        throw new Error(
          "El filtro de activos solo admite catálogo, clientes o medidas, con valor verdadero o falso.",
        );
      query = query.where("active", "==", input.active);
    }
    if (input.recordId) {
      if (input.resource !== "workflowEvents")
        throw new Error("Filtro de historial inválido.");
      query = query.where("recordId", "==", identifier(input.recordId));
    }
    if (input.expiresBefore) {
      if (input.resource !== "lots" || input.from || input.to)
        throw new Error("Filtro de vencimiento inválido.");
      query = query
        .where("available", "==", true)
        .where("expiresOn", ">", "")
        .where("expiresOn", "<=", date(input.expiresBefore))
        .orderBy("expiresOn", "asc");
    }
    if (input.search && input.resource === "customersV2") {
      const needle = normalizeSearch(text(input.search, 2, 40));
      const all = await root.orderBy("name").limit(10001).get();
      if (all.size > 10000)
        throw new Error(
          "La búsqueda de clientes supera el límite de 10.000 registros.",
        );
      const matches = all.docs.filter(
        (doc) =>
          (input.active === undefined || doc.data().active === input.active) &&
          normalizeSearch(String(doc.data().name))
            .split(/\s+/)
            .some((_, i, a) => a.slice(i).join(" ").startsWith(needle)),
      );
      const offset = input.cursor
        ? matches.findIndex((doc) => doc.id === identifier(input.cursor)) + 1
        : 0;
      if (input.cursor && !offset)
        throw new Error("La lista cambió. Reinicia la búsqueda.");
      const page = matches.slice(offset, offset + 26);
      return {
        items: page
          .slice(0, 25)
          .map((doc) => ({ ...(serialize(doc.data()) as object), id: doc.id })),
        next: page.length > 25 ? page[24]!.id : null,
      };
    }
    const saleSearch = input.search && input.resource === "salesV2"
      ? normalizeSearch(text(input.search, 2, 40)) : "";
    if (saleSearch && /^ven-\d{4}-\d{6}$/.test(saleSearch)) {
      query = query.where("number", "==", saleSearch.toUpperCase());
    }
    if (input.search && !saleSearch) {
      if (!["items", "timberSpecies"].includes(input.resource))
        throw new Error("La búsqueda solo admite catálogo.");
      query = query.where(
        "searchPrefixes",
        "array-contains",
        normalizeSearch(text(input.search, 2, 40)),
      );
    }
    if (input.lengthMm) {
      if (
        input.resource !== "timberGroups" ||
        !/^\d{1,6}(\.\d{1,6})?$/.test(input.lengthMm) ||
        Number(input.lengthMm) <= 0 ||
        Number(input.lengthMm) > 100000
      )
        throw new Error("Largo de búsqueda inválido.");
      query = query.where("lengthMm", "==", input.lengthMm);
    }
    if (input.thicknessMm && (input.resource !== "timberGroups" || !input.itemId))
      throw new Error("El filtro de espesor requiere una especie y sus medidas.");
    const queriedItem = input.thicknessMm && input.itemId
      ? timberVariantId(identifier(input.itemId), timberThickness(input.thicknessMm)) : input.itemId;
    if (queriedItem)
      query =
        (["purchasesV2", "auditEvents"].includes(input.resource))
          ? query.where(input.resource === "auditEvents" ? "targetIds" : "itemIds", "array-contains", identifier(queriedItem))
          : query.where(
              input.resource === "inventoryMovements" ? "productId" : "itemId",
              "==",
              identifier(queriedItem),
            );
    if (input.status) {
      if (
        ![
          "serials",
          "debts",
          "cashSessions",
          "warrantyClaims",
          "appointments",
          "workOrders",
          "deliveries",
        ].includes(input.resource) ||
        ![
          "scheduled",
          "attended",
          "no-show",
          "quoted",
          "approved",
          "in-progress",
          "ready",
          "delivered",
          "prepared",
          "available",
          "sold",
          "inspection",
          "written-off",
          "pending",
          "paid",
          "cancelled",
          "open",
          "closed",
          "received",
          "diagnosis",
          "resolved",
        ].includes(input.status)
      )
        throw new Error("Filtro de estado inválido.");
      query = query.where("status", "==", input.status);
    }
    if (input.from || input.to) {
      if (!input.from || !input.to) throw new Error("Indica ambas fechas.");
      this.period(input.from, input.to);
      query = query
        .where("date", ">=", input.from)
        .where("date", "<=", input.to)
        .orderBy("date", "desc");
    }
    if (input.resource === "appointments" && input.from)
      query = query.orderBy("startAt", "asc");
    query = query
      .orderBy("createdAt", "desc")
      .orderBy("__name__", "desc")
      .limit(26);
    if (input.cursor) {
      const cursor = await root.doc(identifier(input.cursor)).get();
      if (!cursor.exists)
        throw new Error("Actualiza el listado antes de continuar.");
      query = query.startAfter(cursor);
    }
    let result = await query.get();
    const visible: typeof result.docs = [];
    let scanned = 0;
    for (;;) {
      for (const doc of result.docs) {
        if (++scanned > 10000) throw new Error("El catálogo supera el límite de lectura. Acota la búsqueda.");
        if (input.resource === "items" && doc.data().timberSpeciesId) continue;
        if (input.reorder) {
          const item = doc.data() as Item;
          if (item.kind === "service" || (compare(item.balance, ZERO) > 0 && compare(item.balance, item.minimum) > 0)) continue;
        }
        if (saleSearch) {
          const sale = doc.data();
          if (![sale.number, sale.customerName].some((value) => normalizeSearch(String(value ?? "")).includes(saleSearch))) continue;
        }
        visible.push(doc);
        if (visible.length === 26) break;
      }
      if (visible.length === 26 || result.size < 26) break;
      result = await query.startAfter(result.docs.at(-1)!).get();
    }
    const page = visible.slice(0, 25);
    const itemIds = input.expiresBefore ? [...new Set(page.map((doc) => identifier(doc.data().itemId)))] : [];
    const itemNames = new Map(itemIds.length
      ? (await this.db.getAll(...itemIds.map((id) => collection("items").doc(id)))).map((item) => [item.id, item.data()?.name])
      : []);
    return {
      items: page.map((doc) => ({ ...row(doc),
        ...(input.expiresBefore ? { itemName: itemNames.get(doc.data().itemId) ?? "Producto" } : {}) })),
      next: visible.length > 25 ? visible[24]!.id : null,
    };
  }

  period(from: string, to: string) {
    date(from);
    date(to);
    const span = (Date.parse(to) - Date.parse(from)) / 86400000;
    if (span < 0 || span > 365)
      throw new Error("El informe admite hasta 366 días.");
  }
  async report(
    uid: string,
    businessId: string,
    from: string,
    to: string,
    transaction?: Transaction,
  ): Promise<WorkspaceReport> {
    if (!transaction)
      return this.db.runTransaction(
        (tx) => this.report(uid, businessId, from, to, tx),
        { readOnly: true },
      );
    const business = await this.owner(uid, businessId);
    this.period(from, to);
    const read = async (collection: string, period = true) => {
      let q: Query = this.db.collection(
        `businesses/${businessId}/${collection}`,
      );
      if (period) q = q.where("date", ">=", from).where("date", "<=", to);
      const result = await transaction.get(q.limit(10001));
      if (result.size > 10000)
        throw new Error(
          "El informe supera 10.000 registros; reduce el periodo.",
        );
      return result.docs.map((doc) => doc.data());
    };
    const [
      sales,
      returns,
      expenses,
      reversals,
      purchases,
      debts,
      items,
      movements,
    ] = await Promise.all([
      read("salesV2"),
      read("returns"),
      read("expensesV2"),
      read("expenseReversals"),
      read("purchasesV2"),
      read("debts", false),
      read("items", false),
      read("movementsV2"),
    ]);
    const sum = (rows: DocumentData[], key: string) => {
      let total = 0n;
      for (const row of rows) {
        const value = row[key] ?? 0;
        if (typeof value !== "number" || !Number.isSafeInteger(value))
          throw new Error("El informe contiene un importe inválido.");
        total += BigInt(value);
      }
      if (total > 1000000000000n || total < -1000000000000n)
        throw new Error(
          "El acumulado de una sección supera el límite del informe. Reduce el periodo.",
        );
      return Number(total);
    };
    const emptyDay = () => ({ salesMinor: 0n, costMinor: 0n, expensesMinor: 0n, lossesMinor: 0n, purchasesMinor: 0n });
    const days = new Map<string, ReturnType<typeof emptyDay>>();
    for (let cursor = Date.parse(from); cursor <= Date.parse(to); cursor += 86400000) {
      days.set(new Date(cursor).toISOString().slice(0, 10), emptyDay());
    }
    const post = (date: string, field: keyof ReturnType<typeof emptyDay>, raw: unknown, sign = 1n) => {
      const day = days.get(date);
      const value = raw ?? 0;
      if (!day || typeof value !== "number" || !Number.isSafeInteger(value))
        throw new Error("El informe contiene una fecha o un importe inválido.");
      day[field] += sign * BigInt(value);
    };
    for (const sale of sales) {
      post(sale.date, "salesMinor", sale.totalMinor);
      post(sale.date, "costMinor", sale.costMinor);
    }
    for (const returned of returns) {
      post(returned.date, "salesMinor", returned.refundMinor, -1n);
      post(returned.date, "costMinor", returned.costMinor, -1n);
      post(returned.date, "lossesMinor", returned.lossMinor);
    }
    for (const expense of expenses) post(expense.date, "expensesMinor", expense.amountMinor);
    for (const reversal of reversals) post(reversal.date, "expensesMinor", reversal.amountMinor, -1n);
    for (const purchase of purchases) post(purchase.date, "purchasesMinor", purchase.totalMinor);
    for (const movement of movements) {
      if (movement.kind === "loss") post(movement.date, "lossesMinor", movement.valueDelta, -1n);
    }
    const byUnit = new Map<string, ReturnType<typeof add>>();
    for (const raw of items) {
      const item = raw as Item;
      if (item.kind === "service") continue;
      byUnit.set(
        item.baseUnit,
        add(byUnit.get(item.baseUnit) ?? ZERO, item.balance),
      );
    }
    const report: WorkspaceReport = {
      from,
      to,
      salesMinor: 0,
      costMinor: 0,
      expensesMinor: 0,
      lossesMinor: 0,
      purchasesMinor: 0,
      resultMinor: 0,
      pendingMinor: sum(
        debts.filter((d) => d.status === "pending"),
        "amountMinor",
      ),
      inventoryMinor: sum(items, "valueMinor"),
      pendingValuationCount: 0,
      unvaluedLossCount: 0,
      days: [],
      byUnit: [...byUnit].map(([unit, quantity]) => ({ unit, quantity })),
    };
    if (business.legacy && business.id === uid) {
      const legacy = await new CommerceQueries(this.db, transaction).report(
        uid,
        { from, to },
      );
      const oldItems = await read("products", false);
      report.inventoryMinor += sum(oldItems, "inventoryValueMinor");
      report.pendingMinor += legacy.pendingMinor;
      report.pendingValuationCount = oldItems.filter(
        (item) => item.inventoryValueMinor === undefined,
      ).length;
      report.unvaluedLossCount = legacy.unvaluedLossCount;
      for (const day of legacy.days) {
        post(day.date, "salesMinor", day.salesMinor);
        post(day.date, "costMinor", day.costMinor);
        post(day.date, "expensesMinor", day.expensesMinor);
        post(day.date, "lossesMinor", day.lossesMinor);
      }
    }
    const checked = (value: bigint) => {
      if (value > 1000000000000n || value < -1000000000000n)
        throw new Error("El acumulado supera los límites del informe.");
      return Number(value);
    };
    const totals = emptyDay();
    for (const [date, day] of days) {
      totals.salesMinor += day.salesMinor;
      totals.costMinor += day.costMinor;
      totals.expensesMinor += day.expensesMinor;
      totals.lossesMinor += day.lossesMinor;
      totals.purchasesMinor += day.purchasesMinor;
      report.days.push({
        date,
        salesMinor: checked(day.salesMinor),
        costMinor: checked(day.costMinor),
        expensesMinor: checked(day.expensesMinor),
        lossesMinor: checked(day.lossesMinor),
        purchasesMinor: checked(day.purchasesMinor),
        resultMinor: checked(day.salesMinor - day.costMinor - day.expensesMinor - day.lossesMinor),
      });
    }
    report.salesMinor = checked(totals.salesMinor);
    report.costMinor = checked(totals.costMinor);
    report.expensesMinor = checked(totals.expensesMinor);
    report.lossesMinor = checked(totals.lossesMinor);
    report.purchasesMinor = checked(totals.purchasesMinor);
    report.resultMinor = checked(totals.salesMinor - totals.costMinor - totals.expensesMinor - totals.lossesMinor);
    if (
      Object.values(report).some(
        (v) =>
          typeof v === "number" &&
          (!Number.isSafeInteger(v) || Math.abs(v) > 1e12),
      )
    )
      throw new Error("El acumulado supera los límites del informe.");
    return report;
  }
  async status(
    uid: string,
    businessId: string,
    operationId: string,
    signature: string,
  ) {
    await this.owner(uid, businessId);
    const key = await this.db
      .doc(`users/${uid}/operationKeys/${identifier(operationId)}`)
      .get();
    if (!key.exists) return null;
    if (
      key.data()?.businessId !== businessId ||
      key.data()?.signature !== signature
    )
      throw new Error("El identificador pertenece a otro negocio o solicitud.");
    return key.data()!.result;
  }
}
