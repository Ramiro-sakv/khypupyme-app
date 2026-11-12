import { useState } from "react";
import { compare, ZERO } from "../../../shared/workspace/exact";
import type { Item } from "../../../shared/workspace/model";
import { displayQuantity } from "../../../shared/workspace/presentation";
import { useRecords } from "./context";
import { bob } from "./format";
import { Pager } from "./ui";

const knownColors: Readonly<Record<string, string>> = {
  negro: "#282529", blanco: "#fff", gris: "#8d9092", azul: "#225799",
  "azul marino": "#24324f", rojo: "#b73742", verde: "#3d7959",
  amarillo: "#e7be38", beige: "#d8c6a9", rosa: "#e397b5",
  morado: "#715189", marrón: "#765241", café: "#765241",
};

function ColorLabel({ color }: { color: string }) {
  const name = color.trim().toLocaleLowerCase("es");
  const swatch = /^#[0-9a-f]{6}$/.test(name) ? name : Object.hasOwn(knownColors, name) ? knownColors[name] : undefined;
  return <>{swatch && <span className="color-chip" style={{ backgroundColor: swatch }} aria-hidden="true" />}{color}</>;
}

export default function FashionPicker({ items, pick, disabled, sell = false }: {
  items: Item[];
  pick: (item: Item) => void;
  disabled?: boolean;
  sell?: boolean;
}) {
  const models = [...new Set(items.filter((item) => item.kind === "apparel").map((item) => item.fields.model!))];
  const [selection, setSelection] = useState("");
  const model = models.includes(selection) ? selection : models[0] ?? "";
  const variants = useRecords<Item>("items", { active: true, variantModel: model }, !!model);
  if (!model) return null;
  const sizes = [...new Set(variants.items.map((item) => item.fields.size!))].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  const colors = [...new Set(variants.items.map((item) => item.fields.color!))].sort((a, b) => a.localeCompare(b, "es"));
  return (
    <section className="variant-picker fashion-matrix">
      <h3>Disponibilidad por talla y color</h3>
      <label>Modelo de esta página del catálogo
        <select value={model} onChange={(event) => setSelection(event.target.value)}>
          {models.map((name) => <option key={name}>{name}</option>)}
        </select>
      </label>
      <Pager page={variants} />
      {!!variants.items.length && <div className="table-scroll">
        <table>
          <caption className="sr-only">Existencias de {model} por talla y color</caption>
          <thead><tr><th scope="col">Talla</th>{colors.map((color) => <th scope="col" key={color}><ColorLabel color={color} /></th>)}</tr></thead>
          <tbody>{sizes.map((size) => (
            <tr key={size}><th scope="row">{size}</th>{colors.map((color) => (
              <td key={color}>
                {variants.items.filter((item) => item.fields.size === size && item.fields.color === color).map((item) => (
                  <button key={item.id} type="button" disabled={disabled || (sell && compare(item.balance, ZERO) <= 0)}
                    onClick={() => pick(item)} aria-label={`${item.name}, ${displayQuantity(item.balance)} disponibles, ${bob(item.priceMinor)}`}>
                    <strong>{item.balance.n === "0" ? "Agotado" : `${displayQuantity(item.balance)} disponibles`}</strong><small>{bob(item.priceMinor)}</small>
                    {item.details?.profile && <small>{[item.details.profile.sizeSystem, item.details.profile.shoeWidth].filter(Boolean).join(" · ")}</small>}
                    {item.fields.reference && <small>{item.fields.reference}</small>}
                  </button>
                ))}
              </td>
            ))}</tr>
          ))}</tbody>
        </table>
      </div>}
    </section>
  );
}
