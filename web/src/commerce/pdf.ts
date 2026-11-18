import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import type { EntryDocument } from "./models";
import { bob, dateLabel, documentName, methodLabel } from "./models";
import { documentTimber, documentUnit } from "../timber/measures";

function buildDocument(record: EntryDocument): TDocumentDefinitions {
  const heading = documentName(record.kind);
  const content: Content[] = [
    { text: record.businessName, style: "brand" },
    { text: heading + " · " + record.number, style: "title" },
    { text: "Comprobante no fiscal", color: "#466058", margin: [0, 0, 0, 9] },
    { text: dateLabel(record.date) + (record.expiresOn ? " · Vigente hasta " + dateLabel(record.expiresOn) : "") },
  ];
  if (record.practice) content.push({ text: "PRÁCTICA — DATOS FICTICIOS", bold: true, color: "#784622", margin: [0, 5, 0, 0] });
  if (record.customerName) content.push({ text: record.customerName });
  if (record.method) content.push({ text: "Forma de pago · " + methodLabel(record.method) });
  if (record.note) content.push({ text: record.note, margin: [0, 5, 0, 0] });

  if (record.lines.length > 0) {
    const body: TableCell[][] = [
      ["Producto", "Piezas", "Importe unitario", "Subtotal"].map((text) => ({ text, bold: true, fillColor: "#e7f1eb" })),
      ...record.lines.map((line) => [
        { stack: [{ text: line.name }, { text: line.code, color: "#466058", fontSize: 9 },
          ...(line.timber ? [{ text: documentTimber(record, line), color: "#466058", fontSize: 9 }] : [])] },
        { text: String(line.quantity), alignment: "right" as const },
        { text: bob(line.unitMinor) + documentUnit(record, line), alignment: "right" as const },
        { text: bob(line.subtotalMinor), alignment: "right" as const },
      ]),
    ];
    content.push({ table: { headerRows: 1, widths: ["*", 40, 81, 75], body }, layout: "lightHorizontalLines", margin: [0, 14, 0, 14] });
  }
  if (record.discountMinor) content.push({ text: "Descuento · " + bob(record.discountMinor), alignment: "right" });
  content.push({ text: "Total confirmado · " + bob(record.totalMinor), style: "total" });
  if (record.cashDeltaMinor) content.push({ text: "Movimiento de caja · " + bob(record.cashDeltaMinor), alignment: "right" });
  if (record.debtDeltaMinor) content.push({ text: "Movimiento del fiado · " + bob(record.debtDeltaMinor), alignment: "right" });

  return {
    pageSize: "A4", pageMargins: [40, 40, 40, 42],
    info: { title: record.number + " · " + heading, author: record.businessName },
    defaultStyle: { fontSize: 10, color: "#172a24" },
    styles: {
      brand: { fontSize: 18, bold: true, color: "#12483d", margin: [0, 0, 0, 5] },
      title: { fontSize: 14, bold: true },
      total: { fontSize: 14, bold: true, color: "#12483d", alignment: "right", margin: [0, 7, 0, 6] },
    },
    footer: (page, pages) => ({
      text: "KhypuPyme · " + record.number + " · Página " + page + " de " + pages,
      color: "#466058", fontSize: 9, alignment: "center", margin: [0, 12, 0, 0],
    }),
    content,
  };
}

export async function downloadDocument(record: EntryDocument) {
  const [{ default: pdfMake }, { default: fonts }] = await Promise.all([
    import("pdfmake/build/pdfmake"), import("pdfmake/build/vfs_fonts"),
  ]);
  const file = record.number.replace(/[^a-zA-Z0-9_-]/g, "_") + ".pdf";
  pdfMake.createPdf(buildDocument(record), undefined, undefined, fonts as unknown as Record<string, string>).download(file);
}
