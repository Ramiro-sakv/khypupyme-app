import { registerPlugin } from "@capacitor/core";

const portal = import.meta.env.VITE_KHYPU_AUTH_PORTAL_ORIGIN;
export const nativeGoogle = ["android", "windows"].includes(import.meta.env.VITE_RUNTIME_TARGET ?? "");
export const googleAvailable = import.meta.env.VITE_USE_EMULATORS === "false" && typeof portal === "string" && /^https:\/\/[a-zA-Z0-9.-]+$/.test(portal) &&
  (import.meta.env.VITE_SERVICE_PROFILE !== "render-pilot" || !nativeGoogle);

export async function openGooglePortal(id: string) {
  if (!googleAvailable) throw new Error("El acceso con Google requiere configurar el portal de KhypuPyme.");
  if (import.meta.env.VITE_RUNTIME_TARGET === "windows") {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_auth_portal", { id });
  } else {
    const plugin = registerPlugin<{ open(options: { id: string }): Promise<void> }>("KhypuAuth");
    await plugin.open({ id });
  }
}
