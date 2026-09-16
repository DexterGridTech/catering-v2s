import fs from 'node:fs'
import {createHash} from 'node:crypto'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const defaultPhoneSerial = process.env.TER_SAMPLE2_U8_PHONE_SERIAL ?? 'emulator-5556'
const defaultDualSerial = process.env.TER_SAMPLE2_U8_DUAL_SERIAL ?? 'emulator-5554'
const defaultOutput = path.join(
  repositoryRoot,
  'doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/u8-release-cold-start',
)

const appProfiles = Object.freeze([
  {
    id: 'sample-terminal',
    assemblyRoot: path.join(repositoryRoot, 'apps/terminal/assembly/android/sample-terminal'),
    packageName: 'com.anonymous.sampleterminal',
    activity: 'com.anonymous.sampleterminal/.MainActivity',
    apk: path.join(repositoryRoot, 'apps/terminal/assembly/android/sample-terminal/android/app/build/outputs/apk/release/app-release.apk'),
  },
  {
    id: 'sample-wallpaper-terminal',
    assemblyRoot: path.join(repositoryRoot, 'apps/terminal/assembly/android/sample-wallpaper-terminal'),
    packageName: 'com.catering.v2s.terminal.samplewallpaper',
    activity: 'com.catering.v2s.terminal.samplewallpaper/.MainActivity',
    apk: path.join(repositoryRoot, 'apps/terminal/assembly/android/sample-wallpaper-terminal/android/app/build/outputs/apk/release/app-release.apk'),
  },
])

const args = new Map()
for (let index = 2; index < process.argv.length; index += 1) {
  const value = process.argv[index]
  if (value === '--phone-serial') args.set('phoneSerial', process.argv[++index])
  else if (value === '--dual-serial') args.set('dualSerial', process.argv[++index])
  else if (value === '--output') args.set('output', process.argv[++index])
  else if (value === '--app') args.set('app', process.argv[++index])
  else if (value === '--failure-mode') args.set('failureMode', process.argv[++index])
  else if (value === '--skip-build') args.set('skipBuild', true)
  else throw new Error(`unknown argument: ${value}`)
}

const phoneSerial = args.get('phoneSerial') ?? defaultPhoneSerial
const dualSerial = args.get('dualSerial') ?? defaultDualSerial
const outputDirectory = path.resolve(args.get('output') ?? defaultOutput)
const failureMode = args.get('failureMode') ?? null
if (failureMode !== null && failureMode !== 'wrong-primary-display') {
  throw new Error(`unknown failure mode: ${failureMode}`)
}
const selectedProfiles = args.has('app')
  ? appProfiles.filter(profile => profile.id === args.get('app'))
  : appProfiles
if (selectedProfiles.length === 0) throw new Error(`unknown app profile: ${args.get('app')}`)

const run = (command, commandArgs, options = {}) => {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? repositoryRoot,
    encoding: options.binary ? undefined : 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
  if (result.error !== undefined) throw new Error(`${command} ${commandArgs.join(' ')}: ${result.error.message}`)
  const stdout = options.binary ? result.stdout : result.stdout ?? ''
  const stderr = options.binary ? result.stderr : result.stderr ?? ''
  if (result.status !== 0 && options.allowFailure !== true) {
    throw new Error(`${command} ${commandArgs.join(' ')}: exit ${result.status}\n${stderr || stdout}`)
  }
  return {status: result.status ?? -1, stdout, stderr}
}

const runAdb = (serial, adbArgs, label, options = {}) => run(
  'adb',
  ['-s', serial, ...adbArgs],
  {...options, label},
)

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

const writeText = (directory, name, value) => fs.writeFileSync(path.join(directory, name), value)
const writeJson = (directory, name, value) => writeText(directory, name, `${JSON.stringify(value, null, 2)}\n`)

const readApkBinding = profile => {
  const bytes = fs.readFileSync(profile.apk)
  const stat = fs.statSync(profile.apk)
  return {
    path: path.relative(repositoryRoot, profile.apk),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: stat.size,
    mtimeMs: stat.mtimeMs,
  }
}

const cleanLine = value => String(value).replace(/\r/g, '')
const outputText = result => `${result.stdout ?? ''}${result.stderr ?? ''}`

const readDisplayInventory = serial => {
  const cmdDisplay = runAdb(serial, ['shell', 'cmd', 'display', 'get-displays'], 'display inventory', {allowFailure: true})
  const dumpsys = runAdb(serial, ['shell', 'dumpsys', 'display'], 'display dumpsys', {allowFailure: true})
  const text = outputText(cmdDisplay)
  const displayIds = [...text.matchAll(/^Display id (\d+):/gmi)]
    .map(match => Number(match[1]))
    .filter(Number.isInteger)
  const uniqueIds = [...new Set(displayIds)]
  return {
    command: cleanLine(outputText(cmdDisplay)),
    dumpsys: cleanLine(outputText(dumpsys)),
    displayIds: uniqueIds,
    hasSecondary: uniqueIds.some(id => id !== 0),
  }
}

const readSurfaceFlingerInventory = serial => {
  const result = runAdb(serial, ['shell', 'dumpsys', 'SurfaceFlinger', '--displays'], 'SurfaceFlinger display inventory', {allowFailure: true})
  const text = cleanLine(outputText(result))
  const primaryIds = [...text.matchAll(/^Display (\S+)/gm)].map(match => match[1])
  const virtualIds = [...text.matchAll(/^Virtual Display (\S+)/gm)].map(match => match[1])
  return {text, primaryIds, virtualIds}
}

const captureSurface = (serial, surfaceFlingerId, name, directory) => {
  if (surfaceFlingerId === undefined) throw new Error(`${name}: SurfaceFlinger display id unavailable`)
  const result = runAdb(serial, ['exec-out', 'screencap', '-p', '-d', surfaceFlingerId], `${name} screenshot`, {binary: true, allowFailure: true})
  if (!Buffer.isBuffer(result.stdout) || result.stdout.length === 0) throw new Error(`${name}: screenshot output empty`)
  fs.writeFileSync(path.join(directory, `${name}.png`), result.stdout)
  const fileResult = run('file', [path.join(directory, `${name}.png`)], {allowFailure: true})
  writeText(directory, `${name}.file.txt`, outputText(fileResult))
  return result
}

const windowSnapshot = serial => cleanLine(outputText(runAdb(
  serial,
  ['shell', 'dumpsys', 'window', 'windows'],
  'window snapshot',
  {allowFailure: true},
)))

const activitySnapshot = serial => cleanLine(outputText(runAdb(
  serial,
  ['shell', 'dumpsys', 'activity', 'activities'],
  'activity snapshot',
  {allowFailure: true},
)))

const packagePid = (serial, packageName) => {
  const result = runAdb(serial, ['shell', 'pidof', packageName], 'package pid readback', {allowFailure: true})
  return cleanLine(outputText(result)).trim()
}

const readPrimaryUi = (serial, remotePath, label) => {
  const dump = runAdb(serial, ['shell', 'uiautomator', 'dump', remotePath], `${label} dump`, {allowFailure: true})
  const xml = runAdb(serial, ['exec-out', 'cat', remotePath], `${label} readback`, {allowFailure: true})
  const value = cleanLine(outputText(xml))
  return dump.status === 0 && value.startsWith('<?xml') ? value : null
}

// This predicate is intentionally limited to a real application content root.
// Startup/runtime failure pages have a separate oracle below and must never be
// accepted as the normal first-RN-content observation.
const hasFirstRnContent = xml => xml !== null && /resource-id="(?:sample\.auth\.login|sample\.desk\.(?:member-list|member-form|waiting-confirm|customer-member|registry-notice|discard-confirm|withdraw-confirm)|sample\.wallpaper\.picker)"/.test(xml)
const startupFailureUiIdentity = xml => xml !== null
  && xml.includes('resource-id="ui.base.render:startup-failure"')
  && xml.includes('resource-id="ui.base.render:startup-failure:title"')
  && xml.includes('text="终端启动失败"')
  && xml.includes('resource-id="ui.base.render:startup-failure:message"')
  && xml.includes('text="请重启终端，如仍失败请联系管理员"')

const relevantLog = log => log
  .split(/\r?\n/)
  .filter(line => /TER-Splash|startup\.(ready|complete|failure)|surface-host-(ready|unavailable)|secondary-(presentation|react-surface|start)|primary-(activity|window)|FATAL EXCEPTION|AndroidRuntime|ExpoModulesCore/i.test(line))
  .join('\n')

const eventLines = log => log
  .split(/\r?\n/)
  .filter(line => /startup\.(ready-candidate|ready-hidden|complete|ready-failed)|startup\.failure-page-visible/i.test(line))

const splashVisible = snapshot => /Splash Screen|SplashScreen|starting_reveal|splash/i.test(snapshot)

const launchOne = async (profile, serial, shape, directory) => {
  const startedAt = new Date().toISOString()
  const runId = `${profile.id}-${shape}-${Date.now()}`
  const expectedFailure = failureMode !== null && shape === 'dual'
  const recordDirectory = path.join(directory, `${profile.id}-${shape}`)
  fs.mkdirSync(recordDirectory, {recursive: true})
  const record = {
    runId,
    app: profile.id,
    packageName: profile.packageName,
    serial,
    shape,
    failureMode: expectedFailure ? failureMode : null,
    startedAt,
    business: 'NOT_RUN',
    cleanup: 'NOT_RUN',
    firstFailure: null,
    display: null,
    surfaceFlinger: null,
    timeline: [],
  }
  let logcat = ''
  try {
    const display = readDisplayInventory(serial)
    const surfaceFlinger = readSurfaceFlingerInventory(serial)
    record.display = {
      ids: display.displayIds,
      hasSecondary: display.hasSecondary,
    }
    record.surfaceFlinger = {
      primaryIds: surfaceFlinger.primaryIds,
      virtualIds: surfaceFlinger.virtualIds,
    }
    writeText(recordDirectory, 'display-get-displays.txt', display.command)
    writeText(recordDirectory, 'display-dumpsys.txt', display.dumpsys)
    writeText(recordDirectory, 'surfaceflinger-dumpsys.txt', surfaceFlinger.text)
    if (shape === 'dual' && !display.hasSecondary) throw new Error('dual shape requires a non-primary physical display')
    if (shape === 'mobile' && display.hasSecondary) throw new Error('mobile shape must not expose a secondary physical display')
    if (surfaceFlinger.primaryIds.length !== 1) throw new Error('expected exactly one primary SurfaceFlinger display')
    if (shape === 'dual' && surfaceFlinger.virtualIds.length !== 1) throw new Error('dual shape requires exactly one SurfaceFlinger virtual display')
    if (shape === 'mobile' && surfaceFlinger.virtualIds.length !== 0) throw new Error('mobile shape must not expose a SurfaceFlinger virtual display')
    const wrongPrimaryDisplayId = expectedFailure
      ? display.displayIds.find(id => id !== 0)
      : undefined
    if (expectedFailure && wrongPrimaryDisplayId === undefined) {
      throw new Error('wrong-primary-display failure mode requires a non-primary physical display')
    }
    if (expectedFailure) {
      record.timeline.push({
        event: 'failure-injection-selected',
        failureMode,
        activityDisplayId: wrongPrimaryDisplayId,
        expectedPrimaryDisplayId: 0,
      })
    }

    runAdb(serial, ['logcat', '-c'], 'clear logcat')
    runAdb(serial, ['shell', 'am', 'force-stop', profile.packageName], 'pre-launch force-stop')
    const beforeWindow = windowSnapshot(serial)
    const beforeActivity = activitySnapshot(serial)
    writeText(recordDirectory, 'window-before-launch.txt', beforeWindow)
    writeText(recordDirectory, 'activity-before-launch.txt', beforeActivity)
    record.timeline.push({
      event: 'before-launch',
      timestamp: new Date().toISOString(),
      splashVisible: splashVisible(beforeWindow),
      packagePid: packagePid(serial, profile.packageName),
    })

    const launchTimestamp = Date.now()
    const launchArgs = expectedFailure
      ? ['shell', 'am', 'start', '--display', String(wrongPrimaryDisplayId), '-n', profile.activity]
      : ['shell', 'am', 'start', '-n', profile.activity]
    runAdb(serial, launchArgs, expectedFailure ? 'cold launch on wrong physical display' : 'cold launch')
    const immediateWindow = windowSnapshot(serial)
    const immediateActivity = activitySnapshot(serial)
    writeText(recordDirectory, 'window-immediate-after-launch.txt', immediateWindow)
    writeText(recordDirectory, 'activity-immediate-after-launch.txt', immediateActivity)
    const failureSurfaceFlingerId = expectedFailure
      ? surfaceFlinger.virtualIds[0]
      : surfaceFlinger.primaryIds[0]
    captureSurface(serial, failureSurfaceFlingerId, expectedFailure ? 'screen-failure-before-ready' : 'screen-primary-before-ready', recordDirectory)
    record.timeline.push({
      event: 'after-launch-before-ready-poll',
      timestamp: new Date().toISOString(),
      millisecondsSinceLaunch: Date.now() - launchTimestamp,
      splashVisible: splashVisible(immediateWindow),
    })
    const launchSampleSurface = expectedFailure ? surfaceFlinger.virtualIds[0] : surfaceFlinger.primaryIds[0]
    for (const targetMilliseconds of [50, 100, 200, 400, 800]) {
      const remaining = targetMilliseconds - (Date.now() - launchTimestamp)
      if (remaining > 0) await sleep(remaining)
      const actualMilliseconds = Date.now() - launchTimestamp
      const sampleWindow = windowSnapshot(serial)
      const sampleActivity = activitySnapshot(serial)
      const sampleName = expectedFailure ? 'screen-failure' : 'screen-primary'
      const sampleStem = `${sampleName}-launch-${targetMilliseconds}ms`
      writeText(recordDirectory, `window-${sampleStem}.txt`, sampleWindow)
      writeText(recordDirectory, `activity-${sampleStem}.txt`, sampleActivity)
      captureSurface(serial, launchSampleSurface, sampleStem, recordDirectory)
      record.timeline.push({
        event: 'launch-sample',
        targetMilliseconds,
        millisecondsSinceLaunch: actualMilliseconds,
        splashVisible: splashVisible(sampleWindow),
      })
    }
    let readyCandidateLine = null
    let readyHiddenLine = null
    let completeLine = null
    let failureLine = null
    let lastLogcat = ''
    let preReadyWindow = immediateWindow
    let preReadyActivity = immediateActivity
    // The immediate post-launch snapshot is the first recordable pre-ready
    // observation. A fast release start can emit ready-candidate before the
    // first polling iteration; that must not erase the already captured
    // native-splash evidence.
    let preReadyCaptured = splashVisible(immediateWindow)
    let firstContentUi = null
    let firstContentWindow = null
    let firstContentActivity = null
    let firstContentTimestamp = null
    let firstContentLogcat = null
    const firstContentRemotePath = `/sdcard/ter-u8-first-content-${process.pid}-${profile.id}-${shape}.xml`
    const observeFirstContent = () => {
      if (firstContentUi !== null) return
      const candidateUi = readPrimaryUi(serial, firstContentRemotePath, 'first RN content')
      if (!hasFirstRnContent(candidateUi)) return
      firstContentUi = candidateUi
      firstContentTimestamp = Date.now()
      firstContentWindow = windowSnapshot(serial)
      firstContentActivity = activitySnapshot(serial)
      // This is an observation point, not a second clock source for the
      // device log. UIAutomator can return after the ready callback has
      // already hidden the native splash, so retain the same-device log
      // snapshot for an explicit observation-latency record.
      firstContentLogcat = cleanLine(outputText(runAdb(serial, ['logcat', '-d', '-v', 'epoch'], 'logcat at first RN content observation')))
      writeText(recordDirectory, 'ui-first-rn-content.xml', candidateUi)
      writeText(recordDirectory, 'window-first-rn-content.txt', firstContentWindow)
      writeText(recordDirectory, 'activity-first-rn-content.txt', firstContentActivity)
      writeText(recordDirectory, 'logcat-at-first-rn-content.txt', firstContentLogcat)
      captureSurface(
        serial,
        expectedFailure ? surfaceFlinger.virtualIds[0] : surfaceFlinger.primaryIds[0],
        expectedFailure ? 'screen-first-rn-failure' : 'screen-first-rn-content',
        recordDirectory,
      )
      record.timeline.push({
        event: 't0-first-rn-content',
        timestamp: new Date(firstContentTimestamp).toISOString(),
        splashVisible: splashVisible(firstContentWindow),
        failurePage: startupFailureUiIdentity(firstContentUi),
        readyCandidateObservedInSameDeviceLog: eventLines(firstContentLogcat).some(line => /startup\.ready-candidate/i.test(line)),
        readyHiddenObservedInSameDeviceLog: eventLines(firstContentLogcat).some(line => /startup\.ready-hidden/i.test(line)),
      })
    }
    observeFirstContent()
    const deadline = Date.now() + 30_000
    while (Date.now() < deadline) {
      const currentLog = cleanLine(outputText(runAdb(serial, ['logcat', '-d', '-v', 'epoch'], 'logcat readback')))
      lastLogcat = currentLog
      observeFirstContent()
      const lines = eventLines(currentLog)
      readyCandidateLine = lines.find(line => /startup\.ready-candidate/i.test(line)) ?? readyCandidateLine
      readyHiddenLine = lines.find(line => /startup\.ready-hidden/i.test(line)) ?? readyHiddenLine
      completeLine = lines.find(line => /startup\.complete/i.test(line)) ?? completeLine
      failureLine = lines.find(line => /startup\.ready-failed|startup\.failure-page-visible/i.test(line)) ?? failureLine
      if (readyCandidateLine === null && failureLine === null) {
        preReadyWindow = windowSnapshot(serial)
        preReadyActivity = activitySnapshot(serial)
        preReadyCaptured = true
      }
      if (readyCandidateLine !== null || failureLine !== null) break
      await sleep(250)
    }
    logcat = lastLogcat
    if (logcat === '') logcat = cleanLine(outputText(runAdb(serial, ['logcat', '-d', '-v', 'epoch'], 'final logcat readback')))
    writeText(recordDirectory, 'logcat.txt', logcat)
    writeText(recordDirectory, 'logcat-relevant.txt', relevantLog(logcat))

    writeText(recordDirectory, 'window-before-ready.txt', preReadyWindow)
    writeText(recordDirectory, 'activity-before-ready.txt', preReadyActivity)
    const candidateWindow = windowSnapshot(serial)
    const candidateActivity = activitySnapshot(serial)
    writeText(recordDirectory, 'window-at-ready-or-failure.txt', candidateWindow)
    writeText(recordDirectory, 'activity-at-ready-or-failure.txt', candidateActivity)
    record.timeline.push({
      event: 'ready-or-failure-observed',
      timestamp: new Date().toISOString(),
      millisecondsSinceLaunch: Date.now() - launchTimestamp,
      readyCandidate: readyCandidateLine !== null,
      readyHidden: readyHiddenLine !== null,
      startupComplete: completeLine !== null,
      failurePage: failureLine !== null,
      splashVisible: splashVisible(candidateWindow),
      splashVisibleBeforeReady: splashVisible(preReadyWindow),
      preReadyCaptured,
    })

    await sleep(1_500)
    const settledWindow = windowSnapshot(serial)
    const settledActivity = activitySnapshot(serial)
    writeText(recordDirectory, 'window-settled.txt', settledWindow)
    writeText(recordDirectory, 'activity-settled.txt', settledActivity)
    const primaryUiText = readPrimaryUi(serial, `/sdcard/ter-u8-settled-${process.pid}-${profile.id}-${shape}.xml`, 'settled primary UI')
    if (primaryUiText === null) throw new Error('settled primary UI dump/readback did not return XML')
    writeText(recordDirectory, 'ui-primary.xml', primaryUiText)
    writeText(recordDirectory, 'ui-primary-readback.xml', primaryUiText)
    captureSurface(
      serial,
      expectedFailure ? surfaceFlinger.virtualIds[0] : surfaceFlinger.primaryIds[0],
      expectedFailure ? 'screen-failure' : 'screen-primary',
      recordDirectory,
    )
    if (shape === 'dual' && !expectedFailure) captureSurface(serial, surfaceFlinger.virtualIds[0], 'screen-secondary', recordDirectory)
    record.timeline.push({
      event: 'settled',
      timestamp: new Date().toISOString(),
      splashVisible: splashVisible(settledWindow),
      packagePid: packagePid(serial, profile.packageName),
      secondarySurfaceObserved: /secondary-(react-surface|presentation|surface-host)/i.test(logcat),
      primaryUiHasRnContent: hasFirstRnContent(primaryUiText),
    })

    const noFailure = failureLine === null
    const readySequence = readyCandidateLine !== null && readyHiddenLine !== null
    const completeSequence = completeLine !== null
    const secondaryExpected = shape === 'dual'
      ? record.timeline.at(-1)?.secondarySurfaceObserved === true
      : true
    if (expectedFailure) {
      if (failureLine === null) throw new Error('wrong-primary-display did not render the startup failure page')
      if (readyCandidateLine !== null || readyHiddenLine !== null || completeLine !== null) {
        throw new Error('wrong-primary-display unexpectedly reached startup ready or complete')
      }
      if (!preReadyCaptured || !splashVisible(preReadyWindow)) {
        throw new Error('could not prove native splash remained visible before the failure page')
      }
      if (splashVisible(settledWindow)) throw new Error('native splash remained visible after the failure page')
      const failurePageLogObserved = /startup\.failure-page-visible/i.test(logcat)
      const failurePageUiObserved = startupFailureUiIdentity(primaryUiText)
      if (!failurePageUiObserved) throw new Error('startup failure page identity/copy was not observed in settled UI readback')
      record.timeline.push({
        event: 'startup-failure-order',
        failurePage: true,
        provenFailureAfterSplash: true,
        readyEventsAbsent: true,
        uiFailureIdentity: failurePageUiObserved,
        failurePageLogObserved,
        failureSurface: shape === 'dual' ? surfaceFlinger.virtualIds[0] : surfaceFlinger.primaryIds[0],
      })
      record.business = 'PASS'
    } else {
      if (!noFailure) throw new Error('release cold start rendered startup failure page')
      if (!readySequence) throw new Error('startup ready timing record is incomplete')
      if (!completeSequence) throw new Error('startup.complete was not observed after ready')
      if (firstContentUi === null || firstContentTimestamp === null || firstContentWindow === null || firstContentActivity === null) {
        throw new Error('first RN content device observation was not captured')
      }
      if (!hasFirstRnContent(firstContentUi)) throw new Error('first RN content observation has no known app content identity')
      if (!preReadyCaptured || !splashVisible(preReadyWindow)) throw new Error('could not prove native splash remained visible before ready')
      const epochOf = line => {
        const match = line?.match(/^\s*(\d+\.\d+)/)
        return match === null || match === undefined ? null : Number(match[1])
      }
      const candidateEpoch = epochOf(readyCandidateLine)
      const hiddenEpoch = epochOf(readyHiddenLine)
      const completeEpoch = epochOf(completeLine)
      if (candidateEpoch === null || hiddenEpoch === null || completeEpoch === null) throw new Error('startup event epoch unavailable')
      // Production deliberately records startup.complete from the shared
      // console writer before the platform-port ready-hidden diagnostic. The
      // requirement is that both completion and splash dismissal follow the
      // ready candidate, not that those two independent records have an
      // artificial total order.
      if (!(candidateEpoch <= completeEpoch && candidateEpoch <= hiddenEpoch)) {
        throw new Error('startup event order is not candidate<=complete and candidate<=hidden')
      }
      record.timeline.push({
        event: 'startup-order',
        candidateEpoch,
        hiddenEpoch,
        completeEpoch,
        firstContentObservationTimestamp: new Date(firstContentTimestamp).toISOString(),
        firstContentObservationSplashVisible: splashVisible(firstContentWindow),
        firstContentObservedAfterReadyCandidate: eventLines(firstContentLogcat).some(line => /startup\.ready-candidate/i.test(line)),
        firstContentObservedAfterReadyHidden: eventLines(firstContentLogcat).some(line => /startup\.ready-hidden/i.test(line)),
        provenReadyAfterRenderOwnedContent: true,
        settledSplashHidden: !splashVisible(settledWindow),
      })
      if (splashVisible(settledWindow)) throw new Error('native splash remained visible after successful ready')
      if (!hasFirstRnContent(primaryUiText)) throw new Error('settled UI has no known RN content identity')
      if (!secondaryExpected) throw new Error('dual cold start did not emit secondary surface evidence')
      record.business = 'PASS'
    }
  } catch (error) {
    record.firstFailure = error instanceof Error ? error.message : String(error)
    writeText(recordDirectory, 'logcat.txt', logcat)
    writeText(recordDirectory, 'logcat-relevant.txt', relevantLog(logcat))
  } finally {
    try {
      runAdb(serial, ['shell', 'am', 'force-stop', profile.packageName], 'final package force-stop')
      const pid = packagePid(serial, profile.packageName)
      if (pid !== '') throw new Error(`package still running after cleanup: ${pid}`)
      record.cleanup = 'PASS'
    } catch (error) {
      if (record.firstFailure === null) record.firstFailure = error instanceof Error ? error.message : String(error)
      record.cleanup = 'FAIL'
    }
  }
  record.finishedAt = new Date().toISOString()
  writeJson(recordDirectory, 'result.json', record)
  return record
}

fs.mkdirSync(outputDirectory, {recursive: true})
const manifest = {
  runId: `u8-${Date.now()}`,
  tool: 'tools/terminal-sample2/run-u8-release-cold-start.mjs',
  mode: 'record-only-release-cold-start',
  failureMode,
  startedAt: new Date().toISOString(),
  phoneSerial,
  dualSerial,
  profiles: selectedProfiles.map(profile => profile.id),
  build: args.get('skipBuild') ? 'SKIPPED_BY_EXPLICIT_OPTION' : 'RELEASE_ASSEMBLE',
  apkBindings: {},
}
writeJson(outputDirectory, 'run-manifest.json', manifest)

let firstFailure = null
const records = []
try {
  for (const profile of selectedProfiles) {
    if (!args.get('skipBuild')) {
      const build = run('./gradlew', ['assembleRelease', '--no-daemon', '--console=plain'], {cwd: path.join(profile.assemblyRoot, 'android')})
      writeText(outputDirectory, `${profile.id}-assemble-release.log`, outputText(build))
    }
    if (!fs.existsSync(profile.apk)) throw new Error(`${profile.id}: release APK missing at ${profile.apk}`)
    manifest.apkBindings[profile.id] = readApkBinding(profile)
    writeJson(outputDirectory, `${profile.id}-apk-binding.json`, manifest.apkBindings[profile.id])
    writeJson(outputDirectory, 'run-manifest.json', manifest)
    for (const [serial, shape] of [[phoneSerial, 'mobile'], [dualSerial, 'dual']]) {
      runAdb(serial, ['install', '-r', profile.apk], `${profile.id} release install`)
      records.push(await launchOne(profile, serial, shape, outputDirectory))
      if (records.at(-1).firstFailure !== null && firstFailure === null) firstFailure = records.at(-1).firstFailure
    }
  }
} catch (error) {
  firstFailure = firstFailure ?? (error instanceof Error ? error.message : String(error))
}

const result = {
  ...manifest,
  finishedAt: new Date().toISOString(),
  business: firstFailure === null && records.length === selectedProfiles.length * 2 && records.every(record => record.business === 'PASS') ? 'PASS' : 'FAIL',
  cleanup: records.length === selectedProfiles.length * 2 && records.every(record => record.cleanup === 'PASS') ? 'PASS' : 'FAIL',
  firstFailure,
  records: records.map(record => ({
    runId: record.runId,
    app: record.app,
    serial: record.serial,
    shape: record.shape,
    business: record.business,
    cleanup: record.cleanup,
    firstFailure: record.firstFailure,
  })),
}
writeJson(outputDirectory, 'result.json', result)
console.log(`TERMINAL_U8_RELEASE_COLD_START=${result.business} CLEANUP=${result.cleanup} OUTPUT=${outputDirectory}`)
if (result.business !== 'PASS' || result.cleanup !== 'PASS') process.exitCode = 1
