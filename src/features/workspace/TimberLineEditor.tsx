import { TIMBER_CATEGORIES, timberCategory, timberThickness } from "../../../shared/workspace/timber-species";
import { AppError } from "../../../shared/app-errors";
import { useState } from "react";
import {
  dimensionInputFromMm,
  dimensionDisplayFromMm,
  dimensionToMm,
  BOARD_FOOT_MM3,
} from "../../../shared/workspace/timber-measures";
import {
  parseTimberWidths,
  widthSelectionText,
} from "../../../shared/workspace/timber-width-entry";
import { timberTotals } from "../../../shared/workspace/timber-groups";
import { div } from "../../../shared/workspace/exact";
import { displayQuantity } from "../../../shared/workspace/presentation";
import type { TimberStockGroup } from "../../../shared/workspace/model";
import type { CartStock } from "../../../shared/workspace/availability";
import { StockNumbers } from "./StockNumbers";
import type { CartLine } from "./Cart";
import { linePrice } from "./Cart";
import { useRecords, useWorkspace } from "./context";
import { bob, cents } from "./format";
import { errorMessage } from "../../shared/errors";
import { Pager } from "./ui";

export default function TimberLineEditor({
  line,
  update,
  remove,
  purchase,
  duplicate,
  availability,
}: {
  line: CartLine;
  update: (patch: Partial<CartLine>) => void;
  remove: () => void;
  purchase: boolean;
  duplicate?: (() => void) | undefined;
  availability?: CartStock | undefined;
}) {
  const { business, busy } = useWorkspace(),
    system = line.widthsEntry?.system ?? business.timberSystem ?? "imperial";
  const [touched, setTouched] = useState(false),
    [localError, setLocalError] = useState("");
  const original = line.timber ?? {
    lengthMm: "",
    widths: [],
    priceMinor: line.item.priceMinor,
  };
  let selection = original,
    issue = "",
    notices: string[] = [];
  if (line.widthsEntry?.source === "text") {
    try {
      const parsed = parseTimberWidths(line.widthsEntry.text, system);
      selection = { ...original, widths: parsed.widths };
      notices = parsed.notices;
    } catch (cause) {
      selection = { ...original, widths: [] };
      issue = errorMessage(cause);
    }
  }
  if (!issue && touched && !selection.widths.length)
    issue = errorMessage(
      new AppError(
        "Falta indicar los anchos de este grupo.",
        400,
        "WIDTH_REQUIRED",
        "timber-widths",
      ),
    );
  if (!issue && line.item.timberSpecies && (touched || line.lengthInput || line.thicknessInput)) {
    try { timberThickness(selection.thicknessMm ?? ""); timberCategory(selection.lengthMm); }
    catch (cause) { issue = errorMessage(cause); }
  }
  const text =
    line.widthsEntry?.text ?? widthSelectionText(selection.widths, system);
  const stock = useRecords<TimberStockGroup>(
    "timberGroups",
    {
      itemId: line.item.id,
      active: true,
      ...(line.item.timberSpecies && line.item.fields.thicknessMm ? { thicknessMm: line.item.fields.thicknessMm } : {}),
      ...(selection.lengthMm ? { lengthMm: selection.lengthMm } : {}),
    },
    !purchase && (!line.item.timberSpecies || (!!line.item.fields.thicknessMm && !!selection.lengthMm)),
  );
  let summary = "Indica el largo y los anchos para calcular.",
    pieces = 0,
    feet = "—";
  const price = linePrice(line, purchase);
  try {
    const totals = timberTotals(line.item.fields.thicknessMm!, selection);
    pieces = totals.pieces;
    feet = displayQuantity(totals.boardFeet);
    summary = pieces + " piezas · " + feet + " pies tablares";
    if (system === "metric")
      summary +=
        " · " +
        displayQuantity(div(totals.volume, { n: "1000000000", d: "1" })) +
        " m³";
  } catch {
    /* La captura incompleta no sustituye un valor válido al confirmar. */
  }
  function select(next: typeof selection) {
    update({
      timber: next,
      qty: String(next.widths.reduce((n, r) => n + r.pieces, 0)),
      unit: "piece",
      widthsEntry: {
        version: 2,
        system,
        text: widthSelectionText(next.widths, system),
        source: "selection",
      },
    });
    setLocalError("");
  }
  function input(value: string) {
    let widths: typeof selection.widths = [];
    try {
      widths = parseTimberWidths(value, system).widths;
    } catch {
      /* Se muestra una indicación sin conservar totales anteriores. */
    }
    update({
      timber: { ...original, widths },
      qty: String(widths.reduce((n, r) => n + r.pieces, 0)),
      unit: "piece",
      widthsEntry: { version: 2, system, text: value, source: "text" },
    });
    setLocalError("");
  }
  function clear() {
    update({
      timber: { ...original, widths: [] },
      qty: "0",
      widthInput: "",
      widthsEntry: { version: 2, system, text: "", source: "text" },
    });
    setTouched(false);
    setLocalError("");
  }
  function recoverLegacy() {
    try {
      const widths = original.widths.map((r) => ({ ...r }));
      for (const token of (line.widthInput ?? "")
        .split(/[;\n]+/)
        .filter((t) => t.trim())) {
        const widthMm = dimensionToMm(token.trim(), "widthMm", system),
          found = widths.find((r) => r.widthMm === widthMm);
        if (found) found.pieces++;
        else widths.push({ widthMm, pieces: 1 });
      }
      select({ ...original, widths });
      update({ widthInput: "" });
    } catch (cause) {
      setLocalError(errorMessage(cause));
    }
  }
  return (
    <section className="timber-sale-group" data-tutorial="timber-group">
      <header className="section-heading">
        <strong>{line.item.name}</strong>
        <div className="actions">
          {duplicate && (
            <button type="button" disabled={busy} onClick={duplicate}>
              Duplicar grupo
            </button>
          )}
          <button type="button" disabled={busy} onClick={remove}>
            Quitar grupo
          </button>
        </div>
      </header>
      <div className="timber-calculator-fields">
        <label>
          Espesor ({system === "imperial" ? "pulgadas" : "mm"})
          {line.item.timberSpecies ? <input name="timber-thickness" required placeholder={system === "imperial" ? "Ej.: 1; 1 1/2; 2; otro espesor" : "Espesor en mm"}
            value={line.thicknessInput ?? (line.item.fields.thicknessMm ? dimensionInputFromMm(line.item.fields.thicknessMm, "thicknessMm", system) : "")}
            onChange={(e) => {
              let thicknessMm = "";
              try { thicknessMm = timberThickness(dimensionToMm(e.target.value, "thicknessMm", system)); } catch { /* Se valida al confirmar. */ }
              update({ thicknessInput: e.target.value, item: { ...line.item, fields: { ...line.item.fields, thicknessMm } }, timber: { ...original, thicknessMm } });
            }} /> : <output className="readonly-measure">
            {dimensionDisplayFromMm(
              line.item.fields.thicknessMm!,
              "thicknessMm",
              system,
            )}
          </output>}
        </label>
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
                lengthMm =
                  e.target.value ===
                  dimensionInputFromMm(
                    original.lengthMm || "0",
                    "lengthMm",
                    system,
                  )
                    ? original.lengthMm
                    : dimensionToMm(e.target.value, "lengthMm", system);
              } catch {
                /* Conservar texto incompleto. */
              }
              let priceMinor = original.priceMinor, priceInput = line.priceInput, priceManual = line.priceManual;
              if (line.item.timberSpecies && !purchase) {
                try {
                  const category = timberCategory(lengthMm);
                  let previousCategory;
                  try { previousCategory = timberCategory(original.lengthMm); } catch { /* Captura incompleta. */ }
                  const keep = priceManual && (category === previousCategory || window.confirm("Cambió la categoría del largo. ¿Conservar la tarifa manual de este grupo?"));
                  if (!keep) { priceMinor = line.item.timberSpecies.prices[category]; priceInput = (priceMinor / 100).toFixed(2); priceManual = false; }
                } catch { /* Un largo incompleto no habilita confirmar. */ }
              }
              update({ lengthInput: e.target.value, priceInput, priceManual, timber: { ...original, lengthMm, priceMinor } });
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
            required
            inputMode="decimal"
            onChange={(e) => {
              if (purchase) update({ cost: e.target.value });
              else {
                let priceMinor = 0;
                try {
                  priceMinor = cents(e.target.value);
                } catch {
                  /* Se valida antes de enviar. */
                }
                update({
                  priceInput: e.target.value,
                  priceManual: true,
                  timber: { ...original, priceMinor },
                });
              }
            }}
          />
        </label>
      </div>
      {line.item.timberSpecies && <p className="notice">{(() => { try { return TIMBER_CATEGORIES[timberCategory(selection.lengthMm)] + " · tarifa de catálogo " + bob(line.item.timberSpecies.prices[timberCategory(selection.lengthMm)]) + "/pie tablar"; } catch { return "Indica un largo entero de 1 a 20 pies para determinar categoría y tarifa."; } })()}</p>}
      <label>
        Anchos ({system === "imperial" ? "pulgadas comerciales enteras" : "mm"})
        <textarea
          rows={3}
          name="timber-widths"
          maxLength={20000}
          required
          placeholder="6, 10, 5, 3 o 5x10, 4x7, 7x3"
          value={text}
          aria-invalid={touched && !!issue}
          onChange={(e) => input(e.target.value)}
          onBlur={() => setTouched(true)}
        />
      </label>
      <small>
        Comas, punto y coma o saltos de línea separan piezas. 5x10 significa 5
        piezas de ancho 10.
        {system === "imperial"
          ? " La fracción del ancho se descarta hacia abajo; el espesor conserva sus fracciones."
          : " Los decimales se escriben con punto."}
      </small>
      {notices.map((note) => (
        <p key={note} className="notice notice-info">
          {note}
        </p>
      ))}
      {issue &&
        (touched ? (
          <p role="alert">{issue}</p>
        ) : (
          <p role="status">
            {issue.replace(/\s*\[400\]$/, " ")} El total todavía no está listo
            para confirmar.
          </p>
        ))}
      {localError && <p role="alert">{localError}</p>}
      {line.widthInput?.trim() && (
        <div className="notice notice-warning">
          <p>
            Texto pendiente del formato anterior: {line.widthInput}. No se
            interpreta automáticamente como una lista nueva.
          </p>
          <button type="button" onClick={recoverLegacy}>
            Recuperar con el formato anterior (
            {system === "imperial" ? "pulgadas" : "mm"})
          </button>
          <button type="button" onClick={() => update({ widthInput: "" })}>
            Descartar solo ese texto pendiente
          </button>
        </div>
      )}
      <div className="timber-calculator-results">
        <div>
          <span>Piezas</span>
          <strong>{issue ? "—" : pieces}</strong>
        </div>
        <div>
          <span>Pies tablares</span>
          <strong>{issue ? "—" : feet}</strong>
        </div>
        <div>
          <span>Subtotal</span>
          <strong>{issue || "issue" in price ? "—" : bob(price.subtotal)}</strong>
          {!issue && ("issue" in price ? <small>{price.issue}</small> :
            <small>{purchase ? "Costo" : "Precio"} {bob(price.unitMinor)} / pie tablar</small>)}
        </div>
      </div>
      <button type="button" disabled={busy} onClick={clear}>
        Vaciar anchos
      </button>
      {!purchase && (
        <details>
          <summary>Elegir medidas disponibles</summary>
          <Pager page={stock} />
          <div className="timber-stock-picker">
            {stock.items.map((g) => (
              <button
                type="button"
                key={g.id}
                disabled={busy}
                onClick={() => {
                  const rows = selection.widths.map((r) => ({ ...r })),
                    found = rows.find((r) => r.widthMm === g.widthMm);
                  if (found) found.pieces++;
                  else rows.push({ widthMm: g.widthMm, pieces: 1 });
                  select({ ...selection, lengthMm: g.lengthMm, widths: rows });
                  update({
                    lengthInput: dimensionInputFromMm(
                      g.lengthMm,
                      "lengthMm",
                      system,
                    ),
                  });
                }}
              >
                {dimensionDisplayFromMm(g.lengthMm, "lengthMm", system)}
                {system === "imperial" ? "′" : " mm"} ×{" "}
                {dimensionDisplayFromMm(g.widthMm, "widthMm", system)}
                {system === "imperial" ? "″" : " mm"} · {g.pieces} piezas
              </button>
            ))}
          </div>
          <small>
            Seleccionar medidas guardadas conserva su valor original, incluidas
            medidas anteriores no enteras. La venta vuelve a comprobar
            existencias al confirmar.
          </small>
        </details>
      )}
      {!!selection.widths.length && (
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
                let rowFeet = "—";
                try {
                  rowFeet = displayQuantity(
                    div(
                      timberTotals(line.item.fields.thicknessMm!, {
                        ...selection,
                        widths: [row],
                      }).volume,
                      BOARD_FOOT_MM3,
                    ),
                  );
                } catch {
                  /* Falta el largo. */
                }
                const check = availability?.checks.find((entry) => entry.widthMm === row.widthMm);
                return (
                  <tr key={row.widthMm} data-shortage={check && check.missing.n !== "0" || undefined}>
                    <td>
                      {dimensionDisplayFromMm(row.widthMm, "widthMm", system)}
                    </td>
                    <td>
                      <input
                        aria-label={
                          "Piezas de ancho " +
                          dimensionDisplayFromMm(row.widthMm, "widthMm", system)
                        }
                        type="number"
                        min="1"
                        max="1000000"
                        step="1"
                        value={row.pieces}
                        onChange={(e) =>
                          select({
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
                    <td>{rowFeet}</td>
                    {!purchase && (
                      <td>
                        {check ? <StockNumbers check={check} unit="piezas" /> : "Por comprobar"}
                      </td>
                    )}
                    <td>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          select({
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
      )}
      {!issue && (
        <p className="timber-group-total" aria-live="polite">
          {summary}
        </p>
      )}
    </section>
  );
}
