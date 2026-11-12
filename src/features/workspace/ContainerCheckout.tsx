import type { ContainerBalance, ContainerTransfer, ContainerType } from "../../../shared/workspace/operations";
import { useRecords } from "./context";
import { Pager } from "./ui";

export default function ContainerCheckout({ customerId, value, change }: {
  customerId: string;
  value: ContainerTransfer[];
  change: (entries: ContainerTransfer[]) => void;
}) {
  const types = useRecords<ContainerType>("containerTypes", {}, !!customerId);
  const balances = useRecords<ContainerBalance>("containerBalances", customerId ? { customerId } : {}, !!customerId);
  function set(containerId: string, key: "delivered" | "received", quantity: number) {
    const old = value.find((entry) => entry.containerId === containerId) ?? { containerId, delivered: 0, received: 0 };
    const current = { ...old, [key]: quantity };
    const rest = value.filter((entry) => entry.containerId !== containerId);
    change(current.delivered || current.received ? [...rest, current] : rest);
  }
  return <details>
    <summary>Envases retornables {value.length ? `· ${value.length} tipos` : ""}</summary>
    {!customerId ? <p>Selecciona un cliente registrado para intercambiar envases.</p> : <>
      <Pager page={types} />
      <Pager page={balances} />
      {types.items.map((type) => {
        const current = value.find((entry) => entry.containerId === type.id);
        const pending = balances.items.find((row) => row.containerId === type.id)?.quantity;
        return <section className="card" key={type.id}>
          <h4>{type.name}</h4>
          <p>{type.available} disponibles · {pending === undefined ? "Consulta el saldo del cliente en Envases" : `${pending} pendientes del cliente`}</p>
          <div className="workspace-grid">
            <label>Recibidos<input type="number" min={0} step={1} max={1000000} value={current?.received ?? 0} onChange={(e) => set(type.id, "received", e.target.valueAsNumber || 0)} /></label>
            <label>Entregados<input type="number" min={0} step={1} max={1000000} value={current?.delivered ?? 0} onChange={(e) => set(type.id, "delivered", e.target.valueAsNumber || 0)} /></label>
          </div>
          {current && pending !== undefined && <p>Saldo previsto · {pending - current.received + current.delivered}</p>}
        </section>;
      })}
    </>}
  </details>;
}
