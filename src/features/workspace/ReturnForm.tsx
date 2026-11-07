import { useState } from "react";
import { UNITS } from "../../../shared/workspace/catalog";
import { compare, showQuantity, ZERO } from "../../../shared/workspace/exact";
import type {
  Item,
  ReturnInput,
  SaleV2,
  Unit,
} from "../../../shared/workspace/model";
import { useRecords, useWorkspace } from "./context";
import { bob, method, q } from "./format";
import { Panel } from "./Panel";
import { ActionForm, Field, MethodField, Pager } from "./ui";

import type { CartLine } from "./Cart";
import { saleInputs } from "./Cart";
import CartEditor from "./CartEditor";
export default function ReturnForm({
  sale,
  close,
}: {
  sale: SaleV2;
  close: () => void;
}) {
  const { run, busy } = useWorkspace(),
    [selected, setSelected] = useState<
      Record<number, { qty: string; restock: boolean; serials: string[] }>
    >({}),
    [exchange, setExchange] = useState(false),
    [replacements, setReplacements] = useState<CartLine[]>([]),
    items = useRecords<Item>("items");
  return (
    <Panel title={sale.number + " · Devoluciones y cambios"} onClose={close}>
      <ActionForm
        dataTutorial="return-form"
        disabled={busy}
        label={exchange ? "Confirmar cambio atómico" : "Confirmar devolución"}
        onSave={async (d) => {
          const lines: ReturnInput[] = Object.entries(selected)
            .filter(([, v]) => v.qty && compare(q(v.qty), ZERO) > 0)
            .map(([i, v]) => ({
              line: Number(i),
              qty: q(v.qty),
              unit: String(d.get("returnUnit" + i)) as Unit,
              restock: v.restock,
              serials: v.serials,
            }));
          let result;
          if (exchange) {
            if (!replacements.length)
              throw new Error("Selecciona los productos nuevos.");
            result = await run({
              kind: "exchange",
              input: {
                saleId: sale.id,
                returns: lines,
                lines: saleInputs(replacements),
                reason: String(d.get("reason")),
                method: method(d),
                customerName: sale.customerName,
              },
            });
          } else
            result = await run({
              kind: "return",
              input: {
                saleId: sale.id,
                lines,
                reason: String(d.get("reason")),
                method: method(d),
              },
            });
          if (result) close();
        }}
      >
        {sale.lines.map((l, i) => {
          const value = selected[i] ?? { qty: "", restock: true, serials: [] };
          return (
            <div key={i}>
              <strong>
                {l.name} · vendido {showQuantity(l.delivered)} {l.baseUnit} · ya
                devuelto {showQuantity(l.returned)}
              </strong>
              <label>
                Cantidad a devolver
                <input
                  name="return-qty"
                  value={value.qty}
                  onChange={(e) =>
                    setSelected((old) => ({
                      ...old,
                      [i]: { ...value, qty: e.target.value },
                    }))
                  }
                  inputMode="decimal"
                />
              </label>
              <label>
                Unidad original
                <select
                  name={"returnUnit" + i}
                  defaultValue={
                    Object.entries(l.units).find(
                      ([unit, factor]) =>
                        factor?.n === "1" &&
                        factor.d === "1" &&
                        ["piece", "pair", "bag", "service"].includes(unit),
                    )?.[0] ?? l.requestedUnit
                  }
                >
                  {Object.keys(l.units).map((unit) => (
                    <option key={unit} value={unit}>
                      {UNITS[unit as Unit]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  name="return-restock"
                  checked={value.restock}
                  onChange={(e) =>
                    setSelected((old) => ({
                      ...old,
                      [i]: { ...value, restock: e.target.checked },
                    }))
                  }
                />
                Reingresa al inventario{" "}
                {l.kind === "appliance" ? "(en inspección)" : ""}
              </label>
              {l.kind === "appliance" &&
                l.allocations
                  .filter((a) => a.returned.n === "0")
                  .map((a) => (
                    <label key={a.stockId}>
                      <input
                        type="checkbox"
                        checked={value.serials.includes(a.stockId)}
                        onChange={(e) =>
                          setSelected((old) => ({
                            ...old,
                            [i]: {
                              ...value,
                              serials: e.target.checked
                                ? [...value.serials, a.stockId]
                                : value.serials.filter(
                                    (id) => id !== a.stockId,
                                  ),
                            },
                          }))
                        }
                      />
                      {a.serial}
                    </label>
                  ))}
            </div>
          );
        })}
        <label>
          <input
            type="checkbox"
            checked={exchange}
            onChange={(e) => setExchange(e.target.checked)}
          />
          Combinar con nueva venta como cambio
        </label>
        {exchange && (
          <>
            <Pager page={items} />
            <label>
              Agregar producto nuevo
              <select
                value=""
                onChange={(e) => {
                  const item = items.items.find((i) => i.id === e.target.value);
                  if (
                    item &&
                    !replacements.some((l) => l.item.id === item.id) &&
                    replacements.length < 20
                  )
                    setReplacements((old) => [
                      ...old,
                      {
                        item,
                        qty: "1",
                        unit: item.priceUnit,
                        cost: "",
                        lot: "",
                        expiresOn: "",
                        serials: [],
                        fullBoxes: false,
                        wastePercent: 0,
                      },
                    ]);
                }}
              >
                <option value="">Seleccionar</option>
                {items.items
                  .filter((i) => i.active)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} · {bob(i.priceMinor)}/{UNITS[i.priceUnit]}
                    </option>
                  ))}
              </select>
            </label>
            {replacements.map((line, index) => (
              <CartEditor
                key={line.item.id}
                line={line}
                purchase={false}
                update={(patch) =>
                  setReplacements((old) =>
                    old.map((l, i) => (i === index ? { ...l, ...patch } : l)),
                  )
                }
                remove={() =>
                  setReplacements((old) => old.filter((_, i) => i !== index))
                }
              />
            ))}
            <p>
              La caja registra solamente la diferencia entre devolución y nueva
              venta.
            </p>
          </>
        )}
        <Field name="reason" label="Motivo" maxLength={200} />
        <MethodField />
        <p>
          Se restituye el costo histórico. Los equipos reingresados quedan en
          inspección.
        </p>
      </ActionForm>
    </Panel>
  );
}
