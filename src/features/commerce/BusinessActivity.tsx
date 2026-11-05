import { useState } from 'react';
import type { Command } from '../../../shared/commerce';
import type { Business } from '../business/domain';
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
  const [message, setMessage] = useState(''),
    online = useOnline();
  const operation = useCommerceCommand(uid, service, () =>
    setMessage('Actividad guardada. Se aplicará al abrir una nueva venta.'),
  );
  return (
    <section className="card activity-card">
      <h2>¿Cómo trabajas?</h2>
      <p>
        Adapta el inicio de las ventas a tu actividad. Las herramientas comunes permanecen
        disponibles.
      </p>
      <OperationFeedback operation={operation} message={message} />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void operation.execute({
            kind: 'business-settings',
            operationId: crypto.randomUUID(),
            input: {
              activity: String(new FormData(event.currentTarget).get('activity')) as Extract<
                Command,
                { kind: 'business-settings' }
              >['input']['activity'],
            },
          });
        }}
      >
        <label htmlFor="activity">Actividad principal</label>
        <select id="activity" name="activity" defaultValue={business.activity ?? 'commerce'}>
          <option value="commerce">Comercio · vendo productos</option>
          <option value="services">Servicios · vendo mi trabajo</option>
          <option value="mixed">Mixto · productos y servicios</option>
        </select>
        <button className="primary" disabled={operation.blocked || !online}>
          Guardar actividad
        </button>
      </form>
      <p className="muted">
        Madera, ropa, electrodomésticos y fabricación tendrán herramientas especializadas en
        versiones posteriores.
      </p>
    </section>
  );
}
