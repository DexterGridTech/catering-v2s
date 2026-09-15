import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export const forbiddenProductionSurfaceTokens = Object.freeze([
  '@catering-v2s/ui-base-automation',
  'ui.base.automation',
  'TerminalAutomation',
  'adbSocketDebugConfig',
  'uiautomator',
  'wrong-primary-display',
  'test.ui.sample-wallpaper-picker-failure-injection',
  'run-u8-release-cold-start',
])

const bundleEntryPattern = /(?:^|\/)(?:index\.(?:android|ios)\.bundle|[^/]+\.(?:bundle|hbc|jsbundle))$/i

const fail = message => {
  throw new Error(`TERMINAL_PRODUCTION_BUNDLE_FAILURE:${message}`)
}

const readBundleText = (filePath, entryName) => {
  const result = spawnSync('unzip', ['-p', filePath, entryName], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (result.error !== undefined) fail(`${filePath}: ${result.error.message}`)
  if (result.status !== 0) fail(`${filePath}:${entryName}: unzip exit ${result.status}: ${result.stderr ?? ''}`)
  return result.stdout ?? ''
}

const archiveEntries = filePath => {
  const result = spawnSync('unzip', ['-Z1', filePath], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  })
  if (result.error !== undefined) fail(`${filePath}: ${result.error.message}`)
  if (result.status !== 0) fail(`${filePath}: unzip listing exit ${result.status}: ${result.stderr ?? ''}`)
  return result.stdout.split(/\r?\n/).filter(Boolean)
}

const sourceEntries = (filePath, entries) => entries
  .filter(entry => bundleEntryPattern.test(entry))
  .filter(entry => !entry.includes('/META-INF/'))
  .sort()

export const inspectProductionBundleTexts = (bundles, sourceLabel = 'fixture') => {
  if (!Array.isArray(bundles) || bundles.length === 0) fail(`${sourceLabel}: no production bundle input`)
  const findings = []
  for (const bundle of bundles) {
    const text = typeof bundle === 'string' ? bundle : bundle.text
    const name = typeof bundle === 'string' ? '<fixture>' : bundle.name
    if (typeof text !== 'string' || text.length === 0) fail(`${sourceLabel}:${name}: bundle is empty`)
    for (const token of forbiddenProductionSurfaceTokens) {
      if (text.includes(token)) findings.push({name, token})
    }
  }
  if (findings.length > 0) {
    fail(`${sourceLabel}: forbidden production surface ${JSON.stringify(findings)}`)
  }
  return Object.freeze({source: sourceLabel, bundleCount: bundles.length, findings: Object.freeze([])})
}

export const inspectProductionApk = (apkPath) => {
  const resolvedPath = path.resolve(apkPath)
  if (!fs.existsSync(resolvedPath)) fail(`APK is missing: ${resolvedPath}`)
  const entries = archiveEntries(resolvedPath)
  const bundlePaths = sourceEntries(resolvedPath, entries)
  if (bundlePaths.length === 0) fail(`${resolvedPath}: no JS/Hermes production bundle entry`)
  const bundles = bundlePaths.map(name => ({name, text: readBundleText(resolvedPath, name)}))
  return inspectProductionBundleTexts(bundles, resolvedPath)
}

const fixturePath = process.argv.find((value, index) => value === '--fixture' && process.argv[index + 1])
const apkPath = process.argv.find((value, index) => value === '--apk' && process.argv[index + 1])
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (fixturePath !== undefined) {
    const filePath = path.resolve(process.argv[process.argv.indexOf(fixturePath) + 1])
    const result = inspectProductionBundleTexts([{name: filePath, text: fs.readFileSync(filePath, 'utf8')}], filePath)
    console.log(`TERMINAL_PRODUCTION_BUNDLE=${result.source} BUNDLES=${result.bundleCount}`)
  } else if (apkPath !== undefined) {
    const filePath = process.argv[process.argv.indexOf(apkPath) + 1]
    const result = inspectProductionApk(filePath)
    console.log(`TERMINAL_PRODUCTION_BUNDLE=PASS APK=${path.resolve(filePath)} BUNDLES=${result.bundleCount}`)
  } else {
    throw new Error('Usage: node tools/terminal-sample2/check-production-bundle.mjs --apk <release.apk>')
  }
}

