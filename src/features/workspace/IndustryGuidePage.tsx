import TimberVisual from "./TimberVisual";
import TutorialEntry from "./tutorial/TutorialEntry";
import { useState } from "react";
import { INDUSTRY_GUIDES } from "../../../shared/workspace/industry-workflows";
import { INDUSTRIES } from "../../../shared/business-industries";
import type { Item } from "../../../shared/workspace/model";
import { compare, showQuantity, ZERO } from "../../../shared/workspace/exact";
import { useRecords, useWorkspace } from "./context";
import { bob, localDate, today } from "./format";
import { Pager } from "./ui";
import { useWorkspaceNavigation } from "./navigation";
import VisualExplainer from "./VisualExplainer";
function Expirations() {
  const until = new Date(Date.parse(today() + "T12:00:00Z") + 30 * 86400000)
      .toISOString()
      .slice(0, 10),
    page = useRecords<{
      id: string;
      lot: string;
      expiresOn: string;
      balance: { n: string; d: string };
    }>("lots", { expiresBefore: until });
  return (
    <section className="card">
      <h3>Vencimientos hasta {localDate(until)}</h3>
      <Pager page={page} />
      {page.items
        .filter((l) => compare(l.balance, ZERO) > 0)
        .map((l) => (
          <p
            key={l.id}
            className={l.expiresOn < today() ? "notice notice-warning" : ""}
          >
            Lote {l.lot} · {localDate(l.expiresOn)} · {showQuantity(l.balance)}{" "}
            unidades base{" "}
            {l.expiresOn < today() ? "· Vencido, excluido de ventas" : ""}
          </p>
        ))}
    </section>
  );
}
export default function IndustryGuidePage() {
  const { business } = useWorkspace(),
    { go } = useWorkspaceNavigation(),
    page = useRecords<Item>("items", { active: true }),
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
          {guide.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p>
          <strong>Ejemplo:</strong> {guide.example}
        </p>
        <p className="notice notice-warning">{guide.caution}</p>
        <div className="actions">
          <button onClick={() => go("cotizaciones")}>Cotizar</button>
          <button onClick={() => go("compras")}>Registrar compra</button>
          <button onClick={() => go("ventas")}>Vender</button>
          <button onClick={() => go("informes")}>Ver resultados</button>
        </div>
      </section>
      {guide.visual === "fashion" && (
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
      {guide.visual === "lots" && <Expirations />}
      <section className="card">
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
      </section>
    </>
  );
}
