import {defineActor, onCommand, selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import type {ActorDefinition, ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import type {UnknownAction} from '@reduxjs/toolkit';
import type {TransportHttpProxy, TransportServerConfig} from '@catering-v2s/kernel-base-contracts';
import {serverConfigSliceName} from '../slices/serverConfig';
import {clearServerOverrideCommand} from '../commands/clearServerOverride';
import {restoreServerDefaultsCommand} from '../commands/restoreServerDefaults';
import {selectServerConfigSpaceCommand} from '../commands/selectServerConfigSpace';
import {setServerOverrideCommand} from '../commands/setServerOverride';
import {validateHydratedServerConfigCommand} from '../commands/validateHydratedServerConfig';
import type {
  ProxyPasswordInput,
  ServerConfigOverrideState,
  ServerConfigState,
  SetServerOverridePayload,
} from '../../types/serverConfig';
import {
  defaultServiceNames,
  validateProxy,
  validateServerAddress,
  validateServerConfigDefaults,
} from '../../foundations/validateServerConfigDefaults';

type ServerConfigActions = Readonly<{
  replaceConfiguration: (state: ServerConfigState) => UnknownAction;
}>;

const invalid = (code: string): never => {
  throw new Error(`SERVER_CONFIG_${code}`);
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readState = (context: ActorExecutionContext): ServerConfigState => {
  const current = context.getState()[serverConfigSliceName];
  if (!isObject(current)) return invalid('STATE_MISSING');
  return current as unknown as ServerConfigState;
};

const requireMaster = (context: ActorExecutionContext): void => {
  if (selectRuntimeInstanceMode(context.getState()) !== 'MASTER') return invalid('HOST_ONLY');
};

const revise = (state: ServerConfigState, names: readonly string[]): Readonly<Record<string, number>> => {
  const revisions = {...state.serviceRevisions};
  for (const name of new Set(names)) revisions[name] = (revisions[name] ?? 0) + 1;
  return Object.freeze(revisions);
};

const persistenceOutcome = async (
  context: ActorExecutionContext,
  changed: boolean,
): Promise<'unchanged' | 'persisted' | 'failed' | 'unconfirmed'> => {
  if (!changed) return 'unchanged';
  const result = await context.flushPersistence();
  if (result.status === 'succeeded') return 'persisted';
  const sliceKey = `/${encodeURIComponent(serverConfigSliceName)}/`;
  return result.failures.some(failure => failure.storageKey?.includes(sliceKey)) ? 'failed' : 'unconfirmed';
};

const requireKnownService = (serverName: unknown, serviceNames: ReadonlySet<string>): string => {
  if (typeof serverName !== 'string' || !serviceNames.has(serverName)) return invalid('SERVICE_UNKNOWN');
  return serverName;
};

const normalizeAddresses = (value: unknown): SetServerOverridePayload['addresses'] => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 4) return invalid('OVERRIDE_ADDRESS_COUNT_INVALID');
  const names = new Set<string>();
  return Object.freeze(
    value.map(raw => {
      if (!isObject(raw)) return invalid('OVERRIDE_ADDRESS_INVALID');
      const addressName = raw.addressName;
      const baseUrl = raw.baseUrl;
      const timeoutMs = raw.timeoutMs;
      if (typeof addressName !== 'string' || typeof baseUrl !== 'string' || typeof timeoutMs !== 'number') {
        return invalid('OVERRIDE_ADDRESS_INVALID');
      }
      const address = Object.freeze({addressName, baseUrl, timeoutMs});
      validateServerAddress(address, true);
      if (names.has(addressName)) return invalid('OVERRIDE_ADDRESS_NAME_DUPLICATE');
      names.add(addressName);
      return address;
    }),
  );
};

const normalizeProxy = (
  raw: unknown,
  existingPassword: string | undefined,
): Readonly<{proxy: ServerConfigOverrideState['proxy']; password: string | null}> => {
  if (raw === null) return Object.freeze({proxy: null, password: null});
  if (!isObject(raw)) return invalid('PROXY_INVALID');
  const {protocol, host, port, username, password} = raw;
  if (protocol !== 'http' || typeof host !== 'string' || typeof port !== 'number') return invalid('PROXY_INVALID');
  if (username !== undefined && typeof username !== 'string') return invalid('PROXY_INVALID');
  if (!isObject(password)) return invalid('PROXY_PASSWORD_MODE_INVALID');
  const passwordInput = password as unknown as ProxyPasswordInput;
  let resolvedPassword: string | undefined;
  if (passwordInput.mode === 'set') {
    if (typeof passwordInput.value !== 'string') return invalid('PROXY_PASSWORD_INVALID');
    resolvedPassword = passwordInput.value;
  } else if (passwordInput.mode === 'keep') {
    if (existingPassword === undefined) return invalid('PROXY_PASSWORD_NOT_CONFIGURED');
    resolvedPassword = existingPassword;
  } else if (passwordInput.mode !== 'none') {
    return invalid('PROXY_PASSWORD_MODE_INVALID');
  }
  const proxy: Omit<TransportHttpProxy, 'password'> = Object.freeze({
    protocol,
    host,
    port,
    ...(username === undefined ? {} : {username}),
  });
  validateProxy(Object.freeze({...proxy, ...(resolvedPassword === undefined ? {} : {password: resolvedPassword})}));
  if (passwordInput.mode === 'none' && username !== undefined) return invalid('PROXY_CREDENTIALS_INVALID');
  return Object.freeze({proxy, password: resolvedPassword ?? null});
};

const normalizeSetPayload = (
  payload: unknown,
  state: ServerConfigState,
  serviceNames: ReadonlySet<string>,
): Readonly<{serverName: string; override: ServerConfigOverrideState; password: string | null}> => {
  if (!isObject(payload)) return invalid('OVERRIDE_INVALID');
  const serverName = requireKnownService(payload.serverName, serviceNames);
  const addresses = normalizeAddresses(payload.addresses);
  const currentPassword = state.proxyPasswords[serverName];
  const normalizedProxy = normalizeProxy(payload.proxy, currentPassword);
  const override = Object.freeze({addresses, proxy: normalizedProxy.proxy});
  return Object.freeze({serverName, override, password: normalizedProxy.password});
};

const normalizeHydratedProxy = (
  raw: unknown,
  rawSecret: unknown,
): Readonly<{proxy: ServerConfigOverrideState['proxy']; password?: string}> => {
  if (raw === null) return Object.freeze({proxy: null});
  if (!isObject(raw)) throw new Error('invalid');
  const username = raw.username;
  const secret = rawSecret;
  if (raw.protocol !== 'http' || typeof raw.host !== 'string' || typeof raw.port !== 'number')
    throw new Error('invalid');
  if (username !== undefined && typeof username !== 'string') throw new Error('invalid');
  if (secret !== undefined && typeof secret !== 'string') throw new Error('invalid');
  if (username !== undefined && (secret === undefined || secret.length === 0)) throw new Error('invalid');
  if (username === undefined && secret !== undefined) throw new Error('invalid');
  const candidate: TransportHttpProxy = Object.freeze({
    protocol: 'http',
    host: raw.host,
    port: raw.port,
    ...(username === undefined ? {} : {username}),
    ...(secret === undefined ? {} : {password: secret}),
  });
  validateProxy(candidate);
  const proxy = Object.freeze({
    protocol: 'http' as const,
    host: raw.host,
    port: raw.port,
    ...(username === undefined ? {} : {username}),
  });
  return Object.freeze({proxy, ...(secret === undefined ? {} : {password: secret})});
};

const normalizeHydratedOverride = (
  raw: unknown,
  rawSecret: unknown,
): Readonly<{override: ServerConfigOverrideState; password?: string}> => {
  if (!isObject(raw)) throw new Error('invalid');
  const addresses = normalizeAddresses(raw.addresses);
  const normalizedProxy = normalizeHydratedProxy(raw.proxy, rawSecret);
  return Object.freeze({
    override: Object.freeze({addresses, proxy: normalizedProxy.proxy}),
    ...(normalizedProxy.password === undefined ? {} : {password: normalizedProxy.password}),
  });
};

const normalizedHydratedState = (
  current: ServerConfigState,
  defaults: TransportServerConfig,
  serviceNames: readonly string[],
): Readonly<{state: ServerConfigState; droppedOverrideCount: number; selectedSpaceReset: boolean}> => {
  let syncedHostDefaults: TransportServerConfig | null = null;
  if (current.syncedHostDefaults !== null) {
    try {
      validateServerConfigDefaults(current.syncedHostDefaults);
      syncedHostDefaults = current.syncedHostDefaults;
    } catch {
      syncedHostDefaults = null;
    }
  }
  const effectiveDefaults = syncedHostDefaults ?? defaults;
  const effectiveServiceNames = defaultServiceNames(effectiveDefaults);
  const validSpaces = new Set(effectiveDefaults.spaces.map(space => space.name));
  const selectedSpaceReset = !validSpaces.has(current.selectedSpace);
  const selectedSpace = selectedSpaceReset ? effectiveDefaults.selectedSpace : current.selectedSpace;
  const overrides: Record<string, ServerConfigOverrideState> = {};
  const proxyPasswords: Record<string, string> = {};
  let droppedOverrideCount = 0;
  const currentOverrides = isObject(current.overrides) ? current.overrides : {};
  const currentPasswords = isObject(current.proxyPasswords) ? current.proxyPasswords : {};
  const knownServices = new Set(effectiveServiceNames.length > 0 ? effectiveServiceNames : serviceNames);

  for (const [serverName, raw] of Object.entries(currentOverrides)) {
    try {
      if (!knownServices.has(serverName)) throw new Error('invalid');
      const normalized = normalizeHydratedOverride(raw, currentPasswords[serverName]);
      overrides[serverName] = normalized.override;
      if (normalized.password !== undefined) proxyPasswords[serverName] = normalized.password;
    } catch {
      droppedOverrideCount += 1;
    }
  }
  const revisions = Object.fromEntries(
    serviceNames.map(name => [
      name,
      Number.isSafeInteger(current.serviceRevisions?.[name]) && current.serviceRevisions[name] >= 0
        ? current.serviceRevisions[name]
        : 0,
    ]),
  );
  return Object.freeze({
    state: Object.freeze({
      selectedSpace,
      overrides: Object.freeze(overrides),
      proxyPasswords: Object.freeze(proxyPasswords),
      syncedHostDefaults,
      serviceRevisions: Object.freeze(revisions),
    }),
    droppedOverrideCount,
    selectedSpaceReset,
  });
};

export const createServerConfigActor = (
  defaults: TransportServerConfig,
  actions: ServerConfigActions,
): ActorDefinition => {
  const serviceNames = [
    ...new Set(defaults.spaces.flatMap(space => space.servers.map(server => server.serverName))),
  ].sort();
  const serviceNameSet = new Set(serviceNames);
  return defineActor('kernel.base.server-config', 'configuration-owner', [
    onCommand(selectServerConfigSpaceCommand, async context => {
      requireMaster(context);
      const state = readState(context);
      const spaceName = context.command.payload.spaceName;
      if (typeof spaceName !== 'string' || !defaults.spaces.some(space => space.name === spaceName)) {
        return invalid('SPACE_UNKNOWN');
      }
      if (state.selectedSpace === spaceName)
        return Object.freeze({changed: false, selectedSpace: spaceName, persistence: 'unchanged'});
      context.dispatchAction(
        actions.replaceConfiguration(
          Object.freeze({
            ...state,
            selectedSpace: spaceName,
            serviceRevisions: revise(state, serviceNames),
          }),
        ),
      );
      return Object.freeze({
        changed: true,
        selectedSpace: spaceName,
        persistence: await persistenceOutcome(context, true),
      });
    }),
    onCommand(setServerOverrideCommand, async context => {
      requireMaster(context);
      const state = readState(context);
      const parsed = normalizeSetPayload(context.command.payload, state, serviceNameSet);
      const currentOverride = state.overrides[parsed.serverName];
      const currentPassword = state.proxyPasswords[parsed.serverName];
      if (
        JSON.stringify(currentOverride) === JSON.stringify(parsed.override) &&
        currentPassword === (parsed.password ?? undefined)
      ) {
        return Object.freeze({changed: false, serverName: parsed.serverName, persistence: 'unchanged'});
      }
      const nextOverrides = {...state.overrides, [parsed.serverName]: parsed.override};
      const nextPasswords = {...state.proxyPasswords};
      if (parsed.password === null) Reflect.deleteProperty(nextPasswords, parsed.serverName);
      else nextPasswords[parsed.serverName] = parsed.password;
      const nextState = Object.freeze({
        ...state,
        overrides: Object.freeze(nextOverrides),
        proxyPasswords: Object.freeze(nextPasswords),
        syncedHostDefaults: state.syncedHostDefaults,
        serviceRevisions: revise(state, [parsed.serverName]),
      });
      context.dispatchAction(actions.replaceConfiguration(nextState));
      return Object.freeze({
        changed: true,
        serverName: parsed.serverName,
        persistence: await persistenceOutcome(context, true),
      });
    }),
    onCommand(clearServerOverrideCommand, async context => {
      requireMaster(context);
      const state = readState(context);
      const serverName = requireKnownService(context.command.payload.serverName, serviceNameSet);
      if (state.overrides[serverName] === undefined && state.proxyPasswords[serverName] === undefined) {
        return Object.freeze({changed: false, serverName, persistence: 'unchanged'});
      }
      const overrides = {...state.overrides};
      const proxyPasswords = {...state.proxyPasswords};
      Reflect.deleteProperty(overrides, serverName);
      Reflect.deleteProperty(proxyPasswords, serverName);
      context.dispatchAction(
        actions.replaceConfiguration(
          Object.freeze({
            ...state,
            overrides: Object.freeze(overrides),
            proxyPasswords: Object.freeze(proxyPasswords),
            syncedHostDefaults: state.syncedHostDefaults,
            serviceRevisions: revise(state, [serverName]),
          }),
        ),
      );
      return Object.freeze({changed: true, serverName, persistence: await persistenceOutcome(context, true)});
    }),
    onCommand(restoreServerDefaultsCommand, async context => {
      requireMaster(context);
      const state = readState(context);
      const hasChanges =
        state.selectedSpace !== defaults.selectedSpace ||
        Object.keys(state.overrides).length > 0 ||
        Object.keys(state.proxyPasswords).length > 0;
      if (!hasChanges) return Object.freeze({changed: false, persistence: 'unchanged'});
      context.dispatchAction(
        actions.replaceConfiguration(
          Object.freeze({
            selectedSpace: defaults.selectedSpace,
            overrides: Object.freeze({}),
            proxyPasswords: Object.freeze({}),
            syncedHostDefaults: null,
            serviceRevisions: revise(state, serviceNames),
          }),
        ),
      );
      return Object.freeze({changed: true, persistence: await persistenceOutcome(context, true)});
    }),
    onCommand(validateHydratedServerConfigCommand, context => {
      const current = readState(context);
      const normalized = normalizedHydratedState(current, defaults, serviceNames);
      const changed =
        normalized.selectedSpaceReset ||
        normalized.droppedOverrideCount > 0 ||
        JSON.stringify(current.overrides) !== JSON.stringify(normalized.state.overrides) ||
        JSON.stringify(current.proxyPasswords) !== JSON.stringify(normalized.state.proxyPasswords);
      if (changed) context.dispatchAction(actions.replaceConfiguration(normalized.state));
      if (normalized.selectedSpaceReset || normalized.droppedOverrideCount > 0) {
        context.platformPorts.logger
          .withContext({commandId: context.command.commandId, commandName: context.command.commandName})
          .warn({
            category: 'server-config.hydration',
            event: 'server-config.hydration.invalid-values-reset',
            message: 'Invalid persisted server configuration was discarded or reset to defaults',
            data: {
              selectedSpaceReset: normalized.selectedSpaceReset,
              droppedOverrideCount: normalized.droppedOverrideCount,
            },
          });
      }
      return Object.freeze({
        changed,
        selectedSpaceReset: normalized.selectedSpaceReset,
        droppedOverrideCount: normalized.droppedOverrideCount,
      });
    }),
  ]);
};
