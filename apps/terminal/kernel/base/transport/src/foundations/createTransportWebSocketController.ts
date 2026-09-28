import type {TransportServerConfig} from '@catering-v2s/kernel-base-contracts';
import {createTransportAddressSelector, type ResolvedTransportServerAddress} from './resolveTransportServerAddresses';

export type TransportSocketEvent = Readonly<{
  readonly type: 'message' | 'close' | 'error';
  readonly raw?: string;
  readonly reason?: string;
}>;

export type TransportSocket = Readonly<{
  readonly subscribe: (listener: (event: TransportSocketEvent) => void) => () => void;
  readonly send: (raw: string) => Promise<void>;
  readonly close: (reason?: string) => Promise<void>;
}>;

export type TransportSocketConnector = (
  input: Readonly<{
    readonly address: ResolvedTransportServerAddress;
    readonly connectionToken: number;
  }>,
) => Promise<TransportSocket>;

export type TransportProfileEvent = Readonly<{
  readonly type: 'open' | 'message' | 'close' | 'error';
  readonly connectionToken: number;
  readonly addressName?: string;
  readonly raw?: string;
  readonly reason?: string;
}>;

export type TransportWebSocketController = Readonly<{
  readonly registerProfile: (
    input: Readonly<{
      readonly name: string;
      readonly config: TransportServerConfig;
      readonly serverName: string;
      readonly connector: TransportSocketConnector;
    }>,
  ) => void;
  readonly replaceServers: (name: string, config: TransportServerConfig, serverName: string) => Promise<void>;
  readonly connect: (name: string) => Promise<void>;
  readonly send: (name: string, raw: string) => Promise<void>;
  readonly close: (name: string, reason?: string) => Promise<void>;
  readonly subscribe: (name: string, listener: (event: TransportProfileEvent) => void) => () => void;
}>;

type Profile = {
  readonly name: string;
  config: TransportServerConfig;
  serverName: string;
  connector: TransportSocketConnector;
  selector: ReturnType<typeof createTransportAddressSelector>;
  connectionToken: number;
  socket?: TransportSocket;
  socketUnsubscribe?: () => void;
  readonly listeners: Set<(event: TransportProfileEvent) => void>;
};

const closeActiveSocket = async (profile: Profile, reason: string): Promise<void> => {
  profile.connectionToken += 1;
  const socket = profile.socket;
  const unsubscribe = profile.socketUnsubscribe;
  profile.socket = undefined;
  profile.socketUnsubscribe = undefined;
  unsubscribe?.();
  if (socket !== undefined) await socket.close(reason);
};

const emit = (profile: Profile, event: TransportProfileEvent): void => {
  for (const listener of profile.listeners) listener(event);
};

export const createTransportWebSocketController = (): TransportWebSocketController => {
  const profiles = new Map<string, Profile>();

  const readProfile = (name: string): Profile => {
    const profile = profiles.get(name);
    if (profile === undefined) throw new Error(`transport profile is not registered: ${name}`);
    return profile;
  };

  return Object.freeze({
    registerProfile: (input): void => {
      if (profiles.has(input.name)) throw new Error(`transport profile is already registered: ${input.name}`);
      profiles.set(input.name, {
        name: input.name,
        config: input.config,
        serverName: input.serverName,
        connector: input.connector,
        selector: createTransportAddressSelector(input.config, input.serverName),
        connectionToken: 0,
        listeners: new Set(),
      });
    },
    replaceServers: async (name, config, serverName): Promise<void> => {
      const profile = readProfile(name);
      await closeActiveSocket(profile, 'transport servers replaced');
      profile.config = config;
      profile.serverName = serverName;
      profile.selector = createTransportAddressSelector(config, serverName);
    },
    connect: async (name): Promise<void> => {
      const profile = readProfile(name);
      await closeActiveSocket(profile, 'transport reconnect');
      const connectionToken = profile.connectionToken;
      let lastError: unknown;
      for (const address of profile.selector.resolve()) {
        if (profile.connectionToken !== connectionToken) return;
        try {
          const socket = await profile.connector({address, connectionToken});
          if (profile.connectionToken !== connectionToken) {
            await socket.close('stale transport connection');
            return;
          }
          profile.socket = socket;
          profile.selector.markSuccessful(address.addressName);
          profile.socketUnsubscribe = socket.subscribe(event => {
            if (profile.connectionToken !== connectionToken || profile.socket !== socket) return;
            emit(
              profile,
              Object.freeze({
                ...event,
                connectionToken,
                addressName: address.addressName,
              }),
            );
          });
          emit(profile, Object.freeze({type: 'open', connectionToken, addressName: address.addressName}));
          return;
        } catch (error) {
          lastError = error;
          emit(
            profile,
            Object.freeze({
              type: 'error',
              connectionToken,
              addressName: address.addressName,
              reason: 'transport connection attempt failed',
            }),
          );
        }
      }
      throw lastError instanceof Error ? lastError : new Error('transport connection failed');
    },
    send: async (name, raw): Promise<void> => {
      const profile = readProfile(name);
      if (profile.socket === undefined) throw new Error(`transport profile is not connected: ${name}`);
      await profile.socket.send(raw);
    },
    close: async (name, reason): Promise<void> => {
      await closeActiveSocket(readProfile(name), reason ?? 'transport closed');
    },
    subscribe: (name, listener): (() => void) => {
      const profile = readProfile(name);
      profile.listeners.add(listener);
      return () => {
        profile.listeners.delete(listener);
      };
    },
  });
};
