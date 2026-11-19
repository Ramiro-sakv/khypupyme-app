import type { components } from "../api/schema";

export type Work = components["schemas"]["WorkInfo"];
export type WorkDetails = components["schemas"]["WorkDetails"];
export type WorkAttention = components["schemas"]["WorkAttention"];

export const workNavigation: Record<string, { title: string; create: string; today: string }> = {
  beauty: { title: "Agenda", create: "Nueva cita", today: "Citas de hoy" },
  cleaning: { title: "Trabajos de limpieza", create: "Nuevo trabajo", today: "Trabajos de hoy" },
  professional: { title: "Trabajos profesionales", create: "Nuevo trabajo", today: "Compromisos de hoy" },
  repair: { title: "Órdenes de taller", create: "Recibir equipo", today: "Órdenes para hoy" },
  crafts: { title: "Encargos", create: "Nuevo encargo", today: "Encargos para hoy" },
};

export const todayInBolivia = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/La_Paz" }).format(new Date());
export function clockTime(minutes: number) {
  return [Math.floor(minutes / 60), minutes % 60].map((part) => String(part).padStart(2, "0")).join(":");
}
export function canBillWork(work: Work) {
  return !work.saleId && ["attended", "ready", "delivered"].includes(work.state);
}
const statuses: Record<string, string> = {
  scheduled: "Programada", received: "Recibido", diagnosed: "Diagnosticado", approved: "Aprobado", working: "En trabajo",
  ready: "Listo", delivered: "Entregado", attended: "Atendida", "no-show": "Inasistencia", cancelled: "Cancelada", "waiting-parts": "En espera de repuestos",
};
export function workStatus(work: Work) {
  return work.industry === "repair" && work.state === "working" ? "En reparación" : statuses[work.state] ?? work.state;
}
export const detailLabels: Record<keyof WorkDetails, string> = {
  tasks: "Tareas", plannedMaterials: "Materiales previstos", usedMaterials: "Materiales utilizados",
  billableMaterials: "Materiales a cobrar", internalMaterials: "Materiales de consumo interno",
  deliverables: "Entregables", equipment: "Equipo recibido", accessories: "Accesorios recibidos", fault: "Falla declarada",
  diagnosis: "Diagnóstico", statusNote: "Nota de estado", specifications: "Especificaciones del encargo",
};
export const detailKeys = Object.keys(detailLabels) as (keyof WorkDetails)[];
