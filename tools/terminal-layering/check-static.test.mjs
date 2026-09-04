import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  LAYERING_RULE_NAMES,
  LAYERING_SUPPORT_CHECK_COUNT,
  repoRoot,
  runLayeringChecks,
} from './check-static.mjs'

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'terminal-layering-static-'))

function rule(report, name) {
  const result = report.results.find(candidate => candidate.name === name)
  assert.ok(result, `layering report must contain ${name}`)
  return result
}

function assertVector(report, failingRules = []) {
  const failures = new Set(failingRules)
  for (const result of report.results) {
    assert.equal(
      result.status,
      failures.has(result.name) ? 'FAIL' : 'PASS',
      `${result.name} drifted: ${result.error ?? ''}`,
    )
  }
  assert.equal(report.support.status, 'PASS')
}

function packageFixture(relativePackage, source, fileName = 'index.ts') {
  const packageRoot = path.join(fixtureRoot, relativePackage)
  fs.mkdirSync(path.join(packageRoot, 'src'), {recursive: true})
  fs.writeFileSync(path.join(packageRoot, 'package.json'), '{}\n')
  fs.writeFileSync(path.join(packageRoot, `src/${fileName}`), source)
  return path.join(packageRoot, `src/${fileName}`)
}

function withMutation(filePath, mutate, assertion) {
  const original = fs.readFileSync(filePath, 'utf8')
  try {
    fs.writeFileSync(filePath, mutate(original))
    assertion(runLayeringChecks({root: fixtureRoot}))
  } finally {
    fs.writeFileSync(filePath, original)
  }
}

try {
  fs.mkdirSync(path.join(fixtureRoot, 'apps/terminal'), {recursive: true})
  const kernelFile = packageFixture(
    'apps/terminal/kernel/feature/fixture-session',
    "import {moduleName} from '@catering-v2s/kernel-base-contracts'\nexport {moduleName}\n",
  )
  const uiFile = packageFixture(
    'apps/terminal/ui/feature/fixture-auth',
    "import {defineCommand, type RuntimeModule} from '@catering-v2s/kernel-base-runtime'\nimport type {StateJsonValue} from '@catering-v2s/kernel-base-state'\n\nconst ownerCommand = defineCommand<Readonly<{}>>('ui.feature.fixture-auth', {name: 'probe', visibility: 'public'})\nconst ownerModule: RuntimeModule = {\n  moduleName: 'ui.feature.fixture-auth',\n  kind: 'owner',\n  dependencies: [],\n  commands: [],\n  commandDefinitions: [],\n  actors: [],\n  actorDefinitions: [],\n  slices: [],\n  stateSlices: [],\n}\nconst ownerValue = null as unknown as StateJsonValue\nvoid ownerCommand\nvoid ownerModule\nvoid ownerValue\n",
    'index.tsx',
  )
  const devHostFile = packageFixture(
    'apps/terminal/ui/base/dev-host',
    "export const hostProbe = 1\n",
    'index.tsx',
  )
  const sampleConsoleFile = packageFixture(
    'apps/terminal/ui/integration/sample-console',
    "export const consoleProbe = 1\n",
    'index.tsx',
  )

  assert.deepEqual(LAYERING_RULE_NAMES, [
    'p-5a-direction',
    'p-5c-state-edge',
    'p-10-kernel-ui-literals',
    'p-5d-ui-feature-native-elements',
  ])
  assert.equal(LAYERING_SUPPORT_CHECK_COUNT, 0)
  assertVector(runLayeringChecks({root: fixtureRoot}))

  withMutation(
    kernelFile,
    source => `${source}\nimport '@catering-v2s/ui-base-render'\n`,
    report => {
      assertVector(report, ['p-5a-direction'])
      assert.match(rule(report, 'p-5a-direction').error, /reverse dependency kernel->ui/)
      console.log(`TERMINAL_LAYERING_RED_P5A=${rule(report, 'p-5a-direction').status}`)
    },
  )

  const reverseDirectionMutations = [
    [
      're-export',
      source => `${source}\nexport {moduleName as uiModuleName} from '@catering-v2s/ui-base-render'\n`,
    ],
    [
      'dynamic-import',
      source => `${source}\nconst uiPackage = import('@catering-v2s/ui-base-render')\nvoid uiPackage\n`,
    ],
    [
      'require',
      source => `${source}\nconst uiPackage = require('@catering-v2s/ui-base-render')\nvoid uiPackage\n`,
    ],
  ]
  for (const [label, mutate] of reverseDirectionMutations) {
    withMutation(
      kernelFile,
      mutate,
      report => {
        assertVector(report, ['p-5a-direction'])
        assert.match(rule(report, 'p-5a-direction').error, /reverse dependency kernel->ui/)
        console.log(`TERMINAL_LAYERING_RED_P5A_${label.toUpperCase().replaceAll('-', '_')}=${rule(report, 'p-5a-direction').status}`)
      },
    )
  }

  withMutation(
    uiFile,
    source => `${source}\nimport type {StateRoot as RuntimeStateRoot} from '@catering-v2s/kernel-base-state'\ntype LeakedRoot = RuntimeStateRoot\nvoid (0 as unknown as LeakedRoot)\n`,
    report => {
      assertVector(report, ['p-5c-state-edge'])
      assert.match(rule(report, 'p-5c-state-edge').error, /StateRoot/)
      console.log(`TERMINAL_LAYERING_RED_P5C_STATE_ROOT_IMPORT=${rule(report, 'p-5c-state-edge').status}`)
    },
  )
  const uiNativePackageMutations = [
    ['DEV_HOST', devHostFile],
    ['SAMPLE_CONSOLE', sampleConsoleFile],
  ]
  for (const [label, filePath] of uiNativePackageMutations) {
    withMutation(
      filePath,
      source => `${source}\nimport {createElement as createControl} from 'react'\nconst illegalControl = createControl(\`terminal-button\`, {})\nvoid illegalControl\n`,
      report => {
        assertVector(report, ['p-5d-ui-feature-native-elements'])
        assert.match(rule(report, 'p-5d-ui-feature-native-elements').error, /createElement/)
        console.log(`TERMINAL_LAYERING_RED_P5D_${label}=${rule(report, 'p-5d-ui-feature-native-elements').status}`)
      },
    )
  }

  withMutation(
    uiFile,
    source => `${source}\nimport type {StateRoot as RenamedRoot} from '@catering-v2s/kernel-base-state'\ntype LeakedRoot = RenamedRoot\nvoid (0 as unknown as LeakedRoot)\n`,
    report => {
      assertVector(report, ['p-5c-state-edge'])
      assert.match(rule(report, 'p-5c-state-edge').error, /StateRoot/)
      console.log(`TERMINAL_LAYERING_RED_P5C_RENAMED_STATE_ROOT=${rule(report, 'p-5c-state-edge').status}`)
    },
  )

  withMutation(
    uiFile,
    source => `${source}\ntype ImportedRoot = import('@catering-v2s/kernel-base-state').StateRoot\nvoid (0 as unknown as ImportedRoot)\n`,
    report => {
      assertVector(report, ['p-5c-state-edge'])
      assert.match(rule(report, 'p-5c-state-edge').error, /StateRoot/)
      console.log(`TERMINAL_LAYERING_RED_P5C_STATE_ROOT_IMPORT_TYPE=${rule(report, 'p-5c-state-edge').status}`)
    },
  )
  withMutation(
    uiFile,
    source => `${source}\ntype ImportedStateModule = typeof import('@catering-v2s/kernel-base-state')\ntype ImportedRoot = ImportedStateModule['StateRoot']\nvoid (0 as unknown as ImportedRoot)\n`,
    report => {
      assertVector(report, ['p-5c-state-edge'])
      assert.match(rule(report, 'p-5c-state-edge').error, /kernel-base-state/)
      console.log(`TERMINAL_LAYERING_RED_P5C_STATE_NAMESPACE_TYPE=${rule(report, 'p-5c-state-edge').status}`)
    },
  )
  const capabilitySyntaxMutations = [
    [
      're-export',
      source => `${source}\nexport type {StateRoot as ReExportedRoot} from '@catering-v2s/kernel-base-state'\n`,
      /StateRoot/,
    ],
    [
      'dynamic-import',
      source => `${source}\nconst dynamicallyImportedState = import('@catering-v2s/kernel-base-state')\nvoid dynamicallyImportedState\n`,
      /kernel-base-state/,
    ],
    [
      'require',
      source => `${source}\nconst requiredState = require('@catering-v2s/kernel-base-state')\nvoid requiredState\n`,
      /kernel-base-state/,
    ],
  ]
  for (const [label, mutate, expectedError] of capabilitySyntaxMutations) {
    withMutation(
      uiFile,
      mutate,
      report => {
        assertVector(report, ['p-5c-state-edge'])
        assert.match(rule(report, 'p-5c-state-edge').error, expectedError)
        console.log(`TERMINAL_LAYERING_RED_P5C_${label.toUpperCase().replaceAll('-', '_')}=${rule(report, 'p-5c-state-edge').status}`)
      },
    )
  }
  console.log('TERMINAL_LAYERING_ALLOWED_UI_FEATURE_RUNTIME_OWNER=PASS')

  const uiFeatureElementMutations = [
    [
      'named-alias',
      source => `${source}\nimport {createElement as createControl} from 'react'\nconst illegalControl = createControl('terminal-button', {})\nvoid illegalControl\n`,
    ],
    [
      'namespace-alias',
      source => `${source}\nimport * as ReactAlias from 'react'\nconst illegalControl = ReactAlias.createElement('terminal-button', {})\nvoid illegalControl\n`,
    ],
  ]
  for (const [label, mutate] of uiFeatureElementMutations) {
    withMutation(
      uiFile,
      mutate,
      report => {
        assertVector(report, ['p-5d-ui-feature-native-elements'])
        assert.match(rule(report, 'p-5d-ui-feature-native-elements').error, /createElement/)
        console.log(`TERMINAL_LAYERING_RED_P5D_${label.toUpperCase().replaceAll('-', '_')}=${rule(report, 'p-5d-ui-feature-native-elements').status}`)
      },
    )
  }
  withMutation(
    uiFile,
    source => `${source}\nimport {createElement as createControl} from 'react'\nconst illegalTemplateControl = createControl(\`terminal-button\`, {})\nvoid illegalTemplateControl\n`,
    report => {
      assertVector(report, ['p-5d-ui-feature-native-elements'])
      assert.match(rule(report, 'p-5d-ui-feature-native-elements').error, /createElement/)
      console.log(`TERMINAL_LAYERING_RED_P5D_TEMPLATE_STRING=${rule(report, 'p-5d-ui-feature-native-elements').status}`)
    },
  )
  withMutation(
    uiFile,
    source => `${source}\nconst illegalHost = <terminal-button testID="terminal:button" />\nvoid illegalHost\n`,
    report => {
      assertVector(report, ['p-5d-ui-feature-native-elements'])
      assert.match(rule(report, 'p-5d-ui-feature-native-elements').error, /string host tags/)
      console.log(`TERMINAL_LAYERING_RED_P5D_JSX_HOST_TAG=${rule(report, 'p-5d-ui-feature-native-elements').status}`)
    },
  )
  withMutation(
    uiFile,
    source => `${source}\nimport {createElement as createControl} from 'react'\nconst allowedControl = createControl(ownerModule, {})\nvoid allowedControl\n`,
    report => {
      assertVector(report)
      console.log('TERMINAL_LAYERING_ALLOWED_UI_FEATURE_NATIVE_COMPONENT=PASS')
    },
  )

  const adapterFile = packageFixture(
    'apps/terminal/adapter/android/fixture-device',
    "import {moduleName} from '@catering-v2s/kernel-base-contracts'\nexport {moduleName}\n",
  )
  withMutation(
    adapterFile,
    source => `${source}\nimport '@catering-v2s/adapter-android-persist-kv'\n`,
    report => {
      assertVector(report)
      console.log('TERMINAL_LAYERING_ALLOWED_ADAPTER_SIBLING=PASS')
    },
  )
  withMutation(
    adapterFile,
    source => `${source}\nimport '@catering-v2s/ui-base-render'\n`,
    report => {
      assertVector(report, ['p-5a-direction'])
      assert.match(rule(report, 'p-5a-direction').error, /reverse dependency adapter->ui/)
      console.log(`TERMINAL_LAYERING_RED_P5A_ADAPTER_UI=${rule(report, 'p-5a-direction').status}`)
    },
  )

  const uiStateEdgeMutations = [
    [
      'create-slice',
      source => `${source}\nimport {createSlice} from '@reduxjs/toolkit'\nconst illegalSlice = createSlice({name: 'illegal', initialState: {}, reducers: {}})\nvoid illegalSlice\n`,
      /createSlice/,
    ],
    [
      'react-redux',
      source => `${source}\nimport {useDispatch} from 'react-redux'\nconst illegalDispatch = useDispatch()\nvoid illegalDispatch\n`,
      /react-redux/,
    ],
    [
      'runtime-handle',
      source => `${source}\nimport type {Runtime} from '@catering-v2s/kernel-base-runtime'\nconst illegalRuntime = null as unknown as Runtime\nvoid illegalRuntime\n`,
      /Runtime/,
    ],
    [
      'state-runtime',
      source => `${source}\nimport {createStateRuntime} from '@catering-v2s/kernel-base-state'\nvoid createStateRuntime\n`,
      /createStateRuntime/,
    ],
  ]
  for (const [label, mutate, expectedError] of uiStateEdgeMutations) {
    withMutation(
      uiFile,
      mutate,
      report => {
        assertVector(report, ['p-5c-state-edge'])
        assert.match(rule(report, 'p-5c-state-edge').error, expectedError)
        console.log(`TERMINAL_LAYERING_RED_P5C_${label.toUpperCase().replaceAll('-', '_')}=${rule(report, 'p-5c-state-edge').status}`)
      },
    )
  }

  withMutation(
    uiFile,
    source => `${source}\ntype AllowedValue = import('@catering-v2s/kernel-base-state').StateJsonValue\nvoid (0 as unknown as AllowedValue)\n`,
    report => {
      assertVector(report)
      console.log('TERMINAL_LAYERING_ALLOWED_STATE_JSON_VALUE=PASS')
    },
  )

  withMutation(
    kernelFile,
    source => `${source}\nconst partKey = 'forbidden'\nvoid partKey\n`,
    report => {
      assertVector(report, ['p-10-kernel-ui-literals'])
      assert.match(rule(report, 'p-10-kernel-ui-literals').error, /partKey/)
      console.log(`TERMINAL_LAYERING_RED_P10=${rule(report, 'p-10-kernel-ui-literals').status}`)
    },
  )

  const emptyPackageRoot = path.join(fixtureRoot, 'apps/terminal/kernel/feature/empty-feature')
  fs.mkdirSync(emptyPackageRoot, {recursive: true})
  fs.writeFileSync(path.join(emptyPackageRoot, 'package.json'), '{}\n')
  const emptyReport = runLayeringChecks({root: fixtureRoot})
  assert.equal(rule(emptyReport, 'p-10-kernel-ui-literals').status, 'FAIL')
  assert.match(rule(emptyReport, 'p-10-kernel-ui-literals').error, /no production source/)
  console.log(`TERMINAL_LAYERING_EMPTY_FEATURE_RED=${rule(emptyReport, 'p-10-kernel-ui-literals').status}`)

  fs.rmSync(path.join(fixtureRoot, 'apps/terminal/kernel/feature/fixture-session'), {recursive: true, force: true})
  fs.rmSync(path.join(fixtureRoot, 'apps/terminal/ui/feature/fixture-auth'), {recursive: true, force: true})
  fs.rmSync(path.join(fixtureRoot, 'apps/terminal/ui/base/dev-host'), {recursive: true, force: true})
  fs.rmSync(path.join(fixtureRoot, 'apps/terminal/ui/integration/sample-console'), {recursive: true, force: true})
  fs.rmSync(emptyPackageRoot, {recursive: true, force: true})
  const emptyDenominatorReport = runLayeringChecks({root: fixtureRoot})
  assert.equal(rule(emptyDenominatorReport, 'p-5c-state-edge').status, 'FAIL')
  assert.match(rule(emptyDenominatorReport, 'p-5c-state-edge').error, /denominator is empty/)
  assert.equal(rule(emptyDenominatorReport, 'p-5d-ui-feature-native-elements').status, 'FAIL')
  assert.match(rule(emptyDenominatorReport, 'p-5d-ui-feature-native-elements').error, /denominator is empty/)
  assert.equal(rule(emptyDenominatorReport, 'p-10-kernel-ui-literals').status, 'FAIL')
  assert.match(rule(emptyDenominatorReport, 'p-10-kernel-ui-literals').error, /denominator is empty/)
  console.log(`TERMINAL_LAYERING_EMPTY_DENOMINATOR_RED=p-5c-state-edge:${rule(emptyDenominatorReport, 'p-5c-state-edge').status},p-5d-ui-feature-native-elements:${rule(emptyDenominatorReport, 'p-5d-ui-feature-native-elements').status},p-10-kernel-ui-literals:${rule(emptyDenominatorReport, 'p-10-kernel-ui-literals').status}`)
} finally {
  fs.rmSync(fixtureRoot, {recursive: true, force: true})
}

assert.ok(fs.existsSync(repoRoot), 'repository root must remain available')
console.log('TERMINAL_LAYERING_MODEL_CLEANUP=PASS')
console.log('TERMINAL_LAYERING_MODEL_TEST=PASS')
