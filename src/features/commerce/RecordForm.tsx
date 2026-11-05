import { useState } from 'react';
import type { Command, FinancialRecord, PaymentMethod, Resource } from '../../../shared/commerce';
import { parseBOB } from '../inventory/domain';
import { Feedback } from '../../shared/components/Feedback';
import { DateInput, MethodSelect } from './CommerceControls';
import type { CommerceService } from './CommerceRepository';
import { CatalogPicker } from './CatalogPicker';

export function RecordForm({
  resource,
  record,
  service,
  onReview,
  disabled,
}: {
  resource: Exclude<Resource, 'sales'>;
  record: FinancialRecord | null;
  service: CommerceService;
  onReview: (command: Command) => void;
  disabled: boolean;
}) {
  const [customer, setCustomer] = useState<FinancialRecord | null>(null),
    [error, setError] = useState('');
  const catalog = resource === 'customers' || resource === 'services';
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget),
          value = (key: string) => String(form.get(key) ?? '');
        try {
          let command: Command;
          const operationId = crypto.randomUUID();
          switch (resource) {
            case 'expenses':
              command = {
                operationId,
                kind: 'expense',
                input: {
                  amountMinor: parseBOB(value('amount')),
                  category: value('category'),
                  date: value('date'),
                  description: value('description'),
                  method: value('method') as PaymentMethod,
                },
              };
              break;
            case 'receivables':
              command = {
                operationId,
                kind: 'receivable',
                input: {
                  amountMinor: parseBOB(value('amount')),
                  date: value('date'),
                  customerId: customer?.id ?? '',
                  customerName: customer?.name ?? value('name'),
                  description: value('description'),
                },
              };
              break;
            case 'customers':
              command = {
                operationId,
                kind: 'customer',
                input: {
                  id: record?.id ?? '',
                  name: value('name'),
                  phone: value('phone'),
                  notes: value('notes'),
                  active: record?.active ?? true,
                },
              };
              break;
            case 'services':
              command = {
                operationId,
                kind: 'service',
                input: {
                  id: record?.id ?? '',
                  name: value('name'),
                  priceMinor: parseBOB(value('price')),
                  unitCostMinor: parseBOB(value('cost'), true),
                  active: record?.active ?? true,
                },
              };
              break;
          }
          setError('');
          onReview(command);
        } catch (cause) {
          setError((cause as Error).message);
        }
      }}
    >
      <fieldset disabled={disabled}>
        {resource === 'receivables' && (
          <>
            <p className="empty-notice">
              Registra aquí una deuda anterior. No crea una venta ni aumenta tus ingresos. Para una
              venta nueva, usa Ventas → Fiado.
            </p>
            <label>Cliente registrado (opcional)</label>
            <CatalogPicker
              resource="customers"
              service={service}
              selected={customer}
              onChange={setCustomer}
            />
          </>
        )}
        {(catalog || resource === 'receivables') && (
          <>
            <label htmlFor="recordName">
              {resource === 'services' ? 'Nombre del servicio' : 'Nombre del cliente'}
            </label>
            <input
              id="recordName"
              name="name"
              minLength={2}
              maxLength={80}
              required={!customer}
              disabled={!!customer}
              defaultValue={record?.name ?? ''}
            />
          </>
        )}
        {resource === 'customers' && (
          <>
            <label htmlFor="phone">Teléfono (opcional)</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              maxLength={30}
              defaultValue={record?.phone ?? ''}
            />
            <label htmlFor="notes">Nota (opcional)</label>
            <input id="notes" name="notes" maxLength={200} defaultValue={record?.notes ?? ''} />
          </>
        )}
        {resource === 'services' && (
          <div className="form-columns">
            <div>
              <label htmlFor="servicePrice">Precio (BOB)</label>
              <input
                id="servicePrice"
                name="price"
                inputMode="decimal"
                required
                defaultValue={record ? (record.priceMinor! / 100).toFixed(2) : ''}
              />
            </div>
            <div>
              <label htmlFor="serviceCost">Costo directo unitario (BOB)</label>
              <input
                id="serviceCost"
                name="cost"
                inputMode="decimal"
                required
                defaultValue={record ? (record.unitCostMinor! / 100).toFixed(2) : '0'}
              />
            </div>
          </div>
        )}
        {!catalog && (
          <>
            <label htmlFor="amount">Importe (BOB)</label>
            <input id="amount" name="amount" inputMode="decimal" required />
            <DateInput />
            <label htmlFor="description">Descripción</label>
            <input id="description" name="description" minLength={3} maxLength={200} required />
          </>
        )}
        {resource === 'expenses' && (
          <>
            <label htmlFor="category">Categoría</label>
            <select id="category" name="category">
              {[
                'Alquiler',
                'Servicios básicos',
                'Transporte',
                'Personal',
                'Mantenimiento',
                'Otros',
              ].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <MethodSelect />
            <small>
              Las compras de mercadería se registran en Compras, para no duplicar el costo del
              inventario.
            </small>
          </>
        )}
        <Feedback error={error} />
        <button className="primary">Revisar {record ? 'cambios' : 'registro'}</button>
      </fieldset>
    </form>
  );
}
