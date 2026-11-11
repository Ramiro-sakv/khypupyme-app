import { useState } from "react";
import type { CartLine } from "./Cart";
import { serials } from "./format";

export default function SerialReceipt({ value, update }: {
  value: string[];
  update: (patch: Partial<CartLine>) => void;
}) {
  const [entry, setEntry] = useState({ text: "", parsed: "" });
  const signature = value.join("\n");
  const duplicate = new Set(value.map((serial) => serial.toUpperCase())).size !== value.length;
  return (
    <label>
      Series recibidas · una por equipo
      <textarea required spellCheck={false} autoComplete="off"
        placeholder={"SN-0001\nSN-0002"}
        aria-invalid={duplicate || value.length > 100 || undefined}
        value={entry.parsed === signature ? entry.text : signature}
        onChange={(event) => {
          const text = event.target.value;
          const next = serials(text);
          setEntry({ text, parsed: next.join("\n") });
          update({ serials: next, qty: String(next.length) });
        }} />
      <small role="status">{value.length} equipos · pega una lista con líneas, comas o punto y coma.</small>
      {duplicate && <small role="alert">Hay series repetidas. Corrige la lista. [400]</small>}
      {value.length > 100 && <small role="alert">Divide la recepción en grupos de hasta 100 equipos. [400]</small>}
    </label>
  );
}
