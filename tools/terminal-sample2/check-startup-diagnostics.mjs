import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const packageRoot = path.join(repositoryRoot, 'apps/terminal/ui/base/console-assembly')
const sourcePath = path.join(packageRoot, 'src/foundations/startupDiagnosticsWriter.ts')

const testSource = String.raw`
import {describe, expect, it} from 'vitest'
import {createStartupDiagnosticsWriter} from './startupDiagnosticsWriter'

const createLogger = () => {
  const writes = []
  const write = (input) => {
    writes.push(input)
    return {status: 'succeeded', value: {}, completedAt: 1}
  }
  return {writes, logger: {debug: write, info: write, warn: write, error: write, scope: () => undefined, withContext: () => undefined}}
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
})

describe('startup diagnostics production writer contract', () => {
  it('writes the complete event with its run and surface identity, and rejects duplicate completion', () => {
    const {logger, writes} = createLogger()
    const writer = createStartupDiagnosticsWriter({
      logger,
      startupRunId: 'run-a',
      appName: 'sample-console',
      surfaceProvenance: {surfaceKey: 'PRIMARY', displayIndex: 0},
      clientProvenance: {clientKind: 'sample-console', clientVersion: 'test'},
      getReadiness: completeReadiness,
    })
    writer.writeComplete()
    expect(writes).toHaveLength(1)
    expect(writes[0]).toMatchObject({
      category: 'startup.complete',
      event: 'startup.complete',
      data: {
        startupRunId: 'run-a',
        appName: 'sample-console',
        surfaceProvenance: {surfaceKey: 'PRIMARY', displayIndex: 0},
        writer: 'ui.base.console-assembly',
      },
    })
    expect(() => writer.writeComplete()).toThrow(/startup\.complete was written twice/)
  })

  it('keeps two writer instances associated with distinct run identities', () => {
    const first = createLogger()
    const second = createLogger()
    createStartupDiagnosticsWriter({logger: first.logger, startupRunId: 'run-a', appName: 'one', surfaceProvenance: {displayIndex: 0}, clientProvenance: {clientKind: 'one', clientVersion: 'test'}, getReadiness: completeReadiness}).writeComplete()
    createStartupDiagnosticsWriter({logger: second.logger, startupRunId: 'run-b', appName: 'two', surfaceProvenance: {displayIndex: 0}, clientProvenance: {clientKind: 'two', clientVersion: 'test'}, getReadiness: completeReadiness}).writeComplete()
    expect(first.writes[0].data.startupRunId).toBe('run-a')
    expect(second.writes[0].data.startupRunId).toBe('run-b')
  })
})
`

const runVitest = (testPath) => spawnSync('yarn', ['vitest', 'run', testPath], {
  cwd: packageRoot,
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
})

const runMutation = (label, mutate, expectedStatus) => {
  const fixture = fs.mkdtempSync(path.join(packageRoot, 'test/.tmp-startup-diagnostics-'))
  const fixtureSource = path.join(fixture, 'startupDiagnosticsWriter.ts')
  const fixtureTest = path.join(fixture, 'startupDiagnostics.test.ts')
  const source = fs.readFileSync(sourcePath, 'utf8')
  try {
    fs.writeFileSync(fixtureSource, mutate(source))
    fs.writeFileSync(fixtureTest, testSource)
    const result = runVitest(fixtureTest)
    if ((result.status ?? -1) !== expectedStatus) {
      throw new Error(`${label}: expected vitest exit ${expectedStatus}, got ${result.status}\n${result.stdout ?? ''}${result.stderr ?? ''}`)
    }
    console.log(`TERMINAL_STARTUP_DIAGNOSTICS_${label}=PASS`)
  } finally {
    fs.rmSync(fixture, {recursive: true, force: true})
  }
}

const baseline = runMutation('BASELINE', source => source, 0)
void baseline
runMutation(
  'RED_DUPLICATE_GUARD',
  source => source.replace(
    "if (written) throw new Error(`[${input.appName}] startup.complete was written twice`)\n",
    "if (false) throw new Error(`[${input.appName}] startup.complete was written twice`)\n",
  ),
  1,
)
runMutation(
  'RED_SURFACE_IDENTITY',
  source => source.replace(
    'surfaceProvenance: input.surfaceProvenance,\n',
    "surfaceProvenance: {},\n",
  ),
  1,
)
runMutation(
  'RED_RUN_ID_PROPAGATION',
  source => source.replace(
    'startupRunId: input.startupRunId,\n',
    "startupRunId: 'constant-run',\n",
  ),
  1,
)
console.log('TERMINAL_STARTUP_DIAGNOSTICS_MUTATION_CLEANUP=PASS')
