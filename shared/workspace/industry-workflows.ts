import type { IndustryId } from "../business-industries.js";
export interface IndustryGuide {
  title: string;
  visual:
    | "lots"
    | "flow"
    | "fashion"
    | "timber"
    | "ceramics"
    | "cement"
    | "serial"
    | "calendar";
  steps: string[];
  example: string;
  caution: string;
}
export const INDUSTRY_GUIDES: Record<IndustryId, IndustryGuide> = {
  convenience: {
    title: "Vender rápido y reponer a tiempo",
    visual: "lots",
    steps: [
      "Crear el producto con su código y unidades por caja",
      "Recibir cajas o unidades e indicar lote y vencimiento",
      "Añadir al carrito con el lector y revisar la cantidad disponible",
      "Revisar productos vencidos y por vencer en Inventario",
    ],
    example:
      "Recibe dos cajas de 12 botellas. Escanea tres botellas al vender y confirma el cobro. La venta toma primero el lote más próximo a vencer.",
    caution: "No vendas productos vencidos ni registres compras como gastos.",
  },
  grocery: {
    title: "Presentaciones y productos por peso",
    visual: "lots",
    steps: [
      "Definir unidades o venta por kg",
      "Registrar cajas o kg realmente recibidos",
      "Vender unidades o peso declarado",
      "Revisar vencimientos y reposición",
    ],
    example:
      "Una caja de 12 unidades se incorpora como 12 piezas; 0,750 kg conserva su cantidad exacta.",
    caution: "El costo se declara por la unidad elegida en la compra.",
  },
  beverages: {
    title: "Vender bebidas y controlar envases",
    visual: "flow",
    steps: [
      "Comprar unidades o cajas",
      "Registrar envases propios disponibles",
      "Vender y anotar envases prestados al cliente",
      "Registrar su devolución y revisar pendientes",
    ],
    example:
      "Presta 24 botellas a un cliente; al devolver 12 quedan 12 pendientes.",
    caution:
      "Los envases aquí solo controlan cantidades: no representan depósitos ni cobros.",
  },
  clothing: {
    title: "Un modelo, muchas variantes",
    visual: "fashion",
    steps: [
      "Crear un modelo con tallas y colores en Inventario",
      "Comprar cada variante recibida",
      "Elegir el modelo y tocar la talla y el color con existencias",
      "Buscar la venta original e iniciar el cambio de variante",
    ],
    example:
      "Vende una polera M azul. Si el cliente necesita talla L, abre el comprobante e inicia un cambio de una unidad. La caja registra la diferencia.",
    caution: "No mezcles tallas distintas en una misma ficha.",
  },
  footwear: {
    title: "Disponibilidad por talla y por par",
    visual: "fashion",
    steps: [
      "Registrar modelo y talla",
      "Comprar pares por variante",
      "Revisar disponibilidad antes de vender",
      "Cambiar talla vinculando la venta",
    ],
    example:
      "Un par talla 39 se cambia por talla 40 mediante devolución y nueva venta relacionadas.",
    caution:
      "Una unidad es un par completo; no registres cada zapato como un par.",
  },
  furniture: {
    title: "Cotizar, vender y entregar muebles",
    visual: "flow",
    steps: [
      "Registrar medidas y piezas terminadas",
      "Preparar cotización",
      "Confirmar venta",
      "Programar entrega y registrar su estado",
    ],
    example: "Vende una mesa y deja su entrega preparada para mañana.",
    caution:
      "Marcar entregado no vuelve a descontar inventario; cancelar la entrega no anula la venta.",
  },
  cosmetics: {
    title: "Cuidar lotes y vencimientos",
    visual: "lots",
    steps: [
      "Definir marca y presentación",
      "Recibir productos por lote",
      "Vender unidades disponibles",
      "Revisar vencimientos y pérdidas con motivo",
    ],
    example:
      "Dos lotes del mismo producto tienen fechas distintas; revisa cuál debe salir primero.",
    caution:
      "Utiliza la fecha declarada por el fabricante; no supongas una vida útil universal.",
  },
  timber: {
    title: "De las dimensiones a la cotización",
    visual: "timber",
    steps: [
      "Registrar especie y dimensiones reales",
      "Comprar piezas o volumen",
      "Cotizar por pieza, m³ o pie tablar",
      "Registrar un corte como servicio u orden",
    ],
    example:
      "Una tabla de 2 pulgadas de espesor, 6 pulgadas de ancho y 10 pies de largo contiene 10 pies tablares.",
    caution:
      "Las dimensiones declaradas de la ficha son inmutables; un corte no genera automáticamente piezas nuevas.",
  },
  ceramics: {
    title: "De la superficie a las cajas",
    visual: "ceramics",
    steps: [
      "Registrar referencia, tono y calibre",
      "Comprar cajas o piezas del mismo tono",
      "Calcular superficie y merma",
      "Revisar cobertura realmente entregada",
    ],
    example:
      "Para 12 m² con 10 % de merma y cajas de 1,44 m² se necesitan 10 cajas completas.",
    caution: "No mezcles tonos o calibres sin seleccionarlos expresamente.",
  },
  cement: {
    title: "Bolsas y granel sin perder masa",
    visual: "cement",
    steps: [
      "Registrar marca, tipo y peso",
      "Comprar bolsas por lote",
      "Abrir bolsas hacia la ficha de granel",
      "Vender bolsas completas o kg de granel",
    ],
    example:
      "Abrir 2 bolsas de 50 kg transforma 2 bolsas en 100 kg y conserva su valor.",
    caution:
      "La apertura usa origen y destino compatibles; no crea cemento ni una compra nueva.",
  },
  hardware: {
    title: "Encontrar referencias y reponer",
    visual: "flow",
    steps: [
      "Registrar referencia y ubicación",
      "Comprar piezas o cajas",
      "Buscar por nombre, código o referencia",
      "Revisar productos bajo el mínimo",
    ],
    example:
      "Ubica tornillos en el estante A2 y revisa su mínimo antes de comprar.",
    caution:
      "Esta entrega trabaja piezas y cajas; no convierte cables a metros.",
  },
  appliances: {
    title: "Seguir cada equipo por su serie",
    visual: "serial",
    steps: [
      "Crear ficha de marca y modelo",
      "Pegar una serie por equipo al registrar la compra",
      "Seleccionar la serie que se entregará al vender",
      "Buscar la serie para consultar compra, venta, garantía o devolución",
    ],
    example:
      "Recibe las series DEMO-REF-001 y DEMO-REF-002. Vende la primera y busca esa serie cuando el cliente consulte la garantía.",
    caution:
      "Un equipo devuelto queda en inspección hasta liberar su disponibilidad.",
  },
  electronics: {
    title: "Accesorios y equipos identificados",
    visual: "serial",
    steps: [
      "Elegir accesorio común o equipo con serie",
      "Recibir unidades o series",
      "Vender el equipo concreto",
      "Atender garantía cuando corresponda",
    ],
    example:
      "Un cargador usa stock por unidades; una tablet conserva su número de serie.",
    caution:
      "No exijas series a todos los accesorios ni vendas dos veces el mismo equipo.",
  },
  spareParts: {
    title: "Encontrar el repuesto compatible",
    visual: "flow",
    steps: [
      "Registrar referencia y equivalencias",
      "Anotar marca, modelo y años compatibles",
      "Consultar existencias",
      "Vender después de confirmar la aplicación",
    ],
    example: "Filtro R-100: compatibilidad declarada Toyota Corolla 2010–2015.",
    caution:
      "La compatibilidad la declara el negocio; no es una verificación automática del fabricante.",
  },
  stationery: {
    title: "Artículos y servicios por página",
    visual: "flow",
    steps: [
      "Registrar artículos y presentaciones",
      "Definir impresión como servicio por página",
      "Comprar artículos y vender o copiar",
      "Revisar reposición y caja",
    ],
    example: "Vende un cuaderno y 20 servicios de impresión de una página.",
    caution: "Un servicio de impresión no descuenta papel automáticamente.",
  },
  pets: {
    title: "Alimentos envasados o por peso",
    visual: "lots",
    steps: [
      "Definir kg o unidades por producto",
      "Registrar lote y vencimiento",
      "Vender la cantidad solicitada",
      "Revisar alimentos próximos a vencer",
    ],
    example: "Compra alimento a granel en kg y vende 1,250 kg.",
    caution:
      "Esta aplicación no registra historias clínicas ni tratamientos veterinarios.",
  },
  beauty: {
    title: "Una agenda clara, un cobro vinculado",
    visual: "calendar",
    steps: [
      "Crear servicios y duración",
      "Agendar un cliente en horario libre",
      "Marcar asistencia o cancelación",
      "Preparar la venta de la atención",
    ],
    example:
      "Agenda un corte de 30 minutos; al atenderlo registra una única venta vinculada.",
    caution:
      "Programar una cita no cobra; los horarios activos de la misma agenda no pueden cruzarse.",
  },
  cleaning: {
    title: "Organizar cada trabajo de limpieza",
    visual: "calendar",
    steps: [
      "Registrar servicio y cliente",
      "Crear orden con dirección y tareas",
      "Aprobar presupuesto y completar trabajo",
      "Preparar su venta y cobro",
    ],
    example:
      "Limpieza de oficina: baños, escritorios y piso, con fecha comprometida.",
    caution:
      "La lista de materiales es una previsión; no consume inventario hasta una venta explícita.",
  },
  professional: {
    title: "Trabajos y entregables por cliente",
    visual: "calendar",
    steps: [
      "Definir servicios de importe acordado",
      "Crear trabajo con entregables y fecha",
      "Revisar presupuesto y avance",
      "Registrar la venta al completar",
    ],
    example:
      "Asesoría: reunión, informe y entrega final por el importe presupuestado.",
    caution:
      "El tiempo puede describirse en la orden; no se calculan honorarios automáticos por hora.",
  },
  repair: {
    title: "Recibir, diagnosticar, reparar y entregar",
    visual: "serial",
    steps: [
      "Identificar equipo y falla declarada",
      "Diagnosticar y presupuestar",
      "Registrar aprobación y reparación",
      "Vender repuestos y mano de obra; entregar",
    ],
    example:
      "Reparación de ventilador con repuesto y servicio en una venta vinculada.",
    caution:
      "No registres una venta al recibir el equipo; una orden ya facturada no se factura otra vez.",
  },
  crafts: {
    title: "Pedidos personalizados hasta la entrega",
    visual: "flow",
    steps: [
      "Registrar piezas terminadas y servicios",
      "Anotar especificaciones del pedido",
      "Aprobar presupuesto y completar encargo",
      "Vender y registrar entrega",
    ],
    example: "Pedido de dos piezas decorativas con color y fecha acordados.",
    caution:
      "No se incluyen recetas, consumo automático de materiales ni producción industrial.",
  },
};
