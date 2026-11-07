import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Customer } from "../../../shared/workspace/model";
import { useRecords, useWorkspace } from "./context";
import { ActionForm, Field, Pager } from "./ui";
import { Panel } from "./Panel";
export function CustomerSelector({
  value,
  onChange,
  required = false,
  allowCreate = false,
}: {
  value: string;
  required?: boolean;
  allowCreate?: boolean;
  onChange: (id: string, name: string) => void;
}) {
  const { run, busy } = useWorkspace();
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [creating, setCreating] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const page = useRecords<Customer>("customersV2", {
    active: true,
    ...(query.length >= 2 ? { search: query } : {}),
  });
  return (
    <div className="customer-quick-select">
      <label>
        Cliente{" "}
        {required ? "registrado (obligatorio)" : "ocasional o registrado"}
        <input
          aria-label="Buscar clientes de este negocio"
          placeholder="Buscar por nombre"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          maxLength={40}
        />
      </label>
      <Pager page={page} />
      <label>
        <span className="sr-only">Cliente de este negocio</span>
        <select
          name="customerId"
          required={required}
          value={value}
          onChange={(e) =>
            onChange(
              e.target.value,
              page.items.find((c) => c.id === e.target.value)?.name ?? "",
            )
          }
        >
          <option value="">
            {required ? "Selecciona un cliente activo" : "Cliente ocasional"}
          </option>
          {value && !page.items.some((c) => c.id === value) && (
            <option value={value}>Cliente seleccionado</option>
          )}
          {page.items.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.phone ? " · " + c.phone : ""}
            </option>
          ))}
        </select>
      </label>
      {allowCreate && (
        <button
          type="button"
          data-tutorial="new-inline-customer"
          disabled={busy}
          onClick={() => setCreating(true)}
        >
          Nuevo cliente sin salir de la venta
        </button>
      )}
      {creating &&
        createPortal(
          <Panel title="Nuevo cliente" onClose={() => setCreating(false)}>
            <ActionForm
              dataTutorial="customer-form"
              label="Guardar y seleccionar cliente"
              disabled={busy}
              onSave={async (d) => {
                const id = crypto.randomUUID(),
                  name = String(d.get("name"));
                const result = await run({
                  kind: "customer",
                  input: {
                    id,
                    name,
                    phone: String(d.get("phone") ?? ""),
                    notes: "",
                    active: true,
                  },
                });
                if (result) {
                  onChange(id, name);
                  setCreating(false);
                  setSearch("");
                }
              }}
            >
              <Field name="name" label="Nombre" maxLength={80} />
              <Field
                name="phone"
                label="Teléfono"
                required={false}
                maxLength={30}
              />
              <p>Guardar este cliente no envía ni confirma la venta.</p>
            </ActionForm>
          </Panel>,
          document.body,
        )}
    </div>
  );
}
