import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { specifications } from '../../../tests/fixtures/product-specifications';
import {
  boxesForArea,
  expired,
  materialQuantity,
  validateSpecification,
} from '../../../shared/product-specification';
import { createProduct, InventoryInputError } from './domain';
import { ProductForm } from './ProductForm';
import { MaterialCalculator } from './MaterialCalculator';
it.each(Object.values(specifications))('valida y conserva la ficha $kind', (specification) =>
  expect(validateSpecification(specification)).toEqual(specification),
);
it.each([
  null,
  { ...specifications.timber, unit: 'box' },
  { ...specifications.general, version: 2 },
  { ...specifications.general, kind: 'constructor' },
  { ...specifications.general, ownerUid: 'B' },
  { ...specifications.timber, attributes: { ...specifications.timber.attributes, lengthMm: 1.5 } },
  { ...specifications.timber, attributes: { ...specifications.timber.attributes, thicknessMm: 0 } },
  { ...specifications.timber, attributes: { ...specifications.timber.attributes, widthMm: 2001 } },
  {
    ...specifications.appliance,
    attributes: { ...specifications.appliance.attributes, warrantyMonths: 121 },
  },
  { ...specifications.apparel, attributes: { size: 'M', color: 'Azul' } },
  {
    ...specifications.ceramic,
    attributes: { ...specifications.ceramic.attributes, coverageCm2: 0 },
  },
  {
    ...specifications.perishable,
    attributes: { ...specifications.perishable.attributes, expiresOn: '2026-02-30' },
  },
  {
    ...specifications.perishable,
    attributes: { ...specifications.perishable.attributes, expiresOn: '2026-2-01' },
  },
  { ...specifications.cement, attributes: { ...specifications.cement.attributes, priceMinor: 0 } },
])('rechaza fichas manipuladas %j', (input) =>
  expect(() => validateSpecification(input)).toThrow(),
);
it('calcula volumen, superficie y peso sin alterar stock ni dinero', () => {
  expect(materialQuantity(specifications.timber, 10)).toBe('0,150000 m³');
  expect(materialQuantity(specifications.ceramic, 4)).toBe('5,7600 m² · 16 piezas');
  expect(materialQuantity(specifications.cement, 10)).toBe('500,000 kg');
  expect(
    materialQuantity(
      {
        ...specifications.timber,
        attributes: { species: 'Pino', lengthMm: 100000, widthMm: 2000, thicknessMm: 2000 },
      },
      1000000,
    ),
  ).toBe('400000000,000000 m³');
  expect(boxesForArea('10', 10, specifications.ceramic)).toBe(8);
  expect(boxesForArea('1,44', 0, specifications.ceramic)).toBe(1);
  expect(boxesForArea('1,4401', 0, specifications.ceramic)).toBe(2);
});
it.each(['0', '-1', '1e3', '1.00001', '99999999'])(
  'rechaza área inválida o fuera de límites %s',
  (area) => expect(() => boxesForArea(area, 10, specifications.ceramic)).toThrow(),
);
it('respeta el día de vencimiento y los productos sin fecha', () => {
  expect(expired(specifications.perishable, '2099-12-31')).toBe(false);
  expect(expired(specifications.perishable, '2100-01-01')).toBe(true);
  expect(expired(specifications.cement, '2099-12-31')).toBe(false);
});
it('las validaciones de inventario preservan la ficha y rechazan un modelo inválido antes de escribir', () => {
  const input = {
    name: 'Piso',
    priceMinor: 1000,
    minimumStock: 1,
    stock: 10,
    initialUnitCostMinor: 500,
    specification: specifications.ceramic,
  };
  expect(createProduct(input).specification).toEqual(specifications.ceramic);
  expect(() =>
    createProduct({ ...input, specification: { ...specifications.ceramic, unit: 'bag' } }),
  ).toThrow(InventoryInputError);
});
it('guarda talla/color desde el formulario y conserva la unidad al editar', () => {
  const save = vi.fn();
  render(
    <ProductForm
      product={null}
      suggestedKind="apparel"
      footwear
      disabled={false}
      onSave={save}
      onCancel={() => {}}
    />,
  );
  fireEvent.change(screen.getByLabelText('Nombre del producto'), { target: { value: 'Zapato' } });
  fireEvent.change(screen.getByLabelText('Precio de venta (BOB)'), { target: { value: '50' } });
  fireEvent.change(screen.getByLabelText('Talla'), { target: { value: '38' } });
  fireEvent.change(screen.getByLabelText('Color'), { target: { value: 'Negro' } });
  fireEvent.click(screen.getByRole('button', { name: 'Crear producto' }));
  expect(save.mock.calls[0]?.[0].specification).toMatchObject({
    kind: 'apparel',
    unit: 'pair',
    attributes: { size: '38', color: 'Negro' },
  });
});
it('el cálculo de cerámica entrega cajas completas sin enviar una venta', () => {
  const quantity = vi.fn();
  render(<MaterialCalculator specification={specifications.ceramic} onQuantity={quantity} />);
  fireEvent.click(screen.getByText('Calcular cajas para un área'));
  fireEvent.change(screen.getByLabelText('Área a cubrir (m²)'), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: 'Usar cantidad calculada' }));
  expect(quantity).toHaveBeenCalledExactlyOnceWith(8);
});
