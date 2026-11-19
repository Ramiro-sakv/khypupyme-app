import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { get } from "../api/client";
import type { components } from "../api/schema";
import { businessApi } from "../businesses/models";
import type { BusinessProfile } from "../businesses/models";
import { PlanPanel } from "./PlanPanel";

export type PlanStatus = components["schemas"]["PlanStatus"];
export type AccessSnapshot = { readOnly: boolean; until: string | null };

export function PlanGate({ business, forced, onEnter, back, children }: {
  business: BusinessProfile; forced: boolean; onEnter: () => void; back: () => void;
  children: (access: AccessSnapshot) => ReactNode;
}) {
  const path = businessApi + "/" + business.id + "/plan";
  const [status, setStatus] = useState<PlanStatus>();
  const [error, setError] = useState("");
  const [entered, setEntered] = useState(false);
  const [stay, setStay] = useState(false);
  const [revision, setRevision] = useState(0);
  const reload = () => setRevision((value) => value + 1);

  useEffect(() => {
    let activeRequest: AbortController | undefined;
    function load() {
      activeRequest?.abort();
      const controller = new AbortController();
      activeRequest = controller;
      void get<PlanStatus>(path, controller.signal).then((result) => {
        if (controller.signal.aborted) return;
        setStatus(result);
        setError("");
        if (result.active) setEntered(true);
      }).catch((failure: unknown) => {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "No se pudo consultar el plan.");
      });
    }
    load();
    const timer = window.setInterval(load, 45_000);
    window.addEventListener("focus", load);
    return () => {
      activeRequest?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [path, revision]);

  const active = !!status?.active && !error;
  if (!forced && !stay && (active || entered)) return children({ readOnly: !active, until: status?.accessUntil ?? null });

  return <PlanPanel business={business} path={path} status={status} error={error} reload={reload} back={back}
    changed={() => { setStay(true); reload(); }} enter={() => { setEntered(true); setStay(false); onEnter(); }} />;
}
