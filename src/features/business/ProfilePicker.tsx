import type { BusinessConfiguration, ProfileId } from '../../../shared/business-configuration';
import { defaultConfiguration, toggleTool } from '../../../shared/business-configuration';

const profiles: Record<ProfileId, { name: string; description: string }> = {
  retail: {
    name: 'Tienda y comercio',
    description:
      'Productos por unidades, compras, existencias y costos. Ideal para comenzar con una tienda.',
  },
  services: {
    name: 'Servicios',
    description:
      'Catálogo de trabajos, precios y costos directos. Las ventas comienzan por servicios.',
  },
  mixed: {
    name: 'Comercio y servicios',
    description:
      'Combina productos y trabajos en el mismo negocio, con una sola cuenta e informes comunes.',
  },
};
const toolLabels = {
  inventory: 'Inventario',
  purchases: 'Compras',
  services: 'Servicios',
  customers: 'Clientes',
  receivables: 'Fiados y cobros',
};
export function ProfilePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: BusinessConfiguration | null;
  onChange: (value: BusinessConfiguration) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="profile-picker">
      <legend>Configura tus herramientas</legend>
      <label htmlFor="businessProfile">Tipo de negocio</label>
      <select
        id="businessProfile"
        value={value?.profileId ?? ''}
        required
        onChange={(event) => onChange(defaultConfiguration(event.target.value as ProfileId))}
      >
        <option value="" disabled>
          Elige un perfil para comenzar
        </option>
        {Object.entries(profiles).map(([id, profile]) => (
          <option key={id} value={id}>
            {profile.name}
          </option>
        ))}
      </select>
      {value && (
        <section className="profile-preview" aria-label="Vista previa del perfil">
          <h3>{profiles[value.profileId].name}</h3>
          <p>{profiles[value.profileId].description}</p>
          <p>Siempre incluye ventas, gastos e informes en BOB.</p>
          <div className="tool-options">
            {Object.entries(toolLabels).map(([id, label]) => (
              <label key={id}>
                <input
                  type="checkbox"
                  checked={value.tools.includes(id as keyof typeof toolLabels)}
                  onChange={(event) =>
                    onChange(toggleTool(value, id as keyof typeof toolLabels, event.target.checked))
                  }
                />
                {label}
              </label>
            ))}
          </div>
          <small>
            Herramientas incluidas: las pantallas se cargan al abrirlas, sin un paquete adicional de
            rubro. Activar Compras también activa Inventario. Ocultarlas conserva todos tus
            registros.
          </small>
        </section>
      )}
      <details>
        <summary>Rubros especializados que vendrán después</summary>
        <p>
          Madera, ropa y calzado, electrodomésticos y fabricación necesitarán medidas, variantes,
          series o producción propias. Aún no están disponibles como módulos especializados.
        </p>
      </details>
    </fieldset>
  );
}
