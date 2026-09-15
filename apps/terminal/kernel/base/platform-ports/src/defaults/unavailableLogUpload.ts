import type {PortResult} from '../types/result';
import type {LogUploadInput, LogUploadOutput, LogUploadPort} from '../types/logUpload';
import {createUnavailable} from './createUnavailable';

const PORT_DESCRIPTOR_KEY = Symbol.for('catering-v2s.platform-ports.descriptor');
export const unavailableLogUploadPort: LogUploadPort = {
  uploadLogsForDate: async (_input: LogUploadInput): Promise<PortResult<LogUploadOutput>> => createUnavailable('logUpload', 'uploadLogsForDate'),
};

Object.defineProperty(unavailableLogUploadPort, PORT_DESCRIPTOR_KEY, {
  value: Object.freeze({
    port: 'logUpload',
    capabilities: Object.freeze([
      Object.freeze({capability: 'uploadLogsForDate', state: 'unavailable' as const, source: 'default' as const}),
    ]),
  }),
  enumerable: false,
  writable: false,
  configurable: false,
});
