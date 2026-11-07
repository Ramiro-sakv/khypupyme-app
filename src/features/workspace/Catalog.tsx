import { Icon } from "./Icon";
import { Panel } from "./Panel";
import { localDate, statusLabel, itemDetails } from "./format";
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
  const visible = page.items.filter(
    (i) =>
      i.active !== archived &&
      [i.name, ...Object.values(i.fields)]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">PRODUCTOS, COSTOS Y EXISTENCIAS</span>
          <h2>Inventario</h2>
        </div>
        <button className="primary" onClick={() => setNewItem(true)}>
          <Icon name="plus" />
          Nuevo producto o servicio
        </button>
      </div>
      {newItem && (
        <Panel
          title="Nuevo producto o servicio"
          onClose={() => setNewItem(false)}
        >
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
        </Panel>
      )}
      <div className="catalog-toolbar">
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
      <div className="table-scroll catalog-table">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Estado</th>
              <th className="numeric">Disponible</th>
              <th className="numeric">Precio</th>
              <th className="numeric">Valor / costo promedio</th>
              <th>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => {
              const factor = item.units[item.priceUnit]!,
                stock =
                  item.kind === "service" ? null : div(item.balance, factor),
                low =
                  item.balance.n === "0" ||
                  compare(item.balance, item.minimum) < 0;
              return (
                <tr key={item.id}>
                  <td>
                    <span className="row-name">{item.name}</span>
                    <small className="row-detail">
                      {itemDetails(item) || ITEM_MODELS[item.kind].label}
                    </small>
                    {item.barcode && <small>Código: {item.barcode}</small>}
                  </td>
                  <td>
                    <span
                      className="badge"
                      data-state={
                        !item.active
                          ? "neutral"
                          : item.kind === "service"
                            ? "neutral"
                            : low
                              ? "warning"
                              : "active"
                      }
                    >
                      {!item.active
                        ? "Archivado"
                        : item.kind === "service"
                          ? "Servicio"
                          : item.balance.n === "0"
                            ? "Agotado"
                            : low
                              ? "Stock bajo"
                              : "Disponible"}
                    </span>
                  </td>
                  <td className="numeric">
                    {stock
                      ? showQuantity(stock) + " " + UNITS[item.priceUnit]
                      : "—"}
                  </td>
                  <td className="numeric">
                    {bob(item.priceMinor)}
                    <small>por {UNITS[item.priceUnit]}</small>
                  </td>
                  <td className="numeric">
                    {item.kind === "service" ? "—" : bob(item.valueMinor)}
                    <small>
                      {item.kind === "service"
                        ? "Sin existencias"
                        : item.balance.n === "0"
                          ? "Sin stock"
                          : averageCost(item.valueMinor, item.balance, factor) +
                            " / " +
                            UNITS[item.priceUnit]}
                    </small>
                  </td>
                  <td>
                    <button onClick={() => setSelected(item)}>
                      Gestionar <Icon name="arrow" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!page.loading &&
        !page.error &&
        page.items.length > 0 &&
        !visible.length && (
          <div className="empty-state">
            <Icon name="search" />
            <strong>Sin coincidencias en esta página</strong>
            <p>Puedes cambiar de página o ajustar los filtros.</p>
            <button
              onClick={() => {
                setSearch("");
                setArchived(false);
              }}
            >
              Limpiar filtros
            </button>
          </div>
        )}
      <div className="catalog-cards">
        {visible.map((item) => {
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
              <p>{itemDetails(item)}</p>
              <strong>
                {bob(item.priceMinor)} / {UNITS[item.priceUnit]}
              </strong>
              {item.kind !== "service" && (
                <>
                  <p>
                    {showQuantity(balance)} {UNITS[item.priceUnit]} disponibles{" "}
                    {item.balance.n === "0"
                      ? "· Agotado"
                      : compare(item.balance, item.minimum) < 0
                        ? "· Stock bajo"
                        : ""}
                  </p>
                  <p>
                    Valor: {bob(item.valueMinor)} · Costo promedio por{" "}
                    {UNITS[item.priceUnit]}: {average === null ? "—" : average}
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
        <Panel
          key={selected.id}
          title={selected.name}
          onClose={() => setSelected(null)}
        >
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
              <details className="correction-actions">
                <summary>Entrada o salida manual con motivo</summary>
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
              </details>
              <StockDetail item={selected} />
            </>
          )}
          <History item={selected} />
        </Panel>
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
            {row.status
              ? statusLabel(row.status)
              : row.balance
                ? showQuantity(row.balance)
                : ""}{" "}
            {row.expiresOn && `· vence ${localDate(row.expiresOn)}`}{" "}
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
            {localDate(m.createdAt)} · {statusLabel(m.kind)} ·{" "}
            {showQuantity(m.delta)} {item.baseUnit} · {m.reason}
          </li>
        ))}
      </ul>
    </>
  );
}
