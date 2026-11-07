import {
  timberTotals,
  timberSelectionText,
  timberVolumeLabel,
} from "../../../shared/workspace/timber-groups.js";
import { timberDimensions } from "../../../shared/workspace/timber-measures.js";
import type { TimberSystem } from "../../../shared/workspace/timber-measures.js";
import { canonical, today } from "../../../shared/commerce.js";
import {
  add,
  amount,
  ceil,
  compare,
  div,
  fraction,
  mul,
  whole,
  ZERO,
  showQuantity,
} from "../../../shared/workspace/exact.js";

import {
  isDiscrete,
  UNITS,
  ITEM_MODELS,
} from "../../../shared/workspace/catalog.js";
import type {
  Customer,
  Method,
  ReturnInput,
  SaleLineInputV2,
  SaleLineV2,
  SaleV2,
  WorkspaceCommand,
} from "../../../shared/workspace/model.js";
import { money } from "../../../shared/workspace/validation.js";
import type { UnitOfWork } from "./UnitOfWork.js";
import { InventoryServiceV2 } from "./InventoryService.js";
import type { Serial } from "./InventoryService.js";
import type { CashService } from "./CashService.js";
import type { Documents } from "./Documents.js";

export interface Debt {
  id: string;
  customerId: string;
  customerName: string;
  amountMinor: number;
  date: string;
  description: string;
  status: "pending" | "paid" | "cancelled";
  origin: "sale" | "manual";
  createdAt: string;
  paymentMethod?: Method;
}
interface Quote {
  id: string;
  number: string;
  lines: SaleLineInputV2[];
  customerId: string;
  customerName: string;
  discountMinor: number;
  validUntil: string;
  status: "issued" | "converted";
  saleId: string;
  createdAt: string;
}
const displayMoney = (minor: number) =>
  `Bs ${(minor / 100).toFixed(2).replace(".", ",")}`;
function deliveryText(line: SaleLineV2) {
  if (line.timber)
    return (
      timberTotals(line.fields.thicknessMm!, line.timber).pieces +
      " piezas · " +
      timberVolumeLabel(line.delivered)
    );
  const byVolume =
    ["timber-volume", "cement-bulk"].includes(line.kind) ||
    (line.kind === "grocery" && line.fields.weighted === "si");
  const base = byVolume
    ? showQuantity(div(line.delivered, line.units[line.requestedUnit]!)) +
      " " +
      UNITS[line.requestedUnit]
    : showQuantity(line.delivered) + " " + line.baseUnit;
  return (
    base +
    (line.kind === "ceramic"
      ? " · cobertura " +
        showQuantity(div(line.delivered, line.units.m2!)) +
        " m²"
      : "")
  );
}
function detailText(line: SaleLineV2, system: TimberSystem = "imperial") {
  if (line.timber)
    return (
      line.fields.species +
      " · " +
      timberSelectionText(line.fields.thicknessMm!, line.timber, system)
    );
  return [
    ...(line.kind === "timber-piece"
      ? [line.fields.species, timberDimensions(line.fields, system)]
      : [
          ITEM_MODELS[line.kind].fields
            .filter((f) => line.fields[f.key])
            .map((f) => f.label + ": " + line.fields[f.key])
            .join(" · "),
        ]),
    ...Object.values(line.details ?? {}).filter(Boolean),
  ]
    .filter(Boolean)
    .join(" · ");
}
export function pastDate(date: string) {
  if (date > today()) throw new Error("La fecha no puede estar en el futuro.");
}
export class TradeService {
  constructor(
    private readonly work: UnitOfWork,
    private readonly inventory: InventoryServiceV2,
    private readonly cash: CashService,
    private readonly documents: Documents,
    private readonly operationId: string,
  ) {}
  async customer(id: string, fallback: string) {
    if (!id) return fallback;
    const customer = await this.work.get<Customer>("customersV2", id);
    if (!customer?.active)
      throw new Error("Selecciona un cliente activo de este negocio.");
    return customer.name;
  }
  async planLine(
    input: SaleLineInputV2,
    consume: boolean,
    saleId: string,
  ): Promise<SaleLineV2> {
    const item = await this.inventory.item(input.itemId);
    if (!item.active)
      throw new Error("Reactiva el producto antes de venderlo.");
    if (item.priceMinor !== input.expectedPriceMinor)
      throw new Error(
        `Cambió el precio de ${item.name}. Actualiza y confirma el nuevo importe.`,
      );
    if (item.kind === "timber-grouped") {
      if (
        !input.timber ||
        input.unit !== "piece" ||
        input.serials.length ||
        input.fullBoxes ||
        input.wastePercent
      )
        throw new Error("Revisa las medidas de la madera.");
      const totals = this.inventory.timber.validate(
        item,
        input.timber,
        input.qty,
      );
      const stock = consume
        ? await this.inventory.timber.consume(
            item,
            input.timber,
            input.qty,
            saleId,
          )
        : { costMinor: 0, allocations: [] };
      const grossMinor = money(
        amount(input.timber.priceMinor, totals.boardFeet),
        false,
      );
      return {
        itemId: item.id,
        name: item.name,
        ...(item.details ? { details: item.details } : {}),
        kind: item.kind,
        fields: item.fields,
        timber: input.timber,
        units: item.units,
        requested: input.qty,
        requestedUnit: "piece",
        delivered: totals.volume,
        baseUnit: item.baseUnit,
        charged: totals.boardFeet,
        priceUnit: "boardFoot",
        priceMinor: input.timber.priceMinor,
        catalogPriceMinor: item.priceMinor,
        grossMinor,
        netMinor: grossMinor,
        costMinor: stock.costMinor,
        allocations: stock.allocations,
        returned: ZERO,
        refundedMinor: 0,
        restoredCostMinor: 0,
        warrantyUntil: "",
      };
    }
    if (input.timber)
      throw new Error("Este producto no admite medidas agrupadas.");
    let requested = input.qty;
    if (item.kind === "ceramic" && input.unit === "m2")
      requested = mul(
        requested,
        fraction(BigInt(100 + input.wastePercent), 100n),
      );
    let delivered = this.inventory.toBase(item, requested, input.unit);
    if (isDiscrete(item) && !whole(delivered)) {
      if (
        ["ceramic", "timber-piece"].includes(item.kind) &&
        ["m2", "m3", "boardFoot"].includes(input.unit)
      )
        delivered = ceil(delivered);
      else throw new Error("Esta cantidad no corresponde a piezas completas.");
    }
    if (item.kind === "ceramic" && input.fullBoxes)
      delivered = mul(ceil(div(delivered, item.units.box!)), item.units.box!);
    const charged = div(delivered, item.units[item.priceUnit]!),
      grossMinor = money(amount(item.priceMinor, charged), false);
    const stock =
      consume && item.kind !== "service"
        ? await this.inventory.consume(
            item.id,
            delivered,
            input.serials,
            saleId,
            "Venta",
          )
        : {
            costMinor:
              item.kind === "service"
                ? amount(item.serviceCostMinor, delivered)
                : 0,
            allocations: [],
          };
    if (item.kind === "service" && input.serials.length)
      throw new Error("Un servicio no utiliza series.");
    return {
      itemId: item.id,
      name: item.name,
      ...(item.details ? { details: item.details } : {}),
      kind: item.kind,
      fields: item.fields,
      units: item.units,
      requested: input.qty,
      requestedUnit: input.unit,
      delivered,
      baseUnit: item.baseUnit,
      charged,
      priceUnit: item.priceUnit,
      priceMinor: item.priceMinor,
      grossMinor,
      netMinor: grossMinor,
      costMinor: stock.costMinor,
      allocations: stock.allocations,
      returned: ZERO,
      refundedMinor: 0,
      restoredCostMinor: 0,
      warrantyUntil: "",
    };
  }
  private async lines(
    inputs: SaleLineInputV2[],
    discount: number,
    consume: boolean,
    id: string,
  ) {
    const plain = inputs.filter((line) => !line.timber);
    if (new Set(plain.map((line) => line.itemId)).size !== plain.length)
      throw new Error(
        "Agrupa cada producto convencional en una sola línea de la venta.",
      );
    const lines: SaleLineV2[] = [];
    for (const input of inputs)
      lines.push(await this.planLine(input, consume, id));
    const gross = money(lines.reduce((sum, line) => sum + line.grossMinor, 0));
    if (discount > gross)
      throw new Error("El descuento supera el importe de los productos.");
    let allocated = 0,
      cumulativeGross = 0;
    lines.forEach((line, index) => {
      cumulativeGross += line.grossMinor;
      const target =
        index === lines.length - 1
          ? discount
          : amount(discount, fraction(BigInt(cumulativeGross), BigInt(gross)));
      const part = target - allocated;
      allocated = target;
      line.netMinor = line.grossMinor - part;
      if (line.netMinor < 0)
        throw new Error("El descuento no puede distribuirse entre las líneas.");
    });
    return {
      lines,
      totalMinor: gross - discount,
      costMinor: money(lines.reduce((sum, line) => sum + line.costMinor, 0)),
    };
  }
  async quote(input: Extract<WorkspaceCommand, { kind: "quote" }>["input"]) {
    const span =
      (Date.parse(input.validUntil) - Date.parse(today())) / 86400000;
    if (span < 0 || span > 366)
      throw new Error(
        "La vigencia debe estar entre hoy y los próximos 366 días.",
      );
    const customerName = await this.customer(
        input.customerId,
        input.customerName,
      ),
      data = await this.lines(
        input.lines,
        input.discountMinor,
        false,
        this.operationId,
      );
    const document = await this.documents.issue(
      "COT",
      "Cotización",
      ["Producto", "Solicitado", "Entrega", "Importe"],
      data.lines.map((line) => [
        line.kind === "timber-piece"
          ? line.name +
            " · " +
            timberDimensions(line.fields, this.documents.timberSystem)
          : line.name,
        `${showQuantity(line.requested)} ${UNITS[line.requestedUnit]}`,
        deliveryText(line),
        displayMoney(line.netMinor),
      ]),
      [{ label: "Total", minor: data.totalMinor }],
      `Cliente: ${customerName || "Sin nombre"}. Válida hasta ${input.validUntil}. No reserva existencias.`,
    );
    this.work.set("quotes", this.operationId, {
      id: this.operationId,
      number: document.number,
      ...input,
      customerName,
      status: "issued",
      saleId: "",
      totalMinor: data.totalMinor,
      createdAt: this.work.now,
    });
    return document;
  }
  async sale(
    input: Extract<WorkspaceCommand, { kind: "sale" }>["input"],
    id = this.operationId,
    postPayment = true,
  ) {
    pastDate(input.date);
    const customerName = await this.customer(
      input.customerId,
      input.customerName,
    );
    if (
      input.method === "credit" &&
      (!input.customerId || customerName.length < 2)
    )
      throw new Error("Indica el cliente de la venta fiada.");
    if (input.quoteId) {
      const quote = await this.work.get<Quote>("quotes", input.quoteId);
      if (!quote || quote.status !== "issued" || quote.validUntil < today())
        throw new Error("La cotización no está vigente o ya fue convertida.");
      if (
        canonical(quote.lines.map((line) => ({ ...line, serials: [] }))) !==
          canonical(input.lines.map((line) => ({ ...line, serials: [] }))) ||
        quote.discountMinor !== input.discountMinor ||
        quote.customerId !== input.customerId ||
        quote.customerName !== customerName
      )
        throw new Error(
          "La venta debe respetar la cotización. Emite otra si cambió la oferta.",
        );
    }
    const data = await this.lines(input.lines, input.discountMinor, true, id);
    if (input.method === "credit" && data.totalMinor === 0)
      throw new Error("Una venta gratuita no genera un fiado.");
    for (const line of data.lines)
      if (line.kind === "appliance") {
        const months = Number(line.fields.warrantyMonths),
          date = new Date(input.date + "T12:00:00Z"),
          day = date.getUTCDate();
        date.setUTCDate(1);
        date.setUTCMonth(date.getUTCMonth() + months);
        const last = new Date(
          Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
        ).getUTCDate();
        date.setUTCDate(Math.min(day, last));
        line.warrantyUntil = months ? date.toISOString().slice(0, 10) : "";
      }
    const document = await this.documents.issue(
      id === this.operationId ? "REC" : "CAM",
      "Comprobante de venta",
      ["Producto y detalle", "Cantidad entregada", "Precio", "Importe"],
      data.lines.map((line) => [
        `${line.name} · ${detailText(line, this.documents.timberSystem)}${line.allocations.some((a) => a.serial) ? " · Series: " + line.allocations.map((a) => a.serial).join(", ") : ""}${line.warrantyUntil ? " · Garantía declarada hasta " + line.warrantyUntil : ""}`,
        deliveryText(line),
        displayMoney(line.priceMinor) + "/" + UNITS[line.priceUnit],
        displayMoney(line.netMinor),
      ]),
      [
        { label: "Descuento", minor: input.discountMinor },
        { label: "Total", minor: data.totalMinor },
      ],
      `Cliente: ${customerName || "Sin nombre"}. Fecha de venta: ${input.date}. Medio: ${input.method}.`,
    );
    const sale: SaleV2 = {
      id,
      number: document.number,
      ...data,
      customerId: input.customerId,
      customerName,
      date: input.date,
      method: input.method,
      discountMinor: input.discountMinor,
      status: "active",
      createdAt: this.work.now,
    };
    this.work.set("salesV2", id, sale);
    if (input.quoteId) {
      const quote = await this.work.get<Quote>("quotes", input.quoteId);
      this.work.set("quotes", quote!.id, {
        ...quote,
        status: "converted",
        saleId: id,
      });
    }
    if (input.method === "credit")
      this.work.set("debts", id, {
        id,
        customerId: input.customerId,
        customerName,
        amountMinor: data.totalMinor,
        date: input.date,
        description: `Venta ${document.number}`,
        status: "pending",
        origin: "sale",
        createdAt: this.work.now,
      });
    else if (postPayment)
      await this.cash.post(data.totalMinor, input.method, "sale", id);
    return { sale, document };
  }
  async purchase(
    input: Extract<WorkspaceCommand, { kind: "purchase" }>["input"],
  ) {
    pastDate(input.date);
    const lines = [];
    let totalMinor = 0;
    for (const entry of input.lines) {
      const item = await this.inventory.item(entry.itemId),
        received = await this.inventory.receive(
          item.id,
          entry,
          this.operationId,
        );
      totalMinor = money(totalMinor + received.totalMinor);
      lines.push({
        ...entry,
        ...received,
        name: item.name,
        ...(item.details ? { details: item.details } : {}),
        fields: item.fields,
      });
    }
    await this.cash.post(
      -totalMinor,
      input.method,
      "purchase",
      this.operationId,
    );
    const document = await this.documents.issue(
      "COM",
      "Registro de compra",
      ["Producto", "Cantidad", "Costo unitario", "Importe"],
      lines.map((line) => [
        line.timber
          ? line.name +
            " · " +
            timberSelectionText(
              line.fields.thicknessMm!,
              line.timber,
              this.documents.timberSystem,
            )
          : line.fields.lengthMm
            ? line.name +
              " · " +
              timberDimensions(line.fields, this.documents.timberSystem)
            : line.name,
        line.timber
          ? timberTotals(line.fields.thicknessMm!, line.timber).pieces +
            " piezas · " +
            timberVolumeLabel(line.baseQty)
          : `${showQuantity(line.qty)} ${UNITS[line.unit]}`,
        displayMoney(line.unitCostMinor) + (line.timber ? " / pie tablar" : ""),
        displayMoney(line.totalMinor),
      ]),
      [{ label: "Total pagado", minor: totalMinor }],
      `Fecha: ${input.date}. Referencia: ${input.reference || "Sin referencia"}. Medio: ${input.method}.`,
    );
    this.work.set("purchasesV2", this.operationId, {
      id: this.operationId,
      number: document.number,
      ...input,
      lines,
      itemIds: [...new Set(lines.map((line) => line.itemId))],
      totalMinor,
      createdAt: this.work.now,
    });
    return document;
  }
  async returnSale(
    saleId: string,
    inputs: ReturnInput[],
    reason: string,
    method: Method,
    postPayment = true,
  ) {
    const sale = await this.work.get<SaleV2>("salesV2", saleId);
    if (!sale) throw new Error("La venta no pertenece a este negocio.");
    if (new Set(inputs.map((line) => line.line)).size !== inputs.length)
      throw new Error("No repitas líneas en la devolución.");
    let refundMinor = 0,
      costMinor = 0,
      lossMinor = 0;
    const rows: string[][] = [];
    for (const input of inputs) {
      const line = sale.lines[input.line];
      if (!line) throw new Error("Línea de venta inexistente.");
      const item = await this.inventory.item(line.itemId);
      let baseQty;
      if (line.kind === "timber-grouped") {
        if (
          !input.timber ||
          input.unit !== "piece" ||
          !line.timber ||
          input.serials.length ||
          input.timber.lengthMm !== line.timber.lengthMm
        )
          throw new Error(
            "Selecciona las medidas vendidas que devuelve el cliente.",
          );
        baseQty = this.inventory.timber.validate(
          item,
          input.timber,
          input.qty,
        ).volume;
      } else {
        if (input.timber || !line.units[input.unit])
          throw new Error("Unidad de devolución incompatible.");
        baseQty = this.inventory.toBase(
          { ...item, units: line.units },
          input.qty,
          input.unit,
        );
      }
      if (isDiscrete(item) && !whole(baseQty))
        throw new Error("Devuelve piezas completas.");
      const cumulative = add(line.returned, baseQty);
      if (compare(cumulative, line.delivered) > 0)
        throw new Error("La devolución supera la cantidad vendida pendiente.");
      const cumulativeRefund = amount(
          line.netMinor,
          div(cumulative, line.delivered),
        ),
        refund = cumulativeRefund - line.refundedMinor;
      let cost =
        amount(line.costMinor, div(cumulative, line.delivered)) -
        line.restoredCostMinor;
      if (line.kind === "appliance") {
        cost = 0;
        for (const id of input.serials) {
          const serial = await this.work.get<Serial>("serials", id);
          if (!serial || serial.saleId !== sale.id)
            throw new Error("La serie no corresponde a esta venta.");
          cost = money(cost + serial.costMinor);
        }
      }
      if (line.kind === "service") {
        if (input.restock)
          throw new Error("Los servicios no reingresan al inventario.");
      } else if (line.kind === "timber-grouped") {
        await this.inventory.timber.restock(
          item,
          input.timber!,
          input.qty,
          cost,
          line.allocations,
          input.restock,
          saleId,
        );
      } else
        await this.inventory.restock(
          item.id,
          baseQty,
          cost,
          line.allocations,
          input.serials,
          input.restock,
          saleId,
        );
      if (line.restoredCostMinor + cost > line.costMinor)
        throw new Error("El costo a restituir supera el costo histórico.");
      line.returned = cumulative;
      line.refundedMinor = cumulativeRefund;
      line.restoredCostMinor += cost;
      refundMinor = money(refundMinor + refund);
      costMinor = money(costMinor + cost);
      if (!input.restock) lossMinor = money(lossMinor + cost);
      rows.push([
        line.name +
          (input.timber
            ? " · " +
              timberSelectionText(
                line.fields.thicknessMm!,
                input.timber,
                this.documents.timberSystem,
              )
            : ""),
        `${showQuantity(div(baseQty, line.units[line.priceUnit]!))} ${UNITS[line.priceUnit]}`,
        input.restock
          ? line.kind === "appliance"
            ? "En inspección"
            : "Reingresa"
          : "No reingresa",
        displayMoney(refund),
      ]);
    }
    let effectiveRefund = refundMinor;
    if (sale.method === "credit") {
      const debt = await this.work.get<Debt>("debts", sale.id);
      if (!debt) throw new Error("No se encontró el fiado original.");
      if (debt.status === "pending") {
        if (debt.amountMinor < refundMinor)
          throw new Error("El reintegro supera el fiado pendiente.");
        this.work.set("debts", debt.id, {
          ...debt,
          amountMinor: debt.amountMinor - refundMinor,
          status: debt.amountMinor === refundMinor ? "cancelled" : "pending",
        });
        effectiveRefund = 0;
      } else if (debt.status !== "paid")
        throw new Error(
          "Consulta el estado del fiado antes de devolver esta venta.",
        );
    }
    sale.status = sale.lines.every(
      (line) => compare(line.returned, line.delivered) === 0,
    )
      ? "returned"
      : "active";
    this.work.set("salesV2", sale.id, sale);
    if (postPayment)
      await this.cash.post(-effectiveRefund, method, "return", saleId);
    const document = await this.documents.issue(
      "DEV",
      "Devolución de venta",
      ["Producto", "Cantidad", "Destino", "Reintegro"],
      rows,
      [
        { label: "Devolución comercial", minor: refundMinor },
        { label: "Dinero a devolver", minor: effectiveRefund },
      ],
      `Venta original: ${sale.number}. ${reason}`,
    );
    this.work.set("returns", this.operationId, {
      id: this.operationId,
      saleId,
      number: document.number,
      lines: inputs,
      refundMinor,
      costMinor,
      lossMinor,
      effectiveRefund,
      reason,
      method,
      date: today(),
      createdAt: this.work.now,
    });
    return { document, refundMinor, effectiveRefund };
  }
  async exchange(
    input: Extract<WorkspaceCommand, { kind: "exchange" }>["input"],
  ) {
    const returned = await this.returnSale(
      input.saleId,
      input.returns,
      input.reason,
      input.method,
      false,
    );
    const next = await this.sale(
      {
        lines: input.lines,
        method: input.method,
        date: today(),
        customerId: "",
        customerName: input.customerName,
        discountMinor: 0,
        quoteId: "",
      },
      `${this.operationId}-new`,
      false,
    );
    const difference = next.sale.totalMinor - returned.effectiveRefund;
    await this.cash.post(
      difference,
      input.method,
      "exchange",
      this.operationId,
    );
    this.work.set("exchanges", this.operationId, {
      id: this.operationId,
      previousSaleId: input.saleId,
      newSaleId: next.sale.id,
      returnId: this.operationId,
      differenceMinor: difference,
      createdAt: this.work.now,
    });
    return this.documents.issue(
      "DIF",
      "Diferencia del cambio",
      ["Devolución", "Venta nueva"],
      [[returned.document.number, next.document.number]],
      [{ label: "Diferencia cobrada (+) o devuelta (−)", minor: difference }],
      input.reason,
    );
  }
}
