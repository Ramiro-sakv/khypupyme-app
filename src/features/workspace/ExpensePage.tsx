import { useRecords, useWorkspace } from "./context";
import { bob, cents, localDate, method, statusLabel, today } from "./format";
import { Icon } from "./Icon";
import { ActionForm, Field, MethodField, Pager } from "./ui";
export function Expenses() {
  const { run, busy } = useWorkspace(),
    page = useRecords<{
      id: string;
      description: string;
      date: string;
      amountMinor: number;
      status: string;
    }>("expensesV2");
  return (
    <>
      <h2>Gastos operativos</h2>
      <p>Las compras de inventario se registran en Compras.</p>
      <details className="card record-editor">
        <summary>
          <Icon name="plus" />
          Registrar gasto
        </summary>
        <ActionForm
          dataTutorial="expense-form"
          disabled={busy}
          label="Registrar gasto y pago"
          onSave={(d) =>
            run({
              kind: "expense",
              input: {
                amountMinor: cents(d.get("amount")),
                method: method(d),
                description: String(d.get("description")),
                category: String(d.get("category")),
                date: String(d.get("date")),
              },
            })
          }
        >
          <Field name="description" label="Concepto" />
          <Field name="category" label="Categoría" />
          <Field name="amount" label="Importe (BOB)" />
          <Field name="date" label="Fecha" type="date" value={today()} />
          <MethodField />
        </ActionForm>
      </details>
      <Pager page={page} />
      <div className="records-grid">
        {page.items.map((e) => (
          <article className="card list-card" key={e.id}>
            <strong>
              {e.description} · {bob(e.amountMinor)}
            </strong>
            <p>
              {localDate(e.date)} ·{" "}
              <span className="badge" data-state={e.status}>
                {statusLabel(e.status)}
              </span>
            </p>
            {e.status === "active" && (
              <details className="correction-actions">
                <summary>Anular este gasto</summary>
                <ActionForm
                  disabled={busy}
                  label="Anular gasto con evidencia"
                  onSave={(d) =>
                    run({
                      kind: "cancel-expense",
                      input: { id: e.id, reason: String(d.get("reason")) },
                    })
                  }
                >
                  <Field name="reason" label="Motivo" />
                </ActionForm>
              </details>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
