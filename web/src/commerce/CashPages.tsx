import { useRef, useState } from "react";
import { OperationHeading } from "./OperationHeading";
import { Alert, Button, Card, DataTable, SelectField, TextField } from "../ui/Primitives";
import { useCommerce, useCommerceData } from "./CommerceContext";
import { CommerceHeading, LoadFeedback, NoRecords, OperationForm, Pages, PaymentField, SearchForm, useCommercialForm } from "./CommerceUi";
import { EntryList } from "./Documents";
import { bob, editableMoney, parseMoney, timestamp } from "./models";
import type { CashStatus, Customer, Page, Receivable } from "./models";

export function CashPage({ allowAdjustments = true }: { allowAdjustments?: boolean }) {
  const { readOnly, showDocument } = useCommerce();
  const cash = useCommerceData<CashStatus>("/cash");
  const session = cash.data?.session;
  const opened = session && !session.closedAt;
  return <div className="commerce-stack">
    <OperationHeading area="cash" title="Caja" description="Controla el efectivo de tu turno y consulta las sesiones anteriores." />
    {!cash.data ? <LoadFeedback {...cash} /> : <>
      <div className="cash-workbench">
        <Card className="cash-status-panel">
          <div className="page-heading">
            <h2>Estado de la sesión</h2>
            <span className="status-chip" data-state={opened ? "open" : "closed"}>{opened ? "Caja abierta" : "Caja cerrada"}</span>
          </div>
          {session ? <>
            <p>{session.closedAt ? "Último cierre · " + timestamp(session.closedAt) : "Abierta desde " + timestamp(session.openedAt)}</p>
            <dl className="cash-metrics">
              <div><dt>Efectivo esperado</dt><dd>{bob(session.expectedMinor)}</dd></div>
              <div><dt>Fondo inicial</dt><dd>{bob(session.openingMinor)}</dd></div>
              {session.countedMinor != null && <>
                <div><dt>Efectivo contado</dt><dd>{bob(session.countedMinor)}</dd></div>
                <div><dt>Diferencia</dt><dd>{bob(session.countedMinor - session.expectedMinor)}</dd></div>
              </>}
            </dl>
          </> : <p>Aún no hay sesiones. Abre Caja antes de registrar un cobro en efectivo.</p>}
        </Card>
        <div className="cash-actions">
          {opened ? <>
            <details className="trade-help" key={session.id}>
              <summary>Cerrar y conciliar caja</summary>
              <CashEditor key={session.expectedMinor} session={session} />
            </details>
            {!readOnly && allowAdjustments && <details className="trade-help">
              <summary>Aporte o retiro de efectivo</summary>
              <CashAdjustment session={session.id} onDone={showDocument} />
            </details>}
          </> : !readOnly && <CashEditor session={null} />}
        </div>
      </div>
      <CashLedger current={session ?? null} />
    </>}
  </div>;
}

type CashSession = NonNullable<CashStatus["session"]>;

function CashLedger({ current }: { current: CashSession | null }) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<CashSession>();
  const details = useRef<HTMLHeadingElement>(null);
  const sessions = useCommerceData<Page<CashSession>>("/cash/sessions?page=" + page);
  const active = selected?.id === current?.id ? current : selected ?? current;
  return <div className="cash-ledgers">
    <Card className="cash-history cash-sessions">
      <h2 className="cash-section-title">Sesiones de caja</h2>
      {!sessions.data ? <LoadFeedback {...sessions} /> : sessions.data.items.length === 0 ?
        <NoRecords>Las sesiones aparecerán aquí después de abrir Caja.</NoRecords> :
        <DataTable caption="Sesiones actuales y anteriores" columns={["Apertura", "Estado", "Esperado", "Acción"]}
          rows={sessions.data.items.map((row) => ({ id: row.id, cells: [
            timestamp(row.openedAt), row.closedAt ? "Cerrada" : "Abierta", bob(row.expectedMinor),
            <Button variant="secondary" aria-label={"Ver movimientos de " + timestamp(row.openedAt)} aria-pressed={active?.id === row.id} onClick={() => {
              setSelected(row);
              details.current?.focus();
            }}>Ver movimientos</Button>,
          ] }))} />}
      <Pages index={page} hasMore={sessions.data?.hasMore} onChange={setPage} />
    </Card>
    {active && <section className="cash-history commerce-stack" aria-label="Detalle de caja">
      <div className="page-heading">
        <div>
          <h2 ref={details} tabIndex={-1} className="cash-ledger-details">Movimientos de la sesión</h2>
          <p>{timestamp(active.openedAt)}{active.closedAt && " · Cerrada " + timestamp(active.closedAt)}</p>
        </div>
        {active.id !== current?.id && <Button variant="secondary" onClick={() => {
          setSelected(undefined);
          details.current?.focus();
        }}>Volver a la última sesión</Button>}
      </div>
      <EntryList key={active.id} cashSession={active.id} caption="Registro de movimientos de efectivo" />
    </section>}
  </div>;
}

function CashAdjustment({ session, onDone }: { session: string; onDone: (id: string) => void }) {
  const [direction, setDirection] = useState("in");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const form = useCommercialForm();
  return <OperationForm title="Ajustar efectivo" error={form.error} blocked={form.blocked} action="Confirmar ajuste" onSubmit={(event) => {
    event.preventDefault();
    void form.submit(() => {
      const parsed = parseMoney(amount);
      if (!parsed) throw new Error("Indica un importe mayor a cero. [400]");
      return { kind: "cash-adjust", sourceId: session, code: direction, amountMinor: parsed, note };
    }, (result) => onDone(result.entityId));
  }}>
    <SelectField label="Movimiento de efectivo" value={direction} onChange={(event) => setDirection(event.target.value)}>
      <option value="in">Aporte a caja</option><option value="out">Retiro de caja</option>
    </SelectField>
    <TextField label="Importe (Bs)" required inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
    <TextField label="Motivo" required maxLength={240} value={note} onChange={(event) => setNote(event.target.value)} />
  </OperationForm>;
}

function CashEditor({ session }: { session: CashStatus["session"] }) {
  const [amount, setAmount] = useState(session ? editableMoney(session.expectedMinor) : "0");
  const [note, setNote] = useState("");
  const form = useCommercialForm(!!session);
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

export function ReceivablesPage({ allowManual = true }: { allowManual?: boolean }) {
  const [paid, setPaid] = useState(false);
  const [index, setIndex] = useState(1);
  const [charging, setCharging] = useState<Receivable>();
  const [creating, setCreating] = useState(false);
  const [voiding, setVoiding] = useState<Receivable>();
  const data = useCommerceData<Page<Receivable>>("/debts?" + new URLSearchParams({ paid: String(paid), page: String(index) }));
  const { showDocument, readOnly } = useCommerce();
  return <div className="commerce-stack">
    <CommerceHeading title="Fiados">{!readOnly && allowManual && <Button icon="plus" onClick={() => {
      setCreating(true); setCharging(undefined); setVoiding(undefined);
    }}>Registrar fiado manual</Button>}</CommerceHeading>
    {creating && <ManualDebt onClose={() => setCreating(false)} />}
    {voiding && <ManualDebt key={voiding.saleId} existing={voiding} onClose={() => setVoiding(undefined)} />}
    {charging && <CollectEditor key={charging.saleId} debt={charging} close={() => setCharging(undefined)} />}
    <Card>
      <label className="trade-check"><input type="checkbox" checked={paid} onChange={(event) => {
        setPaid(event.target.checked); setIndex(1); setCharging(undefined); setVoiding(undefined);
      }} />Ver fiados saldados y anulados</label>
      {!data.data ? <LoadFeedback {...data} /> : data.data.items.length === 0 ? <NoRecords /> :
        <DataTable caption={paid ? "Saldados y anulados" : "Saldos pendientes"} columns={["Cliente", "Importe original", "Saldo", "Acciones"]}
          rows={data.data.items.map((debt) => ({ id: debt.saleId, cells: [
            <div>{debt.customerName}<small className="record-secondary">{debt.number}{debt.voided ? " · Anulado" : ""}</small></div>,
            bob(debt.originalMinor), bob(debt.balanceMinor), <div className="inline-actions">
              <Button variant="secondary" onClick={() => showDocument(debt.saleId)}>{debt.manual ? "Ver fiado" : "Ver venta"}</Button>
              {!readOnly && debt.balanceMinor > 0 && <>
                <Button onClick={() => { setCharging(debt); setCreating(false); setVoiding(undefined); }}>Cobrar saldo</Button>
                {debt.manual && <Button variant="plain" onClick={() => { setVoiding(debt); setCharging(undefined); setCreating(false); }}>Anular fiado</Button>}
              </>}
            </div>,
          ] }))} />}
      <Pages index={index} hasMore={data.data?.hasMore} onChange={setIndex} />
    </Card>
  </div>;
}

function ManualDebt({ existing, onClose }: { existing?: Receivable; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [customer, setCustomer] = useState<Customer>();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const { showDocument } = useCommerce();
  const customers = useCommerceData<Page<Customer>>(existing ? null : "/customers?" + new URLSearchParams({ search, page: String(page) }));
  const form = useCommercialForm();
  return <>
    {!existing && <Card>
      <SearchForm label="Buscar cliente del fiado" onSearch={(value) => { setSearch(value); setPage(1); }} />
      {!customers.data ? <LoadFeedback {...customers} /> : customers.data.items.length === 0 ? <p>Sin clientes en esta búsqueda.</p> :
        <div className="inline-actions">{customers.data.items.map((item) => <Button key={item.id} variant="secondary"
          aria-pressed={customer?.id === item.id} onClick={() => setCustomer(item)}>{item.name}</Button>)}</div>}
      <Pages index={page} hasMore={customers.data?.hasMore} onChange={setPage} />
    </Card>}
    <OperationForm title={existing ? "Anular " + existing.number : "Registrar fiado sin venta"} onClose={onClose}
      error={form.error} blocked={form.blocked || (!existing && !customer)} action={existing ? "Confirmar anulación" : "Confirmar fiado"}
      onSubmit={(event) => {
        event.preventDefault();
        void form.submit(() => {
          if (existing) return { kind: "void-debt", sourceId: existing.saleId, note };
          const parsed = parseMoney(amount);
          if (!parsed || !customer) throw new Error("Elige un cliente y un importe positivo. [400]");
          return { kind: "manual-debt", customerId: customer.id, amountMinor: parsed, note };
        }, (result) => { onClose(); showDocument(result.entityId); });
      }}>
      <p>{existing ? existing.customerName + " · Se anulará el saldo de " + bob(existing.balanceMinor) :
        customer ? "Cliente · " + customer.name : "Selecciona un cliente registrado."}</p>
      {!existing && <TextField label="Importe (Bs)" inputMode="decimal" required value={amount} onChange={(event) => setAmount(event.target.value)} />}
      <TextField label={existing ? "Motivo de anulación" : "Concepto del fiado"} required maxLength={240} value={note}
        onChange={(event) => setNote(event.target.value)} />
    </OperationForm>
  </>;
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
