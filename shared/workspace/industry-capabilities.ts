import type { IndustryId } from "../business-industries.js";

export const quickCatalog = (id: IndustryId | null) =>
  id === "convenience" || id === "grocery" || id === "beverages" || id === "hardware" || id === "stationery" || id === "pets" || id === "cosmetics";
export const hasReorder = (id: IndustryId | null) => quickCatalog(id) || id === "spareParts";
export const hasExpiry = (id: IndustryId | null) =>
  id === "convenience" || id === "grocery" || id === "beverages" || id === "cosmetics" || id === "pets";
export const hasVariantMatrix = (id: IndustryId | null) => id === "clothing" || id === "footwear";
export const hasSerialWorkflow = (id: IndustryId | null) => id === "appliances" || id === "electronics";

export const itemProfileFields = {
  cosmetics: { presentation: "Presentación", shade: "Tono", openMonths: "Duración tras apertura (meses)" },
  pets: { presentation: "Presentación (bolsa, lata o granel)" },
  footwear: { sizeSystem: "Sistema de talla", shoeWidth: "Ancho del calzado" },
  furniture: { dimensions: "Dimensiones declaradas" },
  hardware: { dimensions: "Medida o calibre" },
  spareParts: { vehicleMake: "Marca del vehículo", vehicleModel: "Modelo", yearFrom: "Desde el año", yearTo: "Hasta el año" },
  stationery: { printSize: "Tamaño de impresión", printInk: "Tipo de impresión" },
  beauty: { durationMinutes: "Duración del servicio (minutos)" },
} as const;

export const profileLabels = Object.assign({}, ...Object.values(itemProfileFields)) as Record<string, string>;

export function fieldsForItem(industry: IndustryId | null, kind: string): Record<string, string> {
  if (kind === "service" && industry !== "beauty" && industry !== "stationery") return {};
  if (kind !== "service" && (industry === "beauty" || industry === "stationery")) return {};
  if (industry === "footwear" && kind !== "apparel") return {};
  return (industry && Object.hasOwn(itemProfileFields, industry)
    ? itemProfileFields[industry as keyof typeof itemProfileFields] : {});
}
