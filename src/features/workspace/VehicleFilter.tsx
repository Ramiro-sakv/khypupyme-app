import { useState } from "react";
import type { WorkspaceQuery } from "../../../shared/workspace/model";
type Vehicle = WorkspaceQuery["vehicle"];

export function VehicleFilter({ value, onChange }: { value: Vehicle; onChange: (vehicle: Vehicle) => void }) {
  const [make, setMake] = useState(""), [model, setModel] = useState(""), [year, setYear] = useState("");
  const valid = !!make.trim() && !!model.trim() && /^(19|20)\d{2}$/.test(year);
  return <details className="catalog-tools">
    <summary>Buscar por vehículo {value ? `· ${value.make} ${value.model} ${value.year}` : ""}</summary>
    <div className="workspace-grid">
      <label>Marca<input value={make} maxLength={80} onChange={(e) => setMake(e.target.value)} /></label>
      <label>Modelo<input value={model} maxLength={80} onChange={(e) => setModel(e.target.value)} /></label>
      <label>Año<input value={year} maxLength={4} inputMode="numeric" onChange={(e) => setYear(e.target.value)} /></label>
    </div>
    <button type="button" disabled={!valid} onClick={() => onChange({ make: make.trim(), model: model.trim(), year: Number(year) })}>Aplicar vehículo</button>
    {value && <button type="button" onClick={() => onChange(undefined)}>Quitar filtro</button>}
  </details>;
}
