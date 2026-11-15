import { createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, EmailAuthProvider, reauthenticateWithCredential, sendEmailVerification, GoogleAuthProvider, browserPopupRedirectResolver, reauthenticateWithPopup, signInWithPopup, signInWithCustomToken } from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import type { Functions } from 'firebase/functions';
import type { AuthService, GoogleTransfer, RegistrationChallenge, SessionUser } from './types';
import { googleAvailable, nativeGoogle, openGooglePortal } from './googlePortal';

export class FirebaseAuthService implements AuthService {
  private googleAbort: AbortController | undefined;

  constructor(private readonly auth: Auth, private readonly functions?: Functions) {}

  private async call<T>(name: string, value: unknown) {
    if (!this.functions) throw new Error("El servicio de acceso todavía no está disponible.");
    return (await httpsCallable<unknown, T>(this.functions, name)(value)).data;
  }

  get requestRegistrationCode() {
    if (!this.functions || (import.meta.env.VITE_USE_EMULATORS !== "false" && import.meta.env.VITE_KHYPU_SIGNUP_CODE !== "true")) return;
    return (email: string) => this.call<RegistrationChallenge>("workspaceRegistration", { kind: "send", email });
  }

  async completeRegistration(email: string, id: string, code: string, password: string) {
    await this.call("workspaceRegistration", { kind: "complete", email, id, code, password });
    await this.login(email, password);
  }

  get googleLogin() {
    return googleAvailable && !nativeGoogle ? async () => { await signInWithPopup(this.auth, this.googleProvider(), browserPopupRedirectResolver); } : undefined;
  }

  get beginGoogle() {
    return googleAvailable && nativeGoogle ? async () => {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const proof = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
      return { ...await this.call<Omit<GoogleTransfer, "proof">>("workspaceGoogleTransfer", { kind: "begin", proof }), proof };
    } : undefined;
  }

  async pollGoogle(transfer: GoogleTransfer) {
    const response = await this.call<{ state: "pending" | "complete"; token?: string }>("workspaceGoogleTransfer", {
      kind: "redeem", id: transfer.id, proof: transfer.proof,
    });
    if (response.state !== "complete" || !response.token) return false;
    await signInWithCustomToken(this.auth, response.token);
    return true;
  }

  async confirmGoogle(id: string, pairing: string) {
    const credential = await signInWithPopup(this.auth, this.googleProvider(), browserPopupRedirectResolver);
    await credential.user.getIdToken(true);
    await this.call("workspaceGoogleTransfer", { kind: "confirm", id, pairing });
  }

  private googleProvider() {
    const google = new GoogleAuthProvider();
    google.setCustomParameters({ prompt: "select_account" });
    return google;
  }

  cancelGoogle() { this.googleAbort?.abort(); }

  async reauthenticateGoogle(showTransfer?: (transfer: GoogleTransfer) => void) {
    const user = this.auth.currentUser;
    if (!googleAvailable || !user) throw new Error("El acceso con Google todavía no está disponible.");
    if (!nativeGoogle) {
      await reauthenticateWithPopup(user, this.googleProvider(), browserPopupRedirectResolver);
      await user.getIdToken(true);
      return;
    }
    const transfer = await this.beginGoogle!();
    const controller = new AbortController();
    this.googleAbort?.abort();
    this.googleAbort = controller;
    try {
      showTransfer?.(transfer);
      await openGooglePortal(transfer.id);
      while (!controller.signal.aborted && Date.now() < transfer.expiresAt) {
        if (this.auth.currentUser?.uid !== user.uid) throw new Error("La cuenta cambió.");
        if (await this.pollGoogle(transfer)) {
          if (this.auth.currentUser?.uid !== user.uid) throw new Error("La cuenta cambió.");
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1800));
      }
      throw new Error("La confirmación con Google se canceló o venció.");
    } finally {
      if (this.googleAbort === controller) this.googleAbort = undefined;
    }
  }

  observe(next: (user: SessionUser | null) => void, error: (cause: unknown) => void): () => void {
    return onAuthStateChanged(this.auth, (user) => next(user ? {
      uid: user.uid, email: user.email,
      googleOnly: user.providerData.some((provider) => provider.providerId === "google.com") &&
        !user.providerData.some((provider) => provider.providerId === "password"),
    } : null), error);
  }

  async register(email: string, password: string): Promise<void> {
    if (this.requestRegistrationCode) throw new Error("Confirma primero el código de tu correo.");
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
    if (user.emailVerified) {
      await user.getIdToken(true);
      return true;
    }
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
