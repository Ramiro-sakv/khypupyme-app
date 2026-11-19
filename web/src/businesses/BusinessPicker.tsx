import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { get } from "../api/client";
import { Icon } from "../ui/Icon";
import { Alert, Button, Card, EmptyState, TextField } from "../ui/Primitives";
import { industryPhoto } from "./industryPhoto";
import { industryTheme } from "./industryThemes";
import { businessApi } from "./models";
import type { BusinessCard, BusinessList, BusinessProfile, IndustryOption } from "./models";
import { RemovalJobs } from "../security/BusinessRemoval";

export function BusinessPicker({ industries, last, select, create, accountId }: {
  industries: IndustryOption[];
  last?: BusinessProfile | null;
  select: (id: string) => Promise<void>;
  create: () => void;
  accountId: string;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<BusinessList | null>(null);
  const [error, setError] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const abort = new AbortController();
    const options = new URLSearchParams({ page: String(page), search });
    void get<BusinessList>(businessApi + "?" + options, abort.signal)
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

  function goToPage(next: number) {
    setData(null);
    setError("");
    setPage(next);
  }

  async function open(item: Pick<BusinessCard, "id">) {
    setOpeningId(item.id);
    setError("");
    try { await select(item.id); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "No se pudo abrir ese negocio."); }
    finally { setOpeningId(null); }
  }

  const previousTheme = last ? industryTheme(last.industry) : null;
  const previousPhoto = industryPhoto(last?.industry);

  return <div className="business-picker">
    <div className="page-heading picker-heading">
      <div><h1 ref={heading} tabIndex={-1}>Mis negocios</h1><p>Abre el negocio en el que vas a trabajar.</p></div>
      <Button icon="plus" disabled={openingId !== null} onClick={create}>Crear negocio</Button>
    </div>
    <RemovalJobs accountId={accountId} />
    {last && previousTheme && !search && page === 1 && <button type="button" className="picker-recent"
      style={previousTheme.style} onClick={() => void open(last)} disabled={openingId !== null}>
      <span className="workspace-business-icon"><Icon name={previousTheme.icon} /></span>
      <span><small>Último negocio utilizado</small><strong>{last.name}</strong>
        <span>{industries.find((option) => option.id === last.industry)?.name}</span></span>
      {previousPhoto && <img className="picker-recent-photo" src={previousPhoto} alt="" decoding="async" />}
      <Icon name="arrow" />
    </button>}
    <Card className="picker-panel">
      <form className="inline-actions search-form" onSubmit={find}>
        <TextField label="Buscar negocio" type="search" maxLength={80} placeholder="Nombre del negocio"
          value={query} onChange={(event) => setQuery(event.target.value)} />
        <Button variant="secondary" icon="search" type="submit" disabled={openingId !== null}>Buscar</Button>
      </form>
      {error && <Alert tone="error">{error}</Alert>}
      {!data && !error && <Alert>Cargando negocios…</Alert>}
      {data?.items.length === 0 && <EmptyState icon="shops" title={search ? "Sin coincidencias" : "Todavía no tienes negocios"}>
        {search ? "Prueba con otro nombre." : "Cuando crees un negocio aparecerá aquí."}
      </EmptyState>}
      {data && data.items.length > 0 && <ul className="business-picker-list">
        {data.items.filter((item) => search || page !== 1 || item.id !== last?.id).map((item) => {
          const theme = industryTheme(item.industry);
          return <li key={item.id} style={theme.style}>
            <button className="picker-business" type="button" disabled={openingId !== null}
              onClick={() => void open(item)}>
              <span className="picker-card-top"><span className="workspace-business-icon"><Icon name={theme.icon} /></span>
              </span>
              <strong>{item.name}</strong>
              <span className="picker-industry">{industries.find((option) => option.id === item.industry)?.name ?? item.industry}</span>
              <span className="picker-card-link">{openingId === item.id ? "Abriendo…" : "Abrir negocio"}<Icon name="arrow" /></span>
            </button>
          </li>;
        })}
      </ul>}
      {(page > 1 || data?.hasMore) && <nav className="inline-actions pagination" aria-label="Páginas de negocios">
        <Button variant="secondary" disabled={page === 1 || openingId !== null} onClick={() => goToPage(page - 1)}>Anterior</Button>
        <span aria-live="polite">Página {page}</span>
        <Button variant="secondary" disabled={!data?.hasMore || openingId !== null} onClick={() => goToPage(page + 1)}>Siguiente</Button>
      </nav>}
    </Card>
  </div>;
}
