import type { ReactNode } from "react";
export default function Appliances({ children }: { children: ReactNode }) {
  return (
    <>
      <section className="model-note">
        <h2>Electrodomésticos</h2>
        <p>
          Registra una serie por equipo comprado y selecciona las series al
          vender. El costo es específico de cada unidad. Las devoluciones quedan
          en inspección; la pestaña Garantías conserva su seguimiento.
        </p>
      </section>
      {children}
    </>
  );
}
