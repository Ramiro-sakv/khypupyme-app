import { stockUnits } from '../../../shared/product-specification';
import { useState } from 'react';
import type { SubmitEvent } from 'react';
import { Feedback } from '../../shared/components/Feedback';
import { formatBOB, parseBOB } from './domain';
import type { Product } from './domain';
import { entryValue } from './costing';

export function ValuationForm({
  product,
  disabled,
  onSave,
  onCancel,
}: {
  product: Product;
  disabled: boolean;
  onSave: (unitCostMinor: number) => void;
  onCancel: () => void;
}) {
  const [cost, setCost] = useState<number | null>(null);
  const [error, setError] = useState('');
  function preview(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const value = parseBOB(String(new FormData(event.currentTarget).get('cost')), true);
      entryValue(product.stock, value);
      setCost(value);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Revisa el costo.');
    }
  }
  return (
    <section className="card inventory-editor" aria-label="Valoración inicial">
      <h2 tabIndex={-1}>Costo inicial de {product.name}</h2>
      <p>
        Este producto es anterior al costeo. Registra el costo de las {product.stock}{' '}
        {stockUnits(product.specification)} existentes. No se creará una compra histórica.
      </p>
      <Feedback error={error} />
      {cost === null ? (
        <form onSubmit={preview}>
          <fieldset disabled={disabled}>
            <label htmlFor="cost">Costo unitario de las existencias (BOB)</label>
            <input id="cost" name="cost" inputMode="decimal" required />
            <small>Escribe 0 solo si confirmas que estas existencias no tuvieron costo.</small>
            <button className="primary">Revisar valoración</button>
          </fieldset>
        </form>
      ) : (
        <>
          <p>
            Valor inicial: <strong>{formatBOB(entryValue(product.stock, cost))}</strong>. Se
            comprobará la existencia actual al confirmar.
          </p>
          <div className="inventory-actions">
            <button className="primary" disabled={disabled} onClick={() => onSave(cost)}>
              Confirmar costo inicial
            </button>
            <button disabled={disabled} onClick={() => setCost(null)}>
              Corregir costo
            </button>
          </div>
        </>
      )}
      <button disabled={disabled} onClick={onCancel}>
        Cerrar valoración
      </button>
    </section>
  );
}
