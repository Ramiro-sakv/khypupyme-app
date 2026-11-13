import { Link } from "react-router";
import { isBillingEnabled } from "../billing/profile";
import { useWorkspace } from "./context";
import { ActionForm, Field } from "./ui";
import BusinessDeletionPanel from "./BusinessDeletionPanel";
import BusinessPlanPanel from "../billing/BusinessPlanPanel";
import BusinessExport from "../billing/BusinessExport";
import AccountSessionActions from "./AccountSessionActions";
export function Preferences({ onExit }: { onExit: () => void }) {
  const { business, run, busy } = useWorkspace();
  return (
    <>
    <section className="card preferences-session">
      <h2>Configuración</h2>
      <AccountSessionActions onExit={onExit} practice={!!business.tutorialSessionId} exitDisabled={!!business.tutorialSessionId && busy} />
    </section>
    <section className="card">
      <h2>Datos del negocio</h2>
      <p>El rubro es fijo. Para otra actividad crea otro negocio.</p>
      {business.industryId === "timber" && (
        <ActionForm
          dataTutorial="timber-preferences"
          label="Guardar medidas de madera"
          disabled={busy}
          onSave={(d) =>
            run({
              kind: "timber-preferences",
              input: {
                system: String(d.get("system")) as "imperial" | "metric",
              },
            })
          }
        >
          <h3>Medidas de madera</h3>
          <label>
            Sistema de captura
            <select
              name="system"
              defaultValue={business.timberSystem ?? "imperial"}
            >
              <option value="imperial">
                Pulgadas y pies · volumen en pies tablares
              </option>
              <option value="metric">
                Métrico · dimensiones en mm y volumen en m³
              </option>
            </select>
          </label>
          <p>
            Se usan las medidas declaradas por tu negocio. Esta preferencia no
            cambia precios, existencias ni documentos históricos.
          </p>
        </ActionForm>
      )}
      <ActionForm
        disabled={busy}
        label="Guardar datos para documentos nuevos"
        onSave={(d) =>
          run({
            kind: "preferences",
            input: {
              name: String(d.get("name")),
              address: String(d.get("address") ?? ""),
              phone: String(d.get("phone") ?? ""),
              documentFooter: String(d.get("footer") ?? ""),
            },
          })
        }
      >
        <Field name="name" label="Nombre" value={business.name} />
        <Field
          name="address"
          label="Dirección"
          value={business.answers.address}
          required={false}
        />
        <Field
          name="phone"
          label="Teléfono"
          value={business.answers.phone}
          required={false}
        />
        <Field
          name="footer"
          label="Condiciones"
          value={business.answers.documentFooter}
          required={false}
          maxLength={300}
        />
      </ActionForm>
    </section>
    <BusinessPlanPanel />
    {business.tutorialSessionId ? null : <BusinessExport />}
    {isBillingEnabled && !business.tutorialSessionId && <div className="actions">
      <Link className="button" to="/privacidad">Privacidad</Link>
      <Link className="button" to="/eliminar-cuenta">Solicitar eliminación de cuenta</Link>
    </div>}
    {import.meta.env.VITE_USE_EMULATORS !== "false" && <BusinessDeletionPanel onExit={onExit} />}
    </>
  );
}
