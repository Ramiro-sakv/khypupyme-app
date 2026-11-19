import { get } from "../api/client";
import { bob, documentName } from "../commerce/models";
import type { CashStatus, Command } from "../commerce/models";

const protectedKinds = new Set(["return", "exchange", "void-expense", "stock-loss", "inspection",
  "hold-lot", "release-lot", "discard-lot", "open-cement"]);

export async function needsIdentity(command: Command, path: string) {
  if (protectedKinds.has(command.kind) || ((command.kind === "product" || command.kind === "customer") && command.entityId)) return true;
  if (command.kind !== "close-cash") return false;
  const { session } = await get<CashStatus>(path + "/cash");
  return !!session && !session.closedAt && session.id === command.sourceId && session.expectedMinor !== command.amountMinor;
}

export function correctionEffect(business: string, command: Command) {
  const label = command.kind === "product" ? "Edición de ficha de producto" : command.kind === "customer" ? "Edición de cliente" :
    command.kind === "close-cash" ? "Cierre con diferencia de efectivo" : documentName(command.kind);
  return [business, label, command.name, command.code, command.serial,
    (command.sourceId || (command.entityId && !command.name)) && "Registro " + (command.sourceId ?? command.entityId),
    command.amountMinor != null && bob(command.amountMinor),
    command.lines?.length && command.lines.length + (command.lines.length === 1 ? " línea afectada" : " líneas afectadas")].filter(Boolean).join(" · ");
}
