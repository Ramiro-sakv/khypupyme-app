import { useEffect, useRef, useState } from "react";
import { AppError } from "../../../shared/app-errors";
import type { WorkspaceBusiness, WorkspaceCommand } from "../../../shared/workspace/model";
import type { CorrectionChallenge } from "../../../shared/workspace/protection";
import { CORRECTION_LABELS, sensitiveAction } from "../../../shared/workspace/protection";
import { displayQuantity } from "../../../shared/workspace/presentation";
import { useAuth } from "../auth/auth-context";
import { useIdentityConfirmation } from "../auth/useIdentityConfirmation";
import { ActionForm, Field } from "./ui";
import { Panel } from "./Panel";
import { bob, statusLabel } from "./format";
import type { WorkspaceRepository } from "./WorkspaceRepository";

interface Review { challenge: CorrectionChallenge; command: WorkspaceCommand; resolve: () => void; reject: (cause: unknown) => void }
function requestedChanges(command: WorkspaceCommand) {
  const original = command.input as unknown as Record<string, unknown>;
  const nested = (original.command ?? original.request) as { kind?: string; input?: Record<string, unknown> } | undefined;
  const input = nested?.input ?? original, kind = nested?.kind ?? command.kind;
  const rows: string[] = [];
  if (typeof input.name === "string") rows.push("Nombre: " + input.name);
  if (typeof input.species === "string") rows.push("Especie: " + input.species);
  if (typeof input.code === "string") rows.push("Código: " + (input.code || "asignación automática"));
  if (typeof input.active === "boolean") rows.push(input.active ? "El producto quedará activo." : "El producto quedará archivado; sus registros se conservarán.");
  if (typeof input.priceMinor === "number") rows.push("Precio propuesto: " + bob(input.priceMinor));
  if (typeof input.amountMinor === "number") rows.push("Importe: " + bob(input.amountMinor));
  if (typeof input.countedMinor === "number") rows.push("Efectivo contado: " + bob(input.countedMinor));
  if (nested?.kind) rows.push(CORRECTION_LABELS[nested.kind] ?? "Recuperación de la solicitud anterior original");
  if (input.prices && typeof input.prices === "object") for (const [key, value] of Object.entries(input.prices)) rows.push(({ superShort: "Supercorta", short: "Corta", long: "Larga" }[key] ?? "Tarifa") + ": " + bob(Number(value)) + " / pie tablar");
  if (input.qty && typeof input.qty === "object") rows.push("Cantidad solicitada: " + displayQuantity(input.qty as { n: string; d: string }) + " " + (input.unit === "piece" ? "piezas" : String(input.unit ?? "unidades")));
  if (input.direction) rows.push(input.direction === "in" ? "Se registrará una entrada o aporte." : "Se registrará una salida o retiro.");
  if (Array.isArray(input.lines)) rows.push("Líneas seleccionadas: " + input.lines.length);
  if (["cancel-debt", "cancel-receivable"].includes(kind)) rows.push("La deuda quedará anulada. No se registrará un cobro ni se borrará el historial.");
  if (kind === "cancel-expense") rows.push("Se anulará el gasto mediante su corrección registrada.");
  if (kind === "cancel-sale") rows.push("Se anulará la venta mediante su registro de corrección, conservando el original.");
  if (["return", "exchange"].includes(kind)) rows.push("Los importes y existencias se comprobarán contra la venta original. El original se conservará.");
  return rows;
}
export function useCorrectionAuthorization(business: WorkspaceBusiness, repository: WorkspaceRepository) {
  const { user } = useAuth(), [review, setReview] = useState<Review | null>(null);
  const identity = useIdentityConfirmation();
  const pending = useRef<Review | null>(null), alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; pending.current?.reject(new AppError("La revisión se cerró. La operación no se envió.", 400, "REVIEW_CANCELLED")); pending.current = null; };
  }, [business.id]);
  const cancel = () => { identity.cancel(); pending.current?.reject(new AppError("Corrección cancelada. No se envió la operación.", 400, "REVIEW_CANCELLED")); pending.current = null; setReview(null); };
  async function authorize(command: WorkspaceCommand) {
    if (business.tutorialSessionId || !sensitiveAction(command)) return;
    if (!repository.approval || !identity.available) throw new AppError("Actualiza la aplicación para confirmar esta corrección.", 403, "REAUTH_UNAVAILABLE");
    if (pending.current) throw new AppError("Completa primero la revisión abierta.", 409, "REVIEW_BUSY");
    if (command.businessId !== business.id || !user) throw new AppError("El negocio o la cuenta cambió. Vuelve a revisar la operación.", 403, "CONTEXT_CHANGED");
    const captured = structuredClone(command), result = await repository.approval("prepare", captured);
    if (!alive.current || !("issuedAt" in result)) throw new AppError("No se pudo preparar la revisión. No se envió la operación.");
    await new Promise<void>((resolve, reject) => {
      const next = { command: captured, challenge: result, resolve, reject };
      pending.current = next; setReview(next);
    });
  }
  const nested = review?.command.input as { reason?: unknown; command?: { input?: { reason?: unknown } }; request?: { input?: { reason?: unknown } } } | undefined;
  const originalReason = nested?.reason ?? nested?.command?.input?.reason ?? nested?.request?.input?.reason;
  const dialog = review && <Panel className="correction-review" title="Confirmar corrección protegida" onClose={cancel}>
    <div className="notice notice-warning">
      <strong>{review.challenge.businessName}</strong>
      <p>{CORRECTION_LABELS[review.command.kind] ?? "Corrección de registros"}</p>
      <p>Revisa los datos y confirma tu identidad. Esta acción conservará un historial del cambio.</p>
    </div>
    {review.challenge.records.map((record) => <section className="card" key={record.collection + record.id}>
      <h3>Registro actual: {String(record.values.name ?? record.values.number ?? record.values.customerName ?? record.values.description ?? record.values.serial ?? "Registro seleccionado")}</h3>
      <dl>{Object.entries(record.values).filter(([key]) => ["code", "species", "active", "status", "amountMinor", "totalMinor", "balanceMinor", "pieces", "valueMinor", "priceMinor"].includes(key)).map(([key, value]) => <div key={key}>
        <dt>{{ code: "Código", species: "Especie", active: "Estado", status: "Estado", amountMinor: "Importe actual", totalMinor: "Importe original", balanceMinor: "Saldo de caja", pieces: "Piezas actuales", valueMinor: "Valor del inventario", priceMinor: "Precio actual" }[key]}</dt>
        <dd>{key.endsWith("Minor") ? bob(Number(value)) : typeof value === "boolean" ? value ? "Activo" : "Archivado" : key === "status" ? statusLabel(String(value)) : String(value)}</dd>
      </div>)}</dl>
    </section>)}
    <h3>Cambio solicitado</h3>
    <ul>{requestedChanges(review.command).map((row, index) => <li key={index}>{row}</li>)}</ul>
    <ActionForm protectDraft={false} label={identity.google ? "Confirmar con Google y aplicar" : "Confirmar contraseña y aplicar esta corrección"} onSave={async (data) => {
      const current = pending.current;
      if (!current || current !== review) throw new AppError("La revisión ya se cerró.");
      if (Date.now() > current.challenge.expiresAt) throw new AppError("La revisión caducó. Cancela y vuelve a abrirla.", 403, "REVIEW_EXPIRED");
      // Firebase expresa auth_time en segundos; garantizar una autenticación posterior al reto.
      if (!identity.google) await new Promise((resolve) => window.setTimeout(resolve, 1100));
      await identity.confirm(data);
      if (!alive.current || pending.current !== current) throw new AppError("La revisión se canceló. No se envió la corrección.");
      await repository.approval!("approve", current.command, String(data.get("reason") ?? ""));
      if (!alive.current || pending.current !== current) throw new AppError("La revisión se cerró. No se envió la corrección.");
      (document.activeElement?.closest("form") as HTMLFormElement | null)?.reset();
      pending.current = null; setReview(null); current.resolve();
    }}>
      {typeof originalReason === "string" && originalReason.trim() ? <>
        <p>Motivo de la solicitud: {originalReason}</p>
        <input type="hidden" name="reason" value={originalReason} />
      </> : <Field name="reason" label="Motivo obligatorio de la corrección" maxLength={200} />}
      {identity.field}
    </ActionForm>
    <button type="button" onClick={cancel}>Cancelar sin aplicar</button>
  </Panel>;
  return { authorize, dialog };
}
