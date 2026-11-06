import { useState } from 'react';
import type { DateFilter } from '../../../shared/commerce';
import { period, today } from '../../../shared/commerce';
import { Feedback } from '../../shared/components/Feedback';
import { useOnline } from '../../shared/hooks/useOnline';
import type { useCommerceCommand } from './useCommerce';
import { commandNames, paymentNames } from './presentation';

export function MethodSelect({
  credit = false,
  name = 'method',
}: {
  credit?: boolean;
  name?: string;
}) {
  return (
    <>
      <label htmlFor={name}>Forma de pago</label>
      <select id={name} name={name}>
        {Object.entries(paymentNames)
          .filter(([key]) => credit || key !== 'credit')
          .map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
      </select>
    </>
  );
}
export function DateInput() {
  return (
    <>
      <label htmlFor="date">Fecha</label>
      <input
        id="date"
        name="date"
        type="date"
        defaultValue={today()}
        max={today()}
        min="2000-01-01"
        required
      />
    </>
  );
}
export function PeriodPicker({
  value,
  onChange,
}: {
  value: DateFilter;
  onChange: (value: DateFilter) => void;
}) {
  const [error, setError] = useState('');
  return (
    <form
      className="period-picker"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        try {
          const filter = period({ from: String(form.get('from')), to: String(form.get('to')) });
          setError('');
          onChange(filter);
        } catch (cause) {
          setError((cause as Error).message);
        }
      }}
    >
      <div>
        <label htmlFor="from">Desde</label>
        <input type="date" id="from" name="from" defaultValue={value.from} required />
      </div>
      <div>
        <label htmlFor="to">Hasta</label>
        <input type="date" id="to" name="to" defaultValue={value.to} required />
      </div>
      <button>Aplicar periodo</button>
      <Feedback error={error} />
    </form>
  );
}
export function OperationFeedback({
  operation,
  message,
}: {
  operation: ReturnType<typeof useCommerceCommand>;
  message: string;
}) {
  const online = useOnline();
  return (
    <>
      <Feedback error={operation.error} message={message} />
      {operation.pending && (
        <aside className="pending-operation" aria-label="Operación pendiente">
          <h3>Confirma la solicitud anterior</h3>
          <p>
            Operación: {commandNames[operation.pending.kind] ?? 'Solicitud guardada'}. Se conservan
            sus datos para evitar duplicados. Consulta su estado antes de reintentar.
          </p>
          <div className="actions">
            <button disabled={operation.busy || !online} onClick={() => void operation.consult()}>
              Consultar operación
            </button>
            <button
              disabled={operation.busy || !online || !operation.retryAllowed}
              onClick={() => void operation.execute(operation.pending!)}
            >
              Reintentar misma solicitud
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
