import { useState } from "react";
import { SalesChart } from "../businesses/BusinessHome";
import { Button, Card, DataTable, TextField } from "../ui/Primitives";
import { useCommerceData } from "./CommerceContext";
import { CommerceHeading, LoadFeedback } from "./CommerceUi";
import { bob, dateLabel } from "./models";
import type { Report } from "./models";

function result(day: Report["totals"]) {
  return day.resultMinor ?? day.salesMinor - day.costMinor - day.expensesMinor - day.lossesMinor;
}

export function ReportsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [period, setPeriod] = useState("");
  const data = useCommerceData<Report>("/report?" + period);
  const report = data.data;
  return <div className="commerce-stack">
    <CommerceHeading title="Informes" />
    <Card>
      <form className="inline-actions report-range" onSubmit={(event) => {
        event.preventDefault();
        const parameters = new URLSearchParams();
        if (from) parameters.set("from", from);
        if (to) parameters.set("to", to);
        setPeriod(parameters.toString());
        data.reload();
      }}>
        <TextField label="Desde" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <TextField label="Hasta" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        <Button type="submit">Consultar periodo</Button>
      </form>
      {report && <p>{dateLabel(report.from)} al {dateLabel(report.to)} · Hora de Bolivia</p>}
    </Card>
    {!report ? <LoadFeedback {...data} /> : <>
      <div className="report-totals">
        {([
          ["Ventas netas", report.totals.salesMinor], ["Costo de lo vendido", report.totals.costMinor],
          ["Gastos operativos", report.totals.expensesMinor], ["Pérdidas de inventario", report.totals.lossesMinor],
          ["Resultado estimado", result(report.totals)], ["Compras de mercadería", report.totals.purchasesMinor],
          ["Inventario a costo actual", report.stockValueMinor], ["Fiados pendientes actuales", report.receivablesMinor],
        ] as const).map(([title, amount]) => <Card key={title}><h2>{title}</h2><p className="trade-total">{bob(amount)}</p></Card>)}
      </div>
      <p>El resultado descuenta costo de lo vendido, gastos y pérdidas. Las compras se registran por separado.</p>
      <SalesChart days={report.days.slice(-7)} subtitle="Hasta los últimos siete días del periodo" />
      <Card><DataTable caption="Detalle del periodo" columns={["Día", "Ventas", "Compras", "Costo vendido", "Gastos", "Pérdidas", "Resultado"]}
        rows={report.days.map((day) => ({ id: day.date, cells: [dateLabel(day.date), bob(day.salesMinor), bob(day.purchasesMinor),
          bob(day.costMinor), bob(day.expensesMinor), bob(day.lossesMinor), bob(result(day))] }))} /></Card>
    </>}
  </div>;
}
