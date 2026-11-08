import type { Item, TimberSelection, TimberSpecies } from "../../../shared/workspace/model";
import { timberSpeciesItem } from "../../../shared/workspace/timber-species";
import type { WorkspaceRepository } from "./WorkspaceRepository";

/** Reconsulta el catálogo autorizado; nunca restaura stock o tarifas desde el borrador. */
export async function loadTimberItem(repository: WorkspaceRepository, businessId: string, itemId: string, timber?: TimberSelection) {
  if (timber?.speciesId) {
    if (itemId !== timber.speciesId) throw new Error("La especie del borrador no corresponde a su línea.");
    const species = (await repository.list<TimberSpecies>({ apiVersion: 2, businessId, resource: "timberSpecies", id: timber.speciesId })).items[0];
    return species ? timberSpeciesItem(species, timber.thicknessMm ?? "") : undefined;
  }
  return (await repository.list<Item>({ apiVersion: 2, businessId, resource: "items", id: itemId })).items[0];
}
