import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const packageName = 'com.anonymous.sampleterminal'
const activity = `${packageName}/.MainActivity`
const apk = path.join(
  repositoryRoot,
  'apps/terminal/application/android/sample-terminal/android/app/build/outputs/apk/release/app-release.apk',
)
const defaultOutput = path.join(
  repositoryRoot,
  'doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/sample1-frozen-journey',
)

const args = new Map()
for (let index = 2; index < process.argv.length; index += 1) {
  const value = process.argv[index]
  if (value === '--serial') args.set('serial', process.argv[++index])
  else if (value === '--shape') args.set('shape', process.argv[++index])
  else if (value === '--case') args.set('case', process.argv[++index])
  else if (value === '--age') args.set('age', process.argv[++index])
  else if (value === '--output') args.set('output', process.argv[++index])
  else if (value === '--skip-install') args.set('skipInstall', true)
  else if (value === '--no-screenshots') args.set('noScreenshots', true)
  else throw new Error(`unknown argument: ${value}`)
}

const serial = args.get('serial') ?? 'emulator-5556'
const shape = args.get('shape') ?? 'mobile'
const journeyCase = args.get('case') ?? 'normal'
const ageValue = args.has('age')
  ? (args.get('age') ?? '')
  : ['render-smoke', 'keyboard-alpha-probe'].includes(journeyCase) ? '' : '37'
if (!['mobile', 'dual'].includes(shape)) throw new Error(`invalid shape: ${shape}`)
if (!['normal', 'reject-retry', 'abandon', 'withdraw', 'hand-back', 'render-smoke', 'keyboard-alpha-probe'].includes(journeyCase)) {
  throw new Error(`invalid case: ${journeyCase}`)
}
if (shape === 'mobile' && journeyCase === 'withdraw') throw new Error('withdraw case requires dual shape')
if (shape === 'dual' && journeyCase === 'hand-back') throw new Error('hand-back case requires mobile shape')
if (shape !== 'dual' && journeyCase === 'render-smoke') throw new Error('render-smoke case requires dual shape')
if (shape !== 'mobile' && journeyCase === 'keyboard-alpha-probe') throw new Error('keyboard-alpha-probe case requires mobile shape')
if (!/^\d{0,3}$/.test(ageValue)) throw new Error(`invalid age: ${ageValue}`)
if (ageValue !== '' && ageValue !== '37') throw new Error('this record-only runner currently supports age 37 or empty age')
const screenshotsEnabled = !args.get('noScreenshots')
const outputDirectory = path.resolve(args.get('output') ?? path.join(defaultOutput, `${shape}-${journeyCase}`))

let commandLogSequence = 0
const sanitizeDiagnostic = value => value
  .replace(/((?:password|passwd|token|cookie|authorization|otp|phone|mobile|username|login)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]')
  .replace(/((?:password|passwd|token|cookie|authorization|otp|phone|mobile|username|login)"\s*:\s*")[^"]*(")/gi, '$1[REDACTED]$2')
const appendCommandLog = entry => {
  try {
    fs.mkdirSync(outputDirectory, {recursive: true})
    const sequence = String(commandLogSequence++).padStart(4, '0')
    const stderrText = Buffer.isBuffer(entry.stderr) ? entry.stderr.toString('utf8') : `${entry.stderr ?? ''}`
    const stderrArtifactPath = stderrText === '' ? null : path.join(outputDirectory, `command-stderr-${sequence}.txt`)
    if (stderrArtifactPath !== null) {
      fs.writeFileSync(stderrArtifactPath, `${sanitizeDiagnostic(stderrText).slice(0, 8_192)}\n`)
    }
    fs.appendFileSync(
      path.join(outputDirectory, 'command-actions.jsonl'),
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        ...entry,
        stderr: undefined,
        stderrPath: stderrArtifactPath === null ? null : path.relative(repositoryRoot, stderrArtifactPath),
        logPath: path.relative(repositoryRoot, path.join(outputDirectory, 'command-actions.jsonl')),
      })}\n`,
    )
  } catch {
    // The command log is diagnostic; command execution must still report its own failure.
  }
}

const byteLength = value => Buffer.isBuffer(value) ? value.length : Buffer.byteLength(value ?? '')

const run = (command, commandArgs, options = {}) => {
  const startedAt = Date.now()
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? repositoryRoot,
    encoding: options.binary ? undefined : 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    timeout: options.timeout ?? 8_000,
  })
  const stdout = options.binary ? result.stdout : result.stdout ?? ''
  const stderr = options.binary ? result.stderr : result.stderr ?? ''
  const status = result.status ?? -1
  const timedOut = result.error?.code === 'ETIMEDOUT' || result.signal === 'SIGTERM'
  appendCommandLog({
    phase: options.phase ?? (command === 'adb' ? 'device-observation' : 'local-observation'),
    label: options.label ?? command,
    command,
    argumentCount: commandArgs.length,
    status,
    result: result.error !== undefined || status !== 0 ? 'failed' : 'passed',
    timedOut,
    stdoutBytes: byteLength(stdout),
    stderrBytes: byteLength(stderr),
    durationMs: Date.now() - startedAt,
    stderr,
  })
  if (result.error !== undefined && options.allowFailure !== true) {
    throw new Error(`${command} ${commandArgs.join(' ')}: ${result.error.message}`)
  }
  if (result.status !== 0 && options.allowFailure !== true) {
    throw new Error(`${command} ${commandArgs.join(' ')}: exit ${result.status}\n${stderr || stdout}`)
  }
  return {status: result.status ?? -1, stdout, stderr}
}

const adb = (adbArgs, label, options = {}) => run('adb', ['-s', serial, ...adbArgs], {...options, label})
const textOf = result => `${result.stdout ?? ''}${result.stderr ?? ''}`.replace(/\r/g, '')
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
const writeText = (directory, name, value) => fs.writeFileSync(path.join(directory, name), value)
const writeJson = (directory, name, value) => writeText(directory, name, `${JSON.stringify(value, null, 2)}\n`)

const localApkBinding = () => {
  if (!fs.existsSync(apk)) return {path: path.relative(repositoryRoot, apk), exists: false}
  const bytes = fs.readFileSync(apk)
  return {
    path: path.relative(repositoryRoot, apk),
    exists: true,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }
}

const installedApkBinding = () => {
  const pathResult = adb(['shell', 'pm', 'path', packageName], 'installed APK path', {allowFailure: true})
  const paths = [...textOf(pathResult).matchAll(/^package:(\S+)$/gm)].map(match => match[1])
  if (paths.length !== 1) throw new Error(`installed APK binding requires exactly one base APK, observed ${paths.length}`)
  const installedPath = paths[0]
  const digestResult = adb(['shell', 'sha256sum', installedPath], 'installed APK sha256', {allowFailure: true})
  const sha256 = textOf(digestResult).match(/\b([a-f0-9]{64})\b/i)?.[1]?.toLowerCase() ?? null
  const sizeResult = adb(['shell', 'stat', '-c', '%s', installedPath], 'installed APK size', {allowFailure: true})
  const sizeText = textOf(sizeResult).trim().split(/\s+/).at(-1) ?? ''
  const bytes = /^\d+$/.test(sizeText) ? Number(sizeText) : null
  if (sha256 === null || bytes === null) throw new Error(`installed APK binding is incomplete for ${installedPath}`)
  return {paths, path: installedPath, bytes, sha256}
}

const assertApkBinding = (local, installed) => {
  if (!local.exists) throw new Error(`release APK missing: ${local.path}`)
  if (installed.bytes !== local.bytes || installed.sha256 !== local.sha256) {
    throw new Error(`installed APK does not match current release APK: local=${local.sha256}/${local.bytes} installed=${installed.sha256}/${installed.bytes}`)
  }
}
const appendProgress = (event, details = {}) => {
  try {
    fs.appendFileSync(
      path.join(outputDirectory, 'progress.log'),
      `${JSON.stringify({timestamp: new Date().toISOString(), event, ...details})}\n`,
    )
  } catch {
    // Progress is diagnostic only; it must not change the business path.
  }
}

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const nodeForId = (xml, resourceId) => {
  const match = xml.match(new RegExp(`<node\\b[^>]*resource-id="${escapeRegExp(resourceId)}"[^>]*>`))
  if (match === null) return null
  const tag = match[0]
  const bounds = tag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
  if (bounds === null) return null
  return {
    tag,
    left: Number(bounds[1]),
    top: Number(bounds[2]),
    right: Number(bounds[3]),
    bottom: Number(bounds[4]),
    selected: /\bselected="true"/.test(tag),
    enabled: /\benabled="true"/.test(tag),
  }
}

const displayInventory = () => {
  const command = adb(['shell', 'cmd', 'display', 'get-displays'], 'display inventory', {allowFailure: true})
  const dumpsys = adb(['shell', 'dumpsys', 'display'], 'display dumpsys', {allowFailure: true})
  const commandText = textOf(command)
  const displays = parseLogicalDisplays(commandText)
  return {
    command: commandText,
    dumpsys: textOf(dumpsys),
    displays,
    displayIds: displays.map(display => display.id),
  }
}

const surfaceInventory = () => {
  const result = adb(['shell', 'dumpsys', 'SurfaceFlinger', '--displays'], 'SurfaceFlinger inventory', {allowFailure: true})
  const value = textOf(result)
  const blocks = value
    .split(/(?=^(?:Display|Virtual Display) \S+)/m)
    .map(block => block.trim())
    .filter(Boolean)
  const primaryDisplays = blocks
    .filter(block => /^Display \S+/.test(block))
    .map(block => {
      const resolution = block.match(/(?:activeMode|displayModes)=[\s\S]*?resolution=(\d+)x(\d+)/)
      return {
        id: block.match(/^Display (\S+)/)?.[1] ?? '',
        name: block.match(/^\s*name="([^"]+)"/m)?.[1]
          ?? block.match(/^Display \S+ \([^,]+, primary, "([^"]+)"\)/)?.[1]
          ?? null,
        width: resolution === null ? 0 : Number(resolution[1]),
        height: resolution === null ? 0 : Number(resolution[2]),
      }
    })
  const virtualDisplays = blocks
    .filter(block => /^Virtual Display \S+/.test(block))
    .map(block => {
      const resolution = block.match(/activeMode=.*resolution=(\d+)x(\d+)/)
      return {
        id: block.match(/^Virtual Display (\S+)/)?.[1] ?? '',
        name: block.match(/^\s*name="([^"]+)"/m)?.[1] ?? null,
        // A virtual SurfaceFlinger block may expose identity without an activeMode.
        // Its physical dimensions are proven by the logical DisplayInfo and each
        // display-scoped screencap, not by an optional SF mode line.
        width: resolution === null ? null : Number(resolution[1]),
        height: resolution === null ? null : Number(resolution[2]),
      }
    })
  return {
    text: value,
    primaryIds: primaryDisplays.map(display => display.id),
    primaryDisplays,
    virtualIds: virtualDisplays.map(display => display.id),
    virtualDisplays,
  }
}

const assertDisplayPairing = (display, surfaces, currentShape, label) => {
  const primaryDisplays = display.displays.filter(item => item.id === 0)
  const secondaryDisplays = display.displays.filter(item => item.id !== 0 && item.flags.includes('FLAG_PRESENTATION'))
  if (primaryDisplays.length !== 1) throw new Error(`${label}: expected one logical primary display, got ${primaryDisplays.length}`)
  if (currentShape === 'mobile' && display.displays.length !== 1) {
    throw new Error(`${label}: mobile shape must expose only logical primary display, got ${display.displays.length}`)
  }
  if (currentShape === 'dual' && display.displays.length !== 2) {
    throw new Error(`${label}: dual shape must expose exactly primary plus one secondary display, got ${display.displays.length}`)
  }
  if (currentShape === 'dual' && secondaryDisplays.length !== 1) {
    throw new Error(`${label}: expected one logical FLAG_PRESENTATION display, got ${secondaryDisplays.length}`)
  }
  if (currentShape === 'mobile' && secondaryDisplays.length !== 0) {
    throw new Error(`${label}: mobile shape has logical FLAG_PRESENTATION display(s): ${secondaryDisplays.length}`)
  }
  if (surfaces.primaryDisplays.length !== 1) throw new Error(`${label}: expected one SurfaceFlinger primary display, got ${surfaces.primaryDisplays.length}`)
  const primarySurface = surfaces.primaryDisplays[0]
  if (primarySurface.id === '' || primarySurface.name === null || primarySurface.name === '' || primarySurface.width <= 0 || primarySurface.height <= 0) {
    throw new Error(`${label}: SurfaceFlinger primary identity or resolution is incomplete`)
  }
  if (primaryDisplays[0].width !== primarySurface.width || primaryDisplays[0].height !== primarySurface.height) {
    throw new Error(`${label}: logical/SF primary resolution mismatch: logical=${primaryDisplays[0].width}x${primaryDisplays[0].height} sf=${primarySurface.width}x${primarySurface.height}`)
  }
  if (currentShape === 'dual') {
    if (surfaces.virtualDisplays.length !== 1) throw new Error(`${label}: expected one SurfaceFlinger virtual display, got ${surfaces.virtualDisplays.length}`)
    const secondarySurface = surfaces.virtualDisplays[0]
    if (secondarySurface.id === '' || secondarySurface.name === null || secondarySurface.name === '') {
      throw new Error(`${label}: SurfaceFlinger secondary identity is incomplete`)
    }
    if (secondarySurface.name !== secondaryDisplays[0].name) {
      throw new Error(`${label}: logical/SF display name mismatch: logical=${secondaryDisplays[0].name} sf=${secondarySurface.name}`)
    }
    if (secondarySurface.width !== null && secondarySurface.height !== null && (secondaryDisplays[0].width !== secondarySurface.width || secondaryDisplays[0].height !== secondarySurface.height)) {
      throw new Error(`${label}: logical/SF secondary resolution mismatch: logical=${secondaryDisplays[0].width}x${secondaryDisplays[0].height} sf=${secondarySurface.width}x${secondarySurface.height}`)
    }
  }
  if (currentShape === 'mobile' && surfaces.virtualDisplays.length !== 0) {
    throw new Error(`${label}: mobile shape has SurfaceFlinger virtual display(s): ${surfaces.virtualDisplays.length}`)
  }
  const allUniqueIds = display.displays.map(item => item.uniqueId)
  if (display.displays.some(item => item.name === null || item.name === '' || item.uniqueId === null || item.uniqueId === '' || item.width === null || item.height === null || item.width <= 0 || item.height <= 0)) {
    throw new Error(`${label}: logical display identity or dimensions are incomplete`)
  }
  if (new Set(allUniqueIds).size !== allUniqueIds.length) {
    throw new Error(`${label}: logical display uniqueId is not unique`)
  }
  const virtualDisplay = currentShape === 'dual' ? surfaces.virtualDisplays[0] : null
  if (virtualDisplay !== null && (virtualDisplay.id === '' || virtualDisplay.name === null || virtualDisplay.name === '')) {
    throw new Error(`${label}: SurfaceFlinger virtual display identity is incomplete`)
  }
  return {primaryDisplay: primaryDisplays[0], secondaryDisplay: secondaryDisplays[0] ?? null, primarySurface, secondarySurface: virtualDisplay}
}

const assertSameIdentity = (expected, observed, fields, label) => {
  for (const field of fields) {
    if (expected?.[field] !== observed?.[field]) {
      throw new Error(`${label}: ${field} changed: expected=${expected?.[field]} observed=${observed?.[field]}`)
    }
  }
}

let lockedPairing = null
const assertStablePairing = (pairing, label) => {
  if (lockedPairing === null) return
  assertSameIdentity(lockedPairing.primaryDisplay, pairing.primaryDisplay, ['id', 'name', 'uniqueId', 'width', 'height'], `${label} logical primary`)
  assertSameIdentity(lockedPairing.primarySurface, pairing.primarySurface, ['id', 'name', 'width', 'height'], `${label} SurfaceFlinger primary`)
  assertSameIdentity(lockedPairing.secondaryDisplay, pairing.secondaryDisplay, ['id', 'name', 'uniqueId', 'width', 'height'], `${label} logical secondary`)
  assertSameIdentity(lockedPairing.secondarySurface, pairing.secondarySurface, ['id', 'name'], `${label} SurfaceFlinger secondary`)
}

const parseLogicalDisplays = commandText => commandText
  .split('\n')
  .filter(line => /^\s*Display id \d+:/.test(line))
  .map(line => {
    const normalized = line.trim().replace(/\\"/g, '"')
    const id = Number(normalized.match(/^Display id (\d+):/)?.[1])
    const name = normalized.match(/DisplayInfo\{"([^"]+)"/)?.[1] ?? null
    const real = normalized.match(/real (\d+) x (\d+)/)
    const uniqueId = normalized.match(/uniqueId "([^"]+)"/)?.[1] ?? null
    const flags = [...normalized.matchAll(/FLAG_[A-Z_]+/g)].map(match => match[0])
    return {
      id,
      name,
      width: real === null ? null : Number(real[1]),
      height: real === null ? null : Number(real[2]),
      uniqueId,
      flags,
    }
  })

const displayFragment = (windowsXml, displayId) => {
  const opening = new RegExp(`<display id=["']${displayId}["']>`).exec(windowsXml)
  if (opening === null) return null
  const closing = windowsXml.indexOf('</display>', opening.index + opening[0].length)
  if (closing < 0) return null
  return windowsXml.slice(opening.index, closing + '</display>'.length)
}

const captureSurface = (displayId, name, directory) => {
  const result = adb(['exec-out', 'screencap', '-p', '-d', displayId], `${name} screenshot`, {binary: true, allowFailure: true})
  if (!Buffer.isBuffer(result.stdout) || result.stdout.length === 0) throw new Error(`${name} screenshot is empty`)
  const screenshotPath = path.join(directory, `${name}.png`)
  fs.writeFileSync(screenshotPath, result.stdout)
  const fileText = textOf(run('file', [screenshotPath], {allowFailure: true}))
  writeText(directory, `${name}.file.txt`, fileText)
  const dimensions = fileText.match(/(\d+) x (\d+)/)
  if (!/PNG image data/.test(fileText) || dimensions === null) throw new Error(`${name} screenshot is not a readable PNG: ${fileText}`)
  return {fileText, width: Number(dimensions[1]), height: Number(dimensions[2])}
}

const assertScreenshotDimensions = (capture, display, label) => {
  if (capture.width !== display.width || capture.height !== display.height) {
    throw new Error(`${label}: screenshot dimensions ${capture.width}x${capture.height} do not match logical display ${display.width}x${display.height}`)
  }
}

const lastUiWindowsDumpByDisplay = new Map()
const uiDumpPaths = new Set()

const readUiForDisplay = async displayId => {
  // `uiautomator dump` has no target-display flag on the SDK 57 device. The
  // supported --windows form returns an explicit <display id="..."> tree;
  // select that tree instead of treating the focused display as evidence.
  const remotePath = `/sdcard/ter-sample1-frozen-journey-${process.pid}-${displayId}.xml`
  uiDumpPaths.add(remotePath)
  const dumpArgs = ['shell', 'uiautomator', 'dump', '--windows', remotePath]
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const dump = adb(dumpArgs, `UI dump display ${displayId}`, {allowFailure: true})
    const xml = adb(['exec-out', 'cat', remotePath], 'UI readback', {allowFailure: true})
    const windowsXml = textOf(xml)
    const value = displayFragment(windowsXml, displayId)
    if (dump.status === 0 && windowsXml.startsWith('<?xml') && value !== null) {
      lastUiWindowsDumpByDisplay.set(displayId, windowsXml)
      return value
    }
    await sleep(200)
  }
  throw new Error(`UI dump/readback did not return XML for display ${displayId}`)
}

const captureFailureUiForDisplays = async displayIds => {
  for (const displayId of [...new Set(displayIds)]) {
    try {
      const fragment = await readUiForDisplay(displayId)
      const windowsXml = lastUiWindowsDumpByDisplay.get(displayId) ?? ''
      writeText(outputDirectory, `first-failure-display-${displayId}-uiautomator-windows.xml`, windowsXml)
      writeText(outputDirectory, `first-failure-display-${displayId}.xml`, fragment)
      writeText(outputDirectory, `first-failure-display-${displayId}-ui-capture-status.txt`, 'ACTIVE_DISPLAY_CAPTURE=PASS')
    } catch (error) {
      const windowsXml = lastUiWindowsDumpByDisplay.get(displayId) ?? ''
      if (windowsXml !== '') {
        writeText(outputDirectory, `first-failure-display-${displayId}-uiautomator-windows.xml`, windowsXml)
        const fragment = displayFragment(windowsXml, displayId)
        if (fragment !== null) writeText(outputDirectory, `first-failure-display-${displayId}.xml`, fragment)
      }
      writeText(outputDirectory, `first-failure-display-${displayId}-ui-capture-error.txt`, error instanceof Error ? error.message : String(error))
    }
  }
}

const readUi = () => readUiForDisplay(0)

const waitForNode = async (resourceId, predicate = () => true, timeoutMs = 20_000) => {
  const deadline = Date.now() + timeoutMs
  let lastXml = ''
  while (Date.now() < deadline) {
    lastXml = await readUi()
    const node = nodeForId(lastXml, resourceId)
    if (node !== null && predicate(node)) return {xml: lastXml, node}
    await sleep(250)
  }
  throw new Error(`UI resource did not reach expected state: ${resourceId}\n${lastXml.slice(-1600)}`)
}

const waitForAbsent = async (resourceId, timeoutMs = 20_000) => {
  const deadline = Date.now() + timeoutMs
  let lastXml = ''
  while (Date.now() < deadline) {
    lastXml = await readUi()
    if (nodeForId(lastXml, resourceId) === null) return lastXml
    await sleep(250)
  }
  throw new Error(`UI resource did not disappear: ${resourceId}\n${lastXml.slice(-1600)}`)
}

const tapResource = async resourceId => {
  appendProgress('tap-requested', {resourceId})
  const {node} = await waitForNode(resourceId, current => current.right > current.left && current.bottom > current.top)
  const x = Math.floor((node.left + node.right) / 2)
  const y = Math.floor((node.top + node.bottom) / 2)
  adb(['shell', 'input', 'tap', String(x), String(y)], `tap ${resourceId}`)
  appendProgress('tap-dispatched', {resourceId, x, y})
  return {resourceId, x, y}
}

// The Android Presentation for the dual-screen customer surface is a separate
// physical input display. Resolve every action from the target display's current
// accessibility tree; fixed coordinates are not an acceptable control oracle.
const secondaryControlIds = Object.freeze({
  'age-field': 'sample.desk.customer-member:age',
  'confirm': 'sample.desk.customer-member:confirm',
  'confirm-after-retry': 'sample.desk.customer-member:confirm',
  'reject': 'sample.desk.customer-member:reject',
  'numeric-3': 'ui.base.input:virtual-keyboard:text-3',
  'numeric-7': 'ui.base.input:virtual-keyboard:text-7',
  'keyboard-complete': 'ui.base.input:virtual-keyboard:complete',
})

let activeSecondaryDisplayId = null
let activeSecondaryDisplay = null

const currentSecondaryDisplay = () => {
  if (activeSecondaryDisplayId === null || activeSecondaryDisplay === null) {
    throw new Error('secondary display is not locked before secondary action')
  }
  return activeSecondaryDisplay
}

const captureCurrentSecondarySurface = (name, label) => {
  if (!screenshotsEnabled) return null
  const currentDisplay = displayInventory()
  const currentSurfaces = surfaceInventory()
  const currentPairing = assertDisplayPairing(currentDisplay, currentSurfaces, 'dual', `${label} display inventory`)
  assertStablePairing(currentPairing, `${label} display inventory`)
  const capture = captureSurface(currentPairing.secondarySurface.id, name, outputDirectory)
  assertScreenshotDimensions(capture, currentPairing.secondaryDisplay, `${label} secondary`)
  return capture
}

const tapSecondary = async name => {
  if (activeSecondaryDisplayId === null) throw new Error(`secondary display is not locked before tap ${name}`)
  const resourceId = secondaryControlIds[name]
  if (resourceId === undefined) throw new Error(`unmapped secondary control: ${name}`)
  const beforeXml = await readUiForDisplay(activeSecondaryDisplayId)
  const node = nodeForId(beforeXml, resourceId)
  if (node === null || node.right <= node.left || node.bottom <= node.top || !node.enabled) {
    throw new Error(`secondary control is not an enabled bounded node: ${name} (${resourceId})`)
  }
  const secondaryDisplay = currentSecondaryDisplay()
  if (node.left < 0 || node.top < 0 || node.right > secondaryDisplay.width || node.bottom > secondaryDisplay.height) {
    throw new Error(`secondary control bounds exceed display: ${name} (${resourceId})`)
  }
  const x = Math.floor((node.left + node.right) / 2)
  const y = Math.floor((node.top + node.bottom) / 2)
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '-')
  writeText(outputDirectory, `secondary-tap-${safeName}-before.xml`, beforeXml)
  writeText(outputDirectory, `secondary-tap-${safeName}-before-uiautomator-windows.xml`, lastUiWindowsDumpByDisplay.get(activeSecondaryDisplayId) ?? '')
  adb(['shell', 'input', '-d', String(activeSecondaryDisplayId), 'tap', String(x), String(y)], `tap secondary ${name}`)
  await sleep(350)
  const secondaryXml = await readUiForDisplay(activeSecondaryDisplayId)
  writeText(outputDirectory, `secondary-tap-${safeName}.xml`, secondaryXml)
  writeText(outputDirectory, `secondary-tap-${safeName}-uiautomator-windows.xml`, lastUiWindowsDumpByDisplay.get(activeSecondaryDisplayId) ?? '')
  const actionDisplay = displayInventory()
  const actionSurfaces = surfaceInventory()
  const actionPairing = assertDisplayPairing(actionDisplay, actionSurfaces, 'dual', `secondary action ${name}`)
  assertStablePairing(actionPairing, `secondary action ${name}`)
  appendProgress('secondary-readback-after-tap', {name, resourceId, displayId: activeSecondaryDisplayId, x, y})
  return secondaryXml
}

const inputVirtualText = async value => {
  const normalized = value.toLowerCase()
  if (value !== normalized) await tapResource('ui.base.input:virtual-keyboard:shift')
  for (const character of normalized) await tapResource(`ui.base.input:virtual-keyboard:text-${character}`)
}

const clearInput = async resourceId => {
  const {node} = await waitForNode(resourceId)
  const textMatch = node.tag.match(/text="([^"]*)"/)
  const length = textMatch?.[1]?.length ?? 0
  if (length === 0) return
  await tapResource(resourceId)
  for (let index = 0; index < length; index += 1) {
    await tapResource('ui.base.input:virtual-keyboard:backspace')
  }
}

const windowSnapshot = () => textOf(adb(['shell', 'dumpsys', 'window', 'windows'], 'window snapshot', {allowFailure: true}))
const activitySnapshot = () => textOf(adb(['shell', 'dumpsys', 'activity', 'activities'], 'activity snapshot', {allowFailure: true}))
const logcat = () => textOf(adb(['logcat', '-d', '-v', 'epoch'], 'logcat readback', {allowFailure: true}))
const packagePid = () => textOf(adb(['shell', 'pidof', packageName], 'package PID readback', {allowFailure: true})).trim()

const expectedPrimaryIds = {
  anonymous: ['sample.auth.login'],
  invalid: ['sample.auth.login', 'sample.auth.notice', 'sample.auth.notice:title', 'sample.auth.notice:message', 'sample.auth.notice:dismiss'],
  memberList: ['sample.desk.member-list'],
  memberForm: ['sample.desk.member-form'],
  waiting: ['sample.desk.member-list', 'sample.desk.waiting-confirm'],
  customerConfirm: ['sample.desk.customer-member'],
  confirmed: ['sample.desk.member-list', 'sample.desk.member-list:row'],
  rejected: ['sample.desk.registry-notice'],
  retryForm: ['sample.desk.member-form'],
  discardConfirm: ['sample.desk.discard-confirm'],
  afterAbandon: ['sample.desk.member-list'],
  withdrawConfirm: ['sample.desk.withdraw-confirm'],
  afterWithdraw: ['sample.desk.member-form'],
}

const primaryTextsForStep = (name, currentShape) => {
  if (name === 's1-01-anonymous' || name === 's1-12-logout' || name === 's1-11-cold-restart-anonymous') return ['店员登录']
  if (name === 's1-02-invalid-login') return ['登录失败', '工号或密码不正确']
  if (name === 's1-03-member-list' || name === 's1-08-retry-confirmed' || name === 's1-09-abandoned' || name === 's1-09-hand-back-cancelled') return ['已登记会员']
  if (name === 's1-04-member-form' || name === 's1-08-retry-form' || name === 's1-10-after-withdraw' || name === 's1-10-hand-back') return ['新增会员']
  if (name === 's1-05-customer-confirm') return currentShape === 'dual'
    ? ['已提交，等待顾客确认', 'Alice', '01012345678']
    : ['请确认登记', 'Alice', '01012345678']
  if (name === 's1-06-confirmed' || name === 's1-06-authenticated-cold-restart') return ['已登记会员', 'Alice', '01012345678']
  if (name === 's1-07-rejected') return ['登记未完成', '顾客拒绝了登记']
  if (name === 's1-10-withdraw-confirm') return ['撤回登记']
  return []
}

const assertTexts = (xml, expected, label) => {
  const missing = expected.filter(text => !xml.includes(text))
  if (missing.length > 0) throw new Error(`${label}: missing expected business state text: ${missing.join(', ')}`)
}

const secondaryExpectationFor = (description, previous) => {
  if (description.includes('single screen') || description.includes('no SECONDARY')) return null
  if (description.includes('unchanged')) {
    if (previous === null) throw new Error('secondary unchanged assertion has no previous observation')
    return previous
  }
  if (description.includes('customer-member')) {
    return {partKey: 'sample.desk.customer-member', texts: ['请确认登记', 'Alice', '01012345678']}
  }
  if (description.includes('customer-welcome') || description.includes('欢迎')) {
    return {partKey: 'sample.desk.customer-welcome', texts: ['欢迎，请等待店员操作']}
  }
  throw new Error(`unclassified secondary expectation: ${description}`)
}

const execute = async () => {
  fs.mkdirSync(outputDirectory, {recursive: true})
  const runId = `sample1-frozen-${shape}-${journeyCase}-${Date.now()}`
  const record = {
    runId,
    tool: 'tools/terminal-sample2/run-sample1-frozen-journey.mjs',
    packageName,
    activity,
    serial,
    shape,
    journeyCase,
    age: ageValue,
    screenshotsEnabled,
    startedAt: new Date().toISOString(),
    business: 'NOT_RUN',
    cleanup: 'NOT_RUN',
    firstFailure: null,
    lastKnownGood: null,
    brokenBoundary: null,
    apkBinding: {
      installMode: args.get('skipInstall') ? 'skip-install-with-binding-check' : 'install-release',
      local: localApkBinding(),
      installed: null,
    },
    steps: [],
    display: null,
    surfaceFlinger: null,
  }
  let surfaces = null
  let lastSecondaryObservation = null
  writeJson(outputDirectory, 'apk-binding.json', record.apkBinding)

  const readState = async (name, expectedIds, secondaryExpectation) => {
    appendProgress('state-read-requested', {name})
    const xml = await readUi()
    const missing = expectedIds.filter(resourceId => nodeForId(xml, resourceId) === null)
    if (missing.length > 0) throw new Error(`${name}: missing primary UI nodes: ${missing.join(', ')}`)
    assertTexts(xml, primaryTextsForStep(name, shape), `${name} primary`)
    const expectedSecondary = shape === 'dual'
      ? secondaryExpectationFor(secondaryExpectation, lastSecondaryObservation)
      : null
    const secondaryXml = shape === 'dual' ? await readUiForDisplay(activeSecondaryDisplayId) : null
    if (expectedSecondary !== null) {
      if (secondaryXml === null) throw new Error(`${name}: secondary UI readback is missing`)
      if (nodeForId(secondaryXml, expectedSecondary.partKey) === null) {
        throw new Error(`${name}: secondary partKey missing: ${expectedSecondary.partKey}`)
      }
      assertTexts(secondaryXml, expectedSecondary.texts, `${name} secondary`)
      lastSecondaryObservation = {partKey: expectedSecondary.partKey, texts: expectedSecondary.texts}
    }
    const stateDisplay = displayInventory()
    const stateSurfaces = surfaceInventory()
    const statePairing = assertDisplayPairing(stateDisplay, stateSurfaces, shape, `${name} display inventory`)
    assertStablePairing(statePairing, `${name} display inventory`)
    if (record.display?.selectedSecondaryDisplayId !== (statePairing.secondaryDisplay?.id ?? null)) {
      throw new Error(`${name}: logical secondary display changed during state read`)
    }
    if (record.surfaceFlinger?.selectedSecondarySurfaceId !== (statePairing.secondarySurface?.id ?? null)) {
      throw new Error(`${name}: SurfaceFlinger secondary display changed during state read`)
    }
    activeSecondaryDisplay = statePairing.secondaryDisplay
    writeText(outputDirectory, `${name}-display-get-displays.txt`, stateDisplay.command)
    writeText(outputDirectory, `${name}-display-dumpsys.txt`, stateDisplay.dumpsys)
    writeText(outputDirectory, `${name}-surfaceflinger-dumpsys.txt`, stateSurfaces.text)
    writeText(outputDirectory, `${name}-primary.xml`, xml)
    writeText(outputDirectory, `${name}-primary-uiautomator-windows.xml`, lastUiWindowsDumpByDisplay.get(0) ?? '')
    if (secondaryXml !== null) writeText(outputDirectory, `${name}-secondary.xml`, secondaryXml)
    if (secondaryXml !== null) {
      writeText(outputDirectory, `${name}-secondary-uiautomator-windows.xml`, lastUiWindowsDumpByDisplay.get(activeSecondaryDisplayId) ?? '')
    }
    writeText(outputDirectory, `${name}-window.txt`, windowSnapshot())
    writeText(outputDirectory, `${name}-activity.txt`, activitySnapshot())
    writeText(outputDirectory, `${name}-logcat.txt`, logcat())
    if (screenshotsEnabled) {
      const primaryCapture = captureSurface(stateSurfaces.primaryIds[0], `${name}-primary`, outputDirectory)
      assertScreenshotDimensions(primaryCapture, statePairing.primaryDisplay, `${name} primary`)
      if (shape === 'dual') {
        const secondaryCapture = captureSurface(statePairing.secondarySurface.id, `${name}-secondary`, outputDirectory)
        assertScreenshotDimensions(secondaryCapture, statePairing.secondaryDisplay, `${name} secondary`)
      }
    }
    record.steps.push({
      name,
      timestamp: new Date().toISOString(),
      expectedPrimaryIds: expectedIds,
      expectedPrimaryTexts: primaryTextsForStep(name, shape),
      observedPrimaryIds: [...xml.matchAll(/resource-id="([^"]+)"/g)].map(match => match[1]),
      expectedSecondary: expectedSecondary ?? undefined,
      observedSecondaryPartKey: secondaryXml === null
        ? undefined
        : [...secondaryXml.matchAll(/resource-id="([^"]+)"/g)].map(match => match[1]).find(id => id === expectedSecondary?.partKey),
      displayIdentity: {
        logicalPrimary: statePairing.primaryDisplay,
        logicalSecondary: statePairing.secondaryDisplay,
        surfacePrimary: statePairing.primarySurface,
        surfaceSecondary: statePairing.secondarySurface,
      },
    })
    appendProgress('state-observed', {name, expectedPrimaryIds: expectedIds})
  }

  const fillLogin = async (operatorName, passcode) => {
    await tapResource('sample.auth.login:operator-name')
    await clearInput('sample.auth.login:operator-name')
    await inputVirtualText(operatorName)
    await tapResource('ui.base.input:virtual-keyboard:complete')
    await tapResource('sample.auth.login:passcode')
    await clearInput('sample.auth.login:passcode')
    await inputVirtualText(passcode)
    await tapResource('ui.base.input:virtual-keyboard:complete')
    await tapResource('sample.auth.login:submit')
  }

  const loginAndOpenForm = async () => {
    await waitForNode('sample.auth.login')
    await readState('s1-01-anonymous', expectedPrimaryIds.anonymous, 'sample.desk.customer-welcome:message = 欢迎，请等待店员操作')
    record.lastKnownGood = 'S1-01'

    await fillLogin('invalidoperator', 'invalidpasscode')
    await waitForNode('sample.auth.notice')
    await readState('s1-02-invalid-login', expectedPrimaryIds.invalid, 'sample.desk.customer-welcome:message unchanged')
    record.lastKnownGood = 'S1-02'
    await tapResource('sample.auth.notice:dismiss')
    await waitForAbsent('sample.auth.notice')
    await waitForNode('sample.auth.login')

    await fillLogin('A001', '1111')
    await waitForNode('sample.desk.member-list')
    await readState('s1-03-member-list', expectedPrimaryIds.memberList, 'sample.desk.customer-welcome:message = 欢迎，请等待店员操作')
    record.lastKnownGood = 'S1-03'

    const addId = nodeForId(await readUi(), 'sample.desk.member-list:empty-action') === null
      ? 'sample.desk.member-list:add'
      : 'sample.desk.member-list:empty-action'
    await tapResource(addId)
    await waitForNode('sample.desk.member-form')
    await readState('s1-04-member-form', expectedPrimaryIds.memberForm, 'sample.desk.customer-welcome:message unchanged')
    record.lastKnownGood = 'S1-04'
  }

  const fillAndSubmitMember = async () => {
    await tapResource('sample.desk.member-form:name')
    await inputVirtualText('ALICE')
    // The shared keyboard's shift is one-shot: the frozen journey's ALICE
    // input renders as `Alice` (the first character is shifted).
    await waitForNode('sample.desk.member-form:name', node => node.tag.includes('text="Alice"'))
    await tapResource('ui.base.input:virtual-keyboard:complete')
    await tapResource('sample.desk.member-form:phone')
    await inputVirtualText('01012345678')
    await waitForNode('sample.desk.member-form:phone', node => node.tag.includes('text="01012345678"'))
    await tapResource('ui.base.input:virtual-keyboard:complete')
    await tapResource('sample.desk.member-form:submit')
    if (shape === 'dual') {
      await waitForNode('sample.desk.waiting-confirm')
      // The customer confirmation is a real Presentation on the secondary
      // display. The --windows dump selects its explicit logical display tree;
      // the physical screenshot remains a separate surface artifact.
      captureCurrentSecondarySurface('s1-05-customer-confirm-secondary', 's1-05 customer confirmation')
      await readState(
        's1-05-customer-confirm',
        expectedPrimaryIds.waiting,
        'secondary screenshot is the customer-member confirmation Presentation',
      )
      record.lastKnownGood = 'S1-05'
      return
    }
    await waitForNode('sample.desk.customer-member')
    await readState(
      's1-05-customer-confirm',
      shape === 'dual' ? expectedPrimaryIds.waiting : expectedPrimaryIds.customerConfirm,
      'sample.desk.customer-member: visible with name/phone; mode=confirm',
    )
    record.lastKnownGood = 'S1-05'
  }

  const fillAgeAndConfirm = async () => {
    if (shape === 'dual') {
      if (ageValue === '') {
        captureCurrentSecondarySurface('s1-06-customer-age-empty-secondary', 's1-06 empty-age')
      } else {
        await tapSecondary('age-field')
        await tapSecondary('numeric-3')
        await tapSecondary('numeric-7')
        captureCurrentSecondarySurface('s1-06-customer-age-entered-secondary', 's1-06 entered-age')
        await tapSecondary('keyboard-complete')
      }
      await tapSecondary('confirm')
      await waitForNode('sample.desk.member-list')
      await waitForNode('sample.desk.member-list:row')
      await readState(
        's1-06-confirmed',
        expectedPrimaryIds.confirmed,
        'secondary customer-welcome after customer confirmation',
      )
      record.lastKnownGood = 'S1-06'
      return
    }
    if (ageValue !== '') {
      await tapResource('sample.desk.customer-member:age')
      await inputVirtualText(ageValue)
      await tapResource('ui.base.input:virtual-keyboard:complete')
    }
    await tapResource('sample.desk.customer-member:confirm')
    await waitForNode('sample.desk.member-list')
    await waitForNode('sample.desk.member-list:row')
    await readState(
      's1-06-confirmed',
      expectedPrimaryIds.confirmed,
      ageValue === '' ? 'sample.desk.customer-welcome:message = 欢迎，请等待店员操作; age empty' : 'sample.desk.customer-welcome:message = 欢迎，请等待店员操作',
    )
    record.lastKnownGood = 'S1-06'
  }

  try {
    appendProgress('run-started', {runId, shape, journeyCase, age: ageValue})
    if (!args.get('skipInstall')) {
      if (!fs.existsSync(apk)) throw new Error(`release APK missing: ${apk}`)
      writeText(outputDirectory, 'release-install.txt', textOf(adb(['install', '-r', apk], 'release APK install')))
    }
    const installed = installedApkBinding()
    record.apkBinding.installed = installed
    writeJson(outputDirectory, 'apk-binding.json', record.apkBinding)
    assertApkBinding(record.apkBinding.local, installed)
    const display = displayInventory()
    surfaces = surfaceInventory()
    const pairing = assertDisplayPairing(display, surfaces, shape, 'startup display inventory')
    lockedPairing = pairing
    if (shape === 'dual') {
      activeSecondaryDisplayId = pairing.secondaryDisplay.id
      activeSecondaryDisplay = pairing.secondaryDisplay
    }
    record.display = {
      ids: display.displayIds,
      displays: display.displays,
      selectedPrimaryDisplayId: pairing.primaryDisplay.id,
      selectedPrimaryName: pairing.primaryDisplay.name,
      selectedPrimaryUniqueId: pairing.primaryDisplay.uniqueId,
      selectedPrimaryWidth: pairing.primaryDisplay.width,
      selectedPrimaryHeight: pairing.primaryDisplay.height,
      selectedSecondaryDisplayId: pairing.secondaryDisplay?.id ?? null,
      selectedSecondaryName: pairing.secondaryDisplay?.name ?? null,
      selectedSecondaryUniqueId: pairing.secondaryDisplay?.uniqueId ?? null,
      selectedSecondaryWidth: pairing.secondaryDisplay?.width ?? null,
      selectedSecondaryHeight: pairing.secondaryDisplay?.height ?? null,
      hasSecondary: pairing.secondaryDisplay !== null,
    }
    record.surfaceFlinger = {
      primaryIds: surfaces.primaryIds,
      primaryDisplays: surfaces.primaryDisplays,
      virtualIds: surfaces.virtualIds,
      virtualDisplays: surfaces.virtualDisplays,
      selectedPrimarySurfaceId: pairing.primarySurface.id,
      selectedPrimarySurfaceName: pairing.primarySurface.name,
      selectedPrimarySurfaceWidth: pairing.primarySurface.width,
      selectedPrimarySurfaceHeight: pairing.primarySurface.height,
      selectedSecondarySurfaceId: pairing.secondarySurface?.id ?? null,
      selectedSecondarySurfaceName: pairing.secondarySurface?.name ?? null,
    }
    writeText(outputDirectory, 'display-get-displays.txt', display.command)
    writeText(outputDirectory, 'display-dumpsys.txt', display.dumpsys)
    writeText(outputDirectory, 'surfaceflinger-dumpsys.txt', surfaces.text)
    adb(['logcat', '-c'], 'clear logcat')
    adb(['shell', 'am', 'force-stop', packageName], 'pre-run force-stop')
    adb(['shell', 'input', 'keyevent', 'KEYCODE_BACK'], 'dismiss stale system overlay')
    adb(['shell', 'pm', 'clear', packageName], 'clear isolated package state')
    adb(['shell', 'am', 'start', '-W', '-n', activity], 'cold launch')

    await loginAndOpenForm()
    appendProgress('stage-complete', {stage: 'login-and-open-form'})

    if (journeyCase === 'render-smoke') {
      appendProgress('stage-complete', {stage: 'dual-display-render-smoke'})
    } else if (journeyCase === 'keyboard-alpha-probe') {
      const fieldId = 'sample.desk.member-form:keyboard-alpha-probe'
      const keyboardKeyId = 'ui.base.input:virtual-keyboard:text-a'
      await waitForNode(fieldId)
      await waitForNode('sample.desk.member-form:keyboard-alpha-probe-label', node => node.tag.includes('英文字符测试（仅 sample）'))
      await tapResource(fieldId)
      await waitForNode(keyboardKeyId)
      await tapResource(keyboardKeyId)
      await waitForNode(fieldId, node => node.tag.includes('text="a"'))
      await tapResource('ui.base.input:virtual-keyboard:complete')
      await waitForAbsent(keyboardKeyId)
      const completedField = await waitForNode(fieldId, node => node.tag.includes('text="a"'))
      record.steps.push({
        name: 'mobile-alpha-keyboard-probe',
        timestamp: new Date().toISOString(),
        fieldId,
        observedValue: completedField.node.tag.match(/text="([^"]*)"/)?.[1] ?? null,
        keyboardKeyId,
        keyboardClosedAfterComplete: true,
      })
      record.lastKnownGood = 'mobile-alpha-keyboard-probe-completed'
      appendProgress('stage-complete', {stage: 'mobile-alpha-keyboard-probe'})
    }
    if (!['render-smoke', 'keyboard-alpha-probe'].includes(journeyCase)) {
      await fillAndSubmitMember()
      appendProgress('stage-complete', {stage: 'member-submit'})
    }
    if (journeyCase === 'normal') {
      appendProgress('stage-started', {stage: 'age-and-confirm', age: ageValue})
      await fillAgeAndConfirm()
      appendProgress('stage-complete', {stage: 'age-and-confirm', age: ageValue})
      adb(['shell', 'am', 'force-stop', packageName], 'authenticated cold restart force-stop')
      adb(['shell', 'am', 'start', '-W', '-n', activity], 'authenticated cold restart')
      await waitForNode('sample.desk.member-list')
      await readState(
        's1-06-authenticated-cold-restart',
        expectedPrimaryIds.memberList.concat('sample.desk.member-list:row'),
        'sample.desk.customer-welcome:message = 欢迎，请等待店员操作',
      )
      record.lastKnownGood = 'S1-06-authenticated-cold-restart'
      await tapResource('sample.desk.member-list:logout')
      await waitForNode('sample.auth.login')
      await readState('s1-12-logout', expectedPrimaryIds.anonymous, 'sample.desk.customer-welcome:message = 欢迎，请等待店员操作')
      record.lastKnownGood = 'S1-12'
      adb(['shell', 'am', 'force-stop', packageName], 'normal cold restart force-stop')
      adb(['shell', 'am', 'start', '-W', '-n', activity], 'normal cold restart')
      await waitForNode('sample.auth.login')
      await readState('s1-11-cold-restart-anonymous', expectedPrimaryIds.anonymous, 'sample.desk.customer-welcome:message = 欢迎，请等待店员操作')
      record.lastKnownGood = 'S1-11'
    } else if (journeyCase === 'reject-retry') {
      if (shape === 'dual') await tapSecondary('reject')
      else await tapResource('sample.desk.customer-member:reject')
      await waitForNode('sample.desk.registry-notice')
      await readState(
        's1-07-rejected',
        shape === 'dual' ? [...expectedPrimaryIds.waiting, 'sample.desk.registry-notice'] : [...expectedPrimaryIds.memberForm, 'sample.desk.registry-notice'],
        'sample.desk.customer-welcome:message = 欢迎，请等待店员操作',
      )
      record.lastKnownGood = 'S1-07'
      await tapResource('sample.desk.registry-notice:retry')
      await waitForNode('sample.desk.member-form')
      const retryXml = await readUi()
      if (!retryXml.includes('Alice') || !retryXml.includes('01012345678')) throw new Error('retry form did not restore pending name/phone')
      await readState('s1-08-retry-form', expectedPrimaryIds.retryForm, 'sample.desk.customer-welcome:message unchanged')
      record.lastKnownGood = 'S1-08'
      await tapResource('sample.desk.member-form:submit')
      if (shape === 'dual') {
        await waitForNode('sample.desk.waiting-confirm')
        captureCurrentSecondarySurface('s1-08-retry-customer-confirm-secondary', 's1-08 retry customer confirmation')
        await tapSecondary('confirm-after-retry')
      } else {
        await waitForNode('sample.desk.customer-member')
        await tapResource('sample.desk.customer-member:confirm')
      }
      await waitForNode('sample.desk.member-list')
      await readState('s1-08-retry-confirmed', expectedPrimaryIds.memberList, 'sample.desk.customer-welcome:message unchanged')
      record.lastKnownGood = 'S1-08-confirmed'
    } else if (journeyCase === 'abandon') {
      if (shape === 'dual') await tapSecondary('reject')
      else await tapResource('sample.desk.customer-member:reject')
      await waitForNode('sample.desk.registry-notice')
      await tapResource('sample.desk.registry-notice:abandon')
      await waitForNode('sample.desk.member-list')
      await readState('s1-09-abandoned', expectedPrimaryIds.afterAbandon, 'sample.desk.customer-welcome:message = 欢迎，请等待店员操作')
      record.lastKnownGood = 'S1-09'
    } else if (journeyCase === 'withdraw') {
      await tapResource('sample.desk.waiting-confirm:withdraw')
      await waitForNode('sample.desk.withdraw-confirm')
      await readState('s1-10-withdraw-confirm', expectedPrimaryIds.withdrawConfirm, 'sample.desk.customer-member remains visible until withdraw confirms')
      await tapResource('sample.desk.withdraw-confirm:withdraw')
      await waitForNode('sample.desk.member-form')
      await readState('s1-10-after-withdraw', expectedPrimaryIds.afterWithdraw, 'sample.desk.customer-welcome:message = 欢迎，请等待店员操作')
      record.lastKnownGood = 'S1-10'
    } else if (journeyCase === 'hand-back') {
      await tapResource('sample.desk.customer-member:hand-back')
      await waitForNode('sample.desk.member-form')
      await readState('s1-10-hand-back', expectedPrimaryIds.afterWithdraw, 'single screen has no SECONDARY; customer hand-back returned to form')
      record.lastKnownGood = 'S1-10-hand-back'
      await tapResource('sample.desk.member-form:cancel')
      await waitForNode('sample.desk.member-list')
      await readState('s1-09-hand-back-cancelled', expectedPrimaryIds.afterAbandon, 'single screen has no SECONDARY')
      record.lastKnownGood = 'S1-09'
    }
    record.business = 'PASS'
  } catch (error) {
    record.firstFailure = error instanceof Error ? error.message : String(error)
    record.brokenBoundary = record.lastKnownGood ?? 'before-first-known-good'
    let failureDisplayIds = [...lastUiWindowsDumpByDisplay.keys()]
    try {
      const failureDisplay = displayInventory()
      const failureSurfaces = surfaceInventory()
      failureDisplayIds = [...new Set([
        ...failureDisplayIds,
        ...failureDisplay.displayIds,
        lockedPairing?.primaryDisplay?.id,
        lockedPairing?.secondaryDisplay?.id,
      ].filter(id => Number.isInteger(id)))]
      writeText(outputDirectory, 'first-failure-display-get-displays.txt', failureDisplay.command)
      writeText(outputDirectory, 'first-failure-display-dumpsys.txt', failureDisplay.dumpsys)
      writeText(outputDirectory, 'first-failure-surfaceflinger-dumpsys.txt', failureSurfaces.text)
    } catch (diagnosticError) {
      writeText(outputDirectory, 'first-failure-display-diagnostics-error.txt', diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError))
    }
    await captureFailureUiForDisplays(failureDisplayIds)
    writeText(outputDirectory, 'first-failure-logcat.txt', logcat())
    writeText(outputDirectory, 'first-failure-window.txt', windowSnapshot())
    writeText(outputDirectory, 'first-failure-activity.txt', activitySnapshot())
  } finally {
    try {
      for (const remotePath of uiDumpPaths) {
        const removed = adb(['shell', 'rm', '-f', remotePath], `remove UI dump ${remotePath}`, {allowFailure: true})
        if (removed.status !== 0) throw new Error(`UI dump cleanup failed for ${remotePath}`)
        const absent = adb(['shell', 'test', '!', '-e', remotePath], `verify UI dump removal ${remotePath}`, {allowFailure: true})
        if (absent.status !== 0) throw new Error(`UI dump remains after cleanup: ${remotePath}`)
      }
      adb(['shell', 'am', 'force-stop', packageName], 'final package force-stop')
      const pid = packagePid()
      if (pid !== '') throw new Error(`package still running after cleanup: ${pid}`)
      record.cleanup = 'PASS'
    } catch (error) {
      record.cleanup = 'FAIL'
      if (record.firstFailure === null) record.firstFailure = error instanceof Error ? error.message : String(error)
    }
  }
  record.finishedAt = new Date().toISOString()
  writeJson(outputDirectory, 'result.json', record)
  console.log(`TERMINAL_SAMPLE1_FROZEN_JOURNEY=${record.business} CLEANUP=${record.cleanup} OUTPUT=${outputDirectory}`)
  if (record.business !== 'PASS' || record.cleanup !== 'PASS') process.exitCode = 1
}

fs.mkdirSync(outputDirectory, {recursive: true})
writeJson(outputDirectory, 'run-manifest.json', {
  tool: 'tools/terminal-sample2/run-sample1-frozen-journey.mjs',
  mode: 'record-only-sample1-frozen-journey',
  packageName,
  serial,
  shape,
  journeyCase,
  age: ageValue,
  screenshotsEnabled,
  apk: path.relative(repositoryRoot, apk),
  apkBinding: localApkBinding(),
  startedAt: new Date().toISOString(),
})
await execute()
