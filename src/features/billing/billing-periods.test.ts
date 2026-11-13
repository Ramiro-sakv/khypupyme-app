import { describe, expect, it } from "vitest";
import { creditPeriod, DAY_MS, passOffers, periodEnd, reversePeriod } from "../../../shared/workspace/billing";

describe("vigencia de pases", () => {
  it("calcula importes y vencimientos del catálogo", () => {
    const start = Date.parse("2025-08-31T23:30:00-04:00");
    expect(passOffers(start).map(({ priceMinor, savingsMinor, estimatedExpiry }) =>
      [priceMinor, savingsMinor, new Date(estimatedExpiry).toISOString()])).toEqual([
      [3900, 0, "2025-10-01T03:30:00.000Z"],
      [21000, 2400, "2026-03-01T03:30:00.000Z"],
      [39000, 7800, "2026-09-01T03:30:00.000Z"],
    ]);
  });

  it("ajusta el día en febrero y conserva la hora de Bolivia", () => {
    expect(periodEnd(Date.parse("2023-08-31T09:15:00-04:00"), { months: 6 }))
      .toBe(Date.parse("2024-02-29T09:15:00-04:00"));
    expect(periodEnd(Date.parse("2024-02-29T23:00:00-04:00"), { months: 12 }))
      .toBe(Date.parse("2025-02-28T23:00:00-04:00"));
  });

  it("añade la vigencia a la fecha anterior y al revertir conserva los días de los demás pagos", () => {
    const start = Date.parse("2025-08-01T09:00:00-04:00");
    const trial = creditPeriod([], "trial", start, 30);
    const withPasses = creditPeriod(creditPeriod(trial, "six", start, { months: 6 }), "next", start, 30);
    expect(withPasses[1]?.startsAt).toBe(start + 30 * DAY_MS);
    expect(reversePeriod(withPasses, "six", start)).toEqual(creditPeriod(trial, "next", start, 30));
  });
});
