import { showQuantity } from "./exact.js";
import type { Quantity } from "./exact.js";
/** Display only. Inputs, conversions, signatures and calculations retain exact values. */
export const displayQuantity = (value: Quantity) => showQuantity(value, 2);
