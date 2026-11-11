import { displayQuantity as showQuantity } from "../../../shared/workspace/presentation";
import TimberVisual from "./TimberVisual";
import TutorialEntry from "./tutorial/TutorialEntry";
import GettingStarted from "./GettingStarted";
import ExpiringLots from "./ExpiringLots";
import { useState } from "react";
import { INDUSTRY_GUIDES } from "../../../shared/workspace/industry-workflows";
import { INDUSTRIES } from "../../../shared/business-industries";
import type { Item } from "../../../shared/workspace/model";
import { compare } from "../../../shared/workspace/exact";
import { useRecords, useWorkspace } from "./context";
import { bob } from "./format";
import { Pager } from "./ui";
import { useWorkspaceNavigation } from "./navigation";
import VisualExplainer from "./VisualExplainer";
export default function IndustryGuidePage() {
  const { business } = useWorkspace(),
    { go } = useWorkspaceNavigation(),
    industry = business.industryId,
    dedicated = industry === "convenience" || industry === "clothing" || industry === "appliances",
    page = useRecords<Item>("items", { active: true }, !dedicated),
    [model, setModel] = useState(""),
    [variant, setVariant] = useState<Item | null>(null),
    guide = INDUSTRY_GUIDES[business.industryId ?? "convenience"],
    models = [
      ...new Set(
        page.items
          .filter((i) => i.kind === "apparel")
          .map((i) => i.fields.model!),
      ),
    ];
  const taskViews = ["inventario", "compras", "ventas", industry === "appliances" ? "garantias" : industry === "clothing" ? "ventas" : "inventario"];
  const finalFilter = industry === "clothing" ? "cambios" : industry === "convenience" ? "vencimientos" : undefined;
  return (
    <>
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">CÓMO TRABAJAR AQUÍ</span>
          <h2>{guide.title}</h2>
          <p>
            {business.industryId
              ? INDUSTRIES[business.industryId].name
              : "Negocio anterior"}
          </p>
        </div>
        <button className="primary" onClick={() => go("inventario")}>
          Preparar catálogo
        </button>
      </div>
      <TutorialEntry />
      {business.industryId !== "timber" && <GettingStarted />}
      <div data-tutorial="industry-guide">
        {business.industryId === "timber" ? (
          <TimberVisual key={business.timberSystem ?? "imperial"} />
        ) : (
          <VisualExplainer key={business.industryId} guide={guide} />
        )}
      </div>
      <section className="card">
        <h3>Tu guía de uso</h3>
        <ol>
          {dedicated && <li><button type="button" className="text-button" onClick={() => go("caja")}>Abrir caja si usarás efectivo</button></li>}
          {guide.steps.map((step, index) => <li key={step}>{dedicated ? (
            <button type="button" className="text-button" onClick={() => go(taskViews[index] ?? "informes", index === 3 && finalFilter ? { atencion: finalFilter } : undefined)}>{step}</button>
          ) : step}</li>)}
        </ol>
        <p>
          <strong>Ejemplo:</strong> {guide.example}
        </p>
        <p className="notice notice-warning">{guide.caution}</p>
        {!dedicated && <div className="actions">
          <button onClick={() => go("cotizaciones")}>Cotizar</button>
          <button onClick={() => go("compras")}>Registrar compra</button>
          <button onClick={() => go("ventas")}>Vender</button>
          <button onClick={() => go("informes")}>Ver resultados</button>
        </div>}
      </section>
      {!dedicated && guide.visual === "fashion" && (
        <section className="card">
          <h3>Matriz de disponibilidad</h3>
          <label>
            Modelo de esta página
            <select
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                setVariant(null);
              }}
            >
              <option value="">Todos</option>
              {models.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <Pager page={page} />
          <div className="variant-grid">
            {page.items
              .filter(
                (i) =>
                  i.kind === "apparel" && (!model || i.fields.model === model),
              )
              .map((i) => (
                <button
                  key={i.id}
                  aria-pressed={variant?.id === i.id}
                  onClick={() => setVariant(i)}
                >
                  <strong>
                    {i.fields.size} · {i.fields.color}
                  </strong>
                  <span>
                    {showQuantity(i.balance)} {i.baseUnit}
                  </span>
                  <span>{bob(i.priceMinor)}</span>
                </button>
              ))}
          </div>
          {variant && (
            <p role="status">
              {variant.name}: {showQuantity(variant.balance)} disponibles,
              precio {bob(variant.priceMinor)}. Abre Vender para seleccionar
              esta variante.
            </p>
          )}
        </section>
      )}
      {!dedicated && guide.visual === "lots" && <ExpiringLots />}
      {!dedicated && <section className="card">
        <h3>Reposición en esta página de catálogo</h3>
        <Pager page={page} />
        {page.items
          .filter(
            (i) => i.kind !== "service" && compare(i.balance, i.minimum) < 0,
          )
          .map((i) => (
            <p key={i.id}>
              {i.name}: {showQuantity(i.balance)} {i.baseUnit} · mínimo{" "}
              {showQuantity(i.minimum)}
            </p>
          ))}
        <p className="muted">
          El listado está paginado; no representa un contador global de
          faltantes.
        </p>
      </section>}
    </>
  );
}
