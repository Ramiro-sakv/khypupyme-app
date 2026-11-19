import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { change, get } from "../api/client";
import { Alert, Button, Card } from "../ui/Primitives";
import { BusinessPicker } from "./BusinessPicker";
import { BusinessWizard } from "./BusinessWizard";
import { BusinessWorkspace, isWorkspaceView } from "./BusinessWorkspace";
import type { BusinessView } from "./BusinessWorkspace";
import { businessApi } from "./models";
import type { BusinessProfile, BusinessSelection, IndustryOption } from "./models";
import { TimberPractice } from "../timber/TimberPractice";
import type { PracticeControls } from "../timber/TimberPractice";
import { PlanGate } from "../billing/PlanGate";
import type { AccessSnapshot } from "../billing/PlanGate";

function readRoute(): { view: BusinessView; workId: string } {
  const params = new URLSearchParams(location.search);
  const view = params.get("vista");
  const work = params.get("trabajo") ?? "";
  return { view: view === "negocios" || view === "crear" || isWorkspaceView(view) ? view : "inicio",
    workId: (view === "ventas" || view === "trabajos") &&
      /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(work) ? work : "" };
}

export function BusinessesPage({ accountId, accountControls }: { accountId: string; accountControls: ReactNode }) {
  const [{ view, workId }, setRoute] = useState(readRoute);
  const [industries, setIndustries] = useState<IndustryOption[]>([]);
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [opening, setOpening] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [initialRequest, setInitialRequest] = useState(0);

  useEffect(() => {
    function restoreView() { setRoute(readRoute()); }
    addEventListener("popstate", restoreView);
    return () => removeEventListener("popstate", restoreView);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([get<IndustryOption[]>(businessApi + "/industries", controller.signal),
      get<BusinessSelection>(businessApi + "/last", controller.signal)])
      .then(async ([options, last]) => {
        const profile = last.business ? await get<BusinessProfile>(businessApi + "/" + last.business.id, controller.signal) : null;
        if (!controller.signal.aborted) {
          setIndustries(options);
          setBusiness(profile);
          setOpening(false);
        }
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) {
          setError(failure instanceof Error ? failure.message : "No se pudieron consultar tus negocios.");
          setOpening(false);
        }
      });
    return () => controller.abort();
  }, [initialRequest]);

  function navigate(next: BusinessView, replace = false, targetWork = "") {
    if (view === next && workId === targetWork) return;
    const url = new URL(location.href);
    url.searchParams.set("vista", next);
    if (targetWork) url.searchParams.set("trabajo", targetWork);
    else url.searchParams.delete("trabajo");
    if (replace) history.replaceState(null, "", url);
    else history.pushState(null, "", url);
    setRoute({ view: next, workId: targetWork });
    window.scrollTo(0, 0);
  }

  async function select(id: string) {
    await change(businessApi + "/" + id + "/selection", "PUT");
    setBusiness(await get<BusinessProfile>(businessApi + "/" + id));
    navigate("inicio");
  }

  if (opening) return <Alert>Consultando tus negocios…</Alert>;
  if (error) return <Card>
    <Alert tone="error">{error}</Alert>
    <Button variant="secondary" onClick={() => { setError(""); setOpening(true); setInitialRequest((value) => value + 1); }}>
      Reintentar
    </Button>
    {accountControls}
  </Card>;
  if (view === "crear") return <BusinessWizard industries={industries} onCancel={() => navigate("negocios", true)}
    onCreated={(created) => { setBusiness(created); navigate("inicio", true); }} />;
  if (view === "negocios" || !business) return <>
    {notice && <Alert>{notice}</Alert>}
    <BusinessPicker industries={industries} accountId={accountId}
      last={business} select={select} create={() => navigate("crear")} />
    <div className="picker-account">{accountControls}</div>
  </>;

  const renderWorkspace = (access: AccessSnapshot, active: BusinessProfile, practice?: PracticeControls, practiceEntry?: ReactNode) =>
    <BusinessWorkspace key={active.id} accountId={accountId} business={active} practice={practice} practiceEntry={practiceEntry}
    industry={industries.find((option) => option.id === business.industry)?.name ?? business.industry}
    view={view} workId={workId} navigate={navigate} access={access} accountControls={accountControls} onRemoved={(message) => {
      setNotice(message); setBusiness(null); navigate("negocios", true);
    }} onSave={(updated) => {
      setBusiness((current) => current?.id === updated.id ? updated : current);
    }} />;
  return <PlanGate key={business.id} business={business} forced={view === "plan"}
    back={() => navigate("negocios")} onEnter={() => navigate("inicio", true)}>
    {(access) => business.industry === "timber" && !access.readOnly ?
      <TimberPractice key={business.id} business={business} accountId={accountId} home={view === "inicio" || view === "ayuda"}
        onExit={() => navigate("inicio", true)} render={(active, practice, entry) => renderWorkspace(access, active, practice, entry)} /> :
      renderWorkspace(access, business)}
  </PlanGate>;
}
