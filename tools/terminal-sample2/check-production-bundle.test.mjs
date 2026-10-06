import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {inspectProductionBundleTexts} from './check-production-bundle.mjs'

const fixtureDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'terminal-production-bundle-'))
try {
  const baseline = inspectProductionBundleTexts([
    {
      name: 'baseline.bundle',
      text: 'function product() { return "scripts.execute @catering-v2s/ui-base-automation-agent ui.base.automation-agent" }',
    },
  ])
  assert.equal(baseline.bundleCount, 1)
  console.log('TERMINAL_PRODUCTION_BUNDLE_BASELINE=PASS')

  for (const legacyToken of ['@catering-v2s/ui-base-automation', 'ui.base.automation:']) {
    assert.throws(
      () => inspectProductionBundleTexts([{name: 'legacy-automation.bundle', text: `const entry = "${legacyToken}"`}]),
      /forbidden production surface/,
    )
  }
  console.log('TERMINAL_PRODUCTION_BUNDLE_RED_LEGACY_AUTOMATION=PASS')

  assert.throws(
    () => inspectProductionBundleTexts([
      {name: 'automation-mutation.bundle', text: 'const entry = "ui.base.automation"'},
    ]),
    /forbidden production surface/,
  )
  console.log('TERMINAL_PRODUCTION_BUNDLE_RED_AUTOMATION=PASS')

  const mutationPath = path.join(fixtureDirectory, 'mutation.bundle')
  fs.writeFileSync(mutationPath, 'const entry = "test.ui.sample-wallpaper-picker-failure-injection"\n')
  assert.throws(() => inspectProductionBundleTexts([
    {name: mutationPath, text: fs.readFileSync(mutationPath, 'utf8')},
  ]), /forbidden production surface/)
  console.log('TERMINAL_PRODUCTION_BUNDLE_RED_TEST_INJECTION=PASS')
} finally {
  fs.rmSync(fixtureDirectory, {recursive: true, force: true})
}
assert.equal(fs.existsSync(fixtureDirectory), false)
console.log('TERMINAL_PRODUCTION_BUNDLE_RED_MUTATION_CLEANUP=PASS')
