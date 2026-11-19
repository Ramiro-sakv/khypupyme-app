import { useState } from "react";
import { Icon } from "../ui/Icon";
import { Alert, Button, Card, TextField } from "../ui/Primitives";
import { faceUnit, lengthUnit, timberVolume, volumeUnit, dimension } from "../timber/measures";
import type { TimberUnits } from "../timber/measures";
import { tilePreview } from "../retail/MaterialFields";
import { INDUSTRY_GUIDES } from "./industryGuides";
import type { IndustryId } from "./industryThemes";
import type { BusinessView } from "./BusinessWorkspace";

type Navigate = (view: BusinessView, focus?: string) => void;
const stockFlow: BusinessView[] = ["catalogo", "compras", "ventas", "catalogo"];
const flows: Partial<Record<IndustryId, BusinessView[]>> = {
  timber: ["catalogo", "compras", "cotizaciones", "ventas"],
  beverages: ["compras", "envases", "ventas", "envases"],
  clothing: ["catalogo", "compras", "ventas", "historial"],
  footwear: ["catalogo", "compras", "ventas", "historial"],
  furniture: ["catalogo", "cotizaciones", "ventas", "entregas"],
  appliances: ["catalogo", "compras", "ventas", "series"],
  electronics: ["catalogo", "compras", "ventas", "series"],
  ceramics: ["catalogo", "cotizaciones", "ventas", "catalogo"],
  cement: ["catalogo", "compras", "catalogo", "ventas"],
};
const serviceFlow: BusinessView[] = ["catalogo", "trabajos", "trabajos", "trabajos"];
const services = new Set(["beauty", "cleaning", "professional", "repair", "crafts"]);

export function BusinessHelp({ industry, units, navigate, readOnly }: {
  industry: string; units: TimberUnits; navigate: Navigate; readOnly: boolean;
}) {
  const guide = INDUSTRY_GUIDES[industry as IndustryId];
  const steps = flows[industry as IndustryId] ?? (services.has(industry) ? serviceFlow : stockFlow);
  if (!guide) return null;
  return <div className="commerce-stack">
    <header className="workspace-feature-heading">
      <span className="workspace-business-icon"><Icon name="help" /></span>
      <div><h1 tabIndex={-1}>Ayuda</h1><p>{guide.title}</p></div>
    </header>
    <Card className="help-guide">
      <h2>Cómo trabajar en este rubro</h2>
      <ol>
        <li><Button variant="plain" onClick={() => navigate("caja")}>Revisar caja si usarás efectivo</Button></li>
        {guide.steps.map((step, index) => {
          const view = steps[index] ?? "informes";
          return <li key={step}>{readOnly && ["compras", "ventas", "cotizaciones"].includes(view)
            ? step : <Button variant="plain" onClick={() => navigate(view)}>{step}</Button>}</li>;
        })}
      </ol>
      <div className="guide-example"><strong>Ejemplo</strong><p>{guide.example}</p></div>
      <p>{guide.caution}</p>
    </Card>
    {["timber", "ceramics", "cement"].includes(industry) && <IndustryCalculator key={industry + units} industry={industry} units={units} />}
    <Card className="help-shortcuts">
      <h2>Atajos de teclado</h2>
      <ul>
        <li><kbd>Alt + Mayús + I</kbd> Inicio</li>
        <li><kbd>Alt + Mayús + V</kbd> Ventas</li>
        <li><kbd>Alt + Mayús + C</kbd> Compras</li>
        <li><kbd>Alt + Mayús + A</kbd> Ayuda</li>
        <li><kbd>Esc</kbd> Cerrar o minimizar el panel abierto</li>
      </ul>
    </Card>
  </div>;
}

export function TradeHelp({ industry }: { industry?: string }) {
  const guide = industry && INDUSTRY_GUIDES[industry as IndustryId];
  return guide ? <details className="trade-help"><summary>Ayuda para trabajar con este rubro</summary>
    <ol>{guide.steps.map((step) => <li key={step}>{step}</li>)}</ol>
    <p>{guide.caution}</p>
  </details> : null;
}

function IndustryCalculator({ industry, units }: { industry: string; units: TimberUnits }) {
  const wood = industry === "timber";
  const tile = industry === "ceramics";
  const labels = wood ? ["Largo (" + lengthUnit(units) + ")", "Ancho (" + faceUnit(units) + ")", "Espesor (" + faceUnit(units) + ")"] :
    tile ? ["Superficie (m²)", "Cobertura por caja (m²)", "Merma (%)"] : ["Bolsas completas", "Peso por bolsa (kg)"];
  const [values, setValues] = useState(wood ? units === "imperial" ? ["10", "6", "2"] : ["3048", "152.4", "50.8"] :
    tile ? ["12", "1.44", "10"] : ["2", "50"]);
  const [first, second, third] = values;
  const output = new Intl.NumberFormat("es-BO", { maximumFractionDigits: 2 });
  let result = "";
  let error = "";
  try {
    if (wood) {
      const timber = { lengthMicros: dimension(first, units, "length").value, widthMicros: dimension(second, units, "width").value,
        thicknessMicros: dimension(third, units, "face").value };
      result = timberVolume([{ timber, quantity: 1 }], units) + " " + volumeUnit(units) + " por pieza";
    } else if (tile) {
      const boxArea = Number(second.replace(",", "."));
      if (!/^\d{1,4}(?:[.,]\d{1,3})?$/.test(second.trim()) || !(boxArea > 0) || Number(third.replace(",", ".")) > 30)
        throw new Error("Indica cobertura positiva y una merma de 0 a 30 %.");
      const preview = tilePreview({ boxArea, tone: null, caliber: null },
        { area: first, waste: third, tone: null, caliber: null }, "box", 1);
      if (!preview) throw new Error("Indica superficie y cobertura positivas y una merma de 0 a 30 %.");
      result = preview.quantity + " cajas completas · " + output.format(preview.quantity * boxArea) + " m² de cobertura";
    } else {
      const kg = Number(second.replace(",", "."));
      const bags = Number(first);
      if (!/^\d+$/.test(first) || !Number.isSafeInteger(bags) || bags < 1 || bags > 1_000_000 ||
          !Number.isFinite(kg) || kg <= 0 || kg > 1_000_000) throw new Error("Indica bolsas completas y un peso válido.");
      result = output.format(bags * kg) + " kg después de abrir las bolsas";
    }
  } catch (failure) { error = failure instanceof Error ? failure.message : "Revisa las medidas."; }
  return <Card className="industry-calculator">
    <div><h2>{wood ? "Volumen de una tabla" : tile ? "Calcula cajas y merma" : "Peso al abrir bolsas"}</h2>
      <p>Simulador sin guardado</p></div>
    {wood && <svg viewBox="0 0 350 115" role="img" aria-label="Tabla con largo, ancho y espesor">
      <path d="M15 60 282 15 336 41 69 85Zm0 0v17l54 25 267-45V41M69 85v17" fill="#ead2a8" stroke="currentColor" strokeWidth="2" />
      <path d="m91 68 178-29m-149 39 178-29" fill="none" stroke="currentColor" opacity=".35" />
    </svg>}
    <div className="wizard-options">{labels.map((label, index) => <TextField key={label} label={label}
      inputMode="decimal" value={values[index]} onChange={(event) =>
        setValues((before) => before.map((value, position) => position === index ? event.target.value : value))} />)}</div>
    {error ? <Alert tone="error">{error}</Alert> : <output className="guide-example" aria-live="polite">{result}</output>}
  </Card>;
}
