#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import {spawn, spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright'
import {readProcessTable, snapshotProcessTree, terminateOwnedProcessTree} from '../dev/managed-process-tree.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const runtimeRoot = path.join(root, '.runtime/ter-admin-display')
const integrationRoot = path.join(root, 'apps/terminal/ui/integration/sample-console')
const runId = process.argv[2]
if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/.test(runId ?? '')) throw new Error('TER_ADMIN_DISPLAY_RUN_ID_REQUIRED')
const port = Number(process.argv[3] ?? 8093)
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('TER_ADMIN_DISPLAY_PORT_INVALID')
const runRoot = path.join(runtimeRoot, runId)
if (fs.existsSync(runRoot)) throw new Error('TER_ADMIN_DISPLAY_RUN_ALREADY_EXISTS')
fs.mkdirSync(runRoot, {recursive: true, mode: 0o700})

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
]
const sourceSha256 = createHash('sha256').update(files.map(file => `${file}\0${fs.readFileSync(path.join(root, file))}`).join('\0')).digest('hex')
const manifestPath = path.join(runRoot, 'run-manifest.json')
const logPath = path.join(runRoot, 'expo-web.log')
const screenshotPath = path.join(runRoot, 'admin-runtime.png')
const manifest = {
  runId,
  phase: 'PREFLIGHT',
  sourceSha256,
  sourceFiles: files,
  webUrl: `http://127.0.0.1:${port}/?surfaceForm=laptop`,
  process: null,
  business: 'NOT_RUN',
  cleanup: 'NOT_RUN',
  firstFailure: null,
}
const save = () => fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {mode: 0o600})
save()

let expo = null
let browser = null
try {
  const budget = spawnSync(path.join(root, 'scripts/env/check-runtime-resource-budget'), [path.join(root, '.runtime')], {cwd: root, encoding: 'utf8'})
  fs.writeFileSync(path.join(runRoot, 'resource-preflight.log'), `${budget.stdout ?? ''}${budget.stderr ?? ''}`, {mode: 0o600})
  if (budget.status !== 0) throw new Error(`RESOURCE_PREFLIGHT_FAILED:${budget.status}`)

  const log = fs.createWriteStream(logPath, {flags: 'wx', mode: 0o600})
  expo = spawn('yarn', ['web', '--port', String(port), '--non-interactive'], {cwd: integrationRoot, detached: true, stdio: ['ignore', 'pipe', 'pipe']})
  expo.stdout.pipe(log)
  expo.stderr.pipe(log)
  const processTable = readProcessTable()
  const identity = processTable.find(process => process.pid === expo.pid)
  if (!identity) throw new Error('EXPO_PROCESS_IDENTITY_READBACK_FAILED')
  manifest.process = {pid: identity.pid, pgid: identity.pgid, startToken: identity.startToken, commandSha256: identity.commandSha256, logPath: path.relative(root, logPath)}
  manifest.phase = 'WEB_STARTING'
  save()

  let ready = false
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    if (expo.exitCode !== null) throw new Error(`EXPO_EXITED:${expo.exitCode}`)
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`)
      if (response.ok) { ready = true; break }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  if (!ready) throw new Error('EXPO_WEB_READINESS_TIMEOUT')

  manifest.phase = 'WEB_SCENARIO'
  save()
  browser = await chromium.launch({headless: true})
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}})
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message.slice(0, 240)))
  await page.goto(manifest.webUrl, {waitUntil: 'networkidle', timeout: 60_000})

  const launcher = page.getByTestId('terminal.admin:launcher')
  await launcher.waitFor({state: 'visible', timeout: 30_000})
  const bounds = await launcher.boundingBox()
  if (bounds === null) throw new Error('ADMIN_LAUNCHER_BOUNDS_UNAVAILABLE')
  for (let index = 0; index < 5; index += 1) {
    await page.mouse.click(bounds.x + Math.min(24, bounds.width / 4), bounds.y + Math.min(24, bounds.height / 4))
  }

  await page.getByTestId('terminal.admin:login').waitFor({state: 'visible', timeout: 10_000})
  const passwordText = await page.getByTestId('terminal.admin:debug-password').innerText()
  const digits = passwordText.match(/\d{6}/)?.[0]
  if (digits === undefined) throw new Error('ADMIN_DEBUG_PASSWORD_READBACK_MISSING')
  for (const digit of digits) await page.getByTestId(`ui.base.input:virtual-keyboard:text-${digit}`).click()
  await page.getByTestId('terminal.admin:verify').click()
  await page.getByTestId('terminal.admin:section:runtime').click()

  const primaryWidth = page.getByTestId('terminal.admin:runtime:surface-map:surface:PRIMARY:logic-width')
  const primaryHeight = page.getByTestId('terminal.admin:runtime:surface-map:surface:PRIMARY:logic-height')
  await primaryWidth.waitFor({state: 'visible', timeout: 15_000})
  const observed = {
    primaryLogicalWidth: await primaryWidth.innerText(),
    primaryLogicalHeight: await primaryHeight.innerText(),
    primaryReadiness: await page.getByTestId('terminal.admin:runtime:surface-map:surface:PRIMARY:inside:0').innerText(),
    deviceDisplayAreaLabelCount: await page.getByText(/设备显示区域：/).count(),
    secondaryCardCount: await page.getByTestId('terminal.admin:runtime:surface-map:surface:SECONDARY:card').count(),
  }
  if (observed.primaryLogicalWidth !== '逻辑分辨率宽：1280' || observed.primaryLogicalHeight !== '逻辑分辨率高：800') {
    throw new Error(`WEB_PRIMARY_LOGICAL_RESOLUTION_MISMATCH:${JSON.stringify(observed)}`)
  }
  if (observed.primaryReadiness !== '已就绪' || observed.deviceDisplayAreaLabelCount !== 0) {
    throw new Error(`WEB_RUNTIME_DISPLAY_AREA_LABEL_PRESENT_OR_READINESS_MISSING:${JSON.stringify(observed)}`)
  }
  if (observed.secondaryCardCount !== 0) throw new Error('WEB_SECONDARY_ADAPTER_FACTS_UNEXPECTEDLY_PRESENT')
  if (pageErrors.length) throw new Error(`WEB_PAGE_ERRORS:${JSON.stringify(pageErrors)}`)
  await page.screenshot({path: screenshotPath, fullPage: true})
  manifest.webObserved = observed
  manifest.screenshotPath = path.relative(root, screenshotPath)
  manifest.pageErrors = pageErrors
  manifest.business = 'PASS'
} catch (error) {
  manifest.firstFailure = error instanceof Error ? error.message : String(error)
  manifest.business = 'FAIL'
} finally {
  await browser?.close().catch(() => {})
  if (expo !== null) {
    const result = await terminateOwnedProcessTree({pid: expo.pid, pgid: expo.pid, startToken: manifest.process?.startToken ?? ''})
    const remaining = snapshotProcessTree({pid: expo.pid, pgid: expo.pid, startToken: manifest.process?.startToken ?? ''})
    manifest.cleanup = result.status === 'PASS' && remaining.length === 0 ? 'PASS' : 'FAIL'
    manifest.cleanupReadback = remaining
  } else manifest.cleanup = 'NOT_APPLICABLE'
  manifest.phase = 'COMPLETE'
  save()
}

process.stdout.write(`TER_ADMIN_DISPLAY_WEB business=${manifest.business} cleanup=${manifest.cleanup} runId=${runId} sourceSha256=${sourceSha256}\n`)
if (manifest.business !== 'PASS' || manifest.cleanup !== 'PASS') {
  process.stderr.write(`TER_ADMIN_DISPLAY_WEB_FAILURE=${manifest.firstFailure ?? 'CLEANUP_FAILED'}\n`)
  process.exitCode = 1
}
