import { lazy, Suspense, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { useWorkspace } from "./context";
const Catalog = lazy(() => import("./Catalog")),
  Trade = lazy(() => import("./Trade")),
  Reports = lazy(() => import("./Reports")),
  Documents = lazy(() =>
    import("./Reports").then((m) => ({ default: m.Documents })),
  ),
  Legacy = lazy(() => import("./Legacy"));
const Cash = lazy(() =>
    import("./Operations").then((m) => ({ default: m.Cash })),
  ),
  Customers = lazy(() =>
    import("./Operations").then((m) => ({ default: m.Customers })),
  ),
  Debts = lazy(() =>
    import("./Operations").then((m) => ({ default: m.Debts })),
  ),
  Expenses = lazy(() =>
    import("./Operations").then((m) => ({ default: m.Expenses })),
  ),
  Warranty = lazy(() =>
    import("./Operations").then((m) => ({ default: m.Warranty })),
  ),
  Preferences = lazy(() =>
    import("./Operations").then((m) => ({ default: m.Preferences })),
  );
const models: Record<string, ComponentType<{ children: ReactNode }>> = {
  timber: lazy(() => import("./modules/Timber")),
  clothing: lazy(() => import("./modules/Fashion")),
  footwear: lazy(() => import("./modules/Fashion")),
  appliances: lazy(() => import("./modules/Appliances")),
  convenience: lazy(() => import("./modules/Convenience")),
  ceramics: lazy(() => import("./modules/Ceramics")),
  cement: lazy(() => import("./modules/Cement")),
};
const tabs = [
  ["dashboard", "Inicio e informes"],
  ["catalog", "Catálogo"],
  ["purchase", "Compras"],
  ["sale", "Ventas y cotizaciones"],
  ["cash", "Caja"],
  ["customers", "Clientes"],
  ["debts", "Fiados"],
  ["expenses", "Gastos"],
  ["documents", "Documentos"],
  ["preferences", "Mi negocio"],
] as const;
export default function WorkspaceHome() {
  const { business } = useWorkspace(),
    [tab, setTab] = useState("dashboard"),
    Model = models[business.industryId ?? ""];
  let content: ReactNode;
  switch (tab) {
    case "catalog":
      content = <Catalog />;
      break;
    case "purchase":
      content = <Trade purchase />;
      break;
    case "sale":
      content = <Trade />;
      break;
    case "cash":
      content = <Cash />;
      break;
    case "customers":
      content = <Customers />;
      break;
    case "debts":
      content = <Debts />;
      break;
    case "expenses":
      content = <Expenses />;
      break;
    case "documents":
      content = <Documents />;
      break;
    case "preferences":
      content = <Preferences />;
      break;
    case "warranty":
      content = <Warranty />;
      break;
    case "legacy":
      content = <Legacy />;
      break;
    default:
      content = <Reports />;
  }
  return (
    <>
      <nav className="workspace-nav" aria-label="Herramientas del negocio">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
        {business.industryId === "appliances" && (
          <button
            aria-current={tab === "warranty" ? "page" : undefined}
            onClick={() => setTab("warranty")}
          >
            Garantías
          </button>
        )}
        {business.legacy && (
          <button
            aria-current={tab === "legacy" ? "page" : undefined}
            onClick={() => setTab("legacy")}
          >
            Registros anteriores
          </button>
        )}
      </nav>
      <Suspense fallback={<p role="status">Abriendo módulo…</p>}>
        {Model && ["catalog", "purchase", "sale"].includes(tab) ? (
          <Model>{content}</Model>
        ) : (
          content
        )}
      </Suspense>
    </>
  );
}
