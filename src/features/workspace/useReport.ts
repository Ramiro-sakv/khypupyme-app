import { useEffect, useState } from "react";
import type { WorkspaceReport } from "../../../shared/workspace/model";
import { useWorkspace } from "./context";
export function useReport(from: string, to: string) {
  const { business, repository, revision } = useWorkspace(),
    [refresh, setRefresh] = useState(0),
    [result, setResult] = useState<{
      key: string;
      report: WorkspaceReport | null;
      error: string;
    } | null>(null),
    key = JSON.stringify([business.id, revision, from, to, refresh]);
  useEffect(() => {
    let active = true;
    repository
      .report(business.id, from, to)
      .then((report) => {
        if (active) setResult({ key, report, error: "" });
      })
      .catch((e) => {
        if (active)
          setResult({
            key,
            report: null,
            error:
              e instanceof Error ? e.message : "No se pudo cargar el informe.",
          });
      });
    return () => {
      active = false;
    };
  }, [business.id, repository, from, to, key]);
  const current = result?.key === key ? result : null;
  return {
    report: current?.report ?? null,
    error: current?.error ?? "",
    loading: !current,
    refresh: () => setRefresh((n) => n + 1),
  };
}
