import type { ReactNode, SubmitEvent } from "react";
import { useId, useRef, useState } from "react";
import type { Quantity } from "../../../shared/workspace/exact";
import { showQuantity } from "../../../shared/workspace/exact";
import type { Method } from "../../../shared/workspace/model";
import { Icon } from "./Icon";
export function Field({
  label,
  name,
  type = "text",
  value,
  required = true,
  help,
  error,
  onValueChange,
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
  onValueChange?: (value: string) => void;
  help?: string;
  error?: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id}>
      <span>
        {label}
        {!required && <small className="optional">Opcional</small>}
      </span>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || help ? id + "-help" : undefined}
        type={type}
        {...(onValueChange
          ? {
              value: value ?? "",
              onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                onValueChange(event.target.value),
            }
          : { defaultValue: value })}
        required={required}
        {...rest}
      />
      {(error || help) && (
        <small
          id={id + "-help"}
          className={error ? "field-error" : "field-help"}
        >
          {error || help}
        </small>
      )}
    </label>
  );
}
export function MethodField({
  credit = false,
  value,
  onValueChange,
}: {
  credit?: boolean;
  value?: Method | "credit";
  onValueChange?: (value: Method | "credit") => void;
}) {
  return (
    <label>
      Forma de pago
      <select
        name="method"
        value={value}
        onChange={(e) => onValueChange?.(e.target.value as Method | "credit")}
        defaultValue={value === undefined ? "cash" : undefined}
      >
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
  className = "",
  dirty = false,
  protectDraft = true,
}: {
  children: ReactNode;
  onSave: (data: FormData) => Promise<unknown>;
  label?: string;
  disabled?: boolean;
  className?: string;
  dirty?: boolean;
  protectDraft?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [changed, setChanged] = useState(false),
    [invalid, setInvalid] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || disabled) return;
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await onSave(data);
      setChanged(false);
      setInvalid(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      ref={formRef}
      className={className}
      onSubmit={submit}
      aria-busy={busy}
      data-dirty={protectDraft && (changed || dirty) ? "true" : "false"}
      data-invalid={invalid ? "true" : undefined}
      onChange={() => setChanged(true)}
      onInvalid={() => setInvalid(true)}
    >
      <fieldset disabled={busy || disabled}>
        {children}
        {(error || invalid) && (
          <div role="alert" className="notice notice-error">
            <Icon name="shield" />
            <span>
              {error || "Revisa los campos señalados antes de continuar."}
            </span>
          </div>
        )}
        <div className="form-submit">
          <button type="submit" className="primary">
            {busy ? (
              <>
                <span className="spinner" />
                Procesando…
              </>
            ) : (
              <>
                <Icon name="check" />
                {label}
              </>
            )}
          </button>
        </div>
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
      {page.loading && (
        <div role="status" className="loading-state">
          <span className="spinner" /> Cargando registros…
        </div>
      )}
      {page.error && (
        <p role="alert" className="notice notice-error">
          {page.error}
        </p>
      )}
      {!page.loading && !page.error && !page.items.length && (
        <div className="empty-state">
          <Icon name="box" />
          <strong>Todavía no hay registros</strong>
          <p>Los registros de este negocio aparecerán aquí.</p>
        </div>
      )}
      <div className="pager">
        <span>{page.items.length} registros en esta página</span>
        <div>
          <button type="button" onClick={page.first} disabled={page.loading}>
            Primera página
          </button>
          {page.next && (
            <button type="button" onClick={page.more} disabled={page.loading}>
              Siguientes 25
            </button>
          )}
        </div>
      </div>
    </>
  );
}
export function QuantityText({ value }: { value: Quantity }) {
  return <>{showQuantity(value)}</>;
}
