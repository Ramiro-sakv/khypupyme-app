import { createContext, useContext } from 'react';
import type { Business } from './domain';
export interface BusinessState {
  business: Business | null;
  status: 'loading' | 'ready' | 'error';
  error: string;
  refresh: () => void;
  update: (business: Business) => void;
}
export const BusinessContext = createContext<BusinessState | null>(null);
export function useBusiness() {
  const context = useContext(BusinessContext);
  if (!context) throw new Error('Falta el contexto del negocio.');
  return context;
}
