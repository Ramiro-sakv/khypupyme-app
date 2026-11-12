import type { Quantity } from "./exact.js";

export interface StockCheck {
  widthMm?: string;
  requested: Quantity;
  available: Quantity;
  missing: Quantity;
}

export interface CartStock {
  id: string;
  checks: StockCheck[];
  issue?: string;
}
