import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const toolsRoot = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(toolsRoot, '../..')
const uiStateSource = path.join(repositoryRoot, 'apps/terminal/kernel/base/ui-state')
const displayContextSource = path.join(repositoryRoot, 'apps/terminal/kernel/base/display-context')
const vitestPath = path.join(repositoryRoot, 'node_modules/.bin/vitest')

const packageNames = Object.freeze([
  'contracts',
  'display-context',
  'platform-ports',
  'runtime',
  'state',
])

const copyPackage = (source, target) => {
  fs.cpSync(source, target, {
    recursive: true,
    filter: (candidate) => !candidate.includes(`${path.sep}.turbo${path.sep}`)
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

const createSandbox = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ter-ui-state-behavior-'))
  const baseRoot = path.join(root, 'apps/terminal/kernel/base')
  const uiStateRoot = path.join(baseRoot, 'ui-state')
  const nodeModulesRoot = path.join(root, 'node_modules')
  fs.mkdirSync(baseRoot, {recursive: true})
  fs.copyFileSync(
    path.join(repositoryRoot, 'apps/terminal/tsconfig.base.json'),
    path.join(root, 'apps/terminal/tsconfig.base.json'),
  )
  copyPackage(uiStateSource, uiStateRoot)
  copyPackage(displayContextSource, path.join(baseRoot, 'display-context'))
  for (const packageName of packageNames) {
    if (packageName === 'display-context') continue
    fs.symlinkSync(
      path.join(repositoryRoot, 'apps/terminal/kernel/base', packageName),
      path.join(baseRoot, packageName),
      'dir',
    )
  }
  fs.mkdirSync(path.join(nodeModulesRoot, '@catering-v2s'), {recursive: true})
  for (const packageName of packageNames) {
    fs.symlinkSync(
      path.join(baseRoot, packageName),
      path.join(nodeModulesRoot, '@catering-v2s', `kernel-base-${packageName}`),
      'dir',
    )
  }
  for (const packageName of ['@reduxjs/toolkit', 'typescript', 'vitest']) {
    fs.mkdirSync(path.dirname(path.join(nodeModulesRoot, packageName)), {recursive: true})
    fs.symlinkSync(
      path.join(repositoryRoot, 'node_modules', packageName),
      path.join(nodeModulesRoot, packageName),
      'dir',
    )
  }
  return Object.freeze({root, uiStateRoot, displayContextRoot: path.join(baseRoot, 'display-context')})
}

const runVitest = (sandbox, testNamePattern, testFile = 'test/acceptance.test.ts') => {
  const result = spawnSync(vitestPath, [
    'run',
    '--config',
    'vitest.config.ts',
    testFile,
    '-t',
    testNamePattern,
  ], {
    cwd: sandbox.uiStateRoot,
    encoding: 'utf8',
    env: {...process.env, FORCE_COLOR: '0'},
  })
  if (result.error) throw result.error
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  return Object.freeze({status: result.status ?? 1, output})
}

const printTail = (output) => {
  const lines = output.trim().split('\n')
  console.log(lines.slice(Math.max(0, lines.length - 10)).join('\n'))
}

const mutations = Object.freeze([
  {
    id: 'U1',
    testNamePattern: 'U-1 reads',
    apply: (sandbox) => replaceOnce(
      path.join(sandbox.uiStateRoot, 'src/selectors/selectContent.ts'),
      'requireDisplayMode(displayMode)].containers[',
      "requireDisplayMode('PRIMARY')].containers[",
    ),
  },
  {
    id: 'U2',
    testNamePattern: 'U-2 preserves',
    apply: (sandbox) => replaceOnce(
      path.join(sandbox.uiStateRoot, 'src/selectors/selectContent.ts'),
      `const selectCurrentContentState = (root: StateRoot) => readContentState(root, resolveWorkspace({
  instanceMode: selectRuntimeInstanceMode(root),
  displayRole: selectDisplayRole(root),
}))`,
      "const selectCurrentContentState = (root: StateRoot) => readContentState(root, 'MAIN')",
    ),
  },
  {
    id: 'U3',
    testNamePattern: 'U-3 rejects',
    apply: (sandbox) => replaceOnce(
      path.join(sandbox.uiStateRoot, 'src/features/actors/contentActors.ts'),
      'if (current.contentSets[payload.displayMode].layers.some(layer => layer.layerId === payload.layerId)) {',
      'if (false) {',
    ),
  },
  {
    id: 'U4',
    testNamePattern: 'U-4 writes',
    apply: (sandbox) => replaceOnce(
      path.join(sandbox.uiStateRoot, 'src/features/actors/contentActors.ts'),
      'const displayMode = requireDisplayMode(record.displayMode, commandName)',
      "const displayMode = requireDisplayMode('PRIMARY', commandName)",
    ),
  },
  {
    id: 'U5',
    testNamePattern: 'U-5 keeps',
    apply: (sandbox) => replaceOnce(
      path.join(sandbox.uiStateRoot, 'src/features/actors/contentActors.ts'),
      `  const workspace = currentWorkspace(context)
  const before = readContentState(context.getState(), workspace)`,
      `  const workspace: WorkspaceKey = 'MAIN'
  const before = readContentState(context.getState(), workspace)`,
    ),
  },
  {
    id: 'U6',
    testNamePattern: 'U-6 applies',
    apply: (sandbox) => replaceOnce(
      path.join(sandbox.uiStateRoot, 'src/foundations/variableSlices.ts'),
      "shouldPersistEntry: entryKey => registry.get(entryKey)?.persistIntent === 'owner-only',",
      'shouldPersistEntry: () => true,',
    ),
  },
  {
    id: 'U6_CLEAR',
    testNamePattern: 'U-6 applies',
    apply: (sandbox) => replaceOnce(
      path.join(sandbox.uiStateRoot, 'src/features/actors/variableActors.ts'),
      'family.actions.clearUiVariables(payload)',
      'family.actions.setUiVariables({entries: []})',
    ),
  },
  {
    id: 'U6_FORGED',
    testNamePattern: 'U-6 applies',
    apply: (sandbox) => replaceOnce(
      path.join(sandbox.uiStateRoot, 'src/application/createUiStateModule.ts'),
      'if (registered === undefined || registered !== declaration) {',
      'if (registered === undefined) {',
    ),
  },
  {
    id: 'U7',
    testNamePattern: 'U-7 restores',
    apply: (sandbox) => replaceOnce(
      path.join(sandbox.uiStateRoot, 'src/foundations/workspaceSlices.ts'),
      '      containers: parseContainers(raw),',
      `      containers: parseContainers(raw),
      layers: [{layerId: 'persisted-layer', partKey: 'persisted-layer', openedAt: 0}],`,
    ),
  },
  {
    id: 'U8',
    testNamePattern: 'U-8 gives',
    apply: (sandbox) => replaceOnce(
      path.join(sandbox.uiStateRoot, 'src/foundations/uiVariable.ts'),
      '        key: `${moduleName}.${localKey}`,',
      '        key: localKey,',
    ),
  },
  {
    id: 'U8_REGISTRATION',
    testNamePattern: 'U-8 rejects',
    apply: (sandbox) => replaceOnce(
      path.join(sandbox.uiStateRoot, 'src/application/createUiStateModule.ts'),
      '    assertUiVariableDeclaration(declaration)\n',
      '    if (typeof declaration !== \'object\' || declaration === null) throw new Error(\'[ui-state] variable declaration must be an object\')\n',
    ),
  },
  {
    id: 'U9',
    testNamePattern: 'U-9 builds',
    apply: (sandbox) => replaceOnce(
      path.join(sandbox.uiStateRoot, 'src/foundations/catalog.ts'),
      '    if (keys.has(next.partKey)) throw new Error(`[ui-state] duplicate partKey: ${next.partKey}`)',
      '    if (false) throw new Error(`[ui-state] duplicate partKey: ${next.partKey}`)',
    ),
  },
  {
    id: 'U9_SYMBOL',
    testNamePattern: 'U-9 builds',
    apply: (sandbox) => replaceOnce(
      path.join(sandbox.uiStateRoot, 'src/foundations/catalog.ts'),
      '  const actual = Reflect.ownKeys(entry)',
      '  const actual = Object.keys(entry)',
    ),
  },
  {
    id: 'U9_REGISTER',
    testNamePattern: 'U-9 builds',
    apply: (sandbox) => replaceOnce(
      path.join(sandbox.uiStateRoot, 'src/foundations/catalog.ts'),
      '  return Object.freeze({entries: frozenEntries, byPartKey: createIndex(frozenEntries)})',
      '  return Object.freeze({entries: frozenEntries, byPartKey: createIndex(frozenEntries), register: () => undefined})',
    ),
  },
  {
    id: 'U10',
    testNamePattern: 'U-10 filters',
    apply: (sandbox) => replaceOnce(
      path.join(sandbox.uiStateRoot, 'src/features/actors/contentActors.ts'),
      "  const partKey = requireString(record, 'partKey', commandName)",
      "  const partKey = requireString(record, 'partKey', commandName)\n  if (partKey === 'not-listed') throw new Error('[ui-state] catalog admission')",
    ),
  },
  {
    id: 'U11',
    testNamePattern: 'U-11 keeps',
    apply: (sandbox) => replaceOnce(
      path.join(sandbox.displayContextRoot, 'src/foundations/displayDerivation.ts'),
      "    : {allowed: false, reasonCode: 'multiple-physical-displays'}",
      "    : {allowed: true, reasonCode: 'allowed'}",
    ),
  },
])

const baseline = createSandbox()
try {
  const result = runVitest(baseline, 'ui-state approved acceptance proofs')
  if (result.status !== 0) {
    printTail(result.output)
    throw new Error(`acceptance baseline failed with status ${result.status}`)
  }
  console.log('UI_STATE_BEHAVIOR_BASELINE=PASS tests=12')
  printTail(result.output)
} finally {
  fs.rmSync(baseline.root, {recursive: true, force: true})
}

for (const mutation of mutations) {
  const sandbox = createSandbox()
  try {
    mutation.apply(sandbox)
    const result = runVitest(sandbox, mutation.testNamePattern)
    if (result.status === 0) {
      printTail(result.output)
      throw new Error(`${mutation.id} mutation did not turn its focused proof red`)
    }
    console.log(`UI_STATE_BEHAVIOR_RED_${mutation.id}=PASS mutation_exit=${result.status}`)
    printTail(result.output)
  } finally {
    fs.rmSync(sandbox.root, {recursive: true, force: true})
  }
}

console.log('UI_STATE_BEHAVIOR_CLEANUP=PASS')
