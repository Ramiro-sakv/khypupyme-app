import type { components } from "../api/schema";
import type { Product } from "../commerce/models";
import { editableMoney, parseMoney } from "../commerce/models";
import { SelectField, TextField } from "../ui/Primitives";
import { quantityLabel } from "./measures";

type Schema = components["schemas"];
export type TileRequest = Schema["TileRequest"];
type Fields = { width: string; depth: string; height: string; boxArea: string; tone: string; caliber: string;
  bagKg: string; bulk: boolean; bulkPrice: string };

export function initialMaterials(product?: Product): Fields {
  const material = product?.specialty?.material;
  return { width: String(material?.furniture?.widthCm ?? ""), depth: String(material?.furniture?.depthCm ?? ""),
    height: String(material?.furniture?.heightCm ?? ""), boxArea: String(material?.tile?.boxArea ?? ""),
    tone: material?.tile?.tone ?? "", caliber: material?.tile?.caliber ?? "", bagKg: String(material?.cement?.bagKg ?? ""),
    bulk: !!material?.cement?.bulkProductId,
    bulkPrice: material?.cement?.bulkPriceMinor == null ? "" : editableMoney(material.cement.bulkPriceMinor) };
}

export function materialCommand(industry: string | undefined, kind: string, fields: Fields) {
  const price = fields.bulk ? parseMoney(fields.bulkPrice) : null;
  if (kind === "cement" && fields.bulk && price === null) throw new Error("Indica el precio de venta por kg.");
  const { width, depth, height } = fields;
  return {
    furnitureProduct: industry === "furniture" && (width || depth || height) ?
      { widthCm: Number(width), depthCm: Number(depth), heightCm: Number(height) } : undefined,
    tileProduct: kind === "ceramics" ? { boxArea: Number(fields.boxArea), tone: fields.tone, caliber: fields.caliber } : undefined,
    cementProduct: kind === "cement" ? { bagKg: Number(fields.bagKg), bulkPriceMinor: price } : undefined,
  };
}

export function MaterialFields({ industry, kind, fields, update, product }: {
  industry?: string; kind: string; fields: Fields; update: (value: Fields) => void; product?: Product;
}) {
  const configured = product?.specialty?.material;
  return <>
    {industry === "furniture" && <div className="store-fields">
      <TextField label="Ancho (cm)" type="number" min={0.001} max={100000} step={0.001} required={!!(fields.depth || fields.height)}
        value={fields.width} onChange={(event) => update({ ...fields, width: event.target.value })} />
      <TextField label="Fondo (cm)" type="number" min={0.001} max={100000} step={0.001} required={!!(fields.width || fields.height)}
        value={fields.depth} onChange={(event) => update({ ...fields, depth: event.target.value })} />
      <TextField label="Alto (cm)" type="number" min={0.001} max={100000} step={0.001} required={!!(fields.width || fields.depth)}
        value={fields.height} onChange={(event) => update({ ...fields, height: event.target.value })} />
    </div>}
    {kind === "ceramics" && <div className="store-fields">
      <TextField label="Cobertura por caja (m²)" type="number" min={0.001} max={100000} step={0.001} required
        disabled={!!configured?.tile} value={fields.boxArea} onChange={(event) => update({ ...fields, boxArea: event.target.value })} />
      <TextField label="Tono" value={fields.tone} maxLength={60} disabled={!!configured?.tile}
        onChange={(event) => update({ ...fields, tone: event.target.value })} />
      <TextField label="Calibre" value={fields.caliber} maxLength={60} disabled={!!configured?.tile}
        onChange={(event) => update({ ...fields, caliber: event.target.value })} />
    </div>}
    {kind === "cement" && <>
      <TextField label="Peso por bolsa (kg)" type="number" required min={0.001} max={100000} step={0.001} disabled={!!configured?.cement}
        value={fields.bagKg} onChange={(event) => update({ ...fields, bagKg: event.target.value })} />
      <label className="trade-check"><input type="checkbox" checked={fields.bulk} disabled={!!configured?.cement?.bulkProductId}
        onChange={(event) => update({ ...fields, bulk: event.target.checked })} />Habilitar venta a granel</label>
      {fields.bulk && <TextField label="Precio por kg a granel (Bs)" inputMode="decimal" required value={fields.bulkPrice}
        onChange={(event) => update({ ...fields, bulkPrice: event.target.value })} />}
    </>}
  </>;
}

function scaled(value: string) {
  const match = /^(\d{1,7})(?:[.,](\d{1,3}))?$/.exec(value.trim());
  return match ? BigInt(match[1]) * 1000n + BigInt((match[2] ?? "").padEnd(3, "0")) : null;
}

export function tilePreview(profile: Schema["TileProfile"], request: TileRequest, unit: string, boxSize: number) {
  if (!request.area?.trim()) return null;
  const area = scaled(request.area);
  const waste = scaled(request.waste?.trim() || "0");
  if (!area || area > 1_000_000_000n || waste === null || waste > 100_000n) return null;
  const required = area * (100_000n + waste);
  const denominator = BigInt(Math.round(profile.boxArea * 1000)) * 100_000n;
  if (!denominator) return null;
  const numerator = unit === "box" ? required : required * BigInt(boxSize);
  const quantity = Number((numerator + denominator - 1n) / denominator);
  return { quantity, required: Number(required) / 100_000_000 };
}

export function TileFields({ profile, request, unit, boxSize, pieces, disabled, update }: {
  profile: Schema["TileProfile"]; request: TileRequest; unit: string; boxSize: number; pieces: number;
  disabled: boolean; update: (request: TileRequest) => void;
}) {
  const estimate = tilePreview(profile, request, unit, boxSize);
  const coverage = pieces * profile.boxArea / boxSize;
  return <>
    <div className="store-fields">
      <TextField label="Área a cubrir (m²)" inputMode="decimal" value={request.area ?? ""} disabled={disabled}
        onChange={(event) => update({ ...request, area: event.target.value })} />
      <TextField label="Merma (%)" inputMode="decimal" value={request.waste ?? ""} disabled={disabled}
        onChange={(event) => update({ ...request, waste: event.target.value })} />
      {profile.tone && <SelectField label="Tono de la cerámica" value={request.tone ?? ""} disabled={disabled}
        onChange={(event) => update({ ...request, tone: event.target.value })}>
        <option value="">Elige el tono</option><option value={profile.tone}>{profile.tone}</option>
      </SelectField>}
      {profile.caliber && <SelectField label="Calibre de la cerámica" value={request.caliber ?? ""} disabled={disabled}
        onChange={(event) => update({ ...request, caliber: event.target.value })}>
        <option value="">Elige el calibre</option><option value={profile.caliber}>{profile.caliber}</option>
      </SelectField>}
    </div>
    {((profile.tone && !request.tone) || (profile.caliber && !request.caliber)) &&
      <p className="trade-issue">Elige el tono y el calibre que figuran en esta ficha para confirmar.</p>}
    {estimate ? <p>{estimate.quantity} {unit === "box" ? "cajas" : "piezas"} necesarias · {quantityLabel(estimate.required)} m² con merma</p> :
      (request.area?.trim() || request.waste?.trim()) && <p className="trade-issue">Revisa el área y la merma del 0 al 100 %.</p>}
    {pieces > 0 && <p>Cobertura entregada · {quantityLabel(coverage)} m²
      {estimate && " · " + quantityLabel(Math.max(0, coverage - estimate.required)) + " m² de excedente"}</p>}
  </>;
}
