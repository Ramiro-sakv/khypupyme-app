import type { ReactNode } from "react";
import { useSearchParams } from "react-router";
import type { CashSession } from "../../../shared/workspace/model";
import { useRecords } from "./context";
import { CashContext } from "./cash-context";

// La pantalla y la guía usan la misma consulta autorizada del negocio activo.
export function CashStateProvider({ children }: { children: ReactNode }) {
  const [params] = useSearchParams();
  const view = params.get("vista") ?? "inicio";
  const enabled = ["caja", "inicio", "guia"].includes(view);
  const page = useRecords<CashSession>(
    "cashSessions", { status: "open" }, enabled,
  );
  // Actualizar es explícito: recuperar el foco no debe desmontar un formulario sin guardar.
  return (
    <CashContext value={{
      loading: !enabled || page.loading,
      error: page.error,
      open: page.items[0],
      refresh: page.first,
    }}>
      {children}
    </CashContext>
  );
}
