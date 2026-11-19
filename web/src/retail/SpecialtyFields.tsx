import { useState } from "react";
import type { components } from "../api/schema";
import { Button, DataTable, SelectField, TextField } from "../ui/Primitives";
import type { Product } from "../commerce/models";
import { specialtyText } from "./specialty";

type Schema = components["schemas"];
type Fitment = Schema["VehicleFitment"];
export type SpecialtyForm = {
  reference: string; measure: string; shelf: string; brand: string; model: string;
  equivalents: string; compatibility: Fitment[]; paperSize: string; color: string;
};
export type VehicleFilter = { vehicleBrand: string; vehicleModel: string; year: string };
export const emptyVehicle: VehicleFilter = { vehicleBrand: "", vehicleModel: "", year: "" };

export function initialSpecialty(product?: Product): SpecialtyForm {
  const detail = product?.specialty?.detail;
  const parts = product?.specialty?.parts;
  return { reference: detail?.reference ?? "", measure: detail?.measure ?? "", shelf: detail?.shelf ?? "",
    brand: detail?.brand ?? "", model: detail?.model ?? "", equivalents: parts?.equivalents.join("\n") ?? "",
    compatibility: parts?.compatibility ?? [], paperSize: product?.specialty?.printing?.paperSize ?? "A4",
    color: product?.specialty?.printing?.color ?? "bw" };
}

export function specialtyCommand(industry: string | undefined, printing: boolean, fields: SpecialtyForm) {
  const detail = ["hardware", "electronics", "spareParts"].includes(industry ?? "");
  return {
    detailProduct: detail ? { reference: fields.reference, measure: fields.measure, shelf: fields.shelf, brand: fields.brand, model: fields.model } : undefined,
    partsProduct: industry === "spareParts" ? { equivalents: fields.equivalents.split(/[\n;]+/).map((row) => row.trim()).filter(Boolean),
      compatibility: fields.compatibility } : undefined,
    printingProduct: printing ? { paperSize: fields.paperSize, color: fields.color } : undefined,
  };
}

export function SpecialtyFields({ industry, printing, edits, fields, update }: {
  industry?: string; printing: boolean; edits: boolean; fields: SpecialtyForm; update: (value: SpecialtyForm) => void;
}) {
  function fitment(index: number, value: Partial<Fitment>) {
    update({ ...fields, compatibility: fields.compatibility.map((row, position) => position === index ? { ...row, ...value } : row) });
  }
  return <>
    {["hardware", "electronics", "spareParts"].includes(industry ?? "") && <div className="store-fields">
      <TextField label="Referencia del fabricante" maxLength={80} value={fields.reference} onChange={(event) => update({ ...fields, reference: event.target.value })} />
      {industry !== "electronics" && <TextField label="Medida o especificación" maxLength={80} value={fields.measure}
        onChange={(event) => update({ ...fields, measure: event.target.value })} />}
      {industry === "hardware" && <TextField label="Estante o ubicación" maxLength={60} value={fields.shelf}
        onChange={(event) => update({ ...fields, shelf: event.target.value })} />}
      {industry === "electronics" && <>
        <TextField label="Marca del equipo o accesorio" maxLength={80} value={fields.brand} onChange={(event) => update({ ...fields, brand: event.target.value })} />
        <TextField label="Modelo del equipo o accesorio" maxLength={80} value={fields.model} onChange={(event) => update({ ...fields, model: event.target.value })} />
      </>}
    </div>}
    {industry === "spareParts" && <>
      <label className="timber-widths"><span>Referencias equivalentes</span>
        <textarea rows={3} value={fields.equivalents} onChange={(event) => update({ ...fields, equivalents: event.target.value })}
          placeholder="Una referencia por línea" />
      </label>
      <h3>Compatibilidad declarada por el negocio</h3>
      {fields.compatibility.map((row, index) => <div className="fitment-row" key={index}>
        <div className="store-fields">
          <TextField label="Marca del vehículo" required maxLength={80} value={row.brand}
            onChange={(event) => fitment(index, { brand: event.target.value })} />
          <TextField label="Modelo del vehículo" required maxLength={80} value={row.model}
            onChange={(event) => fitment(index, { model: event.target.value })} />
          <TextField label="Desde el año" type="number" min={1900} max={2200} required value={row.fromYear}
            onChange={(event) => fitment(index, { fromYear: Number(event.target.value) })} />
          <TextField label="Hasta el año" type="number" min={row.fromYear} max={2200} required value={row.toYear}
            onChange={(event) => fitment(index, { toYear: Number(event.target.value) })} />
        </div>
        <label className="trade-check"><input type="checkbox" checked={row.confirmed} onChange={(event) => fitment(index, { confirmed: event.target.checked })} />
          Compatibilidad confirmada por el negocio</label>
        <Button variant="plain" onClick={() => update({ ...fields, compatibility: fields.compatibility.filter((_, position) => position !== index) })}>Quitar compatibilidad</Button>
      </div>)}
      <Button variant="secondary" disabled={fields.compatibility.length >= 30} onClick={() => update({ ...fields,
        compatibility: [...fields.compatibility, { brand: "", model: "", fromYear: 2000, toYear: 2026, confirmed: false }] })}>Añadir compatibilidad</Button>
      {fields.compatibility.length === 0 && <p>Compatibilidad por confirmar.</p>}
    </>}
    {printing && <>
      <SelectField label="Color de impresión" value={fields.color} disabled={edits} onChange={(event) => update({ ...fields, color: event.target.value })}>
        <option value="bw">Blanco y negro</option><option value="color">Color</option>
      </SelectField>
      <TextField label="Tamaño de papel" required maxLength={40} value={fields.paperSize} disabled={edits}
        onChange={(event) => update({ ...fields, paperSize: event.target.value })} />
    </>}
  </>;
}

export function CompatibilityFilter({ onChange }: { onChange: (value: VehicleFilter) => void }) {
  const [form, setForm] = useState(emptyVehicle);
  return <form className="compatibility-filter" onSubmit={(event) => { event.preventDefault(); onChange(form); }}>
    <div className="store-fields">
      <TextField label="Filtrar marca de vehículo" maxLength={80} value={form.vehicleBrand} onChange={(event) => setForm({ ...form, vehicleBrand: event.target.value })} />
      <TextField label="Filtrar modelo de vehículo" maxLength={80} value={form.vehicleModel} onChange={(event) => setForm({ ...form, vehicleModel: event.target.value })} />
      <TextField label="Año del vehículo" type="number" min={1900} max={2200} value={form.year} onChange={(event) => setForm({ ...form, year: event.target.value })} />
    </div>
    <div className="inline-actions"><Button type="submit" variant="secondary">Filtrar compatibilidad</Button>
      <Button variant="plain" onClick={() => { setForm(emptyVehicle); onChange(emptyVehicle); }}>Quitar filtro</Button></div>
  </form>;
}

export function vehicleQuery(filter: VehicleFilter) {
  return Object.fromEntries(Object.entries(filter).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value !== ""));
}

export function searchLabel(industry?: string) {
  switch (industry) {
    case "clothing": case "footwear": return "Buscar por modelo o código";
    case "hardware": return "Buscar por código, medida o referencia";
    case "spareParts": return "Buscar por referencia original o equivalente";
    case "electronics": return "Buscar por marca, modelo o código";
    case "cosmetics": return "Buscar por producto, marca, presentación o tono";
    default: return "Buscar por nombre, especie o código";
  }
}

export function SpecialtySummary({ product }: { product: Product }) {
  const parts = product.specialty?.parts;
  return <>
    <small className="record-secondary">{specialtyText(product.specialty)}</small>
    {parts && parts.compatibility.length > 0 && <details className="compatibility-details"><summary>Compatibilidad declarada</summary>
      <DataTable caption={"Vehículos de " + product.code} columns={["Marca", "Modelo", "Años", "Estado"]}
        rows={parts.compatibility.map((row, index) => ({ id: String(index), cells: [row.brand, row.model, row.fromYear + "–" + row.toYear,
          row.confirmed ? "Confirmada por el negocio" : "Por confirmar"] }))} />
    </details>}
  </>;
}
