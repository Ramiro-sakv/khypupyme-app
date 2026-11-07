import { UNITS } from "../../../shared/workspace/catalog";
import { amount, div, showQuantity } from "../../../shared/workspace/exact";
import type { Unit } from "../../../shared/workspace/model";
import type { CartLine } from "./Cart";
import { delivered } from "./Cart";
import { useWorkspace } from "./context";
import { bob, cents, itemDetails, q } from "./format";
/** Old fixed-dimension products keep their original units and tariff. */
export default function TimberFixedLineEditor({
  line,
  update,
  remove,
  purchase,
}: {
  line: CartLine;
  update: (patch: Partial<CartLine>) => void;
  remove: () => void;
  purchase: boolean;
}) {
  const { business } = useWorkspace();
  let summary = "Completa la cantidad.";
  try {
    const pieces = delivered(line),
      feet = div(pieces, line.item.units.boardFoot!);
    summary =
      showQuantity(pieces) +
      " piezas · " +
      showQuantity(feet) +
      " pies tablares · " +
      bob(
        purchase
          ? amount(cents(line.cost || "0"), q(line.qty))
          : amount(
              line.item.priceMinor,
              div(pieces, line.item.units[line.item.priceUnit]!),
            ),
      );
  } catch {
    /* Se valida al confirmar. */
  }
  return (
    <section className="timber-sale-group">
      <header className="section-heading">
        <strong>
          {line.item.name} ·{" "}
          {itemDetails(line.item, business.timberSystem ?? "imperial")}
        </strong>
        <button type="button" onClick={remove}>
          Quitar
        </button>
      </header>
      <div className="timber-group-fields">
        <label>
          Cantidad
          <input
            name="line-qty"
            value={line.qty}
            inputMode="decimal"
            required
            onChange={(e) => update({ qty: e.target.value })}
          />
        </label>
        <label>
          Unidad
          <select
            name="line-unit"
            value={line.unit}
            onChange={(e) => update({ unit: e.target.value as Unit })}
          >
            {Object.keys(line.item.units).map((u) => (
              <option key={u} value={u}>
                {UNITS[u as Unit]}
              </option>
            ))}
          </select>
        </label>
        {purchase && (
          <label>
            Costo por unidad elegida (BOB)
            <input
              name="line-cost"
              value={line.cost}
              required
              inputMode="decimal"
              onChange={(e) => update({ cost: e.target.value })}
            />
          </label>
        )}
      </div>
      <p>{summary}</p>
      <small>
        Medida fija anterior · tarifa original {bob(line.item.priceMinor)} /{" "}
        {UNITS[line.item.priceUnit]}.
      </small>
    </section>
  );
}
