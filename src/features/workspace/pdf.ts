import type { BusinessDocument } from "../../../shared/workspace/model";
import { businessDocumentLayout } from "./pdfLayout";

export async function documentBytes(document: BusinessDocument): Promise<Uint8Array> {
  const [{ default: pdfmake }, { default: fonts }] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  const definition = businessDocumentLayout(document);
  return new Promise((resolve, reject) => {
    try {
      pdfmake.createPdf(definition, undefined, undefined, fonts as unknown as Record<string, string>)
        .getBuffer((buffer) => resolve(new Uint8Array(buffer)));
    } catch (cause) {
      reject(cause);
    }
  });
}
export async function saveDocument(document: BusinessDocument) {
  const bytes = await documentBytes(document),
    name = `${document.number.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
  if (import.meta.env.VITE_RUNTIME_TARGET === "windows") {
    const [{ save }, { writeFile }] = await Promise.all([
      import("@tauri-apps/plugin-dialog"),
      import("@tauri-apps/plugin-fs"),
    ]);
    const path = await save({
      defaultPath: name,
      filters: [{ name: "Documento PDF", extensions: ["pdf"] }],
    });
    if (!path) return "cancelled" as const;
    await writeFile(path, bytes);
    return "saved" as const;
  }
  if (import.meta.env.VITE_RUNTIME_TARGET === "android") {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192)
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    const result = await Filesystem.writeFile({
      path: `documents/${name}`,
      data: btoa(binary),
      directory: Directory.Cache,
      recursive: true,
    });
    await Share.share({
      title: document.title,
      files: [result.uri],
      dialogTitle: "Guardar o compartir documento",
    });
    return "shared" as const;
  }
  const url = URL.createObjectURL(
    new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" }),
  );
  // El nombre del documento no es una ruta del sistema.
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  return "download-requested" as const;
}
