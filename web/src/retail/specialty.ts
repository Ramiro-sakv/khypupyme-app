import type { components } from "../api/schema";

type Specialty = components["schemas"]["ProductSpecialty"];

export function specialtyText(specialty?: Specialty | null) {
  if (!specialty) return "";
  const detail = specialty.detail;
  const { furniture, tile, cement } = specialty.material ?? {};
  return [detail?.brand, detail?.model, detail?.reference && "Ref. " + detail.reference, detail?.measure,
    detail?.shelf && "Estante " + detail.shelf, specialty.parts?.equivalents.length && "Equivalentes " + specialty.parts.equivalents.join(", "),
    specialty.parts && (specialty.parts.compatibility.length === 0 || specialty.parts.compatibility.some((row) => !row.confirmed)) ? "Compatibilidad por confirmar" : "",
    specialty.countUnit === "pair" ? "Por pares" : "",
    furniture && [furniture.widthCm, furniture.depthCm, furniture.heightCm].join(" × ") + " cm (ancho × fondo × alto)",
    tile && [tile.boxArea.toLocaleString("es-BO") + " m² por caja", tile.tone && "Tono " + tile.tone, tile.caliber && "Calibre " + tile.caliber].filter(Boolean).join(" · "),
    cement && (cement.isBulk ? "Cemento a granel" : cement.bagKg + " kg por bolsa"),
    specialty.printing && [specialty.printing.paperSize, specialty.printing.color === "color" ? "Color" : "Blanco y negro"].join(" · ")]
    .filter(Boolean).join(" · ");
}
