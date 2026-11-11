import { useState } from "react";
import { useSearchParams } from "react-router";
import type { SaleV2 } from "../../../shared/workspace/model";
import { useRecords, useWorkspace } from "./context";
import { localDate, statusLabel } from "./format";
import { ActionForm, Field, Pager } from "./ui";
import EquipmentLookup from "./EquipmentLookup";
import type { WarrantySelection } from "./EquipmentLookup";
import { Panel } from "./Panel";
import { useWorkspaceNavigation } from "./navigation";
export function Warranty() {
  const { run, busy, business } = useWorkspace();
  const [params] = useSearchParams();
  const { go } = useWorkspaceNavigation();
  const appliances = business.industryId === "appliances";
  const [tracking, setTracking] = useState<WarrantySelection | null>(null);
  const
    sales = useRecords<SaleV2>("salesV2", {}, !appliances),
    claims = useRecords<{
      id: string;
      saleId: string;
      serialId: string;
      description: string;
      status: string;
      resolution: string;
    }>("warrantyClaims", {}, !appliances),
    [selected, setSelected] = useState("");
  const sale = sales.items.find((s) => s.id === selected);
  if (appliances) {
    const inspection = params.get("atencion") === "inspeccion";
    return <>
      <h2>Equipos y garantías</h2>
      <div className="actions">
        <button aria-pressed={!inspection} onClick={() => go("garantias", {})}>Buscar por serie</button>
        <button aria-pressed={inspection} onClick={() => go("garantias", { atencion: "inspeccion" })}>Equipos en inspección</button>
      </div>
      <EquipmentLookup key={String(inspection)} inspection={inspection} onClaim={setTracking} />
      {tracking && <Panel title={`${tracking.number} · ${tracking.serial}`} onClose={() => setTracking(null)}>
        <p>{tracking.warrantyUntil ? `Garantía declarada hasta ${localDate(tracking.warrantyUntil)}` : "Sin garantía declarada"}</p>
        <ActionForm disabled={busy} label="Guardar seguimiento" onSave={async (form) => {
          const result = await run({ kind: "warranty", input: {
            saleId: tracking.saleId, serialId: tracking.serialId,
            description: String(form.get("description") ?? ""),
            status: String(form.get("status")) as "received" | "diagnosis" | "resolved",
            resolution: String(form.get("resolution") ?? ""),
          } });
          if (result) setTracking(null);
        }}>
          <WarrantyFields selection={tracking} />
        </ActionForm>
      </Panel>}
    </>;
  }
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
          <WarrantyFields />
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

function WarrantyFields({ selection }: { selection?: WarrantySelection }) {
  const claim = selection?.claim;
  return <>
    <Field name="description" label="Problema declarado" value={claim?.description ?? ""} />
    <label>Estado
      <select name="status" defaultValue={claim?.status ?? "received"}>
        <option value="received">Recibido</option>
        <option value="diagnosis">Diagnóstico</option>
        <option value="resolved">Resuelto</option>
      </select>
    </label>
    <Field name="resolution" label="Resolución (obligatoria al resolver)" value={claim?.resolution ?? ""} required={false} />
  </>;
}
