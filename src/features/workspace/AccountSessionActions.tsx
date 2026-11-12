import { useState } from "react";
import { useAuth } from "../auth/auth-context";
import { errorMessage } from "../../shared/errors";
import { Icon } from "./Icon";
import { confirmDiscardChanges } from "./navigation";

export default function AccountSessionActions({ onExit, practice = false, exitDisabled = false }: { onExit?: () => void; practice?: boolean; exitDisabled?: boolean }) {
  const { service } = useAuth();
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    if (!confirmDiscardChanges()) return;
    setLeaving(true);
    setError("");
    try { await service.logout(); }
    catch (cause) { setError(errorMessage(cause, "No se pudo cerrar sesión.")); }
    finally { setLeaving(false); }
  }
  return <>
    <div className="actions">
      {onExit && <button disabled={leaving || exitDisabled} onClick={() => { if (confirmDiscardChanges()) onExit(); }}>
        <Icon name="grid" /> {practice ? "Pausar y volver al negocio" : "Cambiar negocio"}
      </button>}
      {!practice && <button disabled={leaving} onClick={() => void logout()}>
        <Icon name="logout" /> {leaving ? "Cerrando sesión…" : "Cerrar sesión"}
      </button>}
    </div>
    {error && <p role="alert" className="notice notice-error">{error}</p>}
  </>;
}
