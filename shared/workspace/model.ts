import type { TimberSystem } from "./timber-measures.js";
import type { ItemDetails, OperationalAction } from "./operations.js";
import type { IndustryId } from "../business-industries.js";
import type { Quantity } from "./exact.js";
import type { ReportDay } from "../commerce.js";

export type ItemKind =
  | "general"
  | "timber-grouped"
  | "timber-piece"
  | "timber-volume"
  | "apparel"
  | "appliance"
  | "grocery"
  | "ceramic"
  | "cement-bag"
  | "cement-bulk"
  | "service";
export type Unit =
  | "piece"
  | "pair"
  | "box"
  | "bag"
  | "g"
  | "kg"
  | "lb"
  | "ml"
  | "l"
  | "m3"
  | "boardFoot"
  | "m2"
  | "service";
export type Method = "cash" | "qr" | "transfer";
export interface BusinessAnswers {
  weighted: boolean;
  bulk: boolean;
  timberMode: "piece" | "volume";
  documentFooter: string;
  address: string;
  phone: string;
}
export interface WorkspaceBusiness {
  id: string;
  name: string;
  ownerUid: string;
  industryId: IndustryId | null;
  typeConfirmed: boolean;
  workflowVersion: 2;
  currency: "BOB";
  timeZone: "America/La_Paz";
  answers: BusinessAnswers;
  legacy: boolean;
  timberSystem?: TimberSystem;
  tutorialSessionId?: string;
  tutorialSourceBusinessId?: string;
  sampleData?: { version: string; setId: string };
  createdAt: string;
}
export interface TimberSelection {
  speciesId?: string;
  thicknessMm?: string;
  lengthMm: string;
  widths: { widthMm: string; pieces: number }[];
}
export interface TimberSaleSelection extends TimberSelection {
  priceMinor: number;
}
export type TimberCategory = "superShort" | "short" | "long";
export interface TimberSpecies {
  species?: string;
  code?: string;
  id: string;
  name: string;
  reference: string;
  prices: Record<TimberCategory, number>;
  revision: number;
  active: boolean;
  pieces: number;
  balance: Quantity;
  valueMinor: number;
  createdAt: string;
  updatedAt: string;
}
export interface TimberSummary {
  id: string;
  thicknessMm: string;
  category: TimberCategory;
  pieces: number;
  volume: Quantity;
}
export interface TimberStockRow {
  id: string;
  lengthMm: string;
  thicknessMm: string;
  widthMm: string;
  pieces: number;
  volume: Quantity;
  category: TimberCategory;
}
export interface TimberStockGroup {
  speciesId?: string;
  thicknessMm?: string;
  id: string;
  itemId: string;
  lengthMm: string;
  widthMm: string;
  pieces: number;
  available: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface ItemDraft {
  measure?: "mass" | "volume";
  details?: ItemDetails;
  name: string;
  kind: ItemKind;
  fields: Record<string, string>;
  barcode: string;
  priceMinor: number;
  priceUnit: Unit;
  minimum: Quantity;
  serviceCostMinor: number;
}
export interface Item extends ItemDraft {
  timberSpeciesId?: string;
  timberSpecies?: TimberSpecies;
  pieces?: number;
  id: string;
  active: boolean;
  baseUnit: string;
  units: Partial<Record<Unit, Quantity>>;
  balance: Quantity;
  valueMinor: number;
  createdAt: string;
  updatedAt: string;
}
export interface ReceiptLineInput {
  timber?: TimberSelection;
  itemId: string;
  qty: Quantity;
  unit: Unit;
  unitCostMinor: number;
  lot: string;
  expiresOn: string;
  serials: string[];
}
export interface SaleLineInputV2 {
  timber?: TimberSaleSelection;
  itemId: string;
  qty: Quantity;
  unit: Unit;
  fullBoxes: boolean;
  wastePercent: number;
  serials: string[];
  expectedPriceMinor: number;
}
export interface Allocation {
  timber?: { lengthMm: string; widthMm: string; pieces: number };
  stockId: string;
  qty: Quantity;
  serial: string;
  returned: Quantity;
}
export interface SaleLineV2 {
  catalogPriceMinor?: number;
  timber?: TimberSaleSelection;
  details?: ItemDetails;
  itemId: string;
  name: string;
  kind: ItemKind;
  fields: Record<string, string>;
  requested: Quantity;
  requestedUnit: Unit;
  delivered: Quantity;
  baseUnit: string;
  charged: Quantity;
  priceUnit: Unit;
  priceMinor: number;
  grossMinor: number;
  netMinor: number;
  costMinor: number;
  allocations: Allocation[];
  units: Partial<Record<Unit, Quantity>>;
  returned: Quantity;
  refundedMinor: number;
  restoredCostMinor: number;
  warrantyUntil: string;
}
export interface PurchaseLineV2 {
  timber?: TimberSelection;
  itemId: string;
  name: string;
  fields: Record<string, string>;
  qty: Quantity;
  unit: Unit;
  baseQty: Quantity;
  unitCostMinor: number;
  totalMinor: number;
  stockIds: string[];
}
export interface Customer {
  id: string;
  name: string;
  phone: string;
  notes: string;
  active: boolean;
}
export interface SaleV2 {
  id: string;
  number: string;
  lines: SaleLineV2[];
  customerId: string;
  customerName: string;
  date: string;
  method: Method | "credit";
  discountMinor: number;
  totalMinor: number;
  costMinor: number;
  status: "active" | "returned";
  createdAt: string;
}
export interface CashSession {
  createdAt: string;
  id: string;
  openedAt: string;
  openingMinor: number;
  balanceMinor: number;
  status: "open" | "closed";
  closedAt: string;
  countedMinor: number | null;
  differenceMinor: number | null;
  reason: string;
}
export interface EquipmentHistory {
  id: string;
  serial: string;
  itemName: string;
  status: "available" | "sold" | "inspection" | "written-off";
  receivedAt: string;
  purchase: { number: string; date: string } | null;
  sales: {
    id: string;
    number: string;
    date: string;
    customerName: string;
    warrantyUntil: string;
    returned: boolean;
    returns: { id: string; number: string; date: string }[];
    claims: { id: string; status: string; description: string; resolution: string }[];
  }[];
}
export interface SetupProgress {
  catalog: boolean;
  purchase: boolean;
  sale: boolean;
  legacyStock: boolean;
}
export interface BusinessDocument {
  id: string;
  number: string;
  businessId: string;
  businessName: string;
  industry: string;
  address: string;
  phone: string;
  title: string;
  date: string;
  columns: string[];
  rows: string[][];
  totals: { label: string; minor: number }[];
  notes: string;
  createdAt: string;
}
export interface ReturnInput {
  timber?: TimberSelection;
  line: number;
  qty: Quantity;
  unit: Unit;
  restock: boolean;
  serials: string[];
}
export interface Opening {
  timber?: TimberSelection;
  qty: Quantity;
  unit: Unit;
  unitCostMinor: number;
  lot: string;
  expiresOn: string;
  serials: string[];
}
export interface SaleInput {
  lines: SaleLineInputV2[];
  method: Method | "credit";
  date: string;
  customerId: string;
  customerName: string;
  discountMinor: number;
  quoteId: string;
}
export type WorkspaceAction =
  | { kind: "timber-species"; input: { id: string; name: string; species?: string; code?: string; reference: string; prices: Record<TimberCategory, number>; expectedRevision: number; active: boolean } }
  | { kind: "timber-preferences"; input: { system: TimberSystem } }
  | OperationalAction
  | {
      kind: "confirm-type";
      input: { industryId: IndustryId; answers: BusinessAnswers };
    }
  | {
      kind: "preferences";
      input: {
        name: string;
        address: string;
        phone: string;
        documentFooter: string;
      };
    }
  | { kind: "create-item"; input: { item: ItemDraft; opening: Opening } }
  | { kind: "variants"; input: { items: ItemDraft[] } }
  | {
      kind: "edit-item";
      input: {
        id: string;
        name: string;
        priceMinor: number;
        serviceCostMinor: number;
        minimum: Quantity;
        active: boolean;
      };
    }
  | {
      kind: "purchase";
      input: {
        lines: ReceiptLineInput[];
        method: Method;
        date: string;
        reference: string;
      };
    }
  | { kind: "sale"; input: SaleInput }
  | {
      kind: "quote";
      input: {
        lines: SaleLineInputV2[];
        customerId: string;
        customerName: string;
        discountMinor: number;
        validUntil: string;
      };
    }
  | {
      kind: "return";
      input: {
        saleId: string;
        lines: ReturnInput[];
        reason: string;
        method: Method;
      };
    }
  | {
      kind: "exchange";
      input: {
        saleId: string;
        returns: ReturnInput[];
        lines: SaleLineInputV2[];
        reason: string;
        method: Method;
        customerName: string;
      };
    }
  | { kind: "open-cash"; input: { amountMinor: number } }
  | { kind: "close-cash"; input: { countedMinor: number; reason: string } }
  | {
      kind: "cash-adjust";
      input: { direction: "in" | "out"; amountMinor: number; reason: string };
    }
  | {
      kind: "expense";
      input: {
        amountMinor: number;
        method: Method;
        date: string;
        description: string;
        category: string;
      };
    }
  | { kind: "cancel-expense"; input: { id: string; reason: string } }
  | { kind: "collect"; input: { id: string; method: Method } }
  | { kind: "customer"; input: Customer }
  | {
      kind: "debt";
      input: {
        customerId: string;
        customerName: string;
        amountMinor: number;
        description: string;
        date: string;
      };
    }
  | { kind: "cancel-debt"; input: { id: string; reason: string } }
  | {
      kind: "unpack";
      input: { sourceId: string; targetId: string; bags: Quantity };
    }
  | {
      kind: "warranty";
      input: {
        saleId: string;
        serialId: string;
        description: string;
        status: "received" | "diagnosis" | "resolved";
        resolution: string;
      };
    }
  | { kind: "release-serial"; input: { serialId: string; reason: string } }
  | {
      kind: "stock-adjust";
      input: {
        itemId: string;
        timber?: TimberSelection;
        direction: "in" | "out";
        qty: Quantity;
        unit: Unit;
        unitCostMinor: number;
        reason: string;
        lot: string;
        expiresOn: string;
        serials: string[];
      };
    }
  | {
      kind: "convert-legacy";
      input: {
        productId: string;
        item: ItemDraft;
        qty: Quantity;
        unit: Unit;
        lot: string;
        expiresOn: string;
        serials: string[];
        expectedStock: number;
        expectedValueMinor: number;
      };
    }
  | {
      kind: "legacy-value";
      input: { productId: string; unitCostMinor: number };
    }
  | { kind: "legacy-commerce"; input: { command: unknown } }
  | {
      kind: "recover-legacy";
      input: { source: "inventory" | "commerce"; request: unknown };
    }
  | {
      kind: "report-document";
      input: { from: string; to: string; inventory: boolean };
    };
export type WorkspaceCommand = WorkspaceAction & {
  apiVersion: 2;
  businessId: string;
  operationId: string;
};
export interface CommandResult {
  id: string;
  documentId?: string;
  message: string;
}
export type WorkspaceResource =
  | "timberStock"
  | "auditEvents"
  | "timberSummary"
  | "timberSpecies"
  | "appointments"
  | "workOrders"
  | "workflowEvents"
  | "deliveries"
  | "containerTypes"
  | "containerBalances"
  | "containerMovements"
  | "items"
  | "salesV2"
  | "purchasesV2"
  | "returns"
  | "quotes"
  | "customersV2"
  | "expensesV2"
  | "expenseReversals"
  | "paymentsV2"
  | "debts"
  | "cashSessions"
  | "cashEntries"
  | "documentsV2"
  | "warrantyClaims"
  | "movementsV2"
  | "serials"
  | "serialHistory"
  | "saleAvailability"
  | "cartAvailability"
  | "setupProgress"
  | "timberGroups"
  | "lots"
  | "inventoryMovements"
  | "products"
  | "sales"
  | "purchases"
  | "expenses"
  | "receivables";
export interface WorkspaceQuery {
  lines?: SaleLineInputV2[];
  quote?: boolean;
  category?: TimberCategory;
  apiVersion: 2;
  businessId: string;
  resource: WorkspaceResource;
  id?: string;
  cursor?: string;
  itemId?: string;
  lengthMm?: string;
  thicknessMm?: string;
  widthMm?: string;
  from?: string;
  to?: string;
  barcode?: string;
  status?: string;
  search?: string;
  recordId?: string;
  expiresBefore?: string;
  active?: boolean;
  reorder?: boolean;
  variantModel?: string;
  serialNumber?: string;
}
export interface WorkspaceReport {
  pendingValuationCount: number;
  unvaluedLossCount: number;
  from: string;
  to: string;
  salesMinor: number;
  costMinor: number;
  expensesMinor: number;
  lossesMinor: number;
  purchasesMinor: number;
  resultMinor: number;
  pendingMinor: number;
  inventoryMinor: number;
  days: ReportDay[];
  byUnit: { unit: string; quantity: Quantity }[];
}

export interface WorkspaceReset {
  id: string;
  removedBusinessIds: string[];
  removedCreationOperationIds: string[];
}
