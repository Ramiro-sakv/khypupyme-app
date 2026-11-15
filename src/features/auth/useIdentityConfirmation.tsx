import { useEffect, useState } from "react";
import { useAuth } from "./auth-context";

export function useIdentityConfirmation() {
  const { user, service } = useAuth();
  const google = !!user?.googleOnly;
  const [pairing, setPairing] = useState("");
  useEffect(() => () => { service.cancelGoogle?.(); }, [service]);
  return {
    google,
    available: google ? !!service.reauthenticateGoogle : !!service.reauthenticate,
    confirm: async (data: FormData) => {
      if (google) {
        try { await service.reauthenticateGoogle!((transfer) => setPairing(transfer.pairing)); }
        finally { setPairing(""); }
      } else await service.reauthenticate!(String(data.get("password") ?? ""));
    },
    field: google ? <>
      <p>Confirma tu identidad con la cuenta de Google que usaste al ingresar.</p>
      {pairing && <p role="status">Escribe este código en la página abierta en el navegador: <strong>{pairing}</strong></p>}
    </> : <label>Confirma tu contraseña<input name="password" type="password" autoComplete="current-password" required /></label>,
    cancel: () => { service.cancelGoogle?.(); setPairing(""); },
  };
}
