import type {PortResult, PortUnavailable} from '../types/result';
import type {LogUploadInput, LogUploadOutput, LogUploadPort} from '../types/logUpload';

const unavailable = (capability: string): PortUnavailable => ({
  status: 'unavailable',
  port: 'logUpload',
  capability,
  reason: 'ADAPTER_NOT_INJECTED',
  message: `logUpload.${capability}: adapter not injected`,
});

export const unavailableLogUploadPort: LogUploadPort = {
  uploadLogsForDate: async (_input: LogUploadInput): Promise<PortResult<LogUploadOutput>> => unavailable('uploadLogsForDate'),
};
