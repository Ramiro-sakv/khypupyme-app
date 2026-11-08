import { createContext, useContext } from "react";
import type { CashSession } from "../../../shared/workspace/model";
interface CashState {
  loading: boolean;
  error: string;
  open: CashSession | undefined;
  refresh: () => void;
}
export const CashContext = createContext<CashState | null>(null);
export function useCashState() {
  const state = useContext(CashContext);
  if (!state) throw new Error("Falta el contexto de caja del negocio.");
  return state;
}
