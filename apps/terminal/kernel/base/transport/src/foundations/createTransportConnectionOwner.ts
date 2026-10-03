import type {TransportServerAddress} from '@catering-v2s/kernel-base-contracts';
import type {
  TransportConnection,
  TransportConnectionEvent,
  TransportHttpExecutionResult,
  TransportHttpRequest,
  TransportManagedConnection,
  TransportNetworkAdapter,
  TransportReconnectPolicy,
  TransportNetworkSnapshot,
  TransportStartInput,
} from '../types/runtimeControl';

type Timer = () => void;
type DispatchInternal = (kind: 'retry' | 'ready-timeout' | 'stable', profileId: string, token: number) => void;
type Diagnostic = (
  event: string,
  profileId: string,
  data?: Readonly<Record<string, string | number | boolean | null>>,
) => void;

type Profile = {
  readonly profileId: string;
  serverName: string;
  endpointPathAndQuery?: string;
  reconnectPolicy: TransportReconnectPolicy;
  stopped: boolean;
  inAttempt: boolean;
  isReady: boolean;
  networkConnected: boolean | undefined;
  waitingForNetwork: boolean;
  recoveredDuringAttempt: boolean;
  attemptToken: number;
  connectionToken: number;
  reconnectNumber: number;
  lastAttemptStartedAt: number;
  preferredAddressName?: string;
  nextAddressIndex: number;
  snapshotRevision?: number;
  addresses: readonly TransportServerAddress[];
  currentAddress?: TransportServerAddress;
  connection?: TransportManagedConnection;
  unsubscribeConnection?: () => void;
  retryTimer?: Timer;
  readyTimer?: Timer;
  stableTimer?: Timer;
};

export type TransportConnectionOwner = Readonly<{
  readonly start: (input: TransportStartInput) => Promise<void>;
  readonly executeHttp: (request: TransportHttpRequest) => Promise<TransportHttpExecutionResult>;
  readonly reportHttpAddressAvailable: (
    input: Readonly<{profileId: string; serverName: string; addressName: string; configRevision: number}>,
  ) => void;
  readonly ready: (profileId: string, stableAfterMs: number) => void;
  readonly invalid: (profileId: string, cause: string) => Promise<void>;
  readonly stop: (profileId: string) => Promise<void>;
  readonly networkStatusChanged: (connected: boolean) => void;
  readonly retryDue: (profileId: string, token: number) => Promise<void>;
  readonly readyTimeout: (profileId: string, token: number) => Promise<void>;
  readonly stablePeriodElapsed: (profileId: string, token: number) => void;
  readonly connectionFor: (profileId: string) => TransportConnection;
  readonly subscribe: (profileId: string, listener: (event: TransportConnectionEvent) => void) => () => void;
  readonly dispose: () => Promise<void>;
}>;

const reorderPreferred = (
  addresses: readonly TransportServerAddress[],
  preferredAddressName: string | undefined,
): readonly TransportServerAddress[] => {
  if (preferredAddressName === undefined) return addresses;
  const preferredIndex = addresses.findIndex(address => address.addressName === preferredAddressName);
  return preferredIndex < 0
    ? addresses
    : [addresses[preferredIndex]!, ...addresses.filter((_, index) => index !== preferredIndex)];
};

export const transportReconnectDelayMs = (
  reconnectNumber: number,
  samples: Readonly<{jitter: number; cap: number}>,
  policy: TransportReconnectPolicy,
): number => {
  const baseDelayMs = Math.min(
    policy.initialDelayMs + Math.max(0, reconnectNumber - 1) * policy.incrementMs,
    policy.maximumDelayMs,
  );
  const jitter = Math.max(0, Math.min(1, samples.jitter));
  const withJitter = baseDelayMs * (1 + jitter * policy.maximumJitterRatio);
  const capJitter = Math.max(0, Math.min(1, samples.cap));
  const cappedFloorMs = policy.maximumDelayMs * policy.cappedDelayFloorRatio;
  return Math.round(
    withJitter <= policy.maximumDelayMs
      ? withJitter
      : cappedFloorMs + capJitter * (policy.maximumDelayMs - cappedFloorMs),
  );
};

const validatePolicy = (policy: TransportReconnectPolicy): void => {
  const positive = [
    policy.initialDelayMs,
    policy.incrementMs,
    policy.maximumDelayMs,
    policy.readyTimeoutMs,
    policy.networkRecoveryMinimumIntervalMs,
  ];
  if (
    positive.some(value => !Number.isFinite(value) || value <= 0) ||
    !Number.isFinite(policy.maximumJitterRatio) ||
    policy.maximumJitterRatio < 0 ||
    !Number.isFinite(policy.cappedDelayFloorRatio) ||
    policy.cappedDelayFloorRatio < 0 ||
    policy.cappedDelayFloorRatio > 1 ||
    policy.initialDelayMs > policy.maximumDelayMs
  ) {
    throw new Error('TRANSPORT_RECONNECT_POLICY_INVALID');
  }
};

const validateEndpointPathAndQuery = (value: string | undefined): void => {
  const hasControlCharacter = value !== undefined && [...value].some(character => character.charCodeAt(0) <= 0x1f);
  if (
    value !== undefined &&
    (!value.startsWith('/') ||
      value.startsWith('//') ||
      value.includes(String.fromCharCode(92)) ||
      value.includes('#') ||
      hasControlCharacter ||
      value.includes('://'))
  ) {
    throw new Error('TRANSPORT_ENDPOINT_PATH_INVALID');
  }
};

export const createTransportConnectionOwner = (
  input: Readonly<{
    readonly adapter?: TransportNetworkAdapter;
    readonly now?: () => number;
    readonly random?: () => number;
    readonly schedule?: (delayMs: number, callback: () => void) => () => void;
    readonly dispatchInternal: DispatchInternal;
    readonly diagnose?: Diagnostic;
  }>,
): TransportConnectionOwner => {
  const now = input.now ?? (() => Date.now());
  const random = input.random ?? Math.random;
  const schedule =
    input.schedule ??
    ((delayMs, callback) => {
      const handle = setTimeout(callback, delayMs);
      return () => clearTimeout(handle);
    });
  const profiles = new Map<string, Profile>();
  const listeners = new Map<string, Set<(event: TransportConnectionEvent) => void>>();
  const httpPreferred = new Map<string, Readonly<{addressName: string; revision: number}>>();

  const profileFor = (profileId: string): Profile => {
    const profile = profiles.get(profileId);
    if (profile === undefined) throw new Error(`TRANSPORT_PROFILE_NOT_STARTED:${profileId}`);
    return profile;
  };
  const publish = (profileId: string, event: TransportConnectionEvent): void => {
    for (const listener of listeners.get(profileId) ?? []) listener(event);
  };
  const cancelTimer = (profile: Profile, kind: 'retryTimer' | 'readyTimer' | 'stableTimer'): void => {
    const timer = profile[kind];
    timer?.();
    profile[kind] = undefined;
  };
  const cancelAllTimers = (profile: Profile): void => {
    cancelTimer(profile, 'retryTimer');
    cancelTimer(profile, 'readyTimer');
    cancelTimer(profile, 'stableTimer');
  };
  const detachConnection = async (profile: Profile, reason: string): Promise<void> => {
    const connection = profile.connection;
    const unsubscribe = profile.unsubscribeConnection;
    profile.unsubscribeConnection = undefined;
    unsubscribe?.();
    if (connection === undefined) return;
    await connection.close(reason);
    if (profile.connection === connection) profile.connection = undefined;
  };
  const scheduleRetry = (profile: Profile, expediteFromNetwork = false): void => {
    if (profile.stopped) return;
    if (profile.networkConnected === false) {
      profile.waitingForNetwork = true;
      return;
    }
    cancelTimer(profile, 'retryTimer');
    profile.reconnectNumber += 1;
    const jitterSample = random();
    const policy = profile.reconnectPolicy;
    const uncapped =
      Math.min(
        policy.initialDelayMs + Math.max(0, profile.reconnectNumber - 1) * policy.incrementMs,
        policy.maximumDelayMs,
      ) *
      (1 + Math.max(0, Math.min(1, jitterSample)) * policy.maximumJitterRatio);
    const capSample = uncapped > policy.maximumDelayMs ? random() : jitterSample;
    const regularDelayMs = transportReconnectDelayMs(
      profile.reconnectNumber,
      {jitter: jitterSample, cap: capSample},
      policy,
    );
    const earliestNetworkAttemptMs = Math.max(
      0,
      policy.networkRecoveryMinimumIntervalMs - (now() - profile.lastAttemptStartedAt),
    );
    const delayMs = expediteFromNetwork ? Math.min(regularDelayMs, earliestNetworkAttemptMs) : regularDelayMs;
    const token = ++profile.attemptToken;
    profile.retryTimer = schedule(delayMs, () => input.dispatchInternal('retry', profile.profileId, token));
    input.diagnose?.('retry-scheduled', profile.profileId, {
      reconnectNumber: profile.reconnectNumber,
      delayMs,
      networkExpedited: expediteFromNetwork,
    });
  };
  const connectCandidate = async (
    candidate: Readonly<{
      adapter: TransportNetworkAdapter;
      profile: Profile;
      snapshot: TransportNetworkSnapshot;
      address: TransportServerAddress;
      attemptToken: number;
      connectionToken: number;
    }>,
  ): Promise<'opened' | 'stale' | 'failed'> => {
    const {adapter, profile, snapshot, address, attemptToken, connectionToken} = candidate;
    let connection: TransportManagedConnection;
    try {
      connection = await adapter.connect({
        profileId: profile.profileId,
        address,
        ...(profile.endpointPathAndQuery === undefined ? {} : {endpointPathAndQuery: profile.endpointPathAndQuery}),
        ...(snapshot.proxy === undefined ? {} : {proxy: snapshot.proxy}),
        connectionToken,
      });
    } catch {
      const addressIndex = snapshot.addresses.findIndex(item => item.addressName === address.addressName);
      profile.nextAddressIndex = (Math.max(0, addressIndex) + 1) % snapshot.addresses.length;
      return 'failed';
    }
    if (profile.stopped || profile.attemptToken !== attemptToken) {
      await connection.close('stale transport attempt');
      return 'stale';
    }
    profile.connection = connection;
    profile.currentAddress = address;
    profile.isReady = false;
    profile.inAttempt = false;
    const addressIndex = snapshot.addresses.findIndex(item => item.addressName === address.addressName);
    profile.nextAddressIndex = (Math.max(0, addressIndex) + 1) % snapshot.addresses.length;
    profile.unsubscribeConnection = connection.subscribe(event => {
      if (profile.connectionToken !== connectionToken || profile.connection !== connection || profile.stopped) return;
      // connect() resolves only after the adapter has established the socket. Normalize
      // that lifecycle edge here so an adapter's queued native `open` cannot be replayed
      // alongside the owner-generated open signal (which would make protocol owners send
      // their initial frame twice after every reconnect).
      if (event.type === 'open') return;
      publish(profile.profileId, event);
    });
    publish(profile.profileId, Object.freeze({type: 'open', addressName: address.addressName}));
    const readyToken = ++profile.attemptToken;
    profile.readyTimer = schedule(profile.reconnectPolicy.readyTimeoutMs, () =>
      input.dispatchInternal('ready-timeout', profile.profileId, readyToken),
    );
    input.diagnose?.('socket-opened', profile.profileId, {
      addressName: address.addressName,
      revision: snapshot.revision,
    });
    return 'opened';
  };
  const runAttempt = async (profile: Profile): Promise<void> => {
    if (profile.stopped || profile.inAttempt || profile.networkConnected === false) return;
    const adapter = input.adapter;
    if (adapter === undefined) throw new Error('TRANSPORT_NETWORK_ADAPTER_UNAVAILABLE');
    profile.inAttempt = true;
    profile.recoveredDuringAttempt = false;
    profile.lastAttemptStartedAt = now();
    profile.attemptToken += 1;
    const attemptToken = profile.attemptToken;
    const connectionToken = ++profile.connectionToken;
    try {
      const snapshot = await adapter.readSnapshot(profile.serverName);
      if (snapshot.serverName !== profile.serverName || snapshot.addresses.length === 0) {
        throw new Error('TRANSPORT_NETWORK_SNAPSHOT_INVALID');
      }
      if (profile.snapshotRevision !== undefined && profile.snapshotRevision !== snapshot.revision) {
        profile.preferredAddressName = undefined;
        profile.nextAddressIndex = 0;
      }
      profile.snapshotRevision = snapshot.revision;
      profile.addresses = snapshot.addresses;
      const ordered = reorderPreferred(snapshot.addresses, profile.preferredAddressName);
      const preferredOffset =
        profile.preferredAddressName === undefined
          ? -1
          : ordered.findIndex(address => address.addressName === profile.preferredAddressName);
      const startAt =
        profile.preferredAddressName !== undefined && preferredOffset === 0
          ? 0
          : Math.min(profile.nextAddressIndex, Math.max(0, ordered.length - 1));
      const candidates = [...ordered.slice(startAt), ...ordered.slice(0, startAt)];
      for (const address of candidates) {
        if (profile.stopped || profile.attemptToken !== attemptToken) return;
        const result = await connectCandidate({adapter, profile, snapshot, address, attemptToken, connectionToken});
        if (result !== 'failed') return;
      }
      profile.inAttempt = false;
      profile.preferredAddressName = undefined;
      publish(profile.profileId, Object.freeze({type: 'error', reason: 'NETWORK_ERROR'}));
      scheduleRetry(profile, profile.recoveredDuringAttempt);
      input.diagnose?.('connect-attempt-failed', profile.profileId, {candidateCount: snapshot.addresses.length});
    } catch {
      profile.inAttempt = false;
      profile.preferredAddressName = undefined;
      publish(profile.profileId, Object.freeze({type: 'error', reason: 'NETWORK_ERROR'}));
      scheduleRetry(profile, profile.recoveredDuringAttempt);
      input.diagnose?.('connect-attempt-failed', profile.profileId, {candidateCount: profile.addresses.length});
    }
  };
  const invalidate = async (profile: Profile, cause: string): Promise<void> => {
    if (profile.stopped || (profile.connection === undefined && !profile.inAttempt)) return;
    const wasReady = profile.isReady;
    profile.attemptToken += 1;
    cancelTimer(profile, 'readyTimer');
    cancelTimer(profile, 'stableTimer');
    await detachConnection(profile, cause);
    profile.isReady = false;
    profile.inAttempt = false;
    if (!wasReady && profile.currentAddress !== undefined && profile.addresses.length > 0) {
      const currentIndex = profile.addresses.findIndex(
        address => address.addressName === profile.currentAddress?.addressName,
      );
      profile.nextAddressIndex = (Math.max(0, currentIndex) + 1) % profile.addresses.length;
      profile.preferredAddressName = undefined;
    }
    scheduleRetry(profile, profile.recoveredDuringAttempt);
    input.diagnose?.('connection-invalidated', profile.profileId, {cause, wasReady});
  };
  const httpKey = (profileId: string, serverName: string): string => `${profileId}\u0000${serverName}`;

  return Object.freeze({
    executeHttp: async (request): Promise<TransportHttpExecutionResult> => {
      const adapter = input.adapter;
      if (adapter?.sendHttp === undefined) throw new Error('TRANSPORT_HTTP_ADAPTER_UNAVAILABLE');
      const snapshot = await adapter.readSnapshot(request.serverName);
      if (snapshot.serverName !== request.serverName || snapshot.addresses.length === 0)
        throw new Error('TRANSPORT_HTTP_SNAPSHOT_INVALID');
      const key = httpKey(request.profileId, request.serverName);
      const preferred = httpPreferred.get(key);
      if (preferred !== undefined && preferred.revision !== snapshot.revision) httpPreferred.delete(key);
      const ordered = reorderPreferred(
        snapshot.addresses,
        preferred?.revision === snapshot.revision ? preferred.addressName : undefined,
      );
      let lastFailure: Extract<TransportHttpExecutionResult, {kind: 'failure'}> = Object.freeze({
        kind: 'failure',
        category: 'delivered-failure',
        code: 'HTTP_EXECUTION_FAILED',
      });
      for (const address of ordered) {
        let result: Awaited<ReturnType<NonNullable<typeof adapter.sendHttp>>>;
        try {
          result = await adapter.sendHttp({
            address,
            ...(snapshot.proxy === undefined ? {} : {proxy: snapshot.proxy}),
            method: request.method,
            pathAndQuery: request.pathAndQuery,
            headers: request.headers,
            ...(request.body === undefined ? {} : {body: request.body}),
            timeoutMs: address.timeoutMs ?? 5_000,
          });
        } catch {
          result = Object.freeze({kind: 'failure', category: 'delivered-failure', code: 'HTTP_TRANSPORT_ERROR'});
        }
        if (result.kind === 'response') {
          let currentSnapshot: TransportNetworkSnapshot;
          try {
            currentSnapshot = await adapter.readSnapshot(request.serverName);
          } catch {
            return Object.freeze({
              kind: 'failure',
              category: 'delivered-failure',
              code: 'HTTP_CONFIG_READBACK_FAILED',
            });
          }
          if (currentSnapshot.serverName !== request.serverName || currentSnapshot.revision !== snapshot.revision) {
            return Object.freeze({
              kind: 'failure',
              category: 'delivered-failure',
              code: 'HTTP_NETWORK_CONFIGURATION_CHANGED',
            });
          }
          return Object.freeze({
            ...result,
            addressName: address.addressName,
            configRevision: snapshot.revision,
          });
        }
        lastFailure = result;
        if (result.category === 'delivered-failure' && !request.safeRetryable) return lastFailure;
      }
      return lastFailure;
    },
    reportHttpAddressAvailable: accepted => {
      httpPreferred.set(
        httpKey(accepted.profileId, accepted.serverName),
        Object.freeze({addressName: accepted.addressName, revision: accepted.configRevision}),
      );
    },
    start: async (startInput): Promise<void> => {
      validatePolicy(startInput.reconnectPolicy);
      validateEndpointPathAndQuery(startInput.endpointPathAndQuery);
      const existing = profiles.get(startInput.profileId);
      if (existing !== undefined && !existing.stopped) {
        if (existing.connection !== undefined || existing.inAttempt) return;
        cancelTimer(existing, 'retryTimer');
        existing.stopped = false;
        existing.reconnectNumber = 0;
        existing.serverName = startInput.serverName;
        existing.endpointPathAndQuery = startInput.endpointPathAndQuery;
        existing.reconnectPolicy = startInput.reconnectPolicy;
        await runAttempt(existing);
        return;
      }
      const profile: Profile = {
        profileId: startInput.profileId,
        serverName: startInput.serverName,
        endpointPathAndQuery: startInput.endpointPathAndQuery,
        reconnectPolicy: startInput.reconnectPolicy,
        stopped: false,
        inAttempt: false,
        isReady: false,
        networkConnected: undefined,
        waitingForNetwork: false,
        recoveredDuringAttempt: false,
        attemptToken: 0,
        connectionToken: 0,
        reconnectNumber: 0,
        lastAttemptStartedAt: now(),
        nextAddressIndex: 0,
        addresses: [],
      };
      profiles.set(profile.profileId, profile);
      await runAttempt(profile);
    },
    ready: (profileId, stableAfterMs): void => {
      const profile = profileFor(profileId);
      if (profile.connection === undefined || profile.currentAddress === undefined || profile.stopped) return;
      if (!Number.isFinite(stableAfterMs) || stableAfterMs <= 0) throw new Error('TRANSPORT_STABLE_PERIOD_INVALID');
      cancelTimer(profile, 'readyTimer');
      profile.isReady = true;
      profile.preferredAddressName = profile.currentAddress.addressName;
      const token = ++profile.attemptToken;
      profile.stableTimer = schedule(stableAfterMs, () => input.dispatchInternal('stable', profileId, token));
      input.diagnose?.('connection-ready', profileId, {addressName: profile.currentAddress.addressName, stableAfterMs});
    },
    invalid: async (profileId, cause): Promise<void> => invalidate(profileFor(profileId), cause),
    stop: async profileId => {
      const profile = profiles.get(profileId);
      if (profile === undefined) return;
      profile.stopped = true;
      profile.attemptToken += 1;
      profile.isReady = false;
      profile.inAttempt = false;
      cancelAllTimers(profile);
      await detachConnection(profile, 'transport stopped');
      input.diagnose?.('transport-stopped', profileId);
    },
    networkStatusChanged: connected => {
      for (const profile of profiles.values()) {
        if (profile.stopped) continue;
        profile.networkConnected = connected;
        if (!connected) {
          if (profile.retryTimer !== undefined) {
            cancelTimer(profile, 'retryTimer');
            profile.attemptToken += 1;
            profile.waitingForNetwork = true;
          }
          continue;
        }
        if (profile.connection !== undefined) continue;
        if (profile.inAttempt) {
          profile.recoveredDuringAttempt = true;
          continue;
        }
        if (profile.retryTimer !== undefined || profile.waitingForNetwork) {
          cancelTimer(profile, 'retryTimer');
          profile.waitingForNetwork = false;
          const token = ++profile.attemptToken;
          const delayMs = Math.max(
            0,
            profile.reconnectPolicy.networkRecoveryMinimumIntervalMs - (now() - profile.lastAttemptStartedAt),
          );
          profile.retryTimer = schedule(delayMs, () => input.dispatchInternal('retry', profile.profileId, token));
          input.diagnose?.('network-recovery-expedited', profile.profileId, {delayMs});
        }
      }
    },
    retryDue: async (profileId, token): Promise<void> => {
      const profile = profiles.get(profileId);
      if (
        profile === undefined ||
        profile.stopped ||
        profile.attemptToken !== token ||
        profile.connection !== undefined
      )
        return;
      profile.retryTimer = undefined;
      if (profile.networkConnected === false) {
        profile.waitingForNetwork = true;
        return;
      }
      await runAttempt(profile);
    },
    readyTimeout: async (profileId, token): Promise<void> => {
      const profile = profiles.get(profileId);
      if (
        profile === undefined ||
        profile.stopped ||
        profile.attemptToken !== token ||
        profile.connection === undefined ||
        profile.isReady
      )
        return;
      profile.readyTimer = undefined;
      publish(profileId, Object.freeze({type: 'error', reason: 'READY_TIMEOUT'}));
      await invalidate(profile, 'READY_TIMEOUT');
    },
    stablePeriodElapsed: (profileId, token): void => {
      const profile = profiles.get(profileId);
      if (profile === undefined || profile.stopped || profile.attemptToken !== token || !profile.isReady) return;
      profile.stableTimer = undefined;
      profile.reconnectNumber = 0;
      input.diagnose?.('stable-period-elapsed', profileId);
    },
    connectionFor: profileId => {
      const profileForConnection = profileFor(profileId);
      return Object.freeze({
        send: async raw => {
          const current = profileForConnection.connection;
          if (current === undefined) throw new Error('TRANSPORT_CONNECTION_NOT_OPEN');
          await current.send(raw);
        },
        subscribe: listener => {
          const bucket = listeners.get(profileId) ?? new Set();
          bucket.add(listener);
          listeners.set(profileId, bucket);
          if (profileForConnection.connection !== undefined && profileForConnection.currentAddress !== undefined) {
            listener(Object.freeze({type: 'open', addressName: profileForConnection.currentAddress.addressName}));
          }
          return () => {
            bucket.delete(listener);
            if (bucket.size === 0) listeners.delete(profileId);
          };
        },
      });
    },
    subscribe: (profileId, listener) => {
      const bucket = listeners.get(profileId) ?? new Set();
      bucket.add(listener);
      listeners.set(profileId, bucket);
      return () => {
        bucket.delete(listener);
        if (bucket.size === 0) listeners.delete(profileId);
      };
    },
    dispose: async (): Promise<void> => {
      await Promise.all(
        [...profiles.keys()].map(profileId => {
          const profile = profiles.get(profileId);
          return profile === undefined
            ? Promise.resolve()
            : (async () => {
                profile.stopped = true;
                profile.attemptToken += 1;
                cancelAllTimers(profile);
                await detachConnection(profile, 'transport module disposed');
              })();
        }),
      );
      profiles.clear();
      listeners.clear();
      httpPreferred.clear();
    },
  });
};
