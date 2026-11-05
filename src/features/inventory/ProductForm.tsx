import { useState } from 'react';
import type { SubmitEvent } from 'react';
import { Feedback } from '../../shared/components/Feedback';
import { integer, MAX_STOCK, parseBOB, productDetails } from './domain';
import type { CreateProduct, Product } from './domain';

export function ProductForm({ product, disabled, onSave, onCancel }: {
  product: Product | null; disabled: boolean;
  onSave: (input: CreateProduct) => void; onCancel: () => void;
}) {
  const [error, setError] = useState('');
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const data = new FormData(event.currentTarget);
    try {
      const stock = product?.stock ?? integer(Number(data.get('stock')), 0, MAX_STOCK, 'Existencia inicial');
      const input = {
        ...productDetails({ name: String(data.get('productName')), priceMinor: parseBOB(String(data.get('price'))), minimumStock: Number(data.get('minimum')) }),
        stock,
        ...(!product ? { initialUnitCostMinor: stock === 0 && !data.get('initialCost') ? 0 : parseBOB(String(data.get('initialCost')), true) } : {}),
      };
      setError(''); onSave(input);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Revisa los datos.'); }
  }
  return <section className="card inventory-editor" aria-label={product ? 'Editar producto' : 'Nuevo producto'}>
    <h2 tabIndex={-1}>{product ? 'Editar producto' : 'Nuevo producto'}</h2>
    <form onSubmit={submit}>
      <fieldset disabled={disabled}>
        <label htmlFor="productName">Nombre del producto</label>
        <input id="productName" name="productName" defaultValue={product?.name ?? ''} required minLength={2} maxLength={80} />
        <label htmlFor="price">Precio de venta (BOB)</label>
        <input id="price" name="price" inputMode="decimal" defaultValue={product ? (product.priceMinor / 100).toFixed(2) : ''} required aria-describedby="price-help" />
        <small id="price-help">Hasta dos decimales. Ejemplo: 12,50. Sin separadores de miles.</small>
        {!product && <><label htmlFor="stock">Existencia inicial</label><input id="stock" name="stock" type="number" defaultValue="0" required min={0} max={MAX_STOCK} step={1} /></>}
        {!product && <><label htmlFor="initialCost">Costo unitario inicial (BOB)</label><input id="initialCost" name="initialCost" inputMode="decimal" /><small>Obligatorio si hay existencias. Escribe 0 si las recibiste sin costo. Este importe valora el stock; no registra una compra histórica.</small></>}
        <label htmlFor="minimum">Existencia mínima</label>
        <input id="minimum" name="minimum" type="number" defaultValue={product?.minimumStock ?? 0} required min={0} max={MAX_STOCK} step={1} />
        <Feedback error={error} />
        <div className="inventory-actions"><button className="primary" type="submit">{product ? 'Guardar producto' : 'Crear producto'}</button><button type="button" onClick={onCancel}>Cancelar</button></div>
      </fieldset>
    </form>
  </section>;
}
