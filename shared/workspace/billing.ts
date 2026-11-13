export const PASS_PRICE_MINOR = 3900;
export const TRIAL_DAYS = 14;
export const PASS_DAYS = 30;
export const DAY_MS = 86_400_000;
export const PLAY_PASS = "khypupyme_30_dias";

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
}
export interface PaymentIntent {
  id: string;
  businessId: string;
  channel: PaymentChannel;
  status: PaymentStatus;
  expiresAt: number;
  priceMinor: number;
  qrImage?: string;
}
export type BillingRequest =
  | { kind: "plan" | "activate"; businessId: string }
  | { kind: "start"; businessId: string; channel: PaymentChannel }
  | { kind: "current-qr"; businessId: string }
  | { kind: "check"; businessId: string; intentId: string }
  | { kind: "restore-play"; purchaseToken: string }
  | { kind: "simulate-qr"; businessId: string; intentId: string; outcome: "paid" | "expired" | "refunded" };

export interface AccessPeriod {
  id: string;
  startsAt: number;
  endsAt: number;
}

export function creditPeriod(periods: AccessPeriod[], id: string, at: number, days: number): AccessPeriod[] {
  const current = periods.filter((period) => period.endsAt > at);
  const startsAt = Math.max(at, current.at(-1)?.endsAt ?? at);
  return [...current, { id, startsAt, endsAt: startsAt + days * DAY_MS }];
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
