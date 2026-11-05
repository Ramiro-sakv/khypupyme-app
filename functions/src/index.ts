import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { DomainError } from '../../shared/commerce.js';
import type { DateFilter, QueryInput } from '../../shared/commerce.js';
import { CommerceService } from './CommerceService.js';
import { CommerceQueries } from './CommerceQueries.js';
import { validateCommand } from './validation.js';

function services() {
  const projectId = process.env.GCLOUD_PROJECT ?? '';
  if (
    process.env.FUNCTIONS_EMULATOR !== 'true' ||
    !/^demo-[a-z0-9-]+$/.test(projectId) ||
    !/^127\.0\.0\.1:(8080|18080)$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '')
  ) {
    throw new HttpsError('failed-precondition', 'Esta beta solo admite emuladores locales.');
  }
  const app = getApps()[0] ?? initializeApp({ projectId });
  const db = getFirestore(app);
  return { commands: new CommerceService(db), queries: new CommerceQueries(db) };
}
const options = { region: 'us-central1', cors: true, maxInstances: 2, timeoutSeconds: 60 };
function failure(cause: unknown): never {
  if (cause instanceof HttpsError) throw cause;
  if (cause instanceof DomainError) throw new HttpsError('failed-precondition', cause.message);
  console.error('Operación comercial fallida:', cause instanceof Error ? cause.name : 'Error');
  throw new HttpsError(
    'internal',
    'No se pudo confirmar la operación. Consulta su estado antes de repetirla.',
  );
}
export const commerceCommand = onCall(options, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Inicia sesión.');
  try {
    let command;
    try {
      command = validateCommand(request.data);
    } catch (cause) {
      throw new HttpsError(
        'invalid-argument',
        cause instanceof Error ? cause.message : 'Solicitud inválida.',
      );
    }
    return await services().commands.execute(request.auth.uid, command);
  } catch (cause) {
    return failure(cause);
  }
});
export const commerceQuery = onCall(options, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Inicia sesión.');
  try {
    const queries = services().queries;
    if (request.data?.operationId)
      return await queries.status(request.auth.uid, request.data.operationId);
    return await queries.list(request.auth.uid, request.data as QueryInput);
  } catch (cause) {
    return failure(cause);
  }
});
export const commerceReport = onCall(options, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Inicia sesión.');
  try {
    return await services().queries.report(request.auth.uid, request.data as DateFilter);
  } catch (cause) {
    return failure(cause);
  }
});
