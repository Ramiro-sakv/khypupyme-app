import { TIMBER_STEPS } from "../../../shared/workspace/timber-tutorial.js";
import type { TutorialSession } from "../../../shared/workspace/timber-tutorial.js";
import type { WorkspaceCommand } from "../../../shared/workspace/model.js";
import { today } from "../../../shared/commerce.js";
import { decimal } from "../../../shared/workspace/exact.js";
function ensure(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const qty = (a: { n: string; d: string }, value: string) => {
  const b = decimal(value);
  return a.n === b.n && a.d === b.d;
};
export function validateTutorialAction(
  session: TutorialSession,
  c: WorkspaceCommand,
) {
  const step = TIMBER_STEPS[session.stepIndex],
    r = session.references;
  ensure(
    session.status === "active",
    "Reanuda la práctica antes de registrar.",
  );
  ensure(
    step?.kind && c.kind === step.kind,
    "Paso actual: " +
      (step?.title ?? "Finalizar") +
      ". " +
      (step?.text ?? "Finaliza y borra la práctica."),
  );
  const fail = "Para este ejercicio sigue los datos indicados: " + step.text;
  const sale = (
    i: Extract<WorkspaceCommand, { kind: "sale" }>["input"],
    count: string,
  ) => {
    ensure(
      i.lines.length === 1 &&
        i.lines[0]!.itemId === r.wood &&
        qty(i.lines[0]!.qty, count) &&
        i.lines[0]!.unit === "piece" &&
        i.customerId === r.customer &&
        i.discountMinor === 0,
      fail,
    );
  };
  switch (step.id) {
    case "units":
      ensure(c.kind === "timber-preferences", fail);
      break;
    case "customer":
      ensure(
        c.kind === "customer" &&
          c.input.name === "Cliente de práctica" &&
          c.input.active,
        fail,
      );
      break;
    case "wood":
      ensure(c.kind === "create-item", fail);
      {
        const i = c.input.item;
        ensure(
          i.name === "Tabla de pino" &&
            i.kind === "timber-piece" &&
            i.fields.species?.toLowerCase() === "pino" &&
            qty(decimal(i.fields.lengthMm!, 6), "3048") &&
            qty(decimal(i.fields.widthMm!, 6), "152.4") &&
            qty(decimal(i.fields.thicknessMm!, 6), "50.8") &&
            i.priceUnit === "boardFoot" &&
            i.priceMinor === 1000 &&
            qty(i.minimum, "3") &&
            c.input.opening.qty.n === "0",
          fail,
        );
      }
      break;
    case "cash-open":
      ensure(c.kind === "open-cash" && c.input.amountMinor === 100000, fail);
      break;
    case "purchase":
      ensure(c.kind === "purchase" && c.input.lines.length === 1, fail);
      {
        const l = c.input.lines[0]!;
        ensure(
          l.itemId === r.wood &&
            qty(l.qty, "10") &&
            l.unit === "piece" &&
            l.unitCostMinor === 5000 &&
            c.input.method === "cash",
          fail,
        );
      }
      break;
    case "quote":
      ensure(c.kind === "quote", fail);
      ensure(
        c.input.lines.length === 1 &&
          c.input.lines[0]!.itemId === r.wood &&
          qty(c.input.lines[0]!.qty, "2") &&
          c.input.lines[0]!.unit === "piece" &&
          c.input.discountMinor === 0 &&
          c.input.customerId === r.customer,
        fail,
      );
      break;
    case "sale":
      ensure(c.kind === "sale", fail);
      sale(c.input, "2");
      ensure(c.input.method === "cash" && c.input.quoteId === r.quote, fail);
      break;
    case "return":
      ensure(
        c.kind === "return" &&
          c.input.saleId === r.cashSale &&
          c.input.lines.length === 1 &&
          c.input.method === "cash",
        fail,
      );
      {
        const l = c.input.lines[0]!;
        ensure(
          l.line === 0 && qty(l.qty, "1") && l.unit === "piece" && l.restock,
          fail,
        );
      }
      break;
    case "credit":
      ensure(c.kind === "sale", fail);
      sale(c.input, "1");
      ensure(c.input.method === "credit" && !c.input.quoteId, fail);
      break;
    case "collect":
      ensure(
        c.kind === "collect" &&
          c.input.id === r.creditSale &&
          c.input.method === "cash",
        fail,
      );
      break;
    case "expense":
      ensure(
        c.kind === "expense" &&
          c.input.amountMinor === 2000 &&
          c.input.method === "cash",
        fail,
      );
      break;
    case "cut-service":
      ensure(c.kind === "create-item", fail);
      {
        const i = c.input.item;
        ensure(
          i.kind === "service" &&
            i.name === "Corte" &&
            i.priceMinor === 2000 &&
            i.priceUnit === "service" &&
            i.serviceCostMinor === 500 &&
            i.minimum.n === "0" &&
            c.input.opening.qty.n === "0",
          fail,
        );
      }
      break;
    case "order":
    case "order-quote":
    case "order-approve":
    case "order-work":
    case "order-ready": {
      ensure(c.kind === "work-order", fail);
      const statuses: Record<string, string> = {
        order: "received",
        "order-quote": "quoted",
        "order-approve": "approved",
        "order-work": "in-progress",
        "order-ready": "ready",
      };
      ensure(
        c.input.kind === "cutting" &&
          c.input.customerId === r.customer &&
          c.input.budgetMinor === 2000 &&
          c.input.status === statuses[step.id] &&
          (step.id === "order" ? !c.input.id : c.input.id === r.order),
        fail,
      );
      break;
    }
    case "order-sale":
      ensure(
        c.kind === "operational-sale" &&
          c.input.sourceKind === "work-order" &&
          c.input.sourceId === r.order,
        fail,
      );
      {
        const i = c.input.sale,
          l = i.lines[0];
        ensure(
          i.lines.length === 1 &&
            !!l &&
            l.itemId === r.service &&
            qty(l.qty, "1") &&
            l.unit === "service" &&
            i.customerId === r.customer &&
            i.method === "cash" &&
            i.discountMinor === 0 &&
            !i.quoteId,
          fail,
        );
      }
      break;
    case "delivery":
    case "delivery-prepared":
    case "delivery-done":
      ensure(c.kind === "delivery", fail);
      ensure(
        c.input.saleId === r.creditSale &&
          c.input.status ===
            (
              {
                delivery: "pending",
                "delivery-prepared": "prepared",
                "delivery-done": "delivered",
              } as Record<string, string>
            )[step.id] &&
          (step.id === "delivery" ? !c.input.id : c.input.id === r.delivery),
        fail,
      );
      break;
    case "inventory-document":
    case "result-document":
      ensure(
        c.kind === "report-document" &&
          c.input.inventory === (step.id === "inventory-document"),
        fail,
      );
      break;
    case "cash-close":
      ensure(c.kind === "close-cash" && c.input.countedMinor === 70000, fail);
      break;
    default:
      throw new Error("Acción no disponible en este paso.");
  }
  const input = c.input as unknown as {
    date?: string;
    sale?: { date?: string };
  };
  const date = input.date ?? input.sale?.date;
  if (date)
    ensure(
      date >= session.startedOn && date <= today(),
      "Usa una fecha entre el inicio de esta práctica y hoy.",
    );
}
