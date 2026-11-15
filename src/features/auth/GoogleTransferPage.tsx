import { useState } from "react";
import { useSearchParams } from "react-router";
import { useAuth } from "./auth-context";
import { errorMessage } from "../../shared/errors";
import { Feedback } from "../../shared/components/Feedback";

export default function GoogleTransferPage() {
  const { service } = useAuth();
  const [params] = useSearchParams();
  const id = params.get("id") ?? "";
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");

  return <section className="card">
    <h1>Autorizar la app de KhypuPyme</h1>
    {confirmed ? <p role="status">Confirmación completa. Vuelve a KhypuPyme para continuar.</p>
      : !/^[a-f0-9]{32}$/.test(id) ? <p role="alert">Vuelve a iniciar el acceso desde la app.</p>
      : <form onSubmit={(event) => {
        event.preventDefault();
        if (busy) return;
        const pairing = String(new FormData(event.currentTarget).get("pairing") ?? "").trim().toUpperCase();
        setBusy(true);
        setError("");
        void service.confirmGoogle!(id, pairing).then(() => setConfirmed(true),
          (cause) => setError(errorMessage(cause))).finally(() => setBusy(false));
      }}>
        <p>Escribe el código que ves en la app que acabas de abrir. Usa únicamente el código que ves en tu dispositivo.</p>
        <label>Código de la app<input name="pairing" autoComplete="off" pattern="[0-9a-fA-F]{8}" maxLength={8} required /></label>
        <Feedback error={error} />
        <button className="primary" disabled={busy || !service.confirmGoogle}>Confirmar con Google</button>
      </form>}
  </section>;
}
