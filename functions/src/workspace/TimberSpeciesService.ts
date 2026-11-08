import { AppError } from "../../../shared/app-errors.js";
import { ZERO } from "../../../shared/workspace/exact.js";
import { normalizeSearch, searchPrefixes } from "../../../shared/workspace/search.js";
import { timberCategory, timberThickness, timberSpeciesItem } from "../../../shared/workspace/timber-species.js";
import type { TimberSelection, TimberSpecies, WorkspaceCommand } from "../../../shared/workspace/model.js";
import { hashKey, InventoryServiceV2 } from "./InventoryService.js";
import type { UnitOfWork } from "./UnitOfWork.js";

export const timberVariantId = (speciesId: string, thickness: string) =>
  "tw-" + hashKey(speciesId + "|" + timberThickness(thickness));

export class TimberSpeciesService {
  constructor(private readonly work: UnitOfWork, private readonly inventory: InventoryServiceV2) { }
  async species(id: string) {
    const species = await this.work.get<TimberSpecies>("timberSpecies", id);
    if (!species?.active) throw new AppError("La especie no existe o está archivada en este negocio.", 400, "SPECIES_UNAVAILABLE");
    return species;
  }
  async save(input: Extract<WorkspaceCommand, { kind: "timber-species"; }>["input"]) {
    const previous = await this.work.get<TimberSpecies>("timberSpecies", input.id);
    if ((previous?.revision ?? 0) !== input.expectedRevision)
      throw new AppError("Otra pestaña cambió esta especie. Actualiza antes de guardar.", 409, "SPECIES_REVISION");
    const identity = input.species !== undefined;
    let code = identity ? input.code || previous?.code || "" : previous?.code;
    if (identity && !code) {
      const counter = await this.work.get<{ next: number }>("catalogCounters", "timberCode");
      let next = counter?.next ?? 1;
      for (let attempt = 0; attempt < 100; attempt++, next++) {
        const candidate = "MAD-" + String(next).padStart(6, "0");
        const index = await this.work.get<{ retired?: boolean }>("barcodeIndex", hashKey(candidate));
        if (!index || index.retired) { code = candidate; this.work.set("catalogCounters", "timberCode", { next: next + 1 }); break; }
      }
      if (!code) throw new AppError("No se pudo asignar código. Escribe uno propio.", 409, "CODE_COLLISION");
    }
    if (code) {
      const index = await this.work.get<{ itemId: string; retired?: boolean }>("barcodeIndex", hashKey(code));
      if (index && !index.retired && index.itemId !== input.id) throw new AppError("Ese código ya pertenece a otro producto de este negocio.", 409, "CODE_EXISTS");
      this.work.set("barcodeIndex", hashKey(code), { itemId: input.id, timberSpeciesId: input.id, barcode: code });
      if (previous?.code && previous.code !== code) this.work.set("barcodeIndex", hashKey(previous.code), { itemId: input.id, retired: true });
    }
    // El contrato anterior conserva su índice por nombre; el nuevo diferencia fichas por código.
    if (!identity && !previous) {
      const indexId = hashKey(normalizeSearch(input.name));
      const index = await this.work.get<{ speciesId: string }>("timberSpeciesIndex", indexId);
      if (index && index.speciesId !== input.id) throw new AppError("Ya existe esa ficha. Actualiza el catálogo.", 409, "SPECIES_EXISTS");
      this.work.set("timberSpeciesIndex", indexId, { speciesId: input.id });
    }
    const next: TimberSpecies = {
      ...(code ? { code } : {}),
      ...(identity ? { species: input.species! } : previous?.species ? { species: previous.species } : {}),
      id: input.id, name: input.name, reference: input.reference,
      prices: input.prices, active: input.active, revision: (previous?.revision ?? 0) + 1,
      balance: previous?.balance ?? ZERO, pieces: previous?.pieces ?? 0,
      valueMinor: previous?.valueMinor ?? 0, createdAt: previous?.createdAt ?? this.work.now, updatedAt: this.work.now,
    };
    this.work.set("timberSpecies", input.id, { ...next, searchPrefixes: searchPrefixes([next.name, next.species ?? "", next.code ?? "", next.reference]) });
    return next;
  }
  async resolve(id: string, selection?: TimberSelection, create = false, allowUnstocked = false) {
    if (!selection?.speciesId) {
      const item = await this.inventory.item(id);
      if (item.timberSpeciesId) {
        const product = await this.species(item.timberSpeciesId);
        if (!selection) throw new AppError("Indica las medidas de la madera.");
        timberCategory(selection.lengthMm);
        return { ...item, name: product.name, fields: { ...item.fields, species: product.species ?? item.fields.species!, ...(product.code ? { productCode: product.code } : {}) } };
      }
      return item;
    }
    if (id !== selection.speciesId) throw new AppError("La especie no coincide con la línea seleccionada.");
    const species = await this.species(id), thickness = timberThickness(selection.thicknessMm ?? "");
    timberCategory(selection.lengthMm);
    const variantId = timberVariantId(species.id, thickness);
    let item = await this.work.get<import("../../../shared/workspace/model.js").Item>("items", variantId);
    if (!item && create) {
      item = await this.inventory.create(variantId, {
        name: species.name, kind: "timber-grouped", fields: { species: species.species ?? species.name, thicknessMm: thickness, ...(species.code ? { productCode: species.code } : {}) },
        barcode: "", priceMinor: species.prices.short, priceUnit: "boardFoot", minimum: ZERO, serviceCostMinor: 0,
      }, species.id);
    }
    if (!item && allowUnstocked) return { ...timberSpeciesItem(species, thickness), id: variantId, timberSpeciesId: species.id };
    if (!item) throw new AppError("No hay madera registrada de ese espesor. Registra primero una compra o entrada con costo.", 400, "THICKNESS_UNAVAILABLE");
    return { ...item, name: species.name, fields: { ...item.fields, species: species.species ?? item.fields.species!, ...(species.code ? { productCode: species.code } : {}) } };
  }
  async price(item: import("../../../shared/workspace/model.js").Item, selection?: TimberSelection) {
    if (!item.timberSpeciesId) return item.priceMinor;
    if (!selection) throw new AppError("Falta indicar el largo de la madera.");
    return (await this.species(item.timberSpeciesId)).prices[timberCategory(selection.lengthMm)];
  }
}
