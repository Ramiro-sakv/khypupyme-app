import { useEffect, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { Icon } from "../ui/Icon";
import type { IconName } from "../ui/Icon";
import { CommerceProvider, useCommerceData } from "../commerce/CommerceContext";
import { CatalogPage, CustomersPage } from "../commerce/CatalogPage";
import { CashPage, ExpensesPage, ReceivablesPage } from "../commerce/CashPages";
import { DocumentPage, HistoryPage } from "../commerce/Documents";
import { ReportsPage } from "../commerce/ReportsPage";
import { TradePage } from "../commerce/TradePage";
import type { TradeKind } from "../commerce/TradePage";
import { bob } from "../commerce/models";
import type { CashStatus, EntryDocument, Report } from "../commerce/models";
import { BusinessHome } from "./BusinessHome";
import { BusinessSettings } from "./BusinessSettings";
import { industryTheme } from "./industryThemes";
import type { BusinessProfile } from "./models";
import { PracticeGuide } from "../timber/TimberPractice";
import type { PracticeControls } from "../timber/TimberPractice";
import { unitsOf } from "../timber/measures";
import { Alert, Button, Card } from "../ui/Primitives";
import { SerialHistory } from "../retail/SerialHistory";
import type { StoreAttention } from "../retail/measures";
import { ContainersPage } from "../retail/Containers";
import { measuredIndustry } from "../retail/ProductFields";

const workspaceViews = [
  "inicio", "ventas", "compras", "cotizaciones", "catalogo", "clientes", "caja", "fiados", "gastos", "historial", "informes", "configuracion", "series", "envases",
] as const;
export type WorkspaceView = typeof workspaceViews[number];
export type BusinessView = WorkspaceView | "negocios" | "crear";
export function isWorkspaceView(value: string | null): value is WorkspaceView {
  return workspaceViews.some((view) => view === value);
}

type Navigation = { id: WorkspaceView | "negocios"; name: string; icon: IconName; mobile?: boolean };
const navigation: Navigation[] = [
  { id: "inicio", name: "Inicio", icon: "home", mobile: true },
  { id: "ventas", name: "Ventas", icon: "shops", mobile: true },
  { id: "catalogo", name: "Catálogo", icon: "grid", mobile: true },
  { id: "caja", name: "Caja", icon: "cash", mobile: true },
  { id: "compras", name: "Compras", icon: "parcel" },
  { id: "cotizaciones", name: "Cotizaciones", icon: "document" },
  { id: "clientes", name: "Clientes", icon: "shops" },
  { id: "fiados", name: "Fiados", icon: "calendar" },
  { id: "gastos", name: "Gastos", icon: "cash" },
  { id: "historial", name: "Historial", icon: "document" },
  { id: "informes", name: "Informes", icon: "chart" },
  { id: "configuracion", name: "Configuración", icon: "settings" },
  { id: "negocios", name: "Mis negocios", icon: "shops" },
];

type WorkspaceProps = {
  accountId: string; business: BusinessProfile; industry: string; view: WorkspaceView;
  navigate: (view: BusinessView) => void; onSave: (profile: BusinessProfile) => void;
  practice?: PracticeControls; practiceEntry?: ReactNode;
};

export function BusinessWorkspace({ accountId, business, industry, view, navigate, onSave, practice, practiceEntry }: WorkspaceProps) {
  const theme = industryTheme(business.industry);
  const content = useRef<HTMLDivElement>(null);
  const more = useRef<HTMLDetailsElement>(null);
  const [document, setDocument] = useState<{ id: string; origin: WorkspaceView }>();
  const [quote, setQuote] = useState<EntryDocument>();
  const [historyKind, setHistoryKind] = useState("");
  const [focus, setFocus] = useState("");
  const documentId = document?.origin === view ? document.id : undefined;
  const units = business.industry === "timber" ? unitsOf(business.timberUnits) : undefined;
  const extra: Navigation | undefined = business.industry === "appliances" ? { id: "series", name: "Series y garantías", icon: "appliance" } :
    business.industry === "beverages" ? { id: "envases", name: "Envases", icon: "parcel" } : undefined;
  const menu = practice ? navigation.filter((item) => item.id !== "negocios" && item.id !== "configuracion") :
    extra ? [...navigation.slice(0, -2), extra, ...navigation.slice(-2)] : navigation;

  useEffect(() => {
    (content.current?.querySelector<HTMLElement>("[data-entry-focus]") ?? content.current?.querySelector("h1"))?.focus({ preventScroll: true });
    if (more.current) more.current.open = false;
  }, [view, business.id, documentId]);

  function go(next: BusinessView, target = "") {
    setDocument(undefined);
    setFocus(target);
    if (next !== "historial") setHistoryKind("");
    navigate(next);
  }
  function openDocument(id: string) {
    setDocument({ id, origin: view });
    window.scrollTo(0, 0);
  }
  function link(item: Navigation) {
    function follow(event: MouseEvent<HTMLAnchorElement>) {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (more.current) more.current.open = false;
      go(item.id);
    }
    return <a href={"?vista=" + item.id} aria-current={view === item.id ? "page" : undefined} onClick={follow}>
      <Icon name={item.icon} /><span>{item.name}</span>
    </a>;
  }
  function trade(kind: TradeKind) {
    return <TradePage key={kind} kind={kind} units={units} industry={business.industry} proposal={kind === "sale" ? quote : undefined}
      dismissProposal={() => setQuote(undefined)} onHistory={() => { setHistoryKind(kind); go("historial"); }} />;
  }
  function renderView() {
    if (documentId) return <DocumentPage key={documentId} id={documentId} back={() => setDocument(undefined)}
      openSerial={business.industry === "appliances" ? (serial) => go("series", "serial:" + serial) : undefined}
      convert={(source) => { setQuote(source); go("ventas"); }} />;
    switch (view) {
      case "inicio": return <CommercialHome business={business} industry={industry} icon={theme.icon} navigate={go}
        openSalesHistory={() => { setHistoryKind("sale"); go("historial"); }} />;
      case "catalogo": return <CatalogPage key={focus} units={units} industry={business.industry} focus={focus} />;
      case "clientes": return <CustomersPage />;
      case "ventas": return trade("sale");
      case "compras": return trade("purchase");
      case "cotizaciones": return trade("quote");
      case "caja": return <CashPage />;
      case "gastos": return <ExpensesPage />;
      case "fiados": return <ReceivablesPage />;
      case "historial": return <HistoryPage key={historyKind} initialKind={historyKind} />;
      case "series": return business.industry === "appliances" ? <SerialHistory key={focus} initial={focus.startsWith("serial:") ? focus.slice(7) : undefined}
        filter={focus === "inspection" ? focus : undefined} /> : <Alert>Esta vista pertenece al rubro de Electrodomésticos.</Alert>;
      case "envases": return business.industry === "beverages" ? <ContainersPage /> : <Alert>Esta vista pertenece al rubro de Bebidas.</Alert>;
      case "informes": return <ReportsPage />;
      case "configuracion": return practice ? <Alert>Para cambiar la configuración, pausa la práctica y vuelve al negocio.</Alert> :
        <BusinessSettings profile={business} industry={industry} onSave={onSave} />;
    }
  }

  return <div className="workspace" style={theme.style}>
    <nav className="workspace-nav" aria-label="Navegación del negocio">
      <div className="workspace-nav-business">
        <span className="workspace-business-icon"><Icon name={theme.icon} /></span>
        <div><strong>{business.name}</strong><span>{industry}</span></div>
      </div>
      <ul>{menu.map((item) => <li key={item.id} className={item.mobile ? undefined : "desktop-nav-item"}>{link(item)}</li>)}
        <li className="mobile-nav-more"><details ref={more} onKeyDown={(event) => {
          if (event.key === "Escape" && more.current?.open) {
            more.current.open = false;
            more.current.querySelector("summary")?.focus();
          }
        }}>
          <summary><Icon name="grid" />Más</summary>
          <ul>{menu.filter((item) => !item.mobile).map((item) => <li key={item.id}>{link(item)}</li>)}</ul>
        </details></li>
      </ul>
    </nav>
    <div className="workspace-content" ref={content}>
      {(view !== "inicio" || documentId) && <p className="commerce-business-label">{business.name}</p>}
      {practice && <Alert>PRÁCTICA — DATOS FICTICIOS</Alert>}
      {practiceEntry}
      <CommerceProvider accountId={accountId} businessId={business.id} practice={!!practice} onConfirmed={practice?.refresh} showDocument={openDocument}>
        {renderView()}
      </CommerceProvider>
    </div>
    {practice && <PracticeGuide controls={practice} view={view} navigate={go} />}
  </div>;
}

function CommercialHome({ business, industry, icon, navigate, openSalesHistory }: {
  business: BusinessProfile; industry: string; icon: IconName; navigate: (view: BusinessView, focus?: string) => void;
  openSalesHistory: () => void;
}) {
  const cash = useCommerceData<CashStatus>("/cash");
  const report = useCommerceData<Report>("/report");
  const session = cash.data?.session;
  const opened = !!session && !session.closedAt;
  const summary = session
    ? { state: opened ? "open" as const : "closed" as const, label: opened ? "Caja abierta" : "Caja cerrada",
      detail: "Efectivo esperado · " + bob(session.expectedMinor) }
    : cash.data ? { state: "closed" as const, label: "Sin apertura registrada" } : null;
  return <BusinessHome business={business} industry={industry} icon={icon} cash={summary} days={report.data?.days ?? []}
    cashError={cash.error} reportError={report.error} openCash={() => navigate("caja")}
    openSale={() => navigate("ventas")} openPurchase={() => navigate("compras")} openReports={() => navigate("informes")}
    industryPanel={business.industry === "clothing" ? <Card className="industry-home-card">
      <h2>Tallas, colores y cambios</h2><Button variant="secondary" onClick={() => navigate("catalogo")}>Consultar variantes</Button>
      <Button variant="secondary" onClick={openSalesHistory}>Buscar venta para un cambio</Button>
    </Card> : (measuredIndustry(business.industry) || business.industry === "appliances") &&
      <IndustryAttention industry={business.industry} navigate={navigate} />} />;
}

function IndustryAttention({ industry, navigate }: { industry: string; navigate: (view: BusinessView, focus?: string) => void }) {
  const attention = useCommerceData<StoreAttention>("/attention");
  const store = measuredIndustry(industry);
  function count(value?: number) { return value == null ? "" : " · " + value; }
  return <Card className="industry-home-card">
    <h2>{industry === "beverages" ? "Reposición y envases" : industry === "pets" ? "Alimento y lotes de origen" :
      industry === "cosmetics" ? "Lotes de cosméticos" : store ? "Reposición y vencimientos" : "Garantías e inspecciones"}</h2>
    {store ? <>
      <Button variant="secondary" onClick={() => navigate("catalogo", "reorder")}>Reponer productos{count(attention.data?.reorder)}</Button>
      <Button variant="secondary" onClick={() => navigate("catalogo", "expiring")}>Lotes que vencen en 30 días{count(attention.data?.expiring)}</Button>
      {industry === "beverages" && <Button variant="secondary" onClick={() => navigate("envases")}>Gestionar envases</Button>}
      {industry === "cosmetics" && <Button variant="secondary" onClick={() => navigate("catalogo", "held")}>Revisar lotes apartados</Button>}
    </> : <>
      <Button variant="secondary" onClick={() => navigate("series")}>Buscar historial por serie</Button>
      <Button variant="secondary" onClick={() => navigate("series", "inspection")}>Equipos en inspección{count(attention.data?.inspections)}</Button>
    </>}
    {attention.error && <Alert tone="error">{attention.error}</Alert>}
  </Card>;
}
