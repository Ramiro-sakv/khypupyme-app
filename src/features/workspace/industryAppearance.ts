import type { CSSProperties } from "react";
import type { IndustryId } from "../../../shared/business-industries";
import type { IconName } from "./Icon";

type Appearance = {
  icon: IconName;
  layout: "counter" | "catalog" | "measure" | "schedule" | "work";
  colors: [primary: string, secondary: string, surface: string, soft: string, line: string];
  inventory: string;
  search: string;
  tools: readonly string[];
};

const appearances = {
  timber: { icon: "timber", layout: "measure", colors: ["#704019", "#bd8743", "#fffbf2", "#f2dfbc", "#dcc39a"], inventory: "Madera y medidas", search: "Especie, producto o código", tools: ["Medidas y pies tablares", "Existencias por largo, espesor y ancho", "Servicios de corte"] },
  convenience: { icon: "barcode", layout: "counter", colors: ["#85392d", "#db8769", "#fff8f3", "#f8e0d6", "#e9bcaf"], inventory: "Productos y reposición", search: "Nombre o código de producto", tools: ["Venta por lector", "Reposición", "Lotes y vencimientos"] },
  clothing: { icon: "shirt", layout: "catalog", colors: ["#63345f", "#ad76a1", "#fff8fc", "#efdfed", "#ddc4d8"], inventory: "Modelos y variantes", search: "Modelo, referencia o código", tools: ["Tallas y colores", "Existencias por variante", "Cambios desde Ventas"] },
  appliances: { icon: "appliance", layout: "catalog", colors: ["#214784", "#658fd1", "#f7faff", "#dfebfc", "#bfd0eb"], inventory: "Equipos y modelos", search: "Marca, modelo o código", tools: ["Compra y venta por serie", "Inspecciones", "Garantías"] },
  grocery: { icon: "basket", layout: "counter", colors: ["#495526", "#a2a855", "#faf9ee", "#ebeccf", "#d4d7ac"], inventory: "Estantes y reposición", search: "Producto, presentación o código", tools: ["Compra por presentación", "Venta por unidad, peso o volumen", "Reposición y vencimientos"] },
  beverages: { icon: "bottles", layout: "counter", colors: ["#145855", "#cc9e36", "#f4fbf8", "#dcefe9", "#b3d7ce"], inventory: "Bebidas y presentaciones", search: "Bebida, presentación o código", tools: ["Cajas y unidades", "Envases retornables por cliente", "Entregas"] },
  footwear: { icon: "shoe", layout: "catalog", colors: ["#313960", "#dd7d70", "#faf9ff", "#e8e9f7", "#c9cce7"], inventory: "Modelos y tallas", search: "Modelo, referencia o código", tools: ["Tallas y colores", "Disponibilidad por pares", "Cambios desde Ventas"] },
  furniture: { icon: "chair", layout: "catalog", colors: ["#624732", "#889678", "#fcf9f1", "#eee5d5", "#ddd0b9"], inventory: "Muebles y piezas terminadas", search: "Mueble, nombre o referencia", tools: ["Medidas de muebles", "Cotizaciones", "Retiro y entrega a domicilio"] },
  cosmetics: { icon: "cosmetic", layout: "catalog", colors: ["#78384d", "#c47d91", "#fff8f7", "#f6e3e7", "#ebc9d2"], inventory: "Productos y lotes", search: "Marca, presentación o tono", tools: ["Marca, presentación y tono", "Vencimiento y duración tras apertura", "Lotes apartados"] },
  ceramics: { icon: "tile", layout: "measure", colors: ["#884b3d", "#628a95", "#fffaf2", "#f4e3d9", "#e2c8bc"], inventory: "Revestimientos y cobertura", search: "Referencia, tono o calibre", tools: ["Cotización por superficie", "Merma y cobertura", "Tono y calibre"] },
  cement: { icon: "sack", layout: "measure", colors: ["#3d484d", "#c6a436", "#f8f8f2", "#ebeae0", "#d6d6c7"], inventory: "Bolsas y granel", search: "Marca, tipo o código", tools: ["Existencias por bolsa y lote", "Peso por bolsa", "Apertura a granel si está habilitada"] },
  hardware: { icon: "tools", layout: "counter", colors: ["#64501b", "#c39b31", "#fcfaf1", "#f0e8ca", "#dfd0a2"], inventory: "Referencias y estantes", search: "Código, referencia o medida", tools: ["Ubicación de estante", "Reposición", "Piezas, cajas, metros y rollos"] },
  electronics: { icon: "chip", layout: "catalog", colors: ["#39407d", "#4da9b3", "#f8f9ff", "#e5eafa", "#c9d2ef"], inventory: "Accesorios y equipos", search: "Marca, modelo o código", tools: ["Accesorios por cantidad", "Equipos por serie", "Garantías e inspección"] },
  spareParts: { icon: "wheel", layout: "counter", colors: ["#25505b", "#c87d4c", "#f5fafb", "#e0edf1", "#b9d2da"], inventory: "Referencias y compatibilidad", search: "Referencia original, equivalente o código", tools: ["Referencias equivalentes", "Compatibilidad por vehículo y año", "Existencias por repuesto"] },
  stationery: { icon: "print", layout: "counter", colors: ["#544081", "#7fafd0", "#fcfaff", "#eee7fb", "#d7caec"], inventory: "Artículos y servicios de impresión", search: "Artículo, servicio o código", tools: ["Artículos y servicios en una venta", "Copias y caras", "Tarifas de impresión"] },
  pets: { icon: "paw", layout: "catalog", colors: ["#3d5b39", "#cc9057", "#fafaf2", "#e6ecd9", "#cbd8ba"], inventory: "Envasados y fraccionados", search: "Alimento, marca o presentación", tools: ["Alimentos envasados y por peso", "Lotes de origen", "Reposición y vencimientos"] },
  beauty: { icon: "calendar", layout: "schedule", colors: ["#654477", "#bc92b6", "#fdf8ff", "#eee3f6", "#dcc9e9"], inventory: "Servicios y productos", search: "Servicio o producto", tools: ["Agenda y duración del servicio", "Atención sin cita", "Cobro desde agenda"] },
  cleaning: { icon: "sparkle", layout: "work", colors: ["#245d63", "#59a596", "#f4fbfa", "#dcf1eb", "#b8ddd5"], inventory: "Servicios y materiales", search: "Servicio o material", tools: ["Órdenes con ubicación y tareas", "Materiales previstos y usados", "Cobro vinculado"] },
  professional: { icon: "briefcase", layout: "work", colors: ["#334562", "#ad7e5f", "#f7f9fc", "#e7ecf4", "#cdd7e7"], inventory: "Servicios profesionales", search: "Servicio del catálogo", tools: ["Trabajos y entregables", "Presupuesto y aprobación", "Cobro vinculado"] },
  repair: { icon: "wrench", layout: "work", colors: ["#753a34", "#9b8c8a", "#fcf8f6", "#f0e4e1", "#ddc7c1"], inventory: "Repuestos y mano de obra", search: "Repuesto o servicio", tools: ["Recepción y diagnóstico", "Espera de repuesto", "Constancia y cobro"] },
  crafts: { icon: "craft", layout: "work", colors: ["#79503c", "#819179", "#fcf8f0", "#efe3d6", "#dfcaba"], inventory: "Piezas y servicios", search: "Pieza terminada o servicio", tools: ["Venta de piezas listas", "Encargos personalizados", "Seguimiento de entregas"] },
} satisfies Record<IndustryId, Appearance>;

const general: Appearance = {
  icon: "box", layout: "catalog", colors: ["#174e42", "#7e9f91", "#fffaef", "#e7ede4", "#cad8d0"],
  inventory: "Inventario", search: "Nombre, referencia o código", tools: ["Catálogo", "Ventas", "Caja"],
};

export function industryAppearance(industry: IndustryId | null): Appearance {
  return industry ? appearances[industry] : general;
}

export function industryIcon(industry: IndustryId | null): IconName {
  return industryAppearance(industry).icon;
}

export function industryStyle(industry: IndustryId | null): CSSProperties {
  const [primary, secondary, surface, soft, line] = industryAppearance(industry).colors;
  return {
    "--primary": primary, "--accent": primary, "--industry-accent": secondary, "--surface": surface,
    "--soft": soft, "--line": line,
  } as CSSProperties;
}
