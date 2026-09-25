import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {checkNativeProjection} from './check-native-projection.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const sourceAppsRoot = path.join(repositoryRoot, 'apps/terminal/application/android')

function copyTree(source, destination) {
  fs.cpSync(source, destination, {
    recursive: true,
    filter: candidate => !candidate.includes('/node_modules/')
      && !candidate.includes('/android/.gradle/')
      && !candidate.includes('/android/build/')
      && !candidate.includes('/android/app/build/')
      && !candidate.includes('/dist/'),
  })
}

function walkFiles(directory) {
  const result = []
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const filePath = path.join(directory, entry.name)
    if (entry.isDirectory()) result.push(...walkFiles(filePath))
    else if (entry.isFile()) result.push(filePath)
  }
  return result
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ter-native-projection-'))
  const appsRoot = path.join(root, 'apps/terminal/application/android')
  fs.mkdirSync(appsRoot, {recursive: true})
  for (const appName of ['sample-terminal', 'sample-wallpaper-terminal']) {
    copyTree(path.join(sourceAppsRoot, appName), path.join(appsRoot, appName))
  }
  return {root, appsRoot}
}

function withFixture(mutate, label) {
  const {root, appsRoot} = fixture()
  try {
    mutate({root, appsRoot})
    assert.throws(() => checkNativeProjection(root), undefined, `${label} unexpectedly passed`)
    console.log(`TERMINAL_NATIVE_PROJECTION_RED_${label}=PASS`)
  } finally {
    fs.rmSync(root, {recursive: true, force: true})
  }
}

function withFixtureError(mutate, label, pattern) {
  const {root, appsRoot} = fixture()
  try {
    mutate({root, appsRoot})
    assert.throws(() => checkNativeProjection(root), pattern, `${label} unexpectedly passed`)
    console.log(`TERMINAL_NATIVE_PROJECTION_RED_${label}=PASS`)
  } finally {
    fs.rmSync(root, {recursive: true, force: true})
  }
}

const {root: baselineRoot} = fixture()
try {
  assert.deepEqual(checkNativeProjection(baselineRoot), ['sample-terminal', 'sample-wallpaper-terminal'])
  console.log('TERMINAL_NATIVE_PROJECTION_BASELINE=PASS')
} finally {
  fs.rmSync(baselineRoot, {recursive: true, force: true})
}

withFixture(({appsRoot}) => {
  const appPath = path.join(appsRoot, 'sample-terminal/app.json')
  const appJson = JSON.parse(fs.readFileSync(appPath, 'utf8'))
  appJson.expo.android.package = 'com.example.drifted'
  fs.writeFileSync(appPath, `${JSON.stringify(appJson, null, 2)}\n`)
}, 'APP_JSON_DRIFT')

withFixture(({appsRoot}) => {
  const configPath = path.join(appsRoot, 'sample-terminal/metro.config.js')
  const source = fs.readFileSync(configPath, 'utf8')
  fs.writeFileSync(configPath, source.replace("globalCssPath: '@catering-v2s/ui-integration-sample-console/theme/global.css',", "globalCssPath: '@catering-v2s/private/theme/global.css',"))
}, 'CONFIG_PRIVATE_DIFF')

withFixtureError(({appsRoot}) => {
  const configPath = path.join(appsRoot, 'sample-terminal/tailwind.config.cjs')
  const source = fs.readFileSync(configPath, 'utf8')
  fs.writeFileSync(configPath, `${source}\nmodule.exports.darkMode = 'class'\n`)
}, 'DARK_MODE_RESIDUAL', /TER apps must not carry a darkMode difference/)

withFixture(({appsRoot}) => {
  const registryPath = path.join(appsRoot, 'sample-terminal/android/native-resource-registry.json')
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'))
  registry.resources[0].sha256 = '0'.repeat(64)
  fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`)
}, 'NATIVE_RESOURCE_HASH_DRIFT')

withFixture(({appsRoot}) => {
  const readmePath = path.join(appsRoot, 'sample-wallpaper-terminal/assets/README.md')
  const source = fs.readFileSync(readmePath, 'utf8')
  const iconHash = source.match(/^\| `icon\.png` \|.*\| `([0-9a-f]{64})` \|$/m)?.[1]
  assert.ok(iconHash, 'APP_ASSET_HASH_DRIFT fixture could not find the current icon hash')
  fs.writeFileSync(readmePath, source.replace(iconHash, '0'.repeat(64)))
}, 'APP_ASSET_HASH_DRIFT')

withFixtureError(({appsRoot}) => {
  const sourceApp = path.join(appsRoot, 'sample-terminal')
  const targetApp = path.join(appsRoot, 'sample-wallpaper-terminal')
  const sourceJson = JSON.parse(fs.readFileSync(path.join(sourceApp, 'app.json'), 'utf8'))
  const targetJsonPath = path.join(targetApp, 'app.json')
  const targetJson = JSON.parse(fs.readFileSync(targetJsonPath, 'utf8'))
  targetJson.expo.android.package = sourceJson.expo.android.package
  fs.writeFileSync(targetJsonPath, `${JSON.stringify(targetJson, null, 2)}\n`)
  const gradlePath = path.join(targetApp, 'android/app/build.gradle')
  const gradle = fs.readFileSync(gradlePath, 'utf8')
  const originalId = gradle.match(/\bapplicationId\s+['"]([^'"]+)['"]/)?.[1]
  const originalNamespace = gradle.match(/\bnamespace\s+['"]([^'"]+)['"]/)?.[1]
  fs.writeFileSync(
    gradlePath,
    gradle
      .replaceAll(originalId, sourceJson.expo.android.package)
      .replaceAll(originalNamespace, sourceJson.expo.android.package),
  )
  const javaRoot = path.join(targetApp, 'android/app/src/main/java')
  for (const filePath of walkFiles(javaRoot)) {
    if (!filePath.endsWith('.kt') && !filePath.endsWith('.java')) continue
    const source = fs.readFileSync(filePath, 'utf8')
    fs.writeFileSync(filePath, source.replaceAll(originalNamespace, sourceJson.expo.android.package))
  }
}, 'APPLICATION_ID_COLLISION', /applicationId collision/)

withFixture(({appsRoot}) => {
  fs.rmSync(path.join(appsRoot, 'sample-wallpaper-terminal'), {recursive: true, force: true})
}, 'APP_DISCOVERY_EMPTY_INTERSECTION')

console.log('TERMINAL_NATIVE_PROJECTION_RED_MUTATION_CLEANUP=PASS')
