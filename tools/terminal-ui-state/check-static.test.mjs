import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  UI_STATE_RULE_NAMES,
  UI_STATE_SUPPORT_CHECK_COUNT,
  repoRoot,
  runUiStateStaticChecks,
  uiStateRoot,
} from './check-static.mjs'

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'terminal-ui-state-static-'))
let check = () => runUiStateStaticChecks({uiStatePackageRoot: fixtureRoot})

function rule(report, name) {
  const result = report.results.find(candidate => candidate.name === name)
  assert.ok(result, `ui-state static report must contain ${name}`)
  return result
}

function assertVector(report, failingRules = [], supportStatus = 'PASS') {
  const expectedFailures = new Set(failingRules)
  for (const result of report.results) {
    assert.equal(
      result.status,
      expectedFailures.has(result.name) ? 'FAIL' : 'PASS',
      `${result.name} status drifted: ${result.error ?? ''}`,
    )
  }
  assert.equal(report.support.status, supportStatus, report.support.error)
}

function printVector(id, report) {
  const rules = report.results.map(result => `${result.name}:${result.status}`).join(',')
  console.log(`${id}=${rules};support=${report.support.status}`)
}

function withMutation(relativePath, mutate, assertion) {
  const filePath = path.join(fixtureRoot, relativePath)
  const original = fs.readFileSync(filePath, 'utf8')
  try {
    fs.writeFileSync(filePath, mutate(original))
    assertion(check())
  } finally {
    fs.writeFileSync(filePath, original)
  }
}

try {
  fs.cpSync(uiStateRoot, fixtureRoot, {
    recursive: true,
    filter(source) {
      return !source.split(path.sep).includes('node_modules')
    },
  })

  assert.deepEqual(UI_STATE_RULE_NAMES, [
    'ui-state-public-surface',
    'ui-state-owner-kind',
    'ui-state-test-skeleton',
    'ui-state-package-boundary',
    'ui-state-skeleton-graph',
    'ui-state-rtk-action-form',
    'ui-state-workspace-reuse',
    'ui-state-catalog-state-boundary',
  ])
  assert.equal(UI_STATE_SUPPORT_CHECK_COUNT, 1)
  const fixtureGraph = path.join(fixtureRoot, 'skeleton-graph.ts')
  fs.copyFileSync(path.join(repoRoot, 'apps/terminal/skeleton-graph.ts'), fixtureGraph)
  check = () => runUiStateStaticChecks({uiStatePackageRoot: fixtureRoot, skeletonGraphPath: fixtureGraph})
  assertVector(check())

  withMutation(
    'src/index.ts',
    source => `${source}\nexport const unexpectedUiStateExport = 1\n`,
    report => {
      assertVector(report, ['ui-state-public-surface'])
      assert.match(rule(report, 'ui-state-public-surface').error, /unexpectedUiStateExport/)
    },
  )

  withMutation(
    'src/moduleName.ts',
    source => source.replace("export const moduleKind = 'owner' as const", "export const moduleKind = 'toolkit' as const"),
    report => {
      assertVector(report, ['ui-state-owner-kind'])
      assert.match(rule(report, 'ui-state-owner-kind').error, /moduleKind/)
    },
  )

  withMutation(
    'terminal-invariants.json',
    source => source.replace('"kind": "REAL_TESTS"', '"kind": "NO_TEST_FILES"').replace(', "runner": "vitest"', ''),
    report => assertVector(report, ['ui-state-test-skeleton']),
  )

  withMutation(
    'package.json',
    source => {
      const manifest = JSON.parse(source)
      delete manifest.dependencies['@reduxjs/toolkit']
      return `${JSON.stringify(manifest, null, 2)}\n`
    },
    report => {
      printVector('UI_STATE_RED_DIRECT_RTK', report)
      assertVector(report, ['ui-state-package-boundary'])
    },
  )

  for (const dependency of [
    '@catering-v2s/kernel-base-contracts',
    '@catering-v2s/kernel-base-display-context',
    '@catering-v2s/kernel-base-platform-ports',
    '@catering-v2s/kernel-base-runtime',
    '@catering-v2s/kernel-base-state',
  ]) {
    withMutation(
      'package.json',
      source => {
        const manifest = JSON.parse(source)
        delete manifest.dependencies[dependency]
        return `${JSON.stringify(manifest, null, 2)}\n`
      },
      report => {
        printVector(
          `UI_STATE_RED_WORKSPACE_${dependency.split('/').at(-1).replaceAll('-', '_').toUpperCase()}`,
          report,
        )
        assertVector(report, ['ui-state-package-boundary'])
      },
    )
  }

  withMutation(
    'src/dependencies.ts',
    source => `${source}\nimport {moduleName as unexpected} from '@catering-v2s/kernel-base-workflow'\nvoid unexpected\n`,
    report => {
      printVector('UI_STATE_RED_UNDECLARED_IMPORT', report)
      assertVector(report, ['ui-state-package-boundary'])
    },
  )

  withMutation(
    'src/dependencies.ts',
    source => `import React from 'react'\nvoid React\n${source}`,
    report => {
      printVector('UI_STATE_RED_NO_REACT', report)
      assertVector(report, ['ui-state-package-boundary'])
    },
  )

  withMutation(
    'src/dependencies.ts',
    source => `${source}\nconst readyToEnter = true\nvoid readyToEnter\n`,
    report => {
      printVector('UI_STATE_RED_NO_QUEUE', report)
      assertVector(report, ['ui-state-package-boundary'])
    },
  )

  withMutation(
    'src/dependencies.ts',
    source => `${source}\ntype UiStatePersistMode = 'never' | 'owner-only'\n`,
    report => {
      printVector('UI_STATE_RED_NO_OWN_PERSISTENCE_TYPE', report)
      assertVector(report, ['ui-state-package-boundary'])
    },
  )

  withMutation(
    'src/dependencies.ts',
    source => `${source}\nconst rogueLayerPersistence = {persistence: [{getEntries: (state: {layers: readonly unknown[]}) => ({layers: state.layers})}]}\nvoid rogueLayerPersistence\n`,
    report => {
      printVector('UI_STATE_RED_LAYER_PERSISTENCE', report)
      assertVector(report, ['ui-state-package-boundary'])
    },
  )

  withMutation(
    'src/dependencies.ts',
    source => `${source}\nconst rogueSync = {syncIntent: 'master-to-slave', sync: {}}\nvoid rogueSync\n`,
    report => {
      printVector('UI_STATE_RED_SYNC_DECLARATION', report)
      assertVector(report, ['ui-state-package-boundary'])
    },
  )

  withMutation(
    'src/dependencies.ts',
    source => `${source}\nconst rogue = () => ({type: 'legacy/action'})\nvoid rogue\n`,
    report => {
      printVector('UI_STATE_RED_RTK_ACTION_FORM', report)
      assertVector(report, ['ui-state-rtk-action-form'])
    },
  )

  withMutation(
    'src/types/content.ts',
    source => `${source}\nconst leakedCatalogCopy = {title: 'Orders'}\nvoid leakedCatalogCopy\n`,
    report => {
      printVector('UI_STATE_RED_CATALOG_FIELD_IN_STATE', report)
      assertVector(report, ['ui-state-catalog-state-boundary'])
    },
  )

  withMutation(
    'src/types/content.ts',
    source => `${source}\ntype LeakedCatalogContainerKeys = {containerKeys: readonly string[]}\n`,
    report => {
      printVector('UI_STATE_RED_CATALOG_CONTAINER_KEYS_IN_STATE', report)
      assertVector(report, ['ui-state-catalog-state-boundary'])
    },
  )

  withMutation(
    'src/foundations/catalog.ts',
    source => source.replace("  'description',\n] as const", "  'description',\n  'unexpected',\n] as const"),
    report => {
      printVector('UI_STATE_RED_CATALOG_APPROVED_KEYS', report)
      assertVector(report, ['ui-state-catalog-state-boundary'])
    },
  )

  withMutation(
    'src/dependencies.ts',
    source => `${source}\nconst createLocalWorkspaceStateKeys = () => ({MAIN: 'local.MAIN', BRANCH: 'local.BRANCH'})\nvoid createLocalWorkspaceStateKeys\n`,
    report => {
      printVector('UI_STATE_RED_WORKSPACE_REUSE', report)
      assertVector(report, ['ui-state-workspace-reuse'])
    },
  )

  withMutation(
    'src/dependencies.ts',
    source => `${source}\nconst makeUiStateKeys = () => ({MAIN: 'local-main', BRANCH: 'local-branch'})\nvoid makeUiStateKeys\n`,
    report => {
      printVector('UI_STATE_RED_WORKSPACE_RENAMED_HELPER', report)
      assertVector(report, ['ui-state-workspace-reuse'])
    },
  )

  withMutation(
    'src/dependencies.ts',
    source => `${source}\nconst localMainKey = \`${'${moduleName}'}.MAIN\`\nvoid localMainKey\n`,
    report => {
      printVector('UI_STATE_RED_WORKSPACE_SUFFIX_CONCATENATION', report)
      assertVector(report, ['ui-state-workspace-reuse'])
    },
  )

  const graphOriginal = fs.readFileSync(fixtureGraph, 'utf8')
  try {
    fs.writeFileSync(fixtureGraph, graphOriginal.replace("kind: 'owner'", "plannedKind: 'owner'"))
    const report = check()
    printVector('UI_STATE_RED_GRAPH_KIND', report)
    assertVector(report, ['ui-state-skeleton-graph'])
  } finally {
    fs.writeFileSync(fixtureGraph, graphOriginal)
  }
} finally {
  fs.rmSync(fixtureRoot, {recursive: true, force: true})
}

assert.equal(fs.existsSync(fixtureRoot), false, 'ui-state static fixture must be cleaned')
console.log('UI_STATE_MODEL_CLEANUP=PASS')
console.log('TERMINAL_UI_STATE_STATIC_MODEL_TEST=PASS')
