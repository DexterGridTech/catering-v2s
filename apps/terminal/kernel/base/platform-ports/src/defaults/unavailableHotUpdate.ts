import type {NoOutput, PortResult} from '../types/result';
import type {HotUpdateCall, HotUpdateDownloadInput, HotUpdateInstall, HotUpdateMarkerInput, HotUpdateMarkerRead, HotUpdateMarkerWrite, HotUpdatePort} from '../types/hotUpdate';
import {createUnavailable} from './createUnavailable';

const PORT_DESCRIPTOR_KEY = Symbol.for('catering-v2s.platform-ports.descriptor');
export const unavailableHotUpdatePort: HotUpdatePort = {
  downloadPackage: async (_input: HotUpdateDownloadInput): Promise<PortResult<HotUpdateInstall>> => createUnavailable('hotUpdate', 'downloadPackage'),
  writeBootMarker: async (_input: HotUpdateMarkerInput): Promise<PortResult<HotUpdateMarkerWrite>> => createUnavailable('hotUpdate', 'writeBootMarker'),
  readBootMarker: async (_input: HotUpdateCall): Promise<PortResult<HotUpdateMarkerRead>> => createUnavailable('hotUpdate', 'readBootMarker'),
  readActiveMarker: async (_input: HotUpdateCall): Promise<PortResult<HotUpdateMarkerRead>> => createUnavailable('hotUpdate', 'readActiveMarker'),
  readRollbackMarker: async (_input: HotUpdateCall): Promise<PortResult<HotUpdateMarkerRead>> => createUnavailable('hotUpdate', 'readRollbackMarker'),
  clearBootMarker: async (_input: HotUpdateCall): Promise<PortResult<NoOutput>> => createUnavailable('hotUpdate', 'clearBootMarker'),
  confirmLoadComplete: async (_input: HotUpdateCall): Promise<PortResult<HotUpdateMarkerRead>> => createUnavailable('hotUpdate', 'confirmLoadComplete'),
};

Object.defineProperty(unavailableHotUpdatePort, PORT_DESCRIPTOR_KEY, {
    value: Object.freeze({
      port: 'hotUpdate',
      capabilities: Object.freeze([
        'downloadPackage', 'writeBootMarker', 'readBootMarker', 'readActiveMarker',
        'readRollbackMarker', 'clearBootMarker', 'confirmLoadComplete',
      ].map(capability => Object.freeze({capability, state: 'unavailable' as const, source: 'default' as const}))),
    }),
    enumerable: false,
    writable: false,
    configurable: false,
});
