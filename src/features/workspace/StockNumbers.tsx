import type { StockCheck } from "../../../shared/workspace/availability";
import { div, showQuantity } from "../../../shared/workspace/exact";
import type { Quantity } from "../../../shared/workspace/exact";
import { displayQuantity } from "../../../shared/workspace/presentation";

export function StockNumbers({ check, factor, unit }: { check: StockCheck; factor?: Quantity | undefined; unit?: string | undefined }) {
  const format = (qty: Quantity) => {
    const converted = factor ? div(qty, factor) : qty;
    const short = displayQuantity(converted);
    return short === "0" && converted.n !== "0" ? showQuantity(converted) : short;
  };
  const shortage = check.missing.n !== "0";
  return <span className="stock-numbers" data-shortage={shortage || undefined} role={shortage ? "status" : undefined}>
    <span>Pedido <b>{format(check.requested)}</b></span>
    <span>Disponible <b>{format(check.available)}</b></span>
    {shortage && <strong>Faltan {format(check.missing)}{unit ? " " + unit : ""}</strong>}
  </span>;
}
