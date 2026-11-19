import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { change } from "../api/client";
import { Alert, Button, Card, DataTable, SelectField, TextField } from "../ui/Primitives";
import { businessApi } from "./models";
import type { BusinessProfile } from "./models";
import { BusinessProtection } from "../security/BusinessRemoval";
import { BusinessOperatingSettings, IndustrySettings } from "./BusinessOperatingSettings";
import type { BusinessView } from "./BusinessWorkspace";

export function BusinessSettings({ profile, industry, openPlan, onRemoved, accountControls, navigate, settingsError, refreshSettings }: {
  profile: BusinessProfile;
  industry: string;
  openPlan: () => void;
  onRemoved: (message: string) => void;
  accountControls: ReactNode;
  navigate: (view: BusinessView, focus?: string) => void;
  settingsError: string;
  refreshSettings: () => Promise<void>;
}) {
  const [city, setCity] = useState(profile.city ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [units, setUnits] = useState(profile.timberUnits ?? "imperial");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const settings = { city: city.trim(), phone: phone.trim(), timberUnits: profile.industry === "timber" ? units : null };
    try {
      await change(businessApi + "/" + profile.id + "/settings", "PUT", { businessId: profile.id, ...settings });
      await refreshSettings();
      setMessage("Configuración guardada.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo guardar la configuración.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="settings-view">
    <div className="view-heading"><h1 tabIndex={-1}>Configuración</h1><p>{profile.name}</p></div>
    <Button variant="secondary" onClick={openPlan}>Plan del negocio</Button>
    <div className="settings-grid">
      <Card>
        <DataTable caption="Identificación del negocio" columns={["Dato", "Valor"]} rows={[
          { id: "name", cells: ["Nombre", profile.name] },
          { id: "industry", cells: ["Rubro fijo", industry] },
          { id: "currency", cells: ["Moneda", "BOB · Bolivianos"] },
          { id: "timezone", cells: ["Zona horaria", "Bolivia"] },
        ]} />
      </Card>
      <Card>
        <h2>Preferencias</h2>
        <form className="account-form" onSubmit={(event) => void save(event)}>
          <TextField label="Ciudad" value={city} maxLength={80} onChange={(event) => setCity(event.target.value)} />
          <TextField label="Teléfono" type="tel" value={phone} maxLength={32} onChange={(event) => setPhone(event.target.value)} />
          {profile.industry === "timber" && <SelectField label="Medidas de madera" value={units}
            onChange={(event) => setUnits(event.target.value)}>
            <option value="imperial">Pulgadas y pies</option><option value="metric">Métrica</option>
          </SelectField>}
          {error && <Alert tone="error">{error}</Alert>}
          {message && <Alert tone="success">{message}</Alert>}
          <Button type="submit" icon="check" disabled={busy}>{busy ? "Guardando…" : "Guardar configuración"}</Button>
        </form>
      </Card>
    </div>
    <div className="settings-grid">
      {profile.policy ? <BusinessOperatingSettings key={profile.policy.revision} profile={profile} refresh={refreshSettings} error={settingsError} /> :
        <Card><h2>Reglas de operación</h2><Alert>Esta versión del servidor aún no admite estas preferencias.</Alert></Card>}
      <IndustrySettings industry={profile.industry} navigate={navigate} />
    </div>
    <Card>{accountControls}</Card>
    <BusinessProtection profile={profile} onRemoved={onRemoved} />
  </div>;
}
