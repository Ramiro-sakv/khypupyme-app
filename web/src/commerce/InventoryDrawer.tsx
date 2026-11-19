
import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { Button } from "../ui/Primitives";

export function InventoryDrawer({ title, children, onDismiss }: { title: string; children: ReactNode; onDismiss: () => void }) {
  const id = useId();
  const panel = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = panel.current;
    const opener = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  return <dialog className="inventory-drawer" ref={panel} aria-labelledby={id}
    onCancel={(event) => { event.preventDefault(); onDismiss(); }}>
    <div className="inventory-drawer-header">
      <strong id={id}>{title}</strong>
      <Button icon="close" variant="secondary" onClick={onDismiss}>Cerrar panel</Button>
    </div>
    <div className="inventory-drawer-content">{children}</div>
  </dialog>;
}
