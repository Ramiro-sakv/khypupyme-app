import type {
  SaleLineV2,
  TimberSelection,
} from "../../../shared/workspace/model";
import {
  add,
  amount,
  div,
  showQuantity,
  ZERO,
} from "../../../shared/workspace/exact";
import { timberTotals } from "../../../shared/workspace/timber-groups";
import { dimensionInputFromMm } from "../../../shared/workspace/timber-measures";
import { useWorkspace } from "./context";
import { bob } from "./format";
export default function TimberReturnFields({
  line,
  selection,
  onChange,
}: {
  line: SaleLineV2;
  selection?: TimberSelection | undefined;
  onChange: (next: TimberSelection) => void;
}) {
  const { business } = useWorkspace(),
    system = business.timberSystem ?? "imperial",
    original = line.timber!;
  let refund = 0;
  try {
    const volume = selection?.widths.length
      ? timberTotals(line.fields.thicknessMm!, selection).volume
      : ZERO;
    refund =
      amount(line.netMinor, div(add(line.returned, volume), line.delivered)) -
      line.refundedMinor;
  } catch {
    /* El servidor valida los límites. */
  }
  return (
    <div className="table-scroll">
      <p>
        Largo original:{" "}
        {dimensionInputFromMm(original.lengthMm, "lengthMm", system)}{" "}
        {system === "imperial" ? "pies" : "mm"}. Selecciona qué piezas devuelve
        el cliente.
      </p>
      <table>
        <thead>
          <tr>
            <th>Ancho</th>
            <th>Pendientes</th>
            <th>Devuelve</th>
          </tr>
        </thead>
        <tbody>
          {original.widths.map((row) => {
            const allocation = line.allocations.find(
              (a) =>
                a.timber?.widthMm === row.widthMm &&
                a.timber.lengthMm === original.lengthMm,
            );
            const one = timberTotals(line.fields.thicknessMm!, {
              lengthMm: original.lengthMm,
              widths: [{ widthMm: row.widthMm, pieces: 1 }],
            }).volume;
            const left =
              row.pieces -
              (allocation ? Number(div(allocation.returned, one).n) : 0);
            return (
              <tr key={row.widthMm}>
                <td>
                  {dimensionInputFromMm(row.widthMm, "widthMm", system)}{" "}
                  {system === "imperial" ? "pulgadas" : "mm"}
                </td>
                <td>{left}</td>
                <td>
                  <input
                    name="return-qty"
                    aria-label={
                      "Devuelve piezas de ancho " +
                      dimensionInputFromMm(row.widthMm, "widthMm", system)
                    }
                    type="number"
                    min="0"
                    max={left}
                    value={
                      selection?.widths.find((r) => r.widthMm === row.widthMm)
                        ?.pieces ?? 0
                    }
                    onChange={(e) => {
                      const rows = (selection?.widths ?? []).filter(
                          (r) => r.widthMm !== row.widthMm,
                        ),
                        pieces = Number(e.target.value);
                      if (pieces > 0)
                        rows.push({ widthMm: row.widthMm, pieces });
                      onChange({ lengthMm: original.lengthMm, widths: rows });
                    }}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p>
        Reintegro calculado desde la venta: {bob(refund)} · vendido{" "}
        {showQuantity(line.charged)} pies tablares.
      </p>
    </div>
  );
}
