import { useState } from 'react';
import type { SubmitEvent } from 'react';
import { Feedback } from '../../shared/components/Feedback';
import { MAX_STOCK, stockChange } from './domain';
import type { Product, StockChange } from './domain';

export function MovementForm({ product, disabled, onSave, onCancel }: {
  product: Product; disabled: boolean; onSave: (input: StockChange) => void; onCancel: () => void;
}) {
  const [error, setError] = useState('');
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const data = new FormData(event.currentTarget);
    try {
      const input = stockChange({ kind: String(data.get('kind')) as StockChange['kind'], quantity: Number(data.get('quantity')), reason: String(data.get('reason')) });
      setError(''); onSave(input);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Revisa el movimiento.'); }
  }
  return <section className="card inventory-editor" aria-label="Registrar movimiento">
    <h2 tabIndex={-1}>Movimiento de {product.name}</h2><p>Existencia consultada: {product.stock} unidades. Se verificará nuevamente al guardar.</p>
    <form onSubmit={submit}><fieldset disabled={disabled}>
      <label htmlFor="kind">Tipo de movimiento</label><select id="kind" name="kind"><option value="entry">Entrada</option><option value="exit">Salida</option></select>
      <label htmlFor="quantity">Cantidad de unidades</label><input id="quantity" name="quantity" type="number" required min={1} max={MAX_STOCK} step={1} />
      <label htmlFor="reason">Motivo</label><input id="reason" name="reason" required minLength={3} maxLength={200} />
      <Feedback error={error} /><div className="inventory-actions"><button className="primary" type="submit">Guardar movimiento</button><button type="button" onClick={onCancel}>Cancelar</button></div>
    </fieldset></form>
  </section>;
}
