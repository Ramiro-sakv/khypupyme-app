import type {
  TutorialRequest,
  TutorialReply,
} from "../../../shared/workspace/timber-tutorial";
import type {
  WorkspaceReset,
  BusinessAnswers,
  CommandResult,
  WorkspaceBusiness,
  WorkspaceCommand,
  WorkspaceQuery,
  WorkspaceReport,
} from "../../../shared/workspace/model";
import type { IndustryId } from "../../../shared/business-industries";

export interface Page<T> {
  reset?: WorkspaceReset;
  totals?: { pieces: number; volume: import("../../../shared/workspace/exact").Quantity; combinations: number };
  items: T[];
  next: string | null;
}
export interface NewBusiness {
  operationId: string;
  name: string;
  industryId: IndustryId;
  answers: BusinessAnswers;
}
export interface WorkspaceRepository {
  approval?: (phase: "prepare" | "approve", command: WorkspaceCommand, reason?: string) => Promise<import("../../../shared/workspace/protection").CorrectionChallenge | { approved: true }>;
  tutorial?: (request: TutorialRequest) => Promise<TutorialReply>;
  businesses(cursor?: string): Promise<Page<WorkspaceBusiness>>;
  business(id: string): Promise<WorkspaceBusiness>;
  create(input: NewBusiness): Promise<WorkspaceBusiness>;
  creationStatus(input: NewBusiness): Promise<WorkspaceBusiness | null>;
  execute(command: WorkspaceCommand): Promise<CommandResult>;
  status(command: WorkspaceCommand): Promise<CommandResult | null>;
  list<T>(query: WorkspaceQuery): Promise<Page<T>>;
  report(
    businessId: string,
    from: string,
    to: string,
  ): Promise<WorkspaceReport>;
}
