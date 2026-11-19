import { SelectField, TextField } from "../ui/Primitives";
import type { Product } from "../commerce/models";
import { unitLabels } from "./measures";

type Fields = { kind: string; unit: string; box: string; reorder: string; tracked: boolean; model: string; size: string; color: string;
  warranty: string; brand: string; presentation: string; tone: string; roll: string; afterOpeningMonths: string };
const kinds = { convenience: "Tienda por unidad, peso o volumen", grocery: "Abarrotes por presentación o medida",
  beverages: "Bebidas por caja y sueltos", cosmetics: "Cosmético con lotes", pets: "Producto envasado o fraccionado",
  clothing: "Variante por talla y color", footwear: "Par por talla y color",
  appliances: "Equipo por número de serie", electronics: "Equipo por número de serie", hardware: "Piezas, cajas o metros",
  stationery: "Servicio de impresión", ceramics: "Cerámica por cajas y piezas", cement: "Cemento por bolsas y lote" };

export const variantIndustry = (industry?: string) => industry === "clothing" || industry === "footwear";
export const equipmentIndustry = (industry?: string) => industry === "appliances" || industry === "electronics";

export function measuredIndustry(industry?: string) {
  return industry === "convenience" || industry === "grocery" || industry === "beverages" || industry === "cosmetics" ||
    industry === "pets" || industry === "hardware" || industry === "ceramics" || industry === "cement";
}

export function retailIndustry(industry?: string): industry is keyof typeof kinds {
  return measuredIndustry(industry) || variantIndustry(industry) || equipmentIndustry(industry) || industry === "stationery";
}

export function initialProductFields(industry?: string, product?: Product): Fields {
  const kind = product ? product.retail ? industry ?? "convenience" : product.apparel ? industry ?? "clothing" :
    product.equipment ? industry ?? "appliances" : product.specialty?.printing ? "stationery" : "simple" : industry ?? "simple";
  return { kind, unit: product?.retail?.unit ?? "piece", box: String(product?.retail?.boxSize ?? (industry === "ceramics" ? 6 : 1)),
    reorder: String(product?.retail?.reorder ?? 0), tracked: product?.retail?.trackLots ?? (industry === "cosmetics" || industry === "cement"),
    model: product?.apparel?.model ?? "", size: product?.apparel?.size ?? "", color: product?.apparel?.color ?? "",
    warranty: String(product?.equipment?.warrantyMonths ?? 12), brand: product?.cosmetic?.brand ?? "",
    presentation: product?.cosmetic?.presentation ?? "", tone: product?.cosmetic?.tone ?? "", roll: String(product?.retail?.rollLength ?? 50),
    afterOpeningMonths: product?.cosmetic?.afterOpeningMonths?.toString() ?? "" };
}

export function productFieldsCommand(fields: Fields) {
  return {
    retailProduct: measuredIndustry(fields.kind) ? { unit: fields.unit, boxSize: fields.unit === "piece" ? Number(fields.box) : 1,
      trackLots: fields.tracked || needsLots(fields), reorder: Number(fields.reorder),
      rollLength: fields.unit === "m" ? Number(fields.roll) : undefined } : undefined,
    cosmeticProduct: fields.kind === "cosmetics" ? { brand: fields.brand, presentation: fields.presentation, tone: fields.tone,
      afterOpeningMonths: Number(fields.afterOpeningMonths) } : undefined,
    apparelProduct: variantIndustry(fields.kind) ? { model: fields.model, size: fields.size, color: fields.color } : undefined,
    equipmentProduct: equipmentIndustry(fields.kind) ? { warrantyMonths: Number(fields.warranty) } : undefined,
  };
}

export function ProductFields({ industry, edits, fields, setFields }: {
  industry: keyof typeof kinds; edits: boolean; fields: Fields; setFields: (fields: Fields) => void;
}) {
  return <>
    {!edits && <SelectField label="Control de existencias" value={fields.kind} onChange={(event) => setFields({ ...fields, kind: event.target.value })}>
      <option value={industry}>{kinds[industry]}</option><option value="simple">{industry === "electronics" ? "Accesorio por cantidad" : "Producto simple por piezas"}</option>
    </SelectField>}
    {measuredIndustry(fields.kind) && <>
      <SelectField label="Unidad de la tarifa de venta" value={fields.unit} disabled={edits}
        onChange={(event) => setFields({ ...fields, unit: event.target.value })}>
        {(fields.kind === "hardware" ? ["piece", "m"] : fields.kind === "ceramics" || fields.kind === "cement" ? ["piece"] : ["piece", "g", "kg", "lb", "ml", "l"])
          .map((unit) => <option key={unit} value={unit}>{fields.kind === "cement" ? "bolsa" : unitLabels[unit]}</option>)}
      </SelectField>
      {fields.unit === "m" && <TextField label="Metros por rollo" type="number" required min={0.001} max={100_000} step={0.001}
        disabled={edits} value={fields.roll} onChange={(event) => setFields({ ...fields, roll: event.target.value })} />}
      {fields.unit === "piece" && fields.kind !== "cement" && <TextField label={fields.kind === "ceramics" ? "Piezas por caja" : "Unidades por caja"}
        type="number" required min={fields.kind === "ceramics" ? 2 : 1} max={100_000} value={fields.box} disabled={edits}
        onChange={(event) => setFields({ ...fields, box: event.target.value })} />}
      <TextField label={"Mínimo de reposición (" + unitLabels[fields.unit] + ")"} type="number" min={0} step={fields.unit === "piece" ? 1 : 0.001}
        required value={fields.reorder} onChange={(event) => setFields({ ...fields, reorder: event.target.value })} />
      <label className="trade-check"><input type="checkbox" checked={fields.tracked || needsLots(fields)} disabled={edits || needsLots(fields)}
        onChange={(event) => setFields({ ...fields, tracked: event.target.checked })} />Controlar lotes y vencimientos</label>
      {needsLots(fields) && <small>Los lotes identifican el origen de cada salida de este producto.</small>}
    </>}
    {fields.kind === "cosmetics" && <div className="store-fields">
      <TextField label="Marca" required maxLength={80} value={fields.brand} onChange={(event) => setFields({ ...fields, brand: event.target.value })} />
      <TextField label="Presentación" required maxLength={80} value={fields.presentation} onChange={(event) => setFields({ ...fields, presentation: event.target.value })} />
      <TextField label="Tono (opcional)" maxLength={60} value={fields.tone} onChange={(event) => setFields({ ...fields, tone: event.target.value })} />
      <TextField label="Duración tras apertura (meses)" hint="Usa el número indicado en el envase. El vencimiento se registra por lote."
        type="number" min={1} max={120} value={fields.afterOpeningMonths}
        onChange={(event) => setFields({ ...fields, afterOpeningMonths: event.target.value })} />
    </div>}
    {variantIndustry(fields.kind) && <div className="store-fields">
      <TextField label="Modelo" required maxLength={80} value={fields.model} disabled={edits}
        onChange={(event) => setFields({ ...fields, model: event.target.value })} />
      <TextField label="Talla" required maxLength={24} value={fields.size} disabled={edits}
        onChange={(event) => setFields({ ...fields, size: event.target.value })} />
      <TextField label="Color" required maxLength={40} value={fields.color} disabled={edits}
        onChange={(event) => setFields({ ...fields, color: event.target.value })} />
    </div>}
    {equipmentIndustry(fields.kind) && <TextField label="Garantía declarada (meses)" hint="Usa 0 cuando el equipo no tenga garantía."
      type="number" min={0} max={120} required value={fields.warranty}
      onChange={(event) => setFields({ ...fields, warranty: event.target.value })} />}
  </>;
}

function needsLots(fields: Fields) {
  return fields.kind === "cosmetics" || fields.kind === "cement" || fields.kind === "pets" && ["g", "kg", "lb"].includes(fields.unit);
}
