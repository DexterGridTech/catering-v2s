import {defineCommand} from '@catering-v2s/kernel-base-runtime';
import type {TopologyIdentity, TopologyLocator, TopologyPayloadFailure} from '@catering-v2s/kernel-base-contracts';
import {moduleName} from '../../moduleName';

export type EmptyTopologyPayload = Readonly<{}>;

export const queryTopologyHostCommand = defineCommand<Readonly<{readonly host: string}>>(moduleName, {
  name: 'query-host',
  visibility: 'internal',
});

export const pairTopologyCommand = defineCommand<
  Readonly<{
    readonly locator: TopologyLocator;
  }>
>(moduleName, {name: 'pair', visibility: 'internal'});

export const pairByHostTopologyCommand = defineCommand<Readonly<{readonly host: string}>>(moduleName, {
  name: 'pair-by-host',
  visibility: 'public',
});

export const unpairTopologyCommand = defineCommand<EmptyTopologyPayload>(moduleName, {
  name: 'unpair',
  visibility: 'public',
});

export const setTopologyHostEnabledCommand = defineCommand<Readonly<{readonly enabled: boolean}>>(moduleName, {
  name: 'enable-host',
  visibility: 'public',
});

export type TopologyHostEventPayload = Readonly<{
  readonly event:
    | 'open'
    | 'message'
    | 'close'
    | 'error'
    | 'peer-accepted'
    | 'peer-connection-installed'
    | 'peer-unreachable'
    | 'state-sync-slice-applied'
    | 'state-transfer-failed'
    | 'state-transfer-recovered';
  readonly frame?: string;
  readonly reason?: string;
  readonly peerIdentity?: TopologyIdentity;
  readonly connectionId?: string;
  readonly sliceName?: string;
  readonly revision?: number;
  readonly payloadFailure?: TopologyPayloadFailure;
}>;

export const topologyHostEventCommand = defineCommand<TopologyHostEventPayload>(moduleName, {
  name: 'host-event',
  visibility: 'internal',
  allowNoActor: true,
});

export const refreshTopologyDisplayCommand = defineCommand<EmptyTopologyPayload>(moduleName, {
  name: 'refresh-display',
  visibility: 'internal',
  allowNoActor: true,
});

export type TopologyDisplayChangedPayload = Readonly<{
  readonly displayCount: number | null;
}>;

/**
 * Emitted after the topology owner has committed a refreshed display count.
 * Consumers use this notification to recompute display-scoped placement; it
 * deliberately carries no business action of its own.
 */
export const topologyDisplayChangedCommand = defineCommand<TopologyDisplayChangedPayload>(moduleName, {
  name: 'display-changed',
  visibility: 'internal',
  allowNoActor: true,
});

export const reconcileTopologyHostCommand = defineCommand<EmptyTopologyPayload>(moduleName, {
  name: 'reconcile-host',
  visibility: 'internal',
  allowNoActor: true,
});

export const reconcileTopologyPeerCommand = defineCommand<EmptyTopologyPayload>(moduleName, {
  name: 'reconcile-peer',
  visibility: 'internal',
  allowNoActor: true,
});
