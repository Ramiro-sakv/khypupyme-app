import { useState } from "react";
import { useCommerceData } from "../commerce/CommerceContext";
import { LoadFeedback, OperationForm, Pages, useCommercialForm } from "../commerce/CommerceUi";
import { bob, editableMoney, parseMoney } from "../commerce/models";
import type { Customer, Page, Product } from "../commerce/models";
import { Button, TextField } from "../ui/Primitives";
import { clockTime, detailLabels, todayInBolivia, workNavigation } from "./work";
import type { Work, WorkDetails } from "./work";

const fieldsByIndustry: Record<string, readonly (keyof WorkDetails)[]> = {
  cleaning: ["tasks", "plannedMaterials", "usedMaterials", "billableMaterials", "internalMaterials"],
  professional: ["deliverables"],
  repair: ["equipment", "accessories", "fault", "diagnosis"],
  crafts: ["specifications"],
};
const requiredFields = new Set<keyof WorkDetails>(["tasks", "deliverables", "equipment", "fault", "specifications"]);
const fieldLimit: Partial<Record<keyof WorkDetails, number>> = { equipment: 160, accessories: 240, fault: 500 };

export function WorkEditor({ industry, record, initialDay, close, onSaved }: {
  industry: string; record?: Work; initialDay?: string; close: () => void; onSaved: (id: string) => void;
}) {
  const form = useCommercialForm();
  const appointment = industry === "beauty";
  const [customer, setCustomer] = useState(record ? { id: record.customerId, name: record.customerName } : undefined);
  const [service, setService] = useState(record?.serviceId ?? "");
  const [title, setTitle] = useState(record?.title ?? "");
  const [day, setDay] = useState(record?.day ?? initialDay ?? todayInBolivia());
  const [start, setStart] = useState(record?.startMinute != null ? clockTime(record.startMinute) : "09:00");
  const [duration, setDuration] = useState(String(record?.duration ?? 30));
  const [budget, setBudget] = useState(record?.budgetMinor == null ? "" : editableMoney(record.budgetMinor));
  const [address, setAddress] = useState(record?.address ?? "");
  const [details, setDetails] = useState<WorkDetails>(record?.details ?? {});
  const currentService = useCommerceData<Product>(service ? "/products/" + service : null);
  const budgetLocked = !!record && !["received", "diagnosed", "scheduled"].includes(record.state);
  const earliest = record && record.day < todayInBolivia() ? record.day : todayInBolivia();
  return <OperationForm title={record ? (appointment ? "Reprogramar cita" : "Editar orden") : workNavigation[industry].create}
    error={form.error} action={record ? "Guardar cambios" : "Guardar registro"} blocked={form.blocked} onClose={close} onSubmit={(event) => {
      event.preventDefault();
      void form.submit(() => {
        if (!customer) throw Error("Elige un cliente registrado.");
        if (appointment && !service) throw Error("Elige el servicio de la cita.");
        const [hours, minutes] = start.split(":").map(Number);
        const amount = budget.trim() ? parseMoney(budget) : null;
        if (budget.trim() && amount === null) throw Error("Indica el presupuesto en Bs con hasta dos decimales.");
        return { kind: "save-work", customerId: customer.id, workLink: record ? { id: record.id, revision: record.revision } : undefined,
          work: { title, day, serviceId: service || undefined, budgetMinor: appointment ? undefined : amount, address,
            startMinute: appointment ? hours * 60 + minutes : undefined, duration: appointment ? Number(duration) : undefined, details } };
      }, ({ entityId }) => onSaved(entityId));
    }}>
    <TextField label={appointment ? "Nombre de la cita" : "Nombre del trabajo"} value={title} required maxLength={100}
      onChange={(event) => setTitle(event.target.value)} />
    {record?.receiptId ? <p>Cliente de la recepción · {customer?.name}</p> : <Choice<Customer> label="Cliente" resource="/customers"
      selected={customer?.name} choose={(item) => setCustomer({ id: item.id, name: item.name })} />}
    <Choice<Product> label={appointment ? "Servicio de la cita" : "Servicio a cobrar (opcional)"} resource="/products"
      filters={{ active: "true", service: "true" }} selected={currentService.data?.name}
      choose={(item) => { setService(item.id); if (!title.trim()) setTitle(item.name); }}
      display={(item) => item.name + " · " + bob(item.priceMinor)} clear={!appointment && service ? () => setService("") : undefined} />
    <div className="store-fields">
      <TextField type="date" label={appointment ? "Fecha de la cita" : "Fecha comprometida"} value={day} required min={earliest}
        onChange={(event) => setDay(event.target.value)} />
      {appointment ? <>
        <TextField type="time" label="Hora de inicio" value={start} required onChange={(event) => setStart(event.target.value)} />
        <TextField type="number" label="Duración (minutos)" min={5} max={720} step={1} required value={duration}
          onChange={(event) => setDuration(event.target.value)} />
      </> : <TextField label="Presupuesto (Bs)" inputMode="decimal" value={budget} disabled={budgetLocked}
        onChange={(event) => setBudget(event.target.value)} />}
    </div>
    {industry === "cleaning" && <TextField label="Dirección del trabajo" required maxLength={240} value={address}
      onChange={(event) => setAddress(event.target.value)} />}
    {fieldsByIndustry[industry]?.map((field) => <label className="timber-widths" key={field}>
      <span>{detailLabels[field]}</span>
      <textarea value={details[field] ?? ""} rows={fieldsByIndustry[industry].length > 2 ? 2 : 3} required={requiredFields.has(field)}
        disabled={!!record?.receiptId && ["equipment", "accessories", "fault"].includes(field)} maxLength={fieldLimit[field] ?? 600}
        onChange={(event) => setDetails({ ...details, [field]: event.target.value })} />
    </label>)}
  </OperationForm>;
}

function Choice<T extends { id: string; name: string }>({ label, resource, filters, selected, choose, display, clear }: {
  label: string; resource: string; filters?: Record<string, string>; selected?: string;
  choose: (item: T) => void; display?: (item: T) => string; clear?: () => void;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const result = useCommerceData<Page<T>>(resource + "?" + new URLSearchParams({ ...filters, search, page: String(page) }));
  return <details className="buyer">
    <summary>{label}{selected && " · " + selected}</summary>
    <TextField label={"Buscar " + label.toLowerCase()} type="search" value={search} maxLength={80}
      onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
    {clear && <Button variant="plain" onClick={clear}>Quitar servicio</Button>}
    {!result.data ? <LoadFeedback {...result} /> : result.data.items.length === 0 ? <p>Agrega el registro en {resource === "/customers" ? "Clientes" : "Catálogo"}.</p> :
      <div className="buyer-options">{result.data.items.map((item) => <Button variant="secondary" key={item.id}
        onClick={(event) => { choose(item); const panel = event.currentTarget.closest("details"); if (panel) panel.open = false; }}>
        {display ? display(item) : item.name}</Button>)}</div>}
    <Pages index={page} hasMore={result.data?.hasMore} onChange={setPage} />
  </details>;
}
