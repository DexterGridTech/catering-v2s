import {describe, expect, it, vi} from 'vitest';
import {ensureSeedProjectStoreEditPermission} from '../journeys/seedRoleAccess.js';
import type {OperationsFixtureHttpJson} from '../../../apps/terminal/kernel/base/terminal-data-client/acceptance/operationsFixture.ts';

const existingRole = {
  id: 'role-id',
  name: '项目运营负责人',
  description: null,
  serviceNodeType: 'PROJECT',
  status: 'ENABLED',
  revision: 7,
  capabilityKeys: ['BC-IAM-PROJECT-INVITE'],
  pageAccessKeys: ['PG-IAM-PROJECT-USERS'],
};

describe('ensureSeedProjectStoreEditPermission', () => {
  it('uses the platform owner API and preserves existing grants while adding only the seeded permission', async () => {
    const send = vi
      .fn<OperationsFixtureHttpJson>()
      .mockResolvedValueOnce({status: 200, headers: {'set-cookie': 'SESSION=opaque; HttpOnly'}, body: {}})
      .mockResolvedValueOnce({status: 200, headers: {}, body: {items: [existingRole]}})
      .mockResolvedValueOnce({
        status: 200,
        headers: {},
        body: {
          capabilityKeys: ['BC-IAM-PROJECT-INVITE', 'BC-ORG-STORE-EDIT'],
          pageAccessKeys: ['PG-IAM-PROJECT-USERS', 'PG-ORG-STORE-MANAGE'],
        },
      });

    await expect(
      ensureSeedProjectStoreEditPermission({
        httpBaseUrl: 'http://127.0.0.1:28080',
        workspaceKey: 'aurora',
        platformRootPassword: 'secret-not-logged',
        requestJson: send,
      }),
    ).resolves.toBe('ADDED');
    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls[0]?.[1]).toBe('/api/platform/auth/password-login');
    expect(send.mock.calls[0]?.[2]?.headers?.['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/u);
    expect(send.mock.calls[1]?.[1]).toBe(
      '/api/platform/group-workspaces/aurora/roles?organizationType=PROJECT&status=ENABLED&page=1&pageSize=100',
    );
    expect(send.mock.calls[2]?.[1]).toBe('/api/platform/group-workspaces/aurora/roles/role-id');
    expect(send.mock.calls[2]?.[2]?.body).toMatchObject({
      capabilityKeys: ['BC-IAM-PROJECT-INVITE', 'BC-ORG-STORE-EDIT'],
      pageAccessKeys: ['PG-IAM-PROJECT-USERS', 'PG-ORG-STORE-MANAGE'],
      expectedVersion: 7,
    });
    expect(send.mock.calls[2]?.[2]?.body).not.toHaveProperty('status');
  });

  it('does not update a role that already matches the fixed seed permissions', async () => {
    const send = vi
      .fn<OperationsFixtureHttpJson>()
      .mockResolvedValueOnce({status: 200, headers: {'set-cookie': 'SESSION=opaque; HttpOnly'}, body: {}})
      .mockResolvedValueOnce({
        status: 200,
        headers: {},
        body: {
          items: [
            {
              ...existingRole,
              capabilityKeys: [...existingRole.capabilityKeys, 'BC-ORG-STORE-EDIT'],
              pageAccessKeys: [...existingRole.pageAccessKeys, 'PG-ORG-STORE-MANAGE'],
            },
          ],
        },
      });

    await expect(
      ensureSeedProjectStoreEditPermission({
        httpBaseUrl: 'http://127.0.0.1:28080',
        workspaceKey: 'aurora',
        platformRootPassword: 'secret-not-logged',
        requestJson: send,
      }),
    ).resolves.toBe('ALREADY_PRESENT');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('fails closed when the seed project role is ambiguous', async () => {
    const send = vi
      .fn<OperationsFixtureHttpJson>()
      .mockResolvedValueOnce({status: 200, headers: {'set-cookie': 'SESSION=opaque; HttpOnly'}, body: {}})
      .mockResolvedValueOnce({status: 200, headers: {}, body: {items: [existingRole, existingRole]}});

    await expect(
      ensureSeedProjectStoreEditPermission({
        httpBaseUrl: 'http://127.0.0.1:28080',
        workspaceKey: 'aurora',
        platformRootPassword: 'secret-not-logged',
        requestJson: send,
      }),
    ).rejects.toThrow('TERMINAL_AUTOMATION_SEED_PROJECT_ROLE_NOT_UNIQUE');
    expect(send).toHaveBeenCalledTimes(2);
  });
});
