import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const toolsRoot = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(toolsRoot, '../..')
const renderSource = path.join(repositoryRoot, 'apps/terminal/ui/base/render')
const primitivesSource = path.join(repositoryRoot, 'apps/terminal/ui/base/primitives')
const uiStateSource = path.join(repositoryRoot, 'apps/terminal/kernel/base/ui-state')
const sharedTestSupportSource = path.join(repositoryRoot, 'tools/terminal-shared')
const vitestPath = path.join(repositoryRoot, 'node_modules/.bin/vitest')

const linkedPackages = Object.freeze([
  'contracts',
  'display-context',
  'platform-ports',
  'runtime',
  'state',
])

const copyPackage = (source, target) => {
  fs.cpSync(source, target, {
    recursive: true,
    filter: candidate => !candidate.includes(`${path.sep}.turbo${path.sep}`)
      && !candidate.includes(`${path.sep}node_modules${path.sep}`),
  })
}

const replaceOnce = (filePath, before, after) => {
  const source = fs.readFileSync(filePath, 'utf8')
  const occurrences = source.split(before).length - 1
  if (occurrences !== 1) {
    throw new Error(`mutation anchor count ${occurrences} for ${filePath}`)
  }
  fs.writeFileSync(filePath, source.replace(before, after))
}

const linkNodeModule = (nodeModulesRoot, packageName, target) => {
  const linkPath = path.join(nodeModulesRoot, packageName)
  fs.mkdirSync(path.dirname(linkPath), {recursive: true})
  fs.symlinkSync(target, linkPath, 'dir')
}

const createSandbox = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'terminal-render-behavior-'))
  const terminalRoot = path.join(root, 'apps/terminal')
  const baseRoot = path.join(terminalRoot, 'kernel/base')
  const renderRoot = path.join(terminalRoot, 'ui/base/render')
  const uiStateRoot = path.join(baseRoot, 'ui-state')
  const sharedTestSupportRoot = path.join(root, 'tools/terminal-shared')
  const nodeModulesRoot = path.join(root, 'node_modules')
  fs.mkdirSync(path.dirname(renderRoot), {recursive: true})
  fs.mkdirSync(baseRoot, {recursive: true})
  fs.copyFileSync(
    path.join(repositoryRoot, 'apps/terminal/tsconfig.base.json'),
    path.join(terminalRoot, 'tsconfig.base.json'),
  )
  copyPackage(renderSource, renderRoot)
  fs.symlinkSync(primitivesSource, path.join(terminalRoot, 'ui/base/primitives'), 'dir')
  copyPackage(uiStateSource, uiStateRoot)
  fs.mkdirSync(sharedTestSupportRoot, {recursive: true})
  for (const fileName of ['react-native-vitest-entry.ts', 'react-native-vitest.setup.cjs']) {
    fs.copyFileSync(
      path.join(sharedTestSupportSource, fileName),
      path.join(sharedTestSupportRoot, fileName),
    )
  }
  for (const packageName of linkedPackages) {
    fs.symlinkSync(
      path.join(repositoryRoot, 'apps/terminal/kernel/base', packageName),
      path.join(baseRoot, packageName),
      'dir',
    )
  }

  for (const packageName of [...linkedPackages, 'ui-state']) {
    linkNodeModule(
      nodeModulesRoot,
      path.join('@catering-v2s', `kernel-base-${packageName}`),
      path.join(baseRoot, packageName),
    )
  }
  linkNodeModule(
    nodeModulesRoot,
    '@catering-v2s/ui-base-primitives',
    primitivesSource,
  )
  for (const packageName of [
    '@reduxjs/toolkit',
    '@babel/core',
    'babel-preset-expo',
    'react',
    'react-is',
    'react-test-renderer',
    'scheduler',
    'typescript',
    'use-sync-external-store',
    'vitest',
  ]) {
    linkNodeModule(nodeModulesRoot, packageName, path.join(repositoryRoot, 'node_modules', packageName))
  }
  linkNodeModule(
    nodeModulesRoot,
    'react-native',
    path.join(repositoryRoot, 'apps/terminal/node_modules/react-native'),
  )
  return Object.freeze({root, renderRoot, uiStateRoot})
}

const runVitest = (sandbox, args) => {
  const result = spawnSync(vitestPath, args, {
    cwd: sandbox.renderRoot,
    encoding: 'utf8',
    env: {...process.env, FORCE_COLOR: '0'},
    timeout: 30_000,
    killSignal: 'SIGTERM',
  })
  if (result.error && result.error.code !== 'ETIMEDOUT') throw result.error
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  return Object.freeze({
    status: result.error?.code === 'ETIMEDOUT' ? 124 : (result.status ?? 1),
    output: result.error?.code === 'ETIMEDOUT'
      ? `${output}\n[vitest timed out after 30000ms]`
      : output,
  })
}

const runAll = sandbox => runVitest(sandbox, ['run', '--config', 'vitest.config.ts'])
const runFocused = (sandbox, testFile, testName) => runVitest(
  sandbox,
  ['run', '--config', 'vitest.config.ts', testFile, '-t', testName],
)

const collectedTests = output => {
  const match = output.match(/Tests\s+(\d+)\s+(?:passed|failed|skipped)/)
  return match === null ? undefined : Number(match[1])
}

const printTail = output => {
  const lines = output.trim().split('\n')
  console.log(lines.slice(Math.max(0, lines.length - 12)).join('\n'))
}

const mutations = Object.freeze([
  {
    id: 'SURFACE_MODE',
    testFile: 'test/renderSurface.test.tsx',
    testName: 'keeps explicit PRIMARY and SECONDARY surfaces on their own content sets',
    apply: sandbox => replaceOnce(
      path.join(sandbox.renderRoot, 'src/components/SurfaceRoot.tsx'),
      '      displayMode,\n      containerKey,\n      defaultContainerPartKeys,',
      "      displayMode: 'PRIMARY',\n      containerKey,\n      surfaceForm,",
    ),
  },
  {
    id: 'FIRST_HOP',
    testFile: 'test/renderSurface.test.tsx',
    testName: 'resolves screen and layer through both catalogs and orders layers by tier/time/id',
    apply: sandbox => replaceOnce(
      path.join(sandbox.renderRoot, 'src/components/resolvePart.ts'),
      '  const entry = input.uiCatalog.byPartKey[input.placement.partKey]',
      '  const entry = undefined',
    ),
  },
  {
    id: 'TIER_SORT',
    testFile: 'test/renderSurface.test.tsx',
    testName: 'resolves screen and layer through both catalogs and orders layers by tier/time/id',
    apply: sandbox => replaceOnce(
      path.join(sandbox.renderRoot, 'src/components/LayerStack.tsx'),
      'const orderedLayers = [...layers].sort((left, right) => compareLayers({left, right, uiCatalog, rendererCatalog}))',
      'const orderedLayers = [...layers]',
    ),
  },
  {
    id: 'OVERLAY_BOUNDS',
    testFile: 'test/renderSurface.test.tsx',
    testName: 'resolves screen and layer through both catalogs and orders layers by tier/time/id',
    apply: sandbox => replaceOnce(
      path.join(sandbox.renderRoot, 'src/components/LayerStack.tsx'),
      "  stack: {\n    position: 'absolute',\n    top: 0,",
      "  stack: {\n    position: 'relative',\n    top: 0,",
    ),
  },
  {
    id: 'OVERLAY_Z_ORDER',
    testFile: 'test/renderSurface.test.tsx',
    testName: 'resolves screen and layer through both catalogs and orders layers by tier/time/id',
    apply: sandbox => replaceOnce(
      path.join(sandbox.renderRoot, 'src/components/LayerStack.tsx'),
      '    zIndex: 1000,\n    elevation: 1000,\n  },\n  backdrop:',
      '    zIndex: 0,\n    elevation: 0,\n  },\n  backdrop:',
    ),
  },
  {
    id: 'MISSING_PATH',
    testFile: 'test/renderSurface.test.tsx',
    testName: 'reports missing catalog, missing renderer, and invalid props on screen and layer paths',
    apply: sandbox => replaceOnce(
      path.join(sandbox.renderRoot, 'src/components/resolvePart.ts'),
      "    const failure = createSystemFailure('missing-renderer')",
      "    const failure = createSystemFailure('missing-renderer')\n    return {kind: 'fallback', failure, node: null}",
    ),
  },
  {
    id: 'INVALID_PROPS',
    testFile: 'test/renderSurface.test.tsx',
    testName: 'reports missing catalog, missing renderer, and invalid props on screen and layer paths',
    apply: sandbox => replaceOnce(
      path.join(sandbox.renderRoot, 'src/components/resolvePart.ts'),
      "    const failure = createContentFailure(input, 'invalid-props')",
      "    const failure = createContentFailure(input, 'invalid-props')\n    return {kind: 'resolved', node: createElement(binding.component, {})}",
    ),
  },
  {
    id: 'EMPTY_FALLBACK',
    testFile: 'test/renderSurface.test.tsx',
    testName: 'keeps transition and content failures as distinct typed fallback facts',
    apply: sandbox => replaceOnce(
      path.join(sandbox.renderRoot, 'src/components/ScreenContainer.tsx'),
      "      category: 'content',\n      reason: 'container-empty',\n      partKey: null,",
      "      category: 'content',\n      reason: 'runtime-unavailable',\n      partKey: null,",
    ),
  },
  {
    id: 'DUPLICATE_RENDERER',
    testFile: 'test/catalog.test.ts',
    testName: 'rejects duplicate renderer keys and exposes no mutation entry point',
    apply: sandbox => replaceOnce(
      path.join(sandbox.renderRoot, 'src/foundations/createRendererCatalog.ts'),
      'if (byRendererKey.has(canonical.rendererKey)) {',
      'if (false) {',
    ),
  },
  {
    id: 'CATALOG_FREEZE',
    testFile: 'test/catalog.test.ts',
    testName: 'rejects duplicate renderer keys and exposes no mutation entry point',
    apply: sandbox => replaceOnce(
      path.join(sandbox.renderRoot, 'src/foundations/createRendererCatalog.ts'),
      'return Object.freeze({resolve, tierOf, guardOf})',
      'return {resolve, tierOf, guardOf}',
    ),
  },
  {
    id: 'EXPLICIT_UNDEFINED',
    testFile: 'test/catalog.test.ts',
    testName: 'keeps omitted layerTier distinct from an own undefined layerTier',
    apply: sandbox => replaceOnce(
      path.join(sandbox.renderRoot, 'src/foundations/definePart.ts'),
      "if (hasOwn(input, 'layerTier') && input.layerTier === undefined) {",
      'if (false) {',
    ),
  },
  {
    id: 'RENDERER_BINDING_OWN_KEYS',
    testFile: 'test/catalog.test.ts',
    testName: 'rejects extra renderer binding fields at the render catalog boundary',
    apply: sandbox => replaceOnce(
      path.join(sandbox.renderRoot, 'src/foundations/createRendererCatalog.ts'),
      'return actual.length === APPROVED_RENDERER_BINDING_KEYS.length\n    && APPROVED_RENDERER_BINDING_KEYS.every(key => actual.includes(key))',
      'return APPROVED_RENDERER_BINDING_KEYS.every(key => actual.includes(key))',
    ),
  },
  {
    id: 'UI_STATE_OWN_KEYS',
    testFile: 'test/catalog.test.ts',
    testName: 'R-20 rejects extra catalog fields through the real ui-state validator',
    apply: sandbox => replaceOnce(
      path.join(sandbox.uiStateRoot, 'src/foundations/catalog.ts'),
      'if (actual.length !== approvedEntryKeys.length || approvedEntryKeys.some(key => !actual.includes(key))) {',
      'if (approvedEntryKeys.some(key => !actual.includes(key))) {',
    ),
  },
  {
    id: 'STATUS_FIRST',
    testFile: 'test/renderState.test.tsx',
    testName: 'gates getState by status and preserves snapshot identity',
    apply: sandbox => replaceOnce(
      path.join(sandbox.renderRoot, 'src/foundations/createRenderSnapshotReader.ts'),
      "if (status !== 'started') {",
      'if (false) {',
    ),
  },
  {
    id: 'SNAPSHOT_CACHE',
    testFile: 'test/renderState.test.tsx',
    testName: 'gates getState by status and preserves snapshot identity',
    apply: sandbox => replaceOnce(
      path.join(sandbox.renderRoot, 'src/foundations/createRenderSnapshotReader.ts'),
      'if (startedSnapshot !== undefined && startedRoot === root) return startedSnapshot',
      'if (false) return startedSnapshot',
    ),
  },
  {
    id: 'SELECTOR_CACHE',
    testFile: 'test/renderState.test.tsx',
    testName: 're-renders from unavailable through started to failed and caches selector results by root',
    apply: sandbox => replaceOnce(
      path.join(sandbox.renderRoot, 'src/hooks/useUiStateSelector.ts'),
      ': selector(snapshot.root),',
      ': undefined,',
    ),
  },
  {
    id: 'SELECTOR_FULL_SNAPSHOT',
    testFile: 'test/renderState.test.tsx',
    testName: 'does not re-render when an unrelated root update leaves the selected primitive equal',
    apply: sandbox => {
      const selectorFile = path.join(sandbox.renderRoot, 'src/hooks/useUiStateSelector.ts')
      replaceOnce(
        selectorFile,
        "import {useSyncExternalStoreWithSelector} from 'use-sync-external-store/with-selector'",
        "import {useSyncExternalStore} from 'use-sync-external-store/shim'",
      )
      replaceOnce(
        selectorFile,
        '  return useSyncExternalStoreWithSelector(\n'
          + '    stateSource.subscribe,\n'
          + '    snapshotReader.getSnapshot,\n'
          + '    snapshotReader.getSnapshot,\n'
          + '    selectSnapshot,\n'
          + '    equalityFn,\n'
          + '  )',
        '  return useSyncExternalStore(\n'
          + '    stateSource.subscribe,\n'
          + '    snapshotReader.getSnapshot,\n'
          + '    snapshotReader.getSnapshot,\n'
          + '  )',
      )
    },
  },
  {
    id: 'SELECTOR_NO_EQUALITY',
    testFile: 'test/renderState.test.tsx',
    testName: 'uses a narrow equality for derived values without swallowing changed fields',
    apply: sandbox => replaceOnce(
      path.join(sandbox.renderRoot, 'src/hooks/useUiStateSelector.ts'),
      '    equalityFn,\n',
      '    undefined,\n',
    ),
  },
  {
    id: 'SELECTOR_IDENTITY_STALE',
    testFile: 'test/renderState.test.tsx',
    testName: 'updates a selector when its captured input changes while the root stays the same',
    apply: sandbox => replaceOnce(
      path.join(sandbox.renderRoot, 'src/hooks/useUiStateSelector.ts'),
      '    [selector],\n',
      '    [],\n',
    ),
  },
  {
    id: 'STATUS_READS_ROOT',
    testFile: 'test/renderState.test.tsx',
    testName: 'keeps runtime status separate from an undefined business selection',
    apply: sandbox => replaceOnce(
      path.join(sandbox.renderRoot, 'src/hooks/useRenderStatus.ts'),
      '  return useSyncExternalStore(stateSource.subscribe, stateSource.getStatus, stateSource.getStatus)',
      "  return useSyncExternalStore(stateSource.subscribe, () => 'started' as RuntimeStatus, () => 'started' as RuntimeStatus)",
    ),
  },
  {
    id: 'MISSING_UNSUBSCRIBE',
    testFile: 'test/renderState.test.tsx',
    testName: 're-renders from unavailable through started to failed and caches selector results by root',
    apply: sandbox => replaceOnce(
      path.join(sandbox.renderRoot, 'src/hooks/useUiStateSelector.ts'),
      '    stateSource.subscribe,\n',
      '    listener => {\n'
        + '      stateSource.subscribe(listener)\n'
        + '      return () => {}\n'
        + '    },\n',
    ),
  },
  {
    id: 'CATALOG_EQUALITY_ALWAYS_TRUE',
    testFile: 'test/renderState.test.tsx',
    testName: 'projects catalog context with a complete shallow equality boundary',
    apply: sandbox => replaceOnce(
      path.join(sandbox.renderRoot, 'src/hooks/useUiCatalogContext.ts'),
      'return useUiStateSelector(selector, areUiCatalogContextsEqual)',
      'return useUiStateSelector(selector, () => true)',
    ),
  },
  {
    id: 'CATALOG_EQUALITY_MISSING_DISPLAY_MODE',
    testFile: 'test/renderState.test.tsx',
    testName: 'compares every catalog context field at the selector equality boundary',
    apply: sandbox => replaceOnce(
      path.join(sandbox.renderRoot, 'src/hooks/useUiCatalogContext.ts'),
      'return previous.displayMode === next.displayMode',
      'return true',
    ),
  },
  {
    id: 'CATALOG_EQUALITY_MISSING_WORKSPACE',
    testFile: 'test/renderState.test.tsx',
    testName: 'compares every catalog context field at the selector equality boundary',
    apply: sandbox => replaceOnce(
      path.join(sandbox.renderRoot, 'src/hooks/useUiCatalogContext.ts'),
      '    && previous.workspace === next.workspace',
      '    && true',
    ),
  },
  {
    id: 'CATALOG_EQUALITY_MISSING_INSTANCE_MODE',
    testFile: 'test/renderState.test.tsx',
    testName: 'compares every catalog context field at the selector equality boundary',
    apply: sandbox => replaceOnce(
      path.join(sandbox.renderRoot, 'src/hooks/useUiCatalogContext.ts'),
      '    && previous.instanceMode === next.instanceMode',
      '    && true',
    ),
  },
  {
    id: 'CATALOG_EQUALITY_MISSING_SURFACE_FORM',
    testFile: 'test/renderState.test.tsx',
    testName: 'compares every catalog context field at the selector equality boundary',
    apply: sandbox => replaceOnce(
      path.join(sandbox.renderRoot, 'src/hooks/useUiCatalogContext.ts'),
      '    && previous.surfaceForm === next.surfaceForm',
      '    && true',
    ),
  },
  {
    id: 'PROVIDER_SHARED_SNAPSHOT_READER',
    testFile: 'test/renderState.test.tsx',
    testName: 'keeps two Providers independent across roots, notifications, and teardown',
    apply: sandbox => {
      const providerFile = path.join(sandbox.renderRoot, 'src/components/RenderProvider.tsx')
      replaceOnce(
        providerFile,
        "import type {RenderProviderProps, RenderSurfaceReadyInput} from '../types/props'\n",
        "import type {RenderProviderProps, RenderSurfaceReadyInput} from '../types/props'\n\nlet sharedSnapshotReader: ReturnType<typeof createRenderSnapshotReader> | undefined\n",
      )
      replaceOnce(
        providerFile,
        'const snapshotReader = useMemo(() => createRenderSnapshotReader(stateSource), [stateSource])',
        `const snapshotReader = useMemo(() => {
    if (sharedSnapshotReader === undefined) sharedSnapshotReader = createRenderSnapshotReader(stateSource)
    return sharedSnapshotReader
  }, [stateSource])`,
      )
    },
  },
  {
    id: 'PROVIDER_SHARED_DIAGNOSTIC_REPORTER',
    testFile: 'test/renderSurface.test.tsx',
    testName: 'keeps diagnostic suppression local to each Provider',
    apply: sandbox => {
      const providerFile = path.join(sandbox.renderRoot, 'src/components/RenderProvider.tsx')
      replaceOnce(
        providerFile,
        "import type {RenderProviderProps, RenderSurfaceReadyInput} from '../types/props'\n",
        "import type {RenderProviderProps, RenderSurfaceReadyInput} from '../types/props'\n\nlet sharedDiagnosticReporter: ReturnType<typeof createRenderPartDiagnosticReporter> | undefined\n",
      )
      replaceOnce(
        providerFile,
        'const diagnosticReporter = useMemo(() => createRenderPartDiagnosticReporter(logger), [logger])',
        `const diagnosticReporter = useMemo(() => {
    if (sharedDiagnosticReporter === undefined) sharedDiagnosticReporter = createRenderPartDiagnosticReporter(logger)
    return sharedDiagnosticReporter
  }, [logger])`,
      )
    },
  },
  {
    id: 'DIAGNOSTIC_RECOVERY',
    testFile: 'test/renderSurface.test.tsx',
    testName: 'reports the same diagnostic again after content recovers',
    apply: sandbox => replaceOnce(
      path.join(sandbox.renderRoot, 'src/foundations/diagnostics.ts'),
      'if (source.partKey === partKey && source.displayMode === displayMode) reported.delete(identity)',
      'if (false) reported.delete(identity)',
    ),
  },
  {
    id: 'PROPS_ABSENT',
    testFile: 'test/renderProps.test.tsx',
    testName: 'T-11 passes props through and maps absent props to an empty object',
    apply: sandbox => replaceOnce(
      path.join(sandbox.renderRoot, 'src/components/resolvePart.ts'),
      "if (!hasOwn(placement, 'props')) return Object.freeze({props: Object.freeze({})})",
      "if (!hasOwn(placement, 'props')) return Object.freeze({invalidValue: undefined})",
    ),
  },
  {
    id: 'CROSS_UI_FILTER',
    testFile: 'test/renderContracts.test.ts',
    testName: 'T-13 excludes a layer-only declaration from a real container enumeration',
    apply: sandbox => replaceOnce(
      path.join(sandbox.uiStateRoot, 'src/foundations/catalog.ts'),
      ': entry.containerKeys.includes(containerKey)',
      ': true',
    ),
  },
  {
    id: 'CROSS_DEFINE_WIRING',
    testFile: 'test/renderContracts.test.ts',
    testName: 'R-19 preserves the empty containerKeys transfer across the real package boundary',
    apply: sandbox => replaceOnce(
      path.join(sandbox.renderRoot, 'src/foundations/definePart.ts'),
      'containerKeys: Object.freeze([...input.containerKeys]),',
      "containerKeys: Object.freeze([...input.containerKeys, 'real-container']),",
    ),
  },
  {
    id: 'CROSS_UI_FILTER_R19',
    testFile: 'test/renderContracts.test.ts',
    testName: 'R-19 preserves the empty containerKeys transfer across the real package boundary',
    apply: sandbox => replaceOnce(
      path.join(sandbox.uiStateRoot, 'src/foundations/catalog.ts'),
      ': entry.containerKeys.includes(containerKey)',
      ': true',
    ),
  },
  {
    id: 'CROSS_DEFINE_WIRING_T13',
    testFile: 'test/renderContracts.test.ts',
    testName: 'T-13 excludes a layer-only declaration from a real container enumeration',
    apply: sandbox => replaceOnce(
      path.join(sandbox.renderRoot, 'src/foundations/definePart.ts'),
      'containerKeys: Object.freeze([...input.containerKeys]),',
      "containerKeys: Object.freeze([...input.containerKeys, 'real-container']),",
    ),
  },
  {
    id: 'DISPATCH_REJECTION_DIAGNOSTIC',
    testFile: 'test/dispatchObservation.test.tsx',
    testName: 'reports rejected dispatch with a typed diagnostic while preserving rejection',
    apply: sandbox => replaceOnce(
      path.join(sandbox.renderRoot, 'src/hooks/useDispatchCommand.ts'),
      "reportRenderCommandDispatchRejection(logger, {\n      event: 'command-dispatch-rejected',\n      commandName: command.definition.commandName,\n      requestId: options.requestId,\n    })",
      'void command',
    ),
  },
  {
    id: 'DISPATCH_REJECTION_RETHROW',
    testFile: 'test/dispatchObservation.test.tsx',
    testName: 'reports rejected dispatch with a typed diagnostic while preserving rejection',
    apply: sandbox => replaceOnce(
      path.join(sandbox.renderRoot, 'src/hooks/useDispatchCommand.ts'),
      'throw error',
      "throw new Error('masked dispatch failure')",
    ),
  },
])

const assertBaseline = (sandbox, label) => {
  const result = runAll(sandbox)
  if (result.status !== 0) {
    printTail(result.output)
    throw new Error(`${label} baseline failed with status ${result.status}`)
  }
  const count = collectedTests(result.output)
  if (count === undefined || count === 0) throw new Error(`${label} baseline collected no tests`)
  return count
}

const runMutation = mutation => {
  const sandbox = createSandbox()
  try {
    const baselineCount = assertBaseline(sandbox, mutation.id)
    mutation.apply(sandbox)
    const result = runFocused(sandbox, mutation.testFile, mutation.testName)
    const targetCount = collectedTests(result.output)
    if (targetCount === undefined || targetCount === 0) {
      printTail(result.output)
      throw new Error(`${mutation.id} did not collect its focused test`)
    }
    if (result.status === 0) {
      printTail(result.output)
      throw new Error(`${mutation.id} production mutation unexpectedly passed`)
    }
    console.log(`TERMINAL_RENDER_BEHAVIOR_RED_${mutation.id}=PASS mutation_exit=${result.status} baseline_tests=${baselineCount} focused_tests=${targetCount}`)
    printTail(result.output)
  } finally {
    fs.rmSync(sandbox.root, {recursive: true, force: true})
    if (fs.existsSync(sandbox.root)) throw new Error(`${mutation.id} sandbox cleanup failed`)
  }
}

const baselineSandbox = createSandbox()
try {
  const count = assertBaseline(baselineSandbox, 'render behavior')
  console.log(`TERMINAL_RENDER_BEHAVIOR_BASELINE=PASS tests=${count}`)
} finally {
  fs.rmSync(baselineSandbox.root, {recursive: true, force: true})
  if (fs.existsSync(baselineSandbox.root)) throw new Error('render behavior baseline cleanup failed')
}

for (const mutation of mutations) runMutation(mutation)

console.log(`TERMINAL_RENDER_BEHAVIOR_RED_VECTORS=${mutations.length}`)
console.log('TERMINAL_RENDER_BEHAVIOR_CLEANUP=PASS')
