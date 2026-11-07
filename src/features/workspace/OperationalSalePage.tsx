import { useSearchParams } from "react-router";
import type {
  Appointment,
  WorkOrder,
} from "../../../shared/workspace/operations";
import { useRecords } from "./context";
import { Pager } from "./ui";
import Trade from "./Trade";
export default function OperationalSalePage() {
  const [params] = useSearchParams(),
    kind = params.get("tipo") === "appointment" ? "appointment" : "work-order",
    id = params.get("origen") ?? "",
    page = useRecords<Appointment | WorkOrder>(
      kind === "appointment" ? "appointments" : "workOrders",
      { id },
      !!id,
    ),
    source = page.items[0];
  if (!id)
    return (
      <p role="alert">Selecciona una atención u orden desde su listado.</p>
    );
  if (!source) return <Pager page={page} />;
  if (source.saleId)
    return (
      <p className="notice">
        Este trabajo ya tiene una venta confirmada. Consulta Ventas o
        Documentos.
      </p>
    );
  if (!["attended", "ready", "delivered"].includes(source.status))
    return (
      <p role="alert">
        Completa la atención o deja el trabajo listo antes de preparar su venta.
      </p>
    );
  return (
    <>
      <div className="notice">
        Venta vinculada a <strong>{source.title}</strong> ·{" "}
        {source.customerName}. Selecciona los servicios y productos realmente
        entregados; el presupuesto no se cobra automáticamente.
      </div>
      <Trade
        key={source.id}
        origin={{ kind, id: source.id, revision: source.revision }}
        initialClient={{ id: source.customerId, name: source.customerName }}
      />
    </>
  );
}
