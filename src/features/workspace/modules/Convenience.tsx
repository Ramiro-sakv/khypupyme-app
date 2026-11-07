import type { ReactNode } from "react";
export default function Convenience({ children }: { children: ReactNode }) {
  return (
    <>
      <section className="model-note">
        <h2>Tienda 24/7</h2>
        <p>
          Busca por código o usa un lector como teclado. El servidor entrega
          primero el lote con vencimiento más próximo y excluye lotes vencidos.
          La caja permanece abierta al cruzar medianoche; los productos por peso
          usan kg.
        </p>
      </section>
      {children}
    </>
  );
}
