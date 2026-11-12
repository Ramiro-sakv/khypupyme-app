import { industryIcon } from "./industryAppearance";
import { Icon } from "./Icon";
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
  function changeAnswer<K extends keyof BusinessAnswers>(key: K, value: BusinessAnswers[K]) {
    setAnswers((previous) => ({ ...previous, [key]: value }));
  }
  const steps = ["Elegir rubro", "Configurar", "Revisar"];
  return (
    <section className="card wizard" data-industry={industry}>
      <ol className="wizard-progress" aria-label="Progreso de creación">
        {steps.map(
          (label, index) => (
            <li key={label} aria-current={stage === index ? "step" : undefined}>
              <span>{stage > index ? <Icon name="check" /> : index + 1}</span>
              {label}
            </li>
          ),
        )}
      </ol>
      <div className="wizard-heading">
        <span className="eyebrow">Paso {stage + 1} de {steps.length}</span>
        <h1>{stage === 0 ? (initialName ? "Confirma el rubro" : "Crea tu negocio")
          : stage === 1 ? "Configura tu negocio" : "Revisa los datos"}</h1>
      </div>
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
            onValueChange={setName}
            maxLength={80}
          />
          <fieldset>
            <legend>Elige el tipo de negocio</legend>
            <div className="industry-options">
              {INDUSTRY_IDS.map((id) => (
                <label className="industry-choice" data-industry={id} key={id}>
                  <input
                    type="radio"
                    name="industry"
                    value={id}
                    checked={industry === id}
                    onChange={() => setIndustry(id)}
                    required
                  />
                  <span>
                    <span className="business-symbol"><Icon name={industryIcon(id)} /></span>
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
          <div className="wizard-industry"><Icon name={industryIcon(industry)} /><strong>{industryLabel(industry)}</strong></div>
          {["convenience", "grocery", "pets"].includes(industry) && (
            <label>
              <input
                type="checkbox"
                name="weighted"
                checked={answers.weighted} onChange={(e) => changeAnswer("weighted", e.target.checked)}
              />
              También vendo productos por peso
            </label>
          )}
          {industry === "cement" && (
            <label>
              <input
                type="checkbox"
                name="bulk"
                checked={answers.bulk} onChange={(e) => changeAnswer("bulk", e.target.checked)}
              />
              Abro bolsas y vendo a granel por kg
            </label>
          )}
          {industry === "timber" && (
            <label>
              Forma habitual de registrar madera
              <select name="timberMode" value={answers.timberMode} onChange={(e) => changeAnswer("timberMode", e.target.value === "volume" ? "volume" : "piece")}>
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
            value={answers.address} onValueChange={(value) => changeAnswer("address", value)}
            required={false}
            maxLength={160}
          />
          <Field
            name="phone"
            label="Teléfono"
            value={answers.phone} onValueChange={(value) => changeAnswer("phone", value)}
            required={false}
            maxLength={30}
          />
          <Field
            name="footer"
            label="Condiciones o nota en comprobantes"
            value={answers.documentFooter} onValueChange={(value) => changeAnswer("documentFooter", value)}
            required={false}
            maxLength={300}
          />
          <button
            type="button"
            onClick={() => {
              setStage(0);
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
            <span className="business-symbol"><Icon name={industryIcon(industry)} /></span>
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
              setStage(1);
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
