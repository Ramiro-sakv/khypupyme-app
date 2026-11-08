import { useRecords } from "./context";
import { Pager } from "./ui";
import { bob, localDate, statusLabel } from "./format";
import { CORRECTION_LABELS } from "../../../shared/workspace/protection";
interface Change { collection: string; id: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null }
interface Audit { id: string; kind: string; reason: string; createdAt: string; changes: Change[] }
const labels: Record<string, string> = { name: "Nombre", species: "Especie", code: "Código", countedMinor: "Efectivo contado", differenceMinor: "Diferencia declarada", reference: "Referencia", active: "Estado", status: "Estado", amountMinor: "Importe", totalMinor: "Total", balanceMinor: "Saldo de caja", priceMinor: "Precio", valueMinor: "Valor de inventario", pieces: "Piezas", stock: "Existencias" };
function value(key: string, data: unknown) {
  if (data === undefined) return "—";
  if (key.endsWith("Minor")) return bob(Number(data));
  if (typeof data === "boolean") return data ? "Activo" : "Archivado";
  return key === "status" ? statusLabel(String(data)) : String(data);
}
export default function AuditHistory({ itemId }: { itemId?: string }) {
  const page = useRecords<Audit>("auditEvents", itemId ? { itemId } : {});
  return <section>
    <h3>Historial de correcciones del propietario</h3>
    <p>Se conservan los motivos y los registros originales. Este historial no permite borrar operaciones.</p>
    <Pager page={page} />
    {page.items.map((event) => <article className="card" key={event.id}>
      <strong>{CORRECTION_LABELS[event.kind] ?? "Corrección de un registro anterior"}</strong>
      <p>{localDate(event.createdAt, true)} · Propietario</p>
      <p>Motivo: {event.reason}</p>
      <details>
        <summary>Consultar cambios conservados</summary>
        {event.changes.map((change) => <div key={change.collection + change.id}>
          <h4>{String(change.after?.name ?? change.before?.name ?? change.after?.number ?? change.before?.number ?? change.after?.customerName ?? change.before?.customerName ?? change.after?.description ?? change.before?.description ?? "Registro relacionado")}</h4>
          <dl>{Object.keys(labels).filter((key) => JSON.stringify(change.before?.[key]) !== JSON.stringify(change.after?.[key])).map((key) => <div key={key}>
            <dt>{labels[key]}</dt>
            <dd>{value(key, change.before?.[key])} → {value(key, change.after?.[key])}</dd>
          </div>)}</dl>
          {!!(change.before?.prices || change.after?.prices) && <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Tarifa por pie tablar</th>
                  <th>Antes</th>
                  <th>Después</th>
                </tr>
              </thead>
              <tbody>{Object.entries({ superShort: "Supercorta", short: "Corta", long: "Larga" }).map(([key, label]) => {
                const before = (change.before?.prices as Record<string, number> | undefined)?.[key], after = (change.after?.prices as Record<string, number> | undefined)?.[key];
                return <tr key={key}>
                  <td>{label}</td>
                  <td>{before === undefined ? "—" : bob(before)}</td>
                  <td>{after === undefined ? "—" : bob(after)}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>}
          {!!(change.before?.lines || change.after?.lines) && <p>Las cantidades y los reintegros por línea están vinculados a la operación original y conservados en este registro.</p>}
        </div>)}
      </details>
    </article>)}
  </section>;
}
