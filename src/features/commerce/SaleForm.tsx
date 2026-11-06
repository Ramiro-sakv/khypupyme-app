import { useState } from 'react';
import type { Command, FinancialRecord, SaleInput, SaleLineInput } from '../../../shared/commerce';
import type { Product } from '../inventory/domain';
import { formatBOB, parseBOB } from '../inventory/domain';
import type { InventoryService } from '../inventory/InventoryService';
import { ProductSelector } from '../purchases/ProductSelector';
import type { CommerceService } from './CommerceRepository';
import { CatalogPicker } from './CatalogPicker';
import { DateInput, MethodSelect } from './CommerceControls';
import { Feedback } from '../../shared/components/Feedback';
import { TOOL_IDS } from '../../../shared/business-configuration';
import type { ToolId } from '../../../shared/business-configuration';

export function SaleForm({
  uid,
  inventory,
  commerce,
  disabled,
  onReview,
  activity,
  tools = TOOL_IDS,
}: {
  uid: string;
  inventory: InventoryService;
  commerce: CommerceService;
  disabled: boolean;
  onReview: (command: Command) => void;
  activity: string;
  tools?: readonly ToolId[];
}) {
  const [kind, setKind] = useState<'product' | 'service' | 'custom'>(
    tools.includes('services') && (activity === 'services' || !tools.includes('inventory'))
      ? 'service'
      : tools.includes('inventory')
        ? 'product'
        : 'custom',
  );
  const [product, setProduct] = useState<Product | null>(null),
    [service, setService] = useState<FinancialRecord | null>(null),
    [customer, setCustomer] = useState<FinancialRecord | null>(null);
  const [lines, setLines] = useState<{ input: SaleLineInput; name: string; price: number }[]>([]),
    [error, setError] = useState('');
  function add(form: HTMLFormElement) {
    try {
      const data = new FormData(form),
        quantity = Number(data.get('quantity'));
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1_000_000)
        throw new Error('Cantidad: usa un entero entre 1 y 1.000.000.');
      if (lines.length >= 30) throw new Error('La venta admite hasta 30 líneas.');
      let input: SaleLineInput, name: string, price: number;
      if (kind === 'custom') {
        name = String(data.get('customName')).trim();
        if (name.length < 2 || name.length > 80)
          throw new Error('Indica un nombre de 2 a 80 caracteres.');
        price = parseBOB(String(data.get('customPrice')));
        input = {
          kind,
          name,
          quantity,
          priceMinor: price,
          unitCostMinor: parseBOB(String(data.get('customCost')), true),
        };
      } else {
        const item = kind === 'product' ? product : service;
        if (!item) throw new Error('Selecciona un producto o servicio.');
        if (
          kind === 'product' &&
          product &&
          (product.inventoryValueMinor === null || quantity > product.stock)
        )
          throw new Error('Revisa las existencias y registra el costo inicial del producto.');
        if (
          lines.some(
            (line) =>
              line.input.kind !== 'custom' &&
              line.input.itemId === item.id &&
              line.input.kind === kind,
          )
        )
          throw new Error('El artículo ya está agregado. Quítalo para cambiar su cantidad.');
        name = item.name!;
        price = item.priceMinor!;
        input = { kind, itemId: item.id, quantity, expectedPriceMinor: price };
      }
      setLines([...lines, { input, name, price }]);
      setError('');
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        try {
          const form = new FormData(event.currentTarget);
          if (!lines.length) throw new Error('Agrega al menos un artículo a la venta.');
          const input: SaleInput = {
            lines: lines.map((line) => line.input),
            date: String(form.get('date')),
            description: String(form.get('description')),
            discountMinor: parseBOB(String(form.get('discount')), true),
            payment: String(form.get('payment')) as SaleInput['payment'],
            customerId: customer?.id ?? '',
            customerName: customer?.name ?? String(form.get('customerName')),
          };
          if (
            input.discountMinor >=
            lines.reduce((total, line) => total + line.price * line.input.quantity, 0)
          )
            throw new Error('El descuento debe ser menor que el importe de la venta.');
          if (input.payment === 'credit' && input.customerName.trim().length < 2)
            throw new Error('Para fiar, selecciona un cliente o indica su nombre.');
          setError('');
          onReview({ kind: 'sale', operationId: crypto.randomUUID(), input });
        } catch (cause) {
          setError((cause as Error).message);
        }
      }}
    >
      <fieldset disabled={disabled}>
        <legend>Arma la venta</legend>
        <label htmlFor="lineKind">Tipo de artículo</label>
        <select
          id="lineKind"
          value={kind}
          onChange={(event) => setKind(event.target.value as typeof kind)}
        >
          {tools.includes('inventory') && <option value="product">Producto de inventario</option>}
          {tools.includes('services') && <option value="service">Servicio del catálogo</option>}
          <option value="custom">Servicio ocasional</option>
        </select>
        {kind === 'product' && (
          <>
            <label htmlFor="saleProduct">Producto</label>
            <ProductSelector
              uid={uid}
              service={inventory}
              selected={product}
              onChange={setProduct}
              disabled={disabled}
              id="saleProduct"
            />
            {product && (
              <small>
                {formatBOB(product.priceMinor)} · {product.stock} disponibles
              </small>
            )}
          </>
        )}
        {kind === 'service' && (
          <>
            <label>Servicio</label>
            <CatalogPicker
              resource="services"
              service={commerce}
              selected={service}
              onChange={setService}
            />
          </>
        )}
        {kind === 'custom' && (
          <div className="form-columns">
            <div>
              <label htmlFor="customName">Nombre del servicio</label>
              <input id="customName" name="customName" maxLength={80} />
            </div>
            <div>
              <label htmlFor="customPrice">Precio unitario (BOB)</label>
              <input id="customPrice" name="customPrice" inputMode="decimal" />
            </div>
            <div>
              <label htmlFor="customCost">Costo directo unitario (BOB)</label>
              <input id="customCost" name="customCost" inputMode="decimal" defaultValue="0" />
            </div>
          </div>
        )}
        <div className="form-columns">
          <div>
            <label htmlFor="quantity">Cantidad</label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              min="1"
              max="1000000"
              step="1"
              defaultValue="1"
            />
          </div>
          <button type="button" onClick={(event) => add(event.currentTarget.form!)}>
            Agregar a la venta
          </button>
        </div>
        <ul className="sale-lines">
          {lines.map((line, index) => (
            <li key={index}>
              <span>
                <strong>{line.name}</strong>
                <small>
                  {line.input.quantity} × {formatBOB(line.price)}
                </small>
              </span>
              <b>{formatBOB(line.price * line.input.quantity)}</b>
              <button
                type="button"
                aria-label={`Quitar ${line.name}`}
                onClick={() => setLines(lines.filter((_, i) => i !== index))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <p className="sale-total">
          Subtotal{' '}
          <strong>
            {formatBOB(lines.reduce((total, line) => total + line.price * line.input.quantity, 0))}
          </strong>
        </p>
        <label htmlFor="discount">Descuento total (BOB)</label>
        <input id="discount" name="discount" inputMode="decimal" defaultValue="0" required />
        {tools.includes('customers') && (
          <>
            <label>Cliente registrado (opcional)</label>
            <CatalogPicker
              resource="customers"
              service={commerce}
              selected={customer}
              onChange={setCustomer}
            />
          </>
        )}
        <label htmlFor="customerName">Nombre del cliente</label>
        <input
          id="customerName"
          name="customerName"
          maxLength={80}
          placeholder="Obligatorio si la venta es fiada"
          disabled={!!customer}
        />
        <div className="form-columns">
          <div>
            <DateInput />
          </div>
          <div>
            <MethodSelect credit={tools.includes('receivables')} name="payment" />
          </div>
        </div>
        <label htmlFor="description">Nota (opcional)</label>
        <input id="description" name="description" maxLength={200} />
        <Feedback error={error} />
        <button className="primary" disabled={!lines.length}>
          Revisar venta
        </button>
      </fieldset>
    </form>
  );
}
