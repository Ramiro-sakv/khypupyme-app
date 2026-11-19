
import type { ReactNode } from "react";
import { Icon } from "../ui/Icon";
import type { IconName } from "../ui/Icon";
import inventory from "../assets/operacion-inventario.jpg";
import purchases from "../assets/operacion-compras.jpg";
import sales from "../assets/operacion-ventas.jpg";
import cash from "../assets/operacion-caja.jpg";

const areas = {
  inventory: { icon: "grid", photo: inventory },
  purchase: { icon: "parcel", photo: purchases },
  sale: { icon: "cart", photo: sales },
  cash: { icon: "cash", photo: cash },
} satisfies Record<string, { icon: IconName; photo: string }>;

export function OperationHeading({ area, title, description, children }: {
  area: keyof typeof areas; title: string; description: string; children?: ReactNode;
}) {
  const { icon, photo } = areas[area];
  return <header className="operation-hero" data-area={area}>
    <div className="operation-hero-content">
      <div className="operation-hero-title">
        <span className="workspace-business-icon"><Icon name={icon} /></span>
        <div><h1 tabIndex={-1}>{title}</h1><p>{description}</p></div>
      </div>
      {children && <div className="inline-actions operation-hero-actions">{children}</div>}
    </div>
    <div aria-hidden="true" className="operation-hero-photo">
      <img src={photo} alt="" decoding="async" />
    </div>
  </header>;
}
