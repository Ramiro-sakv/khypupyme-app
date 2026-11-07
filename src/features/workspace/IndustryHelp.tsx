import { INDUSTRY_GUIDES } from "../../../shared/workspace/industry-workflows";
import { useWorkspace } from "./context";
import { useWorkspaceNavigation } from "./navigation";
export default function IndustryHelp({
  mode,
}: {
  mode: "purchase" | "sale" | "catalog";
}) {
  const { business } = useWorkspace(),
    { go } = useWorkspaceNavigation(),
    guide = business.industryId ? INDUSTRY_GUIDES[business.industryId] : null;
  return (
    <details className="industry-help-panel">
      <summary>Ayuda para trabajar con este rubro</summary>
      <p>
        {guide?.steps[mode === "catalog" ? 0 : mode === "purchase" ? 1 : 2] ??
          "Prepara el catálogo y registra cada operación con sus datos reales."}
      </p>
      <p>{guide?.caution}</p>
      <button type="button" onClick={() => go("guia")}>
        Abrir guía y ejemplo interactivo
      </button>
    </details>
  );
}
