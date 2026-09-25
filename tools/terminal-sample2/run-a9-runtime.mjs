import fs from 'node:fs'
import path from 'node:path'
import {spawn, spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const applicationRoot = path.join(repositoryRoot, 'apps/terminal/application/android/sample-wallpaper-terminal')
const packageName = 'com.catering.v2s.terminal.samplewallpaper'
const defaultSerial = process.env.TER_SAMPLE2_A9_SERIAL ?? 'emulator-5556'
const defaultPort = Number(process.env.TER_SAMPLE2_A9_PORT ?? 8081)
const defaultOutput = path.join(
  repositoryRoot,
  'doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-android/20260914-a9-runtime-run-02',
)

const args = new Map()
for (let index = 2; index < process.argv.length; index += 1) {
  const value = process.argv[index]
  if (value === '--serial') args.set('serial', process.argv[++index])
  else if (value === '--port') args.set('port', Number(process.argv[++index]))
  else if (value === '--output') args.set('output', process.argv[++index])
  else throw new Error(`unknown argument: ${value}`)
}

const serial = args.get('serial') ?? defaultSerial
const port = args.get('port') ?? defaultPort
const outputDirectory = path.resolve(args.get('output') ?? defaultOutput)

const replaceExactly = (source, before, after, label) => {
  const count = source.split(before).length - 1
  if (count !== 1) throw new Error(`${label}: expected one anchor, found ${count}`)
  return source.replace(before, after)
}

const runAdb = (adbArgs, label) => {
  const result = spawnSync('adb', ['-s', serial, ...adbArgs], {cwd: repositoryRoot, encoding: 'utf8'})
  if (result.error !== undefined) throw new Error(`${label}: ${result.error.message}`)
  if (result.status !== 0) throw new Error(`${label}: adb exit ${result.status}`)
  return result.stdout ?? ''
}

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

const waitForLog = async (state, start, predicate, label, timeoutMs = 25000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const segment = state.output.slice(start)
    if (predicate(segment)) return segment
    if (state.process.exitCode !== null) throw new Error(`${label}: Metro exited with ${state.process.exitCode}`)
    await sleep(500)
  }
  throw new Error(`${label}: timed out; logBytes=${state.output.length - start}`)
}

const writeReadback = (name, content) => fs.writeFileSync(path.join(outputDirectory, name), content)

const filteredMetroLog = output => output
  .split(/\r?\n/)
  .filter(line => /surface-created|surface-root-mounted|secondary-placement|surface-host-pending|FATAL EXCEPTION|AndroidRuntime/.test(line))
  .join('\n')

const stopMetro = async state => {
  if (state === null || state.process.exitCode !== null) return true
  state.process.kill('SIGINT')
  const deadline = Date.now() + 10000
  while (state.process.exitCode === null && Date.now() < deadline) await sleep(250)
  if (state.process.exitCode === null) {
    state.process.kill('SIGTERM')
    await sleep(500)
  }
  return state.process.exitCode !== null
}

fs.mkdirSync(outputDirectory, {recursive: true})
const mutations = [
  [
    path.join(applicationRoot, 'App.tsx'),
    source => replaceExactly(
      source,
      'renderSurface={(assembly, nextDisplayIndex) => createSurfaceForDisplayIndex(assembly, nextDisplayIndex)}',
      'renderSurface={(assembly, _nextDisplayIndex) => createSurfaceForDisplayIndex(assembly, 1)}',
      'A9 App display index mutation',
    ),
  ],
  [
    path.join(repositoryRoot, 'apps/terminal/ui/integration/sample-wallpaper-console/src/application/terminalSurfaces.ts'),
    source => replaceExactly(
      source,
      "if (surfaceForm === 'laptop') return surfaces.orientations.landscape",
      "if (surfaceForm === 'laptop' || surfaceForm === 'mobile') return surfaces.orientations.landscape",
      'A9 mobile declaration mutation',
    ),
  ],
]

const originals = new Map()
const state = {process: null, output: ''}
let businessStatus = 'NOT_RUN'
let cleanupStatus = 'NOT_RUN'
let firstFailure = null
try {
  for (const [filePath, mutate] of mutations) {
    const original = fs.readFileSync(filePath, 'utf8')
    originals.set(filePath, original)
    fs.writeFileSync(filePath, mutate(original))
  }

  state.process = spawn('yarn', ['--cwd', applicationRoot, 'start', '--port', String(port)], {
    cwd: repositoryRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  state.process.stdout.on('data', chunk => { state.output += chunk.toString() })
  state.process.stderr.on('data', chunk => { state.output += chunk.toString() })

  await waitForLog(state, 0, segment => /Waiting on http|Metro waiting on|Web is waiting on|exp:\/\//.test(segment), 'Metro startup')
  runAdb(['reverse', `tcp:${port}`, `tcp:${port}`], 'adb reverse')
  runAdb(['shell', 'am', 'force-stop', packageName], 'stop precondition')
  const mutationStart = state.output.length
  runAdb(['shell', 'monkey', '-p', packageName, '1'], 'launch mutated mobile app')
  const mutationLog = await waitForLog(
    state,
    mutationStart,
    segment => /surface-created/.test(segment)
      && /displayMode["']?\s*:\s*["']SECONDARY/.test(segment)
      && /surfaceForm["']?\s*:\s*["']mobile/.test(segment),
    'A9 mutated SECONDARY surface readback',
  )
  runAdb(['shell', 'uiautomator', 'dump', '/sdcard/ter-sample2-a9-runtime.xml'], 'mutated UI dump')
  writeReadback('a9-mutated.xml', runAdb(['exec-out', 'cat', '/sdcard/ter-sample2-a9-runtime.xml'], 'read mutated UI dump'))
  const screenshot = spawnSync('adb', ['-s', serial, 'exec-out', 'screencap', '-p'], {cwd: repositoryRoot})
  if (screenshot.error !== undefined || screenshot.status !== 0) throw new Error('mutated screenshot failed')
  fs.writeFileSync(path.join(outputDirectory, 'a9-mutated.png'), screenshot.stdout)
  writeReadback('a9-mutated-metro-filtered.log', filteredMetroLog(mutationLog))
  businessStatus = 'PASS'
} catch (error) {
  firstFailure = error instanceof Error ? error.message : String(error)
} finally {
  for (const [filePath, original] of originals) fs.writeFileSync(filePath, original)
  try {
    if (state.process !== null) {
      runAdb(['shell', 'am', 'force-stop', packageName], 'stop mutated app')
      const restoreStart = state.output.length
      await sleep(1500)
      runAdb(['shell', 'monkey', '-p', packageName, '1'], 'launch restored mobile app')
      const restoredLog = await waitForLog(
        state,
        restoreStart,
        segment => /surface-created/.test(segment) && /displayMode["']?\s*:\s*["']PRIMARY/.test(segment),
        'restored PRIMARY surface readback',
      )
      if (/displayMode["']?\s*:\s*["']SECONDARY/.test(restoredLog)) throw new Error('restored mobile app emitted SECONDARY surface')
      writeReadback('a9-restored-metro-filtered.log', filteredMetroLog(restoredLog))
    }
    runAdb(['shell', 'am', 'force-stop', packageName], 'final package cleanup')
    if (state.process !== null) {
      runAdb(['reverse', '--remove', `tcp:${port}`], 'final adb reverse cleanup')
    }
    if (!(await stopMetro(state))) throw new Error('Metro cleanup did not terminate')
    const pidResult = spawnSync('adb', ['-s', serial, 'shell', 'pidof', packageName], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    })
    if (pidResult.error !== undefined) throw new Error(`package absence readback: ${pidResult.error.message}`)
    const pidReadback = (pidResult.stdout ?? '').trim()
    if (pidResult.status === 0 && pidReadback !== '') throw new Error(`package still running: ${pidReadback}`)
    if (pidResult.status !== 0 && pidResult.status !== 1) throw new Error(`package absence readback: adb exit ${pidResult.status}`)
    cleanupStatus = 'PASS'
  } catch (error) {
    if (firstFailure === null) firstFailure = error instanceof Error ? error.message : String(error)
    cleanupStatus = 'FAIL'
  }
}

writeReadback('a9-metro-filtered.log', filteredMetroLog(state.output))

const result = {
  runId: 'ter-sample2-cp7-f-a9-runtime-20260914-02',
  serial,
  packageName,
  port,
  mutation: 'mobile App displayIndex=1 plus mobile declaration reuses landscape SECONDARY',
  business: businessStatus,
  cleanup: cleanupStatus,
  firstFailure,
}
writeReadback('a9-runtime-result.json', `${JSON.stringify(result)}\n`)
console.log(`SAMPLE2_F_A9_RUNTIME=${businessStatus} CLEANUP=${cleanupStatus} OUTPUT=${outputDirectory}`)
if (firstFailure !== null || businessStatus !== 'PASS' || cleanupStatus !== 'PASS') process.exitCode = 1
