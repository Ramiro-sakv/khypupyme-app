import { useState } from "react";
import type { FormEvent } from "react";
import type { components } from "../api/schema";
import { change } from "../api/client";

type Industry = components["schemas"]["IndustryOption"];
type Profile = components["schemas"]["BusinessProfile"];
type Draft = { name: string; city: string; phone: string; timberUnits: string };

export function BusinessWizard({ industries, onCancel, onCreated }: {
  industries: Industry[];
  onCancel: () => void;
  onCreated: (business: Profile) => void;
}) {
  const [step, setStep] = useState(1);
  const [industry, setIndustry] = useState<Industry | null>(null);
  const [draft, setDraft] = useState<Draft>({ name: "", city: "", phone: "", timberUnits: "imperial" });
  const [attemptId, setAttemptId] = useState(() => crypto.randomUUID());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  function update(field: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setAttemptId(crypto.randomUUID());
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!industry) return;
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    setSending(true);
    setError("");
    try {
      const created = await change<Profile>("/api/v1/businesses", "POST", {
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

  return (
    <section className="account-card">
      <h1>Crear negocio</h1>
      <ol className="wizard-steps">
        {["Rubro", "Configuración", "Revisión"].map((name, index) => (
          <li key={name} aria-current={step === index + 1 ? "step" : undefined}>{name}</li>
        ))}
      </ol>
      <form className="account-form" onSubmit={(event) => void submit(event)}>
        {step === 1 && (
          <label>Rubro del negocio
            <select required value={industry?.id ?? ""} onChange={(event) => {
              setIndustry(industries.find((item) => item.id === event.target.value) ?? null);
              setAttemptId(crypto.randomUUID());
            }}>
              <option value="">Elige un rubro</option>
              {industries.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            {industry && <small>{industry.description}</small>}
          </label>
        )}
        {step === 2 && (
          <>
            <label>Nombre del negocio
              <input required maxLength={100} value={draft.name} onChange={(event) => update("name", event.target.value)} />
            </label>
            <label>Ciudad (opcional)
              <input maxLength={80} value={draft.city} onChange={(event) => update("city", event.target.value)} />
            </label>
            <label>Teléfono (opcional)
              <input type="tel" maxLength={32} value={draft.phone} onChange={(event) => update("phone", event.target.value)} />
            </label>
            {industry?.id === "timber" && <label>Medidas de madera
              <select value={draft.timberUnits} onChange={(event) => update("timberUnits", event.target.value)}>
                <option value="imperial">Pulgadas y pies</option><option value="metric">Métrica</option>
              </select>
            </label>}
          </>
        )}
        {step === 3 && (
          <dl className="business-summary">
            <dt>Nombre</dt><dd>{draft.name}</dd>
            <dt>Rubro fijo</dt><dd>{industry?.name}</dd>
            {draft.city && <><dt>Ciudad</dt><dd>{draft.city}</dd></>}
            {draft.phone && <><dt>Teléfono</dt><dd>{draft.phone}</dd></>}
            {industry?.id === "timber" && <><dt>Medidas</dt><dd>{draft.timberUnits === "metric" ? "Métrica" : "Pulgadas y pies"}</dd></>}
            <dt>Moneda</dt><dd>BOB · Bolivianos</dd>
          </dl>
        )}
        {error && <p role="alert" className="form-error">{error}</p>}
        <div className="inline-actions">
          <button type="button" className="secondary" disabled={sending}
            onClick={() => step === 1 ? onCancel() : setStep(step - 1)}>{step === 1 ? "Cancelar" : "Atrás"}</button>
          <button type="submit" disabled={sending}>{sending ? "Guardando…" : step === 3 ? "Crear negocio" : "Continuar"}</button>
        </div>
      </form>
    </section>
  );
}
