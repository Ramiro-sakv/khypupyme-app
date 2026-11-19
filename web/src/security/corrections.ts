import { get } from "../api/client";
import { bob, documentName } from "../commerce/models";
import type { CashStatus, Command } from "../commerce/models";

const protectedKinds = new Set(["return", "exchange", "void-expense", "void-debt", "cash-adjust", "stock-in", "stock-loss", "inspection",
  "hold-lot", "release-lot", "discard-lot", "open-cement", "configure-business"]);

export async function needsIdentity(command: Command, path: string) {
  if (protectedKinds.has(command.kind) || (command.kind === "advance-work" && command.workState === "cancelled") || ((command.kind === "product" || command.kind === "customer") && command.entityId)) return true;
  if (command.kind !== "close-cash") return false;
  const { session } = await get<CashStatus>(path + "/cash");
  return !!session && !session.closedAt && session.id === command.sourceId && session.expectedMinor !== command.amountMinor;
}

export function correctionEffect(business: string, command: Command) {
  const label = command.kind === "product" ? "Edición de ficha de producto" : command.kind === "customer" ? "Edición de cliente" :
    command.kind === "close-cash" ? "Cierre con diferencia de efectivo" :
    command.kind === "advance-work" && command.workState === "cancelled" ? "Cancelación de cita" : documentName(command.kind);
  const policy = command.policy;
  const detail = policy && [
    "Descuento máximo " + policy.maxDiscountPercent + "%",
    "Cotizaciones de " + policy.quoteDays + " días",
    policy.allowNewCredit ? "Fiados nuevos permitidos" : "Fiados nuevos desactivados",
    "Forma de pago inicial " + (policy.defaultPayment === "cash" ? "Efectivo" : policy.defaultPayment === "qr" ? "QR" : "Transferencia"),
    "Aviso de lotes de " + policy.lotAlertDays + " días",
  ].join(" · ");
  return [business, label, detail, command.name, command.code, command.serial,
    (command.sourceId || command.workLink?.id || (command.entityId && !command.name)) && "Registro " + (command.sourceId ?? command.workLink?.id ?? command.entityId),
    command.amountMinor != null && bob(command.amountMinor),
    command.lines?.length && command.lines.length + (command.lines.length === 1 ? " línea afectada" : " líneas afectadas")].filter(Boolean).join(" · ");
}
