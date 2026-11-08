import TutorialCoach from "./tutorial/TutorialCoach";
import { useContext, useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { WorkspaceContext } from "./context";
import { Icon } from "./Icon";
import { confirmDiscardChanges } from "./navigation";
export function Panel({
  title,
  children,
  onClose,
  className = "",
  id: elementId,
  dataTutorial,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
  id?: string;
  dataTutorial?: string;
}) {
  const workspace = useContext(WorkspaceContext);
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const dialog = ref.current!,
      previous = document.activeElement;
    dialog.showModal();
    document.body.classList.add("panel-open");
    return () => {
      dialog.close();
      if (!document.querySelector("dialog[open]")) document.body.classList.remove("panel-open");
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);
  function close() {
    if (ref.current && confirmDiscardChanges(ref.current)) onClose();
  }
  return (
    <dialog
      data-tutorial={dataTutorial}
      ref={ref}
      id={elementId}
      className={"editor-panel " + className}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const rect = ref.current.getBoundingClientRect();
          if (
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom
          )
            close();
        }
      }}
    >
      <header className="panel-heading">
        <div>
          <span className="eyebrow">
            {workspace?.business.name ?? "TU NEGOCIO, EN ORDEN"}
          </span>
          <h2 id={id}>{title}</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Cerrar panel"
          onClick={close}
        >
          <Icon name="close" />
        </button>
      </header>
      <div className="panel-body">
        <TutorialCoach inPanel />
        {children}
      </div>
    </dialog>
  );
}
