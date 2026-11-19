import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ApiError, change, get } from "../api/client";
import { Alert, Button } from "../ui/Primitives";
import { commercePath, documentName } from "./models";
import type { CommandInput, CommandResult } from "./models";
import { clearRequest, pendingRequest, reserveRequest } from "./storage";
import type { DraftStamp, PendingRecord } from "./storage";
import { IdentityDialog } from "../security/IdentityDialog";
import { correctionEffect, needsIdentity } from "../security/corrections";

type Confirmation = { result: CommandResult; draft?: DraftStamp };
type Approval = { record: PendingRecord; resolve: () => void; reject: (error: Error) => void };
type Workspace = {
  path: string; scope: string; practice?: boolean; revision: number; ready: boolean; busy: boolean; pending?: PendingRecord;
  readOnly: boolean;
  confirmation?: Confirmation;
  execute: (command: CommandInput, draft?: DraftStamp) => Promise<CommandResult>;
  showDocument: (id: string) => void;
};
const Context = createContext<Workspace | null>(null);

export function CommerceProvider({ accountId, businessId, businessName, children, showDocument, practice, onConfirmed, readOnly = false }: {
  accountId: string; businessId: string; children: ReactNode; showDocument: (id: string) => void;
  businessName: string;
  practice?: boolean; onConfirmed?: (result: CommandResult) => void;
  readOnly?: boolean;
}) {
  const path = commercePath(businessId, practice);
  const scope = accountId + ":" + businessId;
  const [pending, setPending] = useState<PendingRecord>();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const [notice, setNotice] = useState("");
  const [status, setStatus] = useState<"unknown" | "missing">("unknown");
  const [approval, setApproval] = useState<Approval>();

  useEffect(() => {
    let active = true;
    async function read() {
      try {
        const stored = await pendingRequest(scope);
        if (active) { setPending(stored); setReady(true); }
      } catch {
        if (active) setNotice("El navegador no permite guardar solicitudes de forma local.");
      }
    }
    void read();
    window.addEventListener("focus", read);
    return () => { active = false; window.removeEventListener("focus", read); };
  }, [scope]);

  async function finish(record: PendingRecord, result: CommandResult) {
    if (result.operationId !== record.command.operationId || result.kind !== record.command.kind)
      throw new Error("La respuesta no coincide con la solicitud. Consulta su estado.");
    await change(path + "/commands/" + result.operationId + "/ack", "POST");
    try {
      await clearRequest(record, true);
      setPending(undefined);
    } catch {
      setNotice("La operación fue confirmada. La limpieza local sigue pendiente y se puede consultar de nuevo.");
    }
    setConfirmation({ result, draft: record.draft });
    setRevision((current) => current + 1);
    onConfirmed?.(result);
    return result;
  }

  async function send(record: PendingRecord) {
    let result: CommandResult;
    try {
      result = await change<CommandResult>(path + "/commands", "POST", record.command);
    } catch (error) {
      if (error instanceof ApiError && [400, 401, 403, 404, 409, 422, 429].includes(error.status)) {
        await clearRequest(record, false);
        setPending(undefined);
        throw error;
      }
      setStatus("unknown");
      throw new Error("No se pudo confirmar la respuesta. Consulta la solicitud antes de reintentar.", { cause: error });
    }
    try { return await finish(record, result); }
    catch {
      setStatus("unknown");
      throw new Error("El servidor respondió. Consulta la solicitud para terminar de revisar su resultado.");
    }
  }

  async function authorize(record: PendingRecord) {
    if (!practice && await needsIdentity(record.command, path))
      await new Promise<void>((resolve, reject) => setApproval({ record, resolve, reject }));
  }

  async function execute(input: CommandInput, draft?: DraftStamp) {
    if (readOnly && input.kind !== "close-cash") throw new Error("Activa un plan para registrar operaciones nuevas.");
    if (!ready) throw new Error("Espera a que se abra el registro local.");
    const record = { scope, command: { ...input, operationId: crypto.randomUUID() }, draft };
    setBusy(true);
    setNotice("");
    try {
      const existing = await pendingRequest(scope);
      if (existing) {
        setPending(existing);
        throw new Error("Resuelve primero la solicitud pendiente de este negocio.");
      }
      await authorize(record);
      const claimed = await reserveRequest(record);
      setPending(claimed);
      setStatus("unknown");
      if (claimed.command.operationId !== record.command.operationId)
        throw new Error("Resuelve primero la solicitud pendiente de este negocio.");
      return await send(record);
    }
    finally { setBusy(false); }
  }

  async function inspect(record: PendingRecord) {
    setBusy(true);
    setNotice("");
    setStatus("unknown");
    try {
      const result = await get<CommandResult>(path + "/commands/" + record.command.operationId);
      await finish(record, result);
      setNotice(documentName(result.kind) + " confirmada.");
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setStatus("missing");
        setNotice("El servidor aún no registra esa operación. Puedes reintentar la misma solicitud.");
      } else setNotice("No se pudo consultar la solicitud. Comprueba tu conexión e inténtalo de nuevo.");
    } finally { setBusy(false); }
  }

  async function retry(record: PendingRecord) {
    setBusy(true);
    try {
      const latest = await pendingRequest(scope);
      if (latest?.command.operationId !== record.command.operationId) {
        setPending(latest);
        setNotice("La solicitud local cambió. Actualiza su estado antes de continuar.");
        return;
      }
      await authorize(record);
      const result = await send(record);
      setNotice(documentName(result.kind) + " confirmada.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo reintentar."); }
    finally { setBusy(false); }
  }

  return <Context.Provider value={{ path, scope, practice, revision, ready, busy, pending, confirmation, execute, showDocument, readOnly }}>
    {approval && <IdentityDialog key={approval.record.command.operationId} title={approval.record.command.kind === "configure-business" ? "Autorizar reglas del negocio" : "Autorizar corrección"}
      effect={correctionEffect(businessName, approval.record.command)}
      request={{ id: approval.record.command.operationId, purpose: "correction", businessId,
        command: approval.record.command, reason: approval.record.command.note }}
      done={() => { approval.resolve(); setApproval(undefined); }}
      cancel={() => { approval.reject(new Error("La corrección se canceló.")); setApproval(undefined); }} />}
    {pending && <div className="pending-box">
      <strong>{busy ? "Consultando operación…" : "Solicitud pendiente de " + documentName(pending.command.kind).toLowerCase()}</strong>
      <span>{pending.command.operationId}</span>
      <div className="inline-actions">
        <Button variant="secondary" disabled={busy} onClick={() => void inspect(pending)}>Consultar estado</Button>
        {status === "missing" && <Button disabled={busy} onClick={() => void retry(pending)}>Reintentar solicitud</Button>}
      </div>
    </div>}
    {notice && <Alert>{notice}</Alert>}
    {children}
  </Context.Provider>;
}

export function useCommerce() {
  const value = useContext(Context);
  if (!value) throw new Error("La pantalla requiere un negocio activo.");
  return value;
}

export function useCommerceData<T>(relative: string | null) {
  const { path, revision } = useCommerce();
  const resource = relative === null ? null : path + relative;
  const [refresh, setRefresh] = useState(0);
  const key = resource + "@" + revision + ":" + refresh;
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>();
  useEffect(() => {
    if (resource === null) return;
    const abort = new AbortController();
    void get<T>(resource, abort.signal).then((data) => {
      if (!abort.signal.aborted) setState({ key, data });
    }).catch((error: unknown) => {
      if (!abort.signal.aborted) setState({ key, error: error instanceof Error ? error.message : "No se pudo consultar." });
    });
    return () => abort.abort();
  }, [key, resource]);
  return { ...(state?.key === key ? state : {}), reload: () => setRefresh((value) => value + 1) };
}
