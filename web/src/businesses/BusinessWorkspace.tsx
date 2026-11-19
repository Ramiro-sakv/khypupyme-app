import { useEffect, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { Icon } from "../ui/Icon";
import type { components } from "../api/schema";
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
import { BusinessHelp } from "./BusinessHelp";
import { INDUSTRY_GUIDES } from "./industryGuides";
import { industryTheme, usesDeliveries } from "./industryThemes";
import type { IndustryId } from "./industryThemes";
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
  "inicio", "ayuda", "ventas", "compras", "cotizaciones", "catalogo", "entradas", "clientes", "caja", "fiados", "gastos", "historial", "documentos", "informes", "configuracion", "series", "envases", "entregas", "trabajos", "plan",
] as const;
export type WorkspaceView = typeof workspaceViews[number];
export type BusinessView = WorkspaceView | "negocios" | "crear";
export function isWorkspaceView(value: string | null): value is WorkspaceView {
  return workspaceViews.some((view) => view === value);
}

type Navigation = { id: WorkspaceView | "negocios"; name: string; icon: IconName; mobile?: boolean; group?: string };
const navigation: Navigation[] = [
  { id: "inicio", name: "Inicio", icon: "home", mobile: true, group: "Tu negocio" },
  { id: "ayuda", name: "Ayuda", icon: "help" },
  { id: "ventas", name: "Ventas", icon: "cart", mobile: true, group: "Operaciones" },
  { id: "cotizaciones", name: "Cotizaciones", icon: "document" },
  { id: "catalogo", name: "Inventario", icon: "grid", mobile: true },
  { id: "compras", name: "Compras", icon: "parcel" },
  { id: "caja", name: "Caja", icon: "cash", mobile: true },
  { id: "clientes", name: "Clientes", icon: "users", group: "Gestión" },
  { id: "fiados", name: "Fiados", icon: "calendar" },
  { id: "gastos", name: "Gastos", icon: "cash" },
  { id: "informes", name: "Informes", icon: "chart", group: "Análisis y archivo" },
  { id: "historial", name: "Historial", icon: "archive" },
  { id: "documentos", name: "Documentos", icon: "document" },
  { id: "configuracion", name: "Configuración", icon: "settings" },
  { id: "negocios", name: "Mis negocios", icon: "shops" },
];
const shortcuts: Record<string, WorkspaceView> = { KeyI: "inicio", KeyV: "ventas", KeyC: "compras", KeyA: "ayuda" };

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
    business.industry === "beverages" ? { id: "envases", name: "Envases", icon: "parcel" } : undefined;
  const delivery = usesDeliveries(business.industry);
  const extras: Navigation[] = extra ? [extra] : [];
  if (delivery) extras.push({ id: "entregas", name: "Entregas", icon: "parcel" });
  const menu = practice ? navigation.filter((item) => item.id !== "negocios" && item.id !== "configuracion") :
    navigation.flatMap((item) => item.id === "clientes" ? [...extras, item] : [item]);
  const [online, setOnline] = useState(() => navigator.onLine);
  const guide = INDUSTRY_GUIDES[business.industry as IndustryId];

  useEffect(() => {
    (content.current?.querySelector<HTMLElement>("[data-entry-focus]") ?? content.current?.querySelector("h1"))?.focus({ preventScroll: true });
    if (more.current) more.current.open = false;
  }, [view, business.id, documentId, workId, focus]);

  useEffect(() => {
    const refresh = () => setOnline(navigator.onLine);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, []);

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
    const shortcut = Object.entries(shortcuts).find(([, target]) => target === item.id)?.[0].at(-1);
    return <a href={"?vista=" + item.id} aria-current={view === item.id ? "page" : undefined}
      aria-keyshortcuts={shortcut ? "Alt+Shift+" + shortcut : undefined} onClick={follow}>
      <Icon name={item.icon} /><span>{item.name}</span>
    </a>;
  }
  function trade(kind: TradeKind) {
    return <TradePage key={kind} kind={kind} units={units} industry={business.industry} scan={focus === "scan"} proposal={kind === "sale" ? quote : undefined}
      dismissProposal={() => setQuote(undefined)} onHistory={() => { setHistoryKind(kind); go("historial"); }}
      onStockBack={kind === "stock-in" ? () => go("catalogo") : undefined} />;
  }
  function renderView() {
    if (documentId) return <DocumentPage key={documentId} id={documentId} back={() => setDocument(undefined)}
      deliveries={delivery && !practice}
      openWork={works ? (id) => go("trabajos", "", id) : undefined}
      openSerial={equipmentIndustry(business.industry) ? (serial) => go("series", "serial:" + serial) : undefined}
      convert={(source) => { setQuote(source); go("ventas"); }} />;
    if (access.readOnly && ["ventas", "compras", "cotizaciones", "entradas"].includes(view))
      return <Card><Alert>Activa un plan para registrar esta operación. Los borradores se conservan.</Alert>
        <Button variant="secondary" onClick={() => go("historial")}>Ver historial</Button></Card>;
    switch (view) {
      case "inicio": return <CommercialHome business={business} industry={industry} icon={theme.icon} navigate={go}
        readOnly={access.readOnly}
        openSalesHistory={() => { setHistoryKind("sale"); go("historial"); }} />;
      case "ayuda": return <BusinessHelp industry={business.industry} units={units ?? "imperial"} navigate={go} readOnly={access.readOnly} />;
      case "catalogo": return <CatalogPage key={focus} units={units} industry={business.industry} focus={focus}
        onStockIn={!access.readOnly && !practice ? () => go("entradas") : undefined} />;
      case "entradas": return !practice ? trade("stock-in") : <Alert>Realiza la compra del ejercicio desde Compras.</Alert>;
      case "clientes": return <CustomersPage />;
      case "ventas": return works && workId ? <WorkSale key={workId} id={workId} industry={business.industry}
        back={() => go("trabajos", "", workId)} /> : trade("sale");
      case "compras": return trade("purchase");
      case "cotizaciones": return trade("quote");
      case "caja": return <CashPage allowAdjustments={!practice} />;
      case "gastos": return <ExpensesPage />;
      case "fiados": return <ReceivablesPage allowManual={!practice} />;
      case "historial": return <HistoryPage key={historyKind} initialKind={historyKind} allowExport={!practice} />;
      case "documentos": return <HistoryPage key="documents" initialKind="" documents allowExport={!practice} />;
      case "series": return equipmentIndustry(business.industry) ? <SerialHistory key={focus} initial={focus.startsWith("serial:") ? focus.slice(7) : undefined}
        filter={focus === "inspection" ? focus : undefined} /> : <Alert>Esta vista pertenece al rubro de Electrodomésticos.</Alert>;
      case "envases": return business.industry === "beverages" ? <ContainersPage /> : <Alert>Esta vista pertenece al rubro de Bebidas.</Alert>;
      case "entregas": return delivery && !practice ? <DeliveriesPage /> : <Alert>Esta vista corresponde a rubros con entregas.</Alert>;
      case "trabajos": return !works ? <Alert>Esta vista corresponde a negocios con agenda u órdenes.</Alert> : workId ?
        <WorkDetail id={workId} back={() => go("trabajos")} charge={(id) => { setQuote(undefined); go("ventas", "", id); }} /> :
        <WorkList key={focus} industry={business.industry} focus={focus} open={(id) => go("trabajos", "", id)} />;
      case "informes": return <ReportsPage business={business.name} practice={!!practice} />;
      case "configuracion": return practice ? <Alert>Para cambiar la configuración, pausa la práctica y vuelve al negocio.</Alert> :
        <BusinessSettings profile={business} industry={industry} onSave={onSave} openPlan={() => go("plan")} onRemoved={onRemoved} />;
      case "plan": return null;
    }
  }

  return <div className="workspace" style={theme.style} onKeyDown={(event) => {
    const next = shortcuts[event.code];
    if (!next || practice || event.defaultPrevented || event.repeat || !event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey ||
      !(event.target instanceof Element) || event.target.closest("input, select, textarea, [contenteditable], dialog") ||
      (access.readOnly && (next === "ventas" || next === "compras"))) return;
    event.preventDefault();
    go(next);
  }}>
    <nav className="workspace-nav" aria-label="Navegación del negocio">
      <div className="workspace-nav-business">
        <span className="workspace-business-icon"><Icon name={theme.icon} /></span>
        <div><strong>{business.name}</strong><span>{industry}</span></div>
      </div>
      <ul>{menu.flatMap((item) => [
        item.group && <li key={item.group} className="workspace-nav-group">{item.group}</li>,
        <li key={item.id} className={item.mobile ? undefined : "desktop-nav-item"}>{link(item)}</li>,
      ])}
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
      <div className="workspace-masthead">
        {(view !== "inicio" || documentId) && <div className="card-title">
          <span className="workspace-business-icon"><Icon name={theme.icon} /></span>
          <div><strong>{business.name}</strong><p>{industry}</p></div>
        </div>}
        <span className="workspace-connection" data-online={online}>{online ? "Red disponible" : "Sin conexión"}</span>
      </div>
      {practice && <Alert>PRÁCTICA — DATOS FICTICIOS</Alert>}
      {!practice && (access.readOnly || view === "inicio") && <Card className="license-strip">
        <div><strong>{access.readOnly ? "Modo de consulta" : "Plan vigente"}</strong>
          <p>{access.readOnly ? "Puedes consultar el historial, descargar tus datos y cerrar una caja abierta." :
            access.until ? "Vence el " + timestamp(access.until) : "Acceso comercial activo."}</p></div>
        <Button variant="secondary" onClick={() => go("plan")}>Plan del negocio</Button>
      </Card>}
      {!documentId && guide && ["ventas", "compras", "cotizaciones", "catalogo"].includes(view) && <aside className="workspace-industry-banner">
        <Icon name={theme.icon} /><div><strong>{industry}</strong><p>{guide.title}</p></div>
        <Button variant="plain" onClick={() => go("ayuda")}>Ver guía</Button>
      </aside>}
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
  const setup = useCommerceData<components["schemas"]["SetupStatus"]>(readOnly ? null : "/setup");
  const session = cash.data?.session;
  const opened = !!session && !session.closedAt;
  const summary = session
    ? { state: opened ? "open" as const : "closed" as const, label: opened ? "Caja abierta" : "Caja cerrada",
      detail: opened ? "Desde " + timestamp(session.openedAt) + " · Efectivo esperado " + bob(session.expectedMinor) : undefined }
    : cash.data ? { state: "closed" as const, label: "Caja cerrada" } : null;
  return <BusinessHome business={business} industry={industry} icon={icon} cash={summary} report={report.data}
    readOnly={readOnly}
    gettingStarted={setup.data && !setup.data.sold ? setup.data : undefined}
    openHelp={() => navigate("ayuda")}
    cashError={cash.error} reportError={report.error} openCash={() => navigate("caja")}
    openSale={() => navigate("ventas", ["convenience", "grocery"].includes(business.industry) ? "scan" : "")}
    openPurchase={() => navigate("compras")} openReports={() => navigate("informes")} openInventory={() => navigate("catalogo")}
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
