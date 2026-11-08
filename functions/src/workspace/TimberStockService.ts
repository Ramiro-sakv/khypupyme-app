import type { TimberSystem } from "../../../shared/workspace/timber-measures.js";
import { AppError } from "../../../shared/app-errors.js";
import { dimensionDisplayFromMm } from "../../../shared/workspace/timber-measures.js";
import { today } from "../../../shared/commerce.js";
import { createHash } from "node:crypto";
import type {
  Allocation,
  Item,
  TimberSelection,
  TimberStockGroup,
} from "../../../shared/workspace/model.js";
import {
  add,
  compare,
  fraction,
  withdrawCost,
  ZERO,
} from "../../../shared/workspace/exact.js";
import {
  timberGroupKey,
  timberTotals,
} from "../../../shared/workspace/timber-groups.js";
import { money } from "../../../shared/workspace/validation.js";
import type { Quantity } from "../../../shared/workspace/exact.js";
import type { UnitOfWork } from "./UnitOfWork.js";

/** Physical availability and volume/value change in the same UnitOfWork as the sale. */
export class TimberStockService {
  private sequence = 0;
  constructor(
    private readonly work: UnitOfWork,
    private readonly operationId: string,
    private readonly system: TimberSystem = "imperial",
  ) {}
  private key(itemId: string, length: string, width: string) {
    return createHash("sha256")
      .update(timberGroupKey(itemId, length, width))
      .digest("hex");
  }
  validate(item: Item, selection: TimberSelection, qty: Quantity) {
    if (
      item.kind !== "timber-grouped" ||
      !selection ||
      !selection.widths.length
    )
      throw new Error("Selecciona las medidas de la madera.");
    const totals = timberTotals(item.fields.thicknessMm!, selection);
    if (
      qty.d !== "1" ||
      qty.n !== String(totals.pieces) ||
      totals.pieces > 1000000
    )
      throw new Error("La cantidad de piezas no coincide con las medidas.");
    if (
      new Set(
        selection.widths.map((r) =>
          this.key(item.id, selection.lengthMm, r.widthMm),
        ),
      ).size !== selection.widths.length
    )
      throw new Error("Agrupa los anchos repetidos aumentando su cantidad.");
    return totals;
  }
  async available(item: Item, selection: TimberSelection, qty: Quantity) {
    if (!item.active)
      throw new Error("Reactiva el producto antes de retirar madera.");
    const totals = this.validate(item, selection, qty);
    for (const row of selection.widths) {
      const stock = await this.work.get<TimberStockGroup>(
        "timberGroups",
        this.key(item.id, selection.lengthMm, row.widthMm),
      );
      if (!stock || stock.pieces < row.pieces)
        throw new AppError(
          item.name +
            ", largo " +
            dimensionDisplayFromMm(
              selection.lengthMm,
              "lengthMm",
              this.system,
            ) +
            (this.system === "imperial" ? "′, ancho " : " mm, ancho ") +
            dimensionDisplayFromMm(row.widthMm, "widthMm", this.system) +
            (this.system === "imperial" ? "″: solicitas " : " mm: solicitas ") +
            row.pieces +
            " piezas y quedan " +
            (stock?.pieces ?? 0) +
            ". Registra una entrada si recibiste más madera.",
          400,
          "STOCK_INSUFFICIENT",
          "timber-widths",
        );
    }
    return totals;
  }
  private save(
    item: Item,
    volume: Quantity,
    value: number,
    pieces: number,
    kind: string,
    reference: string,
    selection: TimberSelection,
  ) {
    const count = (item.pieces ?? 0) + pieces;
    if (!Number.isSafeInteger(count) || count < 0 || count > 1000000)
      throw new Error("Existencias fuera del límite de piezas.");
    const next = {
      ...item,
      pieces: count,
      balance: add(item.balance, volume),
      valueMinor: money(item.valueMinor + value),
      updatedAt: this.work.now,
    };
    if (
      compare(next.balance, ZERO) < 0 ||
      (count === 0 && next.balance.n !== "0")
    )
      throw new Error("Las piezas y el volumen no coinciden.");
    this.work.set("items", item.id, next);
    const id = this.operationId + "-tm" + this.sequence++;
    this.work.set("movementsV2", id, {
      id,
      itemId: item.id,
      kind,
      delta: volume,
      valueDelta: value,
      timber: { ...selection, thicknessMm: item.fields.thicknessMm! },
      piecesDelta: pieces,
      piecesBefore: item.pieces ?? 0,
      piecesAfter: count,
      balanceBefore: item.balance,
      balanceAfter: next.balance,
      valueBeforeMinor: item.valueMinor,
      valueAfterMinor: next.valueMinor,
      reference,
      reason: reference,
      authorUid: this.work.uid,
      date: today(),
      createdAt: this.work.now,
    });
  }
  async receive(
    item: Item,
    selection: TimberSelection,
    qty: Quantity,
    value: number,
    reference: string,
  ) {
    const totals = this.validate(item, selection, qty),
      stockIds: string[] = [];
    for (const row of selection.widths) {
      this.work.touchStock();
      const id = this.key(item.id, selection.lengthMm, row.widthMm),
        old = await this.work.get<TimberStockGroup>("timberGroups", id);
      const stock = {
        id,
        itemId: item.id,
        lengthMm: selection.lengthMm,
        widthMm: row.widthMm,
        pieces: (old?.pieces ?? 0) + row.pieces,
        available: true,
        active: true,
        createdAt: old?.createdAt ?? this.work.now,
        updatedAt: this.work.now,
      };
      this.work.set("timberGroups", id, stock);
      stockIds.push(id);
    }
    this.save(
      item,
      totals.volume,
      value,
      totals.pieces,
      "entry",
      reference,
      selection,
    );
    return { baseQty: totals.volume, totalMinor: value, stockIds };
  }
  async consume(
    item: Item,
    selection: TimberSelection,
    qty: Quantity,
    reference: string,
    kind = "sale",
  ) {
    const totals = await this.available(item, selection, qty),
      allocations: Allocation[] = [];
    if (compare(totals.volume, item.balance) > 0)
      throw new Error("Volumen insuficiente.");
    for (const row of selection.widths) {
      this.work.touchStock();
      const id = this.key(item.id, selection.lengthMm, row.widthMm),
        stock = (await this.work.get<TimberStockGroup>("timberGroups", id))!;
      const pieces = stock.pieces - row.pieces;
      this.work.set("timberGroups", id, {
        ...stock,
        pieces,
        available: pieces > 0,
        active: pieces > 0,
        updatedAt: this.work.now,
      });
      allocations.push({
        stockId: id,
        qty: timberTotals(item.fields.thicknessMm!, {
          lengthMm: selection.lengthMm,
          widths: [row],
        }).volume,
        returned: ZERO,
        serial: "",
        timber: {
          lengthMm: selection.lengthMm,
          widthMm: row.widthMm,
          pieces: row.pieces,
        },
      });
    }
    const costMinor = withdrawCost(
      item.valueMinor,
      item.balance,
      totals.volume,
    );
    this.save(
      item,
      fraction(-BigInt(totals.volume.n), BigInt(totals.volume.d)),
      -costMinor,
      -totals.pieces,
      kind,
      reference,
      selection,
    );
    return { costMinor, allocations };
  }
  async restock(
    item: Item,
    selection: TimberSelection,
    qty: Quantity,
    cost: number,
    allocations: Allocation[],
    restock: boolean,
    reference: string,
  ) {
    const totals = this.validate(item, selection, qty);
    for (const row of selection.widths) {
      const id = this.key(item.id, selection.lengthMm, row.widthMm),
        allocation = allocations.find((a) => a.stockId === id);
      const returned = timberTotals(item.fields.thicknessMm!, {
        lengthMm: selection.lengthMm,
        widths: [row],
      }).volume;
      if (
        !allocation?.timber ||
        compare(add(allocation.returned, returned), allocation.qty) > 0
      )
        throw new Error(
          "La devolución supera las piezas vendidas de esa medida.",
        );
      allocation.returned = add(allocation.returned, returned);
      this.work.touchStock();
      if (restock) {
        const stock = await this.work.get<TimberStockGroup>("timberGroups", id);
        if (!stock) throw new Error("No se encontró el grupo original.");
        this.work.set("timberGroups", id, {
          ...stock,
          pieces: stock.pieces + row.pieces,
          available: true,
          active: true,
          updatedAt: this.work.now,
        });
      }
    }
    this.save(
      item,
      restock ? totals.volume : ZERO,
      restock ? cost : 0,
      restock ? totals.pieces : 0,
      restock ? "return" : "return-loss",
      reference,
      selection,
    );
  }
}
