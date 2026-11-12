import type { CartLine } from "./Cart";

export function PackageQuantity({ line, update }: { line: CartLine; update: (patch: Partial<CartLine>) => void }) {
  const unitsPerBox = Number(line.item.units.box!.n);
  const current = line.packages ?? (line.unit === "box"
    ? { boxes: Number(line.qty), pieces: 0 } : { boxes: 0, pieces: Number(line.qty) });
  function set(key: keyof typeof current, value: number) {
    const packages = { ...current, [key]: value };
    update({ packages, unit: "piece", qty: String(packages.boxes * unitsPerBox + packages.pieces) });
  }
  return <div className="workspace-grid">
    <label>Cajas completas<input type="number" min={0} max={1000000} step={1} value={current.boxes} onChange={(e) => set("boxes", e.target.valueAsNumber || 0)} /></label>
    <label>Unidades sueltas<input type="number" min={0} max={1000000} step={1} value={current.pieces} onChange={(e) => set("pieces", e.target.valueAsNumber || 0)} /></label>
    <small>1 caja = {unitsPerBox} unidades · {current.boxes * unitsPerBox + current.pieces} unidades en total</small>
  </div>;
}

export function PrintQuantity({ line, update }: { line: CartLine; update: (patch: Partial<CartLine>) => void }) {
  const current = line.print ?? { copies: Number(line.qty) || 1, faces: 1, duplex: false };
  function set(patch: Partial<typeof current>) {
    const print = { ...current, ...patch };
    update({ print, qty: String(print.copies * print.faces) });
  }
  return <div className="workspace-grid">
    <label>Copias<input type="number" min={1} max={10000} step={1} value={current.copies} onChange={(e) => set({ copies: e.target.valueAsNumber || 0 })} /></label>
    <label>Caras por copia<input type="number" min={1} max={10000} step={1} value={current.faces} onChange={(e) => set({ faces: e.target.valueAsNumber || 0 })} /></label>
    <label><input type="checkbox" checked={current.duplex} onChange={(e) => set({ duplex: e.target.checked })} /> Doble cara</label>
    <small>{current.copies * current.faces} caras impresas · {current.copies * (current.duplex ? Math.ceil(current.faces / 2) : current.faces)} hojas</small>
  </div>;
}
