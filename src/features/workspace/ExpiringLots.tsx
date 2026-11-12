import { displayQuantity } from "../../../shared/workspace/presentation";
import type { Quantity } from "../../../shared/workspace/exact";
import { useRecords } from "./context";
import { localDate, today } from "./format";
import { Pager } from "./ui";

export default function ExpiringLots() {
  const date = today();
  const until = new Date(Date.parse(date + "T12:00:00Z") + 30 * 86400000).toISOString().slice(0, 10);
  const page = useRecords<{ id: string; itemName: string; lot: string; expiresOn: string; balance: Quantity; held?: boolean; baseUnit?: string }>("lots", { expiresBefore: until });
  return (
    <section className="card">
      <h3>Lotes vencidos y por vencer hasta {localDate(until)}</h3>
      <Pager page={page} />
      {!page.loading && !page.error && !page.items.length && <p>No hay lotes con existencias para este periodo.</p>}
      <ul className="record-list">{page.items.map((lot) => (
        <li key={lot.id}>
          <strong>{lot.itemName}</strong> · Lote {lot.lot} · {localDate(lot.expiresOn)} · {displayQuantity(lot.balance)} {lot.baseUnit ?? "unidades"}
          {lot.held && <span className="badge">Apartado</span>}
          {lot.expiresOn < date && <span className="badge">Vencido · fuera de venta</span>}
        </li>
      ))}</ul>
    </section>
  );
}
