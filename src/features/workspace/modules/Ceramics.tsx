import type { ReactNode } from "react";
export default function Ceramics({ children }: { children: ReactNode }) {
  return (
    <>
      <section className="model-note">
        <h2>Cerámicas</h2>
        <p>
          Una ficha por referencia, tono y calibre. Cotiza por m² con merma de
          0–30 % y entrega por piezas o cajas completas. La venta muestra la
          cobertura efectiva; para mezclar tonos selecciona explícitamente cada
          ficha.
        </p>
      </section>
      {children}
    </>
  );
}
