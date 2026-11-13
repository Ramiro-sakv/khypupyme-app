import type { CashSession } from "../../../shared/workspace/model";
import { useRecords, useWorkspace } from "./context";
import { bob, cents, localDate, statusLabel } from "./format";
import { ActionForm, Field, Pager } from "./ui";
import { useCashState } from "./cash-context";
export function Cash() {
  const { run, busy, readOnly } = useWorkspace(),
    currentSession = useCashState(),
    sessions = useRecords<CashSession>("cashSessions"),
    entries = useRecords<{
      id: string;
      sessionId: string;
      amountMinor: number;
      source: string;
      method: string;
      createdAt: string;
    }>("cashEntries");
  const open = currentSession.open;
  return (
    <>
      <h2>Caja del negocio</h2>
      <p>
        Una sesión puede cruzar medianoche. Una caja cerrada conserva sus
        movimientos.
      </p>
      <div data-tutorial="cash-form">
        {currentSession.loading ? (
          <p className="loading-state" role="status">
            Consultando la caja actual…
          </p>
        ) : currentSession.error ? (
          <div role="alert" className="notice notice-error">
            {currentSession.error}
            <button type="button" onClick={currentSession.refresh}>Volver a consultar caja</button>
          </div>
        ) : open ? (
          <section className="card cash-current">
            <span className="badge">Caja abierta</span>
            <h3>Caja abierta desde {localDate(open.openedAt, true)}</h3>
            <strong>Efectivo esperado: {bob(open.balanceMinor)}</strong>
            <details className="correction-actions" data-tutorial="cash-close-form">
              <summary>Cerrar y conciliar esta caja</summary>
              <ActionForm
                disabled={busy}
                label="Cerrar caja y emitir comprobante"
                onSave={(d) =>
                  run({
                    kind: "close-cash",
                    input: {
                      countedMinor: cents(d.get("counted")),
                      reason: String(d.get("reason") ?? ""),
                    },
                  })
                }
              >
                <Field name="counted" label="Efectivo contado (BOB)" />
                <Field
                  name="reason"
                  label="Motivo de diferencia (obligatorio si hay diferencia)"
                  required={false}
                />
              </ActionForm>
            </details>
            <ActionForm
              disabled={busy || !!readOnly}
              label="Registrar aporte o retiro"
              onSave={(d) =>
                run({
                  kind: "cash-adjust",
                  input: {
                    direction: String(d.get("direction")) as "in" | "out",
                    amountMinor: cents(d.get("amount")),
                    reason: String(d.get("reason")),
                  },
                })
              }
            >
              <label>
                Tipo
                <select name="direction">
                  <option value="in">Aporte</option>
                  <option value="out">Retiro</option>
                </select>
              </label>
              <Field name="amount" label="Importe (BOB)" />
              <Field name="reason" label="Motivo" />
            </ActionForm>
          </section>
        ) : (
          <section className="card">
            <ActionForm
              disabled={busy || !!readOnly}
              label="Abrir caja"
              onSave={(d) =>
                run({
                  kind: "open-cash",
                  input: { amountMinor: cents(d.get("amount")) },
                })
              }
            >
              <Field
                name="amount"
                label="Fondo inicial en efectivo (BOB)"
                value="0"
              />
            </ActionForm>
          </section>
        )}
      </div>
      <h3>Sesiones anteriores y actuales</h3>
      <Pager page={sessions} />
      {sessions.items.map((s) => (
        <p key={s.id}>
          {localDate(s.openedAt, true)} ·{" "}
          {s.status === "open" ? "Abierta" : "Cerrada"} · esperado{" "}
          {bob(s.balanceMinor)}{" "}
          {s.differenceMinor !== null
            ? `· diferencia ${bob(s.differenceMinor)}`
            : ""}
        </p>
      ))}
      <h3>Movimientos de caja y medios de pago</h3>
      <Pager page={entries} />
      {entries.items.map((e) => (
        <p key={e.id}>
          {localDate(e.createdAt, true)} · {statusLabel(e.source)} ·{" "}
          {statusLabel(e.method)} · {bob(e.amountMinor)}
        </p>
      ))}
    </>
  );
}
