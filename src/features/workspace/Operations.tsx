import { useState } from "react";
import type {
  CashSession,
  Customer,
  SaleV2,
} from "../../../shared/workspace/model";
import { useRecords, useWorkspace } from "./context";
import { ActionForm, Field, MethodField, Pager } from "./ui";
import { bob, cents, method, today } from "./format";
export function Cash() {
  const { run, busy } = useWorkspace(),
    sessions = useRecords<CashSession>("cashSessions"),
    entries = useRecords<{
      id: string;
      sessionId: string;
      amountMinor: number;
      source: string;
      method: string;
      createdAt: string;
    }>("cashEntries");
  const open = sessions.items.find((s) => s.status === "open");
  return (
    <>
      <h2>Caja del negocio</h2>
      <p>
        Una sesión puede cruzar medianoche. Una caja cerrada conserva sus
        movimientos.
      </p>
      <Pager page={sessions} />
      {open ? (
        <section className="card">
          <h3>Caja abierta desde {open.openedAt}</h3>
          <strong>Efectivo esperado: {bob(open.balanceMinor)}</strong>
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
          <ActionForm
            disabled={busy}
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
            disabled={busy}
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
      <h3>Sesiones</h3>
      {sessions.items.map((s) => (
        <p key={s.id}>
          {s.openedAt} · {s.status === "open" ? "Abierta" : "Cerrada"} ·
          esperado {bob(s.balanceMinor)}{" "}
          {s.differenceMinor !== null
            ? `· diferencia ${bob(s.differenceMinor)}`
            : ""}
        </p>
      ))}
      <h3>Movimientos de caja y medios de pago</h3>
      <Pager page={entries} />
      {entries.items.map((e) => (
        <p key={e.id}>
          {e.createdAt} · {e.source} · {e.method} · {bob(e.amountMinor)}
        </p>
      ))}
    </>
  );
}
export function Customers() {
  const { run, busy } = useWorkspace(),
    page = useRecords<Customer>("customersV2"),
    [edit, setEdit] = useState<Customer | null>(null);
  return (
    <>
      <h2>Clientes</h2>
      <section className="card" key={edit?.id ?? "new"}>
        <ActionForm
          disabled={busy}
          label={edit ? "Guardar cliente" : "Crear cliente"}
          onSave={async (d) => {
            const result = await run({
              kind: "customer",
              input: {
                id: edit?.id ?? crypto.randomUUID(),
                name: String(d.get("name")),
                phone: String(d.get("phone") ?? ""),
                notes: String(d.get("notes") ?? ""),
                active: d.get("active") === "on",
              },
            });
            if (result) setEdit(null);
          }}
        >
          <Field name="name" label="Nombre" value={edit?.name ?? ""} />
          <Field
            name="phone"
            label="Teléfono"
            required={false}
            value={edit?.phone ?? ""}
          />
          <Field
            name="notes"
            label="Notas"
            required={false}
            value={edit?.notes ?? ""}
          />
          <label>
            <input
              type="checkbox"
              name="active"
              defaultChecked={edit?.active ?? true}
            />
            Activo
          </label>
        </ActionForm>
        {edit && (
          <button onClick={() => setEdit(null)}>Cancelar edición</button>
        )}
      </section>
      <Pager page={page} />
      {page.items.map((c) => (
        <article key={c.id} className="card">
          <h3>{c.name}</h3>
          <p>
            {c.phone} · {c.active ? "Activo" : "Archivado"}
          </p>
          <p>{c.notes}</p>
          <button onClick={() => setEdit(c)}>Editar / archivar</button>
        </article>
      ))}
    </>
  );
}
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
      <h2>Fiados y cobros completos</h2>
      <section className="card">
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
      </section>
      <Pager page={page} />
      {page.items.map((d) => (
        <article key={d.id} className="card">
          <h3>
            {d.customerName} · {bob(d.amountMinor)}
          </h3>
          <p>
            {d.description} · {d.status}
          </p>
          {d.status === "pending" && (
            <>
              <ActionForm
                disabled={busy}
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
              {d.origin === "manual" && (
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
              )}
            </>
          )}
        </article>
      ))}
    </>
  );
}
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
      <section className="card">
        <ActionForm
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
      </section>
      <Pager page={page} />
      {page.items.map((e) => (
        <article className="card" key={e.id}>
          <strong>
            {e.description} · {bob(e.amountMinor)}
          </strong>
          <p>
            {e.date} · {e.status}
          </p>
          {e.status === "active" && (
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
          )}
        </article>
      ))}
    </>
  );
}
export function Warranty() {
  const { run, busy } = useWorkspace(),
    sales = useRecords<SaleV2>("salesV2"),
    claims = useRecords<{
      id: string;
      saleId: string;
      serialId: string;
      description: string;
      status: string;
      resolution: string;
    }>("warrantyClaims"),
    [selected, setSelected] = useState("");
  const sale = sales.items.find((s) => s.id === selected);
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
                      {l.warrantyUntil || "sin garantía declarada"}
                    </option>
                  )),
                )}
            </select>
          </label>
          <Field name="description" label="Problema declarado" />
          <label>
            Estado
            <select name="status">
              <option value="received">Recibido</option>
              <option value="diagnosis">Diagnóstico</option>
              <option value="resolved">Resuelto</option>
            </select>
          </label>
          <Field
            name="resolution"
            label="Resolución (obligatoria al resolver)"
            required={false}
          />
          <p>
            Este seguimiento no modifica existencias. Usa una devolución o
            cambio para recibir o entregar equipos.
          </p>
        </ActionForm>
      </section>
      <Pager page={claims} />
      {claims.items.map((c) => (
        <p key={c.id}>
          {c.description} · {c.status} · {c.resolution}
        </p>
      ))}
    </>
  );
}
export function Preferences() {
  const { business, run, busy } = useWorkspace();
  return (
    <section className="card">
      <h2>Datos del negocio</h2>
      <p>El rubro es fijo. Para otra actividad crea otro negocio.</p>
      <ActionForm
        disabled={busy}
        label="Guardar datos para documentos nuevos"
        onSave={(d) =>
          run({
            kind: "preferences",
            input: {
              name: String(d.get("name")),
              address: String(d.get("address") ?? ""),
              phone: String(d.get("phone") ?? ""),
              documentFooter: String(d.get("footer") ?? ""),
            },
          })
        }
      >
        <Field name="name" label="Nombre" value={business.name} />
        <Field
          name="address"
          label="Dirección"
          value={business.answers.address}
          required={false}
        />
        <Field
          name="phone"
          label="Teléfono"
          value={business.answers.phone}
          required={false}
        />
        <Field
          name="footer"
          label="Condiciones"
          value={business.answers.documentFooter}
          required={false}
          maxLength={300}
        />
      </ActionForm>
    </section>
  );
}
