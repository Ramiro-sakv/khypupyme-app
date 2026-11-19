import { registerPlugin } from "@capacitor/core";
import { invoke } from "@tauri-apps/api/core";

const platform = import.meta.env.VITE_KHYPU_NATIVE;
export const isNative = platform === "android" || platform === "windows";
export const apiOrigin = isNative ? String(import.meta.env.VITE_KHYPU_API_ORIGIN) : "";
export const apiUrl = (path: string) => apiOrigin + path;
export const clientId = "khypupyme2-" + platform;
export const redirectUri = platform === "android" ? "bo.khypupyme.piloto:/oauth/callback" : "http://127.0.0.1:43823/callback";

export function base64(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

type Secret = "token" | "handshake";
const android = registerPlugin<{
  start(input: { url: string }): Promise<void>;
  callback(): Promise<{ value?: string }>;
  load(input: { name: Secret }): Promise<{ value?: string }>;
  save(input: { name: Secret; value: string }): Promise<void>;
  clear(input: { name: Secret }): Promise<void>;
  saveFile(input: { name: string; content: string }): Promise<void>;
}>("PilotBridge");

export const bridge = {
  start: (url: string) => platform === "android" ? android.start({ url }) : invoke<void>("native_start", { url }),
  callback: async () => platform === "android" ? (await android.callback()).value : invoke<string | null>("native_callback"),
  load: async (name: Secret) => platform === "android" ? (await android.load({ name })).value : invoke<string | null>("native_load", { name }),
  save: (name: Secret, value: string) => platform === "android" ? android.save({ name, value }) : invoke<void>("native_save", { name, value }),
  clear: (name: Secret) => platform === "android" ? android.clear({ name }) : invoke<void>("native_clear", { name }),
};

export async function downloadFile(blob: Blob, name: string) {
  if (!isNative) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const content = base64(new Uint8Array(await blob.arrayBuffer()));
  try {
    if (platform === "android") await android.saveFile({ name, content });
    else await invoke("native_save_file", { name, content });
  } catch { throw new Error("No se pudo guardar el archivo. Elige otra ubicación e inténtalo de nuevo."); }
}
