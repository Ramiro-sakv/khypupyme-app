import { createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, EmailAuthProvider, reauthenticateWithCredential, sendEmailVerification } from 'firebase/auth';
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
  async reauthenticate(password: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user?.email) throw new Error('Vuelve a ingresar con tu cuenta antes de confirmar.');
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    await user.getIdToken(true);
    if (this.auth.currentUser?.uid !== user.uid) throw new Error('La cuenta cambió. No se confirmó la operación.');
  }

  async verifyEmail() {
    const user = this.auth.currentUser;
    if (!user) throw new Error("Vuelve a ingresar con tu cuenta.");
    await user.reload();
    if (user.emailVerified) return true;
    await sendEmailVerification(user);
    return false;
  }

  async resetPassword(email: string): Promise<void> {
    try { await sendPasswordResetEmail(this.auth, email); }
    catch (cause) {
      if (typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 'auth/user-not-found') return;
      throw cause;
    }
  }
}
