import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AuthContext } from './auth-context';
import type { AuthState } from './auth-context';
import type { AuthService } from './types';
import { errorMessage } from '../../shared/errors';

export function AuthProvider({ service, children }: { service: AuthService; children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null, error: '' });
  useEffect(() => service.observe(
    (user) => setState({ status: 'ready', user, error: '' }),
    (error) => setState({ status: 'error', user: null, error: errorMessage(error) }),
  ), [service]);
  return <AuthContext.Provider value={{ ...state, service }}>{children}</AuthContext.Provider>;
}
