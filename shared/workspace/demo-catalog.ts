import type { IndustryId } from "../business-industries.js";
import type { ItemDraft, ItemKind, Unit } from "./model.js";
import { decimal, ZERO } from "./exact.js";
import { EMPTY_DETAILS } from "./operations.js";
const names: Record<IndustryId, string[]> = {
  convenience: [
    "Agua mineral 600 ml",
    "Galletas de avena",
    "Jugo de durazno",
    "Leche en caja",
    "Maní a granel",
    "Servicio de entrega",
  ],
  grocery: [
    "Arroz a granel",
    "Aceite de cocina",
    "Azúcar envasada",
    "Fideo familiar",
    "Harina envasada",
    "Servicio de entrega",
  ],
  beverages: [
    "Gaseosa 2 litros",
    "Agua mineral",
    "Jugo familiar",
    "Bebida isotónica",
    "Refresco de frutas",
    "Servicio de reparto",
  ],
  clothing: [
    "Polera Andina M azul",
    "Polera Andina M negra",
    "Polera Andina L azul",
    "Polera Andina L negra",
    "Cinturón tejido",
    "Ajuste de prenda",
  ],
  footwear: [
    "Zapatilla Camino 38 azul",
    "Zapatilla Camino 38 negra",
    "Zapatilla Camino 39 azul",
    "Zapatilla Camino 39 negra",
    "Cordones de repuesto",
    "Limpieza de calzado",
  ],
  furniture: [
    "Mesa comedor",
    "Silla de madera",
    "Estante pequeño",
    "Escritorio",
    "Mesa auxiliar",
    "Servicio de armado",
  ],
  cosmetics: [
    "Crema hidratante",
    "Champú suave",
    "Protector de manos",
    "Jabón facial",
    "Acondicionador",
    "Asesoría de productos",
  ],
  timber: [
    "Tabla pino 3000x200x25",
    "Tabla cedro 2500x150x20",
    "Listón pino 2000x80x30",
    "Madera pino por volumen",
    "Lija por unidad",
    "Corte a medida",
  ],
  ceramics: [
    "Cerámica Arena tono A",
    "Cerámica Arena tono B",
    "Cerámica Gris tono A",
    "Cerámica Blanca tono A",
    "Adhesivo envasado",
    "Servicio de entrega",
  ],
  cement: [
    "Cemento Demo 50 kg",
    "Cemento Demo 42,5 kg",
    "Cemento Demo a granel",
    "Cemento Firme 50 kg",
    "Pala de obra",
    "Servicio de entrega",
  ],
  hardware: [
    "Tornillo 1 pulgada",
    "Tuerca hexagonal",
    "Martillo carpintero",
    "Destornillador",
    "Bisagra pequeña",
    "Servicio de instalación",
  ],
  appliances: [
    "Refrigerador Demo",
    "Lavadora Demo",
    "Cocina Demo",
    "Microondas Demo",
    "Manguera de conexión",
    "Servicio de instalación",
  ],
  electronics: [
    "Tablet Demo",
    "Parlante Demo",
    "Cargador USB",
    "Cable USB",
    "Audífonos básicos",
    "Servicio de configuración",
  ],
  spareParts: [
    "Filtro R-100",
    "Pastilla F-200",
    "Bujía B-300",
    "Correa C-400",
    "Foco L-500",
    "Servicio de colocación",
  ],
  stationery: [
    "Cuaderno escolar",
    "Lápiz negro",
    "Bolígrafo azul",
    "Resma de papel 500 hojas",
    "Impresión de una página",
    "Fotocopia de una página",
  ],
  pets: [
    "Alimento canino a granel",
    "Alimento felino envasado",
    "Premios para perro",
    "Alimento cachorro",
    "Arena sanitaria",
    "Servicio de entrega",
  ],
  beauty: [
    "Corte de cabello",
    "Peinado",
    "Lavado capilar",
    "Manicura básica",
    "Tratamiento capilar",
    "Maquillaje social",
  ],
  cleaning: [
    "Limpieza de oficina",
    "Limpieza de hogar",
    "Limpieza de ventanas",
    "Limpieza de tapizado",
    "Desinfección de ambiente",
    "Mantenimiento básico",
  ],
  professional: [
    "Asesoría inicial",
    "Revisión de documentos",
    "Informe técnico",
    "Diseño de propuesta",
    "Capacitación",
    "Seguimiento de proyecto",
  ],
  repair: [
    "Interruptor de repuesto",
    "Cable de repuesto",
    "Conector eléctrico",
    "Fusible",
    "Diagnóstico de equipo",
    "Mano de obra de reparación",
  ],
  crafts: [
    "Florero artesanal",
    "Portavasos tejido",
    "Marco decorativo",
    "Figura de cerámica",
    "Caja decorada",
    "Personalización de pieza",
  ],
};
export interface DemoProduct {
  item: ItemDraft;
  costMinor: number;
  quantity: string;
  unit: Unit;
}
export function demoCatalog(industry: IndustryId): DemoProduct[] {
  return names[industry].map((name, index) => {
    let kind: ItemKind = "general",
      fields: Record<string, string> = {
        reference: "REF-" + String(index + 1).padStart(3, "0"),
        packSize: "12",
      },
      priceMinor = 1200 + index * 300,
      unit: Unit = "piece",
      quantity = "20";
    if (
      index === 5 ||
      ["beauty", "cleaning", "professional"].includes(industry) ||
      (industry === "stationery" && index >= 4) ||
      (industry === "repair" && index >= 4)
    ) {
      kind = "service";
      fields = { reference: "SERV-" + (index + 1) };
      unit = "service";
      quantity = "0";
      priceMinor =
        industry === "stationery"
          ? 100
          : industry === "professional"
            ? 30000
            : industry === "cleaning"
              ? 20000
              : 5000;
    } else if (
      ["convenience", "grocery", "beverages", "cosmetics", "pets"].includes(
        industry,
      )
    ) {
      kind = "grocery";
      const weighted =
        (["grocery", "pets"].includes(industry) && index === 0) ||
        (industry === "convenience" && index === 4);
      fields = {
        weighted: weighted ? "si" : "no",
        perishable: "si",
        packSize: "12",
      };
      unit = weighted ? "kg" : "piece";
      quantity = weighted ? "10" : "24";
      priceMinor = weighted ? 1500 : 1000 + index * 200;
    } else if (["clothing", "footwear"].includes(industry) && index < 4) {
      kind = "apparel";
      fields = {
        model: industry === "clothing" ? "Polera Andina" : "Zapatilla Camino",
        reference: "MOD-" + index,
        size:
          industry === "clothing"
            ? index < 2
              ? "M"
              : "L"
            : index < 2
              ? "38"
              : "39",
        color: index % 2 ? "negro" : "azul",
        pair: industry === "footwear" ? "par" : "pieza",
      };
      unit = industry === "footwear" ? "pair" : "piece";
      priceMinor = industry === "footwear" ? 18000 : 7000;
    } else if (industry === "timber" && index < 4) {
      if (index === 3) {
        kind = "timber-volume";
        fields = { species: "Pino" };
        unit = "m3";
        quantity = "0.5";
        priceMinor = 250000;
      } else {
        kind = "timber-piece";
        fields = {
          species: index === 1 ? "Cedro" : "Pino",
          lengthMm: ["3000", "2500", "2000"][index]!,
          widthMm: ["200", "150", "80"][index]!,
          thicknessMm: ["25", "20", "30"][index]!,
        };
        priceMinor = 10000 + index * 1000;
      }
    } else if (industry === "ceramics" && index < 4) {
      kind = "ceramic";
      fields = {
        reference: index < 2 ? "Arena" : "Modelo-" + index,
        tone: index === 1 ? "B" : "A",
        caliber: "01",
        piecesPerBox: "4",
        coverageM2: "1.44",
      };
      unit = "box";
      quantity = "10";
      priceMinor = 6500 + index * 500;
    } else if (industry === "cement" && index < 4) {
      if (index === 2) {
        kind = "cement-bulk";
        fields = { brand: "Demo", grade: "Uso general" };
        unit = "kg";
        quantity = "100";
        priceMinor = 140;
      } else {
        kind = "cement-bag";
        fields = {
          brand: index === 3 ? "Firme" : "Demo",
          grade: "Uso general",
          weightKg: index === 1 ? "42.5" : "50",
        };
        unit = "bag";
        quantity = "30";
        priceMinor = 6500;
      }
    } else if (
      (industry === "appliances" && index < 4) ||
      (industry === "electronics" && index < 2)
    ) {
      kind = "appliance";
      fields = {
        brand: "Marca Demo",
        model: "MODELO-" + (index + 1),
        warrantyMonths: "12",
      };
      quantity = "4";
      priceMinor =
        industry === "appliances"
          ? 200000 + index * 50000
          : 80000 + index * 10000;
    }
    const costMinor = Math.floor((priceMinor * 6) / 10),
      minimum =
        kind === "service"
          ? ZERO
          : decimal(
              kind === "grocery" && fields.weighted === "si"
                ? "1000"
                : index === 4
                  ? "100"
                  : "3",
            );
    const item: ItemDraft = {
      name,
      kind,
      fields,
      barcode:
        kind === "service"
          ? ""
          : "DEMO-" + industry.toUpperCase() + "-" + (index + 1),
      priceMinor,
      priceUnit: unit,
      minimum,
      serviceCostMinor: kind === "service" ? costMinor : 0,
      details: {
        ...EMPTY_DETAILS,
        brand: kind === "service" ? "" : "Marca de ejemplo",
        location:
          kind === "service"
            ? ""
            : "Estante " + String.fromCharCode(65 + index),
        description:
          industry === "furniture"
            ? "Medidas descriptivas: 120 x 70 x 75 cm"
            : name,
        equivalents:
          industry === "spareParts" ? "Equivalente DEMO-" + index : "",
        compatibility:
          industry === "spareParts"
            ? "Toyota Corolla 2010–2015; aplicación declarada de ejemplo"
            : "",
      },
    };
    return { item, costMinor, quantity, unit };
  });
}
