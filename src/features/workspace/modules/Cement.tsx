import type { ReactNode } from "react";
import type { Item } from "../../../../shared/workspace/model";
import { useRecords, useWorkspace } from "../context";
import { ActionForm, Field, Pager } from "../ui";
import { q } from "../format";
export default function Cement({ children }: { children: ReactNode }) {
  const { business, run, busy } = useWorkspace(),
    page = useRecords<Item>("items");
  return (
    <>
      <section className="model-note">
        <h2>Cemento</h2>
        <p>
          Bolsas con peso declarado, marca, tipo y lote. Abrir bolsas hacia
          granel conserva exactamente masa, lote y valor.
        </p>
        {business.answers.bulk && (
          <details>
            <summary>Abrir bolsas a granel</summary>
            <Pager page={page} />
            <ActionForm
              disabled={busy}
              label="Confirmar apertura atómica"
              onSave={(d) =>
                run({
                  kind: "unpack",
                  input: {
                    sourceId: String(d.get("source")),
                    targetId: String(d.get("target")),
                    bags: q(d.get("bags")),
                  },
                })
              }
            >
              <label>
                Bolsas de origen
                <select name="source" required>
                  {page.items
                    .filter((i) => i.kind === "cement-bag" && i.active)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Producto a granel de destino
                <select name="target" required>
                  {page.items
                    .filter((i) => i.kind === "cement-bulk" && i.active)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                </select>
              </label>
              <Field name="bags" label="Bolsas completas a abrir" />
            </ActionForm>
          </details>
        )}
      </section>
      {children}
    </>
  );
}
