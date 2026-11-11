import { useState } from "react";
import type { EquipmentHistory } from "../../../shared/workspace/model";
import { useRecords, useWorkspace } from "./context";
import { localDate, statusLabel } from "./format";
import { ActionForm, Field, Pager } from "./ui";

export interface WarrantySelection {
  saleId: string;
  number: string;
  serialId: string;
  serial: string;
  warrantyUntil: string;
  claim?: EquipmentHistory["sales"][number]["claims"][number];
}

export default function EquipmentLookup({ inspection, onClaim }: {
  inspection: boolean;
  onClaim: (selection: WarrantySelection) => void;
}) {
  const { run, busy } = useWorkspace();
  const [serialNumber, setSerialNumber] = useState("");
  const [selected, setSelected] = useState("");
  const page = useRecords<{ id: string; serial: string; status: string }>("serials", {
    ...(serialNumber ? { serialNumber } : {}),
    ...(inspection && !serialNumber ? { status: "inspection" } : {}),
  }, !!serialNumber || inspection);
  const detail = useRecords<EquipmentHistory>("serialHistory", { id: selected }, !!selected);
  const unit = detail.items[0];

  return (
    <section className="card equipment-lookup">
      <h3>{inspection && !serialNumber ? "Equipos en inspección" : "Historial por número de serie"}</h3>
      <ActionForm protectDraft={false} label="Buscar serie" onSave={async (form) => {
        const serial = String(form.get("serial") ?? "").trim();
        if (!serial) throw new Error("Escribe la serie tal como aparece en el equipo.");
        if (serial === serialNumber) page.first();
        setSerialNumber(serial);
        setSelected("");
      }}>
        <Field name="serial" label="Número de serie exacto" maxLength={80} />
      </ActionForm>
      {serialNumber && <button type="button" onClick={() => { setSelected(""); setSerialNumber(""); }}>Limpiar búsqueda</button>}
      {(serialNumber || inspection) && <>
        <Pager page={page} />
        <ul className="record-list">{page.items.map((entry) => (
          <li key={entry.id}>
            <button type="button" aria-pressed={entry.id === selected} onClick={() => setSelected(entry.id)}>
              {entry.serial} · {statusLabel(entry.status)}
            </button>
          </li>
        ))}</ul>
      </>}
      {selected && detail.loading && <p role="status">Consultando el historial de la unidad…</p>}
      {selected && detail.error && <div className="notice notice-error" role="alert">{detail.error} <button onClick={detail.first}>Volver a consultar</button></div>}
      {selected && !detail.loading && !detail.error && !unit && <p>No se encontró el registro de esta unidad.</p>}
      {unit && <div className="equipment-history">
        <h4>{unit.itemName} · {unit.serial}</h4>
        <p><span className="badge">{statusLabel(unit.status)}</span></p>
        <p>{unit.purchase ? `Compra ${unit.purchase.number} · ${localDate(unit.purchase.date)}` : `Ingreso registrado el ${localDate(unit.receivedAt, true)}`}</p>
        {!unit.sales.length && <p>Todavía no hay ventas vinculadas a esta serie.</p>}
        {unit.sales.map((sale) => (
          <article className="card equipment-event" key={sale.id}>
            <h4>Venta {sale.number}</h4>
            <p>{localDate(sale.date)} · {sale.customerName || "Cliente ocasional"}</p>
            <p>{sale.warrantyUntil ? `Garantía declarada hasta ${localDate(sale.warrantyUntil)}` : "Sin garantía declarada"}</p>
            {sale.returned && <p>Unidad devuelta{sale.returns.map((record) => ` · ${record.number} (${localDate(record.date)})`).join("")}</p>}
            {sale.claims.map((claim) => (
              <p key={claim.id}><strong>{statusLabel(claim.status)}</strong> · {claim.description}{claim.resolution && ` · ${claim.resolution}`}</p>
            ))}
            <button type="button" disabled={busy} onClick={() => onClaim({
              saleId: sale.id, number: sale.number, serialId: unit.id, serial: unit.serial, warrantyUntil: sale.warrantyUntil,
              ...(sale.claims[0] ? { claim: sale.claims[0] } : {}),
            })}>
              {sale.claims.length ? "Actualizar garantía" : "Registrar seguimiento"}
            </button>
          </article>
        ))}
        {unit.status === "inspection" && <details>
          <summary>Confirmar que el equipo vuelve a estar disponible</summary>
          <ActionForm disabled={busy} label="Liberar de inspección" onSave={(form) => run({
            kind: "release-serial", input: { serialId: unit.id, reason: String(form.get("reason") ?? "") },
          })}>
            <Field name="reason" label="Motivo y resultado de la inspección" maxLength={200} />
          </ActionForm>
        </details>}
      </div>}
    </section>
  );
}
