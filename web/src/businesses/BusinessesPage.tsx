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

function readView(): BusinessView {
  const view = new URLSearchParams(location.search).get("vista");
  return view === "negocios" || view === "crear" || isWorkspaceView(view) ? view : "inicio";
}

export function BusinessesPage({ accountId }: { accountId: string }) {
  const [view, setView] = useState(readView);
  const [industries, setIndustries] = useState<IndustryOption[]>([]);
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [opening, setOpening] = useState(true);
  const [error, setError] = useState("");
  const [initialRequest, setInitialRequest] = useState(0);

  useEffect(() => {
    function restoreView() { setView(readView()); }
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

  function navigate(next: BusinessView, replace = false) {
    if (view === next) return;
    const url = new URL(location.href);
    url.searchParams.set("vista", next);
    if (replace) history.replaceState(null, "", url);
    else history.pushState(null, "", url);
    setView(next);
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
  </Card>;
  if (view === "crear") return <BusinessWizard industries={industries} onCancel={() => navigate("negocios", true)}
    onCreated={(created) => { setBusiness(created); navigate("inicio", true); }} />;
  if (view === "negocios" || !business) return <BusinessPicker industries={industries}
    lastId={business?.id} select={select} create={() => navigate("crear")} />;

  const renderWorkspace = (active: BusinessProfile, practice?: PracticeControls, practiceEntry?: ReactNode) =>
    <BusinessWorkspace key={active.id} accountId={accountId} business={active} practice={practice} practiceEntry={practiceEntry}
    industry={industries.find((option) => option.id === business.industry)?.name ?? business.industry}
    view={view} navigate={navigate} onSave={(updated) => {
      setBusiness((current) => current?.id === updated.id ? updated : current);
    }} />;
  return business.industry === "timber" ? <TimberPractice key={business.id} business={business} accountId={accountId}
    home={view === "inicio"} onExit={() => navigate("inicio", true)} render={renderWorkspace} /> : renderWorkspace(business);
}
