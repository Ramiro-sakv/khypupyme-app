import {
  hasAgenda,
  hasDelivery,
  workKindFor,
} from "../../../shared/workspace/operations";
import type { ComponentType, ReactNode } from "react";
import { lazy, Suspense, useState } from "react";
import { Navigate } from "react-router";
import { industryLabel } from "../../../shared/workspace/catalog";
import { useWorkspace } from "./context";
import type { IconName } from "./Icon";
import { Icon } from "./Icon";
import { useWorkspaceNavigation } from "./navigation";
import { Panel } from "./Panel";
const IndustryGuide = lazy(() => import("./IndustryGuidePage")),
  AppointmentPage = lazy(() => import("./AppointmentPage")),
  WorkOrderPage = lazy(() => import("./WorkOrderPage")),
  DeliveryPage = lazy(() => import("./DeliveryPage")),
  ContainerPage = lazy(() => import("./ContainerPage")),
  OperationalSalePage = lazy(() => import("./OperationalSalePage"));
const Catalog = lazy(() => import("./Catalog")),
  SalesPage = lazy(() => import("./SalesPage")),
  PurchasePage = lazy(() => import("./PurchasePage")),
  QuotesPage = lazy(() => import("./QuotesPage")),
  Reports = lazy(() => import("./Reports")),
  Dashboard = lazy(() => import("./Dashboard")),
  Documents = lazy(() => import("./DocumentsPage")),
  Legacy = lazy(() => import("./Legacy"));
const Cash = lazy(() =>
    import("./CashPage").then((m) => ({ default: m.Cash })),
  ),
  Customers = lazy(() =>
    import("./CustomerPage").then((m) => ({ default: m.Customers })),
  ),
  Debts = lazy(() => import("./DebtPage").then((m) => ({ default: m.Debts }))),
  Expenses = lazy(() =>
    import("./ExpensePage").then((m) => ({ default: m.Expenses })),
  ),
  Warranty = lazy(() =>
    import("./WarrantyPage").then((m) => ({ default: m.Warranty })),
  ),
  Preferences = lazy(() =>
    import("./PreferencesPage").then((m) => ({ default: m.Preferences })),
  );
const models: Record<string, ComponentType<{ children: ReactNode }>> = {
  grocery: lazy(() => import("./modules/Convenience")),
  beverages: lazy(() => import("./modules/Convenience")),
  cosmetics: lazy(() => import("./modules/Convenience")),
  pets: lazy(() => import("./modules/Convenience")),
  electronics: lazy(() => import("./modules/Appliances")),
  timber: lazy(() => import("./modules/Timber")),
  clothing: lazy(() => import("./modules/Fashion")),
  footwear: lazy(() => import("./modules/Fashion")),
  appliances: lazy(() => import("./modules/Appliances")),
  convenience: lazy(() => import("./modules/Convenience")),
  ceramics: lazy(() => import("./modules/Ceramics")),
  cement: lazy(() => import("./modules/Cement")),
};
const groups: {
  label: string;
  items: { id: string; label: string; icon: IconName }[];
}[] = [
  {
    label: "Tu negocio",
    items: [
      { id: "inicio", label: "Inicio", icon: "home" },
      { id: "guia", label: "Cómo trabajar aquí", icon: "document" },
    ],
  },
  {
    label: "Operaciones",
    items: [
      { id: "ventas", label: "Ventas", icon: "sale" },
      { id: "cotizaciones", label: "Cotizaciones", icon: "document" },
      { id: "inventario", label: "Inventario", icon: "box" },
      { id: "compras", label: "Compras", icon: "purchase" },
      { id: "caja", label: "Caja", icon: "cash" },
    ],
  },
  {
    label: "Gestión",
    items: [
      { id: "clientes", label: "Clientes", icon: "users" },
      { id: "fiados", label: "Fiados", icon: "debt" },
      { id: "gastos", label: "Gastos", icon: "expense" },
    ],
  },
  {
    label: "Análisis y archivo",
    items: [
      { id: "informes", label: "Informes", icon: "chart" },
      { id: "documentos", label: "Documentos", icon: "document" },
      { id: "negocio", label: "Mi negocio", icon: "settings" },
    ],
  },
];
export default function WorkspaceHome() {
  const { business } = useWorkspace(),
    { view, go } = useWorkspaceNavigation(),
    [more, setMore] = useState(false),
    Model = models[business.industryId ?? ""];
  const sections = [
    ...groups.flatMap((g) => g.items),
    ...(hasAgenda(business.industryId)
      ? [{ id: "agenda", label: "Agenda", icon: "history" as const }]
      : []),
    ...(workKindFor(business.industryId)
      ? [
          {
            id: "ordenes",
            label: "Órdenes y trabajos",
            icon: "document" as const,
          },
        ]
      : []),
    ...(hasDelivery(business.industryId)
      ? [{ id: "entregas", label: "Entregas", icon: "box" as const }]
      : []),
    ...(business.industryId === "beverages"
      ? [{ id: "envases", label: "Envases", icon: "box" as const }]
      : []),
    ...(["appliances", "electronics"].includes(business.industryId ?? "")
      ? [{ id: "garantias", label: "Garantías", icon: "shield" as const }]
      : []),
    ...(business.legacy
      ? [
          {
            id: "anteriores",
            label: "Registros anteriores",
            icon: "history" as const,
          },
        ]
      : []),
  ];
  if (view !== "cobrar-trabajo" && !sections.some((s) => s.id === view))
    return <Navigate to="?vista=inicio" replace />;
  let content: ReactNode;
  switch (view) {
    case "guia":
      content = <IndustryGuide />;
      break;
    case "agenda":
      content = <AppointmentPage />;
      break;
    case "ordenes":
      content = <WorkOrderPage />;
      break;
    case "entregas":
      content = <DeliveryPage />;
      break;
    case "envases":
      content = <ContainerPage />;
      break;
    case "cobrar-trabajo":
      content = <OperationalSalePage />;
      break;
    case "inventario":
      content = <Catalog />;
      break;
    case "compras":
      content = <PurchasePage />;
      break;
    case "ventas":
      content = <SalesPage />;
      break;
    case "cotizaciones":
      content = <QuotesPage />;
      break;
    case "caja":
      content = <Cash />;
      break;
    case "clientes":
      content = <Customers />;
      break;
    case "fiados":
      content = <Debts />;
      break;
    case "gastos":
      content = <Expenses />;
      break;
    case "documentos":
      content = <Documents />;
      break;
    case "negocio":
      content = <Preferences />;
      break;
    case "garantias":
      content = <Warranty />;
      break;
    case "anteriores":
      content = <Legacy />;
      break;
    case "informes":
      content = <Reports />;
      break;
    default:
      content = <Dashboard />;
  }
  function item(id: string, mobile = false) {
    const s = sections.find((s) => s.id === id)!;
    return (
      <button
        key={id}
        title={s.label}
        aria-label={s.label}
        aria-current={view === id ? "page" : undefined}
        onClick={() => {
          go(id);
          setMore(false);
        }}
      >
        <Icon name={s.icon} />
        <span>{mobile && id === "ventas" ? "Vender" : s.label}</span>
      </button>
    );
  }
  return (
    <div className="workspace-shell">
      <aside className="sidebar">
        <div className="sidebar-business">
          <span className="business-symbol">
            <Icon name="box" />
          </span>
          <div>
            <strong>{business.name}</strong>
            <small>{industryLabel(business.industryId)}</small>
          </div>
        </div>
        <nav aria-label="Herramientas del negocio">
          {groups.map((g) => (
            <section className="nav-group" key={g.label}>
              <h2>{g.label}</h2>
              {g.items.map((s) => item(s.id))}
            </section>
          ))}
          {sections
            .filter((s) =>
              ["agenda", "ordenes", "entregas", "envases"].includes(s.id),
            )
            .map((s) => item(s.id))}
          {sections.some((s) => s.id === "garantias") && item("garantias")}
          {business.legacy && item("anteriores")}
        </nav>
        <div className="sidebar-foot">
          <Icon name="shield" />
          <span>
            Espacio independiente
            <br />
            <strong>BOB · Bolivia</strong>
          </span>
        </div>
      </aside>
      <div className="workspace-content" id="workspace-content">
        <Suspense
          fallback={
            <div className="loading-state card" role="status">
              <span className="spinner" />
              Abriendo herramienta…
            </div>
          }
        >
          {Model &&
          ["inventario", "compras", "ventas", "cotizaciones"].includes(view) ? (
            <Model>{content}</Model>
          ) : (
            content
          )}
        </Suspense>
      </div>
      <nav className="mobile-nav" aria-label="Navegación móvil">
        {["inicio", "ventas", "inventario", "caja"].map((id) => item(id, true))}
        <button
          aria-current={
            ["inicio", "ventas", "inventario", "caja"].includes(view)
              ? undefined
              : "page"
          }
          aria-expanded={more}
          aria-controls="more-menu"
          onClick={() => setMore((v) => !v)}
        >
          <Icon name="grid" />
          <span>Más</span>
        </button>
      </nav>
      {more && (
        <Panel
          id="more-menu"
          title="Herramientas"
          className="navigation-panel"
          onClose={() => setMore(false)}
        >
          <nav className="mobile-tools" aria-label="Más herramientas">
            {sections
              .filter(
                (s) =>
                  !["inicio", "ventas", "inventario", "caja"].includes(s.id),
              )
              .map((s) => item(s.id))}
          </nav>
        </Panel>
      )}
    </div>
  );
}
