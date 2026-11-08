import { useEffect } from "react";
import type { RefObject } from "react";

export interface GuidePosition { sessionId: string; left: number; top: number }

/** Solo guarda posición de interfaz durante esta práctica; nunca comandos o datos comerciales. */
export function useMovableGuide(
  ref: RefObject<HTMLElement | null>,
  saved: RefObject<GuidePosition | null> | undefined,
  sessionId: string | undefined,
  enabled: boolean,
) {
  useEffect(() => {
    const guide = ref.current;
    const handle = guide?.querySelector<HTMLButtonElement>("[data-guide-handle]");
    const reset = guide?.querySelector<HTMLButtonElement>("[data-guide-reset]");
    if (!enabled || !guide || !handle || !saved || !sessionId) return;
    let drag: { id: number; x: number; y: number; left: number; top: number } | null = null;
    const bounds = () => {
      const dialog = guide.closest("dialog")?.getBoundingClientRect();
      return {
        left: Math.max(0, dialog?.left ?? 0) + 8,
        top: Math.max(0, dialog?.top ?? 0) + 8,
        right: Math.min(innerWidth, dialog?.right ?? innerWidth) - 8,
        bottom: Math.min(innerHeight, dialog?.bottom ?? innerHeight) - 8,
      };
    };
    const place = (left?: number, top?: number, remember = false) => {
      const b = bounds();
      guide.style.width = Math.min(420, Math.max(0, b.right - b.left)) + "px";
      guide.style.maxHeight = Math.max(0, Math.min(innerHeight * 0.65, b.bottom - b.top)) + "px";
      const r = guide.getBoundingClientRect();
      const x = Math.max(b.left, Math.min(left ?? b.right - r.width, b.right - r.width));
      const y = Math.max(b.top, Math.min(top ?? b.top, b.bottom - r.height));
      Object.assign(guide.style, { left: x + "px", top: y + "px", right: "auto", bottom: "auto" });
      if (remember) saved.current = { sessionId, left: x, top: y };
    };
    const reposition = () => {
      const p = saved.current?.sessionId === sessionId ? saved.current : null;
      place(p?.left, p?.top);
    };
    const down = (e: PointerEvent) => {
      if (!e.isPrimary || e.button !== 0) return;
      e.preventDefault();
      handle.focus({ preventScroll: true });
      const r = guide.getBoundingClientRect();
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, left: r.left, top: r.top };
      handle.setPointerCapture(e.pointerId);
      handle.classList.add("is-dragging");
    };
    const move = (e: PointerEvent) => {
      if (drag?.id !== e.pointerId) return;
      place(drag.left + e.clientX - drag.x, drag.top + e.clientY - drag.y, true);
    };
    const end = (e: PointerEvent) => {
      if (drag?.id !== e.pointerId) return;
      drag = null;
      handle.classList.remove("is-dragging");
      if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
    };
    const key = (e: KeyboardEvent) => {
      const delta: Record<string, [number, number]> = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] };
      const movement = delta[e.key];
      if (!movement) return;
      e.preventDefault();
      const r = guide.getBoundingClientRect(), [x, y] = movement;
      place(r.left + x, r.top + y, true);
    };
    const resetPosition = () => { saved.current = null; place(); };
    handle.addEventListener("pointerdown", down);
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
    handle.addEventListener("lostpointercapture", end);
    handle.addEventListener("keydown", key);
    reset?.addEventListener("click", resetPosition);
    const observer = new ResizeObserver(reposition);
    observer.observe(guide);
    const dialog = guide.closest("dialog");
    if (dialog) observer.observe(dialog);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    reposition();
    return () => {
      observer.disconnect();
      if (drag && handle.hasPointerCapture(drag.id)) handle.releasePointerCapture(drag.id);
      handle.classList.remove("is-dragging");
      handle.removeEventListener("pointerdown", down);
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      handle.removeEventListener("lostpointercapture", end);
      handle.removeEventListener("keydown", key);
      reset?.removeEventListener("click", resetPosition);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [ref, saved, sessionId, enabled]);
}
