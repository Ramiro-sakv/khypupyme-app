/** Cantidades exactas de la API: JSON nunca transporta BigInt ni cantidades flotantes. */
export interface Quantity {
  n: string;
  d: string;
}
const gcd = (a: bigint, b: bigint): bigint =>
  b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b);
export function fraction(n: bigint, d = 1n): Quantity {
  if (d <= 0n) throw new Error("Denominador inválido.");
  const divisor = gcd(n, d) || 1n;
  const result = { n: String(n / divisor), d: String(d / divisor) };
  if (result.n.replace("-", "").length > 72 || result.d.length > 72)
    throw new Error("Cantidad fuera de límites.");
  return result;
}
export const ZERO: Quantity = { n: "0", d: "1" };
export const ONE: Quantity = { n: "1", d: "1" };
export function quantity(raw: unknown, allowZero = true): Quantity {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("Cantidad inválida.");
  const value = raw as Record<string, unknown>;
  if (
    Object.keys(value).length !== 2 ||
    typeof value.n !== "string" ||
    typeof value.d !== "string" ||
    !/^(0|[1-9]\d{0,35})$/.test(value.n) ||
    !/^[1-9]\d{0,12}$/.test(value.d)
  )
    throw new Error("Cantidad inválida.");
  const normalized = fraction(BigInt(value.n), BigInt(value.d));
  if (
    normalized.n !== value.n ||
    normalized.d !== value.d ||
    (!allowZero && value.n === "0")
  )
    throw new Error("Cantidad no normalizada o vacía.");
  return normalized;
}
export function decimal(value: string, places = 6): Quantity {
  const text = value.trim().replace(",", ".");
  if (
    !(
      places === 0
        ? /^\d{1,9}$/
        : new RegExp(`^\\d{1,9}(\\.\\d{1,${places}})?$`)
    ).test(text)
  )
    throw new Error(
      `Usa un número positivo con hasta ${places} decimales, sin miles.`,
    );
  const [whole = "0", part = ""] = text.split(".");
  return fraction(BigInt(whole + part), 10n ** BigInt(part.length));
}
export const add = (a: Quantity, b: Quantity) =>
  fraction(
    BigInt(a.n) * BigInt(b.d) + BigInt(b.n) * BigInt(a.d),
    BigInt(a.d) * BigInt(b.d),
  );
export const sub = (a: Quantity, b: Quantity) =>
  fraction(
    BigInt(a.n) * BigInt(b.d) - BigInt(b.n) * BigInt(a.d),
    BigInt(a.d) * BigInt(b.d),
  );
export const mul = (a: Quantity, b: Quantity) =>
  fraction(BigInt(a.n) * BigInt(b.n), BigInt(a.d) * BigInt(b.d));
export function div(a: Quantity, b: Quantity) {
  if (BigInt(b.n) <= 0n) throw new Error("Divisor inválido.");
  return fraction(BigInt(a.n) * BigInt(b.d), BigInt(a.d) * BigInt(b.n));
}
export const compare = (a: Quantity, b: Quantity) => {
  const delta = BigInt(a.n) * BigInt(b.d) - BigInt(b.n) * BigInt(a.d);
  return delta < 0n ? -1 : delta > 0n ? 1 : 0;
};
export const ceil = (value: Quantity) =>
  fraction((BigInt(value.n) + BigInt(value.d) - 1n) / BigInt(value.d));
export const whole = (value: Quantity) => value.d === "1";
export function round(value: Quantity): number {
  const n = BigInt(value.n),
    d = BigInt(value.d),
    sign = n < 0n ? -1n : 1n;
  const result = sign * ((2n * sign * n + d) / (2n * d));
  if (result < -1000000000000n || result > 1000000000000n)
    throw new Error("El importe supera el límite de Bs 10.000.000.000.");
  return Number(result);
}
export const amount = (priceMinor: number, qty: Quantity) =>
  round(mul(fraction(BigInt(priceMinor)), qty));
export function withdrawCost(
  valueMinor: number,
  balance: Quantity,
  removed: Quantity,
): number {
  if (compare(removed, balance) > 0 || compare(removed, ZERO) <= 0)
    throw new Error("Existencias insuficientes.");
  return compare(removed, balance) === 0
    ? valueMinor
    : amount(valueMinor, div(removed, balance));
}
export function showQuantity(value: Quantity, digits = 6): string {
  const scale = 10n ** BigInt(digits),
    n = BigInt(value.n),
    d = BigInt(value.d),
    sign = n < 0n ? "-" : "";
  const scaled = (2n * (n < 0n ? -n : n) * scale + d) / (2n * d);
  const tail = String(scaled % scale)
    .padStart(digits, "0")
    .replace(/0+$/, "");
  return `${sign}${scaled / scale}${tail ? "," + tail : ""}`;
}
