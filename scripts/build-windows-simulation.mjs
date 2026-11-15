import { spawnSync } from "node:child_process";

const appName = "KhypuPyme Simulacion";
const localServices = [19099, 18080, 15001].map((port) => "http://127.0.0.1:" + port).join(" ");
const config = {
  productName: appName,
  identifier: "com.khypupyme.simulation",
  build: {
    beforeBuildCommand: "node scripts/build-native-web.mjs windows --simulation",
    frontendDist: "../dist-windows-simulation",
  },
  app: {
    windows: [{ title: "KhypuPyme · Simulación", width: 1280, height: 850, minWidth: 360, minHeight: 620 }],
    security: {
      csp: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' ipc: http://ipc.localhost " + localServices +
        "; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'self'",
    },
  },
  bundle: { shortDescription: "KhypuPyme · Simulación sin cobros reales" },
};
const build = spawnSync(process.execPath, [
  "node_modules/@tauri-apps/cli/tauri.js", "build", "--bundles", "nsis", "--config", JSON.stringify(config),
], { stdio: "inherit", env: { ...process.env, VITE_KHYPU_CHECKOUT_ORIGIN: "" } });
if (build.error) throw build.error;
process.exitCode = build.status ?? 1;
