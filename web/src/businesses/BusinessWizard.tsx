import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { change } from "../api/client";
import { Icon } from "../ui/Icon";
import { Alert, Button, Card, SelectField, TextField } from "../ui/Primitives";
import { industryPhoto } from "./industryPhoto";
import { industryFamilies, industryTheme } from "./industryThemes";
import { INDUSTRY_GUIDES } from "./industryGuides";
import type { IndustryId } from "./industryThemes";
import { businessApi } from "./models";
import type { BusinessProfile, IndustryOption } from "./models";

type Draft = { name: string; city: string; phone: string; timberUnits: string };

export function BusinessWizard({ industries, onCancel, onCreated }: {
  industries: IndustryOption[];
  onCancel: () => void;
  onCreated: (business: BusinessProfile) => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(1);
  const [industry, setIndustry] = useState<IndustryOption | null>(null);
  const [draft, setDraft] = useState<Draft>({ name: "", city: "", phone: "", timberUnits: "imperial" });
  const [attemptId, setAttemptId] = useState(() => crypto.randomUUID());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const theme = industryTheme(industry?.id ?? "");
  const guide = industry ? INDUSTRY_GUIDES[industry.id as IndustryId] : null;

  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [step]);

  function update(field: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setAttemptId(crypto.randomUUID());
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!industry) return;
    if (step < 3) { setStep(step + 1); return; }
    setSending(true);
    setError("");
    try {
      const created = await change<BusinessProfile>(businessApi, "POST", {
        id: attemptId, name: draft.name, city: draft.city, phone: draft.phone, industry: industry.id,
        timberUnits: industry.id === "timber" ? draft.timberUnits : null,
      });
      onCreated(created);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Comprueba tu conexión.");
    } finally {
      setSending(false);
    }
  }

  const photo = industryPhoto(industry?.id);

  return <div className="business-wizard" style={theme.style}>
    <Card>
      <ol className="wizard-steps">
        {["Rubro", "Configuración", "Revisión"].map((name, index) => (
          <li key={name} aria-current={step === index + 1 ? "step" : undefined}>{name}</li>
        ))}
      </ol>
      <header className="wizard-heading"><h1 ref={heading} tabIndex={-1}>Crear negocio</h1>
        <p>{step === 1 ? "Elige el rubro. Cada negocio tiene su propia caja, inventario e historial." :
          step === 2 ? "Completa los datos con los que identificarás este negocio." : "Revisa los datos antes de crear el negocio."}</p>
      </header>
      <form className="account-form" onSubmit={(event) => void submit(event)}>
        {step === 1 && <div className="wizard-choice">
          <fieldset className="wizard-families">
            <legend>Elige el tipo de negocio</legend>
            {industryFamilies.map(({ label, ids }) => <section key={label} className="wizard-family">
              <h2>{label}</h2>
              <div className="wizard-options">
                {ids.flatMap((id) => industries.filter((option) => option.id === id)).map((option) => {
                  const identity = industryTheme(option.id);
                  return <label className="wizard-option" style={identity.style} key={option.id}>
                    <span className="workspace-business-icon"><Icon name={identity.icon} /></span>
                    <span>{option.name}</span>
                    <input type="radio" name="industry" required checked={industry?.id === option.id} onChange={() => {
                      setIndustry(option);
                      setAttemptId(crypto.randomUUID());
                    }} />
                  </label>;
                })}
              </div>
            </section>)}
          </fieldset>
          <aside className="wizard-preview" aria-live="polite">
            {industry && guide ? <>
              {photo && <img className="wizard-preview-photo" src={photo} alt="" decoding="async" />}
              <span className="workspace-business-icon"><Icon name={theme.icon} /></span>
              <h2>{industry.name}</h2><p>{industry.description}</p>
              <ul>{guide.steps.slice(0, 3).map((stepText) => <li key={stepText}><Icon name="check" />{stepText}</li>)}</ul>
            </> : <p>Selecciona un rubro para ver sus herramientas.</p>}
          </aside>
        </div>}
        {step === 2 && <>
          <TextField label="Nombre del negocio" required maxLength={100} value={draft.name}
            onChange={(event) => update("name", event.target.value)} />
          <TextField label="Ciudad (opcional)" maxLength={80} value={draft.city}
            onChange={(event) => update("city", event.target.value)} />
          <TextField label="Teléfono (opcional)" type="tel" maxLength={32} value={draft.phone}
            onChange={(event) => update("phone", event.target.value)} />
          {industry?.id === "timber" && <SelectField label="Medidas de madera" value={draft.timberUnits}
            onChange={(event) => update("timberUnits", event.target.value)}>
            <option value="imperial">Pulgadas y pies</option><option value="metric">Métrica</option>
          </SelectField>}
        </>}
        {step === 3 && <dl className="business-summary">
          <dt>Nombre</dt><dd>{draft.name}</dd>
          <dt>Rubro fijo</dt><dd>{industry?.name}</dd>
          {draft.city && <><dt>Ciudad</dt><dd>{draft.city}</dd></>}
          {draft.phone && <><dt>Teléfono</dt><dd>{draft.phone}</dd></>}
          {industry?.id === "timber" && <><dt>Medidas</dt><dd>{draft.timberUnits === "metric" ? "Métrica" : "Pulgadas y pies"}</dd></>}
          <dt>Moneda</dt><dd>BOB · Bolivianos</dd>
        </dl>}
        {error && <Alert tone="error">{error}</Alert>}
        <div className="inline-actions">
          <Button variant="secondary" disabled={sending}
            onClick={() => step === 1 ? onCancel() : setStep(step - 1)}>{step === 1 ? "Cancelar" : "Atrás"}</Button>
          <Button type="submit" icon={step === 3 ? "check" : "arrow"} disabled={sending}>
            {sending ? "Guardando…" : step === 3 ? "Crear negocio" : "Continuar"}
          </Button>
        </div>
      </form>
    </Card>
  </div>;
}
