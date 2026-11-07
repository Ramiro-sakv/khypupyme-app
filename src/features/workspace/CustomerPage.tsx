import { useState } from "react";
import type { Customer } from "../../../shared/workspace/model";
import { useRecords, useWorkspace } from "./context";
import { confirmDiscardChanges } from "./navigation";
import { ActionForm, Field, Pager } from "./ui";
export function Customers() {
  const { run, busy } = useWorkspace(),
    page = useRecords<Customer>("customersV2"),
    [edit, setEdit] = useState<Customer | null>(null);
  return (
    <>
      <h2>Clientes</h2>
      <details
        className="card record-editor"
        key={edit?.id ?? "new"}
        open={edit ? true : undefined}
      >
        <summary>{edit ? "Editar cliente" : "Nuevo cliente"}</summary>
        <ActionForm
          disabled={busy}
          label={edit ? "Guardar cliente" : "Crear cliente"}
          onSave={async (d) => {
            const result = await run({
              kind: "customer",
              input: {
                id: edit?.id ?? crypto.randomUUID(),
                name: String(d.get("name")),
                phone: String(d.get("phone") ?? ""),
                notes: String(d.get("notes") ?? ""),
                active: d.get("active") === "on",
              },
            });
            if (result) setEdit(null);
          }}
        >
          <Field name="name" label="Nombre" value={edit?.name ?? ""} />
          <Field
            name="phone"
            label="Teléfono"
            required={false}
            value={edit?.phone ?? ""}
          />
          <Field
            name="notes"
            label="Notas"
            required={false}
            value={edit?.notes ?? ""}
          />
          <label>
            <input
              type="checkbox"
              name="active"
              defaultChecked={edit?.active ?? true}
            />
            Activo
          </label>
        </ActionForm>
        {edit && (
          <button
            onClick={() => {
              if (confirmDiscardChanges()) setEdit(null);
            }}
          >
            Cancelar edición
          </button>
        )}
      </details>
      <Pager page={page} />
      <div className="table-scroll desktop-records">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Teléfono</th>
              <th>Estado</th>
              <th>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.name}</strong>
                  <small>{c.notes}</small>
                </td>
                <td>{c.phone || "—"}</td>
                <td>
                  <span
                    className="badge"
                    data-state={c.active ? "active" : "neutral"}
                  >
                    {c.active ? "Activo" : "Archivado"}
                  </span>
                </td>
                <td>
                  <button
                    onClick={() => {
                      if (confirmDiscardChanges()) setEdit(c);
                    }}
                  >
                    Editar / archivar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="records-grid mobile-records">
        {page.items.map((c) => (
          <article key={c.id} className="card list-card">
            <h3>{c.name}</h3>
            <p>
              {c.phone} ·{" "}
              <span
                className="badge"
                data-state={c.active ? "active" : "neutral"}
              >
                {c.active ? "Activo" : "Archivado"}
              </span>
            </p>
            <p>{c.notes}</p>
            <button
              onClick={() => {
                if (confirmDiscardChanges()) setEdit(c);
              }}
            >
              Editar / archivar
            </button>
          </article>
        ))}
      </div>
    </>
  );
}
