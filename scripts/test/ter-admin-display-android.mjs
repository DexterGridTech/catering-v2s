#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import {spawn, spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {readProcessTable, snapshotProcessTree} from '../dev/managed-process-tree.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const runId = process.argv[2]
const serial = process.argv[3]
if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/.test(runId ?? '')) throw new Error('TER_ADMIN_DISPLAY_RUN_ID_REQUIRED')
if (!/^[A-Za-z0-9._:-]{3,100}$/.test(serial ?? '')) throw new Error('TER_ADMIN_DISPLAY_DEVICE_SERIAL_REQUIRED')
const runRoot = path.join(root, '.runtime/ter-admin-display', runId)
if (fs.existsSync(runRoot)) throw new Error('TER_ADMIN_DISPLAY_RUN_ALREADY_EXISTS')
fs.mkdirSync(runRoot, {recursive: true, mode: 0o700})
const pkg = 'com.anonymous.sampleterminal'
const appRoot = path.join(root, 'apps/terminal/application/android/sample-terminal')
const androidRoot = path.join(appRoot, 'android')
const apkPath = path.join(androidRoot, 'app/build/outputs/apk/release/app-release.apk')
const remoteXml = `/sdcard/${runId}-ui.xml`
const files = [
  'apps/terminal/application/android/sample-terminal/package.json',
  'apps/terminal/application/android/sample-terminal/android/app/build.gradle',
  'apps/terminal/application/base/android/config/index.cjs',
  'apps/terminal/ui/integration/sample-console/package.json',
  'apps/terminal/ui/integration/sample-console/tailwind.config.cjs',
  'apps/terminal/ui/base/render/src/types/runtimeFacts.ts',
  'apps/terminal/ui/base/integration-assembly/src/foundations/integrationAssembly.tsx',
  'apps/terminal/ui/base/admin-shell/src/hooks/useAdminRuntimeDisplay.ts',
  'apps/terminal/ui/base/admin-shell/src/foundations/runtimeDisplay.ts',
  'apps/terminal/ui/base/admin-shell/src/foundations/adminTestIds.ts',
  'apps/terminal/ui/base/admin-shell/src/components/sections/RuntimeSectionLaptop.tsx',
  'apps/terminal/ui/base/admin-shell/src/components/sections/RuntimeSectionMobile.tsx',
  'apps/terminal/ui/base/admin-shell/src/components/sections/DisplayContextSectionLaptop.tsx',
  'apps/terminal/ui/base/admin-shell/src/components/sections/DisplayContextSectionMobile.tsx',
  'apps/terminal/ui/base/admin-shell/src/components/AdminLauncher.tsx',
  'apps/terminal/ui/base/primitives/src/components/PrimitiveAdmin.tsx',
  'apps/terminal/adapter/android/device/android/src/main/java/com/catering/v2s/terminal/adapter/android/device/TerminalDeviceModule.kt',
  'scripts/env/check-runtime-resource-budget',
]
const sourceSha256 = createHash('sha256').update(files.map(file => `${file}\0${fs.readFileSync(path.join(root, file))}`).join('\0')).digest('hex')
const manifestPath = path.join(runRoot, 'run-manifest.json')
const manifest = {runId, serial, sourceSha256, sourceFiles: files, phase: 'PREFLIGHT', build: 'NOT_RUN', device: 'NOT_RUN', business: 'NOT_RUN', cleanup: 'NOT_RUN', firstFailure: null, artifacts: []}
const save = () => fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {mode: 0o600})
save()

const decode = value => String(value).replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&')
const nodes = xml => [...String(xml).matchAll(/<node\b[^>]*\/>|<node\b[^>]*>/g)].map(match => {
  const tag = match[0]
  const attr = key => decode(tag.match(new RegExp(`\\b${key}="([^"]*)"`))?.[1] ?? '')
  const bounds = attr('bounds').match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/)
  return {text: attr('text'), desc: attr('content-desc'), bounds: bounds === null ? null : bounds.slice(1).map(Number)}
})
const tapTarget = (xml, predicate, label) => {
  const node = nodes(xml).find(item => predicate(item) && item.bounds !== null)
  if (!node) throw new Error(`ANDROID_UI_TARGET_NOT_FOUND:${label}`)
  const [left, top, right, bottom] = node.bounds
  const x = Math.round((left + right) / 2), y = Math.round((top + bottom) / 2)
  adb(['shell', 'input', '-d', '0', 'tap', String(x), String(y)], `tap-${label}`)
}
const adb = (args, stage, {binary = false, persist = true} = {}) => {
  const result = spawnSync('adb', ['-s', serial, ...args], {cwd: root, encoding: binary ? undefined : 'utf8', maxBuffer: 24 * 1024 * 1024, timeout: 45_000})
  const code = result.status ?? -1
  if (persist) fs.writeFileSync(path.join(runRoot, `${stage}.log`), `${result.stdout?.toString?.() ?? ''}${result.stderr?.toString?.() ?? ''}`, {mode: 0o600})
  if (code !== 0) throw new Error(`ADB_STAGE_FAILED:${stage}:${code}:${String(result.stderr ?? '').slice(0, 240)}`)
  return result.stdout
}
const uiDump = () => {
  adb(['shell', 'uiautomator', 'dump', '--windows', remoteXml], 'uiautomator-dump')
  const xml = adb(['shell', 'cat', remoteXml], 'uiautomator-read', {persist: false}).toString('utf8')
  adb(['shell', 'rm', '-f', remoteXml], 'uiautomator-remove')
  return xml
}
const waitFor = async (predicate, label, timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const xml = uiDump()
    if (predicate(xml)) return xml
    await new Promise(resolve => setTimeout(resolve, 700))
  }
  throw new Error(`ANDROID_UI_STATE_TIMEOUT:${label}`)
}
const savePng = (displayId, name) => {
  const bytes = adb(['exec-out', 'screencap', '-d', String(displayId), '-p'], `screencap-${displayId}`, {binary: true, persist: false})
  if (!bytes || bytes.length < 8 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new Error(`SCREENSHOT_NOT_VALID_PNG:surfaceFlingerDisplay=${displayId}`)
  }
  const target = path.join(runRoot, name)
  fs.writeFileSync(target, bytes, {mode: 0o600})
  manifest.artifacts.push(path.relative(root, target))
}

let build = null
let buildIdentity = null
let launched = false
try {
  manifest.phase = 'RESOURCE_PREFLIGHT'; save()
  const budget = spawnSync(
    path.join(root, 'scripts/env/check-runtime-resource-budget'),
    ['--profile', 'ter-validation-with-dev', path.join(root, '.runtime')],
    {cwd: root, encoding: 'utf8'},
  )
  fs.writeFileSync(path.join(runRoot, 'resource-preflight.log'), `${budget.stdout ?? ''}${budget.stderr ?? ''}`, {mode: 0o600})
  if (budget.status !== 0) throw new Error(`RESOURCE_PREFLIGHT_FAILED:${budget.status}`)
  const state = adb(['get-state'], 'device-state').toString('utf8').trim()
  if (state !== 'device') throw new Error(`DEVICE_NOT_READY:${state}`)
  const displayOutput = adb(['shell', 'cmd', 'display', 'get-displays'], 'hardware-displays').toString('utf8')
  const displays = displayOutput.split(/(?=Display id \d+:)/).slice(1).map(block => {
    const id = block.match(/^Display id (\d+):/)?.[1]
    const real = block.match(/real (\d+) x (\d+)/)
    const state = block.match(/state (\w+)/)?.[1]
    const metrics = block.match(/DisplayMetrics\{density=([\d.]+), width=(\d+), height=(\d+)/)
    if (!id || !real || !state || !metrics) return null
    return {id: Number(id), physicalWidth: Number(real[1]), physicalHeight: Number(real[2]), state, density: Number(metrics[1]), appWidth: Number(metrics[2]), appHeight: Number(metrics[3])}
  }).filter(Boolean)
  if (displays.length !== 2 || displays[0]?.id !== 0 || displays[1]?.id === undefined) throw new Error(`DUAL_DISPLAY_HARDWARE_INVENTORY_MISMATCH:${JSON.stringify(displays)}`)
  const displaySummary = displays.map(display => ({...display, deviceLogicalWidth: Math.round(display.physicalWidth / display.density), deviceLogicalHeight: Math.round(display.physicalHeight / display.density)}))
  const surfaceFlingerOutput = adb(['shell', 'dumpsys', 'SurfaceFlinger', '--displays'], 'surfaceflinger-displays').toString('utf8')
  const surfaceFlingerDisplays = [...surfaceFlingerOutput.matchAll(/(?:^|\n)Display (\d+)\n([\s\S]*?)(?=\nDisplay \d+\n|$)/g)].map(match => ({
    id: Number(match[1]),
    connectionType: match[2].match(/connectionType=(\w+)/)?.[1] ?? 'unknown',
  }))
  const externalSurfaceFlinger = surfaceFlingerDisplays.find(item => item.connectionType === 'External')
  if (surfaceFlingerDisplays.length !== 2 || !surfaceFlingerDisplays.some(item => item.connectionType === 'Internal') || !externalSurfaceFlinger) {
    throw new Error(`SURFACEFLINGER_DISPLAY_MAPPING_UNAVAILABLE:${JSON.stringify(surfaceFlingerDisplays)}`)
  }
  fs.writeFileSync(path.join(runRoot, 'hardware-displays.json'), `${JSON.stringify(displaySummary, null, 2)}\n`, {mode: 0o600})
  manifest.hardwareDisplays = displaySummary
  manifest.secondaryDisplayId = displaySummary[1].id
  manifest.surfaceFlingerDisplays = surfaceFlingerDisplays
  manifest.secondarySurfaceFlingerDisplayId = externalSurfaceFlinger.id
  const priorProcessList = adb(['shell', 'ps', '-A'], 'prior-app-processes', {persist: false}).toString('utf8')
  if (priorProcessList.split(/\r?\n/).some(line => line.includes(pkg))) throw new Error('APP_ALREADY_RUNNING_BEFORE_MANAGED_LAUNCH')

  manifest.phase = 'BUILDING_RELEASE'; save()
  const buildLog = fs.createWriteStream(path.join(runRoot, 'gradle-release.log'), {flags: 'wx', mode: 0o600})
  build = spawn('./gradlew', ['assembleRelease', '--no-daemon', '--console=plain'], {cwd: androidRoot, detached: true, stdio: ['ignore', 'pipe', 'pipe']})
  build.stdout.pipe(buildLog); build.stderr.pipe(buildLog)
  for (let attempt = 0; attempt < 30 && buildIdentity === null; attempt += 1) {
    buildIdentity = readProcessTable().find(item => item.pid === build.pid) ?? null
    if (buildIdentity === null) await new Promise(resolve => setTimeout(resolve, 100))
  }
  if (buildIdentity === null) throw new Error('GRADLE_PROCESS_IDENTITY_READBACK_FAILED')
  manifest.buildProcess = {pid: buildIdentity.pid, pgid: buildIdentity.pgid, startToken: buildIdentity.startToken, commandSha256: buildIdentity.commandSha256, log: path.relative(root, path.join(runRoot, 'gradle-release.log'))}; save()
  const buildExit = await new Promise(resolve => build.once('close', resolve))
  buildLog.end()
  manifest.build = buildExit === 0 ? 'PASS' : 'FAIL'
  if (buildExit !== 0) throw new Error(`GRADLE_ASSEMBLE_RELEASE_FAILED:${buildExit}`)
  if (!fs.existsSync(apkPath)) throw new Error('RELEASE_APK_MISSING')
  manifest.apkSha256 = createHash('sha256').update(fs.readFileSync(apkPath)).digest('hex')

  manifest.phase = 'INSTALLING'; save()
  adb(['install', '-r', apkPath], 'install-release')
  adb(['shell', 'am', 'force-stop', pkg], 'force-stop-before-launch')
  adb(['shell', 'am', 'start', '-n', `${pkg}/.MainActivity`], 'launch-app')
  launched = true
  manifest.phase = 'ADMIN_LOGIN'; save()
  const preLoginXml = await waitFor(xml => xml.includes('sampleterminal') || nodes(xml).some(item => item.text.includes('登录')), 'app-home')
  // The app's top-left 96-logical-unit gesture is reached at this fixed, safe in-canvas point.
  for (let index = 0; index < 5; index += 1) adb(['shell', 'input', '-d', '0', 'tap', '48', '48'], `admin-gesture-${index + 1}`)
  const loginXml = await waitFor(xml => nodes(xml).some(item => item.text.includes('管理员登录')) && nodes(xml).some(item => item.text.includes('动态口令')), 'admin-login')
  const otpNode = nodes(loginXml).find(item => /\d{6}/.test(item.text))
  const digits = otpNode?.text.match(/\d{6}/)?.[0]
  if (!digits) throw new Error('ADMIN_CODE_UI_TEXT_MISSING')
  for (const [index, digit] of [...digits].entries()) tapTarget(loginXml, item => item.text.trim() === digit, `key-press-${index + 1}`)
  let afterInput = uiDump()
  tapTarget(afterInput, item => item.text.trim() === '确认' || item.desc === '验证动态口令', 'verify')
  await waitFor(xml => nodes(xml).some(item => item.text.trim() === '运行状态') || xml.includes('terminal.admin:section:runtime'), 'admin-authenticated')

  manifest.phase = 'ADMIN_RUNTIME'; save()
  let runtimeXml = uiDump()
  tapTarget(runtimeXml, item => item.text.trim() === '运行状态', 'runtime-section')
  runtimeXml = await waitFor(xml => {
    const values = nodes(xml).map(item => item.text)
    return values.some(value => value.includes('逻辑分辨率宽：1280')) && values.some(value => value.includes('副屏'))
  }, 'dual-display-runtime', 45_000)
  const textValues = nodes(runtimeXml).map(item => item.text).filter(Boolean)
  const logicalWidth = textValues.filter(value => value.includes('逻辑分辨率宽：'))
  const logicalHeight = textValues.filter(value => value.includes('逻辑分辨率高：'))
  const readiness = textValues.filter(value => value === '已就绪')
  const forbiddenDeviceAreaLabels = textValues.filter(value => value.includes('设备显示区域：'))
  const physicalWidths = textValues.filter(value => value.includes('物理长：'))
  const physicalHeights = textValues.filter(value => value.includes('物理高：'))
  const summary = {visibleSurfaceLabels: textValues.filter(value => value === '主屏' || value === '副屏'), logicalWidth, logicalHeight, readiness, forbiddenDeviceAreaLabels, physicalWidths, physicalHeights}
  fs.writeFileSync(path.join(runRoot, 'runtime-visible-facts.json'), `${JSON.stringify(summary, null, 2)}\n`, {mode: 0o600})
  if (summary.visibleSurfaceLabels.length !== 2 || logicalWidth.length !== 2 || logicalHeight.length !== 2 || readiness.length !== 2 || forbiddenDeviceAreaLabels.length !== 0 || physicalWidths.length !== 2 || physicalHeights.length !== 2) {
    throw new Error(`DUAL_DISPLAY_FACT_CARD_INCOMPLETE:${JSON.stringify(summary)}`)
  }
  if (logicalWidth.some(value => value !== '逻辑分辨率宽：1280') || logicalHeight.some(value => value !== '逻辑分辨率高：800')) {
    throw new Error(`DECLARED_CANVAS_MISMATCH:${JSON.stringify(summary)}`)
  }
  savePng(0, 'admin-runtime-primary.png')
  savePng(manifest.secondarySurfaceFlingerDisplayId, 'admin-runtime-secondary.png')
  manifest.runtimeObserved = summary
  manifest.business = 'PASS'
  manifest.device = 'PASS'
} catch (error) {
  manifest.firstFailure = error instanceof Error ? error.message : String(error)
  if (manifest.business === 'NOT_RUN' && manifest.phase !== 'PREFLIGHT' && manifest.phase !== 'RESOURCE_PREFLIGHT') manifest.business = 'FAIL'
} finally {
  if (launched) {
    const stopped = adb(['shell', 'am', 'force-stop', pkg], 'force-stop-cleanup')
    const remaining = adb(['shell', 'ps', '-A'], 'app-process-cleanup-readback', {persist: false}).toString('utf8')
      .split(/\r?\n/).filter(line => line.includes(pkg))
    manifest.cleanup = stopped !== undefined && remaining.length === 0 ? 'PASS' : 'FAIL'
  } else manifest.cleanup = 'NOT_APPLICABLE'
  if (buildIdentity) manifest.buildProcessReadback = snapshotProcessTree({pid: buildIdentity.pid, pgid: buildIdentity.pgid, startToken: buildIdentity.startToken})
  manifest.phase = 'COMPLETE'; save()
}

process.stdout.write(`TER_ADMIN_DISPLAY_ANDROID build=${manifest.build} device=${manifest.device} business=${manifest.business} cleanup=${manifest.cleanup} runId=${runId} sourceSha256=${sourceSha256} apkSha256=${manifest.apkSha256 ?? 'NONE'}\n`)
if (manifest.business !== 'PASS' || manifest.cleanup !== 'PASS') {
  process.stderr.write(`TER_ADMIN_DISPLAY_ANDROID_FAILURE=${manifest.firstFailure ?? 'CLEANUP_FAILED'}\n`)
  process.exitCode = 1
}
