import type { SalePreviewLine } from './presentation';
import { specificationSummary, stockUnits } from '../../../shared/product-specification';
import type { Command, FinancialRecord } from '../../../shared/commerce';
import { formatBOB } from '../inventory/domain';
import { paymentNames } from './presentation';

export function CommandReview({
  command,
  onConfirm,
  onBack,
  busy,
  record = null,
  salePreview = [],
}: {
  command: Command;
  salePreview?: SalePreviewLine[];
  onConfirm: () => void;
  onBack: () => void;
  busy: boolean;
  record?: FinancialRecord | null;
}) {
  const input = command.input;
  let total: number | null =
    'amountMinor' in input
      ? input.amountMinor
      : (record?.amountMinor ?? record?.totalMinor ?? null);
  if (command.kind === 'sale')
    total =
      command.input.lines.reduce(
        (sum, line) =>
          sum +
          line.quantity * (line.kind === 'custom' ? line.priceMinor : line.expectedPriceMinor),
        0,
      ) - command.input.discountMinor;
  return (
    <section className="review-card" aria-label="Confirmar operación">
      <h2>Revisa antes de guardar</h2>
      {total !== null && <p className="hero-number">{formatBOB(total)}</p>}
      {command.kind === 'sale' && (
        <>
          <ul>
            {command.input.lines.map((line, i) => (
              <li key={i}>
                {line.quantity}{' '}
                {salePreview[i]?.specification ? stockUnits(salePreview[i]!.specification) : ''} ×{' '}
                {salePreview[i]?.name ??
                  (line.kind === 'custom'
                    ? line.name
                    : line.kind === 'product'
                      ? `Producto del catálogo (${line.itemId})`
                      : `Servicio del catálogo (${line.itemId})`)}{' '}
                · {formatBOB(line.kind === 'custom' ? line.priceMinor : line.expectedPriceMinor)}
                {salePreview[i]?.specification && (
                  <p>{specificationSummary(salePreview[i]!.specification)}</p>
                )}
              </li>
            ))}
          </ul>
          <p>
            Descuento: {formatBOB(command.input.discountMinor)} ·{' '}
            {paymentNames[command.input.payment]}
          </p>
          {command.input.payment === 'credit' && (
            <p>Se creará un fiado pendiente. No se registrará dinero recibido.</p>
          )}
        </>
      )}
      {'name' in input && (
        <p>
          <strong>{input.name}</strong>
          {'active' in input && !input.active ? ' · Se archivará' : ''}
        </p>
      )}
      {'priceMinor' in input && (
        <p>
          Precio: {formatBOB(input.priceMinor)} · Costo directo: {formatBOB(input.unitCostMinor)}
        </p>
      )}
      {'customerName' in input && input.customerName && <p>Cliente: {input.customerName}</p>}
      {'date' in input && <p>Fecha: {input.date}</p>}
      {'description' in input && <p>{input.description}</p>}
      {'reason' in input && <p>Motivo: {input.reason}</p>}
      {command.kind === 'collect' && (
        <p>
          Se registrará el cobro completo una sola vez, por{' '}
          {paymentNames[command.input.method].toLowerCase()}.
        </p>
      )}
      {command.kind.startsWith('cancel-') && (
        <p>
          El registro quedará anulado y conservará su historial. Si ya se había cobrado o pagado, se
          registrará la devolución completa con fecha de hoy.
        </p>
      )}
      <div className="actions">
        <button type="button" className="primary" disabled={busy} onClick={onConfirm}>
          {busy ? 'Confirmando…' : 'Confirmar y guardar'}
        </button>
        <button type="button" disabled={busy} onClick={onBack}>
          Volver a editar
        </button>
      </div>
    </section>
  );
}
