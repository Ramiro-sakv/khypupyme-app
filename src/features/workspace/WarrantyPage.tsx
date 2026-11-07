import { useState } from "react";
import type { SaleV2 } from "../../../shared/workspace/model";
import { useRecords, useWorkspace } from "./context";
import { localDate, statusLabel } from "./format";
import { ActionForm, Field, Pager } from "./ui";
export function Warranty() {
  const { run, busy } = useWorkspace(),
    sales = useRecords<SaleV2>("salesV2"),
    claims = useRecords<{
      id: string;
      saleId: string;
      serialId: string;
      description: string;
      status: string;
      resolution: string;
    }>("warrantyClaims"),
    [selected, setSelected] = useState("");
  const sale = sales.items.find((s) => s.id === selected);
  return (
    <>
      <h2>Garantías comerciales</h2>
      <Pager page={sales} />
      <section className="card">
        <ActionForm
          disabled={busy}
          label="Registrar seguimiento"
          onSave={(d) =>
            run({
              kind: "warranty",
              input: {
                saleId: selected,
                serialId: String(d.get("serial")),
                description: String(d.get("description")),
                status: String(d.get("status")) as
                  | "received"
                  | "diagnosis"
                  | "resolved",
                resolution: String(d.get("resolution") ?? ""),
              },
            })
          }
        >
          <label>
            Venta
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              required
            >
              <option value="">Seleccionar</option>
              {sales.items
                .filter((s) => s.lines.some((l) => l.kind === "appliance"))
                .map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.number} · {s.customerName}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Serie
            <select name="serial" required key={selected}>
              {sale?.lines
                .filter((l) => l.kind === "appliance")
                .flatMap((l) =>
                  l.allocations.map((a) => (
                    <option key={a.stockId} value={a.stockId}>
                      {a.serial} · garantía hasta{" "}
                      {l.warrantyUntil
                        ? localDate(l.warrantyUntil)
                        : "sin garantía declarada"}
                    </option>
                  )),
                )}
            </select>
          </label>
          <Field name="description" label="Problema declarado" />
          <label>
            Estado
            <select name="status">
              <option value="received">Recibido</option>
              <option value="diagnosis">Diagnóstico</option>
              <option value="resolved">Resuelto</option>
            </select>
          </label>
          <Field
            name="resolution"
            label="Resolución (obligatoria al resolver)"
            required={false}
          />
          <p>
            Este seguimiento no modifica existencias. Usa una devolución o
            cambio para recibir o entregar equipos.
          </p>
        </ActionForm>
      </section>
      <Pager page={claims} />
      {claims.items.map((c) => (
        <p key={c.id}>
          {c.description} · {statusLabel(c.status)} · {c.resolution}
        </p>
      ))}
    </>
  );
}
