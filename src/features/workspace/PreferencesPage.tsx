import { useWorkspace } from "./context";
import { ActionForm, Field } from "./ui";
export function Preferences() {
  const { business, run, busy } = useWorkspace();
  return (
    <section className="card">
      <h2>Datos del negocio</h2>
      <p>El rubro es fijo. Para otra actividad crea otro negocio.</p>
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
  );
}
