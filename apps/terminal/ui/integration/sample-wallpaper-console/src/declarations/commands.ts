import {defineCommand} from '@catering-v2s/kernel-base-runtime';
import type {StartupReadyPayload} from '@catering-v2s/ui-base-integration-assembly';
import {moduleName} from '../moduleName';

export type SampleWallpaperConsoleReadyPayload = StartupReadyPayload;

/** Integration-owned internal commands used by the local stage actor. */
export const reconcileStageCommand = defineCommand<Readonly<Record<string, never>>>(moduleName, {
  name: 'reconcile-owner-stage',
  visibility: 'internal',
});

export const startupReadyCommand = defineCommand<SampleWallpaperConsoleReadyPayload>(moduleName, {
  name: 'startup-ready',
  visibility: 'internal',
});
