import { AppError } from "../../../shared/app-errors";
import { parseTimberWidths } from "../../../shared/workspace/timber-width-entry";
import type { CartLine } from "./Cart";

/** Canonical old selections remain untouched. Only versioned text is parsed with the new grammar. */
export function resolveTimber(line: CartLine) {
  if (!line.timber)
    throw new AppError(
      "Selecciona las medidas de la madera.",
      400,
      "WIDTH_REQUIRED",
      "timber-widths",
    );
  const entry = line.widthsEntry;
  if (
    entry &&
    (entry.version !== 2 ||
      !["imperial", "metric"].includes(entry.system) ||
      !["text", "selection"].includes(entry.source) ||
      typeof entry.text !== "string")
  )
    throw new AppError(
      "La captura del borrador no es compatible. Conserva el original y revisa sus medidas.",
      400,
      "WIDTH_VERSION",
    );
  if (entry?.source === "text")
    return {
      ...line.timber,
      widths: parseTimberWidths(entry.text, entry.system).widths,
    };
  return line.timber;
}
export function requireTimber(line: CartLine) {
  if (line.widthInput?.trim())
    throw new AppError(
      "Hay anchos pendientes del formato anterior. Recupéralos o descártalos expresamente antes de confirmar.",
      400,
      "LEGACY_WIDTH_PENDING",
      "timber-widths",
    );
  const selection = resolveTimber(line);
  if (!selection.lengthMm)
    throw new AppError(
      "Falta indicar el largo de este grupo.",
      400,
      "LENGTH_REQUIRED",
      "timber-length",
    );
  if (!selection.widths.length)
    throw new AppError(
      "Falta indicar los anchos de este grupo.",
      400,
      "WIDTH_REQUIRED",
      "timber-widths",
    );
  return selection;
}
