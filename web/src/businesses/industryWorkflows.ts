import type { BusinessView } from "./BusinessWorkspace";
import type { IndustryId } from "./industryThemes";
import type { IconName } from "../ui/Icon";

export type IndustryAction = readonly [view: BusinessView, label: string, detail: string, icon: IconName, focus?: string];
type Operations = { title: string; actions: readonly IndustryAction[] };
type CoreIndustry = "timber" | "convenience" | "clothing" | "appliances";

export const industryOperations: Record<Exclude<IndustryId, CoreIndustry>, Operations> = {
  grocery: { title: "Reposición y rotación", actions: [
    ["compras", "Recibir mercadería", "Compra por caja, peso o volumen según el producto.", "parcel"],
    ["catalogo", "Revisar lotes", "Consulta fechas y cantidades por lote antes de vender.", "calendar", "expiring"],
    ["ventas", "Abrir el lector", "Añade por código y revisa el carrito.", "barcode", "scan"],
  ] },
  beverages: { title: "Despachos y retornables", actions: [
    ["compras", "Recibir cajas y sueltos", "Registra la presentación que llegó del proveedor.", "parcel"],
    ["envases", "Ver envases por recuperar", "Busca la devolución pendiente de un cliente.", "bottles", "pending"],
    ["entregas", "Preparar despachos", "Revisa lo que sale de tienda hoy.", "calendar", "today"],
  ] },
  cosmetics: { title: "Tonos y lotes", actions: [
    ["catalogo", "Buscar marca, presentación o tono", "Abre la ficha para comparar etiquetas y fechas de lote.", "cosmetic"],
    ["catalogo", "Revisar lotes apartados", "Consulta el motivo antes de liberar o dar de baja.", "archive", "held"],
    ["compras", "Registrar un lote", "Captura el vencimiento declarado por el fabricante.", "parcel"],
  ] },
  pets: { title: "Alimento fraccionado", actions: [
    ["ventas", "Vender desde el lote de origen", "Elige el lote de la bolsa que estás fraccionando.", "paw"],
    ["compras", "Recibir bolsas o latas", "Registra la identificación y la fecha de la etiqueta.", "parcel"],
    ["catalogo", "Ver reposición de alimento", "Consulta el saldo vendible en la unidad de la ficha.", "grid", "reorder"],
  ] },
  footwear: { title: "Pares y cambios", actions: [
    ["catalogo", "Consultar tallas y colores", "Abre el modelo para comprobar la disponibilidad de cada combinación.", "shoe"],
    ["historial", "Buscar la venta para un cambio", "Selecciona el par devuelto y revisa el reemplazo.", "archive", "sales"],
    ["catalogo", "Ver variantes sin stock", "Detecta las tallas agotadas antes de ofrecerlas.", "grid", "empty"],
  ] },
  electronics: { title: "Equipos y accesorios", actions: [
    ["compras", "Recibir equipos", "Introduce una lista de series y añade accesorios por cantidad.", "parcel"],
    ["series", "Consultar una serie", "Abre compra, venta, garantía y devolución de la unidad.", "chip"],
    ["series", "Ver equipos en inspección", "Consulta las unidades retenidas antes de ofrecerlas.", "tools", "inspection"],
  ] },
  hardware: { title: "Mostrador y estantes", actions: [
    ["catalogo", "Encontrar por referencia o estante", "Busca también por medida antes de ofrecer la pieza.", "search"],
    ["compras", "Recibir piezas o rollos", "La ficha declara cuántos metros entran por rollo.", "parcel"],
    ["catalogo", "Preparar reposición", "Abre las fichas que llegaron al mínimo.", "grid", "reorder"],
  ] },
  spareParts: { title: "Referencias y compatibilidad", actions: [
    ["catalogo", "Buscar por vehículo", "Filtra por marca, modelo y año y compara equivalencias.", "wheel"],
    ["ventas", "Vender un repuesto", "Confirma la compatibilidad cuando falten datos de la ficha.", "cart"],
    ["catalogo", "Consultar referencias agotadas", "Revisa el stock por código o referencia.", "search", "empty"],
  ] },
  stationery: { title: "Mostrador e impresión", actions: [
    ["ventas", "Cobrar artículos e impresión", "Combina productos por pieza y servicios por cara.", "print"],
    ["ayuda", "Consultar el ejemplo a doble cara", "Separa lo que se cobra por cara de las hojas que se usan.", "help"],
    ["catalogo", "Revisar tarifas y productos", "Consulta tamaño, color y tarifa configurados.", "grid", "catalog"],
  ] },
  furniture: { title: "Cotizaciones y despachos", actions: [
    ["cotizaciones", "Cotizar muebles", "Confirma dimensiones y disponibilidad antes de ofrecer un retiro.", "chair"],
    ["entregas", "Preparar retiros y entregas", "Abre la venta y marca el pedido preparado.", "parcel", "pending"],
    ["catalogo", "Consultar piezas terminadas", "Revisa las dimensiones y el saldo de cada ficha.", "grid"],
  ] },
  ceramics: { title: "Cobertura, tono y calibre", actions: [
    ["cotizaciones", "Calcular y cotizar", "Revisa superficie, merma y número de cajas.", "tile"],
    ["catalogo", "Consultar tono y calibre", "Compara el saldo de la combinación que vas a ofrecer.", "grid"],
    ["entregas", "Ver despachos preparados", "Confirma lo que ya está listo para retirar.", "parcel", "prepared"],
  ] },
  cement: { title: "Bolsas, lotes y granel", actions: [
    ["catalogo", "Abrir bolsas desde el lote", "La ficha habilitada muestra el peso y el valor transferidos.", "sack"],
    ["ventas", "Vender por bolsa o peso", "Usa la ficha que corresponde a lo que entregas.", "cart"],
    ["catalogo", "Consultar reposición", "Revisa el saldo vendible antes de comprometer un pedido.", "grid", "reorder"],
  ] },
  beauty: { title: "Agenda del salón", actions: [
    ["trabajos", "Nueva cita", "Define servicio, hora y duración.", "calendar", "new"],
    ["trabajos", "Ver la agenda de hoy", "Abre la cita para atender, reprogramar o cancelar.", "calendar", "today"],
    ["ventas", "Atender sin cita", "Cobra servicios y productos en la misma venta.", "cart"],
  ] },
  cleaning: { title: "Cuadrar trabajos y materiales", actions: [
    ["trabajos", "Programar limpieza", "Guarda dirección, tareas y materiales previstos.", "calendar", "new"],
    ["trabajos", "Revisar trabajos pendientes", "Consulta lo atrasado antes de asignar la próxima visita.", "briefcase", "overdue"],
    ["trabajos", "Cobrar trabajos listos", "Revisa los materiales que se cargarán en la venta.", "cash", "billable"],
  ] },
  professional: { title: "Entregables y compromisos", actions: [
    ["trabajos", "Registrar un compromiso", "Define entregables, presupuesto y fecha pactada.", "document", "new"],
    ["trabajos", "Revisar la próxima semana", "Confirma qué entregables siguen pendientes.", "calendar", "upcoming"],
    ["trabajos", "Cobrar trabajo terminado", "Abre la orden y confirma una sola venta vinculada.", "cash", "billable"],
  ] },
  repair: { title: "Recepciones y reparaciones", actions: [
    ["trabajos", "Recibir un equipo", "Registra falla, accesorios y constancia de recepción.", "wrench", "new"],
    ["trabajos", "Ver trabajos en espera de repuestos", "Consulta qué falta antes de retomar la reparación.", "tools", "waiting-parts"],
    ["trabajos", "Revisar equipos listos para cobrar", "Abre la orden y reúne repuestos y mano de obra.", "cash", "billable"],
  ] },
  crafts: { title: "Piezas listas y encargos", actions: [
    ["trabajos", "Tomar un encargo", "Acuerda especificaciones, fecha prometida y presupuesto.", "craft", "new"],
    ["trabajos", "Ver encargos próximos", "Revisa la fecha pactada antes de tomar otro pedido.", "calendar", "upcoming"],
    ["ventas", "Vender piezas listas", "Cobra artículos que ya están disponibles.", "cart"],
  ] },
};

export function operationsFor(industry: string): Operations | undefined {
  return industryOperations[industry as keyof typeof industryOperations];
}
