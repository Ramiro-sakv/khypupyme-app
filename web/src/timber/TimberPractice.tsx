import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { change, get } from "../api/client";
import type { components } from "../api/schema";
import { businessApi } from "../businesses/models";
import type { BusinessProfile } from "../businesses/models";
import type { WorkspaceView } from "../businesses/BusinessWorkspace";
import { clearPracticeScope } from "../commerce/storage";
import { Alert, Button, Card } from "../ui/Primitives";

type Status = components["schemas"]["PracticeStatus"];
type Session = components["schemas"]["PracticeInfo"];
export type PracticeControls = { session: Session; refresh: () => void; act: (action: string) => Promise<void>; busy: boolean; error: string };
const steps: { title: string; instruction: string; view: WorkspaceView }[] = [
  { title: "Abre la caja de práctica", instruction: "En Caja, registra un fondo inicial. Puedes usar Bs 1.000 si harás la compra en efectivo.", view: "caja" },
  { title: "Crea un producto de madera", instruction: "En Catálogo, puedes usar Tabla seca, especie Pino, código MAD-01 y Bs 10 por pie tablar en cada tramo.", view: "catalogo" },
  { title: "Registra una compra", instruction: "Elige tu madera. Prueba con espesor 2″, largo 10′ y anchos 10x6. Indica un costo de Bs 5 por pie tablar y revisa el pago.", view: "compras" },
  { title: "Vende madera", instruction: "Puedes elegir una medida disponible y vender dos piezas. Con las medidas y tarifa sugeridas, el total será Bs 200.", view: "ventas" },
  { title: "Devuelve una pieza", instruction: "En el detalle de la venta, abre Registrar devolución. Elige las piezas y marca si regresan al inventario. Si cerraste el detalle, búscalo en Historial.", view: "historial" },
  { title: "Consulta los resultados", instruction: "En Informes, compara ventas, costo y compras. Confirma la lectura desde la guía cuando termines.", view: "informes" },
  { title: "Cierra la caja", instruction: "Revisa el efectivo esperado e indica cuánto contaste. Si hay una diferencia, indica el motivo.", view: "caja" },
];

export function TimberPractice({ business, accountId, home, onExit, render }: {
  business: BusinessProfile; accountId: string; home: boolean; onExit: () => void;
  render: (active: BusinessProfile, control?: PracticeControls, entry?: ReactNode) => ReactNode;
}) {
  const path = businessApi + "/" + business.id + "/practice";
  const key = "khypupyme2-practice:" + accountId + ":" + business.id;
  const [enter, setEnter] = useState(() => sessionStorage.getItem(key) === "inside");
  const [status, setStatus] = useState<Status>();
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const session = status?.session;

  useEffect(() => {
    if (busy) return;
    const abort = new AbortController();
    async function read() {
      try {
        const result = await get<Status>(path, abort.signal);
        if (abort.signal.aborted) return;
        setStatus(result);
        const previous = localStorage.getItem(key);
        if (previous && result.session?.sandboxId !== previous) {
          await clearPracticeScope(accountId + ":" + previous);
          localStorage.removeItem(key);
          if (result.session?.state === "completed" || result.session?.state === "abandoned")
            setNotice("Práctica eliminada.");
        }
      } catch (failure) {
        if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "No se pudo consultar la práctica.");
      }
    }
    void read();
    window.addEventListener("focus", read);
    return () => { abort.abort(); window.removeEventListener("focus", read); };
  }, [path, key, accountId, revision, busy]);

  async function act(action: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    let reconcile = false;
    try {
      const result = await change<Status>(path, "POST", { action, revision: session?.revision ?? null });
      setStatus(result);
      if ((action === "start" || action === "resume") && result.session?.sandboxId && result.session.state === "active") {
        localStorage.setItem(key, result.session.sandboxId);
        sessionStorage.setItem(key, "inside");
        setEnter(true);
      }
      if (action === "pause" || action === "finish" || action === "abandon") {
        sessionStorage.removeItem(key);
        setEnter(false);
        onExit();
      }
      if (!result.session?.sandboxId) {
        const sandbox = localStorage.getItem(key) ?? session?.sandboxId;
        if (sandbox) await clearPracticeScope(accountId + ":" + sandbox);
        localStorage.removeItem(key);
        setNotice("Práctica eliminada.");
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se confirmó la acción. Actualiza el estado antes de repetirla.");
      reconcile = true;
    } finally {
      setBusy(false);
      if (reconcile) setRevision((value) => value + 1);
    }
  }

  function open() {
    if (session?.sandboxId && session.state === "active") {
      localStorage.setItem(key, session.sandboxId);
      sessionStorage.setItem(key, "inside");
      setEnter(true);
    } else void act(session?.state === "paused" ? "resume" : "start");
  }

  if (enter && !status && !error) return <Alert>Consultando el avance de la práctica…</Alert>;
  if (enter && session?.state === "active" && session.sandboxId) {
    return render({ ...business, id: session.sandboxId, city: "", phone: "", timberUnits: session.timberUnits,
      name: business.name.slice(0, 88) + " · práctica" },
      { session, refresh: () => setRevision((value) => value + 1), act, busy, error });
  }

  return render(business, undefined, <>
    {notice && <Alert>{notice}</Alert>}
    {error && <Alert tone="error">{error} <Button variant="secondary" onClick={() => { setError(""); setRevision((value) => value + 1); }}>Actualizar práctica</Button></Alert>}
    {home && status && <Card className="practice-entry">
      <div><h2>Aprender usando la aplicación</h2>
        <p>{session?.sandboxId ? session.step + " de " + steps.length + " pasos confirmados" :
          session?.state === "completed" ? "Práctica completada" : "Practica con tu propia caja, inventario y venta ficticios."}</p></div>
      <Button variant="secondary" onClick={open} disabled={busy}>{session?.sandboxId ? "Reanudar práctica" : "Iniciar práctica"}</Button>
    </Card>}
  </>);
}

type Position = { x: number; y: number };
const margin = 8;

export function PracticeGuide({ controls, view, navigate }: {
  controls: PracticeControls; view: WorkspaceView; navigate: (view: WorkspaceView) => void;
}) {
  const { session, act, busy, error } = controls;
  const [position, setPosition] = useState<Position>();
  const [minimizedStep, setMinimizedStep] = useState<number>();
  const minimized = minimizedStep === session.step;
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const pointer = useRef<{ x: number; y: number }>(null);
  const step = steps[session.step];

  function clamp(value: Position): Position {
    const bounds = panel.current?.getBoundingClientRect();
    return {
      x: Math.max(margin, Math.min(value.x, innerWidth - (bounds?.width ?? 0) - margin)),
      y: Math.max(margin, Math.min(value.y, innerHeight - (bounds?.height ?? 0) - margin)),
    };
  }

  useEffect(() => {
    const resize = () => setPosition((value) => value ? clamp(value) : value);
    const observer = new ResizeObserver(resize);
    if (panel.current) observer.observe(panel.current);
    window.addEventListener("resize", resize);
    return () => { observer.disconnect(); window.removeEventListener("resize", resize); };
  }, []);

  return <aside ref={panel} className="practice-guide" data-minimized={minimized || undefined} aria-label="Guía de la práctica"
    style={position && { left: position.x, top: position.y, right: "auto", bottom: "auto" }}>
    <div className="practice-guide-header">
      <button type="button" className="practice-move" aria-label="Mover guía con las flechas del teclado"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          const bounds = panel.current?.getBoundingClientRect();
          if (!bounds) return;
          pointer.current = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (pointer.current) setPosition(clamp({ x: event.clientX - pointer.current.x, y: event.clientY - pointer.current.y }));
        }}
        onLostPointerCapture={() => { pointer.current = null; }}
        onKeyDown={(event) => {
          const delta: Record<string, Position> = {
            ArrowUp: { x: 0, y: -20 }, ArrowDown: { x: 0, y: 20 }, ArrowLeft: { x: -20, y: 0 }, ArrowRight: { x: 20, y: 0 },
          };
          if (!delta[event.key]) return;
          event.preventDefault();
          const bounds = panel.current?.getBoundingClientRect();
          if (bounds) setPosition(clamp({ x: bounds.left + delta[event.key].x, y: bounds.top + delta[event.key].y }));
        }}>Mover guía</button>
      <Button variant="secondary" aria-expanded={!minimized} onClick={() => setMinimizedStep(minimized ? undefined : session.step)}>
        {minimized ? "Mostrar guía" : "Minimizar"}
      </Button>
    </div>
    {!minimized && <div className="practice-guide-body">
      <p aria-live="polite">{session.step} de {steps.length} pasos confirmados</p>
      <h2>{step?.title ?? "Termina la práctica"}</h2>
      <p>{session.step === 2 && session.timberUnits === "metric" ?
        "Elige tu madera. Puedes probar con espesor 50,8 mm, largo 3048 mm y anchos 10x152.4. Indica Bs 5 por pie tablar y revisa el pago." :
        step?.instruction ?? "Elimina la caja, las existencias y los movimientos ficticios de este recorrido."}</p>
      {error && <Alert tone="error">{error} <Button variant="secondary" onClick={controls.refresh}>Actualizar</Button></Alert>}
      <div className="inline-actions">
        {step && view !== step.view && <Button disabled={busy} onClick={() => {
          setMinimizedStep(session.step);
          navigate(step.view);
        }}>Ir a {step.view}</Button>}
        {session.step === 5 && view === "informes" && <Button disabled={busy} onClick={() => void act("reports-seen")}>Ya revisé los informes</Button>}
        {!step && <Button disabled={busy} onClick={() => void act("finish")}>Finalizar y eliminar práctica</Button>}
        <Button variant="plain" onClick={() => setPosition(undefined)}>Restablecer posición</Button>
        <Button variant="secondary" disabled={busy} onClick={() => void act("pause")}>Pausar</Button>
        <Button variant="plain" disabled={busy} onClick={() => setConfirmAbandon(!confirmAbandon)}>Abandonar</Button>
      </div>
      {confirmAbandon && <div>
        <p>Se eliminarán las operaciones, los documentos y los borradores de esta práctica.</p>
        <Button disabled={busy} onClick={() => void act("abandon")}>Eliminar esta práctica</Button>
      </div>}
    </div>}
  </aside>;
}
