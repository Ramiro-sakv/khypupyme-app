import type { SpecificationKind } from "./product-specification.js";

// Rubro comercial y forma de trabajo son conceptos distintos; no son códigos CAEB.
export const INDUSTRIES = {
  convenience: {
    name: "Tienda de barrio / 24 horas",
    group: "Alimentos y consumo",
    profile: "retail",
    productKind: "perishable",
    description:
      "Vender rápido y reponer a tiempo. Compra 24 botellas y vende 3; el lote más próximo a vencer sale primero.",
  },
  grocery: {
    name: "Abarrotes y minimercado",
    group: "Alimentos y consumo",
    profile: "retail",
    productKind: "perishable",
    description:
      "Presentaciones y productos por peso. Una caja de 12 unidades se incorpora como 12 piezas; 0,750 kg conserva su cantidad exacta.",
  },
  beverages: {
    name: "Bebidas y distribuidora",
    group: "Alimentos y consumo",
    profile: "retail",
    productKind: "perishable",
    description:
      "Vender bebidas y controlar envases. Presta 24 botellas a un cliente; al devolver 12 quedan 12 pendientes.",
  },
  clothing: {
    name: "Ropa y accesorios",
    group: "Moda y hogar",
    profile: "retail",
    productKind: "apparel",
    description:
      "Un modelo, muchas variantes. Polera Andina: tallas M y L en azul y negro; cada combinación tiene stock y costo propios.",
  },
  footwear: {
    name: "Calzado",
    group: "Moda y hogar",
    profile: "retail",
    productKind: "apparel",
    description:
      "Disponibilidad por talla y por par. Un par talla 39 se cambia por talla 40 mediante devolución y nueva venta relacionadas.",
  },
  furniture: {
    name: "Muebles y decoración",
    group: "Moda y hogar",
    profile: "retail",
    productKind: "general",
    description:
      "Cotizar, vender y entregar muebles. Vende una mesa y deja su entrega preparada para mañana.",
  },
  cosmetics: {
    name: "Cosméticos y cuidado personal",
    group: "Moda y hogar",
    profile: "retail",
    productKind: "perishable",
    description:
      "Cuidar lotes y vencimientos. Dos lotes del mismo producto tienen fechas distintas; revisa cuál debe salir primero.",
  },
  timber: {
    name: "Maderas y barraca",
    group: "Construcción y materiales",
    profile: "retail",
    productKind: "timber",
    description:
      "De las dimensiones a la cotización. Una tabla de 3000 × 200 × 25 mm contiene 0,015 m³.",
  },
  ceramics: {
    name: "Cerámicas y revestimientos",
    group: "Construcción y materiales",
    profile: "retail",
    productKind: "ceramic",
    description:
      "De la superficie a las cajas. Para 12 m² con 10 % de merma y cajas de 1,44 m² se necesitan 10 cajas completas.",
  },
  cement: {
    name: "Cementos y aglomerantes",
    group: "Construcción y materiales",
    profile: "retail",
    productKind: "cement",
    description:
      "Bolsas y granel sin perder masa. Abrir 2 bolsas de 50 kg transforma 2 bolsas en 100 kg y conserva su valor.",
  },
  hardware: {
    name: "Ferretería y herramientas",
    group: "Construcción y materiales",
    profile: "retail",
    productKind: "general",
    description:
      "Encontrar referencias y reponer. Ubica tornillos en el estante A2 y revisa su mínimo antes de comprar.",
  },
  appliances: {
    name: "Electrodomésticos",
    group: "Tecnología y equipos",
    profile: "retail",
    productKind: "appliance",
    description:
      "Seguir cada equipo por su serie. La serie DEMO-REF-001 mantiene su costo, venta y garantía declarada.",
  },
  electronics: {
    name: "Electrónica y accesorios",
    group: "Tecnología y equipos",
    profile: "retail",
    productKind: "appliance",
    description:
      "Accesorios y equipos identificados. Un cargador usa stock por unidades; una tablet conserva su número de serie.",
  },
  spareParts: {
    name: "Repuestos y accesorios de vehículos",
    group: "Tecnología y equipos",
    profile: "retail",
    productKind: "general",
    description:
      "Encontrar el repuesto compatible. Filtro R-100: compatibilidad declarada Toyota Corolla 2010–2015.",
  },
  stationery: {
    name: "Librería y papelería",
    group: "Otros comercios",
    profile: "retail",
    productKind: "general",
    description:
      "Artículos y servicios por página. Vende un cuaderno y 20 servicios de impresión de una página.",
  },
  pets: {
    name: "Productos para mascotas",
    group: "Otros comercios",
    profile: "retail",
    productKind: "perishable",
    description:
      "Alimentos envasados o por peso. Compra alimento a granel en kg y vende 1,250 kg.",
  },
  beauty: {
    name: "Peluquería y belleza",
    group: "Servicios y oficios",
    profile: "services",
    description:
      "Una agenda clara, un cobro vinculado. Agenda un corte de 30 minutos; al atenderlo registra una única venta vinculada.",
  },
  cleaning: {
    name: "Limpieza y mantenimiento",
    group: "Servicios y oficios",
    profile: "services",
    description:
      "Organizar cada trabajo de limpieza. Limpieza de oficina: baños, escritorios y piso, con fecha comprometida.",
  },
  professional: {
    name: "Servicios profesionales",
    group: "Servicios y oficios",
    profile: "services",
    description:
      "Trabajos y entregables por cliente. Asesoría: reunión, informe y entrega final por el importe presupuestado.",
  },
  repair: {
    name: "Taller y reparación",
    group: "Servicios y oficios",
    profile: "mixed",
    productKind: "general",
    description:
      "Recibir, diagnosticar, reparar y entregar. Reparación de ventilador con repuesto y servicio en una venta vinculada.",
  },
  crafts: {
    name: "Artesanía y productos terminados",
    group: "Otros comercios",
    profile: "mixed",
    productKind: "general",
    description:
      "Pedidos personalizados hasta la entrega. Pedido de dos piezas decorativas con color y fecha acordados.",
  },
} as const;
export type IndustryId = keyof typeof INDUSTRIES;
export const INDUSTRY_IDS = Object.keys(INDUSTRIES) as IndustryId[];
export function industry(id: IndustryId | undefined) {
  return id ? INDUSTRIES[id] : undefined;
}
export function industryProductKind(
  id: IndustryId | undefined,
): SpecificationKind | undefined {
  const selected = industry(id);
  return selected && "productKind" in selected
    ? selected.productKind
    : undefined;
}
