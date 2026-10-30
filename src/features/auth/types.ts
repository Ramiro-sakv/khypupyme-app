export interface SessionUser { uid: string; email: string | null }
export interface AuthService {
  observe: (next: (user: SessionUser | null) => void, error: (error: unknown) => void) => () => void;
  register: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}
