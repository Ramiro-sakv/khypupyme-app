import type { SpecificationKind } from './product-specification.js';

// Rubro comercial y forma de trabajo son conceptos distintos; no son códigos CAEB.
export const INDUSTRIES = {
  convenience: {
    name: 'Tienda de barrio / 24 horas',
    group: 'Alimentos y consumo',
    profile: 'retail',
    productKind: 'perishable',
    description:
      'Venta por unidad, lotes, vencimientos y reposición. Cada lote mantiene su propio stock.',
  },
  grocery: {
    name: 'Abarrotes y minimercado',
    group: 'Alimentos y consumo',
    profile: 'retail',
    productKind: 'perishable',
    description: 'Productos envasados por unidad y lote. No incluye venta a granel por peso.',
  },
  beverages: {
    name: 'Bebidas y distribuidora',
    group: 'Alimentos y consumo',
    profile: 'retail',
    productKind: 'perishable',
    description: 'Venta de unidades envasadas, lotes, compras y cobros. Sin envases retornables.',
  },
  clothing: {
    name: 'Ropa y accesorios',
    group: 'Moda y hogar',
    profile: 'retail',
    productKind: 'apparel',
    description: 'Cada talla y color tiene un producto, precio y existencias propios.',
  },
  footwear: {
    name: 'Calzado',
    group: 'Moda y hogar',
    profile: 'retail',
    productKind: 'apparel',
    description:
      'Existencias por par, talla, color y referencia; cada variante se registra por separado.',
  },
  furniture: {
    name: 'Muebles y decoración',
    group: 'Moda y hogar',
    profile: 'retail',
    productKind: 'general',
    description:
      'Catálogo de piezas terminadas, compras, costos y ventas. Sin fabricación a medida.',
  },
  cosmetics: {
    name: 'Cosméticos y cuidado personal',
    group: 'Moda y hogar',
    profile: 'retail',
    productKind: 'perishable',
    description: 'Productos por unidad, lote y vencimiento; sin datos clínicos.',
  },
  timber: {
    name: 'Maderas y barraca',
    group: 'Construcción y materiales',
    profile: 'retail',
    productKind: 'timber',
    description:
      'Piezas por especie y medidas en milímetros; cálculo del volumen disponible en m³. Precio por pieza.',
  },
  ceramics: {
    name: 'Cerámicas y revestimientos',
    group: 'Construcción y materiales',
    profile: 'retail',
    productKind: 'ceramic',
    description:
      'Cajas por referencia, tono y calibre; cobertura en m² y estimación de cajas con merma.',
  },
  cement: {
    name: 'Cementos y aglomerantes',
    group: 'Construcción y materiales',
    profile: 'retail',
    productKind: 'cement',
    description:
      'Bolsas por marca, tipo, peso y lote; peso total disponible. Sin venta fraccionada.',
  },
  hardware: {
    name: 'Ferretería y herramientas',
    group: 'Construcción y materiales',
    profile: 'retail',
    productKind: 'general',
    description: 'Productos por referencia y unidad de venta fija: pieza, caja o bolsa.',
  },
  appliances: {
    name: 'Electrodomésticos',
    group: 'Tecnología y equipos',
    profile: 'retail',
    productKind: 'appliance',
    description:
      'Productos por marca y modelo, con plazo de garantía declarado. Sin trazabilidad por número de serie.',
  },
  electronics: {
    name: 'Electrónica y accesorios',
    group: 'Tecnología y equipos',
    profile: 'retail',
    productKind: 'appliance',
    description:
      'Catálogo por marca y modelo, costos y ventas; sin activación o reparación de equipos.',
  },
  spareParts: {
    name: 'Repuestos y accesorios de vehículos',
    group: 'Tecnología y equipos',
    profile: 'retail',
    productKind: 'general',
    description:
      'Catálogo por referencia, piezas disponibles y costos; sin catálogo automático de compatibilidades.',
  },
  stationery: {
    name: 'Librería y papelería',
    group: 'Otros comercios',
    profile: 'retail',
    productKind: 'general',
    description: 'Artículos por referencia y unidad de venta, compras y reposición.',
  },
  pets: {
    name: 'Productos para mascotas',
    group: 'Otros comercios',
    profile: 'retail',
    productKind: 'perishable',
    description:
      'Productos envasados por unidad y lote; sin venta por peso ni atención veterinaria.',
  },
  beauty: {
    name: 'Peluquería y belleza',
    group: 'Servicios y oficios',
    profile: 'services',
    description:
      'Catálogo de servicios, costo directo, clientes, ventas y cobros. Sin agenda de citas.',
  },
  cleaning: {
    name: 'Limpieza y mantenimiento',
    group: 'Servicios y oficios',
    profile: 'services',
    description:
      'Servicios por trabajo, clientes, costos directos y cobros. Sin cuadrillas ni rutas.',
  },
  professional: {
    name: 'Servicios profesionales',
    group: 'Servicios y oficios',
    profile: 'services',
    description:
      'Servicios, clientes, costos, gastos e informes. Sin gestión documental ni honorarios por hora.',
  },
  repair: {
    name: 'Taller y reparación',
    group: 'Servicios y oficios',
    profile: 'mixed',
    productKind: 'general',
    description:
      'Combina repuestos y servicios en una venta. Sin órdenes de taller ni custodia de equipos.',
  },
  crafts: {
    name: 'Artesanía y productos terminados',
    group: 'Otros comercios',
    profile: 'mixed',
    productKind: 'general',
    description:
      'Venta de piezas terminadas y servicios ocasionales. Sin recetas ni órdenes de producción.',
  },
} as const;
export type IndustryId = keyof typeof INDUSTRIES;
export const INDUSTRY_IDS = Object.keys(INDUSTRIES) as IndustryId[];
export function industry(id: IndustryId | undefined) {
  return id ? INDUSTRIES[id] : undefined;
}
export function industryProductKind(id: IndustryId | undefined): SpecificationKind | undefined {
  const selected = industry(id);
  return selected && 'productKind' in selected ? selected.productKind : undefined;
}
