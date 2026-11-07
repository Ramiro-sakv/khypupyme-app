import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  connectAuthEmulator,
  initializeAuth,
} from "firebase/auth";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { readEnvironment } from "../config/environment";
import { FirebaseAuthService } from "../features/auth/FirebaseAuthService";
import { FirebaseWorkspaceRepository } from "./FirebaseWorkspaceRepository";
export function createWorkspaceServices() {
  const config = readEnvironment(import.meta.env);
  const hosted = import.meta.env.VITE_USE_EMULATORS === "false";
  const app = initializeApp({
    projectId: config.projectId,
    apiKey: hosted ? import.meta.env.VITE_FIREBASE_API_KEY : "demo-api-key",
    authDomain: hosted
      ? import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
      : `${config.projectId}.firebaseapp.com`,
    ...(hosted ? { appId: import.meta.env.VITE_FIREBASE_APP_ID } : {}),
  });
  const auth = initializeAuth(app, { persistence: browserLocalPersistence });
  auth.languageCode = "es";
  if (!hosted)
    connectAuthEmulator(auth, config.authHost, { disableWarnings: true });
  const functions = getFunctions(app, "us-central1");
  if (!hosted)
    connectFunctionsEmulator(
      functions,
      config.firestoreHost,
      config.functionsPort,
    );
  return {
    authService: new FirebaseAuthService(auth),
    repository: new FirebaseWorkspaceRepository(functions),
  };
}
