import {createContentIdempotencyKey} from '@catering-v2s/admin-ui-foundation';
import {operationsClient} from '../../../app/api/OperationsTransport';
import {
  OPERATIONS_ADMIN_OPERATION_IDS,
  type StoreTerminalCreateRequest,
  type StoreTerminalDetail,
  type StoreTerminalStatus,
} from '../../../app/api/generated/operations-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import {configurationInput, type StoreTerminalFormValues as FormValues} from './storeTerminalModel';

type Context = {groupWorkspaceKey: string; storeRef: string};

function pathFor(context: Context) {
  return {groupWorkspaceKey: context.groupWorkspaceKey, storeRef: wireUuid(context.storeRef)};
}

function createBody(values: FormValues): StoreTerminalCreateRequest {
  const activationCode = values.activationCode?.trim();
  return {
    name: values.name.trim(),
    deviceType: values.deviceType,
    configuration: configurationInput(values),
    ...(activationCode ? {activationCode} : {}),
  };
}

export async function createStoreTerminal(context: Context, values: FormValues, idempotencyKey: string) {
  const path = pathFor(context);
  const body = createBody(values);
  const key = body.activationCode
    ? idempotencyKey
    : await createContentIdempotencyKey(OPERATIONS_ADMIN_OPERATION_IDS.postOperationsStoreTerminal, {path, body});
  return operationsClient.postOperationsStoreTerminal(path, {body, headers: {'Idempotency-Key': key}});
}

export async function replaceStoreTerminal(context: Context, terminal: StoreTerminalDetail, values: FormValues) {
  const path = {...pathFor(context), terminalRef: wireUuid(String(terminal.terminalRef))};
  const body = {
    name: values.name.trim(),
    deviceType: values.deviceType,
    configuration: configurationInput(values),
    expectedVersion: terminal.version,
  };
  const key = await createContentIdempotencyKey(OPERATIONS_ADMIN_OPERATION_IDS.putOperationsStoreTerminal, {
    path,
    body,
  });
  return operationsClient.putOperationsStoreTerminal(path, {body, headers: {'Idempotency-Key': key}});
}

export async function changeStoreTerminalStatus(
  context: Context,
  terminal: StoreTerminalDetail,
  status: StoreTerminalStatus,
) {
  const path = {...pathFor(context), terminalRef: wireUuid(String(terminal.terminalRef))};
  const body = {status, expectedVersion: terminal.version};
  const key = await createContentIdempotencyKey(OPERATIONS_ADMIN_OPERATION_IDS.postOperationsStoreTerminalStatus, {
    path,
    body,
  });
  return operationsClient.postOperationsStoreTerminalStatus(path, {body, headers: {'Idempotency-Key': key}});
}
