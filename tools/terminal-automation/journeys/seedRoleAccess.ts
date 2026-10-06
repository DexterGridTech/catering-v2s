import {randomUUID} from 'node:crypto';
import {
  httpJson,
  type OperationsFixtureHttpJson,
} from '../../../apps/terminal/kernel/base/terminal-data-client/acceptance/operationsFixture.ts';

const roleName = '项目运营负责人';
const requiredPageAccess = 'PG-ORG-STORE-MANAGE';
const requiredCapability = 'BC-ORG-STORE-EDIT';

const rolePath = (workspaceKey: string): string => `/api/platform/group-workspaces/${encodeURIComponent(workspaceKey)}/roles`;

export const ensureSeedProjectStoreEditPermission = async (
  input: Readonly<{
    readonly httpBaseUrl: string;
    readonly workspaceKey: string;
    readonly platformRootPassword: string;
    readonly requestJson?: OperationsFixtureHttpJson;
  }>,
): Promise<'ALREADY_PRESENT' | 'ADDED'> => {
  const send = input.requestJson ?? httpJson;
  const login = await send(input.httpBaseUrl, '/api/platform/auth/password-login', {
    method: 'POST',
    headers: {'Idempotency-Key': randomUUID()},
    body: {accountName: 'root', password: input.platformRootPassword},
  });
  if (login.status !== 200) throw new Error(`TERMINAL_AUTOMATION_PLATFORM_LOGIN_FAILED:${login.status}`);
  const setCookie = login.headers['set-cookie'];
  const cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie)?.split(';', 1)[0];
  if (!cookie) throw new Error('TERMINAL_AUTOMATION_PLATFORM_COOKIE_MISSING');

  const path = rolePath(input.workspaceKey);
  const roles = await send(input.httpBaseUrl, `${path}?organizationType=PROJECT&status=ENABLED&page=1&pageSize=100`, {
    headers: {cookie},
  });
  if (roles.status !== 200 || !Array.isArray(roles.body?.items)) {
    throw new Error(`TERMINAL_AUTOMATION_PLATFORM_ROLE_READ_FAILED:${roles.status}`);
  }
  const matches = roles.body.items.filter(
    (role: {name?: string; serviceNodeType?: string}) =>
      role.name === roleName && role.serviceNodeType === 'PROJECT',
  );
  if (matches.length !== 1) throw new Error('TERMINAL_AUTOMATION_SEED_PROJECT_ROLE_NOT_UNIQUE');
  const role = matches[0] as {
    id?: string;
    name?: string;
    description?: string | null;
    status?: string;
    revision?: number;
    capabilityKeys?: unknown;
    pageAccessKeys?: unknown;
  };
  if (
    typeof role.id !== 'string' ||
    role.name !== roleName ||
    role.status !== 'ENABLED' ||
    !Number.isInteger(role.revision) ||
    !Array.isArray(role.capabilityKeys) ||
    !role.capabilityKeys.every(value => typeof value === 'string') ||
    !Array.isArray(role.pageAccessKeys) ||
    !role.pageAccessKeys.every(value => typeof value === 'string')
  ) {
    throw new Error('TERMINAL_AUTOMATION_SEED_PROJECT_ROLE_INVALID');
  }
  const capabilityKeys = new Set(role.capabilityKeys as string[]);
  const pageAccessKeys = new Set(role.pageAccessKeys as string[]);
  if (capabilityKeys.has(requiredCapability) && pageAccessKeys.has(requiredPageAccess)) return 'ALREADY_PRESENT';
  capabilityKeys.add(requiredCapability);
  pageAccessKeys.add(requiredPageAccess);

  const updated = await send(input.httpBaseUrl, `${path}/${encodeURIComponent(role.id)}`, {
    method: 'PATCH',
    headers: {cookie, 'Idempotency-Key': randomUUID()},
    body: {
      name: role.name,
      description: role.description ?? null,
      capabilityKeys: [...capabilityKeys],
      pageAccessKeys: [...pageAccessKeys],
      expectedVersion: role.revision,
    },
  });
  if (updated.status !== 200) throw new Error(`TERMINAL_AUTOMATION_SEED_PROJECT_ROLE_UPDATE_FAILED:${updated.status}`);
  if (
    !updated.body?.capabilityKeys?.includes(requiredCapability) ||
    !updated.body?.pageAccessKeys?.includes(requiredPageAccess)
  ) {
    throw new Error('TERMINAL_AUTOMATION_SEED_PROJECT_ROLE_UPDATE_READBACK_MISMATCH');
  }
  return 'ADDED';
};
