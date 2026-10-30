import { createContext, useContext } from 'react';
import type { AuthService, SessionUser } from './types';

export type AuthState = { status: 'loading' | 'ready' | 'error'; user: SessionUser | null; error: string };
export const AuthContext = createContext<(AuthState & { service: AuthService }) | null>(null);
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('Falta AuthProvider.');
  return context;
}
