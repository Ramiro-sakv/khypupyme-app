import type { ReactNode } from "react";
import { useWorkspace } from "../context";
import { useWorkspaceNavigation } from "../navigation";
export default function Appliances({ children }: { children: ReactNode }) {
  const { business } = useWorkspace();
  const { go } = useWorkspaceNavigation();
  return (
    <>
      {business.industryId === "appliances" ? <section className="industry-workbench appliances-workbench">
        <div><h2>Equipos por modelo y serie</h2><p>Registra las series al comprar y selecciona el equipo exacto al vender.</p></div>
        <div className="actions">
          <button onClick={() => go("garantias")}>Garantías por serie</button>
          <button onClick={() => go("garantias", { atencion: "inspeccion" })}>En inspección</button>
        </div>
      </section> : <section className="model-note"><h2>Equipos y accesorios</h2><p>Controla las series de cada equipo y su garantía.</p></section>}
      {children}
    </>
  );
}
