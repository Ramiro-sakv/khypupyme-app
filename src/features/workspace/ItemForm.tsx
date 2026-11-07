import { useState } from "react";
import type { ReactNode } from "react";
import {
  ITEM_MODELS,
  itemUnits,
  kindsFor,
  suggestedKind,
  UNITS,
} from "../../../shared/workspace/catalog";
import { itemDraft } from "../../../shared/workspace/validation";
import type {
  ItemDraft,
  ItemKind,
  Unit,
} from "../../../shared/workspace/model";
import { ZERO } from "../../../shared/workspace/exact";
import { useWorkspace } from "./context";
import { ActionForm, Field } from "./ui";
import { cents, q } from "./format";
export default function ItemForm({
  onSave,
  label = "Crear producto",
  initial,
  children,
}: {
  onSave: (item: ItemDraft, data: FormData) => Promise<unknown>;
  label?: string;
  initial?: ItemDraft;
  children?: ReactNode;
}) {
  const { business, busy } = useWorkspace(),
    [kind, setKind] = useState<ItemKind>(
      initial?.kind ??
        (business.industryId === "timber" &&
        business.answers.timberMode === "volume"
          ? "timber-volume"
          : suggestedKind(business.industryId!)),
    );
  const defaults = (next: ItemKind) =>
    Object.fromEntries(
      ITEM_MODELS[next].fields.map((f) => [
        f.key,
        ["packSize", "piecesPerBox"].includes(f.key)
          ? "1"
          : f.key === "warrantyMonths"
            ? "0"
            : f.key === "pair"
              ? business.industryId === "footwear"
                ? "par"
                : "pieza"
              : ["weighted", "perishable"].includes(f.key)
                ? "no"
                : "",
      ]),
    );
  const [fields, setFields] = useState<Record<string, string>>(
    initial?.fields ?? defaults(kind),
  );
  let units: Unit[];
  try {
    units = Object.keys(
      itemUnits({
        name: "",
        kind,
        fields,
        barcode: "",
        priceMinor: 1,
        priceUnit: "piece",
        minimum: ZERO,
        serviceCostMinor: 0,
      }).units,
    ) as Unit[];
  } catch {
    units =
      kind === "timber-piece"
        ? ["piece", "m3", "boardFoot"]
        : kind === "ceramic"
          ? ["piece", "box", "m2"]
          : ["piece"];
  }
  return (
    <ActionForm
      disabled={busy}
      label={label}
      onSave={async (d) => {
        const input = itemDraft({
          name: String(d.get("name")),
          kind,
          fields: Object.fromEntries(
            ITEM_MODELS[kind].fields.map((f) => [
              f.key,
              String(d.get(f.key) ?? ""),
            ]),
          ),
          barcode: String(d.get("barcode") ?? ""),
          priceMinor: cents(d.get("price")),
          priceUnit: String(d.get("priceUnit")),
          minimum: q(d.get("minimum")),
          serviceCostMinor:
            kind === "service" ? cents(d.get("serviceCost")) : 0,
        });
        return onSave(input, d);
      }}
    >
      <label>
        Ficha de producto
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as ItemKind);
            setFields(defaults(e.target.value as ItemKind));
          }}
        >
          {kindsFor(business).map((k) => (
            <option key={k} value={k}>
              {ITEM_MODELS[k].label}
            </option>
          ))}
        </select>
      </label>
      <Field
        name="name"
        label="Nombre"
        value={initial?.name ?? ""}
        maxLength={80}
      />
      {ITEM_MODELS[kind].fields.map((f) => (
        <label key={`${kind}-${f.key}`}>
          {f.label}
          <input
            name={f.key}
            type="text"
            inputMode={f.type === "number" ? "decimal" : "text"}
            value={
              fields[f.key] ??
              (["packSize", "piecesPerBox"].includes(f.key)
                ? "1"
                : f.key === "warrantyMonths"
                  ? "0"
                  : f.key === "pair"
                    ? business.industryId === "footwear"
                      ? "par"
                      : "pieza"
                    : ["weighted", "perishable"].includes(f.key)
                      ? "no"
                      : "")
            }
            required={f.required}
            maxLength={80}
            onChange={(e) =>
              setFields((old) => ({ ...old, [f.key]: e.target.value }))
            }
          />
        </label>
      ))}
      <Field
        name="barcode"
        label="Código propio o de barras (opcional)"
        value={initial?.barcode ?? ""}
        required={false}
        maxLength={40}
      />
      <div className="workspace-grid">
        <Field
          name="price"
          label="Precio de venta (BOB)"
          value={initial ? (initial.priceMinor / 100).toFixed(2) : ""}
          min="0.01"
          step="0.01"
          type="number"
        />
        <label>
          Precio por
          <select
            name="priceUnit"
            key={kind + units.join()}
            defaultValue={initial?.priceUnit ?? units[0]}
          >
            {units.map((u) => (
              <option key={u} value={u}>
                {UNITS[u]}
              </option>
            ))}
          </select>
        </label>
        <Field
          name="minimum"
          label={`Existencia mínima en ${ITEM_MODELS[kind].base}`}
          value="0"
        />
        <>
          {kind === "service" && (
            <Field
              name="serviceCost"
              label="Costo directo por servicio (BOB)"
              value="0"
              type="number"
              min="0"
              step="0.01"
            />
          )}
        </>
      </div>
      <p className="muted">
        Se crea sin existencias. Registra la compra o una entrada con costo y
        motivo. La ficha y las conversiones quedan fijas.
      </p>
      {children}
    </ActionForm>
  );
}
