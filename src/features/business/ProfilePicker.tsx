import type { BusinessConfiguration, ProfileId } from '../../../shared/business-configuration';
import {
  defaultConfiguration,
  industryConfiguration,
  toggleTool,
} from '../../../shared/business-configuration';

import { INDUSTRIES, INDUSTRY_IDS, industry } from '../../../shared/business-industries';
import type { IndustryId } from '../../../shared/business-industries';

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
        value={value?.industryId ? `industry:${value.industryId}` : (value?.profileId ?? '')}
        required
        onChange={(event) =>
          onChange(
            event.target.value.startsWith('industry:')
              ? industryConfiguration(event.target.value.slice(9) as IndustryId)
              : defaultConfiguration(event.target.value as ProfileId),
          )
        }
      >
        <option value="" disabled>
          Elige un perfil para comenzar
        </option>
        {[...new Set(INDUSTRY_IDS.map((id) => INDUSTRIES[id].group))].map((group) => (
          <optgroup key={group} label={group}>
            {INDUSTRY_IDS.filter((id) => INDUSTRIES[id].group === group).map((id) => (
              <option key={id} value={`industry:${id}`}>
                {INDUSTRIES[id].name}
              </option>
            ))}
          </optgroup>
        ))}
        {Object.entries(profiles).map(([id, profile]) => (
          <option key={id} value={id}>
            {profile.name}
          </option>
        ))}
      </select>
      {value && (
        <section className="profile-preview" aria-label="Vista previa del perfil">
          <h3>{industry(value.industryId)?.name ?? profiles[value.profileId].name}</h3>
          <p>{industry(value.industryId)?.description ?? profiles[value.profileId].description}</p>
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
        <summary>Otros modelos de trabajo</summary>
        <p>
          Restaurantes con mesas y recetas, fabricación con materias primas, alquileres y hospedaje
          necesitan operaciones distintas. No se ofrecen como modelos completos en esta beta. Si tu
          rubro no aparece, elige Tienda y comercio, Servicios o Comercio y servicios para usar el
          núcleo común.
        </p>
      </details>
    </fieldset>
  );
}
