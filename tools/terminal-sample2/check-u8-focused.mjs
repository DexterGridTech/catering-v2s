import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const nativePackageRoot = path.join(repositoryRoot, 'apps/terminal/assembly/base/android')
const renderPackageRoot = path.join(repositoryRoot, 'apps/terminal/ui/base/render')
const nativeSourcePath = path.join(nativePackageRoot, 'src/foundations/nativeLoadingCapability.ts')
const readySourcePath = path.join(renderPackageRoot, 'src/components/ScreenReadyBoundary.tsx')

const cleanVitestCache = cwd => {
  const packageNodeModules = path.join(cwd, 'node_modules')
  for (const cacheDirectory of ['.vite', '.vite-temp']) {
    fs.rmSync(path.join(packageNodeModules, cacheDirectory), {recursive: true, force: true})
  }
  try {
    fs.rmdirSync(packageNodeModules)
  } catch (error) {
    if (error?.code !== 'ENOENT' && error?.code !== 'ENOTEMPTY') throw error
  }
}

const runVitest = (cwd, testPath) => {
  try {
    return spawnSync('yarn', ['vitest', 'run', testPath], {
      cwd,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    })
  } finally {
    cleanVitestCache(cwd)
  }
}

const expectExit = (label, cwd, testPath, expectedStatus) => {
  const result = runVitest(cwd, testPath)
  if ((result.status ?? -1) !== expectedStatus) {
    throw new Error(`${label}: expected vitest exit ${expectedStatus}, got ${result.status}\n${result.stdout ?? ''}${result.stderr ?? ''}`)
  }
  console.log(`TERMINAL_U8_FOCUSED_${label}=PASS`)
}

const mutateAndRun = (label, sourcePath, mutate, cwd, testPath) => {
  const original = fs.readFileSync(sourcePath, 'utf8')
  const mutated = mutate(original)
  if (mutated === original) throw new Error(`${label}: mutation did not change ${sourcePath}`)
  try {
    fs.writeFileSync(sourcePath, mutated)
    expectExit(label, cwd, testPath, 1)
  } finally {
    fs.writeFileSync(sourcePath, original)
  }
}

expectExit('BASELINE_NATIVE_GATE', nativePackageRoot, 'test/nativeLoadingCapability.test.ts', 0)
mutateAndRun(
  'RED_PREVENT_AUTO_HIDE',
  nativeSourcePath,
  source => source.replace(
    'const preventAutoHide = SplashScreen.preventAutoHideAsync().catch(error => {',
    'const preventAutoHide = Promise.resolve(true).catch(error => {',
  ),
  nativePackageRoot,
  'test/nativeLoadingCapability.test.ts',
)

expectExit('BASELINE_READY_CALLBACK', renderPackageRoot, 'test/renderSurface.test.tsx', 0)
mutateAndRun(
  'RED_READY_CALLBACK',
  readySourcePath,
  source => source.replace(
    '.then(() => onPrimarySurfaceReady?.(readyInput))',
    '.then(() => undefined)',
  ),
  renderPackageRoot,
  'test/renderSurface.test.tsx',
)

console.log('TERMINAL_U8_FOCUSED_MUTATION_CLEANUP=PASS')
