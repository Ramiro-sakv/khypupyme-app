import type { FinancialRecord } from '../../../shared/commerce';
import type { CommerceService } from './CommerceRepository';
import { useRecords } from './useCommerce';
import { Feedback } from '../../shared/components/Feedback';

export function CatalogPicker({
  service,
  resource,
  selected,
  onChange,
  disabled = false,
}: {
  service: CommerceService;
  resource: 'customers' | 'services';
  selected: FinancialRecord | null;
  onChange: (item: FinancialRecord | null) => void;
  disabled?: boolean;
}) {
  const page = useRecords(service, resource),
    items = page.items.filter((item) => item.active);
  return (
    <>
      <select
        aria-label={resource === 'customers' ? 'Cliente registrado' : 'Servicio del catálogo'}
        value={selected?.id ?? ''}
        disabled={disabled || page.loading}
        onChange={(event) => onChange(items.find((item) => item.id === event.target.value) ?? null)}
      >
        <option value="">
          {resource === 'customers' ? 'Sin cliente registrado' : 'Selecciona un servicio'}
        </option>
        {selected && !items.some((item) => item.id === selected.id) && (
          <option value={selected.id}>{selected.name}</option>
        )}
        {items.map((item) => (
          <option value={item.id} key={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      <Feedback error={page.error} />
      {page.loading && <p role="status">Consultando catálogo…</p>}
      <div className="actions">
        {page.hasPrevious && (
          <button type="button" onClick={page.firstPage}>
            Inicio del catálogo
          </button>
        )}
        {page.next && (
          <button type="button" onClick={page.nextPage}>
            Más opciones
          </button>
        )}
        {page.error && (
          <button type="button" onClick={page.refresh}>
            Consultar catálogo
          </button>
        )}
      </div>
    </>
  );
}
