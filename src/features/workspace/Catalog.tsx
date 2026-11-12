import TimberSpeciesCatalog from "./TimberSpeciesCatalog";
import { useTimberTutorial } from "./tutorial/context";
import { displayQuantity as showQuantity } from "../../../shared/workspace/presentation";
import TimberAdjustment from "./TimberAdjustment";
import { dimensionDisplayFromMm as dimensionInputFromMm } from "../../../shared/workspace/timber-measures";
import {
  timberStockText,
  minimumText,
  minimumInput,
} from "../../../shared/workspace/timber-measures";
import { useState } from "react";
import { useSearchParams } from "react-router";
import ExpiringLots from "./ExpiringLots";
import FashionPicker from "./FashionPicker";
import { ITEM_MODELS, UNITS } from "../../../shared/workspace/catalog";
import { compare, div, ZERO } from "../../../shared/workspace/exact";
import type { Item, Unit } from "../../../shared/workspace/model";
import { useRecords, useWorkspace } from "./context";
import {
  averageCost,
  bob,
  cents,
  itemDetails,
  localDate,
  measuredText,
  q,
  serials,
  statusLabel,
} from "./format";
import { Icon } from "./Icon";
import { useWorkspaceNavigation } from "./navigation";
import IndustryHelp from "./IndustryHelp";
import ItemForm from "./ItemForm";
import { Panel } from "./Panel";
import { ActionForm, Field, Pager } from "./ui";
export default function Catalog() {
  const [params] = useSearchParams();
  const { go } = useWorkspaceNavigation();
  const attention = params.get("atencion");
  const { run, busy, business } = useWorkspace(),
    [newItem, setNewItem] = useState(false),
    [archived, setArchived] = useState(false),
    [search, setSearch] = useState(""),
    [selection, setSelected] = useState<Item | null>(null),
    reorder = business.industryId === "convenience" && attention === "reposicion",
    expiry = business.industryId === "convenience" && attention === "vencimientos",
    page = useRecords<Item>("items", {
      active: reorder || !archived,
      ...(reorder ? { reorder: true } : {}),
      ...(search.trim().length >= 2 ? { search: search.trim() } : {}),
    }, !expiry);
  const tutorial = useTimberTutorial();
  const speciesMode = business.industryId === "timber" && tutorial?.state.session?.version !== 1;
  const visible = page.items;
  const selected = page.items.find((i) => i.id === selection?.id) ?? selection;
  return (
    <>
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">PRODUCTOS, COSTOS Y EXISTENCIAS</span>
          <h2>Inventario</h2>
        </div>
        <button
          data-tutorial={speciesMode ? "new-service" : "new-item"}
          className="primary"
          onClick={() => setNewItem(true)}
        >
          <Icon name="plus" />
          {speciesMode ? "Nuevo servicio de corte" : "Nuevo producto o servicio"}
        </button>
      </div>
      <IndustryHelp mode="catalog" />
      {business.industryId === "convenience" && <div className="actions catalog-tools">
        <button aria-pressed={!reorder && !expiry} onClick={() => go("inventario", {})}>Catálogo</button>
        <button aria-pressed={reorder} onClick={() => go("inventario", { atencion: "reposicion" })}>Reposición</button>
        <button aria-pressed={expiry} onClick={() => go("inventario", { atencion: "vencimientos" })}>Vencimientos</button>
        {(reorder || expiry) && <button className="primary" onClick={() => go("compras")}>Registrar compra</button>}
      </div>}
      {expiry && <ExpiringLots />}
      {speciesMode && <><TimberSpeciesCatalog /><h3>Servicios y productos anteriores</h3><p>Las fichas anteriores conservan sus medidas y costos; no se consolidan automáticamente.</p></>}
      {newItem && (
        <Panel
          title="Nuevo producto o servicio"
          onClose={() => setNewItem(false)}
        >
          <ItemForm
            serviceOnly={speciesMode}
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
      <div className="catalog-toolbar" hidden={expiry}>
        <label>
          Buscar en todo el catálogo (desde 2 caracteres)
          <input
            value={search}
            maxLength={40}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        {!reorder && <label>
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          Mostrar archivados
        </label>}
      </div>
      {!expiry && <Pager page={page} />}
      {reorder && !page.loading && !page.error && !page.items.length && <p>No hay productos agotados o en su mínimo para esta búsqueda.</p>}
      {business.industryId === "clothing" && !archived && <FashionPicker items={page.items} pick={setSelected} />}
      <div className="table-scroll catalog-table" hidden={expiry}>
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
                      {itemDetails(item, business.timberSystem ?? "imperial") ||
                        ITEM_MODELS[item.kind].label}
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
                      ? (timberStockText(
                          item,
                          business.timberSystem ?? "imperial",
                        ) ?? measuredText(item, item.balance) ?? showQuantity(stock) + " " + UNITS[item.priceUnit])
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
                    <button
                      data-tutorial="open-item"
                      data-item-id={item.id}
                      onClick={() => setSelected(item)}
                    >
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
              <p>{itemDetails(item, business.timberSystem ?? "imperial")}</p>
              <strong>
                {bob(item.priceMinor)} / {UNITS[item.priceUnit]}
              </strong>
              {item.kind !== "service" && (
                <>
                  <p>
                    {timberStockText(
                      item,
                      business.timberSystem ?? "imperial",
                    ) ?? measuredText(item, item.balance) ??
                      showQuantity(balance) + " " + UNITS[item.priceUnit]}{" "}
                    disponibles{" "}
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
              <button
                data-tutorial="open-item"
                data-item-id={item.id}
                onClick={() => setSelected(item)}
              >
                Gestionar e historial
              </button>
            </article>
          );
        })}
      </div>
      {selected && (
        <Panel
          key={selected.id}
          dataTutorial="product-detail"
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
                  minimum: minimumInput(
                    selected,
                    String(d.get("minimum")),
                    business.timberSystem ?? "imperial",
                  ),
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
              label={
                "Mínimo en " +
                (["timber-volume", "timber-grouped"].includes(selected.kind)
                  ? business.timberSystem === "metric"
                    ? "m³"
                    : "pies tablares"
                  : selected.baseUnit)
              }
              value={minimumText(selected, business.timberSystem ?? "imperial")}
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
              {selected.kind === "timber-grouped" ? (
                <TimberAdjustment item={selected} />
              ) : (
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
                      <select name="unit" defaultValue={selected.priceUnit}>
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
              )}
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
  const { run, busy, business } = useWorkspace(),
    page = useRecords<{
      id: string;
      lengthMm?: string;
      widthMm?: string;
      pieces?: number;
      serial?: string;
      lot?: string;
      expiresOn?: string;
      status?: string;
      balance?: { n: string; d: string };
      costMinor?: number;
    }>(
      item.kind === "timber-grouped"
        ? "timberGroups"
        : item.kind === "appliance"
          ? "serials"
          : "lots",
      { itemId: item.id },
    );
  return (
    <>
      <h3>
        {item.kind === "timber-grouped"
          ? "Medidas disponibles"
          : item.kind === "appliance"
            ? "Unidades y series"
            : "Lotes"}
      </h3>
      <Pager page={page} />
      <ul>
        {page.items.map((row) => (
          <li key={row.id}>
            {row.lengthMm && row.widthMm
              ? dimensionInputFromMm(
                  row.lengthMm,
                  "lengthMm",
                  business.timberSystem ?? "imperial",
                ) +
                (business.timberSystem === "metric" ? " mm × " : "′ × ") +
                dimensionInputFromMm(
                  row.widthMm,
                  "widthMm",
                  business.timberSystem ?? "imperial",
                ) +
                (business.timberSystem === "metric" ? " mm · " : "″ · ") +
                row.pieces +
                " piezas"
              : (row.serial ?? row.lot ?? "Sin referencia")}{" "}
            ·{" "}
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
