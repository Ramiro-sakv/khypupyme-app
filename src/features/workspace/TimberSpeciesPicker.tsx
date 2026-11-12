import type { Item, TimberSpecies } from "../../../shared/workspace/model";
import { timberSpeciesItem } from "../../../shared/workspace/timber-species";
import { useRecords } from "./context";
import { bob } from "./format";
import { Pager } from "./ui";
export default function TimberSpeciesPicker({ search, disabled, onPick }: { search: string; disabled: boolean; onPick: (item: Item) => void; }) {
  const page = useRecords<TimberSpecies>("timberSpecies", { active: true, ...(search.trim().length >= 2 ? { search: search.trim() } : {}) });
  return <>
    <h3>Especies · elige el espesor en el grupo</h3>
    <Pager page={page} />
    <div className="product-picker timber-species-picker">{page.items.map((species) => <button key={species.id} type="button" data-tutorial="pick-item" disabled={disabled} onClick={() => onPick(timberSpeciesItem(species))}>
      <strong>{species.name}</strong>
      {species.species && <small>Especie · {species.species}</small>}
      <small>Precio por pie tablar</small>
      <span className="timber-picker-prices">
        <span>1–2 pies <strong>{bob(species.prices.superShort)}</strong></span>
        <span>3–6 pies <strong>{bob(species.prices.short)}</strong></span>
        <span>7–20 pies <strong>{bob(species.prices.long)}</strong></span>
      </span>
    </button>)}</div>
  </>;
}
