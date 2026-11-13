import { useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../auth/auth-context";
import { errorMessage } from "../../shared/errors";
import type { WorkspaceRepository } from "../workspace/WorkspaceRepository";

export default function AccountDeletion({ repository }: { repository: WorkspaceRepository }) {
  const { user, service } = useAuth();
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  return <section className="card">
    <h1>Solicitar eliminación de cuenta</h1>
    <p>La solicitud abarca tu cuenta y todos sus negocios. Descarga primero los registros que quieras conservar. El equipo revisará la solicitud y te confirmará cuando termine.</p>
    {!user ? <Link to="/ingresar?volver=baja">Ingresa para solicitar la baja</Link> : <form onSubmit={(event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const password = String(new FormData(form).get("password") ?? "");
      form.reset();
      if (busy) return;
      setBusy(true);
      setFeedback("");
      void (async () => {
        try {
          if (!service.reauthenticate || !repository.requestAccountDeletion) throw new Error("La solicitud no está disponible.");
          await service.reauthenticate(password);
          await repository.requestAccountDeletion();
          setFeedback("Solicitud recibida. Tu cuenta sigue disponible mientras se revisa.");
        } catch (cause) { setFeedback(errorMessage(cause, "No se pudo enviar la solicitud.")); }
        finally { setBusy(false); }
      })();
    }}>
      <label>Confirma tu contraseña<input name="password" type="password" autoComplete="current-password" required /></label>
      <label><input type="checkbox" required /> Solicito eliminar mi cuenta y sus negocios</label>
      <button type="submit" disabled={busy}>{busy ? "Enviando…" : "Solicitar eliminación"}</button>
    </form>}
    {feedback && <p role="status">{feedback}</p>}
  </section>;
}

export function PrivacyNotice() {
  return <section className="card">
    <h1>Privacidad de KhypuPyme</h1>
    <p>Usamos los datos de tu cuenta para autenticarte y recuperar el acceso. Guardamos los datos que registras en cada negocio para que puedas consultarlos en tus dispositivos.</p>
    <p>Google Play o el proveedor de QR procesa el cobro. KhypuPyme utiliza una referencia del pago y su estado para validar la vigencia del plan.</p>
    <p>Puedes descargar los registros desde Configuración y solicitar la baja de tu cuenta. Los registros de cobro que deban conservarse por obligaciones legales se tratan por separado.</p>
    <Link to="/eliminar-cuenta">Solicitar eliminación de cuenta</Link>
  </section>;
}
