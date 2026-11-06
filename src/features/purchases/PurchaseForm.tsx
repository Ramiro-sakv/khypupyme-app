import { stockUnits, specificationSummary } from '../../../shared/product-specification';
import { useState } from 'react';
import type { SubmitEvent } from 'react';
import { Link } from 'react-router';
import { Feedback } from '../../shared/components/Feedback';
import { formatBOB, parseBOB } from '../inventory/domain';
import type { Product } from '../inventory/domain';
import type { InventoryService } from '../inventory/InventoryService';
import { entryValue } from '../inventory/costing';
import { purchaseInput, todayInBolivia } from './domain';
import type { PurchaseInput } from './domain';
import { ProductSelector } from './ProductSelector';

export function PurchaseForm({
  uid,
  inventory,
  disabled,
  onSave,
  onCancel,
}: {
  uid: string;
  inventory: InventoryService;
  disabled: boolean;
  onSave: (input: PurchaseInput) => void;
  onCancel: () => void;
}) {
  const [product, setProduct] = useState<Product | null>(null);
  const [draft, setDraft] = useState<PurchaseInput | null>(null);
  const [error, setError] = useState('');
  function preview(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      if (!product) throw new Error('Selecciona un producto.');
      if (product.inventoryValueMinor === null)
        throw new Error('Registra primero el costo inicial en Inventario.');
      setDraft(
        purchaseInput({
          productId: product.id,
          quantity: Number(data.get('quantity')),
          unitCostMinor: parseBOB(String(data.get('unitCost'))),
          date: String(data.get('date')),
          reference: String(data.get('reference')),
        }),
      );
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Revisa la compra.');
    }
  }
  return (
    <section className="card inventory-editor" aria-label="Registrar compra">
      <h2 tabIndex={-1}>Registrar compra</h2>
      <p>Un producto por operación. El costo de compra es distinto del precio de venta.</p>
      <Feedback error={error} />
      <form onSubmit={preview} hidden={draft !== null}>
        <fieldset disabled={disabled}>
          <label htmlFor="purchaseProduct">Producto de la compra</label>
          <ProductSelector
            id="purchaseProduct"
            uid={uid}
            service={inventory}
            selected={product}
            onChange={setProduct}
            disabled={disabled}
          />
          {product?.inventoryValueMinor === null && (
            <p>
              Costo pendiente. <Link to="/inventario">Registrar costo inicial en Inventario</Link>
            </p>
          )}
          {product?.specification && (
            <p>
              Compra por {stockUnits(product.specification)}.{' '}
              {specificationSummary(product.specification)}
            </p>
          )}
          <label htmlFor="purchaseQuantity">Cantidad comprada</label>
          <input
            id="purchaseQuantity"
            name="quantity"
            type="number"
            min={1}
            max={1_000_000}
            step={1}
            required
          />
          <label htmlFor="unitCost">Costo unitario de compra (BOB)</label>
          <input id="unitCost" name="unitCost" inputMode="decimal" required />
          <label htmlFor="purchaseDate">Fecha de compra</label>
          <input
            id="purchaseDate"
            name="date"
            type="date"
            min="2000-01-01"
            max="2099-12-31"
            defaultValue={todayInBolivia()}
            required
          />
          <label htmlFor="reference">Referencia (opcional)</label>
          <input id="reference" name="reference" maxLength={100} defaultValue="" />
          <button
            className="primary"
            disabled={disabled || !product || product.inventoryValueMinor === null}
          >
            Revisar compra
          </button>
        </fieldset>
      </form>
      {draft && (
        <section aria-label="Confirmación de compra">
          <h3>Revisa antes de guardar</h3>
          <p>
            {product?.name}: {draft.quantity} {stockUnits(product?.specification)} a{' '}
            {formatBOB(draft.unitCostMinor)}.
          </p>
          <p>
            Total: <strong>{formatBOB(entryValue(draft.quantity, draft.unitCostMinor))}</strong>
          </p>
          <p>
            Fecha: {draft.date}. Referencia: {draft.reference || 'Sin referencia'}.
          </p>
          <div className="inventory-actions">
            <button className="primary" disabled={disabled} onClick={() => onSave(draft)}>
              Confirmar compra
            </button>
            <button disabled={disabled} onClick={() => setDraft(null)}>
              Corregir compra
            </button>
          </div>
        </section>
      )}
      <button type="button" disabled={disabled} onClick={onCancel}>
        Cerrar formulario
      </button>
    </section>
  );
}
