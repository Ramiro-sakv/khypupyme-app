import { useEffect, useState } from "react";
import type { paths } from "./api/schema";

type HealthPath = "/api/v1/health/api" | "/api/v1/health/database";
type HealthResponse = paths[HealthPath]["get"]["responses"][200]["content"]["application/json"];
type Check = "loading" | "available" | "unavailable" | "not-configured" | "schema-not-ready";

const services: ReadonlyArray<{ path: HealthPath; name: string; description: string }> = [
  { path: "/api/v1/health/api", name: "Servidor", description: "Conexión con la API de KhypuPyme." },
  { path: "/api/v1/health/database", name: "PostgreSQL", description: "Conexión y esquema de la base de datos." },
];

const labels: Record<Check, string> = {
  loading: "Comprobando",
  available: "Disponible",
  unavailable: "Sin conexión",
  "not-configured": "Falta configurar",
  "schema-not-ready": "Esquema pendiente",
};

async function check(path: HealthPath, signal: AbortSignal): Promise<Check> {
  try {
    const response = await fetch(apiUrl(path), { signal, cache: "no-store" });
    if (!response.ok && response.status !== 503) return "unavailable";

    const payload: HealthResponse = await response.json();
    if (response.ok && payload.status === "available") return "available";
    if (response.status === 503 && payload.status === "not-configured") return "not-configured";
    if (response.status === 503 && payload.status === "schema-not-ready") return "schema-not-ready";
    return "unavailable";
  } catch {
    return "unavailable";
  }
}

export function StatusPage() {
  const [checks, setChecks] = useState<Partial<Record<HealthPath, Check>>>({});
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]);

    for (const { path } of services) {
      void check(path, signal).then((result) => {
        if (!controller.signal.aborted) setChecks((current) => ({ ...current, [path]: result }));
      });
    }

    return () => controller.abort();
  }, [revision]);

  return (
    <main className="status-page">
      <header className="brand">
        <span aria-hidden="true" className="brand-mark">K</span>
        <span>KhypuPyme 2.0</span>
      </header>
      <section className="status-card" aria-labelledby="status-heading">
        <div className="status-heading">
          <div>
            <h1 id="status-heading">Estado local</h1>
            <p>Comprueba que el servidor y la base estén disponibles.</p>
          </div>
          <button type="button" onClick={() => {
            setChecks({});
            setRevision((current) => current + 1);
          }}>
            Actualizar
          </button>
        </div>

        <ul aria-live="polite" className="services">
          {services.map(({ path, name, description }) => {
            const state = checks[path] ?? "loading";
            return (
              <li key={path}>
                <div>
                  <h2>{name}</h2>
                  <p>{description}</p>
                </div>
                <span className="service-state" data-state={state}>{labels[state]}</span>
              </li>
            );
          })}
        </ul>
        {checks["/api/v1/health/database"] === "not-configured" && (
          <p className="help">Inicia la API con el script de arranque local para cargar su conexión.</p>
        )}
        {checks["/api/v1/health/database"] === "schema-not-ready" && (
          <p className="help">Aplica las migraciones a la base local y vuelve a comprobar.</p>
        )}
      </section>
    </main>
  );
}
import { apiUrl } from "./native/platform";
