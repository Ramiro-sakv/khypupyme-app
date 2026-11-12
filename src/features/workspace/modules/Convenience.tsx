import type { ReactNode } from "react";
import { useWorkspace } from "../context";
import { useWorkspaceNavigation } from "../navigation";
export default function Convenience({ children }: { children: ReactNode }) {
  const { business } = useWorkspace();
  const { go } = useWorkspaceNavigation();
  return (
    <>
      {business.industryId === "convenience" ? <section className="industry-workbench store-workbench">
        <div><h2>Mostrador de tienda</h2><p>Escanea un artículo o elige su presentación en el catálogo.</p></div>
        <div className="actions">
          <button onClick={() => go("inventario", { atencion: "reposicion" })}>Reposición</button>
          <button onClick={() => go("inventario", { atencion: "vencimientos" })}>Lotes y vencimientos</button>
        </div>
      </section> : <section className="model-note"><h2>Lotes y presentaciones</h2><p>Elige la unidad de cada artículo. Los lotes disponibles con vencimiento más cercano salen primero.</p></section>}
      {children}
    </>
  );
}
