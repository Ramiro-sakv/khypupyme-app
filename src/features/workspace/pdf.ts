import type { TDocumentDefinitions } from "pdfmake/interfaces";
import type { BusinessDocument } from "../../../shared/workspace/model";

import { bob } from "./format";

export async function documentBytes(
  document: BusinessDocument,
): Promise<Uint8Array> {
  const [{ default: pdfmake }, { default: fonts }] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);

  const definition: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [35, 45, 35, 45],
    defaultStyle: { font: "Roboto", fontSize: 9 },
    info: {
      title: `${document.number} ${document.title}`,
      author: document.businessName,
      subject: "Documento no fiscal",
    },
    footer: (page, pages) => ({
      text: `${document.number} · Documento no fiscal · ${page} / ${pages}`,
      alignment: "center",
      fontSize: 8,
      margin: [0, 10, 0, 0],
    }),
    content: [
      {
        text: document.businessName,
        fontSize: 20,
        bold: true,
        color: "#164f3b",
      },
      {
        text: [document.address, document.phone].filter(Boolean).join(" · "),
        margin: [0, 4, 0, 10],
      },
      { text: document.title, fontSize: 15, bold: true },
      { text: `${document.number} · ${document.date}`, margin: [0, 4, 0, 15] },
      {
        table: {
          headerRows: 1,
          widths: document.columns.map(() => "*"),
          body: [
            document.columns.map((text) => ({
              text,
              bold: true,
              fillColor: "#eaf3e9",
            })),
            ...(document.rows.length
              ? document.rows
              : [
                  document.columns.map((_, i) =>
                    i === 0 ? "Sin registros" : "",
                  ),
                ]),
          ],
        },
        layout: "lightHorizontalLines",
      },
      ...document.totals.map((t) => ({
        text: `${t.label}: ${bob(t.minor)}`,
        bold: true,
        alignment: "right" as const,
        margin: [0, 10, 0, 0] as [number, number, number, number],
      })),
      { text: document.notes, margin: [0, 20, 0, 0] },
      { text: "DOCUMENTO NO FISCAL", bold: true, margin: [0, 12, 0, 0] },
    ],
  };
  return new Promise((resolve, reject) => {
    try {
      pdfmake
        .createPdf(
          definition,
          undefined,
          undefined,
          fonts as unknown as Record<string, string>,
        )
        .getBuffer((buffer) => resolve(new Uint8Array(buffer)));
    } catch (e) {
      reject(e);
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
    if (path) await writeFile(path, bytes);
    return;
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
    return;
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
}
