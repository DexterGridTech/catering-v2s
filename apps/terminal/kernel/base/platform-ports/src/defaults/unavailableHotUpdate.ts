import type {NoOutput, PortResult, PortUnavailable} from '../types/result';
import type {HotUpdateCall, HotUpdateDownloadInput, HotUpdateInstall, HotUpdateMarkerInput, HotUpdateMarkerRead, HotUpdateMarkerWrite, HotUpdatePort} from '../types/hotUpdate';

const unavailable = (capability: string): PortUnavailable => ({
  status: 'unavailable',
  port: 'hotUpdate',
  capability,
  reason: 'ADAPTER_NOT_INJECTED',
  message: `hotUpdate.${capability}: adapter not injected`,
});

export const unavailableHotUpdatePort: HotUpdatePort = {
  downloadPackage: async (_input: HotUpdateDownloadInput): Promise<PortResult<HotUpdateInstall>> => unavailable('downloadPackage'),
  writeBootMarker: async (_input: HotUpdateMarkerInput): Promise<PortResult<HotUpdateMarkerWrite>> => unavailable('writeBootMarker'),
  readBootMarker: async (_input: HotUpdateCall): Promise<PortResult<HotUpdateMarkerRead>> => unavailable('readBootMarker'),
  readActiveMarker: async (_input: HotUpdateCall): Promise<PortResult<HotUpdateMarkerRead>> => unavailable('readActiveMarker'),
  readRollbackMarker: async (_input: HotUpdateCall): Promise<PortResult<HotUpdateMarkerRead>> => unavailable('readRollbackMarker'),
  clearBootMarker: async (_input: HotUpdateCall): Promise<PortResult<NoOutput>> => unavailable('clearBootMarker'),
  confirmLoadComplete: async (_input: HotUpdateCall): Promise<PortResult<HotUpdateMarkerRead>> => unavailable('confirmLoadComplete'),
};
