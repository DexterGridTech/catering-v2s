import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const packageName = 'com.catering.v2s.terminal.samplewallpaper'
const activity = `${packageName}/.MainActivity`
const apk = path.join(
  repositoryRoot,
  'apps/terminal/assembly/android/sample-wallpaper-terminal/android/app/build/outputs/apk/release/app-release.apk',
)
const defaultOutput = path.join(
  repositoryRoot,
  'doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/sample2-frozen-journey',
)

const args = new Map()
for (let index = 2; index < process.argv.length; index += 1) {
  const value = process.argv[index]
  if (value === '--serial') args.set('serial', process.argv[++index])
  else if (value === '--shape') args.set('shape', process.argv[++index])
  else if (value === '--output') args.set('output', process.argv[++index])
  else if (value === '--skip-install') args.set('skipInstall', true)
  else throw new Error(`unknown argument: ${value}`)
}

const serial = args.get('serial') ?? 'emulator-5556'
const shape = args.get('shape') ?? 'mobile'
if (!['mobile', 'dual'].includes(shape)) throw new Error(`invalid shape: ${shape}`)
const outputDirectory = path.resolve(args.get('output') ?? defaultOutput)
const wallpaperLabels = Object.freeze({none: '无壁纸', w1: '山景', w2: '湖景', w3: '海滩'})
const wallpaperIdForLabel = Object.freeze(Object.fromEntries(
  Object.entries(wallpaperLabels).map(([id, label]) => [label, id]),
))

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
  if (result.error !== undefined) throw new Error(`${command} ${commandArgs.join(' ')}: ${result.error.message}`)
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

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const nodeForId = (xml, resourceId) => {
  const escaped = escapeRegExp(resourceId)
  const match = xml.match(new RegExp(`<node\\b[^>]*resource-id="${escaped}"[^>]*>`))
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

const parseLogicalDisplays = commandText => commandText
  .split('\n')
  .filter(line => /^Display id \d+:/.test(line))
  .map(line => {
    const normalized = line.replace(/\\"/g, '"')
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
    .map(block => ({
      id: block.match(/^Display (\S+)/)?.[1] ?? '',
      name: block.match(/^\s*name="([^"]+)"/m)?.[1] ?? null,
      width: Number(block.match(/activeMode=.*resolution=(\d+)x(\d+)/)?.[1] ?? 0),
      height: Number(block.match(/activeMode=.*resolution=(\d+)x(\d+)/)?.[2] ?? 0),
    }))
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

const captureSurface = (displayId, name, directory) => {
  const result = adb(['exec-out', 'screencap', '-p', '-d', displayId], `${name} screenshot`, {binary: true, allowFailure: true})
  if (!Buffer.isBuffer(result.stdout) || result.stdout.length === 0) {
    throw new Error(`${name} screenshot is empty`)
  }
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
  // supported --windows form returns explicit <display id="..."> trees; select
  // the requested tree instead of treating the focused display as evidence.
  const remotePath = `/sdcard/ter-sample2-frozen-journey-${process.pid}-${displayId}.xml`
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
  throw new Error(`UI resource did not reach expected state: ${resourceId}\n${lastXml.slice(-1200)}`)
}

const tapResource = async resourceId => {
  const {node} = await waitForNode(resourceId, current => current.right > current.left && current.bottom > current.top)
  const x = Math.floor((node.left + node.right) / 2)
  const y = Math.floor((node.top + node.bottom) / 2)
  adb(['shell', 'input', 'tap', String(x), String(y)], `tap ${resourceId}`)
  return {resourceId, x, y}
}

const inputVirtualText = async value => {
  const normalized = value.toLowerCase()
  if (value !== normalized) await tapResource('ui.base.input:virtual-keyboard:shift')
  for (const character of normalized) {
    await tapResource(`ui.base.input:virtual-keyboard:text-${character}`)
  }
}
const windowSnapshot = () => textOf(adb(['shell', 'dumpsys', 'window', 'windows'], 'window snapshot', {allowFailure: true}))
const activitySnapshot = () => textOf(adb(['shell', 'dumpsys', 'activity', 'activities'], 'activity snapshot', {allowFailure: true}))
const logcat = () => textOf(adb(['logcat', '-d', '-v', 'epoch'], 'logcat readback', {allowFailure: true}))
const packagePid = () => textOf(adb(['shell', 'pidof', packageName], 'package PID readback', {allowFailure: true})).trim()

const readState = async (name, inventory, surfaces, directory, record) => {
  const expectation = stateExpectationFor(name)
  let xml = await readUi()
  let selectionXml = xml
  let confirmationXml = xml
  if (nodeForId(xml, expectation.primaryPartKey) === null) {
    throw new Error(`${name}: primary partKey missing: ${expectation.primaryPartKey}`)
  }
  assertTexts(xml, expectation.primaryTexts, `${name} primary`)
  let selectedOptions = ['none', 'w1', 'w2', 'w3']
    .filter(id => nodeForId(xml, `sample.wallpaper.picker:options:${id}`)?.selected)
  if (expectation.selectedWallpaperId !== undefined) {
    if (selectedOptions.length !== 1 || selectedOptions[0] !== expectation.selectedWallpaperId) {
      // A previous state read may have left the real ScrollView at its bottom.
      // Restore the named options viewport before calling an off-screen selected
      // radio button a product defect.
      if (selectedOptions.length === 0) {
        await swipeToTop()
        xml = await readUi()
        selectionXml = xml
        selectedOptions = ['none', 'w1', 'w2', 'w3']
          .filter(id => nodeForId(xml, `sample.wallpaper.picker:options:${id}`)?.selected)
      }
      if (selectedOptions.length !== 1 || selectedOptions[0] !== expectation.selectedWallpaperId) {
        throw new Error(`${name}: selected wallpaper state drifted; expected=${expectation.selectedWallpaperId} observed=${selectedOptions.join(',')}`)
      }
    }
  }
  let confirmNode = nodeForId(xml, 'sample.wallpaper.picker:confirm')
  if (confirmNode === null && expectation.primaryPartKey === 'sample.wallpaper.picker') {
    // The confirm action is below the real optionsScroll viewport on mobile. Move
    // through the named scroll node before treating an absent accessibility node
    // as a product defect; keep the assertion against the resulting UI tree.
    await swipeToBottom()
    xml = await readUi()
    confirmationXml = xml
    confirmNode = nodeForId(xml, 'sample.wallpaper.picker:confirm')
    const bottomSelectedOptions = ['none', 'w1', 'w2', 'w3']
      .filter(id => nodeForId(xml, `sample.wallpaper.picker:options:${id}`)?.selected)
    if (selectedOptions.length === 0 && bottomSelectedOptions.length === 1) selectedOptions = bottomSelectedOptions
  }
  if (confirmNode === null && expectation.primaryPartKey === 'sample.wallpaper.picker') {
    throw new Error(`${name}: confirm control missing`)
  }
  if (confirmNode !== null && confirmNode.enabled !== expectation.confirmEnabled) {
    throw new Error(`${name}: confirm enabled state drifted; expected=${expectation.confirmEnabled} observed=${confirmNode.enabled}`)
  }
  const secondaryId = record.display?.selectedSecondaryDisplayId ?? null
  const secondaryXml = shape === 'dual'
    ? await readUiForDisplay(secondaryId ?? (() => { throw new Error(`${name}: secondary display id unavailable`) })())
    : null
  if (secondaryXml !== null) {
    if (nodeForId(secondaryXml, expectation.secondaryPartKey) === null) {
      throw new Error(`${name}: secondary partKey missing: ${expectation.secondaryPartKey}`)
    }
    assertTexts(secondaryXml, expectation.secondaryTexts, `${name} secondary`)
    writeText(directory, `${name}-secondary.xml`, secondaryXml)
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
  writeText(directory, `${name}-display-get-displays.txt`, stateDisplay.command)
  writeText(directory, `${name}-display-dumpsys.txt`, stateDisplay.dumpsys)
  writeText(directory, `${name}-surfaceflinger-dumpsys.txt`, stateSurfaces.text)
  const backgroundNode = nodeForId(selectionXml, 'sample.wallpaper.background')
  const backgroundPresent = backgroundNode !== null
  const observedBackgroundAssetId = backgroundNode === null
    ? 'none'
    : wallpaperIdForLabel[backgroundNode.tag.match(/content-desc="当前壁纸：([^"]+)"/)?.[1]]
  if (backgroundPresent !== expectation.backgroundPresent) {
    throw new Error(`${name}: wallpaper background presence drifted; expected=${expectation.backgroundPresent} observed=${backgroundPresent}`)
  }
  if (expectation.confirmedWallpaperId !== undefined && observedBackgroundAssetId !== expectation.confirmedWallpaperId) {
    throw new Error(`${name}: rendered background asset identity drifted; expected=${expectation.confirmedWallpaperId} observed=${observedBackgroundAssetId ?? 'none'}`)
  }
  writeText(directory, `${name}.xml`, selectionXml)
  // Keep both semantic views explicit even when the button was already visible.
  // This makes the evidence self-describing and prevents an absent selected node
  // from being confused with the real `none` wallpaper choice.
  writeText(directory, `${name}-selection.xml`, selectionXml)
  writeText(directory, `${name}-confirmation.xml`, confirmationXml)
  writeText(directory, `${name}-primary-uiautomator-windows.xml`, lastUiWindowsDumpByDisplay.get(0) ?? '')
  if (secondaryXml !== null) {
    writeText(directory, `${name}-secondary-uiautomator-windows.xml`, lastUiWindowsDumpByDisplay.get(secondaryId) ?? '')
  }
  writeText(directory, `${name}-window.txt`, windowSnapshot())
  writeText(directory, `${name}-activity.txt`, activitySnapshot())
  writeText(directory, `${name}-logcat.txt`, logcat())
  const primaryCapture = captureSurface(stateSurfaces.primaryIds[0], `${name}-primary`, directory)
  assertScreenshotDimensions(primaryCapture, statePairing.primaryDisplay, `${name} primary`)
  if (shape === 'dual') {
    const selectedSecondarySurfaceId = statePairing.secondarySurface.id
    if (selectedSecondarySurfaceId === null) throw new Error(`${name}: SurfaceFlinger secondary display id unavailable`)
    const secondaryCapture = captureSurface(selectedSecondarySurfaceId, `${name}-secondary`, directory)
    assertScreenshotDimensions(secondaryCapture, statePairing.secondaryDisplay, `${name} secondary`)
  }
  const observedSelectedWallpaperId = selectedOptions
  const observedEffectiveWallpaperId = observedSelectedWallpaperId.length === 1
    ? observedSelectedWallpaperId[0]
    : undefined
  const observedConfirmedWallpaperId = confirmNode === null || confirmNode.enabled === false
    ? observedEffectiveWallpaperId
    : undefined
  if (expectation.selectedWallpaperId !== undefined && observedEffectiveWallpaperId !== expectation.selectedWallpaperId) {
    throw new Error(`${name}: observed effective wallpaper does not match expectation; expected=${expectation.selectedWallpaperId} observed=${observedEffectiveWallpaperId ?? 'not-visible'}`)
  }
  if (!expectation.confirmEnabled && expectation.confirmedWallpaperId !== undefined
    && observedConfirmedWallpaperId !== expectation.confirmedWallpaperId) {
    throw new Error(`${name}: observed confirmed wallpaper does not match expectation; expected=${expectation.confirmedWallpaperId} observed=${observedConfirmedWallpaperId ?? 'not-visible'}`)
  }
  record.steps.push({
    name,
    timestamp: new Date().toISOString(),
    expectedPrimaryPartKey: expectation.primaryPartKey,
    expectedSecondaryPartKey: shape === 'dual' ? expectation.secondaryPartKey : undefined,
    expectedBusinessState: {
      selectedWallpaperId: expectation.selectedWallpaperId,
      confirmedWallpaperId: expectation.confirmedWallpaperId,
      observedEffectiveWallpaperId,
      observedConfirmedWallpaperId,
      observedBackgroundAssetId,
      backgroundPresent: expectation.backgroundPresent,
      confirmEnabled: expectation.confirmEnabled,
    },
    resourceIds: [...new Set([
      ...selectionXml.matchAll(/resource-id="([^"]+)"/g),
      ...confirmationXml.matchAll(/resource-id="([^"]+)"/g),
    ].map(match => match[1]))],
    selected: ['none', 'w1', 'w2', 'w3'].map(id => ({
      id,
      node: nodeForId(selectionXml, `sample.wallpaper.picker:options:${id}`)
        ?? nodeForId(confirmationXml, `sample.wallpaper.picker:options:${id}`),
    })),
    backgroundPresent,
    displayIdentity: {
      logicalPrimary: statePairing.primaryDisplay,
      logicalSecondary: statePairing.secondaryDisplay,
      surfacePrimary: statePairing.primarySurface,
      surfaceSecondary: statePairing.secondarySurface,
    },
  })
  return xml
}

const swipeToTop = async () => {
  const {node} = await waitForNode('sample.wallpaper.picker:options:scroll', current => current.right > current.left && current.bottom > current.top)
  const x = Math.floor((node.left + node.right) / 2)
  const top = node.top + Math.floor((node.bottom - node.top) * 0.2)
  const bottom = node.bottom - Math.floor((node.bottom - node.top) * 0.2)
  adb(['shell', 'input', 'swipe', String(x), String(top), String(x), String(bottom), '800'], 'scroll picker to top')
  await sleep(400)
}

const swipeToBottom = async () => {
  const {node} = await waitForNode('sample.wallpaper.picker:options:scroll', current => current.right > current.left && current.bottom > current.top)
  const x = Math.floor((node.left + node.right) / 2)
  const top = node.top + Math.floor((node.bottom - node.top) * 0.2)
  const bottom = node.bottom - Math.floor((node.bottom - node.top) * 0.2)
  adb(['shell', 'input', 'swipe', String(x), String(bottom), String(x), String(top), '800'], 'scroll picker to bottom')
  await sleep(400)
}

const waitForPicker = () => waitForNode('sample.wallpaper.picker')
const requiredPickerIds = [
  'sample.wallpaper.picker:options:none',
  'sample.wallpaper.picker:options:w1',
  'sample.wallpaper.picker:options:w2',
  'sample.wallpaper.picker:options:w3',
  'sample.wallpaper.picker:options:w1:thumbnail',
  'sample.wallpaper.picker:options:w2:thumbnail',
  'sample.wallpaper.picker:options:w3:thumbnail',
]

const stateExpectationFor = name => {
  if (name === 'anonymous') {
    return {
      primaryPartKey: 'sample.auth.login',
      primaryTexts: ['店员登录'],
      secondaryPartKey: 'sample.wallpaper-console.waiting',
      secondaryTexts: ['等待店员登录'],
      selectedWallpaperId: undefined,
      confirmedWallpaperId: undefined,
      backgroundPresent: false,
      confirmEnabled: false,
    }
  }
  const selectedWallpaperId = name.match(/^(w[123])-/)?.[1]
  const confirmedWallpaperId = name === 'w1-pending'
    ? 'none'
    : name === 'w1-confirmed'
      ? 'w1'
      : name === 'w2-pending'
        ? 'w1'
        : name === 'w2-confirmed'
          ? 'w2'
          : name.startsWith('w3-pending')
            ? 'w2'
            : name.startsWith('w3-confirmed')
              ? 'w3'
              : undefined
  return {
    primaryPartKey: 'sample.wallpaper.picker',
    primaryTexts: ['选择屏幕壁纸'],
    secondaryPartKey: 'sample.wallpaper-console.welcome',
    secondaryTexts: ['欢迎，请等待店员操作'],
    selectedWallpaperId: name === 'picker-after-login' ? 'none' : selectedWallpaperId,
    confirmedWallpaperId: name === 'picker-after-login' ? 'none' : confirmedWallpaperId,
    backgroundPresent: name !== 'picker-after-login' && name !== 'w1-pending',
    confirmEnabled: name.includes('-pending'),
  }
}

const assertTexts = (xml, expected, label) => {
  const missing = expected.filter(text => !xml.includes(text))
  if (missing.length > 0) throw new Error(`${label}: missing expected business state text: ${missing.join(', ')}`)
}

const execute = async () => {
  fs.mkdirSync(outputDirectory, {recursive: true})
  const runId = `sample2-frozen-${shape}-${Date.now()}`
  const record = {
    runId,
    tool: 'tools/terminal-sample2/run-sample2-frozen-journey.mjs',
    packageName,
    activity,
    serial,
    shape,
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
  writeJson(outputDirectory, 'apk-binding.json', record.apkBinding)
  try {
    if (!args.get('skipInstall')) {
      if (!fs.existsSync(apk)) throw new Error(`release APK missing: ${apk}`)
      const install = adb(['install', '-r', apk], 'release APK install')
      writeText(outputDirectory, 'release-install.txt', textOf(install))
    }
    const installed = installedApkBinding()
    record.apkBinding.installed = installed
    writeJson(outputDirectory, 'apk-binding.json', record.apkBinding)
    assertApkBinding(record.apkBinding.local, installed)
    const display = displayInventory()
    surfaces = surfaceInventory()
    const pairing = assertDisplayPairing(display, surfaces, shape, 'startup display inventory')
    lockedPairing = pairing
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
    await waitForNode('sample.auth.login')
    await readState('anonymous', display, surfaces, outputDirectory, record)
    record.lastKnownGood = 'anonymous-login'

    await tapResource('sample.auth.login:operator-name')
    await inputVirtualText('A001')
    await tapResource('ui.base.input:virtual-keyboard:complete')
    await tapResource('sample.auth.login:passcode')
    await inputVirtualText('1111')
    await tapResource('ui.base.input:virtual-keyboard:complete')
    await tapResource('sample.auth.login:submit')
    await waitForPicker()
    const pickerXml = await readUi()
    const missingIds = requiredPickerIds.filter(resourceId => nodeForId(pickerXml, resourceId) === null)
    if (missingIds.length > 0) throw new Error(`picker required UI nodes missing: ${missingIds.join(', ')}`)
    await readState('picker-after-login', display, surfaces, outputDirectory, record)
    record.lastKnownGood = 'picker-after-login'

    for (const id of ['w1', 'w2']) {
      await swipeToTop()
      await tapResource(`sample.wallpaper.picker:options:${id}`)
      await waitForNode(`sample.wallpaper.picker:options:${id}`, node => node.selected)
      await readState(`${id}-pending`, display, surfaces, outputDirectory, record)
      await swipeToBottom()
      await waitForNode('sample.wallpaper.picker:confirm', node => node.enabled)
      await tapResource('sample.wallpaper.picker:confirm')
      await waitForNode('sample.wallpaper.background')
      await readState(`${id}-confirmed`, display, surfaces, outputDirectory, record)
      record.lastKnownGood = `${id}-confirmed`
    }

    await swipeToTop()
    await tapResource('sample.wallpaper.picker:options:w3')
    await waitForNode('sample.wallpaper.picker:options:w3', node => node.selected)
    await readState('w3-pending-before-restart', display, surfaces, outputDirectory, record)
    adb(['shell', 'am', 'force-stop', packageName], 'pending-state cold restart force-stop')
    adb(['shell', 'am', 'start', '-W', '-n', activity], 'pending-state cold restart')
    await waitForPicker()
    const pendingRestartXml = await readUi()
    if (!nodeForId(pendingRestartXml, 'sample.wallpaper.picker:options:w3')?.selected) {
      throw new Error('pending w3 was not selected after cold restart')
    }
    if (nodeForId(pendingRestartXml, 'sample.wallpaper.background') === null) {
      throw new Error('confirmed wallpaper background was absent after pending-state cold restart')
    }
    await readState('w3-pending-after-restart', display, surfaces, outputDirectory, record)
    record.lastKnownGood = 'pending-w3-restored'

    await swipeToBottom()
    await waitForNode('sample.wallpaper.picker:confirm', node => node.enabled)
    await tapResource('sample.wallpaper.picker:confirm')
    await waitForNode('sample.wallpaper.background')
    await readState('w3-confirmed', display, surfaces, outputDirectory, record)
    await adb(['shell', 'am', 'force-stop', packageName], 'confirmed-state cold restart force-stop')
    await adb(['shell', 'am', 'start', '-W', '-n', activity], 'confirmed-state cold restart')
    await waitForPicker()
    const confirmedRestartXml = await readUi()
    const confirmedW3 = nodeForId(confirmedRestartXml, 'sample.wallpaper.picker:options:w3')
    const confirmAfterRestart = nodeForId(confirmedRestartXml, 'sample.wallpaper.picker:confirm')
    if (!confirmedW3?.selected || confirmAfterRestart?.enabled) {
      throw new Error('confirmed w3 did not restore with pending cleared')
    }
    await readState('w3-confirmed-after-restart', display, surfaces, outputDirectory, record)
    record.lastKnownGood = 'confirmed-w3-restored-without-pending'
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
  console.log(`TERMINAL_SAMPLE2_FROZEN_JOURNEY=${record.business} CLEANUP=${record.cleanup} OUTPUT=${outputDirectory}`)
  if (record.business !== 'PASS' || record.cleanup !== 'PASS') process.exitCode = 1
  return record
}

fs.mkdirSync(outputDirectory, {recursive: true})
writeJson(outputDirectory, 'run-manifest.json', {
  tool: 'tools/terminal-sample2/run-sample2-frozen-journey.mjs',
  mode: 'record-only-sample2-frozen-normal-journey',
  packageName,
  serial,
  shape,
  apk: path.relative(repositoryRoot, apk),
  apkBinding: localApkBinding(),
  startedAt: new Date().toISOString(),
})
await execute()
