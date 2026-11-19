import { useEffect, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { Icon } from "../ui/Icon";
import type { IconName } from "../ui/Icon";
import { CommerceProvider, useCommerceData } from "../commerce/CommerceContext";
import { LoadFeedback } from "../commerce/CommerceUi";
import { CatalogPage, CustomersPage } from "../commerce/CatalogPage";
import { CashPage, ExpensesPage, ReceivablesPage } from "../commerce/CashPages";
import { DocumentPage, HistoryPage } from "../commerce/Documents";
import { ReportsPage } from "../commerce/ReportsPage";
import { TradePage } from "../commerce/TradePage";
import type { TradeKind } from "../commerce/TradePage";
import { bob, timestamp } from "../commerce/models";
import type { AccessSnapshot } from "../billing/PlanGate";
import type { CashStatus, EntryDocument, Product, Report } from "../commerce/models";
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
import { DeliveriesPage } from "../retail/FurnitureDeliveries";
import { WorkDetail, WorkList, WorkPanel } from "../services/WorkPages";
import { canBillWork, workNavigation } from "../services/work";
import type { Work } from "../services/work";
import { equipmentIndustry, measuredIndustry, variantIndustry } from "../retail/ProductFields";

const workspaceViews = [
  "inicio", "ventas", "compras", "cotizaciones", "catalogo", "clientes", "caja", "fiados", "gastos", "historial", "informes", "configuracion", "series", "envases", "entregas", "trabajos", "plan",
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
  accountId: string; business: BusinessProfile; industry: string; view: WorkspaceView; workId: string;
  navigate: (view: BusinessView, replace?: boolean, workId?: string) => void; onSave: (profile: BusinessProfile) => void;
  practice?: PracticeControls; practiceEntry?: ReactNode;
  access: AccessSnapshot;
  onRemoved: (message: string) => void;
};

export function BusinessWorkspace({ accountId, business, industry, view, workId, navigate, onSave, practice, practiceEntry, access, onRemoved }: WorkspaceProps) {
  const theme = industryTheme(business.industry);
  const content = useRef<HTMLDivElement>(null);
  const more = useRef<HTMLDetailsElement>(null);
  const [document, setDocument] = useState<{ id: string; origin: WorkspaceView; work: string }>();
  const [quote, setQuote] = useState<EntryDocument>();
  const [historyKind, setHistoryKind] = useState("");
  const [focus, setFocus] = useState("");
  const documentId = document?.origin === view && document.work === workId ? document.id : undefined;
  const units = business.industry === "timber" ? unitsOf(business.timberUnits) : undefined;
  const works = workNavigation[business.industry];
  const extra: Navigation | undefined = works ? { id: "trabajos", name: works.title, icon: "calendar" } :
    equipmentIndustry(business.industry) ? { id: "series", name: "Series y garantías", icon: "appliance" } :
    business.industry === "beverages" ? { id: "envases", name: "Envases", icon: "parcel" } :
    business.industry === "furniture" ? { id: "entregas", name: "Entregas", icon: "parcel" } : undefined;
  const menu = practice ? navigation.filter((item) => item.id !== "negocios" && item.id !== "configuracion") :
    extra ? [...navigation.slice(0, -2), extra, ...navigation.slice(-2)] : navigation;

  useEffect(() => {
    (content.current?.querySelector<HTMLElement>("[data-entry-focus]") ?? content.current?.querySelector("h1"))?.focus({ preventScroll: true });
    if (more.current) more.current.open = false;
  }, [view, business.id, documentId, workId]);

  function go(next: BusinessView, target = "", work = "") {
    setDocument(undefined);
    setFocus(target);
    if (next !== "historial") setHistoryKind("");
    navigate(next, false, work);
  }
  function openDocument(id: string) {
    setDocument({ id, origin: view, work: workId });
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
      furniture={business.industry === "furniture"}
      openWork={works ? (id) => go("trabajos", "", id) : undefined}
      openSerial={equipmentIndustry(business.industry) ? (serial) => go("series", "serial:" + serial) : undefined}
      convert={(source) => { setQuote(source); go("ventas"); }} />;
    if (access.readOnly && ["ventas", "compras", "cotizaciones"].includes(view))
      return <Card><Alert>Activa un plan para registrar esta operación. Los borradores se conservan.</Alert>
        <Button variant="secondary" onClick={() => go("historial")}>Ver historial</Button></Card>;
    switch (view) {
      case "inicio": return <CommercialHome business={business} industry={industry} icon={theme.icon} navigate={go}
        readOnly={access.readOnly}
        openSalesHistory={() => { setHistoryKind("sale"); go("historial"); }} />;
      case "catalogo": return <CatalogPage key={focus} units={units} industry={business.industry} focus={focus} />;
      case "clientes": return <CustomersPage />;
      case "ventas": return works && workId ? <WorkSale key={workId} id={workId} industry={business.industry}
        back={() => go("trabajos", "", workId)} /> : trade("sale");
      case "compras": return trade("purchase");
      case "cotizaciones": return trade("quote");
      case "caja": return <CashPage />;
      case "gastos": return <ExpensesPage />;
      case "fiados": return <ReceivablesPage />;
      case "historial": return <HistoryPage key={historyKind} initialKind={historyKind} allowExport={!practice} />;
      case "series": return equipmentIndustry(business.industry) ? <SerialHistory key={focus} initial={focus.startsWith("serial:") ? focus.slice(7) : undefined}
        filter={focus === "inspection" ? focus : undefined} /> : <Alert>Esta vista pertenece al rubro de Electrodomésticos.</Alert>;
      case "envases": return business.industry === "beverages" ? <ContainersPage /> : <Alert>Esta vista pertenece al rubro de Bebidas.</Alert>;
      case "entregas": return business.industry === "furniture" ? <DeliveriesPage /> : <Alert>Esta vista pertenece al rubro de Muebles.</Alert>;
      case "trabajos": return !works ? <Alert>Esta vista corresponde a negocios con agenda u órdenes.</Alert> : workId ?
        <WorkDetail id={workId} back={() => go("trabajos")} charge={(id) => { setQuote(undefined); go("ventas", "", id); }} /> :
        <WorkList key={focus} industry={business.industry} focus={focus} open={(id) => go("trabajos", "", id)} />;
      case "informes": return <ReportsPage />;
      case "configuracion": return practice ? <Alert>Para cambiar la configuración, pausa la práctica y vuelve al negocio.</Alert> :
        <BusinessSettings profile={business} industry={industry} onSave={onSave} openPlan={() => go("plan")} onRemoved={onRemoved} />;
      case "plan": return null;
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
      {!practice && (access.readOnly || view === "inicio") && <Card className="license-strip">
        <div><strong>{access.readOnly ? "Modo de consulta" : "Plan vigente"}</strong>
          <p>{access.readOnly ? "Puedes consultar el historial, descargar tus datos y cerrar una caja abierta." :
            access.until ? "Vence el " + timestamp(access.until) : "Acceso comercial activo."}</p></div>
        <Button variant="secondary" onClick={() => go("plan")}>Plan del negocio</Button>
      </Card>}
      {practiceEntry}
      <CommerceProvider accountId={accountId} businessId={business.id} businessName={business.name} practice={!!practice} readOnly={access.readOnly}
        onConfirmed={practice?.refresh} showDocument={openDocument}>
        {renderView()}
      </CommerceProvider>
    </div>
    {practice && <PracticeGuide controls={practice} view={view} navigate={go} />}
  </div>;
}

function WorkSale({ id, industry, back }: { id: string; industry: string; back: () => void }) {
  const source = useCommerceData<Work>("/work/" + id);
  const serviceId = source.data?.serviceId;
  const service = useCommerceData<Product>(serviceId ? "/products/" + serviceId : null);
  if (!source.data || (serviceId && !service.data && !source.data.saleId))
    return <Card><LoadFeedback {...(!source.data ? source : service)} /><Button variant="secondary" onClick={back}>Volver al trabajo</Button></Card>;
  if (!canBillWork(source.data)) return <Card><Alert>{source.data.saleId ? "Este trabajo ya tiene una venta vinculada." :
    "Marca la cita como atendida o la orden como lista antes de cobrar."}</Alert>
    <Button variant="secondary" onClick={back}>Volver al trabajo</Button></Card>;
  return <TradePage kind="sale" industry={industry} dismissProposal={back} onHistory={back} work={source.data}
    workService={service.data} onWorkBack={back} />;
}

function CommercialHome({ business, industry, icon, navigate, openSalesHistory, readOnly }: {
  business: BusinessProfile; industry: string; icon: IconName; navigate: (view: BusinessView, focus?: string) => void;
  openSalesHistory: () => void; readOnly: boolean;
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
    readOnly={readOnly}
    cashError={cash.error} reportError={report.error} openCash={() => navigate("caja")}
    openSale={() => navigate("ventas")} openPurchase={() => navigate("compras")} openReports={() => navigate("informes")}
    industryPanel={readOnly ? undefined : workNavigation[business.industry] ? <WorkPanel industry={business.industry} open={(focus) => navigate("trabajos", focus)} /> :
      variantIndustry(business.industry) ? <Card className="industry-home-card">
      <h2>Tallas, colores y cambios</h2><Button variant="secondary" onClick={() => navigate("catalogo")}>Consultar variantes</Button>
      <Button variant="secondary" onClick={openSalesHistory}>Buscar venta para un cambio</Button>
    </Card> : business.industry === "spareParts" ? <Card className="industry-home-card">
      <h2>Referencias y compatibilidad</h2><Button variant="secondary" onClick={() => navigate("catalogo")}>Buscar repuesto por vehículo</Button>
      <Button variant="secondary" onClick={() => navigate("ventas")}>Vender repuestos</Button>
    </Card> : business.industry === "stationery" ? <Card className="industry-home-card">
      <h2>Artículos e impresión</h2><Button variant="secondary" onClick={() => navigate("ventas")}>Cobrar artículos e impresiones</Button>
      <Button variant="secondary" onClick={() => navigate("catalogo")}>Configurar tarifas por cara</Button>
    </Card> : business.industry === "furniture" ? <Card className="industry-home-card">
      <h2>Piezas terminadas y entregas</h2><Button variant="secondary" onClick={() => navigate("cotizaciones")}>Cotizar muebles</Button>
      <Button variant="secondary" onClick={() => navigate("entregas")}>Ver retiros y entregas</Button>
    </Card> : business.industry === "ceramics" ? <Card className="industry-home-card">
      <h2>Cobertura, tono y calibre</h2><Button variant="secondary" onClick={() => navigate("cotizaciones")}>Calcular y cotizar revestimiento</Button>
      <Button variant="secondary" onClick={() => navigate("catalogo")}>Consultar existencias</Button>
    </Card> : business.industry === "cement" ? <Card className="industry-home-card">
      <h2>Bolsas y granel</h2><Button variant="secondary" onClick={() => navigate("catalogo")}>Consultar lotes y abrir bolsas</Button>
      <Button variant="secondary" onClick={() => navigate("ventas")}>Vender cemento</Button>
    </Card> : (measuredIndustry(business.industry) || equipmentIndustry(business.industry)) &&
      <IndustryAttention industry={business.industry} navigate={navigate} />} />;
}

function IndustryAttention({ industry, navigate }: { industry: string; navigate: (view: BusinessView, focus?: string) => void }) {
  const attention = useCommerceData<StoreAttention>("/attention");
  const store = measuredIndustry(industry);
  function count(value?: number) { return value == null ? "" : " · " + value; }
  return <Card className="industry-home-card">
    <h2>{industry === "hardware" ? "Estantes y reposición" : industry === "beverages" ? "Reposición y envases" : industry === "pets" ? "Alimento y lotes de origen" :
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
