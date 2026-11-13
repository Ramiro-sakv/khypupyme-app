import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useAuth } from "../auth/auth-context";
import { errorMessage } from "../../shared/errors";
import { WorkspaceContext } from "../workspace/context";
import type { WorkspaceBusiness } from "../../../shared/workspace/model";
import type { WorkspaceRepository } from "../workspace/WorkspaceRepository";
import BusinessPlanPanel from "./BusinessPlanPanel";
import { useBusinessPlan } from "./useBusinessPlan";

function Checkout({ business, uid, repository }: { business: WorkspaceBusiness; uid: string; repository: WorkspaceRepository }) {
  const billing = useBusinessPlan(repository, business.id, true);
  return <WorkspaceContext value={{
    business, identity: { uid, businessId: business.id }, repository, billing,
    revision: 0, busy: false, pending: false, confirmedOperationId: "", rejectedOperationId: "",
    prepare: () => { throw new Error("El portal se usa para pagar el plan."); },
    run: async () => undefined, recover: async () => {},
  }}><BusinessPlanPanel qrOnly /></WorkspaceContext>;
}

export default function WebCheckout({ repository }: { repository: WorkspaceRepository }) {
  const { user } = useAuth();
  const { businessId = "" } = useParams();
  const [business, setBusiness] = useState<WorkspaceBusiness | null>(null);
  const [error, setError] = useState("");
  const uid = user?.uid;
  useEffect(() => {
    if (!uid || !businessId) return;
    let active = true;
    repository.business(businessId).then((value) => { if (active) setBusiness(value); },
      (cause) => { if (active) setError(errorMessage(cause, "No se pudo abrir el negocio.")); });
    return () => { active = false; };
  }, [repository, businessId, uid]);
  if (!user) return <section className="card"><h1>Pago de KhypuPyme</h1><Link to={`/ingresar?volver=pago&negocio=${encodeURIComponent(businessId)}`}>Ingresar para pagar</Link></section>;
  if (error) return <p className="notice notice-error" role="alert">{error}</p>;
  return business?.id === businessId && business.ownerUid === user.uid ? <Checkout key={businessId} business={business} uid={user.uid} repository={repository} /> : <p role="status">Consultando el negocio…</p>;
}
