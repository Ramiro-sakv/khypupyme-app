import type { components } from "../api/schema";
import { businessApi } from "../businesses/models";

type Schema = components["schemas"];
export type Command = Schema["CommerceCommand"];
export type CommandInput = Omit<Command, "operationId">;
export type CommandResult = Schema["CommandResult"];
export type CommandLine = Schema["CommandLine"];
export type Product = Schema["ProductInfo"];
export type Customer = Schema["CustomerInfo"];
export type CashStatus = Schema["CashStatus"];
export type EntryInfo = Schema["EntryInfo"];
export type EntryDocument = Schema["EntryDocument"];
export type Receivable = Schema["ReceivableInfo"];
export type Report = Schema["CommerceReport"];
export const reportResult = (day: Report["totals"]) =>
  day.resultMinor ?? day.salesMinor - day.costMinor - day.expensesMinor - day.lossesMinor;
export type Page<T> = { items: T[]; hasMore: boolean };

export const commercePath = (id: string, practice?: boolean) => businessApi + "/" + id + (practice ? "/practice-commerce" : "/commerce");
export const moneyLimit = 1_000_000_000_000;
const currency = new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB" });
export const bob = (minor: number) => currency.format(minor / 100);
export const editableMoney = (minor: number) => (minor / 100).toFixed(2);
export function parseMoney(text: string): number | null {
  const match = /^(\d{1,11})(?:[.,](\d{1,2}))?$/.exec(text.trim());
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return cents <= moneyLimit ? cents : null;
}

export const methods = {
  cash: "Efectivo", qr: "QR", transfer: "Transferencia", credit: "Fiado",
} as const;
export type Method = keyof typeof methods;
export const methodLabel = (method: string | null) => method ? methods[method as Method] ?? method : "—";

const documentNames: Record<string, string> = {
  "configure-business": "Configuración del negocio",
  "save-work": "Registro de agenda u orden", "advance-work": "Actualización de estado", "repair-receipt": "Constancia de recepción",
  "work-receipt": "Constancia de trabajo", "delivery-receipt": "Constancia de despacho",
  "open-cement": "Apertura de bolsas",
  sale: "Venta", purchase: "Compra", quote: "Cotización", return: "Devolución", expense: "Gasto",
  "void-expense": "Anulación de gasto", collect: "Cobro de fiado", "stock-loss": "Pérdida de inventario",
  "open-cash": "Apertura de caja", "close-cash": "Cierre de caja",
  "cash-adjust": "Ajuste de caja", "stock-in": "Entrada manual de inventario",
  "manual-debt": "Fiado manual", "void-debt": "Anulación de fiado manual",
  "prepare-delivery": "Entrega preparada", "cancel-delivery": "Entrega cancelada",
  warranty: "Reclamo de garantía",
  exchange: "Cambio de prenda", inspection: "Inspección",
  containers: "Movimiento de envases", "container-stock": "Entrada de envases",
  "hold-lot": "Lote apartado", "release-lot": "Lote liberado", "discard-lot": "Baja de lote",
};
export const documentName = (kind: string) => documentNames[kind] ?? kind;
export const isOperationalReceipt = (kind: string) => ["repair-receipt", "work-receipt", "delivery-receipt"].includes(kind);
export function documentAmount(document: EntryDocument) {
  if (document.kind === "open-cement") return { label: "Valor transferido", minor: document.lines[0]?.subtotalMinor ?? 0 };
  return { label: document.kind === "exchange" ? "Diferencia cobrada (+) o devuelta (−)" : "Total confirmado", minor: document.totalMinor };
}
export const dateLabel = (day: string) => new Intl.DateTimeFormat("es-BO", {
  day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
}).format(new Date(day + "T00:00:00Z"));
export const timestamp = (instant: string) => new Intl.DateTimeFormat("es-BO", {
  dateStyle: "medium", timeStyle: "short", timeZone: "America/La_Paz",
}).format(new Date(instant));
