import { useId, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { Button } from "./Primitives";
import { Icon } from "./Icon";

export function ReviewDock({ total, cartFocus, children, description, operation, visible = true }: {
  total: ReactNode;
  cartFocus: RefObject<HTMLElement | null>;
  children: ReactNode;
  description?: string;
  operation: string;
  visible?: boolean;
}) {
  const title = useId();
  const dialogId = useId();
  const actionsId = useId();
  const slot = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDialogElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [minimized, setMinimized] = useState(false);

  useLayoutEffect(() => {
    const anchor = slot.current;
    const bar = dock.current;
    if (!visible) {
      panel.current?.close();
      return;
    }
    if (!anchor || !bar) return;

    const root = document.documentElement;
    function fit() {
      if (!anchor || !bar) return;
      const bounds = anchor.getBoundingClientRect();
      anchor.style.setProperty("--review-left", bounds.left + "px");
      anchor.style.setProperty("--review-width", bounds.width + "px");
      root.style.setProperty("--review-space", bar.offsetHeight + "px");
    }

    // El espacio de la barra cambia el tamaño del ancla. Aplicar esos cambios fuera del observador.
    let frame = 0;
    function scheduleFit() {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        fit();
      });
    }

    fit();
    const observer = new ResizeObserver(scheduleFit);
    observer.observe(anchor);
    observer.observe(bar);
    window.addEventListener("resize", scheduleFit);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", scheduleFit);
      window.cancelAnimationFrame(frame);
      root.style.removeProperty("--review-space");
    };
  }, [visible, minimized]);

  function restoreFocus() {
    if (!visible) return;
    const target = cartFocus.current;
    if (target?.isConnected) target.focus({ preventScroll: true });
    else (trigger.current ?? toggle.current)?.focus({ preventScroll: true });
  }

  return <div className="review-slot" ref={slot} hidden={!visible} role="region" aria-label={"Revisión de " + operation}>
    <div className="review-rail">
      <div className="review-dock" ref={dock} data-minimized={minimized || undefined}>
        <div className="review-summary">
          <span className="review-total-label">Total</span><strong>{total}</strong>
        </div>
        <div className="review-actions">
          <button type="button" className="ui-button ui-button--plain review-toggle" ref={toggle} aria-controls={actionsId}
            aria-expanded={!minimized} aria-label={minimized ? "Mostrar" : "Minimizar barra"}
            title={minimized ? undefined : "Minimizar barra"} onClick={() => setMinimized((value) => !value)}>
            {minimized ? "Mostrar" : <Icon name="minus" />}
          </button>
          <div id={actionsId} hidden={minimized}>
            <button type="button" className="ui-button ui-button--primary" ref={trigger} aria-haspopup="dialog"
              aria-controls={dialogId} onClick={() => panel.current?.showModal()}>Revisar {operation}</button>
          </div>
        </div>
        {!minimized && description && <p className="review-description">{description}</p>}
      </div>
    </div>
    <dialog className="review-dialog" id={dialogId} ref={panel} aria-labelledby={title} onClose={restoreFocus}>
      <div className="review-heading">
        <div><h2 id={title}>Revisar {operation}</h2><p>{total}</p></div>
        <Button icon="close" variant="secondary" onClick={() => panel.current?.close()}>Minimizar</Button>
      </div>
      <div className="review-content" role="region" aria-label="Detalles para revisar" tabIndex={0}>{children}</div>
    </dialog>
  </div>;
}
