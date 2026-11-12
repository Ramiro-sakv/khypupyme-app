import type { WorkspaceReset } from "./model.js";

export type DeletionRequest =
  | { kind: "prepare"; businessId: string; name: string }
  | { kind: "send"; businessId: string; challengeId: string }
  | { kind: "confirm"; businessId: string; challengeId: string; code: string }
  | { kind: "resume"; businessId: string };

export interface DeletionJob {
  businessId: string;
  name: string;
}

export type DeletionResult =
  | { state: "prepared"; challengeId: string }
  | { state: "sent"; challengeId: string; expiresAt: number }
  | { state: "deleting" }
  | { state: "deleted"; reset: WorkspaceReset };
