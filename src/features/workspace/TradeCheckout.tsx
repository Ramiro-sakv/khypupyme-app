import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import TutorialCoach from "./tutorial/TutorialCoach";

export default function TradeCheckout({ id, open, title, minimize, children }: {
  id: string;
  open: boolean;
  title: string;
  minimize: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const panel = dialog.current;
    if (!open || !panel) return;
    panel.showModal();
    document.body.classList.add("panel-open");
    heading.current?.focus({ preventScroll: true });
    return () => {
      if (panel.open) panel.close();
      if (!document.querySelector("dialog[open]")) document.body.classList.remove("panel-open");
    };
  }, [open]);

  return (
    <dialog id={id} ref={dialog} className="editor-panel trade-checkout-dialog" aria-labelledby={id + "-title"}
      data-tutorial="trade-summary" onCancel={(event) => { event.preventDefault(); minimize(); }}>
      <header className="panel-heading">
        <h3 id={id + "-title"} ref={heading} tabIndex={-1}>{title}</h3>
        <button type="button" onClick={minimize}>Minimizar</button>
      </header>
      <div className="panel-body trade-checkout-body">
        {open && <TutorialCoach inPanel />}
        {children}
      </div>
    </dialog>
  );
}
