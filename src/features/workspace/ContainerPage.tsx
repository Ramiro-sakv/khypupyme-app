import { useState } from "react";
import type {
  ContainerBalance,
  ContainerType,
} from "../../../shared/workspace/operations";
import { useRecords, useWorkspace } from "./context";
import { CustomerSelector } from "./CustomerSelector";
import { ActionForm, Field, Pager } from "./ui";
import { localDate } from "./format";
export default function ContainerPage() {
  const types = useRecords<ContainerType>("containerTypes"),
    balances = useRecords<ContainerBalance>("containerBalances"),
    moves = useRecords<{
      id: string;
      quantity: number;
      direction?: string;
      kind?: string;
      reason: string;
      customerName?: string;
      name?: string;
      createdAt: string;
    }>("containerMovements"),
    { busy, run } = useWorkspace(),
    [client, setClient] = useState({ id: "", name: "" });
  return (
    <>
      <h2>Envases retornables</h2>
      <p className="notice">
        Control físico de botellas y cajas propias. No cobra depósitos ni
        modifica el informe de ganancias.
      </p>
      <details>
        <summary>Registrar envases propios</summary>
        <ActionForm
          disabled={busy}
          label="Registrar existencia de envases"
          onSave={(d) =>
            run({
              kind: "container-type",
              input: {
                name: String(d.get("name")),
                unit: String(d.get("unit")) as "bottle" | "crate",
                quantity: Number(d.get("quantity")),
              },
            })
          }
        >
          <Field name="name" label="Nombre del envase" />
          <label>
            Tipo
            <select name="unit">
              <option value="bottle">Botellas</option>
              <option value="crate">Cajas retornables</option>
            </select>
          </label>
          <Field
            name="quantity"
            label="Cantidad propia inicial"
            type="number"
            min={1}
            max={1000000}
            step="1"
          />
        </ActionForm>
      </details>
      <h3>Disponibles</h3>
      <Pager page={types} />
      <div className="workflow-grid">
        {types.items.map((t) => (
          <article className="card" key={t.id}>
            <h3>{t.name}</h3>
            <strong>{t.available} disponibles</strong>
            <p>
              {t.owned} propios · {t.owned - t.available} prestados
            </p>
          </article>
        ))}
      </div>
      <ActionForm
        disabled={busy}
        label="Confirmar movimiento de envases"
        onSave={(d) =>
          run({
            kind: "container-move",
            input: {
              containerId: String(d.get("type")),
              customerId: client.id,
              direction: String(d.get("direction")) as "out" | "in",
              quantity: Number(d.get("quantity")),
              reason: String(d.get("reason")),
            },
          })
        }
      >
        <CustomerSelector
          required
          value={client.id}
          onChange={(id, name) => setClient({ id, name })}
        />
        <label>
          Envase de esta página
          <select name="type" required>
            <option value="">Seleccionar</option>
            {types.items.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Operación
          <select name="direction">
            <option value="out">Prestar al cliente</option>
            <option value="in">Recibir devolución</option>
          </select>
        </label>
        <Field
          name="quantity"
          label="Cantidad"
          type="number"
          min={1}
          max={1000000}
          step="1"
        />
        <Field name="reason" label="Motivo o referencia" maxLength={200} />
      </ActionForm>
      <h3>Pendientes por cliente</h3>
      <Pager page={balances} />
      {balances.items
        .filter((b) => b.quantity > 0)
        .map((b) => (
          <p className="card" key={b.id}>
            {b.customerName} · {b.name}: <strong>{b.quantity}</strong>
          </p>
        ))}
      <h3>Movimientos conservados</h3>
      <Pager page={moves} />
      {moves.items.map((m) => (
        <p className="card" key={m.id}>
          {localDate(m.createdAt, true)} ·{" "}
          {m.kind === "opening"
            ? "Alta"
            : m.direction === "out"
              ? "Préstamo"
              : "Devolución"}{" "}
          · {m.quantity} {m.name ?? "envases"} · {m.customerName} · {m.reason}
        </p>
      ))}
    </>
  );
}
