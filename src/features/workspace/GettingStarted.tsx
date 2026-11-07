import { useState } from "react";
import { INDUSTRIES } from "../../../shared/business-industries";
import { useRecords, useWorkspace } from "./context";
import { Icon } from "./Icon";
import { useWorkspaceNavigation } from "./navigation";
export default function GettingStarted({
  cashOpen,
  cashLoading,
  cashError,
}: {
  cashOpen: boolean;
  cashLoading: boolean;
  cashError: string;
}) {
  const { business } = useWorkspace(),
    { go } = useWorkspaceNavigation(),
    [expanded, setExpanded] = useState(true),
    services = business.industryId
      ? INDUSTRIES[business.industryId].profile === "services"
      : false,
    items = useRecords<{ id: string }>("items"),
    sales = useRecords<{ id: string }>("salesV2"),
    purchases = useRecords<{ id: string }>("purchasesV2", {}, !services),
    oldItems = useRecords<{ stock: number }>("products", {}, business.legacy),
    oldSales = useRecords<{ id: string }>("sales", {}, business.legacy),
    oldPurchases = useRecords<{ id: string }>(
      "purchases",
      {},
      business.legacy && !services,
    );
  const steps = [
      {
        id: "inventario",
        label: "Registrar tu primer producto o servicio",
        done: items.items.length > 0,
        loading: items.loading,
        error: items.error,
        optional: false,
      },
      ...(!services
        ? [
            {
              id: "compras",
              label: "Registrar una compra con costo",
              done: purchases.items.length > 0 || oldPurchases.items.length > 0,
              loading: purchases.loading || oldPurchases.loading,
              error: purchases.error || oldPurchases.error,
              optional: false,
            },
          ]
        : []),
      {
        id: "caja",
        label: "Preparar la caja si usas efectivo",
        done: cashOpen,
        loading: cashLoading,
        error: cashError,
        optional: true,
      },
      {
        id: "ventas",
        label: "Registrar tu primera venta",
        done: sales.items.length > 0 || oldSales.items.length > 0,
        loading: sales.loading || oldSales.loading,
        error: sales.error || oldSales.error,
        optional: false,
      },
    ],
    required = steps.filter((s) => !s.optional),
    done = required.filter((s) => s.done && !s.error && !s.loading).length;
  return (
    <section className="card getting-started">
      <div className="section-heading">
        <div>
          <span className="eyebrow">TUS PRIMEROS PASOS</span>
          <h3>
            {done === required.length
              ? "Tu negocio ya tiene sus primeros registros"
              : "Empieza con una base ordenada"}
          </h3>
        </div>
        <button
          className="text-button"
          aria-expanded={expanded}
          aria-controls="setup-steps"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Ocultar guía" : "Ver guía"}
        </button>
      </div>
      <p className="muted">
        {done} de {required.length} pasos registrados. La caja es opcional para
        QR o transferencias.
      </p>
      <progress
        value={done}
        max={required.length}
        aria-label="Primeros pasos registrados"
      />
      {expanded && (
        <div id="setup-steps">
          <ol className="setup-steps">
            {steps.map((step) => (
              <li key={step.id}>
                <span
                  className={
                    "setup-dot " + (step.done && !step.error ? "done" : "")
                  }
                >
                  <Icon name={step.done && !step.error ? "check" : "arrow"} />
                </span>
                <div>
                  <strong>{step.label}</strong>
                  <small>
                    {step.loading
                      ? "Consultando…"
                      : step.error
                        ? "No se pudo consultar este paso"
                        : step.done
                          ? "Registrado"
                          : step.optional
                            ? "Opcional · requiere caja abierta al usar efectivo"
                            : "Todavía sin registros"}
                  </small>
                </div>
                <button onClick={() => go(step.id)}>
                  {step.done ? "Abrir" : "Continuar"}
                </button>
              </li>
            ))}
          </ol>
          {business.legacy && oldItems.items.some((item) => item.stock > 0) && (
            <p className="notice notice-warning">
              Hay existencias en el modelo anterior.{" "}
              <button onClick={() => go("anteriores")}>
                Revisar conversión
              </button>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
