import type { ReactNode } from "react";
import { useWorkspace } from "../context";
import { Icon } from "../Icon";
export default function Timber({ children }: { children: ReactNode }) {
  const { business } = useWorkspace();
  return (
    <>
      <section className="industry-workbench timber-workbench">
        <Icon name="box" />
        <div><h2>Barraca de madera</h2><p>Elige la especie y el espesor. Registra largos y anchos por grupo.</p></div>
        <span className="badge">{business.timberSystem === "metric" ? "Piezas y m³" : "Piezas y pies tablares"}</span>
      </section>
      {children}
    </>
  );
}
