import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  RENDER_STATIC_RULE_NAMES,
  RENDER_STATIC_SUPPORT_CHECK_COUNT,
  renderRoot,
  runRenderStaticChecks,
} from './check-static.mjs'

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'terminal-render-static-'))

function rule(report, name) {
  const result = report.results.find(candidate => candidate.name === name)
  assert.ok(result, `render static report must contain ${name}`)
  return result
}

function assertVector(report, failingRules = [], supportStatus = 'PASS') {
  const expectedFailures = new Set(failingRules)
  for (const result of report.results) {
    assert.equal(
      result.status,
      expectedFailures.has(result.name) ? 'FAIL' : 'PASS',
      `${result.name} status drifted during targeted mutation: ${result.error ?? ''}`,
    )
  }
  assert.equal(report.support.status, supportStatus, report.support.error)
}

function withMutation(relativePath, mutate, assertion) {
  const filePath = path.join(fixtureRoot, relativePath)
  const original = fs.readFileSync(filePath, 'utf8')
  try {
    fs.writeFileSync(filePath, mutate(original))
    assertion(runRenderStaticChecks({renderPackageRoot: fixtureRoot}))
  } finally {
    fs.writeFileSync(filePath, original)
  }
}

try {
  fs.cpSync(renderRoot, fixtureRoot, {
    recursive: true,
    filter(source) {
      return !source.split(path.sep).includes('node_modules')
    },
  })

  assert.deepEqual(RENDER_STATIC_RULE_NAMES, [
    'render-public-surface',
    'render-package-boundary',
    'render-source-forbidden-apis',
    'render-source-forbidden-keys',
    'render-hooks-unconditional',
    'render-surface-props-required',
    'render-test-wiring',
  ])
  assert.equal(RENDER_STATIC_SUPPORT_CHECK_COUNT, 1)
  assertVector(runRenderStaticChecks({renderPackageRoot: fixtureRoot}))

  withMutation(
    'src/index.ts',
    source => `${source}\nexport const unexpectedRenderExport = 1\n`,
    report => {
      console.log(`RENDER_STATIC_RED_PUBLIC=${rule(report, 'render-public-surface').status}`)
      assertVector(report, ['render-public-surface'])
      assert.match(rule(report, 'render-public-surface').error, /unexpectedRenderExport/)
    },
  )

  const requiredPublicExportMutations = [
    [
      'USE_DISPATCH_COMMAND',
      source => source.replace("export {useDispatchCommand} from './hooks/useDispatchCommand';\n", ''),
      /useDispatchCommand/,
    ],
    [
      'USE_UI_VARIABLE',
      source => source.replace("export {useUiVariable} from './hooks/useUiVariable';\n", ''),
      /useUiVariable/,
    ],
    [
      'DISPATCH_WITH_REQUEST_ID',
      source => source.replace("export {dispatchWithRequestId} from './foundations/dispatchWithRequestId';\n", ''),
      /dispatchWithRequestId/,
    ],
    [
      'USE_REQUEST_IN_FLIGHT',
      source => source.replace('useRequestInFlight, ', ''),
      /useRequestInFlight/,
    ],
    [
      'USE_TRACKED_REQUEST',
      source => source.replace(', useTrackedRequest', ''),
      /useTrackedRequest/,
    ],
  ]
  for (const [label, mutate, expectedMissingExport] of requiredPublicExportMutations) {
    withMutation(
      'src/index.ts',
      mutate,
      report => {
        console.log(`RENDER_STATIC_RED_PUBLIC_MISSING_${label}=${rule(report, 'render-public-surface').status}`)
        assertVector(report, ['render-public-surface'])
        assert.match(rule(report, 'render-public-surface').error, expectedMissingExport)
      },
    )
  }

  withMutation(
    'package.json',
    source => {
      const packageJson = JSON.parse(source)
      packageJson.dependencies.react = '19.2.3'
      return `${JSON.stringify(packageJson, null, 2)}\n`
    },
    report => {
      console.log(`RENDER_STATIC_RED_BOUNDARY=${rule(report, 'render-package-boundary').status}`)
      assertVector(report, ['render-package-boundary'])
      assert.match(rule(report, 'render-package-boundary').error, /runtime dependencies/)
    },
  )

  withMutation(
    'src/components/RenderProvider.tsx',
    source => `${source}\nimport {getStore} from '@catering-v2s/kernel-base-runtime'\nconst forbiddenStoreProbe = getStore\nvoid forbiddenStoreProbe\n`,
    report => {
      console.log(`RENDER_STATIC_RED_API=${rule(report, 'render-source-forbidden-apis').status}`)
      assertVector(report, ['render-source-forbidden-apis'])
      assert.match(rule(report, 'render-source-forbidden-apis').error, /getStore/)
    },
  )

  const forbiddenImportMutations = [
    [
      'define-command',
      source => `${source}\nimport {defineCommand} from '@catering-v2s/kernel-base-runtime'\nvoid defineCommand\n`,
      /defineCommand/,
    ],
    [
      'runtime-module',
      source => `${source}\nimport type {RuntimeModule} from '@catering-v2s/kernel-base-runtime'\nvoid (null as unknown as RuntimeModule)\n`,
      /RuntimeModule/,
    ],
    [
      'runtime-handle',
      source => `${source}\nimport type {Runtime} from '@catering-v2s/kernel-base-runtime'\nconst forbiddenRuntime = null as unknown as Runtime\nvoid forbiddenRuntime\n`,
      /Runtime/,
    ],
    [
      'create-runtime',
      source => `${source}\nimport {createRuntime} from '@catering-v2s/kernel-base-runtime'\nvoid createRuntime\n`,
      /createRuntime/,
    ],
    [
      'create-slice',
      source => `${source}\nimport {createSlice} from '@reduxjs/toolkit'\nconst forbiddenSlice = createSlice({name: 'illegal', initialState: {}, reducers: {}})\nvoid forbiddenSlice\n`,
      /createSlice/,
    ],
    [
      'react-redux',
      source => `${source}\nimport {useDispatch} from 'react-redux'\nvoid useDispatch\n`,
      /react-redux/,
    ],
  ]
  for (const [label, mutate, expectedError] of forbiddenImportMutations) {
    withMutation(
      'src/components/RenderProvider.tsx',
      mutate,
      report => {
        console.log(`RENDER_STATIC_RED_IMPORT_${label.toUpperCase().replaceAll('-', '_')}=${rule(report, 'render-source-forbidden-apis').status}`)
        assertVector(report, ['render-source-forbidden-apis'])
        assert.match(rule(report, 'render-source-forbidden-apis').error, expectedError)
      },
    )
  }

  const stateRootImport = source => `${source}\nimport type {StateRoot as RuntimeStateRoot} from '@catering-v2s/kernel-base-state'\ntype ForbiddenRoot = RuntimeStateRoot\nvoid (null as unknown as ForbiddenRoot)\n`
  withMutation(
    'src/types/props.ts',
    stateRootImport,
    report => {
      console.log(`RENDER_STATIC_RED_STATE_ROOT_IMPORT=${rule(report, 'render-source-forbidden-apis').status}`)
      assertVector(report, ['render-source-forbidden-apis'])
      assert.match(rule(report, 'render-source-forbidden-apis').error, /StateRoot/)
    },
  )
  withMutation(
    'src/types/props.ts',
    source => stateRootImport(source).replace('StateRoot as RuntimeStateRoot', 'StateRoot as RenamedRoot'),
    report => {
      console.log(`RENDER_STATIC_RED_RENAMED_STATE_ROOT=${rule(report, 'render-source-forbidden-apis').status}`)
      assertVector(report, ['render-source-forbidden-apis'])
      assert.match(rule(report, 'render-source-forbidden-apis').error, /StateRoot/)
    },
  )
  withMutation(
    'src/types/props.ts',
    source => `${source}\ntype ImportedRoot = import('@catering-v2s/kernel-base-state').StateRoot\nvoid (null as unknown as ImportedRoot)\n`,
    report => {
      console.log(`RENDER_STATIC_RED_STATE_ROOT_IMPORT_TYPE=${rule(report, 'render-source-forbidden-apis').status}`)
      assertVector(report, ['render-source-forbidden-apis'])
      assert.match(rule(report, 'render-source-forbidden-apis').error, /StateRoot/)
    },
  )
  withMutation(
    'src/types/props.ts',
    source => `${source}\ntype ImportedStateModule = typeof import('@catering-v2s/kernel-base-state')\ntype ImportedRoot = ImportedStateModule['StateRoot']\nvoid (null as unknown as ImportedRoot)\n`,
    report => {
      console.log(`RENDER_STATIC_RED_STATE_NAMESPACE_TYPE=${rule(report, 'render-source-forbidden-apis').status}`)
      assertVector(report, ['render-source-forbidden-apis'])
      assert.match(rule(report, 'render-source-forbidden-apis').error, /kernel-base-state/)
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
      'src/types/props.ts',
      mutate,
      report => {
        console.log(`RENDER_STATIC_RED_CAPABILITY_${label.toUpperCase().replaceAll('-', '_')}=${rule(report, 'render-source-forbidden-apis').status}`)
        assertVector(report, ['render-source-forbidden-apis'])
        assert.match(rule(report, 'render-source-forbidden-apis').error, expectedError)
      },
    )
  }

  withMutation(
    'src/foundations/definePart.ts',
    source => `${source}\nconst DEFAULT_PART_KEY = 'ui.base.default-alert'\nvoid DEFAULT_PART_KEY\n`,
    report => {
      console.log(`RENDER_STATIC_RED_KEY=${rule(report, 'render-source-forbidden-keys').status}`)
      assertVector(report, ['render-source-forbidden-keys'])
      assert.match(rule(report, 'render-source-forbidden-keys').error, /PART_KEY literal/)
    },
  )

  withMutation(
    'src/components/SurfaceRoot.tsx',
    source => `${source}\nconst conditionalHookProbe = () => true ? useSurfaceDisplayMode() : undefined\nvoid conditionalHookProbe\n`,
    report => {
      console.log(`RENDER_STATIC_RED_HOOK=${rule(report, 'render-hooks-unconditional').status}`)
      assertVector(report, ['render-hooks-unconditional'])
      assert.match(rule(report, 'render-hooks-unconditional').error, /conditional hook/)
    },
  )

  withMutation(
    'src/types/props.ts',
    source => source.replace('readonly displayMode: DisplayMode', 'readonly displayMode?: DisplayMode'),
    report => {
      console.log(`RENDER_STATIC_RED_PROPS=${rule(report, 'render-surface-props-required').status}`)
      assertVector(report, ['render-surface-props-required'])
      assert.match(rule(report, 'render-surface-props-required').error, /displayMode/)
    },
  )

  withMutation(
    'vitest.config.ts',
    source => source.replace(", 'test/**/*.test.tsx'", ''),
    report => {
      console.log(`RENDER_STATIC_RED_TSX=${rule(report, 'render-test-wiring').status}`)
      assertVector(report, ['render-test-wiring'])
      assert.match(rule(report, 'render-test-wiring').error, /\.test\.tsx/)
    },
  )
} finally {
  fs.rmSync(fixtureRoot, {recursive: true, force: true})
}

assert.equal(fs.existsSync(fixtureRoot), false, 'render static fixture must be cleaned')
console.log('RENDER_STATIC_MODEL_CLEANUP=PASS')
console.log('TERMINAL_RENDER_STATIC_MODEL_TEST=PASS')
