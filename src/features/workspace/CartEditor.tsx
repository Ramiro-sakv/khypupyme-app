import { displayQuantity as showQuantity } from "../../../shared/workspace/presentation";
import TimberFixedLineEditor from "./TimberFixedLineEditor";
import TimberLineEditor from "./TimberLineEditor";
import { UNITS } from "../../../shared/workspace/catalog";
import { div } from "../../../shared/workspace/exact";
import type { Unit } from "../../../shared/workspace/model";
import { useRecords, useWorkspace } from "./context";
import { bob, itemDetails, serials } from "./format";
import { Pager } from "./ui";

import type { CartLine } from "./Cart";
import { delivered } from "./Cart";
export default function CartEditor({
  line,
  update,
  remove,
  purchase,
  quote = false,
  duplicate,
}: {
  line: CartLine;
  update: (patch: Partial<CartLine>) => void;
  remove: () => void;
  purchase: boolean;
  quote?: boolean;
  duplicate?: (() => void) | undefined;
}) {
  const { business } = useWorkspace();
  const available = useRecords<{ id: string; serial: string }>(
    "serials",
    { itemId: line.item.id, status: "available" },
    line.item.kind === "appliance" && !purchase && !quote,
  );
  if (line.item.kind === "timber-grouped")
    return (
      <TimberLineEditor
        line={line}
        update={update}
        remove={remove}
        purchase={purchase}
        duplicate={duplicate}
      />
    );
  if (line.item.kind === "timber-piece")
    return (
      <TimberFixedLineEditor
        line={line}
        update={update}
        remove={remove}
        purchase={purchase}
      />
    );
  let coverage: string;
  try {
    coverage = `Entrega: ${showQuantity(delivered(line))} ${line.item.baseUnit}`;
    if (line.item.kind === "ceramic")
      coverage += ` · Cobertura real ${showQuantity(div(delivered(line), line.item.units.m2!))} m²`;
  } catch {
    coverage = "Revisa la cantidad.";
  }
  return (
    <section className="card cart-line">
      <h3>{line.item.name}</h3>
      <p className="muted">
        {itemDetails(line.item, business.timberSystem ?? "imperial")}
      </p>
      <div className="workspace-grid">
        <label>
          Cantidad solicitada
          <input
            name="line-qty"
            value={line.qty}
            onChange={(e) => update({ qty: e.target.value })}
            inputMode="decimal"
            required
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
              onChange={(e) => update({ cost: e.target.value })}
              required
              inputMode="decimal"
            />
          </label>
        )}
      </div>
      {purchase && (
        <>
          <label>
            Lote
            <input
              value={line.lot}
              onChange={(e) => update({ lot: e.target.value })}
              maxLength={80}
            />
          </label>
          <label>
            Vencimiento (si corresponde)
            <input
              type="date"
              value={line.expiresOn}
              onChange={(e) => update({ expiresOn: e.target.value })}
            />
          </label>
        </>
      )}
      {!purchase && line.item.kind === "ceramic" && (
        <>
          <label>
            Merma al cotizar por m² (%)
            <input
              type="number"
              min={0}
              max={30}
              step="1"
              value={line.wastePercent}
              onChange={(e) => update({ wastePercent: Number(e.target.value) })}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={line.fullBoxes}
              onChange={(e) => update({ fullBoxes: e.target.checked })}
            />
            Entregar solamente cajas completas
          </label>
        </>
      )}
      {line.item.kind === "appliance" &&
        (purchase ? (
          <label>
            Una serie por equipo (líneas o comas)
            <textarea
              value={line.serials.join("\n")}
              onChange={(e) => update({ serials: serials(e.target.value) })}
            />
          </label>
        ) : (
          !quote && (
            <>
              <p>Selecciona cada unidad que se entrega.</p>
              <Pager page={available} />
              {available.items.map((s) => (
                <label key={s.id}>
                  <input
                    type="checkbox"
                    checked={line.serials.includes(s.id)}
                    onChange={(e) =>
                      update({
                        serials: e.target.checked
                          ? [...line.serials, s.id]
                          : line.serials.filter((id) => id !== s.id),
                      })
                    }
                  />
                  {s.serial}
                </label>
              ))}
            </>
          )
        ))}
      {!purchase && (
        <p>
          {coverage} · Precio {bob(line.item.priceMinor)} /{" "}
          {UNITS[line.item.priceUnit]}
        </p>
      )}
      <button type="button" onClick={remove}>
        Quitar línea
      </button>
    </section>
  );
}
