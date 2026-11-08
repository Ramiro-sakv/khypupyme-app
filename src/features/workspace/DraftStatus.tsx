import { errorMessage } from "../../shared/errors";
import { useState } from "react";
import { Icon } from "./Icon";
import { useWorkspace } from "./context";
import { bob, localDate } from "./format";
import { confirmDiscardChanges } from "./navigation";
import type { useTradeDraft } from "./useTradeDraft";
export default function DraftStatus({
  draft,
}: {
  draft: ReturnType<typeof useTradeDraft>;
}) {
  const { pending, busy, recover } = useWorkspace(),
    [checking, setChecking] = useState(false),
    [statusError, setStatusError] = useState("");
  const changed = draft.phase === "saving",
    saved = draft.phase === "saved" && !draft.unsaved;
  return (
    <section
      className={
        "draft-status notice " +
        (draft.phase === "conflict" || draft.phase === "submitted"
          ? "notice-warning"
          : "notice-info")
      }
      aria-label="Borrador de esta operación"
    >
      <Icon name="document" />
      <div>
        <strong>
          {draft.phase === "loading"
            ? "Consultando borradores…"
            : draft.phase === "available"
              ? "Tienes un borrador guardado"
              : draft.phase === "conflict"
                ? "El borrador cambió en otra pestaña"
                : draft.phase === "submitted"
                  ? "Solicitud enviada, resultado por consultar"
                  : changed
                    ? "Guardando borrador…"
                    : saved
                      ? "Borrador guardado en este dispositivo"
                      : draft.phase === "error"
                        ? "El borrador no pudo guardarse"
                        : "Borrador local · aún no es una operación"}
        </strong>
        {draft.saved && (
          <p>
            Último guardado: {localDate(draft.saved.updatedAt, true)}. Solo para
            esta cuenta y este negocio.
          </p>
        )}
        {statusError && <p role="alert">{statusError}</p>}
        {draft.error && <p role="alert">{draft.error}</p>}
        {["available", "conflict"].includes(draft.phase) && (
          <div className="actions">
            <button
              type="button"
              disabled={pending || busy || draft.restoring}
              onClick={() => {
                if (confirmDiscardChanges()) void draft.restore();
              }}
            >
              {draft.restoring
                ? "Consultando productos…"
                : "Cargar versión guardada"}
            </button>
            {draft.phase === "conflict" && (
              <button
                type="button"
                disabled={pending || busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "¿Reemplazar el borrador guardado por el trabajo que ves en esta pantalla?",
                    )
                  )
                    void draft.replace();
                }}
              >
                Reemplazar con mi pantalla
              </button>
            )}
            {draft.phase === "available" && !draft.saved?.submitted && (
              <button
                type="button"
                disabled={pending || busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "¿Descartar este borrador local y empezar de nuevo?",
                    )
                  )
                    void draft.discard();
                }}
              >
                Descartar guardado
              </button>
            )}
          </div>
        )}
        {draft.phase === "error" && (
          <button
            type="button"
            disabled={pending || busy}
            onClick={() => {
              if (
                window.confirm(
                  "¿Intentar guardar el contenido actual como borrador? Esto no envía una operación.",
                )
              )
                void draft.replace();
            }}
          >
            Reintentar guardado local
          </button>
        )}
        {draft.review && (
          <div className="draft-review">
            <strong>Revisa antes de continuar</strong>
            {draft.review.priceChanges.map((p, i) => (
              <p key={i}>
                {p.name}: {bob(p.before)} → {bob(p.after)}
              </p>
            ))}
            {draft.review.quoteIssue && <p>{draft.review.quoteIssue}</p>}
            {draft.review.serialsCleared && (
              <p>
                Vuelve a seleccionar las series de salida: su disponibilidad
                puede haber cambiado.
              </p>
            )}
            {draft.review.requiresNewQuote && (
              <p>
                La oferta original no se modifica. Se preparará una nueva
                cotización con los precios actuales.
              </p>
            )}
            <button
              type="button"
              disabled={pending || busy}
              onClick={() => draft.accept(draft.review!)}
            >
              {draft.review.requiresNewQuote
                ? "Preparar nueva cotización"
                : "Aceptar y restaurar"}
            </button>
          </div>
        )}
        {draft.phase === "submitted" && (
          <>
            <p>
              No restaures ni vuelvas a registrar esta operación hasta consultar
              su resultado.
            </p>
            {pending ? (
              <p>Usa el panel de solicitud pendiente de este negocio.</p>
            ) : (
              <button
                type="button"
                disabled={checking || busy}
                onClick={() => {
                  setChecking(true);
                  void draft
                    .inspectSubmission()
                    .then(async (command) => {
                      if (command) await recover(command);
                    })
                    .catch((e) =>
                      setStatusError(
                        errorMessage(e, "No se pudo recuperar la solicitud."),
                      ),
                    )
                    .finally(() => setChecking(false));
                }}
              >
                {checking ? "Consultando…" : "Consultar confirmación original"}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
