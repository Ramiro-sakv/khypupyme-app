import type { ReactNode } from "react";
import { useWorkspace } from "../context";
import { ActionForm, Field } from "../ui";
import { cents } from "../format";
import { ZERO } from "../../../../shared/workspace/exact";
export default function Fashion({ children }: { children: ReactNode }) {
  const { business, run, busy } = useWorkspace();
  return (
    <>
      <section className="model-note">
        <h2>Ropa y calzado</h2>
        <p>
          Stock, precio y costo por talla y color. Los cambios se vinculan a la
          venta original.
        </p>
        <details>
          <summary>Crear matriz de variantes</summary>
          <ActionForm
            disabled={busy}
            label="Crear variantes sin existencias"
            onSave={(d) => {
              const sizes = String(d.get("sizes"))
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
                colors = String(d.get("colors"))
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
                model = String(d.get("model"));
              if (
                !sizes.length ||
                !colors.length ||
                sizes.length * colors.length > 50
              )
                throw new Error(
                  "Indica hasta 50 combinaciones de talla y color.",
                );
              return run({
                kind: "variants",
                input: {
                  items: sizes.flatMap((size) =>
                    colors.map((color) => ({
                      name: `${model} ${size} ${color}`,
                      kind: "apparel" as const,
                      fields: {
                        model,
                        reference: "",
                        size,
                        color,
                        pair:
                          business.industryId === "footwear" ? "par" : "pieza",
                      },
                      barcode: "",
                      priceMinor: cents(d.get("price")),
                      priceUnit:
                        business.industryId === "footwear"
                          ? ("pair" as const)
                          : ("piece" as const),
                      minimum: ZERO,
                      serviceCostMinor: 0,
                    })),
                  ),
                },
              });
            }}
          >
            <Field name="model" label="Modelo" />
            <Field name="sizes" label="Tallas separadas por coma" />
            <Field name="colors" label="Colores separados por coma" />
            <Field
              name="price"
              label="Precio inicial BOB (editable por variante)"
            />
          </ActionForm>
        </details>
      </section>
      {children}
    </>
  );
}
