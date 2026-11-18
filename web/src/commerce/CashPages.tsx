import { useState } from "react";
import { Alert, Button, Card, DataTable, TextField } from "../ui/Primitives";
import { useCommerce, useCommerceData } from "./CommerceContext";
import { CommerceHeading, LoadFeedback, NoRecords, OperationForm, Pages, PaymentField, useCommercialForm } from "./CommerceUi";
import { EntryList } from "./Documents";
import { bob, editableMoney, parseMoney, timestamp } from "./models";
import type { CashStatus, Page, Receivable } from "./models";

export function CashPage() {
  const cash = useCommerceData<CashStatus>("/cash");
  if (!cash.data) return <><CommerceHeading title="Caja" /><LoadFeedback {...cash} /></>;
  const session = cash.data.session;
  const opened = session && !session.closedAt;
  return <div className="commerce-stack">
    <CommerceHeading title="Caja" />
    <Card>
      <h2>{opened ? "Caja abierta" : "Caja cerrada"}</h2>
      {session ? <>
        <p>Apertura {timestamp(session.openedAt)} · Fondo {bob(session.openingMinor)}</p>
        <p>Efectivo esperado <strong>{bob(session.expectedMinor)}</strong></p>
        {session.closedAt && session.countedMinor !== null && <p>Cierre {timestamp(session.closedAt)} · Contado {bob(session.countedMinor)}
          {" · Diferencia " + bob(session.countedMinor - session.expectedMinor)}</p>}
      </> : <p>Aún no hay una sesión de caja registrada.</p>}
    </Card>
    <CashEditor key={session?.id + ":" + Boolean(opened)} session={opened ? session : null} />
    {session && <EntryList cashSession={session.id} caption="Movimientos de la sesión" />}
  </div>;
}

function CashEditor({ session }: { session: CashStatus["session"] }) {
  const [amount, setAmount] = useState(session ? editableMoney(session.expectedMinor) : "0");
  const [note, setNote] = useState("");
  const form = useCommercialForm();
  const counted = parseMoney(amount);
  const difference = counted !== null && session ? counted - session.expectedMinor : 0;

  return <OperationForm title={session ? "Cerrar caja" : "Abrir caja"} error={form.error} blocked={form.blocked}
    action={session ? "Confirmar cierre" : "Confirmar apertura"} onSubmit={(event) => {
      event.preventDefault();
      void form.submit(() => {
        if (counted === null) throw new Error("Indica un importe con hasta dos decimales.");
        return { kind: session ? "close-cash" : "open-cash", sourceId: session?.id, amountMinor: counted, note };
      }, () => undefined);
    }}>
    <TextField label={session ? "Efectivo contado (Bs)" : "Fondo inicial (Bs)"} inputMode="decimal" value={amount} required
      onChange={(event) => setAmount(event.target.value)} />
    {difference !== 0 && <Alert>Diferencia de {bob(difference)}. Indica el motivo para cerrar.</Alert>}
    <TextField label={difference === 0 ? "Referencia (opcional)" : "Motivo de la diferencia"} required={difference !== 0}
      maxLength={240} value={note} onChange={(event) => setNote(event.target.value)} />
  </OperationForm>;
}

export function ExpensesPage() {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [method, setMethod] = useState("cash");
  const form = useCommercialForm();
  const { showDocument } = useCommerce();
  return <div className="commerce-stack">
    <CommerceHeading title="Gastos" />
    <OperationForm title="Registrar gasto operativo" error={form.error} blocked={form.blocked} action="Confirmar gasto"
      onSubmit={(event) => {
        event.preventDefault();
        void form.submit(() => {
          const amountMinor = parseMoney(amount);
          if (!amountMinor) throw new Error("Indica un importe mayor a cero con hasta dos decimales.");
          return { kind: "expense", amountMinor, note, method };
        }, (result) => { setAmount(""); setNote(""); showDocument(result.entityId); });
      }}>
      <TextField label="Concepto del gasto" value={note} required maxLength={240} onChange={(event) => setNote(event.target.value)} />
      <TextField label="Importe (Bs)" value={amount} required inputMode="decimal" onChange={(event) => setAmount(event.target.value)} />
      <PaymentField value={method} onChange={setMethod} />
    </OperationForm>
    <EntryList kind="expenses" caption="Gastos y anulaciones" />
  </div>;
}

export function ReceivablesPage() {
  const [paid, setPaid] = useState(false);
  const [index, setIndex] = useState(1);
  const [charging, setCharging] = useState<Receivable>();
  const data = useCommerceData<Page<Receivable>>("/debts?" + new URLSearchParams({ paid: String(paid), page: String(index) }));
  const { showDocument } = useCommerce();
  return <div className="commerce-stack">
    <CommerceHeading title="Fiados" />
    {charging && <CollectEditor key={charging.saleId} debt={charging} close={() => setCharging(undefined)} />}
    <Card>
      <label className="trade-check"><input type="checkbox" checked={paid} onChange={(event) => {
        setPaid(event.target.checked); setIndex(1); setCharging(undefined);
      }} />Ver fiados saldados</label>
      {!data.data ? <LoadFeedback {...data} /> : data.data.items.length === 0 ? <NoRecords /> :
        <DataTable caption={paid ? "Saldados" : "Saldos pendientes"} columns={["Cliente", "Importe original", "Saldo", "Acciones"]}
          rows={data.data.items.map((debt) => ({ id: debt.saleId, cells: [
            <div>{debt.customerName}<small className="record-secondary">{debt.number}</small></div>,
            bob(debt.originalMinor), bob(debt.balanceMinor), <div className="inline-actions">
              <Button variant="secondary" onClick={() => showDocument(debt.saleId)}>Ver venta</Button>
              {debt.balanceMinor > 0 && <Button onClick={() => setCharging(debt)}>Cobrar saldo</Button>}
            </div>,
          ] }))} />}
      <Pages index={index} hasMore={data.data?.hasMore} onChange={setIndex} />
    </Card>
  </div>;
}

function CollectEditor({ debt, close }: { debt: Receivable; close: () => void }) {
  const [method, setMethod] = useState("cash");
  const { showDocument } = useCommerce();
  const form = useCommercialForm();
  return <OperationForm title={"Cobrar a " + debt.customerName} onClose={close} error={form.error} blocked={form.blocked}
    action="Confirmar cobro completo" onSubmit={(event) => {
      event.preventDefault();
      void form.submit(() => ({ kind: "collect", sourceId: debt.saleId, amountMinor: debt.balanceMinor, method }),
        (result) => { close(); showDocument(result.entityId); });
    }}>
    <p>Saldo a cobrar <strong>{bob(debt.balanceMinor)}</strong> · {debt.number}</p>
    <PaymentField value={method} onChange={setMethod} />
  </OperationForm>;
}
