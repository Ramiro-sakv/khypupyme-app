import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, change, get } from "../api/client";
import type { components } from "../api/schema";
import type { BusinessProfile } from "../businesses/models";
import { useCommerce, useCommerceData } from "../commerce/CommerceContext";
import { LoadFeedback, Pages } from "../commerce/CommerceUi";
import { ExportRecords } from "../commerce/ExportRecords";
import { documentName, timestamp } from "../commerce/models";
import type { CommandResult, Page } from "../commerce/models";
import { clearPracticeScope, freezeRemoval, releaseRemoval, removalIsFrozen } from "../commerce/storage";
import { Alert, Button, Card, TextField } from "../ui/Primitives";
import { IdentityDialog, securityPath } from "./IdentityDialog";

type Job = components["schemas"]["BusinessDeletionInfo"];
type Audit = components["schemas"]["AuditInfo"];
const jobsPath = securityPath + "/businesses";

export function BusinessProtection({ profile, onRemoved }: { profile: BusinessProfile; onRemoved: (message: string) => void }) {
  const [removal, setRemoval] = useState(false);
  const [audit, setAudit] = useState(false);
  return <>
    <Card>
      <h2>Registros y seguridad</h2>
      <div className="inline-actions"><ExportRecords /><Button variant="secondary" onClick={() => setAudit(!audit)}>
        {audit ? "Ocultar auditoría" : "Ver auditoría"}</Button></div>
      {audit && <AuditList />}
    </Card>
    <Card>
      <h2>Eliminar negocio</h2>
      <p>El borrado definitivo incluye inventario, clientes, operaciones, comprobantes y la práctica de este negocio.</p>
      {!removal && <Button variant="secondary" onClick={() => setRemoval(true)}>Eliminar {profile.name}</Button>}
      {removal && <RemovalForm profile={profile} hide={() => setRemoval(false)} onRemoved={onRemoved} />}
    </Card>
  </>;
}

function RemovalForm({ profile, hide, onRemoved }: { profile: BusinessProfile; hide: () => void; onRemoved: (message: string) => void }) {
  const workspace = useCommerce();
  const path = jobsPath + "/" + profile.id;
  const [id, setId] = useState(() => crypto.randomUUID());
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [prompt, setPrompt] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [frozen, setFrozen] = useState(false);
  const pending = useCommerceData<CommandResult[]>("/unconfirmed");
  const blocked = !workspace.ready || !!workspace.pending || !pending.data || pending.data.length > 0 || workspace.busy;

  useEffect(() => {
    let current = true;
    void removalIsFrozen(workspace.scope).then((value) => { if (current) setFrozen(value); }).catch(() => undefined);
    return () => { current = false; };
  }, [workspace.scope]);

  async function run(action: () => Promise<void>) {
    setError("");
    setBusy(true);
    try { await action(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "No se pudo completar la solicitud."); }
    finally { setBusy(false); }
  }

  async function confirm() {
    const sandbox = localStorage.getItem("khypupyme2-practice:" + workspace.scope);
    const practiceScope = sandbox && workspace.scope.split(":")[0] + ":" + sandbox;
    await freezeRemoval(workspace.scope);
    setFrozen(true);
    try { if (practiceScope) await freezeRemoval(practiceScope); }
    catch (failure) { await releaseRemoval(workspace.scope); setFrozen(false); throw failure; }
    try { await change<Job>(path + "/confirm", "POST", { id, name, code }); }
    catch (failure) {
      if (failure instanceof ApiError && failure.status < 500) {
        await releaseRemoval(workspace.scope);
        if (practiceScope) await releaseRemoval(practiceScope);
        setFrozen(false);
        throw failure;
      }
      const found = await get<Job>(path).catch(() => undefined);
      if (!found) throw new Error("La confirmación quedó sin respuesta. Consulta el estado o vuelve a confirmar antes de continuar.", { cause: failure });
    }
    try {
      const result = await change<Job>(path + "/resume", "POST");
      if (result.state !== "completed") throw new Error("Limpieza pendiente.");
      await clearRemovedScopes(workspace.scope.split(":")[0], result);
      onRemoved("Negocio eliminado.");
    } catch {
      onRemoved("El borrado quedó pendiente. Puedes reanudarlo desde Mis negocios.");
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || blocked || name !== profile.name) return;
    if (!verified) { setPrompt(true); return; }
    if (!sent) void run(async () => { await change(path + "/code", "POST", { id, name }); setSent(true); });
    else void run(confirm);
  }

  return <>
    {workspace.pending && <Alert>Consulta primero la solicitud pendiente en la parte superior.</Alert>}
    {pending.error && <LoadFeedback {...pending} />}
    {!!pending.data?.length && <div><p>Operaciones que quedaron por revisar</p><ul>
      {pending.data.map((item) => <li key={item.operationId}>{documentName(item.kind)} · {item.entityId}
        <Button variant="plain" disabled={busy || !!workspace.pending} onClick={() => void run(async () => {
          const result = await get<CommandResult>(workspace.path + "/commands/" + item.operationId);
          if (result.entityId !== item.entityId || result.operationId !== item.operationId) throw new Error("El resultado no coincide.");
          await change(workspace.path + "/commands/" + item.operationId + "/ack", "POST");
          pending.reload();
        })}>Marcar resultado revisado</Button></li>)}
    </ul></div>}
    {error && <Alert tone="error">{error}</Alert>}
    <form className="account-form" onSubmit={submit}>
      <TextField label="Nombre exacto del negocio" required maxLength={100} value={name} readOnly={verified}
        onChange={(event) => setName(event.target.value)} />
      {sent && <TextField label="Código de eliminación" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{5}"
        maxLength={5} value={code} onChange={(event) => setCode(event.target.value)} />}
      <div className="inline-actions">
        <Button type="submit" disabled={busy || blocked || name !== profile.name}>{sent ? "Confirmar borrado definitivo" :
          verified ? "Enviar código de eliminación" : "Confirmar identidad para borrar"}</Button>
        {(sent || verified || frozen) && <Button variant="plain" disabled={busy} onClick={() => void run(async () => {
          const found = await get<Job>(path).catch((failure: unknown) => {
            if (failure instanceof ApiError && failure.status === 404) return undefined;
            throw failure;
          });
          if (found) { onRemoved("Consulta la limpieza desde Mis negocios."); return; }
          await releaseRemoval(workspace.scope);
          const sandbox = localStorage.getItem("khypupyme2-practice:" + workspace.scope);
          if (sandbox) await releaseRemoval(workspace.scope.split(":")[0] + ":" + sandbox);
          setFrozen(false); setId(crypto.randomUUID()); setVerified(false); setSent(false); setCode("");
        })}>{frozen ? "Consultar estado del borrado" : "Solicitar una confirmación nueva"}</Button>}
        <Button variant="secondary" disabled={busy} onClick={hide}>Cerrar</Button>
      </div>
    </form>
    {prompt && <IdentityDialog title="Confirma tu identidad" effect={"Eliminar " + profile.name + " · Se enviará un código a tu correo."}
      request={{ id, purpose: "delete-business", businessId: profile.id, name }}
      done={() => { setPrompt(false); setVerified(true); }} cancel={() => setPrompt(false)} />}
  </>;
}

export function RemovalJobs({ accountId }: { accountId: string }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    void get<Job[]>(jobsPath, abort.signal).then(setJobs).catch((failure: unknown) => {
      if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "No se pudo consultar el borrado.");
    });
    return () => abort.abort();
  }, []);

  async function resume(job: Job) {
    setBusy(true);
    setError("");
    try {
      const done = await change<Job>(jobsPath + "/" + job.businessId + "/resume", "POST");
      if (done.state !== "completed") throw new Error("La limpieza sigue pendiente.");
      await clearRemovedScopes(accountId, done);
      setJobs((value) => value.filter((item) => item.businessId !== job.businessId));
      setNotice("Negocio eliminado.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "La limpieza sigue pendiente."); }
    finally { setBusy(false); }
  }

  if (!jobs.length && !error && !notice) return null;
  return <Card><h2>Limpieza de negocios</h2>
    {jobs.map((job) => <div className="inline-actions" key={job.businessId}><p>{job.name} · Borrado pendiente</p>
      <Button disabled={busy} onClick={() => void resume(job)}>Reanudar eliminación</Button></div>)}
    {notice && <Alert tone="success">{notice}</Alert>}
    {error && <Alert tone="error">{error}</Alert>}
  </Card>;
}

async function clearRemovedScopes(accountId: string, job: Job) {
  const scope = accountId + ":" + job.businessId;
  await clearPracticeScope(scope);
  if (job.sandboxId) await clearPracticeScope(accountId + ":" + job.sandboxId);
  const practice = "khypupyme2-practice:" + scope;
  localStorage.removeItem(practice);
  sessionStorage.removeItem(practice);
}

function AuditList() {
  const [page, setPage] = useState(1);
  const result = useCommerceData<Page<Audit>>("/audit?page=" + page);
  return <section><h3>Auditoría de correcciones</h3>
    {!result.data && <LoadFeedback {...result} />}
    {result.data?.items.length === 0 && <p>Todavía no hay correcciones registradas.</p>}
    <ul className="plan-history">{result.data?.items.map((item) => <li key={item.operationId}>
      <div><strong>{documentName(item.kind)}</strong><small>{timestamp(item.at)} · {item.reason}</small>
        <small>Registro {item.entityId} · Titular {item.accountId}</small></div>
    </li>)}</ul>
    <Pages index={page} hasMore={result.data?.hasMore} onChange={setPage} />
  </section>;
}
