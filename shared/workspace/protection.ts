import type { WorkspaceAction } from "./model.js";

export function sensitiveAction(action: WorkspaceAction): boolean {
  if (action.kind === "close-cash") return !!action.input.reason.trim();
  if (action.kind === "timber-species") return action.input.expectedRevision > 0;
  if (action.kind === "customer") return !action.input.active;
  return ["edit-item", "cancel-debt", "cancel-expense", "return", "exchange", "stock-adjust", "cash-adjust", "convert-legacy", "legacy-value", "legacy-commerce", "recover-legacy", "release-serial", "lot-action"].includes(action.kind);
}
export const CORRECTION_LABELS: Record<string, string> = {
  "lot-action": "Cambiar disponibilidad o registrar pérdida de un lote",
  "close-cash": "Cerrar caja con diferencia declarada", "cancel-sale": "Anular venta anterior", "cancel-receivable": "Anular deuda anterior",
  "timber-species": "Modificar ficha de madera", "edit-item": "Modificar o archivar producto", "cancel-debt": "Anular deuda", "cancel-expense": "Anular gasto", return: "Registrar devolución", exchange: "Registrar cambio", "stock-adjust": "Ajustar existencias", "cash-adjust": "Registrar aporte o retiro", "convert-legacy": "Convertir existencias anteriores", "legacy-value": "Valorar existencias anteriores", "legacy-commerce": "Corregir registro anterior", "recover-legacy": "Recuperar solicitud anterior", "release-serial": "Liberar equipo de inspección", customer: "Archivar cliente",
};
export interface CorrectionChallenge {
  businessName: string;
  operationId: string;
  kind: string;
  issuedAt: number;
  expiresAt: number;
  records: { collection: string; id: string; values: Record<string, unknown> }[];
}
