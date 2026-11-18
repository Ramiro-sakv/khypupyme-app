import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { components } from "../api/schema";
import { change, get } from "../api/client";
import { BusinessWizard } from "./BusinessWizard";

type Card = components["schemas"]["BusinessCard"];
type Profile = components["schemas"]["BusinessProfile"];
type Industry = components["schemas"]["IndustryOption"];
type Page = components["schemas"]["BusinessPage"];
type Last = components["schemas"]["SelectedBusiness"];
const base = "/api/v1/businesses";

export function BusinessesPage() {
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [business, setBusiness] = useState<Profile | null>(null);
  const [wizard, setWizard] = useState(false);
  const [opening, setOpening] = useState(true);
  const [error, setError] = useState("");
  const [initialRequest, setInitialRequest] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([get<Industry[]>(base + "/industries", controller.signal), get<Last>(base + "/last", controller.signal)])
      .then(async ([options, last]) => {
        const profile = last.business ? await get<Profile>(base + "/" + last.business.id, controller.signal) : null;
        if (!controller.signal.aborted) {
          setIndustries(options);
          setBusiness(profile);
          setOpening(false);
        }
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) {
          setError(failure instanceof Error ? failure.message : "No se pudieron consultar tus negocios.");
          setOpening(false);
        }
      });
    return () => controller.abort();
  }, [initialRequest]);

  async function select(id: string) {
    await change(base + "/" + id + "/selection", "PUT");
    setBusiness(await get<Profile>(base + "/" + id));
  }

  if (opening) return <p role="status">Consultando tus negocios…</p>;
  if (error) return <section className="account-card">
    <p className="form-error" role="alert">{error}</p>
    <button onClick={() => { setError(""); setOpening(true); setInitialRequest((value) => value + 1); }}>Reintentar</button>
  </section>;
  if (wizard) return <BusinessWizard industries={industries} onCancel={() => setWizard(false)}
    onCreated={(created) => { setBusiness(created); setWizard(false); }} />;
  if (business) return <BusinessDetails key={business.id} profile={business}
    industry={industries.find((option) => option.id === business.industry)?.name ?? business.industry}
    back={() => setBusiness(null)} />;
  return <BusinessPicker industries={industries} select={select} create={() => setWizard(true)} />;
}

function BusinessPicker({ industries, select, create }: {
  industries: Industry[]; select: (id: string) => Promise<void>; create: () => void;
}) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    const options = new URLSearchParams({ page: String(page), search });
    void get<Page>(base + "?" + options, abort.signal)
      .then((result) => { if (!abort.signal.aborted) setData(result); })
      .catch((failure: unknown) => {
        if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "No se pudo cargar la lista.");
      });
    return () => abort.abort();
  }, [page, search, refresh]);

  function find(event: FormEvent) {
    event.preventDefault();
    setSearch(query.trim());
    setPage(1);
    setData(null);
    setError("");
    setRefresh((value) => value + 1);
  }

  async function open(item: Card) {
    setBusy(true);
    setError("");
    try { await select(item.id); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "No se pudo abrir ese negocio."); }
    finally { setBusy(false); }
  }

  return (
    <section className="account-card">
      <div className="page-heading"><h1>Mis negocios</h1><button type="button" disabled={busy} onClick={create}>Crear negocio</button></div>
      <form className="inline-actions search-form" onSubmit={find}>
        <label>Buscar negocio<input type="search" maxLength={80} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <button className="secondary" type="submit" disabled={busy}>Buscar</button>
      </form>
      {error && <p role="alert" className="form-error">{error}</p>}
      {!data && !error && <p role="status">Cargando negocios…</p>}
      {data?.items.length === 0 && <p>{search ? "No hay coincidencias." : "Tus negocios aparecerán aquí."}</p>}
      <ul className="business-list">
        {data?.items.map((item) => <li key={item.id}>
          <button className="business-option" type="button" disabled={busy} onClick={() => void open(item)}>
            <strong>{item.name}</strong>
            <span>{industries.find((option) => option.id === item.industry)?.name ?? item.industry}</span>
          </button>
        </li>)}
      </ul>
      {(page > 1 || data?.hasMore) && <div className="inline-actions">
        <button type="button" className="secondary" disabled={page === 1 || busy} onClick={() => {
          setData(null); setError(""); setPage(page - 1);
        }}>Anterior</button>
        <span>Página {page}</span>
        <button type="button" className="secondary" disabled={!data?.hasMore || busy} onClick={() => {
          setData(null); setError(""); setPage(page + 1);
        }}>Siguiente</button>
      </div>}
    </section>
  );
}

function BusinessDetails({ profile, industry, back }: { profile: Profile; industry: string; back: () => void }) {
  const [city, setCity] = useState(profile.city ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [units, setUnits] = useState(profile.timberUnits ?? "imperial");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await change(base + "/" + profile.id + "/settings", "PUT", {
        businessId: profile.id, city, phone, timberUnits: profile.industry === "timber" ? units : null,
      });
      setMessage("Configuración guardada.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo guardar la configuración.");
    } finally { setBusy(false); }
  }

  return <section className="account-card">
    <div className="page-heading">
      <div><p>Negocio activo</p><h1>{profile.name}</h1><p>{industry}</p></div>
      <button type="button" className="secondary" disabled={busy} onClick={back}>Mis negocios</button>
    </div>
    <details>
      <summary>Configuración del negocio</summary>
      <form className="account-form" onSubmit={(event) => void save(event)}>
        <label>Ciudad<input value={city} maxLength={80} onChange={(event) => setCity(event.target.value)} /></label>
        <label>Teléfono<input type="tel" value={phone} maxLength={32} onChange={(event) => setPhone(event.target.value)} /></label>
        {profile.industry === "timber" && <label>Medidas de madera
          <select value={units} onChange={(event) => setUnits(event.target.value)}>
            <option value="imperial">Pulgadas y pies</option><option value="metric">Métrica</option>
          </select>
        </label>}
        {error && <p role="alert" className="form-error">{error}</p>}
        {message && <p role="status">{message}</p>}
        <button type="submit" disabled={busy}>Guardar configuración</button>
      </form>
    </details>
  </section>;
}
