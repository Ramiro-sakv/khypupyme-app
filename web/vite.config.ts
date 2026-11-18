import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const api = "http://127.0.0.1:5182";
const localServer = {
  host: "127.0.0.1",
  port: 5282,
  strictPort: true,
  proxy: { "/api": api, "/connect": api, "/signin-google": api },
};

export default defineConfig({
  plugins: [react()],
  server: localServer,
  preview: localServer,
});
