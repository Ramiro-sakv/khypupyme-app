import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import {
  tutorialSteps,
  TUTORIAL_MODULES,
} from "../../../../shared/workspace/timber-tutorial";
import { useWorkspace } from "../context";
import { useTimberTutorial } from "./context";
interface Box {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}
export default function TutorialCoach({
  inPanel = false,
}: {
  inPanel?: boolean;
}) {
  const tutorial = useTimberTutorial(),
    workspace = useWorkspace(),
    [params, setParams] = useSearchParams();
  const ref = useRef<HTMLElement>(null),
    target = useRef<HTMLElement | null>(null);
  const [box, setBox] = useState<Box | null>(null),
    [visible, setVisible] = useState(false);
  const [compactState, setCompactState] = useState({ key: "", value: false });
  const session = tutorial?.state.session,
    steps = tutorialSteps(session?.version ?? 2),
    step = session ? steps[session.stepIndex] : undefined;
  const lastNavigation = useRef(""),
    navigation = useRef(setParams);
  useEffect(() => {
    navigation.current = setParams;
  }, [setParams]);
  const stepKey = (session?.id ?? "") + ":" + (session?.stepIndex ?? 0),
    view = params.get("vista") ?? "inicio";
  useEffect(() => {
    if (!tutorial?.active) return;
    const inert = new Map<Element, boolean>();
    let previous: HTMLElement | null = null;
    function restore() {
      for (const [node, had] of inert) if (!had) node.removeAttribute("inert");
      inert.clear();
    }
    const update = () => {
      const dialogs =
          document.querySelectorAll<HTMLDialogElement>("dialog[open]"),
        panel = dialogs.item(dialogs.length - 1),
        mine = ref.current?.closest("dialog");
      const show = inPanel ? !!panel && mine === panel : !panel;
      setVisible(show);
      restore();
      if (!show) {
        previous?.classList.remove("tutorial-target");
        target.current = null;
        setBox(null);
        return;
      }
      const root = (
        inPanel ? mine : document.querySelector(".business-workspace")
      ) as HTMLElement | null;
      let node: HTMLElement | null = null;
      if (inPanel) node = root;
      else if (root && step) {
        node = root.querySelector<HTMLElement>(
          '[data-tutorial="' + step.target + '"]',
        );
        if (
          [
            "sales-history",
            "purchase-history",
            "work-orders",
            "deliveries",
            "debts",
            "reports",
          ].includes(step.target)
        )
          node = root.querySelector<HTMLElement>(
            '[data-tutorial-page="' + view + '"]',
          );
        if (step.target === "quote-history")
          node = node?.closest<HTMLElement>("details") ?? node;
        if (node?.matches("form.trade-form"))
          node = node.closest<HTMLElement>(".trade-layout") ?? node;
        node ??= root.querySelector<HTMLElement>(
          '[data-tutorial-page="' + view + '"]',
        );
      }
      if (!inPanel && workspace.pending)
        node = root?.querySelector<HTMLElement>(".pending-request") ?? node;
      node ??= root;
      if (previous !== node) {
        previous?.classList.remove("tutorial-target");
        node?.classList.add("tutorial-target");
        previous = node;
      }
      target.current = node;
      if (!node) {
        setBox(null);
        return;
      }
      const r = node.getBoundingClientRect(),
        next = {
          top: Math.max(0, r.top - 5),
          left: Math.max(0, r.left - 5),
          right: Math.min(innerWidth, r.right + 5),
          bottom: Math.min(innerHeight, r.bottom + 5),
          width: innerWidth,
          height: innerHeight,
        };
      setBox((old) =>
        old &&
        Object.keys(next).every(
          (k) => old[k as keyof Box] === next[k as keyof Box],
        )
          ? old
          : next,
      );
      const allow = ref.current;
      function block(parent: Element) {
        for (const child of parent.children) {
          if (child === node || child === allow) continue;
          if (child.contains(node) || (!!allow && child.contains(allow))) {
            block(child);
            continue;
          }
          inert.set(child, child.hasAttribute("inert"));
          child.setAttribute("inert", "");
        }
      }
      block(document.body);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["open"],
    });
    const focus = (e: FocusEvent) => {
      if (!target.current) return;
      const el = e.target as Node;
      if (target.current?.contains(el) || ref.current?.contains(el)) return;
      ref.current?.querySelector<HTMLElement>("button,select")?.focus();
    };
    document.addEventListener("focusin", focus);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      observer.disconnect();
      restore();
      previous?.classList.remove("tutorial-target");
      document.removeEventListener("focusin", focus);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      target.current = null;
    };
  }, [tutorial?.active, inPanel, stepKey, step, view, workspace.pending]);
  useEffect(() => {
    if (
      !inPanel &&
      tutorial?.active &&
      !tutorial.loading &&
      !tutorial.pendingControl &&
      !workspace.busy &&
      step &&
      lastNavigation.current !== stepKey
    ) {
      lastNavigation.current = stepKey;
      navigation.current({ vista: step.view });
    }
  }, [
    inPanel,
    stepKey,
    tutorial?.active,
    tutorial?.loading,
    tutorial?.pendingControl,
    workspace.busy,
    step,
  ]);
  if (!tutorial?.active) return null;
  const compact =
    compactState.key === stepKey &&
    compactState.value &&
    !tutorial.pendingControl &&
    !workspace.pending &&
    !tutorial.error &&
    !workspace.commandError;
  const disabled =
    tutorial.loading || workspace.busy || tutorial.pendingControl;
  const go = (next: string) => setParams({ vista: next });
  return (
    <>
      <div
        className={!visible ? "tutorial-coach-hidden" : "tutorial-mask"}
        aria-hidden="true"
      >
        {box && (
          <>
            <div style={{ top: 0, left: 0, width: "100%", height: box.top }} />
            <div
              style={{
                top: box.top,
                left: 0,
                width: box.left,
                height: Math.max(0, box.bottom - box.top),
              }}
            />
            <div
              style={{
                top: box.top,
                left: box.right,
                right: 0,
                height: Math.max(0, box.bottom - box.top),
              }}
            />
            <div
              style={{ top: box.bottom, left: 0, width: "100%", bottom: 0 }}
            />
          </>
        )}
      </div>
      <aside
        ref={ref}
        className={
          "tutorial-coach tutorial-spotlight" +
          (compact ? " tutorial-is-compact" : "") +
          (!visible ? " tutorial-coach-hidden" : "")
        }
        aria-label="Guía de práctica"
      >
        <div className="section-heading">
          <strong>{step?.chapter ?? "Recorrido completo"}</strong>
          <span>
            {session?.version === 1
              ? "Guía anterior"
              : (session?.doneSteps?.length ?? 0) + " pasos realizados"}
          </span>
          {compact && (
            <>
              <button
                type="button"
                onClick={() => setCompactState({ key: stepKey, value: false })}
              >
                Mostrar guía
              </button>
              <button disabled={disabled} onClick={() => void tutorial.pause()}>
                Pausar
              </button>
            </>
          )}
        </div>
        <h3>{step?.title ?? "Puedes elegir otro recorrido o terminar"}</h3>
        <p role="status">
          {step?.text ??
            "Terminar elimina exclusivamente los datos de esta práctica."}
        </p>
        {session?.version !== 1 && (
          <label>
            Elegir recorrido
            <select
              disabled={disabled}
              value={step?.module ?? ""}
              onChange={(e) => void tutorial.chooseModule(e.target.value)}
            >
              <option value="" disabled>
                Elige un recorrido
              </option>
              {TUTORIAL_MODULES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </label>
        )}
        {tutorial.error && <p role="alert">{tutorial.error}</p>}
        {workspace.commandError && <p role="alert">{workspace.commandError}</p>}
        {workspace.pending && (
          <div className="notice notice-warning">
            <p>
              Conserva la operación original. Consulta su confirmación antes de
              continuar.
            </p>
            <button
              disabled={workspace.processing || tutorial.loading}
              onClick={() => void workspace.consultPending?.().catch(() => {})}
            >
              Consultar confirmación de la operación
            </button>
            {workspace.canRetryPending && (
              <button
                disabled={workspace.processing || tutorial.loading}
                onClick={() => void workspace.retryPending?.().catch(() => {})}
              >
                Reintentar operación original
              </button>
            )}
          </div>
        )}
        {workspace.busy && (
          <small>
            Espera la confirmación o resuelve la solicitud pendiente de la
            operación.
          </small>
        )}
        <div className="actions">
          {tutorial.pendingControl ? (
            <>
              <button
                disabled={tutorial.loading}
                onClick={() => void tutorial.consult()}
              >
                Consultar estado
              </button>
              <button
                disabled={tutorial.loading}
                onClick={() => void tutorial.retry()}
              >
                Reintentar solicitud original
              </button>
            </>
          ) : (
            <>
              {step &&
                (!step.kind ||
                  (session?.version !== 1 && step.id === "cash-open")) &&
                !step.pdf && (
                  <button
                    className="primary"
                    disabled={disabled}
                    onClick={() => void tutorial.advance()}
                  >
                    {step.id === "cash-open"
                      ? "Ya tengo caja abierta · continuar"
                      : "Entendido · continuar"}
                  </button>
                )}
              {(step?.kind || step?.pdf) && (
                <button
                  type="button"
                  onClick={() => {
                    setCompactState({ key: stepKey, value: true });
                    const node = target.current;
                    node?.scrollIntoView({
                      block: "center",
                      behavior: matchMedia("(prefers-reduced-motion: reduce)")
                        .matches
                        ? "instant"
                        : "smooth",
                    });
                    (node?.matches("input,select,button")
                      ? node
                      : node?.querySelector<HTMLElement>("input,select,button")
                    )?.focus();
                  }}
                >
                  Entendido · completar en la aplicación
                </button>
              )}
              {session?.version !== 1 && step?.kind && (
                <>
                  <button disabled={disabled} onClick={() => go("caja")}>
                    Necesito abrir caja
                  </button>
                  <button disabled={disabled} onClick={() => go("inventario")}>
                    Ver inventario
                  </button>
                  <button disabled={disabled} onClick={() => go(step.view)}>
                    Volver al paso
                  </button>
                </>
              )}
              <button
                disabled={disabled}
                onClick={() => void tutorial.consult()}
              >
                Actualizar
              </button>
              <button disabled={disabled} onClick={() => void tutorial.pause()}>
                Pausar
              </button>
              <button
                type="button"
                onClick={() => ref.current?.scrollIntoView({ block: "center" })}
              >
                Repetir explicación
              </button>
              {(!step || session?.version !== 1) && (
                <button
                  disabled={disabled}
                  onClick={() => void tutorial.finish()}
                >
                  Terminar y borrar práctica
                </button>
              )}
              <button
                disabled={disabled}
                onClick={() => void tutorial.finish(true)}
              >
                Abandonar
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
