import {beforeEach, describe, expect, it, vi} from 'vitest';
import {OPERATIONS_ADMIN_OPERATION_IDS, type StoreTerminalDetail} from '../../../app/api/generated/operations-edge';
import {operationsClient} from '../../../app/api/OperationsTransport';
import {createStoreTerminal, replaceStoreTerminal} from './storeTerminalCommands';
import type {StoreTerminalCreateFormValues, StoreTerminalEditFormValues} from './storeTerminalModel';

const testState = vi.hoisted(() => ({
  createContentIdempotencyKey: vi.fn(async () => 'content-key'),
  post: vi.fn(async () => ({terminalRef: '11111111-1111-4111-8111-111111111111'})),
  put: vi.fn(async () => ({terminalRef: '11111111-1111-4111-8111-111111111111'})),
}));

vi.mock('@catering-v2s/admin-ui-foundation', async importOriginal => ({
  ...(await importOriginal<typeof import('@catering-v2s/admin-ui-foundation')>()),
  createContentIdempotencyKey: testState.createContentIdempotencyKey,
}));

vi.mock('../../../app/api/OperationsTransport', () => ({
  operationsClient: {
    postOperationsStoreTerminal: testState.post,
    putOperationsStoreTerminal: testState.put,
  },
}));

const storeRef = '22222222-2222-4222-8222-222222222222';
const terminalRef = '11111111-1111-4111-8111-111111111111';
const context = {groupWorkspaceKey: 'workspace', storeRef};
const terminal = {
  terminalRef,
  name: '既有终端',
  deviceType: 'laptop',
  version: 4,
} as StoreTerminalDetail;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('store terminal commands', () => {
  it('keeps device type only in create requests and omits it from update and idempotency requests', async () => {
    const createValues: StoreTerminalCreateFormValues = {
      name: ' 新终端 ',
      deviceType: 'laptop',
      activationCode: '',
      printers: [],
      functions: [],
    };
    const editValues: StoreTerminalEditFormValues = {
      name: ' 编辑后的终端 ',
      printers: [],
      functions: [],
    };

    await createStoreTerminal(context, createValues, 'drawer-key');
    const createRequest = vi.mocked(operationsClient.postOperationsStoreTerminal).mock.calls[0]?.[1];
    expect(createRequest?.body).toMatchObject({name: '新终端', deviceType: 'laptop', configuration: {}});

    await replaceStoreTerminal(context, terminal, editValues);
    const updateRequest = vi.mocked(operationsClient.putOperationsStoreTerminal).mock.calls[0]?.[1];
    expect(updateRequest?.body).toMatchObject({
      name: '编辑后的终端',
      configuration: {printers: [], functions: []},
      expectedVersion: 4,
    });
    expect(updateRequest?.body).not.toHaveProperty('deviceType');
    expect(testState.createContentIdempotencyKey).toHaveBeenCalledWith(
      OPERATIONS_ADMIN_OPERATION_IDS.putOperationsStoreTerminal,
      expect.objectContaining({body: expect.not.objectContaining({deviceType: expect.anything()})}),
    );
  });
});
