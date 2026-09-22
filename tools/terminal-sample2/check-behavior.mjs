import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const packageDirectories = Object.freeze({
  kernel: 'apps/terminal/kernel/feature/sample-wallpaper',
  picker: 'apps/terminal/ui/feature/sample-wallpaper-picker',
  integration: 'apps/terminal/ui/integration/sample-wallpaper-console',
  primitives: 'apps/terminal/ui/base/primitives',
})

const runPackageTest = packageKey => {
  const result = spawnSync('yarn', ['--cwd', packageDirectories[packageKey], 'test'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: {...process.env, CI: '1'},
  })
  return result
}

const read = relativePath => fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
const write = (relativePath, source) => fs.writeFileSync(path.join(repositoryRoot, relativePath), source)

const replaceExactly = (source, before, after, label) => {
  const occurrences = source.split(before).length - 1
  assert.equal(occurrences, 1, `${label} mutation anchor count=${occurrences}`)
  return source.replace(before, after)
}

const expectBaseline = packageKey => {
  const result = runPackageTest(packageKey)
  if (result.status !== 0) {
    process.stdout.write(result.stdout ?? '')
    process.stderr.write(result.stderr ?? '')
  }
  assert.equal(result.status, 0, `${packageKey} baseline focused tests must pass`)
  console.log(`SAMPLE2_${packageKey.toUpperCase()}_BASELINE=PASS`)
}

const runMutation = (id, packageKey, changes, mutationScope = 'behavior') => {
  const originals = new Map()
  try {
    for (const [relativePath, mutate] of changes) {
      const original = read(relativePath)
      originals.set(relativePath, original)
      write(relativePath, mutate(original))
    }
    const result = runPackageTest(packageKey)
    assert.notEqual(result.status, 0, `${id} mutation unexpectedly passed`)
    console.log(`SAMPLE2_${id}_RED=PASS mutation_scope=${mutationScope} mutation_exit=${result.status}`)
  } finally {
    for (const [relativePath, original] of originals) write(relativePath, original)
  }
}

const runAdmissionMutation = (id, packageKey, changes, admissionPoint) => {
  const originals = new Map()
  try {
    for (const [relativePath, mutate] of changes) {
      const original = read(relativePath)
      originals.set(relativePath, original)
      write(relativePath, mutate(original))
    }
    const result = runPackageTest(packageKey)
    assert.notEqual(result.status, 0, `${id} admission mutation unexpectedly passed`)
    console.log(`SAMPLE2_${id}_ADMISSION_REJECTED=PASS admission_point=${admissionPoint} mutation_exit=${result.status}`)
  } finally {
    for (const [relativePath, original] of originals) write(relativePath, original)
  }
}

expectBaseline('kernel')
expectBaseline('picker')
expectBaseline('integration')
expectBaseline('primitives')

runAdmissionMutation('F_A5', 'kernel', [[
  'apps/terminal/kernel/feature/sample-wallpaper/src/features/slices/slice.ts',
  source => replaceExactly(source, "persistIntent: 'owner-only'", "persistIntent: 'never'", 'F-A5 persistIntent'),
]], 'state-runtime-descriptor-invariant')

runMutation('F_A5_RUNTIME', 'kernel', [[
  'apps/terminal/kernel/feature/sample-wallpaper/src/features/slices/slice.ts',
  source => replaceExactly(
    source,
    "    {kind: 'field', stateKey: 'wallpaperId'},",
    "    {kind: 'field', stateKey: 'wallpaperId', shouldPersist: () => false},",
    'F-A5 runtime confirmed field persistence',
  ),
]])

runMutation('F_A5B', 'kernel', [[
  'apps/terminal/kernel/feature/sample-wallpaper/src/features/slices/slice.ts',
  source => replaceExactly(source, `    {
      kind: 'field',
      stateKey: 'pendingWallpaperId',
      shouldPersist: value => value !== undefined,
    },
`, '', 'F-A5b pending descriptor'),
]])

runMutation('F_A5D', 'kernel', [[
  'apps/terminal/kernel/feature/sample-wallpaper/src/features/slices/slice.ts',
  source => replaceExactly(source, 'return {wallpaperId: state.pendingWallpaperId}', 'return {wallpaperId: state.pendingWallpaperId, pendingWallpaperId: state.pendingWallpaperId}', 'F-A5d pending clear'),
]])

runMutation('F_A2', 'picker', [[
  'apps/terminal/ui/feature/sample-wallpaper-picker/src/components/WallpaperBackground.tsx',
  source => replaceExactly(
    replaceExactly(source, '  selectWallpaperId,\n', '  selectPendingWallpaperId,\n', 'F-A2 selector import'),
    'useUiStateSelector(selectWallpaperId)',
    'useUiStateSelector(selectPendingWallpaperId)',
    'F-A2 selector use',
  ),
]])

runMutation('F_A2C', 'picker', [[
  'apps/terminal/ui/feature/sample-wallpaper-picker/src/features/actors/actors.ts',
  source => replaceExactly(source, '    if (wallpaperId === effectiveWallpaperId(context)) return null\n', '    if (false) return null\n', 'F-A2c equality guard'),
]])

runMutation('F_A2A', 'integration', [
  ['apps/terminal/ui/feature/sample-wallpaper-picker/src/components/laptop/WallpaperPicker.tsx', source => replaceExactly(source, '<PrimitiveContainer testID={wallpaperPickerTestIds.root} layout="transparent">', '<PrimitiveContainer testID={wallpaperPickerTestIds.root} layout="fill">', 'F-A2a laptop picker container')],
  ['apps/terminal/ui/feature/sample-wallpaper-picker/src/components/mobile/WallpaperPicker.tsx', source => replaceExactly(source, '<PrimitiveContainer testID={wallpaperPickerTestIds.root} layout="transparent">', '<PrimitiveContainer testID={wallpaperPickerTestIds.root} layout="fill">', 'F-A2a mobile picker container')],
  ['apps/terminal/ui/integration/sample-wallpaper-console/src/components/laptop/Waiting.tsx', source => replaceExactly(source, 'layout="transparent"', 'layout="fill"', 'F-A2a waiting container')],
  ['apps/terminal/ui/integration/sample-wallpaper-console/src/components/laptop/Welcome.tsx', source => replaceExactly(source, 'layout="transparent"', 'layout="fill"', 'F-A2a welcome container')],
])

runMutation('F_A2_SCROLL', 'picker', [[
  'apps/terminal/ui/feature/sample-wallpaper-picker/src/components/laptop/WallpaperPicker.tsx',
  source => replaceExactly(source, '<PrimitiveScrollView testID={wallpaperPickerTestIds.optionsScroll} layout="transparent">', '<PrimitiveScrollView testID={wallpaperPickerTestIds.optionsScroll} layout="fill">', 'F-A2 laptop scroll viewport transparency'),
], [
  'apps/terminal/ui/feature/sample-wallpaper-picker/src/components/mobile/WallpaperPicker.tsx',
  source => replaceExactly(source, '<PrimitiveScrollView testID={wallpaperPickerTestIds.optionsScroll} layout="transparent">', '<PrimitiveScrollView testID={wallpaperPickerTestIds.optionsScroll} layout="fill">', 'F-A2 mobile scroll viewport transparency'),
]], 'component-contract')

runMutation('F_A2_TOKEN', 'primitives', [[
  'apps/terminal/ui/base/primitives/src/theme/tokens.ts',
  source => replaceExactly(
    source,
    "  scrollTransparent: 'w-full flex-1',",
    "  scrollTransparent: 'w-full flex-1 bg-canvas',",
    'F-A2 transparent token',
  ),
]])

runMutation('F_A3A', 'integration', [[
  'apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx',
  source => replaceExactly(source, '    renderChildren: () => <WallpaperBackground />', '    renderChildren: () => null', 'F-A3a secondary wallpaper'),
]])

runMutation('F_A3B', 'integration', [[
  'apps/terminal/ui/feature/sample-wallpaper-picker/src/components/WallpaperBackground.tsx',
  source => replaceExactly(
    source,
    '  const source = wallpaperId === undefined ? undefined : assetsById[wallpaperId as WallpaperId]\n',
    '  const source = assetsById.w2\n',
    'F-A3b hardcoded wallpaper',
  ),
]])

runMutation('F_A7', 'integration', [[
  'apps/terminal/ui/integration/sample-wallpaper-console/theme/global.css',
  source => replaceExactly(source, '--color-action: 159 18 57;', '--color-action: 37 99 235;', 'F-A7 blue action'),
]])

runMutation('F_A7B', 'integration', [[
  'apps/terminal/ui/integration/sample-wallpaper-console/test/theme.test.ts',
  source => replaceExactly(
    source,
    'return Math.min(direct, 360 - direct)',
    'return direct',
    'F-A7b non-circular hue distance',
  ),
]])

runAdmissionMutation('F_A9', 'integration', [[
  'apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx',
  source => replaceExactly(
    replaceExactly(source, "if (displayMode === 'SECONDARY' && assembly.surfaceDeclarations.SECONDARY === undefined) {", 'if (false) {', 'F-A9 display index guard'),
    'if (declaredSize === undefined) {', 'if (false) {', 'F-A9 declared size guard',
  ),
]], 'mobile-assembly-guard')

expectBaseline('kernel')
expectBaseline('picker')
expectBaseline('integration')
console.log('SAMPLE2_RED_MUTATION_CLEANUP=PASS')
