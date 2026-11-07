import { FieldValue } from "firebase-admin/firestore";
import { canonical } from "../../../shared/commerce.js";
import {
  createProduct,
  integer,
  productDetails,
  resultingStock,
  stockChange,
} from "../../../shared/legacy-inventory.js";
import type {
  CreateProduct,
  ProductDetails,
  StockChange,
} from "../../../shared/legacy-inventory.js";
import {
  entryValue,
  exitValue,
  inventoryValue,
} from "../../../shared/legacy-costing.js";
import {
  compare,
  decimal,
  div,
  fraction,
  mul,
  ZERO,
} from "../../../shared/workspace/exact.js";
import type { WorkspaceCommand } from "../../../shared/workspace/model.js";
import {
  identifier,
  money,
  text,
  date as calendarDate,
} from "../../../shared/workspace/validation.js";
import type { UnitOfWork } from "./UnitOfWork.js";
import type { InventoryServiceV2 } from "./InventoryService.js";

interface OldProduct extends ProductDetails {
  stock: number;
  inventoryValueMinor?: number;
  active: boolean;
  lastMovementId: string;
  convertedTo?: string;
  conversionRatio?: { n: string; d: string };
}
type Data = Record<string, unknown>;
export class LegacyInventory {
  constructor(
    private readonly work: UnitOfWork,
    private readonly inventory: InventoryServiceV2,
    private readonly operationId: string,
  ) {}
  private async product(id: string) {
    const item = await this.work.get<OldProduct>("products", id);
    if (!item) throw new Error("No se encontró el producto anterior.");
    integer(item.stock, 0, 1000000, "Existencia");
    return item;
  }
  async value(productId: string, unitCostMinor: number) {
    const product = await this.product(productId);
    if (product.inventoryValueMinor !== undefined)
      throw new Error("Este producto ya tiene costo registrado.");
    const value = entryValue(
      product.stock,
      integer(unitCostMinor, 0, 999999999, "Costo"),
    );
    this.work.set("products", productId, {
      ...product,
      inventoryValueMinor: value,
      lastMovementId: this.operationId,
      updatedAt: FieldValue.serverTimestamp(),
    });
    this.move(productId, {
      kind: "valuation",
      delta: 0,
      stockBefore: product.stock,
      stockAfter: product.stock,
      valueBeforeMinor: null,
      valueAfterMinor: value,
      unitCostMinor,
      purchaseId: null,
      reason: "Valoración inicial",
      initialProduct: null,
    });
  }
  private move(productId: string, data: Data) {
    this.work.set("inventoryMovements", this.operationId, {
      productId,
      ...data,
      authorUid: this.work.uid,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  async convert(
    input: Extract<WorkspaceCommand, { kind: "convert-legacy" }>["input"],
  ) {
    const source = await this.product(input.productId);
    if (
      source.stock !== input.expectedStock ||
      source.inventoryValueMinor !== input.expectedValueMinor
    )
      throw new Error(
        "Cambió el stock o costo anterior. Actualiza la propuesta de conversión.",
      );
    if (source.inventoryValueMinor === undefined)
      throw new Error("Valora el producto antes de convertirlo.");
    const id = source.convertedTo ?? `${this.operationId}-converted`;
    const target = source.convertedTo
      ? await this.inventory.item(id)
      : await this.inventory.create(id, input.item);
    const baseQty = this.inventory.toBase(target, input.qty, input.unit),
      ratio = div(baseQty, fraction(BigInt(source.stock)));
    if (
      source.conversionRatio &&
      canonical(ratio) !== canonical(source.conversionRatio)
    )
      throw new Error(
        "La conversión debe conservar la equivalencia confirmada originalmente.",
      );
    const spec = source.specification;
    if (spec) {
      const allowed: Record<string, string[]> = {
        timber: ["timber-piece", "timber-volume"],
        apparel: ["apparel"],
        appliance: ["appliance"],
        perishable: ["grocery"],
        ceramic: ["ceramic"],
        cement: ["cement-bag", "cement-bulk"],
        general: [
          "general",
          "timber-piece",
          "timber-volume",
          "apparel",
          "appliance",
          "grocery",
          "ceramic",
          "cement-bag",
          "cement-bulk",
        ],
      };
      if (!allowed[spec.kind]?.includes(target.kind))
        throw new Error(
          "La conversión no puede cambiar la naturaleza del producto.",
        );
      const a = spec.attributes,
        f = target.fields;
      let expected = ZERO;
      if (spec.kind === "ceramic") {
        if (
          f.reference !== a.reference ||
          f.tone !== a.tone ||
          f.caliber !== a.caliber ||
          Number(f.piecesPerBox) !== a.piecesPerBox ||
          compare(
            decimal(f.coverageM2!),
            fraction(BigInt(a.coverageCm2!), 10000n),
          ) !== 0
        )
          throw new Error(
            "Conserva referencia, tono, calibre y cobertura anteriores.",
          );
        expected = fraction(BigInt(source.stock) * BigInt(a.piecesPerBox!));
      } else if (spec.kind === "cement") {
        if (
          f.brand !== a.brand ||
          f.grade !== a.grade ||
          input.lot !== a.lot ||
          input.expiresOn !== a.expiresOn
        )
          throw new Error("Conserva marca, tipo, lote y fecha anteriores.");
        expected =
          target.kind === "cement-bag"
            ? fraction(BigInt(source.stock))
            : fraction(BigInt(source.stock) * BigInt(a.weightGrams!));
        if (
          target.kind === "cement-bag" &&
          compare(
            mul(decimal(f.weightKg!), fraction(1000n)),
            fraction(BigInt(a.weightGrams!)),
          ) !== 0
        )
          throw new Error("Conserva el peso anterior.");
      } else if (spec.kind === "timber") {
        if (f.species !== a.species)
          throw new Error("Conserva la especie anterior.");
        expected =
          target.kind === "timber-piece"
            ? fraction(BigInt(source.stock))
            : fraction(
                BigInt(source.stock) *
                  BigInt(a.lengthMm!) *
                  BigInt(a.widthMm!) *
                  BigInt(a.thicknessMm!),
              );
        if (
          target.kind === "timber-piece" &&
          ["lengthMm", "widthMm", "thicknessMm"].some(
            (k) => compare(decimal(f[k]!, 3), fraction(BigInt(a[k]!))) !== 0,
          )
        )
          throw new Error("Conserva las medidas anteriores.");
      } else if (spec.kind === "apparel") {
        if (
          f.size !== a.size ||
          f.color !== a.color ||
          (f.pair === "par") !== (spec.unit === "pair")
        )
          throw new Error("Conserva la talla, color y unidad anterior.");
        expected = fraction(BigInt(source.stock));
      } else if (spec.kind === "appliance") {
        if (
          f.brand !== a.brand ||
          f.model !== a.model ||
          Number(f.warrantyMonths) !== a.warrantyMonths
        )
          throw new Error("Conserva marca, modelo y garantía anteriores.");
        expected = fraction(BigInt(source.stock));
      } else if (spec.kind === "perishable") {
        if (
          target.fields.weighted !== "no" ||
          input.lot !== a.lot ||
          input.expiresOn !== a.expiresOn
        )
          throw new Error("Conserva lote, vencimiento y unidades anteriores.");
        expected = fraction(BigInt(source.stock));
      }
      if (compare(expected, ZERO) > 0 && compare(expected, baseQty) !== 0)
        throw new Error(
          "La cantidad propuesta no conserva la equivalencia del producto anterior.",
        );
    }
    const received = await this.inventory.receive(
      id,
      {
        qty: input.qty,
        unit: input.unit,
        unitCostMinor: 0,
        lot: input.lot,
        expiresOn: input.expiresOn,
        serials: input.serials,
      },
      "Conversión de inventario anterior",
      source.inventoryValueMinor,
    );
    this.work.set("products", input.productId, {
      ...source,
      stock: 0,
      inventoryValueMinor: 0,
      active: false,
      convertedTo: id,
      conversionRatio: ratio,
      lastMovementId: this.operationId,
      updatedAt: FieldValue.serverTimestamp(),
    });
    this.move(input.productId, {
      kind: "migration-transfer",
      delta: -source.stock,
      stockBefore: source.stock,
      stockAfter: 0,
      valueBeforeMinor: source.inventoryValueMinor,
      valueAfterMinor: 0,
      unitCostMinor: null,
      purchaseId: null,
      initialProduct: null,
      reason: "Conversión explícita de inventario",
      targetId: id,
    });
    this.work.set("legacyConversions", this.operationId, {
      id: this.operationId,
      productId: input.productId,
      targetId: id,
      sourceStock: source.stock,
      sourceValueMinor: source.inventoryValueMinor,
      targetQty: received.baseQty,
      ratio,
      authorUid: this.work.uid,
      createdAt: this.work.now,
    });
    return id;
  }
  async recover(raw: unknown) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new Error("Solicitud anterior ilegible.");
    const request = raw as Data,
      id = identifier(request.id);
    if (id !== this.operationId)
      throw new Error("Conserva el identificador anterior.");
    const saved = await this.work.get<Data>("inventoryMovements", id),
      kind = text(request.kind, 1, 30);
    if (kind === "create") {
      const input = createProduct(request.input as CreateProduct),
        details = productDetails(input),
        cost = input.initialUnitCostMinor!;
      if (saved) {
        if (
          saved.kind !== "opening" ||
          saved.productId !== id ||
          saved.stockAfter !== input.stock ||
          saved.unitCostMinor !== cost ||
          canonical(saved.initialProduct) !== canonical(details)
        )
          throw new Error("El identificador pertenece a otra solicitud.");
        return;
      }
      if (await this.work.get("products", id))
        throw new Error("El producto ya existe sin su movimiento original.");
      const value = entryValue(input.stock, cost);
      this.work.set("products", id, {
        ...details,
        stock: input.stock,
        inventoryValueMinor: value,
        active: true,
        lastMovementId: id,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      this.move(id, {
        kind: "opening",
        delta: input.stock,
        stockBefore: 0,
        stockAfter: input.stock,
        valueBeforeMinor: 0,
        valueAfterMinor: value,
        unitCostMinor: cost,
        purchaseId: null,
        reason: "Stock inicial",
        initialProduct: details,
      });
      return;
    }
    if (kind === "valuation") {
      const productId = identifier(request.productId),
        cost = integer(request.unitCostMinor as number, 0, 999999999, "Costo");
      if (saved) {
        if (
          saved.kind !== "valuation" ||
          saved.productId !== productId ||
          saved.unitCostMinor !== cost
        )
          throw new Error("El identificador pertenece a otra solicitud.");
        return;
      }
      await this.value(productId, cost);
      return;
    }
    if (kind === "move") {
      const productId = identifier(request.productId),
        input = stockChange(request.input as StockChange),
        delta = input.kind === "entry" ? input.quantity : -input.quantity,
        cost = input.kind === "entry" ? input.unitCostMinor! : null;
      if (saved) {
        if (
          saved.productId !== productId ||
          saved.kind !== input.kind ||
          saved.delta !== delta ||
          saved.reason !== input.reason ||
          saved.unitCostMinor !== cost
        )
          throw new Error("El identificador pertenece a otra solicitud.");
        return;
      }
      const product = await this.product(productId);
      if (!product.active || product.inventoryValueMinor === undefined)
        throw new Error("El producto debe estar activo y valorado.");
      const next = resultingStock(product.stock, input),
        value = inventoryValue(
          input.kind === "entry"
            ? product.inventoryValueMinor + entryValue(input.quantity, cost!)
            : product.inventoryValueMinor -
                exitValue(
                  product.inventoryValueMinor,
                  product.stock,
                  input.quantity,
                ),
        );
      this.work.set("products", productId, {
        ...product,
        stock: next,
        inventoryValueMinor: value,
        lastMovementId: id,
        updatedAt: FieldValue.serverTimestamp(),
      });
      this.move(productId, {
        kind: input.kind,
        delta,
        stockBefore: product.stock,
        stockAfter: next,
        valueBeforeMinor: product.inventoryValueMinor,
        valueAfterMinor: value,
        unitCostMinor: cost,
        purchaseId: null,
        reason: input.reason,
        initialProduct: null,
      });
      return;
    }
    if (kind === "purchase") {
      const data = request.input as Data;
      if (!data || typeof data !== "object")
        throw new Error("Compra anterior inválida.");
      const productId = identifier(data.productId),
        qty = integer(data.quantity as number, 1, 1000000, "Cantidad"),
        cost = integer(data.unitCostMinor as number, 1, 999999999, "Costo"),
        reference = text(data.reference, 0, 100),
        date = calendarDate(data.date);
      const purchase = await this.work.get<Data>("purchases", id);
      if (saved) {
        if (
          saved.kind !== "purchase" ||
          !purchase ||
          purchase.productId !== productId ||
          purchase.quantity !== qty ||
          purchase.unitCostMinor !== cost ||
          purchase.reference !== reference ||
          purchase.date !== date
        )
          throw new Error("La compra anterior pertenece a otra solicitud.");
        return;
      }
      if (purchase) throw new Error("La compra anterior perdió su movimiento.");
      const product = await this.product(productId);
      if (!product.active || product.inventoryValueMinor === undefined)
        throw new Error("El producto debe estar activo y valorado.");
      const next = integer(product.stock + qty, 0, 1000000, "Stock"),
        total = entryValue(qty, cost),
        value = inventoryValue(product.inventoryValueMinor + total);
      this.work.set("products", productId, {
        ...product,
        stock: next,
        inventoryValueMinor: value,
        lastMovementId: id,
        updatedAt: FieldValue.serverTimestamp(),
      });
      this.work.set("purchases", id, {
        productId,
        productName: product.name,
        quantity: qty,
        unitCostMinor: cost,
        totalMinor: total,
        date,
        reference,
        stockBefore: product.stock,
        stockAfter: next,
        valueBeforeMinor: product.inventoryValueMinor,
        valueAfterMinor: value,
        authorUid: this.work.uid,
        ...(product.specification
          ? { specification: product.specification }
          : {}),
        createdAt: FieldValue.serverTimestamp(),
      });
      this.move(productId, {
        kind: "purchase",
        delta: qty,
        stockBefore: product.stock,
        stockAfter: next,
        valueBeforeMinor: product.inventoryValueMinor,
        valueAfterMinor: value,
        unitCostMinor: cost,
        purchaseId: id,
        reason: "Compra",
        initialProduct: null,
      });
      return;
    }
    if (kind === "reverse") {
      const purchaseId = identifier(request.purchaseId),
        reason = text(request.reason, 3, 200);
      if (saved) {
        if (
          saved.kind !== "purchase-reversal" ||
          saved.purchaseId !== purchaseId ||
          saved.reason !== reason
        )
          throw new Error("La anulación pertenece a otra solicitud.");
        return;
      }
      const purchase = await this.work.get<Data>("purchases", purchaseId);
      if (!purchase) throw new Error("No se encontró la compra.");
      const productId = identifier(purchase.productId),
        product = await this.product(productId);
      if (
        !product.active ||
        product.lastMovementId !== purchaseId ||
        (await this.work.get("purchaseReversals", purchaseId))
      )
        throw new Error(
          "La compra tiene movimientos posteriores o ya fue anulada.",
        );
      const before = money(purchase.valueBeforeMinor),
        after = money(purchase.valueAfterMinor),
        qty = integer(purchase.quantity as number, 1, 1000000, "Cantidad");
      this.work.set("products", productId, {
        ...product,
        stock: purchase.stockBefore,
        inventoryValueMinor: before,
        lastMovementId: id,
        updatedAt: FieldValue.serverTimestamp(),
      });
      this.work.set("purchaseReversals", purchaseId, {
        purchaseId,
        operationId: id,
        reason,
        authorUid: this.work.uid,
        createdAt: FieldValue.serverTimestamp(),
      });
      this.move(productId, {
        kind: "purchase-reversal",
        delta: -qty,
        stockBefore: product.stock,
        stockAfter: purchase.stockBefore,
        valueBeforeMinor: after,
        valueAfterMinor: before,
        unitCostMinor: null,
        purchaseId,
        reason,
        initialProduct: null,
      });
      return;
    }
    throw new Error(
      "Operación anterior desconocida. No se modificó el inventario.",
    );
  }
}
