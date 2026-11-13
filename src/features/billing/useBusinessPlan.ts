import { useCallback, useEffect, useState } from "react";
import type { BusinessPlan } from "../../../shared/workspace/billing";
import { errorMessage } from "../../shared/errors";
import type { WorkspaceRepository } from "../workspace/WorkspaceRepository";

export function useBusinessPlan(repository: WorkspaceRepository, businessId: string, enabled: boolean) {
  const [plan, setPlan] = useState<BusinessPlan | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    if (!enabled || !repository.billing) return;
    let active = true;
    repository.billing<BusinessPlan>({ kind: "plan", businessId }).then((next) => {
      if (active) { setPlan(next); setError(""); }
    }, (cause) => {
      if (active) setError(errorMessage(cause, "No se pudo consultar el plan."));
    });
    return () => { active = false; };
  }, [enabled, repository, businessId, revision]);

  useEffect(() => {
    if (!enabled) return;
    const delay = plan?.expiresAt && plan.expiresAt > plan.serverTime
      ? Math.max(1000, Math.min(60_000, plan.expiresAt - plan.serverTime + 100)) : 60_000;
    const timer = window.setTimeout(refresh, delay);
    window.addEventListener("focus", refresh);
    return () => { window.clearTimeout(timer); window.removeEventListener("focus", refresh); };
  }, [enabled, plan, refresh, revision]);

  return { plan, error, refresh };
}
