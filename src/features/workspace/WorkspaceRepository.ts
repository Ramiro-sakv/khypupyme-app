import type {
  BusinessAnswers,
  CommandResult,
  WorkspaceBusiness,
  WorkspaceCommand,
  WorkspaceQuery,
  WorkspaceReport,
} from "../../../shared/workspace/model";
import type { IndustryId } from "../../../shared/business-industries";

export interface Page<T> {
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
