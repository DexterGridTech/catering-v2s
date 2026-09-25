import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const nativeAppsRootRelative = 'apps/terminal/application/android'
const requiredAppConfigFiles = Object.freeze([
  'App.tsx',
  'index.ts',
  'src/assembly/platformPorts.ts',
])
const requiredRootConfigFiles = Object.freeze([
  'babel.config.cjs',
  'tsconfig.json',
  'global.d.ts',
  'metro.config.js',
  'tailwind.config.cjs',
  'nativewind-env.d.ts',
])
const densities = Object.freeze(['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'])
const expectedAdaptiveLayers = Object.freeze([
  ['background', '@mipmap/ic_launcher_background'],
  ['foreground', '@mipmap/ic_launcher_foreground'],
  ['monochrome', '@mipmap/ic_launcher_monochrome'],
])
const splashConsumer = 'app/src/main/res/values/styles.xml#Theme.App.SplashScreen/windowSplashScreenAnimatedIcon'

const requireFromHere = createRequire(import.meta.url)
const {DOMParser} = requireFromHere('@xmldom/xmldom')

function fail(message) {
  throw new Error(message)
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function readJson(filePath) {
  try {
    return JSON.parse(readText(filePath))
  } catch (error) {
    fail(`invalid JSON ${filePath}: ${error.message}`)
  }
}

function assertValue(condition, message) {
  if (!condition) fail(message)
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) fail(`${message}; actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`)
}

function sorted(values) {
  return [...new Set(values)].sort()
}

function assertSetEqual(label, actual, expected) {
  assert.deepEqual(sorted(actual), sorted(expected), `${label} mismatch`)
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function assertRelativePath(parent, relative, label) {
  const candidate = path.resolve(parent, relative)
  assertValue(isInside(parent, candidate), `${label} escapes its owner directory: ${relative}`)
  return candidate
}

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return []
  const output = []
  const entries = fs.readdirSync(directory, {withFileTypes: true})
  for (const entry of entries) {
    const candidate = path.join(directory, entry.name)
    if (entry.isDirectory()) output.push(...walkFiles(candidate))
    else if (entry.isFile()) output.push(candidate)
  }
  return output.sort()
}

function parseXml(filePath) {
  const errors = []
  const document = new DOMParser({
    errorHandler: {
      warning: message => errors.push(`warning: ${message}`),
      error: message => errors.push(`error: ${message}`),
      fatalError: message => errors.push(`fatal: ${message}`),
    },
  }).parseFromString(readText(filePath), 'text/xml')
  assertValue(errors.length === 0, `${filePath} XML parse errors: ${errors.join('; ')}`)
  assertValue(document.documentElement?.nodeName !== 'parsererror', `${filePath} is not valid XML`)
  return document
}

function elementChildren(document, tagName) {
  return Array.from(document.getElementsByTagName(tagName))
}

function elementWithAttribute(document, tagName, attribute, value) {
  return elementChildren(document, tagName).find(element => element.getAttribute(attribute) === value)
}

function itemValues(style) {
  return new Map(Array.from(style?.getElementsByTagName('item') ?? []).map(item => [
    item.getAttribute('name'),
    item.textContent.trim(),
  ]))
}

function pngInfo(filePath) {
  const buffer = fs.readFileSync(filePath)
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  assertValue(buffer.subarray(0, signature.length).equals(signature), `${filePath} is not a PNG`)
  assertValue(buffer.length >= 24, `${filePath} is too short to contain PNG dimensions`)
  return {
    dimensions: `${buffer.readUInt32BE(16)}×${buffer.readUInt32BE(20)}`,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
  }
}

function tableCells(line) {
  const cells = line.trim().split('|')
  if (cells[0] === '') cells.shift()
  if (cells.at(-1) === '') cells.pop()
  return cells.map(cell => cell.trim())
}

function unquoteTableCell(cell) {
  return cell.replace(/^`|`$/g, '').trim()
}

function readAssetRegistry(appDirectory) {
  const readmePath = path.join(appDirectory, 'assets/README.md')
  assertValue(fs.existsSync(readmePath), `${appDirectory} is missing assets/README.md`)
  const lines = readText(readmePath).split(/\r?\n/)
  const headerIndex = lines.findIndex(line => line.includes('| relative path |') && line.includes('| owner |') && line.includes('| sha256 |'))
  assertValue(headerIndex >= 0, `${readmePath} must contain the closed asset registry header`)
  const headers = tableCells(lines[headerIndex]).map(unquoteTableCell)
  const expectedHeaders = ['relative path', 'owner', 'consumer', 'reason', 'dimensions', 'sha256']
  assert.deepEqual(headers, expectedHeaders, `${readmePath} asset registry columns drifted`)

  const records = new Map()
  for (const line of lines.slice(headerIndex + 2)) {
    if (!line.trim().startsWith('|')) break
    const cells = tableCells(line).map(unquoteTableCell)
    if (cells.length !== expectedHeaders.length) fail(`${readmePath} has malformed asset row: ${line}`)
    const [relativePath, owner, consumer, reason, dimensions, sha256] = cells
    assertValue(relativePath.length > 0 && !relativePath.startsWith('/') && !relativePath.includes('..'), `${readmePath} asset path is not relative: ${relativePath}`)
    assertValue(owner === 'app-config', `${readmePath} app asset has invalid owner: ${owner}`)
    assertValue(consumer.length > 0 && reason.length > 0, `${readmePath} asset ${relativePath} needs consumer and reason`)
    assertValue(/^\d+×\d+$/.test(dimensions), `${readmePath} asset ${relativePath} has invalid dimensions`)
    assertValue(/^[0-9a-f]{64}$/.test(sha256), `${readmePath} asset ${relativePath} has invalid sha256`)
    assertValue(!records.has(relativePath), `${readmePath} duplicates asset ${relativePath}`)
    records.set(relativePath, {relativePath, owner, consumer, reason, dimensions, sha256})
  }
  assertValue(records.size > 0, `${readmePath} has no asset registry rows`)
  return records
}

function normalizeAssetReference(reference, label) {
  assertValue(typeof reference === 'string', `${label} must be a string`)
  const normalized = reference.replace(/^\.\//, '')
  assertValue(normalized.startsWith('assets/'), `${label} must point into assets/: ${reference}`)
  const relativePath = normalized.slice('assets/'.length)
  assertValue(relativePath.length > 0 && !relativePath.startsWith('/') && !relativePath.includes('..'), `${label} escapes assets/: ${reference}`)
  return relativePath
}

function assertAppAssets(appDirectory, appJson) {
  const records = readAssetRegistry(appDirectory)
  const assetsDirectory = path.join(appDirectory, 'assets')
  const files = walkFiles(assetsDirectory)
    .filter(filePath => path.basename(filePath) !== 'README.md')
    .map(filePath => path.relative(assetsDirectory, filePath).split(path.sep).join('/'))
  assertSetEqual(`${appDirectory} app asset closure`, [...records.keys()], files)

  const expo = appJson.expo ?? {}
  const references = [
    ['icon.png', expo.icon, 'app.json:expo.icon'],
    ['android-icon-foreground.png', expo.android?.adaptiveIcon?.foregroundImage, 'app.json:expo.android.adaptiveIcon.foregroundImage'],
    ['android-icon-background.png', expo.android?.adaptiveIcon?.backgroundImage, 'app.json:expo.android.adaptiveIcon.backgroundImage'],
    ['android-icon-monochrome.png', expo.android?.adaptiveIcon?.monochromeImage, 'app.json:expo.android.adaptiveIcon.monochromeImage'],
    ['favicon.png', expo.web?.favicon, 'app.json:expo.web.favicon'],
  ]
  for (const [expectedPath, reference, consumer] of references) {
    const relativePath = normalizeAssetReference(reference, consumer)
    assertEqual(relativePath, expectedPath, `${consumer} asset path drifted`)
    const filePath = assertRelativePath(assetsDirectory, relativePath, consumer)
    assertValue(fs.existsSync(filePath), `${consumer} points at missing file ${relativePath}`)
    const info = pngInfo(filePath)
    const record = records.get(relativePath)
    assertValue(record !== undefined, `${consumer} has no registry row for ${relativePath}`)
    assertEqual(record.consumer, consumer, `${relativePath} consumer drifted`)
    assertEqual(record.dimensions, info.dimensions, `${relativePath} dimensions drifted`)
    assertEqual(record.sha256, info.sha256, `${relativePath} sha256 drifted`)
  }
}

function assertNativeAssets(appDirectory) {
  const androidDirectory = path.join(appDirectory, 'android')
  const resourceRoot = path.join(androidDirectory, 'app/src/main/res')
  const registryPath = path.join(androidDirectory, 'native-resource-registry.json')
  assertValue(fs.existsSync(registryPath), `${appDirectory} is missing android/native-resource-registry.json`)
  const registry = readJson(registryPath)
  assertEqual(registry.schemaVersion, 1, `${registryPath} schemaVersion drifted`)
  assertValue(Array.isArray(registry.resources), `${registryPath} resources must be an array`)
  assertEqual(registry.resources.length, densities.length, `${registryPath} must register every splash density exactly once`)

  const actualSplashPaths = walkFiles(resourceRoot)
    .filter(filePath => /drawable-(?:mdpi|hdpi|xhdpi|xxhdpi|xxxhdpi)\/splashscreen_logo\.png$/.test(filePath))
    .map(filePath => path.relative(androidDirectory, filePath).split(path.sep).join('/'))
  assertSetEqual(`${registryPath} native splash closure`, registry.resources.map(resource => resource.path), actualSplashPaths)

  const seen = new Set()
  for (const resource of registry.resources) {
    assertValue(typeof resource.path === 'string' && !resource.path.startsWith('/') && !resource.path.includes('..'), `${registryPath} has unsafe resource path`)
    assertValue(!seen.has(resource.path), `${registryPath} duplicates ${resource.path}`)
    seen.add(resource.path)
    assertEqual(resource.owner, 'native-resource', `${registryPath} ${resource.path} owner drifted`)
    assertEqual(resource.consumer, splashConsumer, `${registryPath} ${resource.path} consumer drifted`)
    assertValue(typeof resource.reason === 'string' && resource.reason.length > 0, `${registryPath} ${resource.path} needs reason`)
    const filePath = assertRelativePath(androidDirectory, resource.path, `${registryPath} ${resource.path}`)
    assertValue(fs.existsSync(filePath), `${registryPath} points at missing ${resource.path}`)
    const info = pngInfo(filePath)
    assertEqual(resource.dimensions, info.dimensions, `${registryPath} ${resource.path} dimensions drifted`)
    assertEqual(resource.sha256, info.sha256, `${registryPath} ${resource.path} sha256 drifted`)
  }
}

function assertAdaptiveResources(appDirectory) {
  const resourceRoot = path.join(appDirectory, 'android/app/src/main/res')
  for (const fileName of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
    const filePath = path.join(resourceRoot, 'mipmap-anydpi-v26', fileName)
    const document = parseXml(filePath)
    assertEqual(document.documentElement.nodeName, 'adaptive-icon', `${filePath} root drifted`)
    for (const [tagName, expectedDrawable] of expectedAdaptiveLayers) {
      const element = elementChildren(document, tagName)[0]
      assertValue(element !== undefined, `${filePath} is missing ${tagName}`)
      assertEqual(element.getAttribute('android:drawable'), expectedDrawable, `${filePath} ${tagName} input drifted`)
    }
  }
  for (const density of densities) {
    for (const layer of ['ic_launcher', 'ic_launcher_background', 'ic_launcher_foreground', 'ic_launcher_monochrome', 'ic_launcher_round']) {
      const filePath = path.join(resourceRoot, `mipmap-${density}/${layer}.webp`)
      assertValue(fs.existsSync(filePath), `${filePath} is missing from the Android resource compiler input`)
    }
  }
}

function assertAndroidIdentity(appDirectory, appJson, packageJson) {
  const appName = path.basename(appDirectory)
  const expo = appJson.expo ?? {}
  const androidPackage = expo.android?.package
  assertEqual(expo.name, appName, `${appName} app.json expo.name drifted`)
  assertEqual(expo.slug, appName, `${appName} app.json expo.slug drifted`)
  assertEqual(packageJson.name, `@catering-v2s/application-android-${appName}`, `${appName} workspace package name drifted`)
  assertValue(packageJson.dependencies?.['@catering-v2s/application-base-android'] === 'workspace:*', `${appName} must consume application-base-android through workspace dependency`)
  assertValue(typeof androidPackage === 'string' && androidPackage.length > 0, `${appName} app.json android.package is missing`)

  const gradlePath = path.join(appDirectory, 'android/app/build.gradle')
  const gradle = readText(gradlePath)
  const namespace = gradle.match(/\bnamespace\s+['"]([^'"]+)['"]/)?.[1]
  const applicationId = gradle.match(/\bapplicationId\s+['"]([^'"]+)['"]/)?.[1]
  assertEqual(namespace, androidPackage, `${appName} Gradle namespace disagrees with app.json`)
  assertEqual(applicationId, androidPackage, `${appName} Gradle applicationId disagrees with app.json`)

  const settingsPath = path.join(appDirectory, 'android/settings.gradle')
  const settings = readText(settingsPath)
  const rootProjectName = settings.match(/\brootProject\.name\s*=\s*['"]([^'"]+)['"]/)?.[1]
  assertEqual(rootProjectName, appName, `${appName} settings rootProject.name drifted`)
  assertValue(/expoAutolinking\.useExpoModules\(\)/.test(settings), `${appName} settings lost Expo module linking`)

  for (const fileName of ['MainActivity.kt', 'MainApplication.kt']) {
    const matches = walkFiles(path.join(appDirectory, 'android/app/src/main/java'))
      .filter(filePath => path.basename(filePath) === fileName)
    assertEqual(matches.length, 1, `${appName} must have one ${fileName}`)
    const source = readText(matches[0])
    const packageName = source.match(/^package\s+([\w.]+)/m)?.[1]
    assertEqual(packageName, androidPackage, `${appName} ${fileName} package declaration drifted`)
    if (fileName === 'MainActivity.kt') {
      const nativeRegistryOffset = source.indexOf('TerminalNativeLoadingRegistry.registerApplication(application)')
      const registerOffset = source.indexOf('SplashScreenManager.registerOnActivity(this)')
      const superOffset = source.indexOf('super.onCreate(null)')
      assertValue(nativeRegistryOffset >= 0 && registerOffset > nativeRegistryOffset && superOffset > registerOffset, `${appName} MainActivity must register native loading and splash before super.onCreate(null)`)
      assertValue(!source.includes('setTheme('), `${appName} MainActivity must not add a competing setTheme call`)
    }
  }

  const manifestPath = path.join(appDirectory, 'android/app/src/main/AndroidManifest.xml')
  const manifest = parseXml(manifestPath)
  const application = elementChildren(manifest, 'application')[0]
  assertValue(application !== undefined, `${appName} manifest has no application`)
  assertEqual(application.getAttribute('android:name'), '.MainApplication', `${appName} manifest application class drifted`)
  assertEqual(application.getAttribute('android:label'), '@string/app_name', `${appName} manifest label entry drifted`)
  assertEqual(application.getAttribute('android:icon'), '@mipmap/ic_launcher', `${appName} manifest icon entry drifted`)
  assertEqual(application.getAttribute('android:roundIcon'), '@mipmap/ic_launcher_round', `${appName} manifest roundIcon entry drifted`)
  assertEqual(application.getAttribute('android:theme'), '@style/AppTheme', `${appName} manifest application theme drifted`)
  const activity = elementWithAttribute(manifest, 'activity', 'android:name', '.MainActivity')
  assertValue(activity !== undefined, `${appName} manifest has no .MainActivity`)
  assertEqual(activity.getAttribute('android:theme'), '@style/Theme.App.SplashScreen', `${appName} activity splash theme drifted`)

  const stringsPath = path.join(appDirectory, 'android/app/src/main/res/values/strings.xml')
  const strings = parseXml(stringsPath)
  const appNameString = elementWithAttribute(strings, 'string', 'name', 'app_name')
  assertValue(appNameString !== undefined, `${appName} strings.xml has no app_name`)
  assertEqual(appNameString.textContent.trim(), appName, `${appName} native app_name drifted`)

  const colors = parseXml(path.join(appDirectory, 'android/app/src/main/res/values/colors.xml'))
  assertValue(elementWithAttribute(colors, 'color', 'name', 'colorPrimary') !== undefined, `${appName} colors.xml has no colorPrimary`)
  const stylesPath = path.join(appDirectory, 'android/app/src/main/res/values/styles.xml')
  const styles = parseXml(stylesPath)
  const splashStyle = elementWithAttribute(styles, 'style', 'name', 'Theme.App.SplashScreen')
  assertValue(splashStyle !== undefined, `${appName} has no Theme.App.SplashScreen`)
  assertEqual(splashStyle.getAttribute('parent'), 'Theme.SplashScreen', `${appName} splash style parent drifted`)
  const splashItems = itemValues(splashStyle)
  assertEqual(splashItems.get('windowSplashScreenBackground'), '@color/colorPrimary', `${appName} splash background input drifted`)
  assertEqual(splashItems.get('windowSplashScreenAnimatedIcon'), '@drawable/splashscreen_logo', `${appName} splash icon input drifted`)
  assertEqual(splashItems.get('postSplashScreenTheme'), '@style/AppTheme', `${appName} post splash theme drifted`)
  assertValue(elementWithAttribute(styles, 'style', 'name', 'AppTheme') !== undefined, `${appName} has no post-splash AppTheme`)

  assertAdaptiveResources(appDirectory)
  assertNativeAssets(appDirectory)
  assertAppAssets(appDirectory, appJson)
}

function normalizeMetro(source) {
  return source.replace(
    /globalCssPath:\s*'@catering-v2s\/ui-integration-[a-z0-9-]+-console\/theme\/global\.css',/g,
    "globalCssPath: '<INTEGRATION_GLOBAL_CSS>',",
  )
}

function normalizeTailwind(source) {
  const normalized = source.replace(
    /'\.\.\/\.\.\/\.\.\/ui\/integration\/[a-z0-9-]+\/src\/\*\*\/\*\.\{ts,tsx\}',/g,
    "'<INTEGRATION_SRC>',",
  )
  assertValue(!normalized.includes('darkMode'), 'TER apps must not carry a darkMode difference')
  return normalized
}

function normalizeNativewindEnv(source, appName) {
  const generatedNote = '// NOTE: This file should not be edited and should be committed with your source code. It is generated by NativeWind.\n'
  const noteCount = source.split(generatedNote).length - 1
  if (appName === 'sample-terminal') assertEqual(noteCount, 1, `${appName} nativewind-env generated note drifted`)
  else assertEqual(noteCount, 0, `${appName} nativewind-env contains an unregistered generated note`)
  return source.replace(generatedNote, '').replace(/\s+$/, '\n')
}

function assertClosedRootConfigs(apps) {
  for (const app of apps) {
    const appName = path.basename(app.directory)
    for (const relativePath of requiredRootConfigFiles) {
      assertValue(fs.existsSync(path.join(app.directory, relativePath)), `${appName} missing root config ${relativePath}`)
    }
    const entries = fs.readdirSync(app.directory, {withFileTypes: true})
    for (const entry of entries) {
      if (!entry.isFile()) continue
      assertValue(!/^\.babelrc(?:\..+)?$/.test(entry.name), `${appName} has private Babel config ${entry.name}`)
      assertValue(!/^\.config\./.test(entry.name), `${appName} has unregistered private config ${entry.name}`)
      if (/\.d\.ts$/.test(entry.name)) {
        assertValue(['global.d.ts', 'nativewind-env.d.ts'].includes(entry.name), `${appName} has private declaration ${entry.name}`)
      }
    }
    const packageJson = readJson(path.join(app.directory, 'package.json'))
    for (const field of ['babel', 'metro', 'tailwind', 'nativewind']) {
      assertValue(packageJson[field] === undefined, `${appName} package.json has private ${field} configuration`)
    }
    const babel = readText(path.join(app.directory, 'babel.config.cjs'))
    const metro = readText(path.join(app.directory, 'metro.config.js'))
    const tailwind = readText(path.join(app.directory, 'tailwind.config.cjs'))
    assertValue(babel.includes('createBabelConfig'), `${appName} Babel config does not use the shared helper`)
    assertValue(metro.includes('createMetroConfig'), `${appName} Metro config does not use the shared helper`)
    assertValue(tailwind.includes('createTailwindConfig'), `${appName} Tailwind config does not use the shared helper`)
  }

  const [first, second] = apps
  const exactFiles = ['babel.config.cjs', 'tsconfig.json', 'global.d.ts']
  for (const relativePath of exactFiles) {
    assertEqual(
      readText(path.join(first.directory, relativePath)),
      readText(path.join(second.directory, relativePath)),
      `${relativePath} must be byte-identical between App shells`,
    )
  }
  assertEqual(normalizeMetro(readText(path.join(first.directory, 'metro.config.js'))), normalizeMetro(readText(path.join(second.directory, 'metro.config.js'))), 'metro.config.js differs outside integration global.css')
  assertEqual(normalizeTailwind(readText(path.join(first.directory, 'tailwind.config.cjs'))), normalizeTailwind(readText(path.join(second.directory, 'tailwind.config.cjs'))), 'tailwind.config.cjs differs outside closed allowed values')
  assertEqual(normalizeNativewindEnv(readText(path.join(first.directory, 'nativewind-env.d.ts')), path.basename(first.directory)), normalizeNativewindEnv(readText(path.join(second.directory, 'nativewind-env.d.ts')), path.basename(second.directory)), 'nativewind-env.d.ts differs outside generator output')
}

function discoverApps(root) {
  const appsRoot = path.join(root, nativeAppsRootRelative)
  assertValue(fs.existsSync(appsRoot), `missing ${nativeAppsRootRelative}`)
  const entries = fs.readdirSync(appsRoot, {withFileTypes: true})
    .filter(entry => entry.isDirectory() && !['base', 'node_modules', 'build', 'dist', '.gradle'].includes(entry.name))
  const directories = new Map(entries.map(entry => [entry.name, path.join(appsRoot, entry.name)]))
  const packageDirectories = [...directories].filter(([, directory]) => fs.existsSync(path.join(directory, 'package.json'))).map(([name]) => name)
  const appConfigDirectories = [...directories].filter(([, directory]) => fs.existsSync(path.join(directory, 'app.json'))).map(([name]) => name)
  const androidDirectories = [...directories].filter(([, directory]) => fs.existsSync(path.join(directory, 'android/app/src/main'))).map(([name]) => name)
  for (const [label, names] of [['package.json', packageDirectories], ['app.json', appConfigDirectories], ['android/app/src/main', androidDirectories]]) {
    assertValue(names.length > 0, `App discovery input ${label} is empty`)
  }
  const union = sorted([...packageDirectories, ...appConfigDirectories, ...androidDirectories])
  const intersection = union.filter(name => packageDirectories.includes(name) && appConfigDirectories.includes(name) && androidDirectories.includes(name))
  assertSetEqual('App discovery input intersection', intersection, union)
  assertValue(intersection.length >= 2, `App discovery found fewer than two complete App shells: ${intersection.join(', ')}`)

  return intersection.sort().map(name => {
    const directory = directories.get(name)
    for (const relativePath of requiredAppConfigFiles) {
      assertValue(fs.existsSync(path.join(directory, relativePath)), `${name} is missing App entry ${relativePath}`)
    }
    const packageJson = readJson(path.join(directory, 'package.json'))
    const appJson = readJson(path.join(directory, 'app.json'))
    return {name, directory, packageJson, appJson}
  })
}

export function checkNativeProjection(root = repositoryRoot) {
  const apps = discoverApps(root)
  assertClosedRootConfigs(apps)
  for (const app of apps) assertAndroidIdentity(app.directory, app.appJson, app.packageJson)
  const applicationIds = new Map()
  for (const app of apps) {
    const applicationId = app.appJson.expo?.android?.package
    const previous = applicationIds.get(applicationId)
    if (previous !== undefined) {
      fail(`applicationId collision: ${previous} and ${app.name} both use ${applicationId}`)
    }
    applicationIds.set(applicationId, app.name)
  }
  return apps.map(app => app.name)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const apps = checkNativeProjection()
    console.log(`TERMINAL_NATIVE_PROJECTION=PASS APPS=${apps.join(',')}`)
  } catch (error) {
    console.error(`TERMINAL_NATIVE_PROJECTION=FAIL ${error.message}`)
    process.exitCode = 1
  }
}
