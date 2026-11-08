import { authorizePracticeRead } from "./TutorialAccess.js";
import type { PracticeAccess } from "./TutorialAccess.js";
import { normalizeSearch } from "../../../shared/workspace/search.js";
import type {
  DocumentData,
  Firestore,
  Query,
  Transaction,
} from "firebase-admin/firestore";

import { add, ZERO } from "../../../shared/workspace/exact.js";
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
  "appointments",
  "workOrders",
  "workflowEvents",
  "deliveries",
  "containerTypes",
  "containerBalances",
  "containerMovements",
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
            "from",
            "to",
            "barcode",
            "status",
            "search",
            "recordId",
            "expiresBefore",
            "active",
          ].includes(key),
      ) ||
      input.apiVersion !== 2 ||
      !RESOURCES.includes(input.resource)
    )
      throw new Error("Consulta desconocida.");
    await this.owner(uid, input.businessId);
    const root = this.db.collection(
      `businesses/${input.businessId}/${input.resource}`,
    );
    if (input.id) {
      const doc = await root.doc(identifier(input.id)).get();
      return {
        items: doc.exists
          ? [{ ...(serialize(doc.data()) as object), id: doc.id }]
          : [],
        next: null,
      };
    }
    if (input.barcode) {
      if (input.resource !== "items")
        throw new Error("Consulta de código inválida.");
      const { hashKey } = await import("./InventoryService.js"),
        index = await this.db
          .doc(
            `businesses/${input.businessId}/barcodeIndex/${hashKey(text(input.barcode, 1, 40))}`,
          )
          .get();
      if (!index.exists) return { items: [], next: null };
      const doc = await root.doc(index.data()!.itemId).get();
      return {
        items: doc.exists ? [{ ...doc.data(), id: doc.id }] : [],
        next: null,
      };
    }
    let query: Query = root;
    if (input.active !== undefined) {
      if (
        !["items", "customersV2", "timberGroups"].includes(input.resource) ||
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
    if (input.search) {
      if (input.resource !== "items")
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
    if (input.itemId)
      query =
        input.resource === "purchasesV2"
          ? query.where("itemIds", "array-contains", identifier(input.itemId))
          : query.where(
              input.resource === "inventoryMovements" ? "productId" : "itemId",
              "==",
              identifier(input.itemId),
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
    const result = await query.get(),
      visible = result.docs.slice(0, 25);
    return {
      items: visible.map((doc) => ({
        ...(serialize(doc.data()) as object),
        id: doc.id,
      })),
      next: result.size > 25 ? visible.at(-1)!.id : null,
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
    const days = new Map<
      string,
      { date: string; salesMinor: number; expensesMinor: number }
    >();
    for (let d = Date.parse(from); d <= Date.parse(to); d += 86400000) {
      const day = new Date(d).toISOString().slice(0, 10);
      days.set(day, { date: day, salesMinor: 0, expensesMinor: 0 });
    }
    for (const sale of sales)
      days.get(sale.date)!.salesMinor += sale.totalMinor;
    for (const returned of returns)
      days.get(returned.date)!.salesMinor -= returned.refundMinor;
    for (const expense of expenses)
      days.get(expense.date)!.expensesMinor += expense.amountMinor;
    for (const reversal of reversals)
      days.get(reversal.date)!.expensesMinor -= reversal.amountMinor;
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
      salesMinor: sum(sales, "totalMinor") - sum(returns, "refundMinor"),
      costMinor: sum(sales, "costMinor") - sum(returns, "costMinor"),
      expensesMinor:
        sum(expenses, "amountMinor") - sum(reversals, "amountMinor"),
      lossesMinor:
        sum(returns, "lossMinor") -
        sum(
          movements.filter((m) => m.kind === "loss"),
          "valueDelta",
        ),
      purchasesMinor: sum(purchases, "totalMinor"),
      resultMinor: 0,
      pendingMinor: sum(
        debts.filter((d) => d.status === "pending"),
        "amountMinor",
      ),
      inventoryMinor: sum(items, "valueMinor"),
      pendingValuationCount: 0,
      unvaluedLossCount: 0,
      days: [...days.values()],
      byUnit: [...byUnit].map(([unit, quantity]) => ({ unit, quantity })),
    };
    if (business.legacy && business.id === uid) {
      const legacy = await new CommerceQueries(this.db, transaction).report(
        uid,
        { from, to },
      );
      report.salesMinor += legacy.salesMinor;
      report.costMinor += legacy.costMinor;
      report.expensesMinor += legacy.expensesMinor;
      report.lossesMinor += legacy.lossesMinor;
      const oldItems = await read("products", false);
      report.inventoryMinor += sum(oldItems, "inventoryValueMinor");
      report.pendingMinor += legacy.pendingMinor;
      report.pendingValuationCount = oldItems.filter(
        (item) => item.inventoryValueMinor === undefined,
      ).length;
      report.unvaluedLossCount = legacy.unvaluedLossCount;
      for (const day of legacy.days) {
        const target = days.get(day.date);
        if (target) {
          target.salesMinor += day.salesMinor;
          target.expensesMinor += day.expensesMinor;
        }
      }
    }
    report.resultMinor =
      report.salesMinor -
      report.costMinor -
      report.expensesMinor -
      report.lossesMinor;
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
