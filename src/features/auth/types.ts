export interface SessionUser { uid: string; email: string | null; googleOnly?: boolean }
export interface RegistrationChallenge { id: string; expiresAt: number }
export interface GoogleTransfer { id: string; pairing: string; expiresAt: number; proof: string }
export interface AuthService {
  reauthenticate?: (password: string) => Promise<void>;
  verifyEmail?: () => Promise<boolean>;
  requestRegistrationCode?: ((email: string) => Promise<RegistrationChallenge>) | undefined;
  completeRegistration?: (email: string, id: string, code: string, password: string) => Promise<void>;
  googleLogin?: (() => Promise<void>) | undefined;
  beginGoogle?: (() => Promise<GoogleTransfer>) | undefined;
  pollGoogle?: (transfer: GoogleTransfer) => Promise<boolean>;
  confirmGoogle?: (id: string, pairing: string) => Promise<void>;
  cancelGoogle?: () => void;
  reauthenticateGoogle?: (showTransfer?: (transfer: GoogleTransfer) => void) => Promise<void>;
  observe: (next: (user: SessionUser | null) => void, error: (error: unknown) => void) => () => void;
  register: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}
