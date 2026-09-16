import type {LogFields, LoggerPort} from '@catering-v2s/kernel-base-platform-ports'
import type {ContentFailureReason} from '@catering-v2s/ui-base-render'

export const startupRequiredGroups = Object.freeze([
  'modules',
  'slices',
  'commands',
  'actors',
  'ports',
  'parts',
] as const)

export type StartupDiagnosticsReadiness = Readonly<{
  readonly groups: Readonly<Record<typeof startupRequiredGroups[number], boolean>>
  readonly primaryDeclared: boolean
  readonly primaryMeasured: boolean
  readonly primaryRealReady: boolean
  readonly primaryReadyPartKey: string | null
  readonly primaryContentFailure: ContentFailureReason | null
}>

export type StartupDiagnosticsWriterInput = Readonly<{
  readonly logger: LoggerPort
  readonly startupRunId: string
  readonly appName: string
  readonly surfaceProvenance: LogFields
  readonly clientProvenance: LogFields
  readonly getReadiness: () => StartupDiagnosticsReadiness
}>

export type StartupDiagnosticsWriter = Readonly<{
  readonly writeComplete: () => boolean
}>

const readinessIsComplete = (readiness: StartupDiagnosticsReadiness): boolean =>
  startupRequiredGroups.every(group => readiness.groups[group])
  && readiness.primaryDeclared
  && readiness.primaryMeasured
  && readiness.primaryRealReady

export const createStartupDiagnosticsWriter = (
  input: StartupDiagnosticsWriterInput,
): StartupDiagnosticsWriter => {
  let written = false
  return Object.freeze({
    writeComplete: () => {
      if (written) throw new Error(`[${input.appName}] startup.complete was written twice`)
      const readiness = input.getReadiness()
      if (!readinessIsComplete(readiness)) return false
      written = true
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
          writer: 'ui.base.console-assembly',
        },
      })
      return true
    },
  })
}
