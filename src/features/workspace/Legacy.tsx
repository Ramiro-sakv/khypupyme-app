import {
  SPECIFICATIONS,
  UNIT_LABELS,
} from "../../../shared/product-specification";
import type { ProductSpecification } from "../../../shared/product-specification";
import { useState } from "react";
import type { Unit } from "../../../shared/workspace/model";
import type { WorkspaceResource } from "../../../shared/workspace/model";
import { UNITS } from "../../../shared/workspace/catalog";
import { useRecords, useWorkspace } from "./context";
import { ActionForm, Field, MethodField, Pager } from "./ui";
import { localDate, statusLabel } from "./format";
import { bob, cents, method, q, serials, today } from "./format";
import ItemForm from "./ItemForm";
interface OldProduct {
  id: string;
  name: string;
  stock: number;
  priceMinor: number;
  inventoryValueMinor?: number;
  convertedTo?: string;
  specification?: ProductSpecification;
}
export default function Legacy() {
  const { run, busy } = useWorkspace(),
    page = useRecords<OldProduct>("products"),
    [convert, setConvert] = useState<OldProduct | null>(null),
    [history, setHistory] = useState("");
  return (
    <>
      <h2>Registros anteriores</h2>
      <p>
        Se conservan sus identificadores, unidades e historial. No se
        reinterpretan automáticamente.
      </p>
      <Pager page={page} />
      {page.items.map((p) => (
        <article className="card" key={p.id}>
          <h3>{p.name}</h3>
          <button onClick={() => setHistory(p.id)}>Ver historial</button>
          <p>
            {p.stock}{" "}
            {p.specification ? UNIT_LABELS[p.specification.unit] : "unidades"} ·{" "}
            {p.inventoryValueMinor === undefined
              ? "Costo pendiente"
              : bob(p.inventoryValueMinor)}{" "}
            {p.convertedTo ? "· Conversión registrada" : ""}
          </p>
          {p.inventoryValueMinor === undefined ? (
            <ActionForm
              disabled={busy}
              label="Valorar existencias explícitamente"
              onSave={(d) =>
                run({
                  kind: "legacy-value",
                  input: {
                    productId: p.id,
                    unitCostMinor: cents(d.get("cost")),
                  },
                })
              }
            >
              <Field name="cost" label="Costo por unidad anterior (BOB)" />
            </ActionForm>
          ) : (
            p.stock > 0 && (
              <button onClick={() => setConvert(p)}>
                Proponer conversión auditada
              </button>
            )
          )}
        </article>
      ))}
      {history && <OldHistory id={history} close={() => setHistory("")} />}
      {convert && (
        <section className="card">
          <h3>Convertir {convert.name}</h3>
          <p>
            Antes: {convert.stock}{" "}
            {convert.specification
              ? UNIT_LABELS[convert.specification.unit]
              : "unidades"}{" "}
            · valor exacto {bob(convert.inventoryValueMinor!)}. Se preserva este
            mismo valor; revisa las unidades nuevas antes de confirmar.
          </p>
          <p>
            {convert.specification
              ? SPECIFICATIONS[convert.specification.kind].fields
                  .map(
                    (f) =>
                      f.label +
                      ": " +
                      String(convert.specification!.attributes[f.key] ?? ""),
                  )
                  .join(" · ")
              : "Producto anterior sin ficha especializada."}
          </p>
          <ItemForm
            allowGrouped={false}
            label="Confirmar conversión y conservar valor total"
            onSave={async (item, d) => {
              const result = await run({
                kind: "convert-legacy",
                input: {
                  productId: convert.id,
                  item,
                  qty: q(d.get("newQty")),
                  unit: String(d.get("newUnit")) as Unit,
                  lot: String(d.get("lot") ?? ""),
                  expiresOn: String(d.get("expires") ?? ""),
                  serials: serials(String(d.get("serials") ?? "")),
                  expectedStock: convert.stock,
                  expectedValueMinor: convert.inventoryValueMinor!,
                },
              });
              if (result) setConvert(null);
            }}
          >
            <Field name="newQty" label="Nueva cantidad equivalente" />
            <label>
              Nueva unidad
              <select name="newUnit">
                {Object.entries(UNITS).map(([u, label]) => (
                  <option key={u} value={u}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <Field name="lot" label="Lote original" required={false} />
            <Field
              name="expires"
              label="Vencimiento original"
              type="date"
              required={false}
            />
            <Field
              name="serials"
              label="Series de equipos, separadas por coma"
              required={false}
            />
            <label>
              <input type="checkbox" required />
              Confirmo la equivalencia de cantidades y el mismo valor total.
            </label>
          </ItemForm>
          <button onClick={() => setConvert(null)}>Cancelar propuesta</button>
        </section>
      )}
      <LegacyRecords resource="sales" label="Ventas anteriores" />
      <LegacyRecords resource="purchases" label="Compras anteriores" />
      <LegacyRecords resource="expenses" label="Gastos anteriores" />
      <LegacyRecords resource="receivables" label="Fiados anteriores" />
    </>
  );
}
function LegacyRecords({
  resource,
  label,
}: {
  resource: WorkspaceResource;
  label: string;
}) {
  const { run, busy } = useWorkspace(),
    page = useRecords<Record<string, unknown>>(resource);
  return (
    <details>
      <summary>{label}</summary>
      <Pager page={page} />
      {page.items.map((row) => {
        const id = String(row.id),
          amount = Number(row.totalMinor ?? row.amountMinor ?? 0),
          active = row.status === "active" || row.status === "pending";
        return (
          <article className="card" key={id}>
            <strong>
              {String(
                row.description ?? row.customerName ?? row.productName ?? id,
              )}{" "}
              · {bob(amount)}
            </strong>
            <p>
              {localDate(String(row.date ?? ""))} ·{" "}
              {row.status ? statusLabel(String(row.status)) : "Conservado"}
            </p>
            <details>
              <summary>Detalle conservado</summary>
              <LegacyDetail row={row} />
            </details>
            {resource === "receivables" && row.status === "pending" && (
              <ActionForm
                disabled={busy}
                label="Cobrar saldo anterior completo"
                onSave={(d) => {
                  const operationId = crypto.randomUUID();
                  return run(
                    {
                      kind: "legacy-commerce",
                      input: {
                        command: {
                          kind: "collect",
                          operationId,
                          input: { id, method: method(d), date: today() },
                        },
                      },
                    },
                    operationId,
                  );
                }}
              >
                <MethodField />
              </ActionForm>
            )}
            {(active || resource === "purchases") && (
              <ActionForm
                disabled={busy}
                label="Anular registro anterior con evidencia"
                onSave={(d) => {
                  const operationId = crypto.randomUUID(),
                    reason = String(d.get("reason"));
                  if (resource === "purchases")
                    return run(
                      {
                        kind: "recover-legacy",
                        input: {
                          source: "inventory",
                          request: {
                            kind: "reverse",
                            id: operationId,
                            purchaseId: id,
                            reason,
                          },
                        },
                      },
                      operationId,
                    );
                  const kind =
                    resource === "sales"
                      ? "cancel-sale"
                      : resource === "expenses"
                        ? "cancel-expense"
                        : "cancel-receivable";
                  return run(
                    {
                      kind: "legacy-commerce",
                      input: {
                        command: { kind, operationId, input: { id, reason } },
                      },
                    },
                    operationId,
                  );
                }}
              >
                <Field name="reason" label="Motivo" />
                <p>
                  La anulación de compra requiere que no existan movimientos
                  posteriores.
                </p>
              </ActionForm>
            )}
          </article>
        );
      })}
    </details>
  );
}

function OldHistory({ id, close }: { id: string; close: () => void }) {
  const page = useRecords<{
    id: string;
    kind: string;
    reason: string;
    delta: number;
    stockBefore: number;
    stockAfter: number;
    createdAt: string;
  }>("inventoryMovements", { itemId: id });
  return (
    <section className="card">
      <h3>Historial en unidades originales</h3>
      <button onClick={close}>Cerrar historial</button>
      <Pager page={page} />
      {page.items.map((m) => (
        <p key={m.id}>
          {localDate(m.createdAt)} · {m.reason} · {m.stockBefore} →{" "}
          {m.stockAfter} ({m.delta > 0 ? "+" : ""}
          {m.delta})
        </p>
      ))}
    </section>
  );
}
function LegacyDetail({ row }: { row: Record<string, unknown> }) {
  const fields = [
    ["Cliente", row.customerName],
    ["Producto", row.productName],
    ["Concepto", row.description],
    ["Referencia", row.reference],
    ["Cantidad original", row.quantity],
    ["Motivo de anulación", row.cancelReason],
    ["Fecha", row.date],
  ];
  return (
    <>
      <dl>
        {fields
          .filter(([, value]) => value !== undefined && value !== "")
          .map(([label, value]) => (
            <div key={String(label)}>
              <dt>{String(label)}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
      </dl>
      {Array.isArray(row.lines) &&
        row.lines.map((line: Record<string, unknown>, i: number) => (
          <p key={i}>
            {String(line.name)} · {String(line.quantity)} unidades originales ·{" "}
            {bob(Number(line.totalMinor ?? 0))}
          </p>
        ))}
    </>
  );
}
