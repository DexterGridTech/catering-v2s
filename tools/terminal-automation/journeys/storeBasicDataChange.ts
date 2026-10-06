import type {AutomationDriverServer} from '../src/server.js';
import {
  createOperationsFixtureClient,
  type OperationsStore,
} from '../../../apps/terminal/kernel/base/terminal-data-client/acceptance/operationsFixture.ts';
import {ensureSeedProjectStoreEditPermission} from './seedRoleAccess.js';
import {readSelector, subscribeSelector} from '../src/selectorObservation.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const assertStoreFact = (
  value: unknown,
  input: Readonly<{storeRef: string; notes: string | null; updatedAt: number}>,
): void => {
  if (
    !isRecord(value) ||
    value.updatedAtEpochMillis !== input.updatedAt ||
    !isRecord(value.value) ||
    value.value.id !== input.storeRef ||
    (value.value.notes ?? null) !== input.notes
  ) {
    throw new Error('TERMINAL_AUTOMATION_TDP_STORE_SELECTOR_MISMATCH');
  }
};

const assertStoreTopicLoaded = (value: unknown): void => {
  if (!isRecord(value) || value.status !== 'loaded' || value.errorCode !== null) {
    const status = isRecord(value) && typeof value.status === 'string' ? value.status : 'UNCLASSIFIED';
    const rawErrorCode = isRecord(value) && typeof value.errorCode === 'string' ? value.errorCode : 'NONE';
    const errorCode = /^[A-Z][A-Z0-9_:-]{1,95}$/u.test(rawErrorCode) ? rawErrorCode : 'UNCLASSIFIED';
    throw new Error(`TERMINAL_AUTOMATION_TDP_STORE_TOPIC_NOT_LOADED:${status}:${errorCode}`);
  }
};

const assertStoreIdentity = (value: unknown, storeRef: string): void => {
  if (!isRecord(value) || value.storeRef !== storeRef) {
    throw new Error('TERMINAL_AUTOMATION_TDP_STORE_BINDING_MISMATCH');
  }
};

export const runStoreBasicDataChangeProof = async (
  input: Readonly<{
    readonly server: AutomationDriverServer;
    readonly sessionId: string;
    readonly runId: string;
    readonly httpBaseUrl: string;
    readonly operationsPassword: string;
    readonly platformRootPassword: string;
  }>,
): Promise<void> => {
  const marker = `ter-automation:${input.runId}`;
  const rolePermission = await ensureSeedProjectStoreEditPermission({
    httpBaseUrl: input.httpBaseUrl,
    workspaceKey: 'aurora',
    platformRootPassword: input.platformRootPassword,
  });
  process.stdout.write(
    `TERMINAL_AUTOMATION_TDP_SEED_ROLE_PERMISSION=${rolePermission} capability=BC-ORG-STORE-EDIT page=PG-ORG-STORE-MANAGE\n`,
  );
  const operations = createOperationsFixtureClient({
    httpBaseUrl: input.httpBaseUrl,
    workspaceKey: 'aurora',
    storeCode: 'S-OP',
    loginName: 'r5-account-multi-role',
    password: input.operationsPassword,
    fixtures: [],
  });
  let ownerSession: Awaited<ReturnType<typeof operations.operationsSession>> | undefined;
  let original: OperationsStore | undefined;
  let storeObservation: Awaited<ReturnType<typeof subscribeSelector>> | undefined;
  let topicObservation: Awaited<ReturnType<typeof subscribeSelector>> | undefined;
  let failure: unknown;

  try {
    ownerSession = await operations.operationsSession();
    original = await operations.operationsStore(ownerSession);
    if (ownerSession.storeRef !== original.id) throw new Error('TERMINAL_AUTOMATION_TDP_OWNER_STORE_MISMATCH');

    const binding = await readSelector(
      input.server,
      input.sessionId,
      'kernel.feature.store-basic.selectStoreBasicBinding',
      [],
    );
    assertStoreIdentity(binding, original.id);
    const currentStore = await readSelector(
      input.server,
      input.sessionId,
      'kernel.feature.store-basic.selectStore',
      [],
    );
    if (!isRecord(currentStore) || !isRecord(currentStore.value) || currentStore.value.id !== original.id) {
      throw new Error('TERMINAL_AUTOMATION_TDP_STORE_INITIAL_READBACK_MISMATCH');
    }

    storeObservation = await subscribeSelector(
      input.server,
      input.sessionId,
      'kernel.feature.store-basic.selectStore',
      [],
    );
    topicObservation = await subscribeSelector(
      input.server,
      input.sessionId,
      'kernel.feature.store-basic.selectStoreBasicTopicState',
      ['STORE'],
    );
    assertStoreTopicLoaded(topicObservation.current);
    process.stdout.write(
      `TERMINAL_AUTOMATION_TDP_STORE_CHANGE_STARTED runId=${input.runId} storeRef=${original.id} revision=${original.revision}\n`,
    );

    const changed = await operations.updateOperationsStore(ownerSession, original, {notes: marker});
    if (changed.notes !== marker || changed.revision !== original.revision + 1) {
      throw new Error('TERMINAL_AUTOMATION_TDP_CBS_UPDATE_MISMATCH');
    }
    const observed = await storeObservation.waitFor(value => {
      try {
        assertStoreFact(value, {storeRef: original!.id, notes: marker, updatedAt: changed.updatedAt});
        return true;
      } catch {
        return false;
      }
    });
    assertStoreFact(observed, {storeRef: original.id, notes: marker, updatedAt: changed.updatedAt});
    assertStoreTopicLoaded(
      await readSelector(input.server, input.sessionId, 'kernel.feature.store-basic.selectStoreBasicTopicState', [
        'STORE',
      ]),
    );
    const authoritative = await operations.operationsStore(ownerSession);
    if (
      authoritative.notes !== marker ||
      authoritative.revision !== changed.revision ||
      authoritative.updatedAt !== changed.updatedAt
    ) {
      throw new Error('TERMINAL_AUTOMATION_TDP_CBS_READBACK_MISMATCH');
    }
    process.stdout.write(
      `TERMINAL_AUTOMATION_TDP_STORE_CHANGE_CONFIRMED runId=${input.runId} revision=${changed.revision} updatedAt=${changed.updatedAt} selector=PASS\n`,
    );
  } catch (error) {
    failure = error;
  }

  const cleanupErrors: string[] = [];
  if (ownerSession !== undefined && original !== undefined) {
    try {
      const current = await operations.operationsStore(ownerSession);
      if (current.notes === marker) {
        const restored = await operations.updateOperationsStore(ownerSession, current, {notes: original.notes ?? null});
        const restoredOwner = await operations.operationsStore(ownerSession);
        if (restoredOwner.notes !== (original.notes ?? null) || restoredOwner.revision !== restored.revision) {
          cleanupErrors.push('CBS_READBACK_MISMATCH');
        }
        if (storeObservation !== undefined) {
          const selector = await storeObservation.waitFor(value => {
            try {
              assertStoreFact(value, {
                storeRef: original!.id,
                notes: original!.notes ?? null,
                updatedAt: restored.updatedAt,
              });
              return true;
            } catch {
              return false;
            }
          });
          assertStoreFact(selector, {
            storeRef: original.id,
            notes: original.notes ?? null,
            updatedAt: restored.updatedAt,
          });
        }
      } else if (current.notes !== (original.notes ?? null)) {
        cleanupErrors.push('STORE_CHANGED_OUTSIDE_THIS_RUN');
      }
    } catch {
      cleanupErrors.push('OWNER_RESTORE_FAILED');
    }
  }
  for (const observation of [topicObservation, storeObservation]) {
    if (observation === undefined) continue;
    try {
      await observation.close();
    } catch {
      cleanupErrors.push('SELECTOR_UNSUBSCRIBE_FAILED');
    }
  }
  if (cleanupErrors.length > 0) {
    process.stderr.write(`TERMINAL_AUTOMATION_TDP_STORE_CLEANUP_FAIL reasons=${cleanupErrors.join(',')}\n`);
    throw new Error(`TERMINAL_AUTOMATION_TDP_STORE_CLEANUP_FAILED:${cleanupErrors.join(',')}`);
  }
  process.stdout.write(`TERMINAL_AUTOMATION_TDP_STORE_CLEANUP_PASS runId=${input.runId}\n`);
  if (failure !== undefined) throw failure;
};
