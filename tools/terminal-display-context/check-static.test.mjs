import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  DISPLAY_CONTEXT_RULE_NAMES,
  DISPLAY_CONTEXT_SUPPORT_CHECK_COUNT,
  displayContextRoot,
  runDisplayContextStaticChecks,
} from './check-static.mjs'

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'terminal-display-context-static-'))

function rule(report, name) {
  const result = report.results.find(candidate => candidate.name === name)
  assert.ok(result, `display-context static report must contain ${name}`)
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

function printVector(id, report) {
  const rules = report.results.map(result => `${result.name}:${result.status}`).join(',')
  console.log(`${id}=${rules};support=${report.support.status}`)
}

function withMutation(relativePath, mutate, assertion) {
  const filePath = path.join(fixtureRoot, relativePath)
  const original = fs.readFileSync(filePath, 'utf8')
  try {
    fs.writeFileSync(filePath, mutate(original))
    assertion(runDisplayContextStaticChecks({displayContextPackageRoot: fixtureRoot}))
  } finally {
    fs.writeFileSync(filePath, original)
  }
}

try {
  fs.cpSync(displayContextRoot, fixtureRoot, {
    recursive: true,
    filter(source) {
      return !source.split(path.sep).includes('node_modules')
    },
  })

  assert.deepEqual(DISPLAY_CONTEXT_RULE_NAMES, [
    'display-context-public-surface',
    'display-context-owner-kind',
    'display-context-restart-positive',
    'display-context-no-display-index-in-slice',
  ])
  assert.equal(DISPLAY_CONTEXT_SUPPORT_CHECK_COUNT, 1)

  assertVector(runDisplayContextStaticChecks({displayContextPackageRoot: fixtureRoot}))

  withMutation(
    'src/index.ts',
    source => `${source}\nexport const unexpectedDisplayContextExport = 1\n`,
    report => {
      printVector('DISPLAY_CONTEXT_RED_PUBLIC', report)
      assertVector(report, ['display-context-public-surface'])
      assert.match(rule(report, 'display-context-public-surface').error, /unexpectedDisplayContextExport/)
    },
  )

  withMutation(
    'src/moduleName.ts',
    source => source.replace("export const moduleKind = 'owner' as const", "export const moduleKind = 'toolkit' as const"),
    report => {
      printVector('DISPLAY_CONTEXT_RED_OWNER_KIND', report)
      assertVector(report, ['display-context-owner-kind'])
      assert.match(rule(report, 'display-context-owner-kind').error, /moduleKind/)
    },
  )

  withMutation(
    'test/restart.test.ts',
    source => source.replaceAll('display-context-restart-positive', 'display-context-restart-removed'),
    report => {
      printVector('DISPLAY_CONTEXT_RED_RESTART', report)
      assertVector(report, ['display-context-restart-positive'])
      assert.match(rule(report, 'display-context-restart-positive').error, /restart-positive/)
    },
  )

  withMutation(
    'src/types/display.ts',
    source => source.replace(
      '  displayRole: DisplayRole\n}',
      '  displayRole: DisplayRole\n  displayIndex: 0 | 1\n}',
    ),
    report => {
      printVector('DISPLAY_CONTEXT_RED_SLICE_SHAPE', report)
      assertVector(report, ['display-context-no-display-index-in-slice'])
      assert.match(rule(report, 'display-context-no-display-index-in-slice').error, /displayIndex/)
    },
  )

  withMutation(
    'terminal-invariants.json',
    source => {
      const invariant = JSON.parse(source)
      invariant.owned.test.kind = 'NO_TEST_FILES'
      return `${JSON.stringify(invariant, null, 2)}\n`
    },
    report => {
      assertVector(report, [], 'FAIL')
      assert.match(report.support.error, /REAL_TESTS/)
    },
  )
} finally {
  fs.rmSync(fixtureRoot, {recursive: true, force: true})
}

assert.equal(fs.existsSync(fixtureRoot), false, 'display-context static fixture must be cleaned')
console.log('DISPLAY_CONTEXT_MODEL_CLEANUP=PASS')
console.log('TERMINAL_DISPLAY_CONTEXT_STATIC_MODEL_TEST=PASS')
