import type { IndustryId } from "../../../shared/business-industries";
import type { WorkspaceQuery } from "../../../shared/workspace/model";
import type { IconName } from "./Icon";

type Shortcut = { title: string; view: string; icon: IconName; params?: Record<string, string> };
type Alert = { title: string; view: string; resource: WorkspaceQuery["resource"]; filters: Pick<WorkspaceQuery, "reorder" | "attention"> | { expiry: true }; target: string };
type IndustryHome = { shortcuts: Shortcut[]; alerts: Alert[] };
const sell: Shortcut = { title: "Vender", view: "ventas", icon: "sale" };
const buy: Shortcut = { title: "Registrar compra", view: "compras", icon: "purchase" };
const stock: Shortcut = { title: "Ver inventario", view: "inventario", icon: "box" };
const quote: Shortcut = { title: "Cotizar", view: "cotizaciones", icon: "document" };
const reorder: Alert = { title: "Productos por reponer", view: "inventario", resource: "items", filters: { reorder: true }, target: "reposicion" };
const expiry: Alert = { title: "Lotes vencidos o próximos a vencer", view: "inventario", resource: "lots", filters: { expiry: true }, target: "vencimientos" };
const late: Alert = { title: "Trabajos atrasados", view: "ordenes", resource: "workOrders", filters: { attention: "late" }, target: "late" };
const ready: Alert = { title: "Trabajos listos para cobrar", view: "ordenes", resource: "workOrders", filters: { attention: "ready" }, target: "ready" };
const delivery: Alert = { title: "Entregas atrasadas", view: "entregas", resource: "deliveries", filters: { attention: "late" }, target: "late" };
const changes: Shortcut = { title: "Buscar venta para cambio", view: "ventas", icon: "history", params: { atencion: "cambios" } };
const work = (title: string): Shortcut => ({ title, view: "ordenes", icon: "document", params: { accion: "nueva" } });
const serviceHome = (title: string): IndustryHome => ({ shortcuts: [work(title), { title: "Consultar trabajos", view: "ordenes", icon: "history" }], alerts: [late, ready] });
export const industryHomes: Partial<Record<IndustryId, IndustryHome>> = {
  grocery: { shortcuts: [sell, buy], alerts: [reorder, expiry] },
  cosmetics: { shortcuts: [sell, buy], alerts: [expiry, reorder] },
  pets: { shortcuts: [sell, buy], alerts: [reorder, expiry] },
  beverages: { shortcuts: [sell, { title: "Recibir envases", view: "envases", icon: "box" }], alerts: [{ title: "Envases pendientes de devolución", view: "envases", resource: "containerBalances", filters: { attention: "returns" }, target: "returns" }, delivery] },
  footwear: { shortcuts: [sell, changes], alerts: [] },
  electronics: { shortcuts: [sell, { title: "Buscar equipo o garantía", view: "garantias", icon: "shield" }], alerts: [{ title: "Equipos en inspección", view: "garantias", resource: "serials", filters: { attention: "inspection" }, target: "inspeccion" }] },
  hardware: { shortcuts: [sell, stock], alerts: [reorder, delivery] },
  spareParts: { shortcuts: [{ ...stock, title: "Buscar repuesto" }, sell], alerts: [reorder] },
  stationery: { shortcuts: [{ ...sell, title: "Vender o imprimir" }, buy], alerts: [reorder] },
  furniture: { shortcuts: [quote, { title: "Ver entregas", view: "entregas", icon: "box" }], alerts: [delivery] },
  ceramics: { shortcuts: [{ ...quote, title: "Cotizar superficie" }, stock], alerts: [delivery] },
  cement: { shortcuts: [sell, stock], alerts: [delivery] },
  beauty: { shortcuts: [{ title: "Nueva cita", view: "agenda", icon: "plus", params: { accion: "nueva" } }, { ...sell, title: "Atender sin cita" }], alerts: [{ title: "Citas de hoy", view: "agenda", resource: "appointments", filters: { attention: "today" }, target: "today" }] },
  cleaning: { ...serviceHome("Nueva orden de limpieza"), alerts: [{ title: "Trabajos de hoy", view: "ordenes", resource: "workOrders", filters: { attention: "today" }, target: "today" }, late] },
  professional: serviceHome("Nuevo trabajo"),
  repair: { shortcuts: [work("Recibir equipo"), { title: "Ver reparaciones", view: "ordenes", icon: "history" }], alerts: [{ title: "En espera de repuesto", view: "ordenes", resource: "workOrders", filters: { attention: "waiting" }, target: "waiting" }, ready] },
  crafts: { shortcuts: [work("Nuevo encargo"), sell], alerts: [late, ready] },
};
