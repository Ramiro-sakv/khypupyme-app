import { AccountService } from './workspace/AccountService.js';
import { WorkspaceService } from './workspace/WorkspaceService.js';
import { WorkspaceQueries } from './workspace/WorkspaceQueries.js';
import { canonical } from '../../shared/commerce.js';
import { validateWorkspaceCommand } from '../../shared/workspace/validation.js';
import { identifier, object, optionalId, oneOf } from '../../shared/workspace/validation.js';
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
  return { commands: new CommerceService(db), queries: new CommerceQueries(db), account:new AccountService(db),workspace:new WorkspaceService(db),workspaceQueries:new WorkspaceQueries(db) };
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

// Contratos v2: identidad del token, negocio explícito, validación en el servidor.
export const workspaceAccount=onCall(options,async request=>{
 if(!request.auth)throw new HttpsError('unauthenticated','Inicia sesión.');
 try {
  const envelope=object(request.data,{kind:oneOf(['list','get','create','status']),input:v=>v}),account=services().account;
  if(envelope.kind==='create')return await account.create(request.auth.uid,envelope.input);
  if(envelope.kind==='status')return await account.status(request.auth.uid,envelope.input);
  if(envelope.kind==='get')return await account.get(request.auth.uid,object(envelope.input,{id:identifier}).id as string);
  return await account.bootstrap(request.auth.uid,object(envelope.input,{cursor:optionalId}).cursor as string);
 }catch(cause){return workspaceFailure(cause);}
});
function workspaceFailure(cause:unknown):never {
 if(cause instanceof HttpsError)throw cause;
 // Errores de dominio son mensajes propios; fallos del SDK conservan respuesta incierta.
 if(cause instanceof Error && !('code' in cause))throw new HttpsError('failed-precondition',cause.message);
 return failure(cause);
}
export const workspaceCommand=onCall(options,async request=>{
 if(!request.auth)throw new HttpsError('unauthenticated','Inicia sesión.');
 try{return await services().workspace.execute(request.auth.uid,request.data);}catch(cause){return workspaceFailure(cause);}
});
export const workspaceQuery=onCall(options,async request=>{
 if(!request.auth)throw new HttpsError('unauthenticated','Inicia sesión.');
 try{return await services().workspaceQueries.list(request.auth.uid,request.data);}catch(cause){return workspaceFailure(cause);}
});
export const workspaceReport=onCall(options,async request=>{
 if(!request.auth)throw new HttpsError('unauthenticated','Inicia sesión.');
 try {const input=object(request.data,{businessId:identifier,from:v=>v,to:v=>v});return await services().workspaceQueries.report(request.auth.uid,input.businessId as string,input.from as string,input.to as string);}catch(cause){return workspaceFailure(cause);}
});
export const workspaceStatus=onCall(options,async request=>{
 if(!request.auth)throw new HttpsError('unauthenticated','Inicia sesión.');
 try {const command=validateWorkspaceCommand(request.data);return await services().workspaceQueries.status(request.auth.uid,command.businessId,command.operationId,canonical(command));}catch(cause){return workspaceFailure(cause);}
});
