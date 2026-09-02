import type {PortResult} from '../types/result';
import type {LogUploadInput, LogUploadOutput, LogUploadPort} from '../types/logUpload';
import {createUnavailable} from './createUnavailable';

export const unavailableLogUploadPort: LogUploadPort = {
  uploadLogsForDate: async (_input: LogUploadInput): Promise<PortResult<LogUploadOutput>> => createUnavailable('logUpload', 'uploadLogsForDate'),
};
