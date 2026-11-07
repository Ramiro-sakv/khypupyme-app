import type { SaleInput } from "./model.js";
export type AppointmentStatus =
  | "scheduled"
  | "attended"
  | "no-show"
  | "cancelled";
export type WorkStatus =
  | "received"
  | "diagnosis"
  | "quoted"
  | "approved"
  | "in-progress"
  | "ready"
  | "delivered"
  | "cancelled";
export type WorkKind =
  | "repair"
  | "cutting"
  | "cleaning"
  | "professional"
  | "craft";
export interface OperationalBase {
  id: string;
  revision: number;
  customerId: string;
  customerName: string;
  createdAt: string;
  updatedAt: string;
  saleId?: string;
}
export interface Appointment extends OperationalBase {
  title: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
}
export interface WorkOrder extends OperationalBase {
  kind: WorkKind;
  title: string;
  description: string;
  address: string;
  dueOn: string;
  checks: string[];
  budgetMinor: number;
  status: WorkStatus;
}
export interface Delivery {
  id: string;
  revision: number;
  saleId: string;
  address: string;
  scheduledOn: string;
  reference: string;
  status: "pending" | "prepared" | "delivered" | "cancelled";
  createdAt: string;
  updatedAt: string;
}
export interface ContainerType {
  id: string;
  name: string;
  unit: "bottle" | "crate";
  owned: number;
  available: number;
  createdAt: string;
}
export interface ContainerBalance {
  id: string;
  containerId: string;
  customerId: string;
  customerName: string;
  name: string;
  quantity: number;
  createdAt: string;
}
export type OperationalAction =
  | {
      kind: "appointment";
      input: Omit<
        Appointment,
        "revision" | "createdAt" | "updatedAt" | "saleId"
      > & { expectedRevision: number };
    }
  | {
      kind: "work-order";
      input: Omit<
        WorkOrder,
        "revision" | "createdAt" | "updatedAt" | "saleId"
      > & { expectedRevision: number };
    }
  | {
      kind: "delivery";
      input: Omit<Delivery, "revision" | "createdAt" | "updatedAt"> & {
        expectedRevision: number;
      };
    }
  | {
      kind: "container-type";
      input: { name: string; unit: "bottle" | "crate"; quantity: number };
    }
  | {
      kind: "container-move";
      input: {
        containerId: string;
        customerId: string;
        direction: "out" | "in";
        quantity: number;
        reason: string;
      };
    }
  | {
      kind: "operational-sale";
      input: {
        sourceKind: "appointment" | "work-order";
        sourceId: string;
        expectedRevision: number;
        sale: SaleInput;
      };
    };
export type OperationalKind = OperationalAction["kind"];
export interface ItemDetails {
  brand: string;
  location: string;
  description: string;
  equivalents: string;
  compatibility: string;
}
export const EMPTY_DETAILS: ItemDetails = {
  brand: "",
  location: "",
  description: "",
  equivalents: "",
  compatibility: "",
};
export const WORK_STATUSES: WorkStatus[] = [
  "received",
  "diagnosis",
  "quoted",
  "approved",
  "in-progress",
  "ready",
  "delivered",
  "cancelled",
];
export const WORK_LABELS: Record<WorkStatus, string> = {
  received: "Recibido",
  diagnosis: "Diagnóstico",
  quoted: "Presupuestado",
  approved: "Aprobado",
  "in-progress": "En trabajo",
  ready: "Listo",
  delivered: "Entregado",
  cancelled: "Cancelado",
};
export const workKindFor = (industry: string | null): WorkKind | null =>
  (
    ({
      repair: "repair",
      timber: "cutting",
      cleaning: "cleaning",
      professional: "professional",
      crafts: "craft",
    }) as Record<string, WorkKind>
  )[industry ?? ""] ?? null;
export const hasAgenda = (industry: string | null) => industry === "beauty";
export const hasDelivery = (industry: string | null) =>
  [
    "furniture",
    "cement",
    "ceramics",
    "hardware",
    "beverages",
    "timber",
  ].includes(industry ?? "");
