import type { PaymentChannel, PaymentStatus } from "../../../shared/workspace/billing.js";

export interface VerifiedPayment {
  reference: string;
  intentId: string;
  channel: PaymentChannel;
  status: PaymentStatus;
  confirmedAt?: number;
}
export interface QrCheckout {
  reference: string;
  image: string;
  expiresAt: number;
}

export interface PaymentProviders {
  channels: PaymentChannel[];
  qr?: {
    create(id: string, amountMinor: number, expiresAt: number): Promise<QrCheckout>;
    check(id: string, reference: string, amountMinor: number): Promise<VerifiedPayment | null>;
  };
  play?: {
    check(token: string): Promise<VerifiedPayment>;
    consume(token: string): Promise<void>;
  };
}
