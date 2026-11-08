import type {
  CommandResult,
  WorkspaceBusiness,
  WorkspaceCommand,
  WorkspaceQuery,
  WorkspaceReport,
} from "./model.js";
export const TUTORIAL_VERSION = 2;
export interface TutorialStep {
  id: string;
  chapter: string;
  title: string;
  view: string;
  target: string;
  text: string;
  kind?: WorkspaceCommand["kind"];
  reference?: string;
  pdf?: boolean;
  module?: string;
  allowedKinds?: WorkspaceCommand["kind"][];
}
const step = (
  id: string,
  chapter: string,
  title: string,
  view: string,
  target: string,
  text: string,
  kind?: WorkspaceCommand["kind"],
  reference?: string,
): TutorialStep => ({
  id,
  chapter,
  title,
  view,
  target,
  text,
  ...(kind ? { kind } : {}),
  ...(reference ? { reference } : {}),
});
export const LEGACY_TIMBER_STEPS: TutorialStep[] = [
  step(
    "welcome",
    "1 · Conocer el negocio",
    "Conoce Inicio",
    "inicio",
    "dashboard",
    "Esta es una práctica vacía. Verás inventario, ventas y caja del ejercicio. Al terminar se eliminará toda esta práctica.",
  ),
  step(
    "help",
    "1 · Conocer el negocio",
    "Explora las herramientas",
    "guia",
    "industry-guide",
    "Revisa la ayuda y el diagrama. Trabajaremos con pulgadas y pies; el volumen se expresa en pies tablares.",
  ),
  step(
    "units",
    "1 · Conocer el negocio",
    "Elige tus medidas",
    "negocio",
    "timber-preferences",
    "Guarda Pulgadas y pies (recomendado) o Métrica. La preferencia cambia captura y presentación, no las existencias.",
    "timber-preferences",
  ),
  step(
    "customer",
    "2 · Preparar catálogo y cliente",
    "Crea un cliente",
    "clientes",
    "new-customer",
    "Registra Cliente de práctica. No escribas datos personales reales. Deja teléfono y notas vacíos o usa notas ficticias.",
    "customer",
    "customer",
  ),
  step(
    "wood",
    "2 · Preparar catálogo y cliente",
    "Registra la tabla",
    "inventario",
    "new-item",
    "Crea Tabla de pino, especie Pino: espesor 2 pulgadas, ancho 6 pulgadas, largo 10 pies. Son 10 pies tablares por pieza. Precio Bs 10 por pie tablar; mínimo 3 piezas; comienza sin existencias. En métrico: largo 3048, ancho 152,4 y espesor 50,8 mm.",
    "create-item",
    "wood",
  ),
  step(
    "stock-view",
    "2 · Preparar catálogo y cliente",
    "Consulta la ficha y el historial",
    "inventario",
    "product-detail",
    "Abre Gestionar de Tabla de pino. Revisa unidades, precio, existencia cero y su historial; todavía no hay compras. No cambies sus datos.",
  ),
  step(
    "cash-open",
    "3 · Caja y compras",
    "Abre la caja",
    "caja",
    "cash-form",
    "Abre la caja con Bs 1.000 como fondo ficticio. Abrirla no es una venta ni una ganancia.",
    "open-cash",
  ),
  step(
    "purchase",
    "3 · Caja y compras",
    "Compra madera",
    "compras",
    "trade-form",
    "Selecciona Tabla de pino. Unidad: piezas; cantidad: 10; costo unitario: Bs 50. Paga Bs 500 en efectivo y confirma el importe. Usa una fecha del ejercicio, no futura.",
    "purchase",
  ),
  step(
    "purchase-view",
    "3 · Caja y compras",
    "Comprueba la compra",
    "compras",
    "purchase-history",
    "Consulta el detalle de la compra y su referencia. Ahora hay 10 piezas (100 pies tablares), valor Bs 500 y costo promedio Bs 50 por pieza.",
  ),
  step(
    "quote",
    "4 · Cotizar y vender",
    "Prepara la cotización",
    "cotizaciones",
    "trade-form",
    "Selecciona dos piezas de Tabla de pino y Cliente de práctica, sin descuento. El importe es Bs 200. Revisa la vigencia y emite la cotización: no reserva ni descuenta madera.",
    "quote",
    "quote",
  ),
  step(
    "sale",
    "4 · Cotizar y vender",
    "Convierte la cotización en venta",
    "cotizaciones",
    "quote-history",
    "Abre Cotizaciones anteriores y Revisar y convertir a venta. Conserva dos piezas, cliente y precio; cobra Bs 200 en efectivo. Al confirmar quedarán 8 piezas y Bs 700 en caja.",
    "sale",
    "cashSale",
  ),
  step(
    "sale-view",
    "4 · Cotizar y vender",
    "Consulta tu venta",
    "ventas",
    "sales-history",
    "Revisa el registro de la venta y abre Detalle y devolución. Ahí se conserva la evidencia original; no se borran ventas normales.",
  ),
  step(
    "return",
    "5 · Devoluciones, fiados y gastos",
    "Registra una devolución",
    "ventas",
    "sales-history",
    "En la venta anterior devuelve 1 pieza, con reingreso a stock, reembolso en efectivo y motivo Devolución de práctica. Recuperas una tabla y devuelves Bs 100.",
    "return",
  ),
  step(
    "credit",
    "5 · Devoluciones, fiados y gastos",
    "Vende a crédito",
    "ventas",
    "trade-form",
    "Crea una venta nueva de 1 pieza a Cliente de práctica, sin descuento. Forma de pago: Fiado. Se descuentan existencias, pero todavía no entra efectivo.",
    "sale",
    "creditSale",
  ),
  step(
    "collect",
    "5 · Devoluciones, fiados y gastos",
    "Cobra el saldo completo",
    "fiados",
    "debts",
    "Cobra en efectivo los Bs 100 pendientes. El cobro no registra otra venta ni vuelve a descontar inventario.",
    "collect",
  ),
  step(
    "expense",
    "5 · Devoluciones, fiados y gastos",
    "Registra un gasto",
    "gastos",
    "expense-form",
    "Registra Transporte de práctica, categoría Transporte, Bs 20 pagados en efectivo. Las compras de inventario son diferentes de los gastos operativos.",
    "expense",
  ),
  step(
    "cut-service",
    "6 · Cortes y entregas",
    "Crea el servicio de corte",
    "inventario",
    "new-item",
    "Crea el servicio Corte, precio Bs 20 y costo directo Bs 5; mínimo cero. Es un servicio sin existencias. Cobrarlo no crea ni consume piezas automáticamente.",
    "create-item",
    "service",
  ),
  step(
    "order",
    "6 · Cortes y entregas",
    "Recibe una orden",
    "ordenes",
    "new-order",
    "Crea Corte de práctica para Cliente de práctica, con descripción y fecha comprometida. Presupuesto Bs 20; estado Recibido.",
    "work-order",
    "order",
  ),
  step(
    "order-quote",
    "6 · Cortes y entregas",
    "Presupuesta el trabajo",
    "ordenes",
    "work-orders",
    "Actualiza la orden a Presupuestado, manteniendo Bs 20 y el mismo cliente. Aún no hay cobro.",
    "work-order",
  ),
  step(
    "order-approve",
    "6 · Cortes y entregas",
    "Registra la aprobación",
    "ordenes",
    "work-orders",
    "Actualiza esa orden a Aprobado. Su historial conserva cada revisión.",
    "work-order",
  ),
  step(
    "order-work",
    "6 · Cortes y entregas",
    "Realiza el trabajo",
    "ordenes",
    "work-orders",
    "Cambia la orden a En trabajo. No se descuentan materiales automáticamente.",
    "work-order",
  ),
  step(
    "order-ready",
    "6 · Cortes y entregas",
    "Deja el corte listo",
    "ordenes",
    "work-orders",
    "Cambia la orden a Listo. Ahora podrás preparar una única venta vinculada.",
    "work-order",
  ),
  step(
    "order-sale",
    "6 · Cortes y entregas",
    "Cobra el corte",
    "ordenes",
    "work-orders",
    "Pulsa Preparar venta de este trabajo. Selecciona una unidad del servicio Corte, sin descuento, y cobra Bs 20 en efectivo. Conserva Cliente de práctica.",
    "operational-sale",
  ),
  step(
    "delivery",
    "6 · Cortes y entregas",
    "Programa la entrega",
    "entregas",
    "new-delivery",
    "Programa la entrega de la venta a crédito que ya cobraste (no la venta con devolución). Dirección: Obra de práctica; estado Pendiente. No vuelve a descontar madera.",
    "delivery",
    "delivery",
  ),
  step(
    "delivery-prepared",
    "6 · Cortes y entregas",
    "Prepara el envío",
    "entregas",
    "deliveries",
    "Actualiza la entrega a Preparada. Los datos comerciales de la venta permanecen iguales.",
    "delivery",
  ),
  step(
    "delivery-done",
    "6 · Cortes y entregas",
    "Confirma la entrega",
    "entregas",
    "deliveries",
    "Actualiza la entrega a Entregada. No hay un segundo cobro ni otro movimiento de existencias.",
    "delivery",
  ),
  step(
    "reports",
    "7 · Resultados y cierre",
    "Lee los resultados",
    "informes",
    "reports",
    "Consulta desde el inicio de esta práctica hasta hoy. Ventas netas: Bs 220; costo vendido: Bs 105; gastos: Bs 20; resultado estimado: Bs 95. No confundir resultado con efectivo.",
  ),
  step(
    "inventory-document",
    "7 · Resultados y cierre",
    "Emite el informe de inventario",
    "informes",
    "reports",
    "Pulsa Emitir informe de inventario PDF. Deben quedar 8 tablas, 80 pies tablares y Bs 400 de inventario.",
    "report-document",
  ),
  step(
    "result-document",
    "7 · Resultados y cierre",
    "Emite el informe de resultados",
    "informes",
    "reports",
    "Pulsa Emitir informe de resultados PDF. Crear o regenerar un informe no repite ventas.",
    "report-document",
  ),
  {
    ...step(
      "pdf",
      "7 · Resultados y cierre",
      "Guarda un documento de práctica",
      "documentos",
      "pdf-export",
      "Revisa los datos conservados y usa Guardar / compartir PDF. Debe llevar PRÁCTICA — DATOS FICTICIOS. Un archivo guardado fuera de la app no se borra al terminar.",
    ),
    pdf: true,
  },
  step(
    "cash-close",
    "7 · Resultados y cierre",
    "Cierra la caja",
    "caja",
    "cash-form",
    "El efectivo esperado es Bs 700. Cuenta ese importe ficticio y confirma el cierre con Bs 700. Una caja cerrada no admite nuevas operaciones.",
    "close-cash",
  ),
  step(
    "review",
    "7 · Resultados y cierre",
    "Interpreta Inicio y termina",
    "inicio",
    "dashboard",
    "Revisa los indicadores del ejercicio: stock, fiados ya cobrados, resultado y caja cerrada. Pulsa Siguiente y luego Finalizar y borrar práctica para regresar a tu negocio sin estos movimientos.",
  ),
];
export const TUTORIAL_MODULES = [
  { id: "inventory", title: "Preparar inventario", needsStock: false },
  { id: "selling", title: "Vender madera", needsStock: true },
  { id: "clients", title: "Clientes y fiados", needsStock: true },
  { id: "quotes", title: "Cotizaciones y devoluciones", needsStock: true },
  { id: "cash", title: "Caja y gastos", needsStock: false },
  { id: "work", title: "Cortes y entregas", needsStock: true },
  { id: "reports", title: "Informes y documentos", needsStock: false },
];
const lesson = (
  module: string,
  id: string,
  title: string,
  view: string,
  target: string,
  text: string,
  kind?: WorkspaceCommand["kind"],
  reference?: string,
  allowedKinds?: WorkspaceCommand["kind"][],
): TutorialStep => ({
  ...step(
    id,
    TUTORIAL_MODULES.find((m) => m.id === module)!.title,
    title,
    view,
    target,
    text,
    kind,
    reference,
  ),
  module,
  ...(allowedKinds ? { allowedKinds } : {}),
});
export const TIMBER_STEPS: TutorialStep[] = [
  lesson(
    "inventory",
    "orientation",
    "Tu espacio de práctica",
    "inicio",
    "dashboard",
    "Estas pantallas son las mismas de tu negocio, pero los datos de esta práctica están separados. Puedes elegir un recorrido, pausar o terminar cuando quieras.",
  ),
  lesson(
    "inventory",
    "catalogue",
    "Registra una especie",
    "inventario",
    "new-item",
    "Crea una ficha de especie, por ejemplo Pino, y declara sus tres tarifas por pie tablar. Los espesores se indican al recibir madera; todavía no se crean existencias.",
    "create-item",
    "wood",
  ),
  lesson(
    "inventory",
    "supply",
    "Registra las medidas recibidas",
    "compras",
    "trade-form",
    "Selecciona la especie y añade grupos de espesores, largos enteros de 1 a 20 pies y anchos, con su costo. Sugerencia: largo 10 pies; anchos 6; 8; 10. Si pagas en efectivo, abre primero la caja. También puedes registrar una entrada con costo y motivo desde Inventario.",
    "purchase",
    undefined,
    ["purchase", "stock-adjust", "open-cash"],
  ),
  lesson(
    "selling",
    "sell",
    "Prepara y confirma una venta",
    "ventas",
    "trade-form",
    "Añade una especie y espesor, el largo y los anchos de las piezas disponibles. Otro largo o especie va en otro grupo del mismo comprobante. Revisa piezas, pies tablares e importe. Cliente ocasional está permitido al contado.",
    "sale",
    "cashSale",
    ["sale", "customer", "open-cash"],
  ),
  lesson(
    "selling",
    "sale-result",
    "Consulta lo registrado",
    "ventas",
    "sales-history",
    "Consulta el comprobante y las existencias que realmente quedaron. Los totales dependen de las medidas y cantidades que elegiste.",
  ),
  lesson(
    "clients",
    "customer",
    "Registra un cliente",
    "clientes",
    "new-customer",
    "Sugerencia: usa un nombre ficticio. El nombre es libre y el teléfono opcional. Al vender también puedes crear y seleccionar al cliente sin perder el carrito.",
    "customer",
    "customer",
  ),
  lesson(
    "clients",
    "credit",
    "Registra una venta fiada",
    "ventas",
    "trade-form",
    "Selecciona madera disponible y un cliente registrado. Elige Fiado. Las existencias disminuyen, pero el efectivo todavía no entra.",
    "sale",
    "creditSale",
    ["sale", "customer"],
  ),
  lesson(
    "clients",
    "collect",
    "Cobra el saldo completo",
    "fiados",
    "debts",
    "Selecciona el fiado y cobra el saldo que aparece. No escribas un importe de ejemplo: el saldo procede de tu venta. Abre caja si eliges efectivo.",
    "collect",
    undefined,
    ["collect", "open-cash"],
  ),
  lesson(
    "quotes",
    "quote",
    "Prepara una oferta",
    "cotizaciones",
    "trade-form",
    "Elige medidas, tarifa, cliente ocasional o registrado y vigencia. Son datos libres. La cotización no reserva existencias.",
    "quote",
    "quote",
    ["quote", "customer"],
  ),
  lesson(
    "quotes",
    "convert",
    "Convierte tu oferta",
    "cotizaciones",
    "quote-history",
    "Abre Cotizaciones anteriores y revisa la oferta antes de convertirla. Se comprueban de nuevo precio y disponibilidad; una oferta vencida necesita nueva cotización.",
    "sale",
    "quotedSale",
    ["sale", "open-cash"],
  ),
  lesson(
    "quotes",
    "return",
    "Registra una devolución",
    "ventas",
    "sales-history",
    "Abre Detalle y devolución. Elige las medidas y piezas realmente devueltas, su destino y motivo. El reintegro se calcula desde la venta original, sin superar lo vendido.",
    "return",
    undefined,
    ["return", "open-cash"],
  ),
  lesson(
    "cash",
    "cash-open",
    "Abre o consulta la caja",
    "caja",
    "cash-form",
    "Sugerencia: declara un fondo ficticio que permita pagar tus operaciones. Si ya hay caja abierta, revisa su saldo y continúa desde el instructor.",
    "open-cash",
  ),
  lesson(
    "cash",
    "expense",
    "Registra un gasto",
    "gastos",
    "expense-form",
    "Sugerencia: Transporte. El concepto, categoría e importe son libres. El efectivo requiere caja abierta y saldo suficiente; una compra de madera no es un gasto operativo.",
    "expense",
    undefined,
    ["expense", "open-cash"],
  ),
  lesson(
    "cash",
    "cash-close",
    "Cuenta y cierra la caja",
    "caja",
    "cash-form",
    "Usa el efectivo esperado que aparece en pantalla y registra lo que contaste. Si hay diferencia, explica el motivo. No se exige un importe fijo.",
    "close-cash",
  ),
  lesson(
    "work",
    "service",
    "Prepara un servicio de corte",
    "inventario",
    "new-item",
    "Elige Servicio. Sugerencia: Corte, con el precio y costo directo que quieras practicar. El servicio no crea piezas ni descuenta madera automáticamente.",
    "create-item",
    "service",
  ),
  lesson(
    "work",
    "order",
    "Recibe y sigue una orden",
    "ordenes",
    "work-orders",
    "Crea una orden con cliente, descripción y presupuesto. Registra sus avances hasta Listo. Guardar estados no mueve dinero ni inventario.",
    "work-order",
    "order",
    ["work-order", "customer"],
  ),
  lesson(
    "work",
    "order-sale",
    "Cobra el trabajo",
    "ordenes",
    "work-orders",
    "En la orden lista, pulsa Preparar venta de este trabajo. Añade el servicio realizado y confirma su cobro. La misma orden no puede facturarse dos veces.",
    "operational-sale",
    undefined,
    ["operational-sale", "open-cash"],
  ),
  lesson(
    "work",
    "delivery",
    "Programa y completa una entrega",
    "entregas",
    "deliveries",
    "Elige una venta de productos válida, completa la dirección y sigue los estados hasta Entregada. Esto no vuelve a cobrar ni descontar existencias.",
    "delivery",
  ),
  lesson(
    "reports",
    "report-view",
    "Lee tus resultados",
    "informes",
    "reports",
    "Elige el periodo de esta práctica. Las ventas, costos, gastos, resultado e inventario son los calculados desde tus registros; no hay una cifra fija que debas conseguir.",
  ),
  lesson(
    "reports",
    "report-document",
    "Emite un informe",
    "informes",
    "reports",
    "Elige el informe de inventario o resultados. Generar documentos no repite operaciones comerciales.",
    "report-document",
  ),
  {
    ...lesson(
      "reports",
      "pdf",
      "Guarda un documento",
      "documentos",
      "pdf-export",
      "Revisa un documento y pulsa Guardar o compartir. Lleva PRÁCTICA — DATOS FICTICIOS. El archivo guardado fuera de la app no se elimina al terminar.",
    ),
    pdf: true,
  },
];
export const tutorialSteps = (version: number) =>
  version === 1 ? LEGACY_TIMBER_STEPS : TIMBER_STEPS;
export interface TutorialSession {
  id: string;
  sourceBusinessId: string;
  practiceBusinessId: string | null;
  version: number;
  status: "active" | "paused" | "closing" | "completed" | "abandoned";
  stepIndex: number;
  revision: number;
  references: Record<string, string>;
  doneSteps?: string[];
  startedOn: string;
  expiresAt: string;
  finishedAt: string | null;
}
export interface TutorialState {
  session: TutorialSession | null;
  business: WorkspaceBusiness | null;
}
export interface TutorialControl {
  kind:
    | "start"
    | "resume"
    | "pause"
    | "advance"
    | "finish"
    | "abandon"
    | "module";
  moduleId?: string;
  operationId: string;
  sessionId: string;
  expectedRevision: number;
  stepId: string;
}
export type TutorialRequest = { sourceBusinessId: string } & (
  | { action: "current"; payload: Record<string, never> }
  | { action: "control"; payload: TutorialControl }
  | { action: "business"; payload: { sessionId: string } }
  | {
      action: "command" | "status";
      payload: { sessionId: string; command: WorkspaceCommand };
    }
  | { action: "list"; payload: { sessionId: string; query: WorkspaceQuery } }
  | {
      action: "report";
      payload: { sessionId: string; from: string; to: string };
    }
);
export interface TutorialReply {
  state: TutorialState;
  acknowledged?: boolean;
  result?: CommandResult | null;
  page?: { items: unknown[]; next: string | null };
  report?: WorkspaceReport;
}
