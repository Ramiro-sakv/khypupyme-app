import {
  dimensionLabel,
  dimensionToMm,
  dimensionInputFromMm,
  minimumInput,
} from "../../../shared/workspace/timber-measures";
import { EMPTY_DETAILS } from "../../../shared/workspace/operations";
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
  const system = business.timberSystem ?? "imperial",
    dimensionKeys = ["lengthMm", "widthMm", "thicknessMm"];
  const [rawDimensions, setRawDimensions] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        dimensionKeys.map((key) => [
          key,
          initial?.fields[key]
            ? dimensionInputFromMm(initial.fields[key]!, key, system)
            : "",
        ]),
      ),
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
      dataTutorial="item-form"
      label={label}
      onSave={async (d) => {
        const input = itemDraft({
          name: String(d.get("name")),
          details: Object.fromEntries(
            Object.keys(EMPTY_DETAILS).map((key) => [
              key,
              String(d.get("detail-" + key) ?? ""),
            ]),
          ),
          kind,
          fields: Object.fromEntries(
            ITEM_MODELS[kind].fields.map((f) => [
              f.key,
              kind === "timber-piece" && dimensionKeys.includes(f.key)
                ? initial?.fields[f.key] &&
                  String(d.get(f.key)) ===
                    dimensionInputFromMm(initial.fields[f.key]!, f.key, system)
                  ? initial.fields[f.key]
                  : dimensionToMm(String(d.get(f.key)), f.key, system)
                : String(d.get(f.key) ?? ""),
            ]),
          ),
          barcode: String(d.get("barcode") ?? ""),
          priceMinor: cents(d.get("price")),
          priceUnit: String(d.get("priceUnit")),
          minimum:
            kind === "timber-volume"
              ? minimumInput(
                  { kind, minimum: { n: "0", d: "1" } },
                  String(d.get("minimum")),
                  system,
                )
              : q(d.get("minimum")),
          serviceCostMinor:
            kind === "service" ? cents(d.get("serviceCost")) : 0,
        });
        return onSave(input, d);
      }}
    >
      <label>
        Ficha de producto
        <select
          name="item-kind"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as ItemKind);
            setFields(defaults(e.target.value as ItemKind));
            setRawDimensions({});
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
      <details>
        <summary>Marca, ubicación y datos del rubro</summary>
        {Object.keys(EMPTY_DETAILS).map((key) => (
          <Field
            key={key}
            name={"detail-" + key}
            label={
              (
                {
                  brand: "Marca adicional",
                  location: "Ubicación / estante",
                  description: "Medidas o presentación descriptiva",
                  equivalents: "Referencias equivalentes",
                  compatibility: "Compatibilidad: marca, modelo y años",
                } as Record<string, string>
              )[key]!
            }
            value={initial?.details?.[key as keyof typeof EMPTY_DETAILS] ?? ""}
            required={false}
            maxLength={key === "brand" || key === "location" ? 80 : 200}
          />
        ))}
      </details>
      {ITEM_MODELS[kind].fields.map((f) => (
        <label key={`${kind}-${f.key}`}>
          {kind === "timber-piece" && dimensionKeys.includes(f.key)
            ? dimensionLabel(f.key, system)
            : f.label}
          <input
            name={f.key}
            type="text"
            inputMode={
              kind === "timber-piece" && system === "imperial"
                ? "text"
                : f.type === "number"
                  ? "decimal"
                  : "text"
            }
            value={
              (kind === "timber-piece" && dimensionKeys.includes(f.key)
                ? rawDimensions[f.key]
                : fields[f.key]) ??
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
            onChange={(e) => {
              const value = e.target.value;
              if (kind === "timber-piece" && dimensionKeys.includes(f.key)) {
                setRawDimensions((old) => ({ ...old, [f.key]: value }));
                let mm = "";
                try {
                  mm = dimensionToMm(value, f.key, system);
                } catch {
                  /* El guardado vuelve a validar la entrada original. */
                }
                setFields((old) => ({ ...old, [f.key]: mm }));
              } else setFields((old) => ({ ...old, [f.key]: value }));
            }}
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
            defaultValue={
              initial?.priceUnit ??
              (["timber-piece", "timber-volume"].includes(kind)
                ? system === "imperial"
                  ? "boardFoot"
                  : "m3"
                : units[0])
            }
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
          label={
            "Existencia mínima en " +
            (kind === "timber-volume"
              ? system === "imperial"
                ? "pies tablares"
                : "m³"
              : ITEM_MODELS[kind].base)
          }
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
