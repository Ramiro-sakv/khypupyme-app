import { useRecords, useWorkspace } from "./context";
import { bob, cents, method, statusLabel, today } from "./format";
import { Icon } from "./Icon";
import { ActionForm, Field, MethodField, Pager } from "./ui";
interface Debt {
  id: string;
  customerName: string;
  amountMinor: number;
  status: string;
  description: string;
  origin: string;
}
export function Debts() {
  const { run, busy } = useWorkspace(),
    page = useRecords<Debt>("debts");
  return (
    <>
      <h2 data-tutorial="debts">Fiados y cobros completos</h2>
      <details className="card record-editor">
        <summary>
          <Icon name="plus" />
          Registrar una deuda anterior
        </summary>
        <ActionForm
          disabled={busy}
          label="Registrar deuda previa (no registra una venta)"
          onSave={(d) =>
            run({
              kind: "debt",
              input: {
                customerId: "",
                customerName: String(d.get("customer")),
                amountMinor: cents(d.get("amount")),
                description: String(d.get("description")),
                date: String(d.get("date")),
              },
            })
          }
        >
          <Field name="customer" label="Cliente" />
          <Field name="amount" label="Importe (BOB)" />
          <Field name="description" label="Concepto" />
          <Field name="date" label="Fecha" type="date" value={today()} />
        </ActionForm>
      </details>
      <Pager page={page} />
      <div className="records-grid">
        {page.items.map((d) => (
          <article key={d.id} className="card list-card">
            <h3>
              {d.customerName} · {bob(d.amountMinor)}
            </h3>
            <p>
              {d.description} ·{" "}
              <span className="badge" data-state={d.status}>
                {statusLabel(d.status)}
              </span>
            </p>
            {d.status === "pending" && (
              <>
                <details className="record-action">
                  <summary>Cobrar este fiado</summary>
                  <ActionForm
                    disabled={busy}
                    dataTutorial="collect-form"
                    label="Cobrar saldo completo"
                    onSave={(f) =>
                      run({
                        kind: "collect",
                        input: { id: d.id, method: method(f) },
                      })
                    }
                  >
                    <MethodField />
                  </ActionForm>
                </details>
                {d.origin === "manual" && (
                  <details className="correction-actions">
                    <summary>Corregir deuda anterior</summary>
                    <ActionForm
                      disabled={busy}
                      label="Anular deuda"
                      onSave={(f) =>
                        run({
                          kind: "cancel-debt",
                          input: { id: d.id, reason: String(f.get("reason")) },
                        })
                      }
                    >
                      <Field name="reason" label="Motivo" />
                    </ActionForm>
                  </details>
                )}
              </>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
