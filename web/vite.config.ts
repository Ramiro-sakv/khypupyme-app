import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const testing = mode === "test";
  const api = "http://127.0.0.1:" + (testing ? "5183" : "5182");
  const localServer = {
    host: "127.0.0.1",
    port: testing ? 5283 : 5282,
    strictPort: true,
    proxy: { "/api": api, "/connect": api, "/signin-google": api },
  };

  return { plugins: [react()], server: localServer, preview: localServer };
});
