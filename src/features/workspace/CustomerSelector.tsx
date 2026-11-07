import type { Customer } from "../../../shared/workspace/model";
import { useRecords } from "./context";
import { Pager } from "./ui";

export function CustomerSelector({
  value,
  onChange,
  required = false,
}: {
  value: string;
  required?: boolean;
  onChange: (id: string, name: string) => void;
}) {
  const page = useRecords<Customer>("customersV2");
  return (
    <details open={required}>
      <summary>
        {required
          ? "Seleccionar cliente registrado (obligatorio)"
          : "Seleccionar cliente registrado"}
      </summary>
      <Pager page={page} />
      <label>
        Cliente de este negocio
        <select
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
            {required
              ? "Selecciona un cliente activo"
              : "Cliente ocasional / escribir nombre"}
          </option>
          {value && !page.items.some((c) => c.id === value) && (
            <option value={value}>Cliente seleccionado</option>
          )}
          {page.items
            .filter((c) => c.active)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </label>
    </details>
  );
}
