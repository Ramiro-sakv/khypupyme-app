import { tutorialSteps } from "../../../../shared/workspace/timber-tutorial";
import { useWorkspace } from "../context";
import { useTimberTutorial } from "./context";
export default function TutorialEntry() {
  const tutorial = useTimberTutorial(),
    { business, busy } = useWorkspace();
  if (!tutorial || tutorial.active || business.industryId !== "timber")
    return null;
  return (
    <section className="card tutorial-entry">
      <span className="eyebrow">APRENDE HACIENDO</span>
      <h3>Aprender usando la aplicación</h3>
      <p>
        Practica catálogo, compras, ventas, caja y documentos con tus propias
        manos. Al terminar se elimina solo la práctica.
      </p>
      {tutorial.error && <p role="alert">{tutorial.error}</p>}
      {tutorial.notice && <p role="status">{tutorial.notice}</p>}
      {tutorial.state.session &&
        ["active", "paused"].includes(tutorial.state.session.status) && (
          <p>
            Capítulo guardado · paso {tutorial.state.session.stepIndex + 1} de{" "}
            {tutorialSteps(tutorial.state.session.version).length}. Puedes
            reanudar.
          </p>
        )}
      {tutorial.state.session?.version === 1 &&
        ["active", "paused"].includes(tutorial.state.session.status) && (
          <p role="status">
            Tienes una práctica del tutorial anterior. Puedes continuar con su
            contrato original o abandonarla expresamente para iniciar la guía
            nueva; tus negocios no se eliminan.
          </p>
        )}
      {tutorial.state.session &&
        ["active", "paused"].includes(tutorial.state.session.status) && (
          <button
            disabled={tutorial.loading || busy}
            onClick={() => void tutorial.finish(true)}
          >
            Abandonar esta práctica y poder iniciar otra
          </button>
        )}
      {tutorial.pendingControl ? (
        <div className="actions">
          <p>
            Hay una solicitud de tutorial sin confirmación. Reintentar conserva
            su ID y contenido original.
          </p>
          <button
            disabled={tutorial.loading || busy}
            onClick={() => void tutorial.consult()}
          >
            Consultar estado
          </button>
          <button
            disabled={tutorial.loading || busy}
            onClick={() => void tutorial.retry()}
          >
            Reintentar solicitud original
          </button>
        </div>
      ) : (
        <button
          className="primary"
          disabled={tutorial.loading || busy}
          onClick={() => void tutorial.start()}
        >
          {tutorial.state.session &&
          ["active", "paused"].includes(tutorial.state.session.status)
            ? "Reanudar práctica"
            : "Comenzar práctica"}
        </button>
      )}
      <button
        disabled={tutorial.loading || busy}
        onClick={() => void tutorial.consult()}
      >
        Consultar progreso
      </button>
      {tutorial.state.session?.status === "closing" && (
        <button
          disabled={tutorial.loading}
          onClick={() => void tutorial.consult()}
        >
          Reanudar limpieza pendiente
        </button>
      )}
    </section>
  );
}
