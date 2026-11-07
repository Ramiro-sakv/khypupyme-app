import { useWorkspace } from "./context";
const guidance: Record<
  string,
  { purchase: string; sale: string; catalog: string }
> = {
  timber: {
    catalog:
      "Elige piezas con medidas reales o madera por volumen. Las dimensiones de las piezas se expresan en mm y no se cambian después del alta.",
    purchase:
      "Registra las piezas o el volumen realmente recibido y el costo por la unidad elegida. Mantén la especie y las dimensiones de cada ficha.",
    sale: "Puedes solicitar piezas, m³ o pies tablares. Revisa las piezas realmente entregadas y el importe. Los cortes se registran como servicios.",
  },
  clothing: {
    catalog:
      "Cada combinación de modelo, talla y color tiene su propio precio, costo y stock. Puedes preparar la matriz de variantes.",
    purchase:
      "Selecciona cada variante recibida en una línea separada. No mezcles tallas o colores en una misma ficha.",
    sale: "Comprueba talla, color y cantidad de cada variante. Un cambio se registra desde la venta original.",
  },
  footwear: {
    catalog:
      "Registra talla, color y modelo por variante, con existencias por par.",
    purchase:
      "Compra cada talla y color en su propia línea, indicando los pares recibidos y su costo.",
    sale: "Selecciona la talla y el color exactos. Los cambios se vinculan a la venta original.",
  },
  appliances: {
    catalog:
      "La ficha identifica marca, modelo y garantía comercial. Las existencias se incorporan con una serie por equipo.",
    purchase:
      "Escribe una serie distinta por cada equipo recibido. El costo queda asociado a cada unidad.",
    sale: "Selecciona las series disponibles que entregas al cliente. Un equipo devuelto queda en inspección hasta liberar su disponibilidad.",
  },
  convenience: {
    catalog:
      "Define si el producto se vende por unidades o por peso, y si exige vencimiento. El código permite buscar con un lector como teclado.",
    purchase:
      "Declara la presentación, el lote y su vencimiento cuando corresponda. Revisa el costo por la unidad seleccionada.",
    sale: "Se asignan primero los lotes con vencimiento más próximo y se excluyen los vencidos. La sesión de caja puede cruzar medianoche.",
  },
  ceramics: {
    catalog:
      "Mantén una ficha por referencia, tono y calibre. Indica piezas por caja y cobertura de la caja.",
    purchase:
      "Registra cajas completas o piezas, respetando la referencia, el tono y el calibre de la ficha.",
    sale: "Al solicitar m² puedes añadir merma de 0–30 %. Revisa las piezas o cajas completas y la cobertura efectivamente entregada. Mezclar tonos exige seleccionarlos expresamente.",
  },
  cement: {
    catalog:
      "Declara marca, tipo y peso de las bolsas. Si habilitaste granel, utiliza su ficha de destino para abrir bolsas.",
    purchase:
      "Indica bolsas o kg según la ficha, con lote y costo por la unidad recibida.",
    sale: "Vende bolsas completas o kg del producto a granel. La apertura de bolsas conserva masa, lote y valor y se registra desde el módulo de cemento.",
  },
};
export default function IndustryHelp({
  mode,
}: {
  mode: "purchase" | "sale" | "catalog";
}) {
  const { business } = useWorkspace(),
    text =
      guidance[business.industryId ?? ""]?.[mode] ??
      (mode === "catalog"
        ? "Define productos por unidad y servicios con su precio. Un servicio no lleva existencias."
        : mode === "purchase"
          ? "Declara cantidades, unidades y costo de los productos recibidos. Las compras de inventario no son gastos operativos."
          : "Revisa cantidades, precio, cliente y forma de pago. Las ventas fiadas se cobran completas más adelante.");
  return (
    <details className="industry-help-panel">
      <summary>Ayuda para trabajar con este rubro</summary>
      <p>{text}</p>
      <small>
        Las fichas especializadas conservan sus unidades y conversiones. Esta
        ayuda no cambia la configuración del negocio.
      </small>
    </details>
  );
}
