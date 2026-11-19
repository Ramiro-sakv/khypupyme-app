import type { IndustryId } from "./industryThemes";
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
      "Definir presentaciones y la unidad de venta",
      "Registrar cajas o kg realmente recibidos",
      "Vender unidades o peso declarado",
      "Revisar vencimientos y reposición",
    ],
    example:
      "Recibe dos cajas de 24 a Bs 120 por caja. Vende cinco a Bs 7 cada una y quedan 43.",
    caution: "El costo se declara por la unidad elegida en la compra.",
  },
  beverages: {
    title: "Vender bebidas y controlar envases",
    visual: "flow",
    steps: [
      "Comprar unidades o cajas",
      "Registrar envases propios disponibles",
      "Añadir cajas y unidades sueltas, y registrar el intercambio de envases en Revisar",
      "Registrar su devolución y revisar pendientes",
    ],
    example:
      "Una caja de 12 y tres botellas a Bs 8 suman Bs 120. Si entregas tres envases y luego recibes dos, queda uno pendiente.",
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
      "Vende un par talla 39 a Bs 180. Desde ese comprobante, cambia a un par talla 40 de Bs 200 y revisa los Bs 20 de diferencia.",
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
    example: "Vende una mesa de Bs 850 y añade armado por Bs 50. Desde la venta, programa un retiro o una entrega.",
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
      "Revisar vencimientos y apartar, liberar o dar de baja lotes con motivo",
    ],
    example:
      "Aparta un lote de tres cremas valorado en Bs 90. El valor se conserva mientras revisas su estado.",
    caution:
      "Utiliza la fecha declarada por el fabricante; no supongas una vida útil universal.",
  },
  timber: {
    title: "De las dimensiones a la cotización",
    visual: "timber",
    steps: [
      "Crear la ficha con nombre, especie y código",
      "Recibir piezas declarando largo, espesor y anchos",
      "Cotizar la madera y revisar la tarifa por pie tablar",
      "Añadir un corte como servicio en la venta",
    ],
    example:
      "Una tabla de 2 pulgadas de espesor, 6 pulgadas de ancho y 10 pies de largo contiene 10 pies tablares.",
    caution:
      "Un corte se cobra como servicio. Las existencias se descuentan por las medidas de madera vendidas.",
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
      "Para 12 m² con 10 % de merma se necesitan diez cajas de 1,44 m². A Bs 90 por caja, el total es Bs 900.",
    caution: "No mezcles tonos o calibres sin seleccionarlos expresamente.",
  },
  cement: {
    title: "Bolsas y granel sin perder masa",
    visual: "cement",
    steps: [
      "Registrar marca, tipo y peso",
      "Comprar bolsas por lote",
      "Elegir el lote y revisar kg y valor antes de abrir bolsas",
      "Vender bolsas completas o kg de granel",
    ],
    example:
      "Abrir dos bolsas de 50 kg valoradas en Bs 100 transfiere 100 kg con ese mismo valor y lote.",
    caution:
      "La apertura usa origen y destino compatibles; no crea cemento ni una compra nueva.",
  },
  hardware: {
    title: "Encontrar referencias y reponer",
    visual: "flow",
    steps: [
      "Registrar referencia y ubicación",
      "Comprar piezas, cajas o rollos según la ficha",
      "Buscar por nombre, código o referencia",
      "Revisar productos bajo el mínimo",
    ],
    example:
      "Recibe un rollo de 50 m a Bs 200. Vende 2,5 m a Bs 8/m y quedan 47,5 m.",
    caution:
      "Define los metros por rollo al crear el producto. Conserva esa equivalencia en las operaciones.",
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
      "Vende un cargador a Bs 35 por unidad. Para la tablet de Bs 450, elige la serie y consúltala luego en Garantías.",
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
    example: "Busca el filtro R-100 de Bs 65 por su referencia o por Corolla 2013, dentro del rango declarado 2010–2015.",
    caution:
      "La compatibilidad la declara el negocio; no es una verificación automática del fabricante.",
  },
  stationery: {
    title: "Artículos y servicios por página",
    visual: "flow",
    steps: [
      "Registrar artículos y presentaciones",
      "Configurar la tarifa por cara según tamaño y color",
      "Comprar artículos y vender o copiar",
      "Revisar reposición y caja",
    ],
    example: "Tres copias de cuatro caras a Bs 0,50 por cara suman Bs 6. A doble cara se usan seis hojas.",
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
    example: "Vende 1,250 kg a Bs 20/kg. El comprobante registra Bs 25 y el lote utilizado.",
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
      "Agenda un corte de 30 minutos a Bs 40. Marca la cita atendida y cobra desde ella.",
    caution:
      "Programar una cita no cobra; los horarios activos de la misma agenda no pueden cruzarse.",
  },
  cleaning: {
    title: "Organizar cada trabajo de limpieza",
    visual: "calendar",
    steps: [
      "Registrar servicio y cliente",
      "Crear orden con dirección, tareas y materiales previstos",
      "Aprobar presupuesto y completar trabajo",
      "Preparar su venta y cobro",
    ],
    example:
      "Una limpieza de Bs 150 con Bs 20 de productos cobrados se registra por Bs 170. Anota los materiales usados en la orden.",
    caution:
      "Registra el producto cobrado en la venta. Una salida interna se registra en Inventario con motivo.",
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
      "Registra una reunión y un informe en una orden de Bs 300. Cobra el trabajo cuando esté listo.",
    caution:
      "El tiempo puede describirse en la orden; no se calculan honorarios automáticos por hora.",
  },
  repair: {
    title: "Recibir, diagnosticar, reparar y entregar",
    visual: "serial",
    steps: [
      "Identificar equipo y falla declarada",
      "Diagnosticar y presupuestar",
      "Registrar aprobación, reparación o espera de repuesto",
      "Vender repuestos y mano de obra; entregar",
    ],
    example:
      "Emite la constancia al recibir el ventilador. Cobra Bs 80 de mano de obra y Bs 35 de repuesto en una sola venta.",
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
    example: "Recibe un encargo de dos piezas azules a Bs 75 cada una. Confirma la venta por Bs 150 al completar el pedido.",
    caution:
      "No se incluyen recetas, consumo automático de materiales ni producción industrial.",
  },
};
