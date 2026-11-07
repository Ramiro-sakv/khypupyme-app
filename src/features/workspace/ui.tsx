import { useState } from "react";
import type { ReactNode, SubmitEvent } from "react";
import { showQuantity } from "../../../shared/workspace/exact";
import type { Quantity } from "../../../shared/workspace/exact";
export function Field({
  label,
  name,
  type = "text",
  value,
  required = true,
  ...rest
}: {
  label: string;
  name: string;
  type?: string;
  value?: string | number;
  required?: boolean;
  min?: number | string;
  max?: number | string;
  step?: string;
  maxLength?: number;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        {...rest}
      />
    </label>
  );
}
export function MethodField({ credit = false }: { credit?: boolean }) {
  return (
    <label>
      Forma de pago
      <select name="method" defaultValue="cash">
        <option value="cash">Efectivo (requiere caja abierta)</option>
        <option value="qr">QR</option>
        <option value="transfer">Transferencia</option>
        {credit && (
          <option value="credit">Fiado, pago completo posterior</option>
        )}
      </select>
    </label>
  );
}
export function ActionForm({
  children,
  onSave,
  label = "Guardar",
  disabled = false,
}: {
  children: ReactNode;
  onSave: (data: FormData) => Promise<unknown>;
  label?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || disabled) return;
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await onSave(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy || disabled}>
        {children}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="primary">{busy ? "Procesando…" : label}</button>
      </fieldset>
    </form>
  );
}
export function Pager({
  page,
}: {
  page: {
    error: string;
    loading: boolean;
    next: string | null;
    items: unknown[];
    first: () => void;
    more: () => void;
  };
}) {
  return (
    <>
      {page.loading && <p role="status">Cargando…</p>}
      {page.error && <p role="alert">{page.error}</p>}
      {!page.loading && !page.error && !page.items.length && (
        <p>Todavía no hay registros.</p>
      )}
      <div className="actions">
        <button type="button" onClick={page.first}>
          Primera página
        </button>
        {page.next && (
          <button type="button" onClick={page.more}>
            Siguientes 25
          </button>
        )}
      </div>
    </>
  );
}
export function QuantityText({ value }: { value: Quantity }) {
  return <>{showQuantity(value)}</>;
}
