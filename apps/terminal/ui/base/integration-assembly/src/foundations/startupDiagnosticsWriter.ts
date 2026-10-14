import type {LogFields, LoggerPort} from '@catering-v2s/kernel-base-platform-ports';
import type {RuntimeLifecycleObserver} from '@catering-v2s/kernel-base-runtime';
import type {ContentFailureReason} from '@catering-v2s/ui-base-render';

export const startupRequiredGroups = Object.freeze([
  'modules',
  'slices',
  'commands',
  'actors',
  'ports',
  'parts',
] as const);

export type StartupDiagnosticsReadiness = Readonly<{
  readonly groups: Readonly<Record<(typeof startupRequiredGroups)[number], boolean>>;
  readonly primaryDeclared: boolean;
  readonly primaryMeasured: boolean;
  readonly primaryRealReady: boolean;
  readonly primaryReadyPartKey: string | null;
  readonly primaryContentFailure: ContentFailureReason | null;
}>;

export type StartupDiagnosticsWriterInput = Readonly<{
  readonly logger: LoggerPort;
  readonly startupRunId: string;
  readonly appName: string;
  readonly surfaceProvenance: LogFields;
  readonly clientProvenance: LogFields;
  readonly getReadiness: () => StartupDiagnosticsReadiness;
}>;

export type StartupDiagnosticsWriter = Readonly<{
  readonly writeComplete: () => boolean;
}>;

export const createStartupCommandObserver = (logger: LoggerPort, appName: string): RuntimeLifecycleObserver =>
  event => {
    logger.info({
      category: 'startup.command-lifecycle',
      event: `startup.command.${event.kind}`,
      message: 'Startup command lifecycle transition observed',
      data: {
        appName,
        requestId: event.requestId === null ? null : String(event.requestId),
        commandId: event.commandId === null ? null : String(event.commandId),
        commandName: event.commandName,
        kind: event.kind,
        ...('actorKey' in event ? {actorKey: event.actorKey} : {}),
        ...('status' in event ? {status: event.status} : {}),
        ...('errorKey' in event ? {errorKey: event.errorKey} : {}),
      },
    });
  };

const readinessIsComplete = (readiness: StartupDiagnosticsReadiness): boolean =>
  startupRequiredGroups.every(group => readiness.groups[group]) &&
  readiness.primaryDeclared &&
  readiness.primaryMeasured &&
  (readiness.primaryRealReady || readiness.primaryContentFailure !== null);

export const createStartupDiagnosticsWriter = (input: StartupDiagnosticsWriterInput): StartupDiagnosticsWriter => {
  let written = false;
  return Object.freeze({
    writeComplete: () => {
      if (written) throw new Error(`[${input.appName}] startup.complete was written twice`);
      const readiness = input.getReadiness();
      if (!readinessIsComplete(readiness)) return false;
      written = true;
      input.logger.info({
        category: 'startup.complete',
        event: 'startup.complete',
        message: 'Terminal startup completed',
        data: {
          startupRunId: input.startupRunId,
          appName: input.appName,
          surfaceProvenance: input.surfaceProvenance,
          client: input.clientProvenance,
          groups: readiness.groups,
          primaryDeclared: readiness.primaryDeclared,
          primaryMeasured: readiness.primaryMeasured,
          primaryRealReady: readiness.primaryRealReady,
          primaryReadyPartKey: readiness.primaryReadyPartKey,
          primaryContentFailure: readiness.primaryContentFailure,
          writer: 'ui.base.integration-assembly',
        },
      });
      return true;
    },
  });
};
