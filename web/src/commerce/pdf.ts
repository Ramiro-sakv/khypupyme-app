import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import type { EntryDocument, Report } from "./models";
import { bob, dateLabel, documentAmount, documentName, isOperationalReceipt, methodLabel, reportResult } from "./models";
import { documentTimber, documentUnit } from "../timber/measures";
import { describeLine, lineQuantity, lineRate } from "../retail/measures";
import { downloadFile, isNative } from "../native/platform";

function buildDocument(record: EntryDocument): TDocumentDefinitions {
  const heading = documentName(record.kind);
  const transfer = record.kind === "open-cement";
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
      (transfer ? ["Producto", "Cantidad", "Valor"] : ["Producto", "Cantidad", "Importe unitario", "Subtotal"])
        .map((text) => ({ text, bold: true, fillColor: "#e7f1eb" })),
      ...record.lines.map((line) => [
        { stack: [{ text: line.name }, { text: line.code, color: "#466058", fontSize: 9 },
          ...(line.timber ? [{ text: documentTimber(record, line), color: "#466058", fontSize: 9 }] : []),
          ...(line.details?.timberCatalogMinor != null ? [{ text: "Tarifa de catálogo: " + bob(line.details.timberCatalogMinor) + " por pie tablar", fontSize: 8 }] : []),
          ...(line.details ? [{ text: describeLine(line), color: "#466058", fontSize: 9 }] : [])] },
        { text: lineQuantity(line), alignment: "right" as const },
        ...(transfer ? [] : [{ text: bob(line.unitMinor) + documentUnit(record, line) + lineRate(line), alignment: "right" as const }]),
        { text: bob(line.subtotalMinor), alignment: "right" as const },
      ]),
    ];
    content.push({ table: { headerRows: 1, widths: transfer ? ["*", 70, 75] : ["*", 40, 81, 75], body },
      layout: "lightHorizontalLines", margin: [0, 14, 0, 14] });
  }
  if (record.containers.length > 0) content.push({ table: { headerRows: 1, widths: ["*", 55, 60, 60, 75],
    body: [["Envase", "Entrada", "Entregados", "Devueltos", "Saldo cliente"].map((title) => ({ text: title, bold: true, fillColor: "#e7f1eb" })),
      ...record.containers.map((row) => [row.name, String(row.added), String(row.delivered), String(row.returned), String(row.customerBalance ?? "—")])] },
    layout: "lightHorizontalLines", margin: [0, 6, 0, 10] });
  if (record.discountMinor) content.push({ text: "Descuento · " + bob(record.discountMinor), alignment: "right" });
  const amount = documentAmount(record);
  if (!isOperationalReceipt(record.kind)) content.push({ text: amount.label + " · " + bob(amount.minor), style: "total" });
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
  const file = record.number.replace(/[^a-zA-Z0-9_-]/g, "_") + ".pdf";
  await savePdf(buildDocument(record), file);
}

export async function downloadReport(report: Report, business: string, practice: boolean) {
  const columns = ["Fecha", "Ventas", "Compras", "Costo vendido", "Gastos", "Pérdidas", "Resultado"];
  const rows = report.days.map((day) => [dateLabel(day.date), ...[day.salesMinor, day.purchasesMinor, day.costMinor,
    day.expensesMinor, day.lossesMinor, reportResult(day)].map(bob)]);
  const totals = report.totals;
  await savePdf({
    pageSize: "A4", pageOrientation: "landscape", pageMargins: [34, 34, 34, 36],
    defaultStyle: { fontSize: 9, color: "#172a24" },
    content: [
      { text: business, fontSize: 20, bold: true, color: "#12483d" },
      { text: "Informe de resultados · No fiscal", fontSize: 14, margin: [0, 3, 0, 4] },
      { text: dateLabel(report.from) + " al " + dateLabel(report.to) + " · BOB", margin: [0, 0, 0, 10] },
      ...(practice ? [{ text: "PRÁCTICA — DATOS FICTICIOS", bold: true, color: "#784622" }] : []),
      { text: "Resultado estimado: " + bob(reportResult(totals)) + " · Compras: " + bob(totals.purchasesMinor), bold: true, margin: [0, 0, 0, 10] },
      { table: { headerRows: 1, widths: ["*", 93, 93, 93, 93, 93, 93],
        body: [columns.map((text) => ({ text, bold: true, fillColor: "#e7f1eb" })), ...rows] }, layout: "lightHorizontalLines" },
    ],
    footer: (page, pages) => ({ text: "KhypuPyme · Página " + page + " de " + pages, alignment: "center", margin: [0, 10, 0, 0] }),
  }, "informe-" + report.from + "-" + report.to + ".pdf");
}

async function savePdf(definition: TDocumentDefinitions, file: string) {
  const [{ default: pdfMake }, { default: fonts }] = await Promise.all([
    import("pdfmake/build/pdfmake"), import("pdfmake/build/vfs_fonts"),
  ]);
  const pdf = pdfMake.createPdf(definition, undefined, undefined, fonts as unknown as Record<string, string>);
  if (!isNative) pdf.download(file);
  else {
    const blob = await new Promise<Blob>((resolve) => pdf.getBlob(resolve));
    await downloadFile(blob, file);
  }
}
