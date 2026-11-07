import { useState } from "react";
import type { Item } from "../../../shared/workspace/model";
import type { CartLine } from "./Cart";
import TimberLineEditor from "./TimberLineEditor";
import { useWorkspace } from "./context";
import { ActionForm, Field } from "./ui";
import { cents, q } from "./format";
export default function TimberAdjustment({ item }: { item: Item }) {
  const { run, busy } = useWorkspace();
  const [direction, setDirection] = useState<"in" | "out">("in"),
    [line, setLine] = useState<CartLine>({
      item,
      qty: "0",
      unit: "piece",
      cost: "0",
      lot: "",
      expiresOn: "",
      serials: [],
      fullBoxes: false,
      wastePercent: 0,
      timber: { lengthMm: "", widths: [], priceMinor: item.priceMinor },
    });
  return (
    <details className="correction-actions">
      <summary>Entrada o salida de madera con motivo</summary>
      <ActionForm
        disabled={busy}
        label="Confirmar movimiento de estas medidas"
        onSave={async (d) => {
          if (!line.timber?.widths.length)
            throw new Error("Añade las medidas.");
          const result = await run({
            kind: "stock-adjust",
            input: {
              itemId: item.id,
              direction,
              qty: q(line.qty),
              unit: "piece",
              timber: {
                lengthMm: line.timber.lengthMm,
                widths: line.timber.widths,
              },
              unitCostMinor: cents(line.cost),
              reason: String(d.get("reason")),
              lot: "",
              expiresOn: "",
              serials: [],
            },
          });
          if (result)
            setLine((old) => ({
              ...old,
              qty: "0",
              timber: { lengthMm: "", widths: [], priceMinor: item.priceMinor },
              widthInput: "",
              lengthInput: "",
            }));
        }}
      >
        <label>
          Movimiento
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as "in" | "out")}
          >
            <option value="in">Entrada con costo declarado</option>
            <option value="out">Salida con pérdida de valor</option>
          </select>
        </label>
        <TimberLineEditor
          line={line}
          update={(patch) => setLine((old) => ({ ...old, ...patch }))}
          remove={() =>
            setLine((old) => ({
              ...old,
              qty: "0",
              timber: { lengthMm: "", widths: [], priceMinor: item.priceMinor },
            }))
          }
          purchase={direction === "in"}
        />
        <Field name="reason" label="Motivo obligatorio" maxLength={200} />
      </ActionForm>
    </details>
  );
}
