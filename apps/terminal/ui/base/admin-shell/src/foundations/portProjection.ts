import type {PlatformPortCapabilitySnapshot, PlatformPortName} from '@catering-v2s/kernel-base-platform-ports';

export type PortUnitState = 'available' | 'unavailable' | 'undeclared';
export type PortUnitCategory = 'logs' | 'device' | 'system' | 'connection' | 'release' | 'unmapped';

export type PortUnit = Readonly<{
  readonly unitKey: string;
  readonly port: string;
  readonly capability: string | null;
  readonly state: PortUnitState;
  readonly source: string | null;
  readonly category: PortUnitCategory;
}>;

export const portCategoryOrder: readonly PortUnitCategory[] = Object.freeze([
  'logs',
  'device',
  'connection',
  'system',
  'release',
]);

const categoryOf = (port: PlatformPortName | string): PortUnitCategory => {
  if (port === 'logger' || port === 'logUpload') return 'logs';
  if (port === 'device') return 'device';
  if (port === 'appControl' || port === 'persistKv' || port === 'persistSecure') return 'system';
  if (port === 'connector' || port === 'topologyHost') return 'connection';
  if (port === 'script' || port === 'update') return 'release';
  return 'unmapped';
};

export const buildPortUnits = (snapshots: readonly PlatformPortCapabilitySnapshot[]): readonly PortUnit[] => {
  const units: PortUnit[] = [];
  for (const snapshot of snapshots) {
    const category = categoryOf(snapshot.port);
    if (snapshot.descriptorStatus === 'missing-descriptor' || snapshot.capabilities.length === 0) {
      units.push(
        Object.freeze({
          unitKey: `${snapshot.port}:undeclared`,
          port: snapshot.port,
          capability: null,
          state: 'undeclared' as const,
          source: null,
          category,
        }),
      );
      continue;
    }
    for (const capability of snapshot.capabilities) {
      units.push(
        Object.freeze({
          unitKey: `${snapshot.port}:${capability.capability}`,
          port: snapshot.port,
          capability: capability.capability,
          state: capability.state === 'real' ? ('available' as const) : ('unavailable' as const),
          source: capability.source,
          category,
        }),
      );
    }
  }
  return Object.freeze(units);
};

export const portCategoryLabels: Readonly<Record<PortUnitCategory, string>> = Object.freeze({
  logs: '日志与诊断',
  device: '设备与系统',
  system: '存储与状态',
  connection: '连接与拓扑',
  release: '脚本与更新',
  unmapped: '未归类能力',
});
