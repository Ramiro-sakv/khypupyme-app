import { searchPrefixes } from "../../../shared/workspace/search.js";
import { createHash } from "node:crypto";
import { today } from "../../../shared/commerce.js";
import {
  isDiscrete,
  itemUnits,
  kindsFor,
} from "../../../shared/workspace/catalog.js";
import {
  add,
  compare,
  decimal,
  div,
  fraction,
  mul,
  ONE,
  sub,
  whole,
  withdrawCost,
  ZERO,
  amount,
} from "../../../shared/workspace/exact.js";
import type { Quantity } from "../../../shared/workspace/exact.js";
import type {
  Allocation,
  Item,
  ItemDraft,
  Opening,
  Unit,
  WorkspaceBusiness,
} from "../../../shared/workspace/model.js";
import { money } from "../../../shared/workspace/validation.js";
import type { UnitOfWork } from "./UnitOfWork.js";

export interface Lot {
  id: string;
  itemId: string;
  lot: string;
  expiresOn: string;
  balance: Quantity;
  available: boolean;
  createdAt: string;
}
export interface Serial {
  id: string;
  itemId: string;
  serial: string;
  costMinor: number;
  status: "available" | "sold" | "inspection" | "written-off";
  saleId: string;
  createdAt: string;
}
export const hashKey = (value: string) =>
  createHash("sha256")
    .update(value.normalize("NFKC").toUpperCase())
    .digest("hex");
export class InventoryServiceV2 {
  private sequence = 0;
  constructor(
    readonly work: UnitOfWork,
    private readonly business: WorkspaceBusiness,
    private readonly operationId: string,
  ) {}
  async item(id: string): Promise<Item> {
    const item = await this.work.get<Item>("items", id);
    if (!item) throw new Error("No se encontró el producto en este negocio.");
    return item;
  }
  toBase(item: Item, qty: Quantity, unit: Unit): Quantity {
    const conversion = item.units[unit];
    if (!conversion) throw new Error("Unidad incompatible con el producto.");
    if (
      ["piece", "pair", "box", "bag", "service"].includes(unit) &&
      !whole(qty)
    )
      throw new Error(
        "Piezas, pares, cajas y bolsas completas requieren cantidades enteras.",
      );
    return mul(qty, conversion);
  }
  private checkBase(item: Item, qty: Quantity) {
    if (compare(qty, ZERO) <= 0 || (isDiscrete(item) && !whole(qty)))
      throw new Error(
        "La cantidad no corresponde a unidades completas del producto.",
      );
  }
  async create(id: string, draft: ItemDraft): Promise<Item> {
    if (!kindsFor(this.business).includes(draft.kind))
      throw new Error(
        "Este modelo de producto no pertenece al rubro del negocio.",
      );
    if (
      draft.kind === "grocery" &&
      draft.fields.weighted === "si" &&
      !this.business.answers.weighted
    )
      throw new Error("La venta por peso no está habilitada en este negocio.");
    if (await this.work.get("items", id))
      throw new Error("El producto ya existe.");
    if (draft.barcode) {
      const index = hashKey(draft.barcode);
      if (await this.work.get("barcodeIndex", index))
        throw new Error("Ese código ya pertenece a otro producto del negocio.");
      this.work.set("barcodeIndex", index, {
        itemId: id,
        barcode: draft.barcode,
      });
    }
    if (draft.kind === "apparel") {
      const modelId = hashKey(draft.fields.model!),
        variantId = hashKey(
          `${modelId}|${draft.fields.size}|${draft.fields.color}|${draft.fields.pair}`,
        );
      if (await this.work.get("variantIndex", variantId))
        throw new Error("Ya existe esa talla y color para el modelo.");
      this.work.set("models", modelId, {
        id: modelId,
        name: draft.fields.model,
        kind: "apparel",
      });
      this.work.set("variantIndex", variantId, { itemId: id, modelId });
    }
    if (isDiscrete(draft) && !whole(draft.minimum))
      throw new Error("El mínimo debe usar unidades completas.");
    const item: Item = {
      ...draft,
      ...itemUnits(draft),
      id,
      active: true,
      balance: ZERO,
      valueMinor: 0,
      createdAt: this.work.now,
      updatedAt: this.work.now,
    };
    this.work.set("items", id, {
      ...item,
      searchPrefixes: searchPrefixes([
        item.name,
        item.barcode,
        ...Object.values(item.fields),
        ...Object.values(item.details ?? {}),
      ]),
    });
    this.movement(item, ZERO, 0, "opening", "Creación de producto", id);
    return item;
  }
  movement(
    item: Item,
    delta: Quantity,
    valueDelta: number,
    kind: string,
    reason: string,
    reference: string,
  ) {
    const id = `${this.operationId}-m${this.sequence++}`;
    this.work.set("movementsV2", id, {
      id,
      itemId: item.id,
      kind,
      delta,
      valueDelta,
      balanceBefore: sub(item.balance, delta),
      valueBeforeMinor: item.valueMinor - valueDelta,
      balanceAfter: item.balance,
      valueAfterMinor: item.valueMinor,
      reason,
      reference,
      authorUid: this.work.uid,
      date: today(),
      createdAt: this.work.now,
    });
  }
  private save(item: Item) {
    this.work.set("items", item.id, {
      ...item,
      searchPrefixes: searchPrefixes([
        item.name,
        item.barcode,
        ...Object.values(item.fields),
        ...Object.values(item.details ?? {}),
      ]),
      updatedAt: this.work.now,
    });
  }
  async receive(
    id: string,
    input: Opening,
    reference: string,
    totalOverride?: number,
  ): Promise<{ baseQty: Quantity; totalMinor: number; stockIds: string[] }> {
    let item = await this.item(id);
    if (!item.active || item.kind === "service")
      throw new Error("El producto debe estar activo y ser inventariable.");
    const baseQty = this.toBase(item, input.qty, input.unit);
    this.checkBase(item, baseQty);
    const totalMinor =
      totalOverride ?? money(amount(input.unitCostMinor, input.qty));
    const stockIds: string[] = [];
    if (item.kind === "appliance") {
      if (
        input.unit !== "piece" ||
        input.serials.length !== Number(baseQty.n) ||
        new Set(input.serials.map((s) => s.toUpperCase())).size !==
          input.serials.length
      )
        throw new Error("Indica una serie distinta por cada equipo recibido.");
      let allocated = 0,
        serialNumber = 0;
      for (const serial of input.serials) {
        this.work.touchStock();
        const key = hashKey(
          `${item.fields.brand}|${item.fields.model}|${serial}`,
        );
        if (await this.work.get("serialIndex", key))
          throw new Error(
            "Una de las series ya fue registrada para ese modelo.",
          );
        const serialId = `${this.operationId}-s${this.sequence++}`;
        this.work.set("serialIndex", key, { serialId, itemId: id, serial });
        const cumulative = amount(
            totalMinor,
            fraction(BigInt(++serialNumber), BigInt(input.serials.length)),
          ),
          serialCost = cumulative - allocated;
        allocated = cumulative;
        this.work.set("serials", serialId, {
          id: serialId,
          itemId: id,
          serial,
          costMinor: serialCost,
          status: "available",
          saleId: "",
          createdAt: this.work.now,
        });
        stockIds.push(serialId);
      }
    } else {
      if (input.serials.length)
        throw new Error("Este producto no utiliza series.");
      if (
        item.kind === "grocery" &&
        item.fields.perishable === "si" &&
        (!input.lot || !input.expiresOn)
      )
        throw new Error(
          "Indica lote y vencimiento de este producto perecedero.",
        );
      if (["cement-bag", "cement-bulk"].includes(item.kind) && !input.lot)
        throw new Error("Indica el lote del cemento recibido.");
      this.work.touchStock();
      const lotId = `${this.operationId}-l${this.sequence++}`;
      const lot: Lot = {
        id: lotId,
        itemId: id,
        lot: input.lot || reference,
        expiresOn: input.expiresOn,
        balance: baseQty,
        available: true,
        createdAt: this.work.now,
      };
      this.work.set("lots", lotId, lot);
      stockIds.push(lotId);
    }
    item = {
      ...item,
      balance: add(item.balance, baseQty),
      valueMinor: money(item.valueMinor + totalMinor),
    };
    this.save(item);
    this.movement(
      item,
      baseQty,
      totalMinor,
      reference === "Stock inicial" ? "opening" : "entry",
      reference,
      reference,
    );
    return { baseQty, totalMinor, stockIds };
  }
  async consume(
    id: string,
    baseQty: Quantity,
    serialIds: string[],
    saleId: string,
    reason: string,
    ignoreExpiry = false,
    movementKind?: string,
  ): Promise<{ costMinor: number; allocations: Allocation[] }> {
    let item = await this.item(id);
    this.checkBase(item, baseQty);
    if (!item.active || compare(baseQty, item.balance) > 0)
      throw new Error(`Existencias insuficientes de ${item.name}.`);
    const allocations: Allocation[] = [];
    let costMinor = 0;
    if (item.kind === "appliance") {
      if (
        serialIds.length !== Number(baseQty.n) ||
        new Set(serialIds).size !== serialIds.length
      )
        throw new Error(
          "Selecciona una serie diferente para cada equipo vendido.",
        );
      for (const serialId of serialIds) {
        this.work.touchStock();
        const serial = await this.work.get<Serial>("serials", serialId);
        if (!serial || serial.itemId !== id || serial.status !== "available")
          throw new Error("Una serie ya no está disponible en este negocio.");
        costMinor = money(costMinor + serial.costMinor);
        this.work.set("serials", serialId, {
          ...serial,
          status: ignoreExpiry ? "written-off" : "sold",
          saleId,
        });
        allocations.push({
          stockId: serialId,
          qty: ONE,
          serial: serial.serial,
          returned: ZERO,
        });
      }
    } else {
      if (serialIds.length) throw new Error("Este producto no utiliza series.");
      const lots = (
        await this.work.list<Lot>(
          "lots",
          [
            ["itemId", id],
            ["available", true],
          ],
          10000,
        )
      )
        .filter(
          (lot) => ignoreExpiry || !lot.expiresOn || lot.expiresOn >= today(),
        )
        .sort(
          (a, b) =>
            (a.expiresOn || "9999").localeCompare(b.expiresOn || "9999") ||
            a.createdAt.localeCompare(b.createdAt) ||
            a.id.localeCompare(b.id),
        );
      let remaining = baseQty;
      for (const lot of lots) {
        if (compare(remaining, ZERO) === 0) break;
        const taken =
          compare(lot.balance, remaining) < 0 ? lot.balance : remaining;
        this.work.touchStock();
        const balance = sub(lot.balance, taken);
        this.work.set("lots", lot.id, {
          ...lot,
          balance,
          available: compare(balance, ZERO) > 0,
        });
        allocations.push({
          stockId: lot.id,
          qty: taken,
          serial: "",
          returned: ZERO,
        });
        remaining = sub(remaining, taken);
      }
      if (compare(remaining, ZERO) > 0)
        throw new Error(
          "No hay existencias suficientes sin vencer. Consulta los lotes.",
        );
      costMinor = withdrawCost(item.valueMinor, item.balance, baseQty);
    }
    item = {
      ...item,
      balance: sub(item.balance, baseQty),
      valueMinor: money(item.valueMinor - costMinor),
    };
    this.save(item);
    this.movement(
      item,
      fraction(-BigInt(baseQty.n), BigInt(baseQty.d)),
      -costMinor,
      movementKind ?? (ignoreExpiry ? "loss" : "sale"),
      reason,
      saleId,
    );
    return { costMinor, allocations };
  }
  async restock(
    id: string,
    qty: Quantity,
    costMinor: number,
    allocations: Allocation[],
    selectedSerials: string[],
    restock: boolean,
    reference: string,
  ) {
    let item = await this.item(id);
    let remaining = qty;
    if (item.kind === "appliance") {
      if (
        selectedSerials.length !== Number(qty.n) ||
        new Set(selectedSerials).size !== selectedSerials.length
      )
        throw new Error("Selecciona las series que devuelve el cliente.");
      for (const serialId of selectedSerials) {
        const allocation = allocations.find((a) => a.stockId === serialId),
          serial = await this.work.get<Serial>("serials", serialId);
        if (
          !allocation ||
          allocation.returned.n !== "0" ||
          !serial ||
          serial.status !== "sold" ||
          serial.itemId !== id
        )
          throw new Error(
            "La serie no corresponde a una unidad pendiente de devolución.",
          );
        this.work.touchStock();
        allocation.returned = ONE;
        this.work.set("serials", serialId, {
          ...serial,
          status: restock ? "inspection" : "written-off",
        });
      }
      remaining = ZERO;
    } else {
      if (selectedSerials.length)
        throw new Error("Este producto no utiliza series.");
      for (const allocation of allocations) {
        const left = sub(allocation.qty, allocation.returned);
        if (compare(left, ZERO) <= 0) continue;
        const returned = compare(left, remaining) < 0 ? left : remaining;
        allocation.returned = add(allocation.returned, returned);
        remaining = sub(remaining, returned);
        if (restock) {
          const lot = await this.work.get<Lot>("lots", allocation.stockId);
          if (!lot || lot.itemId !== id)
            throw new Error("No se encontró el lote original.");
          this.work.touchStock();
          this.work.set("lots", lot.id, {
            ...lot,
            balance: add(lot.balance, returned),
            available: true,
          });
        }
        if (compare(remaining, ZERO) === 0) break;
      }
    }
    if (compare(remaining, ZERO) !== 0)
      throw new Error("La devolución excede la cantidad pendiente.");
    if (restock) {
      item = {
        ...item,
        balance:
          item.kind === "appliance" ? item.balance : add(item.balance, qty),
        valueMinor: money(item.valueMinor + costMinor),
      };
      this.save(item);
    }
    this.movement(
      item,
      restock && item.kind !== "appliance" ? qty : ZERO,
      restock ? costMinor : 0,
      restock ? "return" : "return-loss",
      restock ? "Devolución recibida" : "Devolución sin reingreso",
      reference,
    );
  }
  async releaseSerial(serialId: string, reason: string) {
    const serial = await this.work.get<Serial>("serials", serialId);
    if (!serial || serial.status !== "inspection")
      throw new Error("La serie no está en inspección.");
    const item = await this.item(serial.itemId);
    if (!item.active)
      throw new Error("Reactiva el producto antes de liberar la unidad.");
    this.work.set("serials", serialId, {
      ...serial,
      status: "available",
      saleId: "",
    });
    item.balance = add(item.balance, ONE);
    this.save(item);
    this.movement(item, ONE, 0, "release", reason, serialId);
  }
  async unpack(sourceId: string, targetId: string, bags: Quantity) {
    const source = await this.item(sourceId),
      target = await this.item(targetId);
    if (
      !whole(bags) ||
      source.kind !== "cement-bag" ||
      target.kind !== "cement-bulk" ||
      !this.business.answers.bulk ||
      source.fields.brand !== target.fields.brand ||
      source.fields.grade !== target.fields.grade
    )
      throw new Error(
        "Selecciona bolsas completas y cemento a granel de la misma marca y tipo.",
      );
    const taken = await this.consume(
      sourceId,
      bags,
      [],
      this.operationId,
      "Apertura de bolsas",
      true,
      "transfer",
    );
    const totalGrams = mul(
      mul(bags, decimal(source.fields.weightKg!, 3)),
      fraction(1000n),
    );
    const sourceLots = await Promise.all(
      taken.allocations.map((a) => this.work.get<Lot>("lots", a.stockId)),
    );
    let distributed = 0,
      cumulativeGrams = ZERO;
    for (let i = 0; i < taken.allocations.length; i++) {
      const allocation = taken.allocations[i]!,
        lot = sourceLots[i]!;
      if (!lot) throw new Error("No se encontró el lote original.");
      const grams = mul(
        mul(allocation.qty, decimal(source.fields.weightKg!, 3)),
        fraction(1000n),
      );
      cumulativeGrams = add(cumulativeGrams, grams);
      const cumulativeCost =
        i === taken.allocations.length - 1
          ? taken.costMinor
          : amount(taken.costMinor, div(cumulativeGrams, totalGrams));
      const cost = cumulativeCost - distributed;
      distributed = cumulativeCost;
      await this.receive(
        targetId,
        {
          qty: div(grams, fraction(1000n)),
          unit: "kg",
          unitCostMinor: 0,
          lot: lot.lot,
          expiresOn: lot.expiresOn,
          serials: [],
        },
        "Apertura de bolsas",
        cost,
      );
    }
    // Una transformación no es venta, gasto ni pérdida: solamente mueve el valor.
  }
}
