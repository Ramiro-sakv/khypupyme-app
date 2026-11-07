import { useState } from "react";
import type { Item, Unit } from "../../../shared/workspace/model";
import {
  compare,
  div,
  showQuantity,
  ZERO,
} from "../../../shared/workspace/exact";
import { ITEM_MODELS, UNITS } from "../../../shared/workspace/catalog";
import { useRecords, useWorkspace } from "./context";
import { ActionForm, Field, Pager } from "./ui";
import { bob, cents, q, serials, averageCost } from "./format";
import ItemForm from "./ItemForm";
export default function Catalog() {
  const { run, busy } = useWorkspace(),
    page = useRecords<Item>("items"),
    [newItem, setNewItem] = useState(false),
    [archived, setArchived] = useState(false),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<Item | null>(null);
  return (
    <>
      <div className="workspace-heading">
        <h2>Catálogo e inventario</h2>
        <button onClick={() => setNewItem((v) => !v)}>
          Nuevo producto o servicio
        </button>
      </div>
      {newItem && (
        <section className="card">
          <ItemForm
            onSave={async (item) => {
              const result = await run({
                kind: "create-item",
                input: {
                  item,
                  opening: {
                    qty: ZERO,
                    unit: item.priceUnit,
                    unitCostMinor: 0,
                    lot: "",
                    expiresOn: "",
                    serials: [],
                  },
                },
              });
              if (result) setNewItem(false);
            }}
          />
        </section>
      )}
      <div className="actions">
        <label>
          Buscar en esta página
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label>
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          Mostrar archivados
        </label>
      </div>
      <Pager page={page} />
      <div className="workspace-grid">
        {page.items
          .filter(
            (i) =>
              i.active !== archived &&
              `${i.name} ${Object.values(i.fields).join(" ")}`
                .toLowerCase()
                .includes(search.toLowerCase()),
          )
          .map((item) => {
            const factor = item.units[item.priceUnit]!,
              balance = div(item.balance, factor),
              average =
                item.balance.n === "0"
                  ? null
                  : averageCost(item.valueMinor, item.balance, factor);
            return (
              <article className="card" key={item.id}>
                <small>{ITEM_MODELS[item.kind].label}</small>
                <h3>{item.name}</h3>
                <p>{Object.values(item.fields).filter(Boolean).join(" · ")}</p>
                <strong>
                  {bob(item.priceMinor)} / {UNITS[item.priceUnit]}
                </strong>
                {item.kind !== "service" && (
                  <>
                    <p>
                      {showQuantity(balance)} {UNITS[item.priceUnit]}{" "}
                      disponibles{" "}
                      {item.balance.n === "0"
                        ? "· Agotado"
                        : compare(item.balance, item.minimum) < 0
                          ? "· Stock bajo"
                          : ""}
                    </p>
                    <p>
                      Valor: {bob(item.valueMinor)} · Costo promedio por{" "}
                      {UNITS[item.priceUnit]}:{" "}
                      {average === null ? "—" : average}
                    </p>
                    {item.kind === "ceramic" && (
                      <p>
                        {String(
                          BigInt(item.balance.n) /
                            BigInt(item.fields.piecesPerBox!),
                        )}{" "}
                        cajas completas +{" "}
                        {String(
                          BigInt(item.balance.n) %
                            BigInt(item.fields.piecesPerBox!),
                        )}{" "}
                        piezas sueltas
                      </p>
                    )}
                  </>
                )}
                <button onClick={() => setSelected(item)}>
                  Gestionar e historial
                </button>
              </article>
            );
          })}
      </div>
      {selected && (
        <section className="card" key={selected.id}>
          <h2>{selected.name}</h2>
          <button onClick={() => setSelected(null)}>Cerrar detalle</button>
          <ActionForm
            disabled={busy}
            label="Guardar datos y estado"
            onSave={async (d) => {
              await run({
                kind: "edit-item",
                input: {
                  id: selected.id,
                  name: String(d.get("name")),
                  priceMinor: cents(d.get("price")),
                  serviceCostMinor:
                    selected.kind === "service" ? cents(d.get("cost")) : 0,
                  minimum: q(d.get("minimum")),
                  active: d.get("active") === "on",
                },
              });
              setSelected(null);
            }}
          >
            <Field name="name" label="Nombre" value={selected.name} />
            <Field
              name="price"
              label="Precio (BOB)"
              type="number"
              step="0.01"
              min="0.01"
              value={selected.priceMinor / 100}
            />
            <Field
              name="minimum"
              label={`Mínimo en ${selected.baseUnit}`}
              value={showQuantity(selected.minimum)}
            />
            {selected.kind === "service" && (
              <Field
                name="cost"
                label="Costo directo BOB"
                value={selected.serviceCostMinor / 100}
              />
            )}
            <label>
              <input
                type="checkbox"
                name="active"
                defaultChecked={selected.active}
              />
              Activo
            </label>
          </ActionForm>
          {selected.kind !== "service" && (
            <>
              <h3>Entrada o salida manual</h3>
              <ActionForm
                disabled={busy}
                onSave={(d) =>
                  run({
                    kind: "stock-adjust",
                    input: {
                      itemId: selected.id,
                      direction: String(d.get("direction")) as "in" | "out",
                      qty: q(d.get("qty")),
                      unit: String(d.get("unit")) as Unit,
                      unitCostMinor: cents(d.get("cost")),
                      reason: String(d.get("reason")),
                      lot: String(d.get("lot") ?? ""),
                      expiresOn: String(d.get("expires") ?? ""),
                      serials: serials(String(d.get("serials") ?? "")),
                    },
                  })
                }
              >
                <label>
                  Movimiento
                  <select name="direction">
                    <option value="in">Entrada con costo declarado</option>
                    <option value="out">Salida con pérdida de valor</option>
                  </select>
                </label>
                <Field name="qty" label="Cantidad" />
                <label>
                  Unidad
                  <select name="unit">
                    {Object.keys(selected.units).map((u) => (
                      <option key={u} value={u}>
                        {UNITS[u as Unit]}
                      </option>
                    ))}
                  </select>
                </label>
                <Field
                  name="cost"
                  label="Costo por unidad elegida (BOB, entradas)"
                  value="0"
                />
                <Field
                  name="reason"
                  label="Motivo obligatorio"
                  maxLength={200}
                />
                <Field name="lot" label="Lote" required={false} />
                <Field
                  name="expires"
                  label="Vencimiento"
                  type="date"
                  required={false}
                />
                {selected.kind === "appliance" && (
                  <label>
                    Números de serie recibidos o retirados
                    <textarea name="serials" />
                  </label>
                )}
              </ActionForm>
              <StockDetail item={selected} />
            </>
          )}
          <History item={selected} />
        </section>
      )}
    </>
  );
}
function StockDetail({ item }: { item: Item }) {
  const { run, busy } = useWorkspace(),
    page = useRecords<{
      id: string;
      serial?: string;
      lot?: string;
      expiresOn?: string;
      status?: string;
      balance?: { n: string; d: string };
      costMinor?: number;
    }>(item.kind === "appliance" ? "serials" : "lots", { itemId: item.id });
  return (
    <>
      <h3>{item.kind === "appliance" ? "Unidades y series" : "Lotes"}</h3>
      <Pager page={page} />
      <ul>
        {page.items.map((row) => (
          <li key={row.id}>
            {row.serial ?? row.lot ?? "Sin referencia"} ·{" "}
            {row.status ?? (row.balance ? showQuantity(row.balance) : "")}{" "}
            {row.expiresOn && `· vence ${row.expiresOn}`}{" "}
            {row.status === "inspection" && (
              <ActionForm
                disabled={busy}
                label="Liberar tras inspección"
                onSave={(d) =>
                  run({
                    kind: "release-serial",
                    input: {
                      serialId: row.id,
                      reason: String(d.get("reason")),
                    },
                  })
                }
              >
                <Field name="reason" label="Resultado de inspección" />
              </ActionForm>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
function History({ item }: { item: Item }) {
  const page = useRecords<{
    id: string;
    kind: string;
    delta: { n: string; d: string };
    reason: string;
    createdAt: string;
  }>("movementsV2", { itemId: item.id });
  return (
    <>
      <h3>Historial conservado</h3>
      <Pager page={page} />
      <ul>
        {page.items.map((m) => (
          <li key={m.id}>
            {m.createdAt.slice(0, 10)} · {m.kind} · {showQuantity(m.delta)}{" "}
            {item.baseUnit} · {m.reason}
          </li>
        ))}
      </ul>
    </>
  );
}
