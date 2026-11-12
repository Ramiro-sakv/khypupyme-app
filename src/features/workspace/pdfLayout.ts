import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import type { BusinessDocument } from "../../../shared/workspace/model";
import { industryLabel } from "../../../shared/workspace/catalog";
import { bob, localDate } from "./format";

const colors = new Map([
  [industryLabel("timber"), "#754015"],
  [industryLabel("clothing"), "#633765"],
  [industryLabel("appliances"), "#1c498f"],
  [industryLabel("convenience"), "#82382e"],
]);
const ink = "#24302d", muted = "#495b55", line = "#d8dfdc", light = "#f3f6f4";
const moneyColumn = /precio|importe|costo|reintegro|valor|saldo|\(bob\)/i;
const quantityColumn = /cantidad|entregada|entrega|disponible|solicitado/i;
const compactMoney = (value: string) => value.replace(/Bs\s+(?=[\d−-])/g, "Bs\u00a0");
const pageLayout = {
  hLineWidth: (index: number) => index === 0 ? 0 : 0.6,
  vLineWidth: () => 0,
  hLineColor: () => line,
  paddingLeft: () => 9,
  paddingRight: () => 9,
  paddingTop: () => 8,
  paddingBottom: () => 8,
};

export function businessDocumentLayout(document: BusinessDocument): TDocumentDefinitions {
  const accent = colors.get(document.industry) ?? "#164f3b";
  const columns = document.columns.length ? document.columns : ["Detalle"];
  const money = columns.map((label) => moneyColumn.test(label));
  const quantitative = columns.map((label, index) => money[index] || quantityColumn.test(label));
  const widths = columns.map((_, index) => index === 0 || !quantitative[index] ? "*" : money[index] ? 88 : 79);
  const notes = document.notes?.trim();
  const practice = notes?.includes("PRÁCTICA") ? "PRÁCTICA · DATOS FICTICIOS"
    : notes?.includes("EJEMPLO") ? "EJEMPLO · DATOS FICTICIOS" : "";
  const keyTotal = document.totals.findIndex(({ label }) => /^total|^resultado|^valor total/i.test(label));
  const mainTotal = keyTotal < 0 ? document.totals.length - 1 : keyTotal;
  const metadata = [document.industry, document.address, document.phone].filter(Boolean);
  const header = columns.map((text, i): TableCell => ({
    text, bold: true, color: "#ffffff", fillColor: accent,
    alignment: quantitative[i] ? "right" : "left",
  }));
  const rows = (document.rows.length ? document.rows : [["Sin registros"]]).map((row, rowIndex) =>
    columns.map((heading, index): TableCell => {
      const raw = row[index] ?? "";
      const formatted = /^fecha$/i.test(heading) && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? localDate(raw) : raw;
      return {
        text: money[index] ? compactMoney(formatted) : formatted,
        fillColor: rowIndex % 2 === 1 ? light : "#ffffff",
        alignment: quantitative[index] ? "right" : "left",
      };
    }));
  const content: Content[] = [
    {
      columns: [
        { width: "*", stack: [
          { text: document.businessName, fontSize: 21, bold: true, color: accent },
          ...metadata.map((text) => ({ text, color: muted, fontSize: 9, margin: [0, 3, 0, 0] as [number, number, number, number] })),
        ] },
        { width: 135, stack: [
          { text: "DOCUMENTO NO FISCAL", fontSize: 8, bold: true, color: accent },
          { text: document.number, margin: [0, 5, 0, 0], bold: true, fontSize: 11 },
          { text: localDate(document.date), margin: [0, 3, 0, 0], color: muted },
        ], alignment: "right" },
      ],
      columnGap: 18,
      margin: [0, 0, 0, 19],
    },
    { text: document.title, fontSize: 16, bold: true, margin: [0, 0, 0, 10] },
    ...(practice ? [{ text: practice, bold: true, color: accent, margin: [0, 0, 0, 10] as [number, number, number, number] }] : []),
    {
      table: { headerRows: 1, widths, body: [header, ...rows] },
      layout: pageLayout,
    },
  ];
  if (document.totals.length) {
    content.push({
      columns: [
        { width: "*", text: "" },
        { width: 304, table: {
          widths: ["*", 106],
          body: document.totals.map(({ label, minor }, index): TableCell[] => {
            const primary = index === mainTotal;
            return [
              { text: label, bold: primary, fillColor: primary ? accent : light, color: primary ? "#fff" : ink },
              { text: compactMoney(bob(minor)), bold: true, alignment: "right", noWrap: true,
                fillColor: primary ? accent : light, color: primary ? "#fff" : ink },
            ];
          }),
        }, layout: pageLayout },
      ],
      unbreakable: true,
      margin: [0, 14, 0, 0],
    });
  }
  if (notes) {
    content.push({
      stack: [
        { text: "Notas y condiciones", bold: true, color: accent, margin: [0, 0, 0, 4] },
        { text: notes, color: muted },
      ],
      margin: [0, 16, 0, 0],
    });
  }
  return {
    pageSize: "A4",
    pageOrientation: columns.length > 5 ? "landscape" : "portrait",
    pageMargins: [40, 38, 40, 44],
    defaultStyle: { font: "Roboto", fontSize: 9.5, color: ink, lineHeight: 1.17 },
    info: { title: `${document.number} ${document.title}`, author: document.businessName, subject: "Documento no fiscal" },
    footer: (page, pages) => ({
      columns: [
        { text: `${document.number} · Documento no fiscal${practice ? " · " + practice : ""}`, width: "*" },
        { text: `Página ${page} de ${pages}`, width: "auto", alignment: "right" },
      ],
      color: muted,
      fontSize: 8,
      margin: [40, 10, 40, 0],
    }),
    content,
  };
}
