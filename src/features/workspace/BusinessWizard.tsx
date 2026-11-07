import { Icon } from "./Icon";
import { confirmDiscardChanges } from "./navigation";
import { useState } from "react";
import type { BusinessAnswers } from "../../../shared/workspace/model";
import { INDUSTRIES, INDUSTRY_IDS } from "../../../shared/business-industries";
import type { IndustryId } from "../../../shared/business-industries";
import {
  DEFAULT_ANSWERS,
  industryLabel,
  specialized,
} from "../../../shared/workspace/catalog";
import { ActionForm, Field } from "./ui";

export default function BusinessWizard({
  initialName = "",
  initialIndustry = null,
  onConfirm,
  onCancel,
  busy = false,
}: {
  initialName?: string;
  initialIndustry?: IndustryId | null;
  onConfirm: (
    name: string,
    industryId: IndustryId,
    answers: BusinessAnswers,
  ) => Promise<unknown>;
  onCancel?: () => void;
  busy?: boolean;
}) {
  const [stage, setStage] = useState(0),
    [name, setName] = useState(initialName),
    [industry, setIndustry] = useState<IndustryId>(
      initialIndustry ?? "convenience",
    ),
    [answers, setAnswers] = useState<BusinessAnswers>({ ...DEFAULT_ANSWERS });
  return (
    <section className="card wizard">
      <ol className="wizard-progress" aria-label="Progreso de creación">
        {["Tu actividad", "Forma de trabajar", "Confirmación"].map(
          (label, index) => (
            <li key={label} aria-current={stage === index ? "step" : undefined}>
              <span>{stage > index ? <Icon name="check" /> : index + 1}</span>
              {label}
            </li>
          ),
        )}
      </ol>
      <h1>
        {initialName
          ? "Confirma el rubro de tu negocio"
          : "Un espacio para tu negocio"}
      </h1>
      <p className="wizard-intro">
        Cada negocio tiene inventario, ventas, caja y documentos independientes.
        Su rubro queda fijo; puedes crear otro espacio con esta misma cuenta.
      </p>
      {stage === 0 && (
        <ActionForm
          label="Continuar"
          onSave={async (d) => {
            setName(String(d.get("name")).trim());
            setIndustry(String(d.get("industry")) as IndustryId);
            setStage(1);
          }}
        >
          <Field
            name="name"
            label="Nombre del negocio"
            value={name}
            maxLength={80}
          />
          <fieldset>
            <legend>Elige el tipo de negocio</legend>
            <div className="industry-options">
              {INDUSTRY_IDS.map((id) => (
                <label className="industry-choice" key={id}>
                  <input
                    type="radio"
                    name="industry"
                    value={id}
                    defaultChecked={industry === id}
                    required
                  />
                  <span>
                    <strong>{INDUSTRIES[id].name}</strong>
                    <small>
                      {specialized(id)
                        ? "Modelo especializado"
                        : "Núcleo común"}
                    </small>
                    <small className="industry-help">
                      {INDUSTRIES[id].description}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </ActionForm>
      )}
      {stage === 1 && (
        <ActionForm
          label="Revisar configuración"
          onSave={async (d) => {
            setAnswers({
              weighted: d.get("weighted") === "on",
              bulk: d.get("bulk") === "on",
              timberMode: d.get("timberMode") === "volume" ? "volume" : "piece",
              address: String(d.get("address") ?? ""),
              phone: String(d.get("phone") ?? ""),
              documentFooter: String(d.get("footer") ?? ""),
            });
            setStage(2);
          }}
        >
          <h2>{industryLabel(industry)}</h2>
          {["convenience", "grocery", "pets"].includes(industry) && (
            <label>
              <input
                type="checkbox"
                name="weighted"
                defaultChecked={answers.weighted}
              />
              También vendo productos por peso
            </label>
          )}
          {industry === "cement" && (
            <label>
              <input
                type="checkbox"
                name="bulk"
                defaultChecked={answers.bulk}
              />
              Abro bolsas y vendo a granel por kg
            </label>
          )}
          {industry === "timber" && (
            <label>
              Forma habitual de registrar madera
              <select name="timberMode" defaultValue={answers.timberMode}>
                <option value="piece">Piezas con dimensiones reales</option>
                <option value="volume">Volumen</option>
              </select>
            </label>
          )}
          <p>
            {industry === "clothing" || industry === "footwear"
              ? "Cada talla y color tendrá su propio stock, precio y costo."
              : industry === "appliances"
                ? "Cada equipo se compra y vende por su serie; podrás registrar su garantía comercial."
                : industry === "ceramics"
                  ? "Cada tono y calibre se mantiene separado. Las cotizaciones por m² muestran las piezas o cajas realmente entregadas."
                  : industry === "timber"
                    ? "Puedes cotizar por pieza, m³ o pie tablar. Los cortes se registran como servicios."
                    : industry === "cement"
                      ? "Las bolsas conservan marca, peso y lote. La apertura a granel conserva masa y valor."
                      : industry === "convenience"
                        ? "Los lotes se asignan por vencimiento más próximo; los vencidos no se venden."
                        : "Este rubro utiliza productos por unidad y servicios del núcleo común."}
          </p>
          <Field
            name="address"
            label="Dirección en documentos"
            value={answers.address}
            required={false}
            maxLength={160}
          />
          <Field
            name="phone"
            label="Teléfono"
            value={answers.phone}
            required={false}
            maxLength={30}
          />
          <Field
            name="footer"
            label="Condiciones o nota en comprobantes"
            value={answers.documentFooter}
            required={false}
            maxLength={300}
          />
          <button
            type="button"
            onClick={() => {
              if (confirmDiscardChanges()) setStage(0);
            }}
          >
            Atrás
          </button>
        </ActionForm>
      )}
      {stage === 2 && (
        <ActionForm
          disabled={busy}
          label="Confirmar y comenzar"
          onSave={async () => onConfirm(name, industry, answers)}
        >
          <div className="wizard-summary">
            <span className="eyebrow">TU NEGOCIO ESTÁ LISTO PARA EMPEZAR</span>
            <h2>{name}</h2>
            <p>{industryLabel(industry)} · BOB · America/La_Paz</p>
            <p>
              {answers.address} {answers.phone}
            </p>
            <p>
              Internet requerido. Documentos no fiscales.{" "}
              {specialized(industry)
                ? "Guía y herramientas de este rubro habilitadas."
                : "Herramientas de trabajo y guía adaptadas a este rubro."}
            </p>
          </div>
          <label>
            <input type="checkbox" required />
            Confirmo este rubro fijo y la separación de los datos.
          </label>
          <button
            type="button"
            onClick={() => {
              if (confirmDiscardChanges()) setStage(1);
            }}
          >
            Atrás
          </button>
        </ActionForm>
      )}
      {onCancel && <button onClick={onCancel}>Volver a mis negocios</button>}
    </section>
  );
}
