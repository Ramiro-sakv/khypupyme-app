import { createContext, useContext, useEffect, useState } from "react";
import type {
  CommandResult,
  WorkspaceAction,
  WorkspaceBusiness,
  WorkspaceCommand,
  WorkspaceQuery,
  WorkspaceResource,
} from "../../../shared/workspace/model";
import type { WorkspaceRepository } from "./WorkspaceRepository";
export interface WorkspaceContextValue {
  identity: Readonly<{ uid: string; businessId: string }>;
  pending: boolean;
  processing?: boolean;
  commandError?: string;
  canRetryPending?: boolean;
  consultPending?: () => Promise<void>;
  retryPending?: () => Promise<void>;
  confirmedOperationId: string;
  rejectedOperationId: string;
  prepare: (action: WorkspaceAction, id?: string) => WorkspaceCommand;
  recover: (command: WorkspaceCommand) => Promise<void>;
  business: WorkspaceBusiness;
  repository: WorkspaceRepository;
  revision: number;
  busy: boolean;
  run: (
    action: WorkspaceAction,
    operationId?: string,
  ) => Promise<CommandResult | undefined>;
}
export const WorkspaceContext = createContext<WorkspaceContextValue | null>(
  null,
);
export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("Falta el contexto de negocio.");
  return value;
}

export function useRecords<T>(
  resource: WorkspaceResource,
  filters: Omit<
    WorkspaceQuery,
    "apiVersion" | "businessId" | "resource" | "cursor"
  > = {},
  enabled = true,
) {
  const { business, repository, revision } = useWorkspace();
  const filterKey = JSON.stringify(filters),
    paginationKey = JSON.stringify([business.id, resource, filterKey]);
  const [paging, setPaging] = useState({ key: paginationKey, cursor: "" }),
    [refresh, setRefresh] = useState(0);
  const cursor = paging.key === paginationKey ? paging.cursor : "";
  const key = JSON.stringify([paginationKey, cursor, revision, refresh]);
  const [result, setResult] = useState<{
    key: string;
    items: T[];
    next: string | null;
    error: string;
  } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    repository
      .list<T>({
        apiVersion: 2,
        businessId: business.id,
        resource,
        ...JSON.parse(filterKey),
        ...(cursor ? { cursor } : {}),
      })
      .then((page) => {
        if (active) setResult({ key, ...page, error: "" });
      })
      .catch((e) => {
        if (active)
          setResult({
            key,
            items: [],
            next: null,
            error: e instanceof Error ? e.message : "No se pudo cargar.",
          });
      });
    return () => {
      active = false;
    };
  }, [business.id, repository, resource, filterKey, cursor, key, enabled]);
  const current = result?.key === key ? result : null;
  return {
    items: current?.items ?? [],
    next: current?.next ?? null,
    error: current?.error ?? "",
    loading: enabled && !current,
    more: () => setPaging({ key: paginationKey, cursor: current?.next ?? "" }),
    first: () => {
      setPaging({ key: paginationKey, cursor: "" });
      setRefresh((n) => n + 1);
    },
  };
}
