import { industry } from '../../../shared/business-industries';
import { useState } from 'react';
import type { Business } from '../business/domain';
import { useBusiness } from '../business/business-context';
import type { BusinessConfiguration } from '../../../shared/business-configuration';
import { ProfilePicker } from '../business/ProfilePicker';
import type { CommerceService } from './CommerceRepository';
import { useCommerceCommand } from './useCommerce';
import { OperationFeedback } from './CommerceControls';
import { useOnline } from '../../shared/hooks/useOnline';

export function BusinessActivity({
  business,
  uid,
  service,
}: {
  business: Business;
  uid: string;
  service: CommerceService;
}) {
  const [configuration, setConfiguration] = useState<BusinessConfiguration | null>(
    business.configuration ?? null,
  );
  const [message, setMessage] = useState('');
  const { refresh } = useBusiness(),
    online = useOnline();
  const operation = useCommerceCommand(uid, service, () => {
    setMessage('Perfil y herramientas guardados.');
    refresh();
  });
  return (
    <section className="card activity-card">
      <h2>Tu perfil y herramientas</h2>
      {business.configuration?.industryId && (
        <p className="saved-industry">
          Rubro guardado: <strong>{industry(business.configuration.industryId)?.name}</strong>
        </p>
      )}
      <p>
        Elige un punto de partida y combina las herramientas que necesitas. Cambiar de perfil no
        convierte unidades ni modifica precios, costos o historial.
      </p>
      {!business.configuration && (
        <p className="empty-notice">
          Tu negocio conserva todas sus herramientas anteriores. Elige un perfil cuando quieras
          personalizarlo.
        </p>
      )}
      <OperationFeedback operation={operation} message={message} />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (configuration)
            void operation.execute({
              kind: 'configure-business',
              operationId: crypto.randomUUID(),
              input: { configuration, expectedRevision: business.configurationRevision ?? 0 },
            });
        }}
      >
        <ProfilePicker
          value={configuration}
          onChange={setConfiguration}
          disabled={operation.blocked || !online}
        />
        <p className="muted">
          Desactivar una herramienta solo cambia tu espacio de trabajo. Los datos conservan su
          propietario, moneda y unidades originales; no se elimina información.
        </p>
        <div className="actions">
          <button className="primary" disabled={!configuration || operation.blocked || !online}>
            Guardar herramientas
          </button>
          <button type="button" onClick={refresh} disabled={operation.busy || !online}>
            Actualizar perfil
          </button>
        </div>
      </form>
    </section>
  );
}
