import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { TIMBER_STEPS } from "../../../../shared/workspace/timber-tutorial";
import { useWorkspace } from "../context";
import { useTimberTutorial } from "./context";
interface Hint {
  selector: string;
  text: string;
}
function hints(id: string, refs: Record<string, string>): Hint[] {
  const target = (tag: string) => '[data-tutorial="' + tag + '"]',
    field = (name: string, scope = "") => scope + ' [name="' + name + '"]';
  const item = target("item-form"),
    trade = target("trade-form"),
    pick =
      target("pick-item") +
      '[data-item-id="' +
      (id === "order-sale" ? refs.service : refs.wood) +
      '"]';
  const save = (scope: string) => ({
    selector: scope + ' button[type="submit"]',
    text: "Revisa y confirma el formulario. El tutorial espera la respuesta del servidor.",
  });
  if (["wood", "cut-service"].includes(id))
    return [
      {
        selector: target("new-item"),
        text: "Pulsa Nuevo producto o servicio.",
      },
      {
        selector: field("item-kind", item),
        text:
          id === "wood"
            ? "Elige Madera por piezas y medidas."
            : "Elige Servicio o trabajo.",
      },
      {
        selector: field("name", item),
        text: id === "wood" ? "Nombre: Tabla de pino." : "Nombre: Corte.",
      },
      ...(id === "wood"
        ? [
            { selector: field("species", item), text: "Especie: Pino." },
            {
              selector: field("lengthMm", item),
              text: "Largo: 10 pies (3048 en métrico).",
            },
            {
              selector: field("widthMm", item),
              text: "Ancho: 6 pulgadas (152,4 en métrico).",
            },
            {
              selector: field("thicknessMm", item),
              text: "Espesor: 2 pulgadas (50,8 en métrico).",
            },
          ]
        : []),
      {
        selector: field("price", item),
        text: id === "wood" ? "Precio: Bs 10." : "Precio: Bs 20.",
      },
      {
        selector: field("priceUnit", item),
        text:
          id === "wood"
            ? "Precio por pies tablares. Cada tabla equivale a 10 pies tablares."
            : "Precio por servicios.",
      },
      {
        selector: field("minimum", item),
        text: id === "wood" ? "Mínimo: 3 piezas." : "Mínimo: 0.",
      },
      ...(id === "cut-service"
        ? [
            {
              selector: field("serviceCost", item),
              text: "Costo directo: Bs 5.",
            },
          ]
        : []),
      save(item),
    ];
  if (["purchase", "quote", "credit", "order-sale"].includes(id))
    return [
      { selector: pick, text: "Selecciona el producto o servicio indicado." },
      {
        selector: field("line-unit", trade),
        text: id === "order-sale" ? "Unidad: servicios." : "Unidad: piezas.",
      },
      {
        selector: field("line-qty", trade),
        text:
          "Cantidad: " +
          (id === "purchase" ? "10" : id === "quote" ? "2" : "1") +
          ".",
      },
      ...(id === "purchase"
        ? [
            {
              selector: field("line-cost", trade),
              text: "Costo por pieza: Bs 50. Total: Bs 500.",
            },
          ]
        : [
            {
              selector: field("customerId", trade),
              text: "Selecciona Cliente de práctica.",
            },
          ]),
      ...(id === "quote"
        ? []
        : [
            {
              selector: field("method", trade),
              text:
                id === "credit"
                  ? "Forma de pago: Fiado."
                  : "Forma de pago: Efectivo.",
            },
          ]),
      {
        selector: field("review", trade),
        text: "Revisa el total y marca la confirmación del importe.",
      },
      save(trade),
    ];
  if (id === "customer")
    return [
      { selector: target("new-customer"), text: "Abre Nuevo cliente." },
      {
        selector: field("name", target("customer-form")),
        text: "Nombre: Cliente de práctica. No uses datos reales.",
      },
      save(target("customer-form")),
    ];
  if (id === "units")
    return [
      {
        selector: field("system", target("timber-preferences")),
        text: "Elige Pulgadas y pies o Métrico.",
      },
      save(target("timber-preferences")),
    ];
  if (id === "sale")
    return [
      {
        selector: target("quote-history"),
        text: "Abre Cotizaciones anteriores y Revisar y convertir a venta.",
      },
      {
        selector: field("method", trade),
        text: "Selecciona Efectivo. Conserva los datos de la oferta.",
      },
      {
        selector: field("review", trade),
        text: "Confirma el importe de Bs 200.",
      },
      save(trade),
    ];
  if (id === "cash-open")
    return [
      {
        selector: '[data-tutorial-page="caja"] [name="amount"]',
        text: "Fondo inicial: Bs 1.000.",
      },
      {
        selector: '[data-tutorial-page="caja"] button[type="submit"]',
        text: "Confirma la apertura.",
      },
    ];
  if (id === "cash-close")
    return [
      {
        selector: '[name="counted"]',
        text: "Efectivo contado: Bs 700. Comprueba que coincide con lo esperado.",
      },
      {
        selector:
          '[data-tutorial-page="caja"] .cash-current button[type="submit"]',
        text: "Confirma Cerrar caja y emitir comprobante.",
      },
    ];
  if (id === "expense")
    return [
      {
        selector: field("description", target("expense-form")),
        text: "Concepto: Transporte de práctica.",
      },
      {
        selector: field("category", target("expense-form")),
        text: "Categoría: Transporte.",
      },
      {
        selector: field("amount", target("expense-form")),
        text: "Importe: Bs 20.",
      },
      {
        selector: field("method", target("expense-form")),
        text: "Forma de pago: Efectivo.",
      },
      save(target("expense-form")),
    ];
  if (id === "return")
    return [
      {
        selector: target("sales-history"),
        text: "Abre Detalle y devolución de la venta al contado.",
      },
      { selector: field("return-qty"), text: "Cantidad a devolver: 1." },
      { selector: field("returnUnit0"), text: "Unidad original: piezas." },
      {
        selector: field("return-restock"),
        text: "Deja marcado Reingresa al inventario.",
      },
      { selector: field("reason"), text: "Motivo: Devolución de práctica." },
      save(target("return-form")),
    ];
  if (id === "collect")
    return [
      {
        selector: field("method", target("collect-form")),
        text: "Selecciona Efectivo. El saldo completo es Bs 100.",
      },
      save(target("collect-form")),
    ];
  if (id === "order")
    return [
      { selector: target("new-order"), text: "Pulsa Nueva orden." },
      {
        selector: field("customerId"),
        text: "Selecciona Cliente de práctica.",
      },
      { selector: field("title"), text: "Título: Corte de práctica." },
      {
        selector: field("description"),
        text: "Describe un corte ficticio; el trabajo no consume piezas automáticamente.",
      },
      { selector: field("budget"), text: "Presupuesto: Bs 20." },
      { selector: field("status"), text: "Estado: Recibido." },
      {
        selector: 'dialog[open] button[type="submit"]',
        text: "Guarda la orden.",
      },
    ];
  if (id.startsWith("order-") && id !== "order-sale")
    return [
      {
        selector: target("work-orders"),
        text: "Abre Ver / actualizar de Corte de práctica.",
      },
      {
        selector: field("status"),
        text:
          (
            {
              "order-quote": "Selecciona Presupuestado.",
              "order-approve": "Selecciona Aprobado.",
              "order-work": "Selecciona En trabajo.",
              "order-ready": "Selecciona Listo.",
            } as Record<string, string>
          )[id] ?? "",
      },
      {
        selector: 'dialog[open] button[type="submit"]',
        text: "Guarda el nuevo estado. No se registra un cobro.",
      },
    ];
  if (id === "delivery")
    return [
      { selector: target("new-delivery"), text: "Pulsa Programar entrega." },
      {
        selector: field("sale"),
        text: "Selecciona la venta a crédito de Bs 100 ya cobrada, no la venta del servicio Corte.",
      },
      { selector: field("address"), text: "Dirección: Obra de práctica." },
      { selector: field("day"), text: "Elige la fecha programada." },
      {
        selector: 'dialog[open] button[type="submit"]',
        text: "Guarda la entrega pendiente.",
      },
    ];
  if (id.startsWith("delivery-"))
    return [
      {
        selector: target("deliveries"),
        text: "Abre Ver / actualizar de la entrega.",
      },
      {
        selector: field("status"),
        text:
          id === "delivery-prepared"
            ? "Selecciona Preparada."
            : "Selecciona Entregada.",
      },
      {
        selector: 'dialog[open] button[type="submit"]',
        text: "Guarda el nuevo estado de entrega.",
      },
    ];
  if (id === "inventory-document" || id === "result-document")
    return [
      save(
        target(
          id === "inventory-document" ? "inventory-report" : "result-report",
        ),
      ),
    ];
  return [];
}
export default function TutorialCoach({
  inPanel = false,
}: {
  inPanel?: boolean;
}) {
  const tutorial = useTimberTutorial(),
    workspace = useWorkspace(),
    [params, setParams] = useSearchParams(),
    ref = useRef<HTMLElement>(null),
    [visible, setVisible] = useState(false),
    [hasAnchor, setHasAnchor] = useState(false),
    anchorRef = useRef<Element | null>(null);
  const session = tutorial?.state.session,
    step = session ? TIMBER_STEPS[session.stepIndex] : undefined,
    stepId = step?.id ?? "",
    referenceKey = JSON.stringify(session?.references ?? {}),
    fields = useMemo(
      () => (stepId ? hints(stepId, JSON.parse(referenceKey)) : []),
      [stepId, referenceKey],
    ),
    index = Math.min(tutorial?.fieldIndex ?? 0, Math.max(fields.length - 1, 0)),
    hint = fields[index],
    selector =
      hint?.selector ?? (step ? '[data-tutorial="' + step.target + '"]' : "");
  useEffect(() => {
    if (!tutorial?.active) return;
    let previous: Element | null = null;
    const update = () => {
      const panels =
          document.querySelectorAll<HTMLDialogElement>("dialog[open]"),
        panel = panels.item(panels.length - 1),
        mine = ref.current?.closest("dialog"),
        show = inPanel ? !!panel && mine === panel : !panel;
      setVisible(show);
      const root = inPanel
        ? mine
        : document.querySelector(".business-workspace");
      let node =
        show && root && selector
          ? root.matches(selector)
            ? root
            : root.querySelector(selector)
          : null;
      if (show && inPanel && !node && index === 0 && fields.length > 1) {
        const next = fields.findIndex((f) => !!root?.querySelector(f.selector));
        if (next > 0) tutorial.setFieldIndex(next);
      }
      if (show && !node && !step?.kind && !step?.pdf)
        node =
          root?.querySelector('[data-tutorial-page="' + step?.view + '"]') ??
          null;
      if (previous !== node) {
        previous?.classList.remove("tutorial-target");
        if (show) node?.classList.add("tutorial-target");
        previous = node;
      }
      anchorRef.current = node || null;
      setHasAnchor(!!node);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["open"],
    });
    return () => {
      observer.disconnect();
      previous?.classList.remove("tutorial-target");
      anchorRef.current = null;
    };
  }, [tutorial?.active, inPanel, selector, index, fields, step, tutorial]);
  const view = params.get("vista") ?? "inicio";
  useEffect(() => {
    if (
      !inPanel &&
      tutorial?.active &&
      !tutorial.loading &&
      !tutorial.pendingControl &&
      !workspace.busy &&
      step &&
      view !== step.view &&
      !(step.id === "order-sale" && view === "cobrar-trabajo")
    )
      setParams({ vista: step.view });
  }, [
    inPanel,
    tutorial?.active,
    tutorial?.loading,
    tutorial?.pendingControl,
    workspace.busy,
    step,
    view,
    setParams,
  ]);
  if (!tutorial?.active) return null;
  const disabled =
    tutorial.loading || workspace.busy || tutorial.pendingControl;
  function focus() {
    const anchor = anchorRef.current;
    if (!(anchor instanceof HTMLElement)) return;
    for (
      let parent = anchor.parentElement;
      parent;
      parent = parent.parentElement
    )
      if (parent instanceof HTMLDetailsElement) parent.setAttribute("open", "");
    anchor.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
    const input = anchor.matches("input,select,button,textarea,summary")
      ? anchor
      : anchor.querySelector<HTMLElement>(
          "input,select,button,textarea,summary",
        );
    input?.focus({ preventScroll: true });
  }
  return (
    <aside
      ref={ref}
      className={"tutorial-coach " + (!visible ? " tutorial-coach-hidden" : "")}
      aria-label="Instructor de práctica"
    >
      <div className="section-heading">
        <strong>{step?.chapter ?? "Práctica completa"}</strong>
        <span>
          {Math.min((session?.stepIndex ?? 0) + 1, TIMBER_STEPS.length)} /{" "}
          {TIMBER_STEPS.length}
        </span>
      </div>
      <progress
        value={session?.stepIndex ?? 0}
        max={TIMBER_STEPS.length}
        aria-label="Progreso"
      />
      <h3>{step?.title ?? "Finaliza y borra la práctica"}</h3>
      <p role="status">
        {step?.text ?? "Finalizar elimina únicamente este ejercicio."}
      </p>
      {hint && (
        <p className="tutorial-field-hint">
          <strong>
            Campo {index + 1}/{fields.length}:
          </strong>{" "}
          {hint.text}
        </p>
      )}
      {tutorial.error && <p role="alert">{tutorial.error}</p>}
      {tutorial.pendingControl ? (
        <div className="actions">
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
        </div>
      ) : (
        <div className="actions">
          {hasAnchor && (
            <button type="button" onClick={focus}>
              Ir al campo indicado
            </button>
          )}
          {fields.length > 1 && (
            <>
              <button
                disabled={index === 0}
                onClick={() => tutorial.setFieldIndex(index - 1)}
              >
                Campo anterior
              </button>
              <button
                disabled={index >= fields.length - 1}
                onClick={() => tutorial.setFieldIndex(index + 1)}
              >
                Siguiente campo
              </button>
            </>
          )}
          {step && !step.kind && !step.pdf && (
            <button
              className="primary"
              disabled={disabled || !hasAnchor}
              onClick={() => void tutorial.advance()}
            >
              Revisado · siguiente paso
            </button>
          )}
          {!step && (
            <button
              className="primary"
              disabled={disabled}
              onClick={() => void tutorial.finish()}
            >
              Finalizar y borrar práctica
            </button>
          )}
          <button disabled={disabled} onClick={() => void tutorial.pause()}>
            Pausar
          </button>
          <button disabled={disabled} onClick={() => void tutorial.consult()}>
            Actualizar progreso
          </button>
          <button
            onClick={() => {
              tutorial.setFieldIndex(0);
              ref.current?.scrollIntoView({ block: "start" });
            }}
          >
            Repetir explicación
          </button>
          <button
            disabled={disabled}
            onClick={() => void tutorial.finish(true)}
          >
            Abandonar práctica
          </button>
        </div>
      )}
    </aside>
  );
}
