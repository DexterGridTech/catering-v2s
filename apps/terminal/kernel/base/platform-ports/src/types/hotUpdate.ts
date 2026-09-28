import type {RequestId, TimestampMs} from '@catering-v2s/kernel-base-contracts';
import type {NoOutput, PortResult} from './result';

export interface HotUpdateCall {
  readonly timeoutMs: number;
}
export interface HotUpdateDownloadInput extends HotUpdateCall {
  readonly packageId: string;
  readonly releaseId: string;
  readonly bundleVersion: string;
  readonly packageUrls: readonly string[];
  readonly packageSha256: string;
  readonly manifestSha256: string;
  readonly packageSizeBytes: number;
}
export interface HotUpdateInstall {
  readonly installDirectory: string;
  readonly entryFile: string;
  readonly manifestPath: string;
  readonly packageSha256: string;
  readonly manifestSha256: string;
}
export interface HotUpdateMarkerInput extends HotUpdateCall {
  readonly releaseId: string;
  readonly packageId: string;
  readonly bundleVersion: string;
  readonly resetRequestId?: RequestId;
  readonly installDirectory: string;
  readonly entryFile: string;
  readonly manifestSha256: string;
  readonly maxLaunchFailures: number;
  readonly healthCheckTimeoutMs: number;
}
export interface HotUpdateMarker {
  readonly releaseId: string;
  readonly packageId: string;
  readonly bundleVersion: string;
  readonly resetRequestId?: RequestId;
  readonly installDirectory: string;
  readonly entryFile: string;
  readonly manifestSha256: string;
  readonly bootAttempt: number;
  readonly maxLaunchFailures: number;
  readonly healthCheckTimeoutMs: number;
  readonly updatedAt: TimestampMs;
  readonly lastBootAt?: TimestampMs;
  readonly lastSuccessfulBootAt?: TimestampMs;
  readonly rollbackReason?: string;
  readonly failedBootAttempt?: number;
  readonly rolledBackAt?: TimestampMs;
}
export type HotUpdateMarkerRead =
  {readonly state: 'present'; readonly marker: HotUpdateMarker} | {readonly state: 'absent'};
export interface HotUpdateMarkerWrite {
  readonly markerPath: string;
}
export interface HotUpdatePort {
  downloadPackage(input: HotUpdateDownloadInput): Promise<PortResult<HotUpdateInstall>>;
  writeBootMarker(input: HotUpdateMarkerInput): Promise<PortResult<HotUpdateMarkerWrite>>;
  readBootMarker(input: HotUpdateCall): Promise<PortResult<HotUpdateMarkerRead>>;
  readActiveMarker(input: HotUpdateCall): Promise<PortResult<HotUpdateMarkerRead>>;
  readRollbackMarker(input: HotUpdateCall): Promise<PortResult<HotUpdateMarkerRead>>;
  clearBootMarker(input: HotUpdateCall): Promise<PortResult<NoOutput>>;
  confirmLoadComplete(input: HotUpdateCall): Promise<PortResult<HotUpdateMarkerRead>>;
}
