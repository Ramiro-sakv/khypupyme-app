import { registerPlugin } from "@capacitor/core";

interface PlayPurchase { token: string; intentId: string }
interface BillingPlugin {
  price(input?: { productId: string }): Promise<{ formatted: string }>;
  buy(input: { intentId: string; productId?: string }): Promise<{ status: "pending" | "cancelled" | "purchased"; token?: string }>;
  pending(): Promise<{ purchases: PlayPurchase[] }>;
}

export const playBilling = registerPlugin<BillingPlugin>("KhypuBilling");
