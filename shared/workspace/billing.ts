export const PASS_PRICE_MINOR = 3900;
export const TRIAL_DAYS = 14;
export const SIMULATION_TRIAL_DAYS = 30;
export const PASS_DAYS = 30;
export const DAY_MS = 86_400_000;
export const PLAY_PASS = "khypupyme_30_dias";

export const SIMULATION_PASS_IDS = ["30-days", "6-months", "1-year"] as const;
export type PassId = (typeof SIMULATION_PASS_IDS)[number];
export type PassDuration = { days: number } | { months: number };
export interface PassOffer {
  id: PassId;
  label: string;
  priceMinor: number;
  savingsMinor: number;
  duration: PassDuration;
  estimatedExpiry: number;
}

export const PLAY_PRODUCTS: Readonly<Record<PassId, string>> = {
  "30-days": PLAY_PASS, "6-months": "khypupyme_6_meses", "1-year": "khypupyme_1_ano",
};

const PASS_CATALOG: Readonly<Record<PassId, Omit<PassOffer, "id" | "estimatedExpiry">>> = {
  "30-days": { label: "30 días", priceMinor: PASS_PRICE_MINOR, savingsMinor: 0, duration: { days: PASS_DAYS } },
  "6-months": { label: "6 meses", priceMinor: 21_000, savingsMinor: 2_400, duration: { months: 6 } },
  "1-year": { label: "1 año", priceMinor: 39_000, savingsMinor: 7_800, duration: { months: 12 } },
};

export function passOffers(startsAt: number): PassOffer[] {
  return SIMULATION_PASS_IDS.map((id) => {
    const offer = PASS_CATALOG[id];
    return { ...offer, id, estimatedExpiry: periodEnd(startsAt, offer.duration) };
  });
}

export function passDetails(id: PassId) { return PASS_CATALOG[id]; }

export type PaymentChannel = "play" | "qr";
export type PaymentStatus = "pending" | "paid" | "expired" | "refunded";
export type PlanStatus = "unavailable" | "trial-available" | "trial" | "active" | "expired";
export interface BusinessPlan {
  status: PlanStatus;
  expiresAt: number | null;
  serverTime: number;
  emailVerified: boolean;
  priceMinor: number;
  channels: PaymentChannel[];
  offers?: PassOffer[];
}
export interface PaymentIntent {
  id: string;
  businessId: string;
  channel: PaymentChannel;
  status: PaymentStatus;
  expiresAt: number;
  priceMinor: number;
  qrImage?: string;
  passId?: PassId;
  duration?: PassDuration;
}
export type BillingRequest =
  | { kind: "plan" | "activate" | "simulate-trial-expiry"; businessId: string }
  | { kind: "start"; businessId: string; channel: PaymentChannel; passId?: PassId }
  | { kind: "current-qr"; businessId: string }
  | { kind: "check"; businessId: string; intentId: string }
  | { kind: "restore-play"; purchaseToken: string }
  | { kind: "simulate-qr"; businessId: string; intentId: string; outcome: "paid" | "expired" | "refunded" };

export interface AccessPeriod {
  id: string;
  startsAt: number;
  endsAt: number;
}

export function periodEnd(startsAt: number, duration: PassDuration): number {
  if ("days" in duration) return startsAt + duration.days * DAY_MS;
  // Bolivia uses UTC−04:00. Shift the timestamp before applying calendar arithmetic.
  const boliviaOffset = 4 * 60 * 60_000;
  const local = new Date(startsAt - boliviaOffset);
  const day = local.getUTCDate();
  local.setUTCDate(1);
  local.setUTCMonth(local.getUTCMonth() + duration.months);
  const lastDay = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0)).getUTCDate();
  local.setUTCDate(Math.min(day, lastDay));
  return local.getTime() + boliviaOffset;
}

export function creditPeriod(periods: AccessPeriod[], id: string, at: number, duration: number | PassDuration): AccessPeriod[] {
  const current = periods.filter((period) => period.endsAt > at);
  const startsAt = Math.max(at, current.at(-1)?.endsAt ?? at);
  return [...current, { id, startsAt, endsAt: periodEnd(startsAt, typeof duration === "number" ? { days: duration } : duration) }];
}

export function reversePeriod(periods: AccessPeriod[], id: string, at: number): AccessPeriod[] {
  let removed = false;
  let nextStart = at;
  const remaining: AccessPeriod[] = [];
  for (const period of periods) {
    if (period.endsAt <= at) continue;
    if (period.id === id) {
      removed = true;
      continue;
    }
    if (!removed) remaining.push(period);
    else {
      const startsAt = Math.max(nextStart, remaining.at(-1)?.endsAt ?? at);
      const endsAt = startsAt + period.endsAt - Math.max(period.startsAt, at);
      remaining.push({ ...period, startsAt, endsAt });
      nextStart = endsAt;
    }
  }
  return remaining;
}
