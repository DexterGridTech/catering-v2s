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
    source => `${source}\nexport const forbiddenStoreProbe = (source: {getStore: () => unknown}) => source.getStore()\n`,
    report => {
      console.log(`RENDER_STATIC_RED_API=${rule(report, 'render-source-forbidden-apis').status}`)
      assertVector(report, ['render-source-forbidden-apis'])
      assert.match(rule(report, 'render-source-forbidden-apis').error, /getStore/)
    },
  )

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
