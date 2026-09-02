import type {NoOutput, PortResult} from '../types/result';
import type {HotUpdateCall, HotUpdateDownloadInput, HotUpdateInstall, HotUpdateMarkerInput, HotUpdateMarkerRead, HotUpdateMarkerWrite, HotUpdatePort} from '../types/hotUpdate';
import {createUnavailable} from './createUnavailable';

export const unavailableHotUpdatePort: HotUpdatePort = {
  downloadPackage: async (_input: HotUpdateDownloadInput): Promise<PortResult<HotUpdateInstall>> => createUnavailable('hotUpdate', 'downloadPackage'),
  writeBootMarker: async (_input: HotUpdateMarkerInput): Promise<PortResult<HotUpdateMarkerWrite>> => createUnavailable('hotUpdate', 'writeBootMarker'),
  readBootMarker: async (_input: HotUpdateCall): Promise<PortResult<HotUpdateMarkerRead>> => createUnavailable('hotUpdate', 'readBootMarker'),
  readActiveMarker: async (_input: HotUpdateCall): Promise<PortResult<HotUpdateMarkerRead>> => createUnavailable('hotUpdate', 'readActiveMarker'),
  readRollbackMarker: async (_input: HotUpdateCall): Promise<PortResult<HotUpdateMarkerRead>> => createUnavailable('hotUpdate', 'readRollbackMarker'),
  clearBootMarker: async (_input: HotUpdateCall): Promise<PortResult<NoOutput>> => createUnavailable('hotUpdate', 'clearBootMarker'),
  confirmLoadComplete: async (_input: HotUpdateCall): Promise<PortResult<HotUpdateMarkerRead>> => createUnavailable('hotUpdate', 'confirmLoadComplete'),
};
