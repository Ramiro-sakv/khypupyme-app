import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { change } from "../api/client";
import { Icon } from "../ui/Icon";
import { Alert, Button, Card, SelectField, TextField } from "../ui/Primitives";
import { industryTheme } from "./industryThemes";
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

  return <div className="business-wizard" style={theme.style}>
    <Card>
      <h1 ref={heading} tabIndex={-1}>Crear negocio</h1>
      <ol className="wizard-steps">
        {["Rubro", "Configuración", "Revisión"].map((name, index) => (
          <li key={name} aria-current={step === index + 1 ? "step" : undefined}>{name}</li>
        ))}
      </ol>
      <form className="account-form" onSubmit={(event) => void submit(event)}>
        {step === 1 && <>
          <SelectField label="Rubro del negocio" required value={industry?.id ?? ""} onChange={(event) => {
            setIndustry(industries.find((item) => item.id === event.target.value) ?? null);
            setAttemptId(crypto.randomUUID());
          }}>
            <option value="">Elige un rubro</option>
            {industries.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </SelectField>
          {industry && <div className="wizard-industry">
            <span className="workspace-business-icon"><Icon name={theme.icon} /></span>
            <div><strong>{industry.name}</strong><p>{industry.description}</p></div>
          </div>}
        </>}
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
