import { timberStockText } from "../../../shared/workspace/timber-measures.js";
import {
  loadPractice,
  preparePractice,
  checkpointPractice,
} from "./TutorialAccess.js";
import type { PracticeAccess } from "./TutorialAccess.js";
import { OperationalService } from "./OperationalService.js";
import { searchPrefixes } from "../../../shared/workspace/search.js";
import type { Firestore } from "firebase-admin/firestore";
import { canonical, today } from "../../../shared/commerce.js";
import {
  compare,
  showQuantity,
  ZERO,
} from "../../../shared/workspace/exact.js";
import { isDiscrete } from "../../../shared/workspace/catalog.js";
import type {
  BusinessDocument,
  CommandResult,
  Customer,
  Item,
  WorkspaceReport,
} from "../../../shared/workspace/model.js";
import {
  validateItemMinimum,
  validateWorkspaceCommand,
} from "../../../shared/workspace/validation.js";
import { UnitOfWork } from "./UnitOfWork.js";
import { businessView } from "./AccountService.js";
import { Documents } from "./Documents.js";
import { InventoryServiceV2 } from "./InventoryService.js";
import { hashKey, inventorySearchTerms } from "./InventoryService.js";
import type { Serial } from "./InventoryService.js";
import { CashService } from "./CashService.js";
import { pastDate, TradeService } from "./TradeService.js";
import type { Debt } from "./TradeService.js";
import { WorkspaceQueries } from "./WorkspaceQueries.js";
import { LegacyInventory } from "./LegacyInventory.js";
import { CommerceService } from "../CommerceService.js";
import { validateCommand } from "../validation.js";

interface Expense {
  id: string;
  amountMinor: number;
  date: string;
  method: "cash" | "qr" | "transfer";
  description: string;
  category: string;
  status: "active" | "cancelled";
  createdAt: string;
}
export class WorkspaceService {
  constructor(
    private readonly db: Firestore,
    private readonly practiceAccess?: PracticeAccess,
  ) {}
  async execute(uid: string, raw: unknown): Promise<CommandResult> {
    const command = validateWorkspaceCommand(raw),
      signature = canonical(command);
    if (
      command.kind === "legacy-commerce" ||
      (command.kind === "recover-legacy" && command.input.source === "commerce")
    ) {
      if (command.businessId !== uid)
        throw new Error("El registro anterior no pertenece a este espacio.");
      const original = validateCommand(
        command.kind === "legacy-commerce"
          ? command.input.command
          : command.input.request,
      );
      if (original.operationId !== command.operationId)
        throw new Error("Conserva el identificador de la solicitud original.");
      if (
        command.kind === "legacy-commerce" &&
        ![
          "cancel-sale",
          "cancel-expense",
          "cancel-receivable",
          "collect",
        ].includes(original.kind)
      )
        throw new Error(
          "Usa las operaciones de la versión nueva para crear registros.",
        );
      const result = await new CommerceService(this.db, {
        signature,
        recovery: command.kind === "recover-legacy",
      }).execute(uid, original);
      return { id: result.id, message: "Registro anterior confirmado." };
    }
    return this.db.runTransaction(async (tx) => {
      const work = new UnitOfWork(this.db, tx, command.businessId, uid);
      const parent = await work.getPath<Record<string, unknown>>(
        `businesses/${command.businessId}`,
      );
      if (!parent || parent.ownerUid !== uid)
        throw new Error("No tienes acceso a este negocio.");
      const practice = await loadPractice(work, parent, this.practiceAccess);
      const keyPath = `users/${uid}/operationKeys/${command.operationId}`,
        previous = await work.getPath<{
          businessId: string;
          signature: string;
          result: CommandResult;
        }>(keyPath);
      if (previous) {
        if (
          previous.businessId !== command.businessId ||
          previous.signature !== signature
        )
          throw new Error(
            "El identificador pertenece a otro negocio o solicitud.",
          );
        return previous.result;
      }
      preparePractice(practice, command);
      const business = businessView(command.businessId, parent);
      if (
        !business.typeConfirmed &&
        !["confirm-type", "recover-legacy"].includes(command.kind)
      )
        throw new Error(
          "Confirma una vez el rubro del negocio antes de continuar.",
        );
      const documents = new Documents(work, business, command.operationId),
        inventory = new InventoryServiceV2(work, business, command.operationId),
        cash = new CashService(work, command.operationId),
        trade = new TradeService(
          work,
          inventory,
          cash,
          documents,
          command.operationId,
        ),
        legacy = new LegacyInventory(work, inventory, command.operationId);
      let document: BusinessDocument | undefined,
        resultId = command.operationId;
      switch (command.kind) {
        case "timber-preferences":
          if (business.industryId !== "timber")
            throw new Error("Estas medidas corresponden a maderas.");
          work.setPath("businesses/" + business.id, {
            ...parent,
            timberSystem: command.input.system,
            updatedAt: work.now,
          });
          break;
        case "appointment":
        case "work-order":
        case "delivery":
        case "container-type":
        case "container-move":
        case "operational-sale": {
          const result = await new OperationalService(
            work,
            business,
            command.operationId,
          ).execute(command, trade);
          resultId = result.id;
          if ("document" in result) document = result.document;
          break;
        }
        case "confirm-type":
          if (business.typeConfirmed)
            throw new Error("El rubro ya fue confirmado y no puede cambiarse.");
          work.setPath(`businesses/${business.id}`, {
            ...parent,
            industryId: command.input.industryId,
            answers: command.input.answers,
            typeConfirmed: true,
            workflowVersion: 2,
            workspaceVersion: 2,
            legacy: true,
            updatedAt: work.now,
          });
          break;
        case "preferences":
          work.setPath(`businesses/${business.id}`, {
            ...parent,
            name: command.input.name,
            answers: {
              ...business.answers,
              address: command.input.address,
              phone: command.input.phone,
              documentFooter: command.input.documentFooter,
            },
            updatedAt: work.now,
          });
          break;
        case "create-item": {
          const item = await inventory.create(
            command.operationId,
            command.input.item,
          );
          if (compare(command.input.opening.qty, ZERO) > 0)
            await inventory.receive(
              item.id,
              command.input.opening,
              "Stock inicial",
            );
          break;
        }
        case "variants":
          if (!["clothing", "footwear"].includes(business.industryId ?? ""))
            throw new Error(
              "La matriz de variantes corresponde a ropa y calzado.",
            );
          for (let i = 0; i < command.input.items.length; i++) {
            if (command.input.items[i]!.kind !== "apparel")
              throw new Error("La matriz solo admite variantes de moda.");
            await inventory.create(
              `${command.operationId}-${i}`,
              command.input.items[i]!,
            );
          }
          break;
        case "edit-item": {
          const item = await inventory.item(command.input.id);
          validateItemMinimum(item.kind, command.input.minimum);
          if (isDiscrete(item) && command.input.minimum.d !== "1")
            throw new Error("El mínimo debe usar unidades completas.");
          work.set("items", item.id, {
            ...item,
            ...command.input,
            searchPrefixes: searchPrefixes([
              command.input.name,
              item.barcode,
              ...inventorySearchTerms(item),
              ...Object.values(item.fields),
              ...Object.values(item.details ?? {}),
            ]),
            updatedAt: work.now,
          });
          resultId = item.id;
          break;
        }
        case "purchase":
          document = await trade.purchase(command.input);
          break;
        case "sale":
          document = (await trade.sale(command.input)).document;
          break;
        case "quote":
          document = await trade.quote(command.input);
          break;
        case "return":
          document = (
            await trade.returnSale(
              command.input.saleId,
              command.input.lines,
              command.input.reason,
              command.input.method,
            )
          ).document;
          break;
        case "exchange":
          document = await trade.exchange(command.input);
          break;
        case "open-cash":
          await cash.open(command.input.amountMinor);
          break;
        case "close-cash":
          document = await cash.close(
            command.input.countedMinor,
            command.input.reason,
            documents,
          );
          break;
        case "cash-adjust":
          await cash.post(
            command.input.direction === "in"
              ? command.input.amountMinor
              : -command.input.amountMinor,
            "cash",
            command.input.direction === "in" ? "aporte" : "retiro",
            command.input.reason,
          );
          break;
        case "expense": {
          pastDate(command.input.date);
          await cash.post(
            -command.input.amountMinor,
            command.input.method,
            "expense",
            command.operationId,
          );
          document = await documents.issue(
            "GAS",
            "Registro de gasto",
            ["Concepto", "Categoría"],
            [[command.input.description, command.input.category]],
            [{ label: "Total pagado", minor: command.input.amountMinor }],
            `Fecha: ${command.input.date}.`,
          );
          work.set("expensesV2", command.operationId, {
            id: command.operationId,
            ...command.input,
            number: document.number,
            status: "active",
            createdAt: work.now,
          });
          break;
        }
        case "cancel-expense": {
          const expense = await work.get<Expense>(
            "expensesV2",
            command.input.id,
          );
          if (!expense || expense.status !== "active")
            throw new Error("El gasto no existe o ya fue anulado.");
          await cash.post(
            expense.amountMinor,
            expense.method,
            "expense-reversal",
            expense.id,
          );
          work.set("expensesV2", expense.id, {
            ...expense,
            status: "cancelled",
          });
          work.set("expenseReversals", expense.id, {
            id: expense.id,
            amountMinor: expense.amountMinor,
            reason: command.input.reason,
            date: today(),
            createdAt: work.now,
          });
          document = await documents.issue(
            "AGAS",
            "Anulación de gasto",
            ["Referencia", "Motivo"],
            [[expense.id, command.input.reason]],
            [{ label: "Importe revertido", minor: expense.amountMinor }],
          );
          break;
        }
        case "customer":
          work.set("customersV2", command.input.id, {
            ...command.input,
            createdAt:
              (
                await work.get<Customer & { createdAt: string }>(
                  "customersV2",
                  command.input.id,
                )
              )?.createdAt ?? work.now,
            updatedAt: work.now,
          });
          resultId = command.input.id;
          break;
        case "debt": {
          pastDate(command.input.date);
          const name = await trade.customer(
            command.input.customerId,
            command.input.customerName,
          );
          if (name.length < 2)
            throw new Error("Indica a quién pertenece el fiado.");
          work.set("debts", command.operationId, {
            id: command.operationId,
            ...command.input,
            customerName: name,
            status: "pending",
            origin: "manual",
            createdAt: work.now,
          });
          break;
        }
        case "collect": {
          const debt = await work.get<Debt>("debts", command.input.id);
          if (!debt || debt.status !== "pending")
            throw new Error("El fiado no está pendiente.");
          await cash.post(
            debt.amountMinor,
            command.input.method,
            "collection",
            debt.id,
          );
          work.set("debts", debt.id, {
            ...debt,
            status: "paid",
            paymentMethod: command.input.method,
            paidAt: work.now,
          });
          work.set("paymentsV2", command.operationId, {
            id: command.operationId,
            debtId: debt.id,
            amountMinor: debt.amountMinor,
            method: command.input.method,
            date: today(),
            createdAt: work.now,
          });
          document = await documents.issue(
            "COB",
            "Comprobante de cobro",
            ["Cliente", "Concepto"],
            [[debt.customerName, debt.description]],
            [{ label: "Cobro completo", minor: debt.amountMinor }],
          );
          break;
        }
        case "cancel-debt": {
          const debt = await work.get<Debt>("debts", command.input.id);
          if (!debt || debt.status !== "pending" || debt.origin !== "manual")
            throw new Error(
              "Para corregir una deuda de venta usa la devolución de esa venta.",
            );
          work.set("debts", debt.id, {
            ...debt,
            status: "cancelled",
            reason: command.input.reason,
          });
          break;
        }
        case "unpack":
          await inventory.unpack(
            command.input.sourceId,
            command.input.targetId,
            command.input.bags,
          );
          break;
        case "stock-adjust": {
          const input = command.input;
          if (input.direction === "in")
            await inventory.receive(input.itemId, input, input.reason);
          else {
            const item = await inventory.item(input.itemId);
            if (item.kind === "timber-grouped") {
              if (
                !input.timber ||
                input.unit !== "piece" ||
                input.serials.length
              )
                throw new Error("Selecciona las medidas a retirar.");
              await inventory.timber.consume(
                item,
                input.timber,
                input.qty,
                input.reason,
                "loss",
              );
              break;
            }
            if (input.timber)
              throw new Error("Este producto no admite medidas agrupadas.");
            const outgoing: string[] = [];
            for (const serial of input.serials) {
              const index = await work.get<{
                serialId: string;
                itemId: string;
              }>(
                "serialIndex",
                hashKey(
                  item.fields.brand + "|" + item.fields.model + "|" + serial,
                ),
              );
              if (!index || index.itemId !== item.id)
                throw new Error("La serie no pertenece a este producto.");
              outgoing.push(index.serialId);
            }

            await inventory.consume(
              item.id,
              inventory.toBase(item, input.qty, input.unit),
              outgoing,
              command.operationId,
              input.reason,
              true,
            );
          }
          break;
        }
        case "release-serial":
          await inventory.releaseSerial(
            command.input.serialId,
            command.input.reason,
          );
          break;
        case "warranty": {
          const sale = await work.get<{
              lines: {
                allocations: { stockId: string }[];
                warrantyUntil: string;
              }[];
            }>("salesV2", command.input.saleId),
            serial = await work.get<Serial>("serials", command.input.serialId);
          const line = sale?.lines.find((line) =>
            line.allocations.some((a) => a.stockId === command.input.serialId),
          );
          if (!line || !serial)
            throw new Error("La serie y venta no pertenecen a este negocio.");
          const id = hashKey(
            `${command.input.saleId}|${command.input.serialId}`,
          );
          const existing = await work.get<{ createdAt: string }>(
            "warrantyClaims",
            id,
          );
          if (
            command.input.status === "resolved" &&
            command.input.resolution.length < 3
          )
            throw new Error("Indica la resolución de la garantía.");
          work.set("warrantyClaims", id, {
            id,
            ...command.input,
            warrantyUntil: line.warrantyUntil,
            withinDeclaredWarranty:
              !!line.warrantyUntil && line.warrantyUntil >= today(),
            createdAt: existing?.createdAt ?? work.now,
            updatedAt: work.now,
          });
          resultId = id;
          break;
        }
        case "convert-legacy":
          resultId = await legacy.convert(command.input);
          break;
        case "legacy-value":
          await legacy.value(
            command.input.productId,
            command.input.unitCostMinor,
          );
          break;
        case "recover-legacy":
          await legacy.recover(command.input.request);
          break;
        case "report-document": {
          const report = await new WorkspaceQueries(
            this.db,
            this.practiceAccess,
          ).report(uid, business.id, command.input.from, command.input.to, tx);
          document = await this.reportDocument(
            documents,
            report,
            command.input.inventory,
            work,
          );
          break;
        }
      }
      const result: CommandResult = {
        id: resultId,
        ...(document ? { documentId: document.id } : {}),
        message: "Operación confirmada.",
      };
      checkpointPractice(work, practice, result, command);
      work.set("operationsV2", command.operationId, {
        id: command.operationId,
        signature,
        kind: command.kind,
        result,
        authorUid: uid,
        createdAt: work.now,
      });
      work.setPath(keyPath, {
        businessId: business.id,
        signature,
        kind: command.kind,
        result,
        createdAt: work.now,
      });
      work.flush();
      return result;
    });
  }
  private async reportDocument(
    documents: Documents,
    report: WorkspaceReport,
    inventory: boolean,
    work: UnitOfWork,
  ) {
    if (inventory) {
      const items = await work.list<Item>("items", [], 10000);
      const old = await work.list<{
        name: string;
        stock: number;
        inventoryValueMinor?: number;
        specification?: { unit: string };
      }>("products", [], 10000);
      const rows = items
        .filter((item) => item.kind !== "service")
        .map((item) => [
          item.name,
          timberStockText(item, documents.timberSystem) ??
            showQuantity(item.balance) + " " + item.baseUnit,
          (item.valueMinor / 100).toFixed(2),
        ]);
      for (const item of old)
        if (item.stock > 0)
          rows.push([
            item.name + " (anterior)",
            `${item.stock} ${item.specification?.unit ?? "unidades originales"}`,
            item.inventoryValueMinor === undefined
              ? "Costo pendiente"
              : (item.inventoryValueMinor / 100).toFixed(2),
          ]);
      return documents.issue(
        "INV",
        "Informe de inventario",
        ["Producto", "Disponible", "Valor (BOB)"],
        rows,
        [
          {
            label: "Valor total conocido (incluye registros anteriores)",
            minor: report.inventoryMinor,
          },
        ],
        `Existencias a la fecha de emisión. ${report.pendingValuationCount} productos con costo pendiente. Periodo financiero ${report.from} al ${report.to}.`,
      );
    }
    return documents.issue(
      "INF",
      "Informe de resultados",
      ["Fecha", "Ventas netas (BOB)", "Gastos netos (BOB)"],
      report.days.map((day) => [
        day.date,
        (day.salesMinor / 100).toFixed(2),
        (day.expensesMinor / 100).toFixed(2),
      ]),
      [
        { label: "Ventas netas", minor: report.salesMinor },
        { label: "Costo vendido neto", minor: report.costMinor },
        { label: "Gastos netos", minor: report.expensesMinor },
        { label: "Pérdidas", minor: report.lossesMinor },
        { label: "Resultado operativo estimado", minor: report.resultMinor },
        {
          label: "Compras pagadas (no son gastos operativos)",
          minor: report.purchasesMinor,
        },
        {
          label: "Fiados pendientes (todos los periodos)",
          minor: report.pendingMinor,
        },
      ],
      `Periodo ${report.from} al ${report.to}. No representa un saldo bancario.`,
    );
  }
}
