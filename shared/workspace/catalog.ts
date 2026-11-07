import { INDUSTRIES } from "../business-industries.js";
import type { IndustryId } from "../business-industries.js";
import { decimal, div, fraction, mul, ONE, whole } from "./exact.js";
import type {
  BusinessAnswers,
  ItemDraft,
  ItemKind,
  Unit,
  WorkspaceBusiness,
} from "./model.js";

export interface ItemField {
  key: string;
  label: string;
  type: "text" | "number" | "date";
  required: boolean;
  max?: number;
  digits?: number;
}
const field = (key: string, label: string, required = true): ItemField => ({
  key,
  label,
  type: "text",
  required,
});
const numeric = (
  key: string,
  label: string,
  max: number,
  digits = 0,
): ItemField => ({ key, label, type: "number", required: true, max, digits });
export const UNITS: Record<Unit, string> = {
  piece: "piezas",
  pair: "pares",
  box: "cajas",
  bag: "bolsas",
  kg: "kg",
  m3: "m³",
  boardFoot: "pies tablares",
  m2: "m²",
  service: "servicios",
};
export const ITEM_MODELS: Record<
  ItemKind,
  { label: string; fields: ItemField[]; base: string }
> = {
  general: {
    label: "Producto por unidades",
    fields: [
      field("reference", "Referencia", false),
      numeric("packSize", "Unidades por caja", 10000),
    ],
    base: "piezas",
  },
  "timber-piece": {
    label: "Madera por piezas y medidas",
    fields: [
      field("species", "Especie"),
      numeric("lengthMm", "Largo (mm)", 100000, 3),
      numeric("widthMm", "Ancho (mm)", 10000, 3),
      numeric("thicknessMm", "Espesor (mm)", 10000, 3),
    ],
    base: "piezas",
  },
  "timber-volume": {
    label: "Madera por volumen",
    fields: [field("species", "Especie")],
    base: "mm³",
  },
  apparel: {
    label: "Variante de ropa o calzado",
    fields: [
      field("model", "Modelo de la prenda o calzado"),
      field("reference", "Referencia", false),
      field("size", "Talla"),
      field("color", "Color"),
      field("pair", "Presentación: pieza o par"),
    ],
    base: "piezas/pares",
  },
  appliance: {
    label: "Equipo con número de serie",
    fields: [
      field("brand", "Marca"),
      field("model", "Modelo"),
      numeric("warrantyMonths", "Garantía comercial (meses)", 120),
    ],
    base: "piezas",
  },
  grocery: {
    label: "Producto de tienda por lote",
    fields: [
      field("weighted", "Venta por peso: si o no"),
      field("perishable", "Exige vencimiento: si o no"),
      numeric("packSize", "Unidades por presentación de compra", 10000),
    ],
    base: "piezas/g",
  },
  ceramic: {
    label: "Cerámica por tono y calibre",
    fields: [
      field("reference", "Referencia"),
      field("tone", "Tono"),
      field("caliber", "Calibre"),
      numeric("piecesPerBox", "Piezas por caja", 1000),
      numeric("coverageM2", "Cobertura por caja (m²)", 100, 6),
    ],
    base: "piezas",
  },
  "cement-bag": {
    label: "Cemento en bolsas cerradas",
    fields: [
      field("brand", "Marca"),
      field("grade", "Tipo o resistencia"),
      numeric("weightKg", "Peso por bolsa (kg)", 1000, 3),
    ],
    base: "bolsas",
  },
  "cement-bulk": {
    label: "Cemento a granel",
    fields: [field("brand", "Marca"), field("grade", "Tipo o resistencia")],
    base: "g",
  },
  service: {
    label: "Servicio o trabajo",
    fields: [field("reference", "Referencia", false)],
    base: "servicios",
  },
};
export const DEFAULT_ANSWERS: BusinessAnswers = {
  weighted: false,
  bulk: false,
  timberMode: "piece",
  documentFooter: "",
  address: "",
  phone: "",
};
export function kindsFor(
  business: Pick<WorkspaceBusiness, "industryId" | "answers">,
): ItemKind[] {
  const shared: ItemKind[] = ["general", "service"];
  switch (business.industryId) {
    case "timber":
      return ["timber-piece", "timber-volume", ...shared];
    case "clothing":
    case "footwear":
      return ["apparel", ...shared];
    case "electronics":
    case "appliances":
      return ["appliance", ...shared];
    case "grocery":
    case "beverages":
    case "cosmetics":
    case "pets":
    case "convenience":
      return ["grocery", ...shared];
    case "ceramics":
      return ["ceramic", ...shared];
    case "cement":
      return business.answers.bulk
        ? ["cement-bag", "cement-bulk", ...shared]
        : ["cement-bag", ...shared];
    default:
      return shared;
  }
}
export function suggestedKind(industryId: IndustryId): ItemKind {
  return (
    (
      {
        timber: "timber-piece",
        clothing: "apparel",
        footwear: "apparel",
        appliances: "appliance",
        convenience: "grocery",
        grocery: "grocery",
        beverages: "grocery",
        cosmetics: "grocery",
        pets: "grocery",
        electronics: "appliance",
        beauty: "service",
        cleaning: "service",
        professional: "service",
        ceramics: "ceramic",
        cement: "cement-bag",
      } as Partial<Record<IndustryId, ItemKind>>
    )[industryId] ?? "general"
  );
}
export function specialized(industryId: IndustryId): boolean {
  return Object.hasOwn(INDUSTRIES, industryId);
}
export function industryLabel(industryId: IndustryId | null): string {
  return industryId ? INDUSTRIES[industryId].name : "Negocio anterior";
}
export function itemUnits(item: ItemDraft): {
  baseUnit: string;
  units: Partial<Record<Unit, ReturnType<typeof fraction>>>;
} {
  const f = item.fields;
  switch (item.kind) {
    case "timber-piece": {
      const volume = mul(
        mul(decimal(f.lengthMm!, 3), decimal(f.widthMm!, 3)),
        decimal(f.thicknessMm!, 3),
      );
      return {
        baseUnit: "piezas",
        units: {
          piece: ONE,
          m3: div(fraction(1000000000n), volume),
          boardFoot: div(fraction(294967152n, 125n), volume),
        },
      };
    }
    case "timber-volume":
      return {
        baseUnit: "mm³",
        units: {
          m3: fraction(1000000000n),
          boardFoot: fraction(294967152n, 125n),
        },
      };
    case "ceramic":
      return {
        baseUnit: "piezas",
        units: {
          piece: ONE,
          box: decimal(f.piecesPerBox!, 0),
          m2: div(decimal(f.piecesPerBox!, 0), decimal(f.coverageM2!)),
        },
      };
    case "cement-bag":
      return { baseUnit: "bolsas", units: { bag: ONE } };
    case "cement-bulk":
      return { baseUnit: "g", units: { kg: fraction(1000n) } };
    case "grocery":
      return f.weighted === "si"
        ? { baseUnit: "g", units: { kg: fraction(1000n) } }
        : {
            baseUnit: "piezas",
            units: { piece: ONE, box: decimal(f.packSize!, 0) },
          };
    case "apparel":
      return {
        baseUnit: f.pair === "par" ? "pares" : "piezas",
        units: f.pair === "par" ? { pair: ONE } : { piece: ONE },
      };
    case "service":
      return { baseUnit: "servicios", units: { service: ONE } };
    default:
      return {
        baseUnit: "piezas",
        units: {
          piece: ONE,
          ...(f.packSize ? { box: decimal(f.packSize, 0) } : {}),
        },
      };
  }
}
export function isDiscrete(item: Pick<ItemDraft, "kind" | "fields">): boolean {
  return (
    !["timber-volume", "cement-bulk"].includes(item.kind) &&
    !(item.kind === "grocery" && item.fields.weighted === "si")
  );
}
export function validItemFields(
  kind: ItemKind,
  raw: Record<string, string>,
): Record<string, string> {
  const schema = ITEM_MODELS[kind];
  if (
    !schema ||
    Object.keys(raw).some((key) => !schema.fields.some((f) => f.key === key))
  )
    throw new Error("Campos de producto desconocidos.");
  return Object.fromEntries(
    schema.fields.map((f) => {
      const value = raw[f.key]?.trim() ?? "";
      if ((f.required && !value) || value.length > 80 || /[\r\n]/.test(value))
        throw new Error(`Revisa ${f.label}.`);
      if (f.type === "number") {
        const q = decimal(value, f.digits || 0);
        if (
          (q.n === "0" && f.key !== "warrantyMonths") ||
          Number(value.replace(",", ".")) > f.max!
        )
          throw new Error(`Revisa ${f.label}.`);
        if (!f.digits && !whole(q))
          throw new Error(`${f.label}: utiliza enteros.`);
      }
      if (
        ["weighted", "perishable"].includes(f.key) &&
        !["si", "no"].includes(value)
      )
        throw new Error(`${f.label}: escribe si o no.`);
      if (f.key === "pair" && !["pieza", "par"].includes(value))
        throw new Error("Selecciona pieza o par.");
      return [f.key, value];
    }),
  );
}
