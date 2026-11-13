import { useState } from "react";
import { errorMessage } from "../../shared/errors";
import { useWorkspace } from "../workspace/context";

async function saveExport(name: string, content: string) {
  const bytes = new TextEncoder().encode(content);
  if (import.meta.env.VITE_RUNTIME_TARGET === "windows") {
    const [{ save }, { writeFile }] = await Promise.all([import("@tauri-apps/plugin-dialog"), import("@tauri-apps/plugin-fs")]);
    const path = await save({ defaultPath: name, filters: [{ name: "Datos JSON", extensions: ["json"] }] });
    if (!path) return false;
    await writeFile(path, bytes);
  } else if (import.meta.env.VITE_RUNTIME_TARGET === "android") {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor/share")]);
    const file = await Filesystem.writeFile({ path: "exports/" + name, data: content, directory: Directory.Cache, encoding: Encoding.UTF8, recursive: true });
    await Share.share({ title: "Datos de KhypuPyme", files: [file.uri] });
  } else {
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
  return true;
}

export default function BusinessExport() {
  const { business, repository } = useWorkspace();
  const [running, setRunning] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  async function download() {
    setRunning(true);
    setFeedback("");
    setError("");
    try {
      const collections = await repository.exportBusiness?.(business.id);
      if (!collections) throw new Error("La exportación de datos no está disponible.");
      const at = new Date().toISOString();
      if (await saveExport(`khypupyme-${business.id}-${at.slice(0, 10)}.json`, JSON.stringify({ version: 1, at, business, collections }, null, 2)))
        setFeedback("Archivo preparado.");
    } catch (cause) { setError(errorMessage(cause, "No se pudieron descargar los datos.")); }
    finally { setRunning(false); }
  }
  if (!repository.exportBusiness) return null;
  return <section className="card">
    <h2>Descargar datos del negocio</h2>
    <p>Guarda una copia JSON de los registros comerciales y documentos emitidos.</p>
    <button disabled={running} onClick={() => void download()}>{running ? "Preparando datos…" : "Descargar datos"}</button>
    {feedback && <p role="status">{feedback}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
