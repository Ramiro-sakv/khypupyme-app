import type { WorkspaceCommand } from "../../../shared/workspace/model";
import type { SavedRequest } from "./OperationJournal";
import type { NewBusiness } from "./WorkspaceRepository";
export interface PendingRequestStore {
  get(uid: string, businessId: string): Promise<SavedRequest | undefined>;
  save(
    uid: string,
    businessId: string,
    request: WorkspaceCommand | NewBusiness,
    creation?: boolean,
  ): Promise<void>;
  clear(
    uid: string,
    businessId: string,
    expected?: WorkspaceCommand | NewBusiness,
  ): Promise<void>;
}
