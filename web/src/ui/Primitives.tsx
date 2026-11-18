import { useId } from "react";
import type { ButtonHTMLAttributes, ComponentPropsWithRef, ReactNode, SelectHTMLAttributes } from "react";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";

type FieldDetails = { label: string; hint?: string; error?: string };

function FieldFrame({ id, label, hint, error, children }: FieldDetails & { id: string; children: ReactNode }) {
  return <div className="ui-field">
    <label htmlFor={id}>{label}</label>
    {children}
    {hint && <small id={id + "-hint"}>{hint}</small>}
    {error && <small id={id + "-error"} className="ui-field-error">{error}</small>}
  </div>;
}

function described(id: string, hint?: string, error?: string) {
  return [hint && id + "-hint", error && id + "-error"].filter(Boolean).join(" ") || undefined;
}

export function TextField({ id, label, hint, error, ...props }: ComponentPropsWithRef<"input"> & FieldDetails) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return <FieldFrame id={fieldId} label={label} hint={hint} error={error}>
    <input {...props} id={fieldId} aria-invalid={Boolean(error) || undefined} aria-describedby={described(fieldId, hint, error)} />
  </FieldFrame>;
}

export function SelectField({ id, label, hint, error, ...props }: SelectHTMLAttributes<HTMLSelectElement> & FieldDetails) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return <FieldFrame id={fieldId} label={label} hint={hint} error={error}>
    <select {...props} id={fieldId} aria-invalid={Boolean(error) || undefined} aria-describedby={described(fieldId, hint, error)} />
  </FieldFrame>;
}

export function Button({ children, variant = "primary", icon, className, type = "button", ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "plain"; icon?: IconName }) {
  return <button {...props} type={type} className={["ui-button", "ui-button--" + variant, className].filter(Boolean).join(" ")}>
    {icon && <Icon name={icon} />}{children}
  </button>;
}

export function Alert({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "error" | "success" }) {
  return <p className={"ui-alert ui-alert--" + tone} role={tone === "error" ? "alert" : "status"}>{children}</p>;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={["ui-card", className].filter(Boolean).join(" ")}>{children}</section>;
}

export function EmptyState({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return <div className="ui-empty">
    <span className="ui-icon-surface"><Icon name={icon} /></span>
    <strong>{title}</strong>
    <p>{children}</p>
  </div>;
}

export function DataTable({ caption, columns, rows }: {
  caption: string;
  columns: readonly string[];
  rows: readonly { id: string; cells: readonly ReactNode[] }[];
}) {
  return <div className="ui-table-scroll" role="region" aria-label={caption} tabIndex={0}>
    <table className="ui-table">
      <caption>{caption}</caption>
      <thead><tr>{columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id}>{row.cells.map((cell, index) =>
        index === 0 ? <th key={columns[index]} scope="row">{cell}</th> : <td key={columns[index]}>{cell}</td>
      )}</tr>)}</tbody>
    </table>
  </div>;
}
