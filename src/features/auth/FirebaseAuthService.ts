import { createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import type { AuthService, SessionUser } from './types';

export class FirebaseAuthService implements AuthService {
  constructor(private readonly auth: Auth) {}

  observe(next: (user: SessionUser | null) => void, error: (cause: unknown) => void): () => void {
    return onAuthStateChanged(this.auth, next, error);
  }

  async register(email: string, password: string): Promise<void> {
    await createUserWithEmailAndPassword(this.auth, email, password);
  }

  async login(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email, password);
  }

  logout(): Promise<void> {
    return signOut(this.auth);
  }

  async resetPassword(email: string): Promise<void> {
    try { await sendPasswordResetEmail(this.auth, email); }
    catch (cause) {
      if (typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 'auth/user-not-found') return;
      throw cause;
    }
  }
}
