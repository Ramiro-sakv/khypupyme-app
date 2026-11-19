import { useState } from "react";
import { change } from "../api/client";
import { Alert, Button, Card } from "../ui/Primitives";
import { IdentityDialog, securityPath } from "./IdentityDialog";
import { pendingForAccount } from "../commerce/storage";

export function AccountProtection({ accountId, ended }: { accountId: string; ended: (notice: string) => void }) {
  const [visible, setVisible] = useState(false);
  const [proof, setProof] = useState<{ id: string; purpose: "delete-account" | "revoke-sessions" }>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function complete() {
    if (!proof) return;
    const { id, purpose } = proof;
    setProof(undefined);
    setError("");
    setBusy(true);
    try {
      if (purpose === "delete-account" && await pendingForAccount(accountId))
        throw new Error("Consulta las solicitudes pendientes de tus negocios antes de solicitar la baja.");
      await change(securityPath + "/account/" + (purpose === "delete-account" ? "request-deletion" : "revoke"), "POST", { id });
      ended(purpose === "delete-account" ? "Solicitud de eliminación registrada. Se cerraron tus sesiones." : "Se cerraron todas las sesiones.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo completar la solicitud.");
    } finally { setBusy(false); }
  }

  if (!visible) return <Button variant="secondary" onClick={() => setVisible(true)}>Seguridad de cuenta</Button>;
  return <>
    <Card>
      <h2>Seguridad de cuenta</h2>
      <p>Puedes cerrar todas las sesiones o solicitar la eliminación de tu cuenta. Antes de solicitarla, exporta tus datos y resuelve las operaciones pendientes.</p>
      <div className="inline-actions">
        <Button variant="plain" disabled={busy} onClick={() => setVisible(false)}>Cerrar panel</Button>
        <Button variant="secondary" disabled={busy} onClick={() => setProof({ id: crypto.randomUUID(), purpose: "revoke-sessions" })}>
          Cerrar todas las sesiones</Button>
        <Button variant="secondary" disabled={busy} onClick={() => setProof({ id: crypto.randomUUID(), purpose: "delete-account" })}>
          Solicitar eliminación de cuenta</Button>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
    </Card>
    {proof && <IdentityDialog request={proof} title="Confirma tu identidad"
      effect={proof.purpose === "delete-account" ? "La solicitud suspende el acceso a tu cuenta y cierra todas sus sesiones." :
        "Se cerrarán las sesiones web y las sesiones de las aplicaciones instaladas."}
      done={() => void complete()} cancel={() => setProof(undefined)} />}
  </>;
}
