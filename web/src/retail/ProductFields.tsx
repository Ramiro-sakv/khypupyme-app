import { SelectField, TextField } from "../ui/Primitives";
import type { Product } from "../commerce/models";
import { unitLabels } from "./measures";

type Fields = { kind: string; unit: string; box: string; reorder: string; tracked: boolean; model: string; size: string; color: string; warranty: string };
const kinds = { convenience: "Tienda por unidad, peso o volumen", clothing: "Variante por talla y color", appliances: "Equipo por número de serie" };

export function retailIndustry(industry?: string): industry is keyof typeof kinds {
  return industry === "convenience" || industry === "clothing" || industry === "appliances";
}

export function initialProductFields(industry?: string, product?: Product): Fields {
  const kind = product ? product.retail ? "convenience" : product.apparel ? "clothing" : product.equipment ? "appliances" : "simple" : industry ?? "simple";
  return { kind, unit: product?.retail?.unit ?? "piece", box: String(product?.retail?.boxSize ?? 1),
    reorder: String(product?.retail?.reorder ?? 0), tracked: product?.retail?.trackLots ?? false,
    model: product?.apparel?.model ?? "", size: product?.apparel?.size ?? "", color: product?.apparel?.color ?? "",
    warranty: String(product?.equipment?.warrantyMonths ?? 12) };
}

export function productFieldsCommand(fields: Fields) {
  return {
    retailProduct: fields.kind === "convenience" ? { unit: fields.unit, boxSize: fields.unit === "piece" ? Number(fields.box) : 1,
      trackLots: fields.tracked, reorder: Number(fields.reorder) } : undefined,
    apparelProduct: fields.kind === "clothing" ? { model: fields.model, size: fields.size, color: fields.color } : undefined,
    equipmentProduct: fields.kind === "appliances" ? { warrantyMonths: Number(fields.warranty) } : undefined,
  };
}

export function ProductFields({ industry, edits, fields, setFields }: {
  industry: keyof typeof kinds; edits: boolean; fields: Fields; setFields: (fields: Fields) => void;
}) {
  return <>
    {!edits && <SelectField label="Control de existencias" value={fields.kind} onChange={(event) => setFields({ ...fields, kind: event.target.value })}>
      <option value={industry}>{kinds[industry]}</option><option value="simple">Producto simple por piezas</option>
    </SelectField>}
    {fields.kind === "convenience" && <>
      <SelectField label="Unidad de la tarifa de venta" value={fields.unit} disabled={edits}
        onChange={(event) => setFields({ ...fields, unit: event.target.value })}>
        {["piece", "g", "kg", "lb", "ml", "l"].map((unit) => <option key={unit} value={unit}>{unitLabels[unit]}</option>)}
      </SelectField>
      {fields.unit === "piece" && <TextField label="Unidades por caja" type="number" required min={1} max={100_000} value={fields.box} disabled={edits}
        onChange={(event) => setFields({ ...fields, box: event.target.value })} />}
      <TextField label={"Mínimo de reposición (" + unitLabels[fields.unit] + ")"} type="number" min={0} step={fields.unit === "piece" ? 1 : 0.001}
        required value={fields.reorder} onChange={(event) => setFields({ ...fields, reorder: event.target.value })} />
      <label className="trade-check"><input type="checkbox" checked={fields.tracked} disabled={edits}
        onChange={(event) => setFields({ ...fields, tracked: event.target.checked })} />Controlar lotes y vencimientos</label>
    </>}
    {fields.kind === "clothing" && <div className="store-fields">
      <TextField label="Modelo" required maxLength={80} value={fields.model} disabled={edits}
        onChange={(event) => setFields({ ...fields, model: event.target.value })} />
      <TextField label="Talla" required maxLength={24} value={fields.size} disabled={edits}
        onChange={(event) => setFields({ ...fields, size: event.target.value })} />
      <TextField label="Color" required maxLength={40} value={fields.color} disabled={edits}
        onChange={(event) => setFields({ ...fields, color: event.target.value })} />
    </div>}
    {fields.kind === "appliances" && <TextField label="Garantía declarada (meses)" hint="Usa 0 cuando el equipo no tenga garantía."
      type="number" min={0} max={120} required value={fields.warranty}
      onChange={(event) => setFields({ ...fields, warranty: event.target.value })} />}
  </>;
}
