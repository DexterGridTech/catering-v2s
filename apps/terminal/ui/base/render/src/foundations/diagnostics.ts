import type {DisplayMode} from '@catering-v2s/kernel-base-ui-state'
import type {LoggerPort} from '@catering-v2s/kernel-base-platform-ports'

export type RenderPartDiagnostic =
  | Readonly<{
      readonly event: 'missing-catalog-entry'
      readonly data: Readonly<{partKey: string; displayMode: DisplayMode}>
    }>
  | Readonly<{
      readonly event: 'missing-renderer'
      readonly data: Readonly<{partKey: string; displayMode: DisplayMode; rendererKey: string}>
    }>
  | Readonly<{
      readonly event: 'invalid-props-shape'
      readonly data: Readonly<{partKey: string; displayMode: DisplayMode; valueType: string}>
    }>

export type RenderPartDiagnosticReporter = Readonly<{
  readonly report: (diagnostic: RenderPartDiagnostic) => void
  readonly clearForPart: (partKey: string, displayMode: DisplayMode) => void
}>

const diagnosticIdentity = (diagnostic: RenderPartDiagnostic): string =>
  JSON.stringify([diagnostic.event, ...Object.values(diagnostic.data)])

export const createRenderPartDiagnosticReporter = (
  logger: LoggerPort,
): RenderPartDiagnosticReporter => {
  const reported = new Map<string, Readonly<{partKey: string; displayMode: DisplayMode}>>()
  return Object.freeze({
    report: (diagnostic: RenderPartDiagnostic): void => {
      const identity = diagnosticIdentity(diagnostic)
      if (reported.has(identity)) return
      reported.set(identity, {
        partKey: diagnostic.data.partKey,
        displayMode: diagnostic.data.displayMode,
      })
      logger.error({
        category: 'ui.base.render',
        event: diagnostic.event,
        data: diagnostic.data,
      })
    },
    clearForPart: (partKey: string, displayMode: DisplayMode): void => {
      for (const [identity, source] of reported) {
        if (source.partKey === partKey && source.displayMode === displayMode) reported.delete(identity)
      }
    },
  })
}
