import type {CommandId, RuntimeInstanceId, TimestampMs} from '@catering-v2s/kernel-base-contracts';
import type {PortResult} from './result';

export interface LogUploadInput {
  readonly uploadUrl: string;
  readonly logDate: string;
  readonly terminalId?: string;
  readonly sandboxId?: string;
  readonly commandId?: CommandId;
  readonly runtimeInstanceId?: RuntimeInstanceId;
  readonly releaseId?: string;
  readonly surfaceIndex: number;
  readonly surfaceRole: string;
  readonly overwrite: boolean;
  readonly headers: Readonly<Record<string, string>>;
  readonly timeoutMs: number;
}
export interface UploadedLogFile {
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly uploadedAt: TimestampMs;
  readonly checksum: string;
  readonly storageKey?: string;
  readonly url?: string;
}
export interface LogUploadOutput {
  readonly terminalId?: string;
  readonly surfaceIndex: number;
  readonly surfaceRole: string;
  readonly logDate: string;
  readonly uploadedFiles: readonly UploadedLogFile[];
  readonly skippedFiles: readonly string[];
}
export interface LogUploadPort {
  uploadLogsForDate(input: LogUploadInput): Promise<PortResult<LogUploadOutput>>;
}
