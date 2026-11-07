import {
  dimensionInputFromMm,
  dimensionToMm,
  BOARD_FOOT_MM3,
} from "../../../shared/workspace/timber-measures";
import { timberTotals } from "../../../shared/workspace/timber-groups";
import { amount, div, showQuantity } from "../../../shared/workspace/exact";
import type { TimberStockGroup } from "../../../shared/workspace/model";
import type { CartLine } from "./Cart";
import { useRecords, useWorkspace } from "./context";
import { bob, cents } from "./format";
import { Pager } from "./ui";

export default function TimberLineEditor({
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
  const { business, busy } = useWorkspace(),
    system = business.timberSystem ?? "imperial";
  const selection = line.timber ?? {
    lengthMm: "",
    widths: [],
    priceMinor: line.item.priceMinor,
  };
  const stock = useRecords<TimberStockGroup>(
    "timberGroups",
    {
      itemId: line.item.id,
      active: true,
      ...(selection.lengthMm ? { lengthMm: selection.lengthMm } : {}),
    },
    !purchase,
  );
  let summary = "Añade un largo y los anchos de las piezas.";
  try {
    const totals = timberTotals(line.item.fields.thicknessMm!, selection);
    const volume =
      system === "metric"
        ? showQuantity(div(totals.volume, { n: "1000000000", d: "1" })) +
          " m³ · "
        : "";
    summary =
      totals.pieces +
      " piezas · " +
      volume +
      showQuantity(totals.boardFeet) +
      " pies tablares · " +
      bob(
        amount(
          purchase ? cents(line.cost || "0") : selection.priceMinor,
          totals.boardFeet,
        ),
      );
  } catch {
    /* El formulario conserva medidas incompletas hasta su corrección. */
  }
  function change(next: typeof selection) {
    update({
      timber: next,
      qty: String(next.widths.reduce((n, r) => n + r.pieces, 0)),
      unit: "piece",
    });
  }
  function add(widthMm: string, lengthMm = selection.lengthMm) {
    update({ lengthInput: dimensionInputFromMm(lengthMm, "lengthMm", system) });
    const index = selection.widths.findIndex((r) => r.widthMm === widthMm);
    change({
      ...selection,
      lengthMm,
      widths:
        index < 0
          ? [...selection.widths, { widthMm, pieces: 1 }]
          : selection.widths.map((r, i) =>
              i === index ? { ...r, pieces: r.pieces + 1 } : r,
            ),
    });
  }
  function addWidths() {
    const next = selection.widths.map((r) => ({ ...r }));
    try {
      const raw = line.widthInput?.trim();
      if (!raw) return;
      for (const token of raw.split(/[;\n]+/).filter(Boolean)) {
        const widthMm = dimensionToMm(token.trim(), "widthMm", system),
          found = next.find((r) => r.widthMm === widthMm);
        if (found) found.pieces++;
        else next.push({ widthMm, pieces: 1 });
      }
      if (next.length > 100)
        throw new Error("Máximo 100 medidas; divide la operación.");
      change({ ...selection, widths: next });
      update({ widthInput: "", timberError: "" });
    } catch (e) {
      update({
        timberError: e instanceof Error ? e.message : "Revisa el ancho.",
      });
    }
  }
  const error = line.timberError ?? "";
  return (
    <section className="timber-sale-group" data-tutorial="timber-group">
      <header className="section-heading">
        <strong>
          {line.item.name} ·{" "}
          {dimensionInputFromMm(
            line.item.fields.thicknessMm!,
            "thicknessMm",
            system,
          )}
          {system === "imperial" ? "″" : " mm"}
        </strong>
        <button type="button" onClick={remove}>
          Quitar grupo
        </button>
      </header>
      <div className="timber-group-fields">
        <label>
          Largo ({system === "imperial" ? "pies" : "mm"})
          <input
            name="timber-length"
            value={
              line.lengthInput ??
              (selection.lengthMm
                ? dimensionInputFromMm(selection.lengthMm, "lengthMm", system)
                : "")
            }
            onChange={(e) => {
              let lengthMm = "";
              try {
                lengthMm = dimensionToMm(e.target.value, "lengthMm", system);
              } catch {
                /* Conserva texto incompleto en borrador. */
              }
              update({
                lengthInput: e.target.value,
                timber: { ...selection, lengthMm },
              });
            }}
            required
          />
        </label>
        <label>
          {purchase
            ? "Costo por pie tablar (BOB)"
            : "Precio por pie tablar (BOB)"}
          <input
            name={purchase ? "line-cost" : "timber-price"}
            value={
              purchase
                ? line.cost
                : (line.priceInput ?? (selection.priceMinor / 100).toFixed(2))
            }
            inputMode="decimal"
            required
            onChange={(e) => {
              if (purchase) update({ cost: e.target.value });
              else {
                let priceMinor = 0;
                try {
                  priceMinor = cents(e.target.value);
                } catch {
                  /* Validar al confirmar. */
                }
                update({
                  priceInput: e.target.value,
                  timber: { ...selection, priceMinor },
                });
              }
            }}
          />
        </label>
      </div>
      {!purchase && (
        <>
          <details>
            <summary>Elegir medidas disponibles</summary>
            <Pager page={stock} />
            <div className="timber-stock-picker">
              {stock.items
                .filter(
                  (g) =>
                    !selection.lengthMm || g.lengthMm === selection.lengthMm,
                )
                .map((g) => (
                  <button
                    type="button"
                    key={g.id}
                    disabled={busy}
                    onClick={() => add(g.widthMm, g.lengthMm)}
                  >
                    {dimensionInputFromMm(g.lengthMm, "lengthMm", system)}
                    {system === "imperial" ? "′" : " mm"} ×{" "}
                    {dimensionInputFromMm(g.widthMm, "widthMm", system)}
                    {system === "imperial" ? "″" : " mm"} · {g.pieces} piezas
                  </button>
                ))}
            </div>
          </details>
          <small>
            Las medidas elegidas se vuelven a comprobar al confirmar. El
            catálogo no cambia al editar esta tarifa.
          </small>
        </>
      )}
      <label>
        Anchos ({system === "imperial" ? "pulgadas" : "mm"}) · Enter añade una
        pieza
        <textarea
          rows={2}
          name="timber-widths"
          value={line.widthInput ?? ""}
          placeholder="Sugerencia: 6; 8; 10"
          onChange={(e) => update({ widthInput: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addWidths();
            }
          }}
        />
      </label>
      <button type="button" disabled={busy} onClick={addWidths}>
        Añadir anchos
      </button>
      <small>
        Pega anchos separados por punto y coma o saltos de línea; admite coma
        decimal y fracciones.
      </small>
      {error && <p role="alert">{error}</p>}
      <div className="table-scroll">
        <table className="timber-width-table">
          <thead>
            <tr>
              <th>Ancho</th>
              <th>Piezas</th>
              <th>Pies tablares</th>
              {!purchase && <th>Disponible</th>}
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {selection.widths.map((row, index) => {
              let feet = "—";
              try {
                feet = showQuantity(
                  div(
                    timberTotals(line.item.fields.thicknessMm!, {
                      ...selection,
                      widths: [row],
                    }).volume,
                    BOARD_FOOT_MM3,
                  ),
                );
              } catch {
                /* Largo pendiente. */
              }
              return (
                <tr key={row.widthMm}>
                  <td>
                    <input
                      aria-label="Corregir ancho"
                      defaultValue={dimensionInputFromMm(
                        row.widthMm,
                        "widthMm",
                        system,
                      )}
                      onBlur={(e) => {
                        try {
                          const widthMm = dimensionToMm(
                              e.target.value,
                              "widthMm",
                              system,
                            ),
                            rows = selection.widths
                              .filter((_, i) => i !== index)
                              .map((r) => ({ ...r })),
                            existing = rows.find((r) => r.widthMm === widthMm);
                          if (existing) existing.pieces += row.pieces;
                          else rows.splice(index, 0, { ...row, widthMm });
                          e.currentTarget.setCustomValidity("");
                          change({ ...selection, widths: rows });
                          update({ timberError: "" });
                        } catch (cause) {
                          const message =
                            cause instanceof Error
                              ? cause.message
                              : "Revisa el ancho.";
                          e.currentTarget.setCustomValidity(message);
                          update({ timberError: message });
                        }
                      }}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={
                        "Piezas de ancho " +
                        dimensionInputFromMm(row.widthMm, "widthMm", system)
                      }
                      type="number"
                      min="1"
                      max="1000000"
                      value={row.pieces}
                      onChange={(e) =>
                        change({
                          ...selection,
                          widths: selection.widths.map((r, i) =>
                            i === index
                              ? { ...r, pieces: Number(e.target.value) }
                              : r,
                          ),
                        })
                      }
                    />
                  </td>
                  <td>{feet}</td>
                  {!purchase && (
                    <td>
                      {stock.loading
                        ? "Cargando…"
                        : (stock.items.find(
                            (g) =>
                              g.lengthMm === selection.lengthMm &&
                              g.widthMm === row.widthMm,
                          )?.pieces ?? "Consultar medidas")}
                    </td>
                  )}
                  <td>
                    <button
                      type="button"
                      onClick={() =>
                        change({
                          ...selection,
                          widths: selection.widths.filter(
                            (_, i) => i !== index,
                          ),
                        })
                      }
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="timber-group-total" aria-live="polite">
        {summary}
      </p>
    </section>
  );
}
