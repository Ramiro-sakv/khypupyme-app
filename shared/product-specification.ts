export type SpecificationKind =
  'general' | 'timber' | 'apparel' | 'appliance' | 'perishable' | 'ceramic' | 'cement';
export type StockUnit = 'unit' | 'piece' | 'pair' | 'box' | 'bag';
export interface ProductSpecification {
  version: 1;
  kind: SpecificationKind;
  unit: StockUnit;
  attributes: Record<string, string | number>;
}
interface Field {
  key: string;
  label: string;
  type: 'text' | 'integer' | 'date';
  min: number;
  max: number;
}
const text = (key: string, label: string, min = 1, max = 40): Field => ({
  key,
  label,
  type: 'text',
  min,
  max,
});
const number = (key: string, label: string, min: number, max: number): Field => ({
  key,
  label,
  type: 'integer',
  min,
  max,
});
const date = (required: boolean): Field => ({
  key: 'expiresOn',
  label: 'Vencimiento',
  type: 'date',
  min: required ? 10 : 0,
  max: 10,
});
export const SPECIFICATIONS: Record<
  SpecificationKind,
  { name: string; units: StockUnit[]; fields: Field[]; help: string }
> = {
  general: {
    name: 'Producto por unidad de venta',
    units: ['unit', 'piece', 'pair', 'box', 'bag'],
    fields: [text('reference', 'Referencia', 0)],
    help: 'La unidad elegida se usa en existencias, compras y ventas. No se convierte automáticamente.',
  },
  timber: {
    name: 'Madera por pieza',
    units: ['piece'],
    fields: [
      text('species', 'Especie de madera', 2),
      number('lengthMm', 'Largo (mm)', 1, 100000),
      number('widthMm', 'Ancho (mm)', 1, 2000),
      number('thicknessMm', 'Espesor (mm)', 1, 2000),
    ],
    help: 'Cada medida es un producto distinto. Precio y costo por pieza completa; el volumen es informativo. Sin cortes ni venta por metro.',
  },
  apparel: {
    name: 'Ropa o calzado por variante',
    units: ['piece', 'pair'],
    fields: [
      text('reference', 'Referencia', 0),
      text('size', 'Talla', 1, 20),
      text('color', 'Color', 1, 30),
    ],
    help: 'Registra cada combinación de talla y color como un producto separado, con existencias y precio propios.',
  },
  appliance: {
    name: 'Equipo por modelo',
    units: ['piece'],
    fields: [
      text('brand', 'Marca', 2),
      text('model', 'Modelo'),
      number('warrantyMonths', 'Garantía declarada (meses)', 0, 120),
    ],
    help: 'Se guarda el plazo declarado con la venta. No administra series individuales, reparaciones ni reclamos de garantía.',
  },
  perishable: {
    name: 'Producto por lote',
    units: ['unit'],
    fields: [text('barcode', 'Código de referencia o barras', 0), text('lot', 'Lote'), date(true)],
    help: 'Cada lote y vencimiento se registra como un producto distinto. Las ventas de lotes vencidos se rechazan; no se elige el lote automáticamente.',
  },
  ceramic: {
    name: 'Cerámica por caja',
    units: ['box'],
    fields: [
      text('reference', 'Referencia', 2),
      text('tone', 'Tono', 1, 30),
      text('caliber', 'Calibre', 1, 30),
      number('coverageCm2', 'Cobertura por caja (cm²)', 1, 1000000),
      number('piecesPerBox', 'Piezas por caja', 1, 1000),
    ],
    help: 'Stock, precio y costo por caja completa. Ejemplo: 1,44 m² = 14400 cm². No mezcla tonos ni vende cajas fraccionadas.',
  },
  cement: {
    name: 'Cemento por bolsa',
    units: ['bag'],
    fields: [
      text('brand', 'Marca', 2),
      text('grade', 'Tipo o resistencia'),
      number('weightGrams', 'Peso por bolsa (g)', 1, 1000000),
      text('lot', 'Lote'),
      date(false),
    ],
    help: 'Precio y costo por bolsa completa. Ejemplo: 50 kg = 50000 g. El vencimiento es opcional; no certifica condiciones de almacenamiento.',
  },
};
export const UNIT_LABELS: Record<StockUnit, string> = {
  unit: 'unidades',
  piece: 'piezas',
  pair: 'pares',
  box: 'cajas',
  bag: 'bolsas',
};
export function validCalendarDate(value: string): boolean {
  return (
    /^20\d{2}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function validateSpecification(value: unknown): ProductSpecification {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Ficha del producto inválida.');
  const data = value as Record<string, unknown>,
    kind = data.kind as SpecificationKind;
  if (
    Object.keys(data).length !== 4 ||
    !['version', 'kind', 'unit', 'attributes'].every((key) => Object.hasOwn(data, key)) ||
    data.version !== 1 ||
    !Object.hasOwn(SPECIFICATIONS, kind)
  )
    throw new Error('Modelo de ficha desconocido.');
  const schema = SPECIFICATIONS[kind],
    attrs = data.attributes;
  if (
    !schema.units.includes(data.unit as StockUnit) ||
    !attrs ||
    typeof attrs !== 'object' ||
    Array.isArray(attrs)
  )
    throw new Error('Unidad o atributos incompatibles con el modelo.');
  const input = attrs as Record<string, unknown>,
    attributes: ProductSpecification['attributes'] = {};
  if (
    Object.keys(input).length !== schema.fields.length ||
    schema.fields.some((field) => !Object.hasOwn(input, field.key))
  )
    throw new Error('La ficha contiene campos desconocidos o incompletos.');
  for (const field of schema.fields) {
    const raw = input[field.key];
    if (field.type === 'integer') {
      if (
        typeof raw !== 'number' ||
        !Number.isSafeInteger(raw) ||
        raw < field.min ||
        raw > field.max
      )
        throw new Error(`${field.label}: usa un entero entre ${field.min} y ${field.max}.`);
      attributes[field.key] = raw;
    } else {
      if (typeof raw !== 'string') throw new Error(`${field.label}: texto inválido.`);
      const result = raw.trim();
      if (
        result.length < field.min ||
        result.length > field.max ||
        /[\r\n]/.test(result) ||
        (field.type === 'date' && result !== '' && !validCalendarDate(result))
      )
        throw new Error(`${field.label}: revisa el valor.`);
      attributes[field.key] = result;
    }
  }
  return { version: 1, kind, unit: data.unit as StockUnit, attributes };
}
export function stockUnits(specification?: ProductSpecification): string {
  return UNIT_LABELS[specification?.unit ?? 'unit'];
}
export function specificationSummary(specification?: ProductSpecification): string {
  if (!specification) return '';
  return SPECIFICATIONS[specification.kind].fields
    .map((field) => {
      const value = specification.attributes[field.key];
      return value === '' ? '' : `${field.label}: ${value}`;
    })
    .filter(Boolean)
    .join(' · ');
}
export function expired(
  specification: ProductSpecification | undefined,
  currentDate: string,
): boolean {
  const expiration = specification?.attributes.expiresOn;
  return typeof expiration === 'string' && expiration !== '' && expiration < currentDate;
}
function fixed(value: bigint, divisor: bigint, digits: number): string {
  const scale = 10n ** BigInt(digits),
    rounded = (value * scale + divisor / 2n) / divisor;
  return `${rounded / scale},${String(rounded % scale).padStart(digits, '0')}`;
}
export function materialQuantity(
  specification: ProductSpecification | undefined,
  quantity: number,
): string {
  if (!specification) return '';
  if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 1000000)
    throw new Error('Cantidad inválida.');
  const a = specification.attributes,
    n = BigInt(quantity);
  if (specification.kind === 'timber')
    return `${fixed(n * BigInt(a.lengthMm!) * BigInt(a.widthMm!) * BigInt(a.thicknessMm!), 1000000000n, 6)} m³`;
  if (specification.kind === 'ceramic')
    return `${fixed(n * BigInt(a.coverageCm2!), 10000n, 4)} m² · ${n * BigInt(a.piecesPerBox!)} piezas`;
  if (specification.kind === 'cement') return `${fixed(n * BigInt(a.weightGrams!), 1000n, 3)} kg`;
  return '';
}
export function boxesForArea(
  areaM2: string,
  wastePercent: number,
  specification: ProductSpecification,
): number {
  if (
    specification.kind !== 'ceramic' ||
    !/^\d{1,8}([.,]\d{1,4})?$/.test(areaM2) ||
    !Number.isInteger(wastePercent) ||
    wastePercent < 0 ||
    wastePercent > 30
  )
    throw new Error('Usa un área positiva con hasta cuatro decimales y merma entre 0 y 30 %.');
  const [whole, fraction = ''] = areaM2.replace(',', '.').split('.');
  const area = BigInt(whole!) * 10000n + BigInt(fraction.padEnd(4, '0'));
  const numerator = area * BigInt(100 + wastePercent),
    denominator = BigInt(specification.attributes.coverageCm2!) * 100n;
  const boxes = (numerator + denominator - 1n) / denominator;
  if (boxes < 1n || boxes > 1000000n) throw new Error('El cálculo supera los límites de cantidad.');
  return Number(boxes);
}
