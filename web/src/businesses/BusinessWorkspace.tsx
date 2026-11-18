import { useEffect, useRef } from "react";
import { Icon } from "../ui/Icon";
import type { IconName } from "../ui/Icon";
import { BusinessHome } from "./BusinessHome";
import { BusinessSettings } from "./BusinessSettings";
import { industryTheme } from "./industryThemes";
import type { BusinessProfile } from "./models";

export type WorkspaceView = "inicio" | "configuracion";
export type BusinessView = WorkspaceView | "negocios" | "crear";

const navigation: { id: WorkspaceView | "negocios"; name: string; icon: IconName }[] = [
  { id: "inicio", name: "Inicio", icon: "home" },
  { id: "configuracion", name: "Configuración", icon: "settings" },
  { id: "negocios", name: "Mis negocios", icon: "shops" },
];

export function BusinessWorkspace({ business, industry, view, navigate, onSave }: {
  business: BusinessProfile;
  industry: string;
  view: WorkspaceView;
  navigate: (view: BusinessView) => void;
  onSave: (profile: BusinessProfile) => void;
}) {
  const theme = industryTheme(business.industry);
  const content = useRef<HTMLDivElement>(null);

  useEffect(() => {
    content.current?.querySelector("h1")?.focus({ preventScroll: true });
  }, [view, business.id]);

  return <div className="workspace" style={theme.style}>
    <nav className="workspace-nav" aria-label="Navegación del negocio">
      <div className="workspace-nav-business">
        <span className="workspace-business-icon"><Icon name={theme.icon} /></span>
        <div><strong>{business.name}</strong><span>{industry}</span></div>
      </div>
      <ul>{navigation.map(({ id, name, icon }) => <li key={id}>
        <a href={"?vista=" + id} aria-current={view === id ? "page" : undefined} onClick={(event) => {
          if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          navigate(id);
        }}><Icon name={icon} /><span>{name}</span></a>
      </li>)}</ul>
    </nav>
    <div className="workspace-content" ref={content}>
      {view === "inicio" ? <BusinessHome business={business} industry={industry} icon={theme.icon}
        cash={null} days={[]} openSettings={() => navigate("configuracion")} openSelector={() => navigate("negocios")} />
        : <BusinessSettings key={business.id} profile={business} industry={industry} onSave={onSave} />}
    </div>
  </div>;
}
