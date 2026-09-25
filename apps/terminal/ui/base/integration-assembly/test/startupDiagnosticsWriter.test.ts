import {describe, expect, it, vi} from 'vitest'
import type {LogEvent, LogWriteInput, LogWriteResult, LoggerPort} from '@catering-v2s/kernel-base-platform-ports'
import {createStartupDiagnosticsWriter} from '../src/foundations/startupDiagnosticsWriter'

const createLogger = () => {
  const writes: LogWriteInput[] = []
  const write = (input: LogWriteInput): LogWriteResult => {
    writes.push(input)
    return {status: 'succeeded', value: {} as LogEvent, completedAt: 1}
  }
  const logger: LoggerPort = {
    debug: write,
    info: write,
    warn: write,
    error: write,
    scope: () => logger,
    withContext: () => logger,
  }
  return {logger, writes}
}

const completeReadiness = () => ({
  groups: {
    modules: true,
    slices: true,
    commands: true,
    actors: true,
    ports: true,
    parts: true,
  },
  primaryDeclared: true,
  primaryMeasured: true,
  primaryRealReady: true,
  primaryReadyPartKey: 'sample.console.home',
  primaryContentFailure: null,
})

describe('startup diagnostics writer', () => {
  it('writes one structured completion for one run', () => {
    const {logger, writes} = createLogger()
    const writer = createStartupDiagnosticsWriter({
      logger,
      startupRunId: 'run-1',
      appName: 'sample-console',
      surfaceProvenance: {displayIndex: 0, surfaceKey: 'PRIMARY'},
      clientProvenance: {clientId: 'client-1', clientName: 'sample-console', owner: 'test'},
      getReadiness: completeReadiness,
    })

    writer.writeComplete()

    expect(writes).toHaveLength(1)
    expect(writes[0]).toMatchObject({
      category: 'startup.complete',
      event: 'startup.complete',
      data: {
        startupRunId: 'run-1',
        appName: 'sample-console',
        writer: 'ui.base.integration-assembly',
        primaryReadyPartKey: 'sample.console.home',
        primaryContentFailure: null,
      },
    })
  })

  it('rejects a duplicate completion instead of silently deduplicating it', () => {
    const {logger} = createLogger()
    const writer = createStartupDiagnosticsWriter({
      logger,
      startupRunId: 'run-duplicate',
      appName: 'sample-console',
      surfaceProvenance: {displayIndex: 0, surfaceKey: 'PRIMARY'},
      clientProvenance: {clientId: 'client-duplicate', clientName: 'sample-console', owner: 'test'},
      getReadiness: completeReadiness,
    })

    writer.writeComplete()

    expect(() => writer.writeComplete()).toThrow(/startup\.complete was written twice/)
  })

  it('does not hide duplicate behavior behind a logger spy', () => {
    const {logger} = createLogger()
    const writeComplete = vi.fn(createStartupDiagnosticsWriter({
      logger,
      startupRunId: 'run-spy',
      appName: 'sample-console',
      surfaceProvenance: {displayIndex: 0, surfaceKey: 'PRIMARY'},
      clientProvenance: {clientId: 'client-spy', clientName: 'sample-console', owner: 'test'},
      getReadiness: completeReadiness,
    }).writeComplete)

    writeComplete()
    expect(() => writeComplete()).toThrow()
  })
})
