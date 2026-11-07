import { amount, decimal, fraction } from "../../../shared/workspace/exact";
import type { Method } from "../../../shared/workspace/model";
export const bob = (minor: number) =>
  new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB" }).format(
    minor / 100,
  );
export const cents = (value: FormDataEntryValue | null | string) => {
  const text = String(value ?? "0")
    .trim()
    .replace(",", ".");
  if (!/^\d{1,11}(\.\d{1,2})?$/.test(text))
    throw new Error(
      "Importe BOB: hasta dos decimales, sin separador de miles.",
    );
  const [units = "0", part = ""] = text.split(".");
  return amount(
    1,
    fraction(BigInt(units) * 100n + BigInt(part.padEnd(2, "0"))),
  );
};
export const q = (value: FormDataEntryValue | null | string) =>
  decimal(String(value ?? "0"));
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const serials = (value: string) =>
  value
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
export const method = (data: FormData) => String(data.get("method")) as Method;

export function averageCost(
  valueMinor: number,
  balance: { n: string; d: string },
  unit: { n: string; d: string },
) {
  const n = BigInt(valueMinor) * BigInt(unit.n) * BigInt(balance.d),
    d = BigInt(unit.d) * BigInt(balance.n),
    minor = (2n * n + d) / (2n * d);
  return (
    "Bs " + String(minor / 100n) + "," + String(minor % 100n).padStart(2, "0")
  );
}
