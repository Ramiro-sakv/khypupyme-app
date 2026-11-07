import type { ReactNode } from "react";
import { useWorkspace } from "../context";
export default function Timber({ children }: { children: ReactNode }) {
  const { business } = useWorkspace();
  return (
    <>
      <section className="model-note">
        <h2>Maderas</h2>
        <p>
          {business.timberSystem === "metric"
            ? "Dimensiones métricas y volumen en m³."
            : "Espesor y ancho en pulgadas, largo en pies y volumen en pies tablares."}{" "}
          Agrupa por especie y espesor; añade largos y anchos en la misma venta.
          Se controlan piezas y volumen. Los productos anteriores conservan sus
          unidades; los cortes son servicios, sin despiece automático.
        </p>
      </section>
      {children}
    </>
  );
}
