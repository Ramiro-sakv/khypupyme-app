import { useId, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { Button } from "./Primitives";

// Ubicado después del carrito en el espacio que reserva el flujo de la página.
export function ReviewDock({ total, cartFocus, children, description }: {
  total: ReactNode;
  cartFocus: RefObject<HTMLElement | null>;
  children: ReactNode;
  description?: string;
}) {
  const title = useId();
  const panel = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  function restoreFocus() {
    const target = cartFocus.current;
    if (target?.isConnected) target.focus();
    // Los títulos de carrito deben aceptar foco programático con tabIndex=-1.
    if (document.activeElement !== target) trigger.current?.focus({ preventScroll: true });
  }

  return <div className="review-slot" role="region" aria-label="Revisión de la operación">
    <div className="review-dock">
      <div><span className="review-total-label">Total</span><strong>{total}</strong>
        {description && <p>{description}</p>}</div>
      <button type="button" className="ui-button ui-button--primary" ref={trigger} aria-haspopup="dialog"
        onClick={() => panel.current?.showModal()}>Revisar</button>
    </div>
    <dialog className="review-dialog" ref={panel} aria-labelledby={title} onClose={restoreFocus}>
      <div className="review-heading">
        <div><h2 id={title}>Revisar operación</h2><p>{total}</p></div>
        <Button icon="close" variant="secondary" onClick={() => panel.current?.close()}>Minimizar</Button>
      </div>
      <div className="review-content" role="region" aria-label="Detalles para revisar" tabIndex={0}>{children}</div>
    </dialog>
  </div>;
}
