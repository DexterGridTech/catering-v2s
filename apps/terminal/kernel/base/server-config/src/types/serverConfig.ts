import type {
  TransportHttpProxy,
  TransportServerAddress,
  TransportServerConfig,
} from '@catering-v2s/kernel-base-contracts';

export interface ServerConfigOverrideState {
  readonly addresses: readonly TransportServerAddress[];
  readonly proxy: Omit<TransportHttpProxy, 'password'> | null;
}

export interface ServerConfigState {
  readonly selectedSpace: string;
  readonly overrides: Readonly<Record<string, ServerConfigOverrideState>>;
  /** Plain persistence and host-to-branch state sync are explicitly required for proxy authentication. */
  readonly proxyPasswords: Readonly<Record<string, string>>;
  /** Last authoritative host package defaults received by a paired branch; never editable locally. */
  readonly syncedHostDefaults: TransportServerConfig | null;
  /** Per-service runtime revision; it intentionally resets on process restart. */
  readonly serviceRevisions: Readonly<Record<string, number>>;
}

export type ProxyPasswordInput =
  | Readonly<{readonly mode: 'set'; readonly value: string}>
  | Readonly<{readonly mode: 'keep'}>
  | Readonly<{readonly mode: 'none'}>;

export type ServerConfigProxyInput = Readonly<{
  readonly protocol: 'http';
  readonly host: string;
  readonly port: number;
  readonly username?: string;
  readonly password: ProxyPasswordInput;
}>;

export type ServerConfigAddressInput = Readonly<{
  readonly addressName: string;
  readonly baseUrl: string;
  readonly timeoutMs: number;
}>;

export type SetServerOverridePayload = Readonly<{
  readonly serverName: string;
  readonly addresses: readonly ServerConfigAddressInput[];
  readonly proxy: ServerConfigProxyInput | null;
}>;

export interface EffectiveServerConfigView {
  /** Identifies whether a paired branch has received the master's config projection. */
  readonly source: 'package-defaults' | 'host-sync';
  readonly selectedSpace: string;
  readonly spaces: readonly Readonly<{
    name: string;
    servers: readonly Readonly<{
      serverName: string;
      addresses: readonly TransportServerAddress[];
      proxy: null | Readonly<{
        protocol: 'http';
        host: string;
        port: number;
        username?: string;
        passwordConfigured: boolean;
      }>;
      proxyPasswordOverridden: boolean;
      overridden: boolean;
    }>[];
  }>[];
  readonly defaults: readonly Readonly<{
    name: string;
    servers: readonly Readonly<{
      serverName: string;
      addresses: readonly TransportServerAddress[];
      proxy: null | Readonly<{
        protocol: 'http';
        host: string;
        port: number;
        username?: string;
        passwordConfigured: boolean;
      }>;
    }>[];
  }>[];
  readonly overriddenServerNames: readonly string[];
}

export interface ServerNetworkSnapshot {
  readonly serverName: string;
  readonly revision: number;
  readonly addresses: readonly TransportServerAddress[];
  readonly proxy?: TransportHttpProxy;
}

export type ServerConfigDefaults = TransportServerConfig;
