import { AppError } from "../../../shared/app-errors";
import type { TimberWidthEntry } from "../../../shared/workspace/timber-width-entry";
import type { TimberSaleSelection } from "../../../shared/workspace/model";
import type {
  Method,
  Unit,
  WorkspaceCommand,
} from "../../../shared/workspace/model";
import type { WorkspaceIdentity } from "./WorkspaceCommandService";
export type DraftKind = "sale" | "purchase" | "quote";
export interface DraftLine {
  packages?: import("../../../shared/workspace/model").SaleLineInputV2["packages"];
  print?: import("../../../shared/workspace/model").SaleLineInputV2["print"];
  widthsEntry?: TimberWidthEntry | undefined;
  id?: string | undefined;
  timber?: TimberSaleSelection | undefined;
  lengthInput?: string | undefined;
  widthInput?: string | undefined;
  priceInput?: string | undefined;
  thicknessInput?: string | undefined;
  priceManual?: boolean | undefined;
  itemId: string;
  priceMinor: number;
  qty: string;
  unit: Unit;
  cost: string;
  lot: string;
  expiresOn: string;
  serials: string[];
  fullBoxes: boolean;
  wastePercent: number;
}
export interface TradeDraftInput {
  containers?: import("../../../shared/workspace/operations").ContainerTransfer[];
  origin?: { kind: "appointment" | "work-order"; id: string; revision: number };
  lines: DraftLine[];
  isQuote: boolean;
  quoteId: string;
  customerId: string;
  customerName: string;
  discount: string;
  date: string;
  method: Method | "credit";
  reference: string;
  validUntil: string;
}
export interface DraftVersion {
  id: string;
  revision: number;
}
export interface TradeDraft extends DraftVersion {
  version: 1;
  scope: string;
  uid: string;
  businessId: string;
  kind: DraftKind;
  updatedAt: string;
  input: TradeDraftInput;
  submitted: WorkspaceCommand | null;
}
export class DraftConflict extends AppError {
  constructor(readonly current: TradeDraft | null) {
    super(
      "Otra pestaña cambió este borrador. Tu trabajo actual se conserva en esta pantalla.",
      409,
      "DRAFT_CONFLICT",
    );
  }
}
export interface DraftRepository {
  get(context: WorkspaceIdentity, kind: DraftKind): Promise<TradeDraft | null>;
  save(
    context: WorkspaceIdentity,
    kind: DraftKind,
    input: TradeDraftInput,
    expected: DraftVersion | null,
  ): Promise<TradeDraft>;
  link(
    context: WorkspaceIdentity,
    kind: DraftKind,
    expected: DraftVersion,
    command: WorkspaceCommand,
  ): Promise<TradeDraft>;
  unlink(
    context: WorkspaceIdentity,
    kind: DraftKind,
    expected: DraftVersion,
    operationId: string,
  ): Promise<TradeDraft>;
  remove(
    context: WorkspaceIdentity,
    kind: DraftKind,
    expected: DraftVersion,
  ): Promise<void>;
  removeLinked(context: WorkspaceIdentity, operationId: string): Promise<void>;
}
