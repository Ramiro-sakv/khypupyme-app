import type { ReactNode } from "react";
export default function Timber({ children }: { children: ReactNode }) {
  return (
    <>
      <section className="model-note">
        <h2>Maderas</h2>
        <p>
          Piezas con dimensiones reales en mm o stock por volumen. Cotiza y
          vende por pieza, m³ o pie tablar; se muestran las piezas realmente
          entregadas. Registra cortes como servicios.
        </p>
      </section>
      {children}
    </>
  );
}
