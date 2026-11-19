import { useState } from "react";
import { useCommerce } from "../commerce/CommerceContext";
import { useCommercialForm } from "../commerce/CommerceUi";
import { measuredIndustry } from "../retail/ProductFields";
import { Alert, Button, Card, SelectField, TextField } from "../ui/Primitives";
import type { BusinessView } from "./BusinessWorkspace";
import { INDUSTRY_GUIDES } from "./industryGuides";
import type { IndustryId } from "./industryThemes";
import type { BusinessProfile } from "./models";

export function BusinessOperatingSettings({ profile, refresh, error }: {
  profile: BusinessProfile; refresh: () => Promise<void>; error: string;
}) {
  const { policy } = profile;
  const [payment, setPayment] = useState(policy.defaultPayment);
  const [discount, setDiscount] = useState(String(policy.maxDiscountPercent));
  const [quoteDays, setQuoteDays] = useState(String(policy.quoteDays));
  const [lotDays, setLotDays] = useState(String(policy.lotAlertDays));
  const [credit, setCredit] = useState(policy.allowNewCredit);
  const [checking, setChecking] = useState(false);
  const form = useCommercialForm();
  const { confirmation } = useCommerce();
  const lots = measuredIndustry(profile.industry);
  const changed = payment !== policy.defaultPayment || Number(discount) !== policy.maxDiscountPercent ||
    Number(quoteDays) !== policy.quoteDays || Number(lotDays) !== policy.lotAlertDays || credit !== policy.allowNewCredit;
  const blocked = form.blocked || checking;
  return <Card>
    <h2>Reglas de operación</h2>
    <p className="muted">Los cambios requieren confirmar tu identidad e indicar un motivo.</p>
    <form className="account-form" onSubmit={(event) => {
      event.preventDefault();
      if (blocked || !changed) return;
      void form.submit(() => ({
        kind: "configure-business",
        policy: { revision: policy.revision, defaultPayment: payment, maxDiscountPercent: Number(discount),
          quoteDays: Number(quoteDays), lotAlertDays: Number(lotDays), allowNewCredit: credit },
      }), () => undefined);
    }}>
      <SelectField label="Forma de pago inicial" value={payment} disabled={blocked}
        hint="Se propone al iniciar una compra o una venta." onChange={(event) => setPayment(event.target.value)}>
        <option value="cash">Efectivo</option><option value="qr">QR</option><option value="transfer">Transferencia</option>
      </SelectField>
      <TextField label="Descuento máximo (%)" type="number" required min={0} max={100} step={1} value={discount} disabled={blocked}
        hint="Se aplica a ventas y cotizaciones nuevas." onChange={(event) => setDiscount(event.target.value)} />
      <TextField label="Vigencia de nuevas cotizaciones (días)" type="number" required min={1} max={90} step={1}
        value={quoteDays} disabled={blocked} onChange={(event) => setQuoteDays(event.target.value)} />
      <SelectField label="Fiados nuevos" value={credit ? "enabled" : "disabled"} disabled={blocked}
        hint="Los saldos ya registrados se pueden seguir cobrando." onChange={(event) => setCredit(event.target.value === "enabled")}>
        <option value="enabled">Permitir</option><option value="disabled">Desactivar</option>
      </SelectField>
      {lots && <TextField label="Avisar vencimientos con anticipación (días)" type="number" required min={1} max={90} step={1}
        value={lotDays} disabled={blocked} hint="Plazo de los avisos en Inicio e Inventario." onChange={(event) => setLotDays(event.target.value)} />}
      {form.error && <Alert tone="error">{form.error}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      {!changed && !error && confirmation?.result.kind === "configure-business" && <Alert tone="success">Reglas guardadas.</Alert>}
      <div className="inline-actions">
        <Button type="submit" icon="check" disabled={blocked || !changed}>{form.processing ? "Guardando…" : "Revisar y guardar reglas"}</Button>
        <Button variant="secondary" disabled={form.processing || checking} onClick={() => {
          setChecking(true);
          void refresh().finally(() => setChecking(false));
        }}>{checking ? "Consultando…" : "Consultar reglas guardadas"}</Button>
      </div>
    </form>
  </Card>;
}

type IndustryShortcut = readonly [BusinessView, string, string?];
const industryShortcuts: Record<IndustryId, readonly IndustryShortcut[]> = {
  timber: [["catalogo", "Existencias por medida"], ["cotizaciones", "Cotizar por pies tablares"]],
  convenience: [["ventas", "Venta con lector", "scan"], ["catalogo", "Reposición", "reorder"]],
  grocery: [["compras", "Recibir presentaciones"], ["catalogo", "Revisar vencimientos", "expiring"]],
  beverages: [["envases", "Saldos de envases"], ["compras", "Recibir cajas y unidades"]],
  clothing: [["catalogo", "Modelos y variantes"], ["historial", "Buscar venta para cambio"]],
  footwear: [["catalogo", "Pares por talla y color"], ["historial", "Buscar venta para cambio"]],
  furniture: [["cotizaciones", "Cotizar muebles"], ["entregas", "Retiros y entregas"]],
  cosmetics: [["catalogo", "Lotes por vencer", "expiring"], ["catalogo", "Lotes apartados", "held"]],
  ceramics: [["cotizaciones", "Calcular cobertura"], ["catalogo", "Existencias por tono y calibre"]],
  cement: [["catalogo", "Bolsas, lotes y granel"], ["ventas", "Vender por bolsa o peso"]],
  hardware: [["catalogo", "Referencias y estantes"], ["compras", "Recibir piezas y rollos"]],
  appliances: [["series", "Series, garantía e inspección"], ["compras", "Recibir equipos"]],
  electronics: [["series", "Historial por serie"], ["ventas", "Vender accesorios y equipos"]],
  spareParts: [["catalogo", "Referencias y compatibilidad"], ["ventas", "Vender repuestos"]],
  stationery: [["catalogo", "Tarifas de impresión"], ["ventas", "Cobrar materiales e impresiones"]],
  pets: [["catalogo", "Lotes de alimento", "expiring"], ["ventas", "Vender alimento fraccionado"]],
  crafts: [["trabajos", "Encargos"], ["ventas", "Vender piezas terminadas"]],
  beauty: [["trabajos", "Agenda de citas"], ["ventas", "Atender sin cita"]],
  cleaning: [["trabajos", "Trabajos y materiales"], ["cotizaciones", "Preparar una cotización"]],
  professional: [["trabajos", "Entregables y fechas"], ["cotizaciones", "Preparar una cotización"]],
  repair: [["trabajos", "Recepción y taller"], ["catalogo", "Consultar repuestos"]],
};

export function IndustrySettings({ industry, navigate }: {
  industry: string; navigate: (view: BusinessView, focus?: string) => void;
}) {
  const id = industry as IndustryId;
  const guide = INDUSTRY_GUIDES[id];
  if (!guide) return null;
  return <Card>
    <h2>{guide.title}</h2>
    <ol className="industry-settings-steps">{guide.steps.map((step) => <li key={step}>{step}</li>)}</ol>
    <div className="inline-actions">
      {industryShortcuts[id].map(([view, label, focus]) =>
        <Button key={label} variant="secondary" onClick={() => navigate(view, focus)}>{label}</Button>)}
      <Button variant="plain" onClick={() => navigate("ayuda")}>Guía del rubro</Button>
    </div>
  </Card>;
}
