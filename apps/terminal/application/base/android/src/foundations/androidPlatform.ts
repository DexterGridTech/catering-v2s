import {
  createPlatformPorts,
  unavailableConnectorPort,
  unavailableHotUpdatePort,
  unavailableLogUploadPort,
  unavailableScriptPort,
  type NativeLoadingCapability,
  type LoggerPort,
  type PlatformPorts,
  type EnvironmentMode,
} from '@catering-v2s/kernel-base-platform-ports';
import {createAndroidDevicePort} from '@catering-v2s/adapter-android-device';
import {createAndroidSurfaceHostSource} from '@catering-v2s/adapter-android-dual-screen';
import {createAndroidPersistKvPort} from '@catering-v2s/adapter-android-persist-kv';
import {createAndroidNativeLoadingCapability} from './nativeLoadingCapability';
import {
  createAndroidAppControlPort,
  createAndroidTopologyHostPort,
  createAndroidTopologyPeerChannel,
} from './nativeTopology';
import type {TopologyPeerChannel} from '@catering-v2s/kernel-base-transport';
import type {TransportNetworkAdapter, TransportNetworkSnapshot} from '@catering-v2s/kernel-base-transport';
import {createAndroidTransportNetworkAdapter} from './androidTransportNetworkAdapter';
import {androidStructuredLoggerBinding} from './androidStructuredLoggerBinding';

export type AndroidPlatformBinding = Readonly<{
  readonly environmentMode: EnvironmentMode;
  readonly platformPorts: PlatformPorts;
  readonly topologyPeerChannel: TopologyPeerChannel;
  readonly transportNetworkAdapterFactory: (
    readSnapshot: (serverName: string) => Promise<TransportNetworkSnapshot>,
  ) => TransportNetworkAdapter;
  readonly nativeLoadingCapability: NativeLoadingCapability;
  readonly surfaceHostSourcesByDisplayIndex: Readonly<{
    readonly 0: ReturnType<typeof createAndroidSurfaceHostSource>;
    readonly 1: ReturnType<typeof createAndroidSurfaceHostSource>;
  }>;
}>;

export const createAndroidPlatformBinding = (persistenceKey: string): AndroidPlatformBinding => {
  const environmentMode: EnvironmentMode = __DEV__ ? 'DEV' : 'PROD';
  const nativeLoadingCapability = createAndroidNativeLoadingCapability();
  let platformLogger: LoggerPort | undefined;
  const platformPorts = createPlatformPorts({
    environmentMode,
    bindings: {
      logger: androidStructuredLoggerBinding,
      persistKv: createAndroidPersistKvPort(persistenceKey, 'plain'),
      persistSecure: createAndroidPersistKvPort(persistenceKey, 'protected'),
      device: createAndroidDevicePort(),
      appControl: createAndroidAppControlPort(),
      script: unavailableScriptPort,
      connector: unavailableConnectorPort,
      hotUpdate: unavailableHotUpdatePort,
      logUpload: unavailableLogUploadPort,
      topologyHost: createAndroidTopologyHostPort(() => platformLogger),
    },
  });
  platformLogger = platformPorts.logger;
  const topologyPeerChannel = createAndroidTopologyPeerChannel();
  return Object.freeze({
    environmentMode,
    platformPorts,
    topologyPeerChannel,
    transportNetworkAdapterFactory: readSnapshot => createAndroidTransportNetworkAdapter(readSnapshot),
    nativeLoadingCapability,
    surfaceHostSourcesByDisplayIndex: Object.freeze({
      0: createAndroidSurfaceHostSource({surfaceKey: 'PRIMARY', displayIndex: 0}),
      1: createAndroidSurfaceHostSource({surfaceKey: 'SECONDARY', displayIndex: 1}),
    }),
  });
};
