import { useEffect } from "react";
import { useLocation, useSearchParams } from "react-router";
export function confirmDiscardChanges(root: ParentNode = document) {
  return (
    !root.querySelector('form[data-dirty="true"]') ||
    window.confirm(
      "Hay un formulario sin confirmar. ¿Quieres salir? Los borradores ya guardados permanecen en este dispositivo; las solicitudes enviadas conservan su confirmación pendiente.",
    )
  );
}
export function useWorkspaceNavigation() {
  const [params, setParams] = useSearchParams();
  return {
    view: params.get("vista") ?? "inicio",
    go: (view: string, fields?: Record<string, string>) => {
      if (
        (!fields && (params.get("vista") ?? "inicio") === view) ||
        !confirmDiscardChanges()
      )
        return;
      setParams({ ...fields, vista: view });
    },
  };
}
// BrowserRouter y HashRouter usan el índice de history para restaurar Atrás al cancelar.
export function useDraftProtection() {
  const location = useLocation();
  useEffect(() => {
    let restoring = false;
    const previousIndex = Number(window.history.state?.idx ?? 0);
    function beforeUnload(e: BeforeUnloadEvent) {
      if (document.querySelector('form[data-dirty="true"]')) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    function pop(e: PopStateEvent) {
      if (restoring) {
        restoring = false;
        return;
      }
      if (!confirmDiscardChanges()) {
        const next = Number(e.state?.idx ?? previousIndex);
        if (next !== previousIndex) {
          restoring = true;
          e.stopImmediatePropagation();
          window.history.go(previousIndex - next);
        }
      }
    }
    function link(e: MouseEvent) {
      const target =
        e.target instanceof Element
          ? e.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (
        target &&
        target.getAttribute("href") !== "#main" &&
        !target.download &&
        target.target !== "_blank" &&
        target.origin === window.location.origin &&
        target.href !== window.location.href &&
        !confirmDiscardChanges()
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate", pop, true);
    document.addEventListener("click", link, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("popstate", pop, true);
      document.removeEventListener("click", link, true);
    };
  }, [location.key]);
}
