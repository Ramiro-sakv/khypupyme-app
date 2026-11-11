import { INDUSTRIES } from "../../../shared/business-industries";
import type { SetupProgress } from "../../../shared/workspace/model";
import { useCashState } from "./cash-context";
import { useRecords, useWorkspace } from "./context";
import { Icon } from "./Icon";
import { useWorkspaceNavigation } from "./navigation";
export default function GettingStarted({ compact = false }: { compact?: boolean }) {
  const cash = useCashState();
  const { business } = useWorkspace(),
    { go } = useWorkspaceNavigation(),
    services = business.industryId
      ? INDUSTRIES[business.industryId].profile === "services"
      : false,
    page = useRecords<SetupProgress>("setupProgress");
  const progress = page.items[0];
  const steps = [
      {
        id: "caja",
        label: "Abrir caja si vas a usar efectivo",
        done: !!cash.open,
        loading: cash.loading,
        error: cash.error,
        optional: true,
      },
      {
        id: "inventario",
        label: "Registrar tu primer producto o servicio",
        done: !!progress?.catalog,
        loading: page.loading,
        error: page.error,
        optional: false,
      },
      ...(!services
        ? [
            {
              id: "compras",
              label: "Registrar una compra con costo",
              done: !!progress?.purchase,
              loading: page.loading,
              error: page.error,
              optional: false,
            },
          ]
        : []),
      {
        id: "ventas",
        label: "Registrar tu primera venta",
        done: !!progress?.sale,
        loading: page.loading,
        error: page.error,
        optional: false,
      },
    ],
    required = steps.filter((s) => !s.optional),
    done = required.filter((s) => s.done && !s.error && !s.loading).length;
  if (compact) {
    if (done === required.length || required.some((s) => s.loading || s.error)) return null;
    return (
      <section className="card day-guide">
        <div><h3>Primeros pasos</h3><p className="muted">{done} de {required.length} registrados</p></div>
        <button onClick={() => go("guia")}>Abrir guía</button>
      </section>
    );
  }
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
        <div>
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
          {progress?.legacyStock && (
            <p className="notice notice-warning">
              Hay existencias en el modelo anterior.{" "}
              <button onClick={() => go("anteriores")}>
                Revisar conversión
              </button>
            </p>
          )}
        </div>
    </section>
  );
}
