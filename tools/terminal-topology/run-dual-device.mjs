#!/usr/bin/env node

import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import {spawn, spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import WebSocket from 'ws'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const topologyConfigPath = path.join(repositoryRoot, 'apps/terminal/kernel/base/contracts/topology-transport.config.json')
const topologyTransportConfig = JSON.parse(fs.readFileSync(topologyConfigPath, 'utf8'))
const topologyPort = topologyTransportConfig.port
// The Android host remains on topologyPort.  The two ADB directions share a
// host-side bridge, so its local endpoint must not reuse topologyPort:
// forward(local bridge -> master device topologyPort) and
// reverse(slave device topologyPort -> local bridge) otherwise collide.
const hostBridgePort = 43173
const topologyBasePath = topologyTransportConfig.basePath
// Android's shell-side `uiautomator dump` creates a fresh UiAutomation
// connection for each invocation.  The stage-one emulator evidence shows
// that starting the next dump immediately after a UI action can race the
// previous connection's release (`could not get idle state` / duplicate
// registration), even though the React screen is already visible.  These
// are observer-boundary delays, not application readiness claims: they are
// only used after an input action or an observed dump failure.
const uiActionSettleDelayMs = 1_500
const uiObservationRecoveryDelayMs = 4_000
const uiObservationMinIntervalMs = 250
const uiObserverRequestTimeoutMs = 8_000
// The runner owns a host-side ADB forward to the master emulator and a
// separate reverse on the slave emulator. The slave addresses that bridge as
// loopback, keeping both app runtimes on real device/process boundaries
// without depending on emulator-internal peer routing.
const hostAliasForAndroidEmulator = '127.0.0.1'

const profiles = Object.freeze({
  'sample-terminal': Object.freeze({
    name: 'sample-terminal',
    packageName: 'com.anonymous.sampleterminal',
    activity: 'com.anonymous.sampleterminal/.MainActivity',
    apk: path.join(repositoryRoot, 'apps/terminal/assembly/android/sample-terminal/android/app/build/outputs/apk/release/app-release.apk'),
    memberJourney: true,
  }),
  'sample-wallpaper-terminal': Object.freeze({
    name: 'sample-wallpaper-terminal',
    packageName: 'com.catering.v2s.terminal.samplewallpaper',
    activity: 'com.catering.v2s.terminal.samplewallpaper/.MainActivity',
    apk: path.join(repositoryRoot, 'apps/terminal/assembly/android/sample-wallpaper-terminal/android/app/build/outputs/apk/release/app-release.apk'),
    memberJourney: false,
  }),
})

const parseArgs = () => {
  const values = new Map()
  for (let index = 2; index < process.argv.length; index += 1) {
    const value = process.argv[index]
    if (value === '--master-serial') values.set('masterSerial', process.argv[++index])
    else if (value === '--slave-serial') values.set('slaveSerial', process.argv[++index])
    else if (value === '--app') values.set('app', process.argv[++index])
    else if (value === '--stage') values.set('stage', process.argv[++index])
    else if (value === '--serial') values.set('serial', process.argv[++index])
    else if (value === '--shape') values.set('shape', process.argv[++index])
    else if (value === '--output') values.set('output', process.argv[++index])
    else throw new Error(`unknown argument: ${value}`)
  }
  return values
}

const cli = parseArgs()
const stage = cli.get('stage') ?? '1'
const appSelection = cli.get('app') ?? 'sample-terminal'
const masterSerial = cli.get('masterSerial') ?? 'emulator-5554'
const slaveSerial = cli.get('slaveSerial') ?? 'emulator-5556'
const stage2Serial = cli.get('serial') ?? 'emulator-5558'
const stage2Shape = cli.get('shape') ?? 'dual'
const selectedProfiles = appSelection === 'all'
  ? Object.values(profiles)
  : [profiles[appSelection]]

if (!['1', '2'].includes(stage)) throw new Error(`invalid stage: ${stage}`)
if (stage === '2' && !['dual', 'mobile'].includes(stage2Shape)) throw new Error(`invalid stage 2 shape: ${stage2Shape}`)
if (selectedProfiles.some(profile => profile === undefined)) throw new Error(`invalid app selection: ${appSelection}`)

const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
const outputDirectory = path.resolve(cli.get('output') ?? path.join(
  repositoryRoot,
  '.runtime/ter-dual-machine-topology/2026-09-17/cp5',
  `stage${stage}-${timestamp}`,
))

fs.mkdirSync(outputDirectory, {recursive: true})

const sanitizeDiagnostic = value => `${value ?? ''}`
  .replace(/(text="（)\d{6}(）")/g, '$1[REDACTED]$2')
  .replace(/(debug-password[^>]*text=")[^"]*(")/gi, '$1[REDACTED]$2')
  .replace(/((?:password|passwd|token|cookie|authorization|otp|phone|username|login)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]')
  .replace(/((?:password|passwd|token|cookie|authorization|otp|phone|username|login)"\s*:\s*")[^"]*(")/gi, '$1[REDACTED]$2')
  .replace(/\b\d{10,11}\b/g, '[PHONE_REDACTED]')
  .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP_REDACTED]')
  .replace(/10\.0\.2\.2/g, '[HOST_REDACTED]')

const byteLength = value => Buffer.isBuffer(value)
  ? value.length
  : Buffer.byteLength(value ?? '')

let commandSequence = 0
const appendCommandLog = entry => {
  const sequence = String(commandSequence++).padStart(5, '0')
  const stderrText = Buffer.isBuffer(entry.stderr) ? entry.stderr.toString('utf8') : `${entry.stderr ?? ''}`
  const stderrPath = stderrText.length === 0
    ? null
    : path.join(currentOutputDirectory, `command-stderr-${sequence}.txt`)
  if (stderrPath !== null) fs.writeFileSync(stderrPath, `${sanitizeDiagnostic(stderrText).slice(0, 16_384)}\n`)
  fs.appendFileSync(
    path.join(currentOutputDirectory, 'command-actions.jsonl'),
    `${JSON.stringify({
      timestamp: new Date().toISOString(),
      ...entry,
      stderr: undefined,
      stderrPath: stderrPath === null ? null : path.relative(repositoryRoot, stderrPath),
      logPath: path.relative(repositoryRoot, path.join(currentOutputDirectory, 'command-actions.jsonl')),
    })}\n`,
  )
}

class RunnerFailure extends Error {
  constructor(label, detail) {
    super(`${label}: ${detail}`)
    this.name = 'RunnerFailure'
    this.label = label
  }
}

const run = (command, commandArgs, options = {}) => {
  const startedAt = Date.now()
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? repositoryRoot,
    encoding: options.binary === true ? undefined : 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: options.timeout ?? 15_000,
  })
  const stdout = result.stdout ?? (options.binary === true ? Buffer.alloc(0) : '')
  const stderr = result.stderr ?? (options.binary === true ? Buffer.alloc(0) : '')
  const status = result.status ?? -1
  const failed = result.error !== undefined || status !== 0
  appendCommandLog({
    phase: options.phase ?? 'local-observation',
    deviceRole: options.deviceRole ?? null,
    label: options.label ?? command,
    command,
    argumentCount: commandArgs.length,
    status,
    result: failed ? 'failed' : 'passed',
    timedOut: result.error?.code === 'ETIMEDOUT' || result.signal === 'SIGTERM',
    stdoutBytes: byteLength(stdout),
    stderrBytes: byteLength(stderr),
    durationMs: Date.now() - startedAt,
    stderr,
  })
  if (failed && options.allowFailure !== true) {
    const detail = sanitizeDiagnostic(`${result.error?.message ?? ''}\n${stderr || stdout}`).trim().slice(0, 4_000)
    throw new RunnerFailure(options.label ?? command, detail || `exit ${status}`)
  }
  return {status, stdout, stderr, error: result.error}
}

const textOf = result => `${result.stdout ?? ''}${result.stderr ?? ''}`.replace(/\r/g, '')
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
const writeText = (name, value) => fs.writeFileSync(path.join(currentOutputDirectory, name), `${value ?? ''}`)
const writeBinary = (name, value) => fs.writeFileSync(path.join(currentOutputDirectory, name), value)
const writeJson = (name, value) => writeText(name, `${JSON.stringify(value, null, 2)}\n`)

const deviceTag = role => role === 'master' || role === 'slave' ? role : role
const device = (role, serial, profile) => ({
  role,
  serial,
  tag: deviceTag(role),
  profile,
  displayWidth: null,
  displayHeight: null,
  secondaryDisplayId: null,
  surfaceDisplayIds: new Map(),
  remoteUiPath: `/sdcard/ter-topology-${process.pid}-${role}.xml`,
  remoteWindowsUiPath: `/sdcard/ter-topology-windows-${process.pid}-${role}.xml`,
  lastWindowsXml: '',
  lastUiXml: '',
  lastDisplayUiXml: new Map(),
  lastWindowsByDisplay: new Map(),
  uiSequence: 0,
  remoteUiCreated: false,
  lastUiActionAt: 0,
  nextUiObservationAt: 0,
  uiObserver: null,
  uiObserverDexPushed: false,
  remoteUiObserverDexPath: `/data/local/tmp/ter-no-idle-ui-${process.pid}-${profile.name}-${role}.dex`,
  uiRotation: 0,
})

const adb = (target, commandArgs, label, options = {}) => run(
  'adb',
  ['-s', target.serial, ...commandArgs],
  {...options, label, deviceRole: target.role, phase: options.phase ?? 'device-observation'},
)

const localRun = (command, commandArgs, label, options = {}) => run(
  command,
  commandArgs,
  {...options, label, phase: options.phase ?? 'local-observation'},
)

const numericVersion = value => value.split('.').map(part => Number(part) || 0)
const compareVersions = (left, right) => {
  const leftParts = numericVersion(left)
  const rightParts = numericVersion(right)
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

const highestVersionDirectory = (root, predicate) => fs.readdirSync(root, {withFileTypes: true})
  .filter(entry => entry.isDirectory() && predicate(entry.name))
  .map(entry => entry.name)
  .sort((left, right) => compareVersions(right.replace(/^[^0-9]+/, ''), left.replace(/^[^0-9]+/, '')))[0] ?? null

const buildUiObserverDex = () => {
  const androidSdkRoot = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? null
  if (androidSdkRoot === null) throw new RunnerFailure('no-idle UI observer build', 'ANDROID_HOME or ANDROID_SDK_ROOT is not set')
  const platformsRoot = path.join(androidSdkRoot, 'platforms')
  const buildToolsRoot = path.join(androidSdkRoot, 'build-tools')
  const platformName = highestVersionDirectory(platformsRoot, name => /^android-\d+$/.test(name))
  const buildToolsName = highestVersionDirectory(buildToolsRoot, name => /^\d+\.\d+\.\d+$/.test(name) && fs.existsSync(path.join(buildToolsRoot, name, 'd8')))
  if (platformName === null || buildToolsName === null) {
    throw new RunnerFailure('no-idle UI observer build', 'no stable Android platform/android build-tools with d8 was found')
  }
  const androidJar = path.join(platformsRoot, platformName, 'android.jar')
  const d8 = path.join(buildToolsRoot, buildToolsName, 'd8')
  const source = path.join(repositoryRoot, 'tools/terminal-topology/android/NoIdleUiDump.java')
  const buildRoot = path.join(outputDirectory, 'no-idle-ui-observer-build')
  const classesRoot = path.join(buildRoot, 'classes')
  const dexRoot = path.join(buildRoot, 'dex')
  fs.mkdirSync(classesRoot, {recursive: true})
  fs.mkdirSync(dexRoot, {recursive: true})
  localRun('javac', ['-source', '8', '-target', '8', '-classpath', androidJar, '-d', classesRoot, source], 'compile no-idle UI observer', {timeout: 30_000})
  localRun(d8, ['--lib', androidJar, '--output', dexRoot, path.join(classesRoot, 'NoIdleUiDump.class')], 'dex no-idle UI observer', {timeout: 30_000})
  const dexPath = path.join(dexRoot, 'classes.dex')
  if (!fs.existsSync(dexPath)) throw new RunnerFailure('no-idle UI observer build', 'd8 did not produce classes.dex')
  writeJson('no-idle-ui-observer-build.json', {
    source: path.relative(repositoryRoot, source),
    androidJar: path.relative(androidSdkRoot, androidJar),
    buildTools: buildToolsName,
    dexPath: path.relative(repositoryRoot, dexPath),
  })
  return dexPath
}

class PersistentUiObserver {
  constructor(target, dexPath) {
    this.target = target
    this.dexPath = dexPath
    this.child = null
    this.stdoutBuffer = ''
    this.stderrBuffer = ''
    this.pending = null
    this.closed = false
    this.exitCode = null
  }

  start() {
    if (this.child !== null) throw new RunnerFailure(`${this.target.tag} UI observer`, 'observer already started')
    this.child = spawn('adb', [
      '-s', this.target.serial,
      'shell',
      `CLASSPATH=${this.target.remoteUiObserverDexPath}:/system/framework/uiautomator.jar`,
      'app_process',
      '/system/bin',
      'NoIdleUiDump',
      '--server',
    ], {cwd: repositoryRoot, stdio: ['pipe', 'pipe', 'pipe']})
    this.child.stdout.on('data', chunk => this.onStdout(chunk))
    this.child.stderr.on('data', chunk => { this.stderrBuffer += chunk.toString('utf8') })
    this.child.on('error', error => this.onClosed(null, error))
    this.child.on('close', (code, signal) => this.onClosed(code, signal === null ? null : new Error(`signal ${signal}`)))
    appendCommandLog({
      phase: 'device-observation',
      deviceRole: this.target.role,
      label: 'start persistent no-idle UI observer',
      command: 'adb shell app_process NoIdleUiDump --server',
      argumentCount: 0,
      status: 0,
      result: 'started',
      stdoutBytes: 0,
      stderrBytes: 0,
      stderr: '',
    })
  }

  onStdout(chunk) {
    this.stdoutBuffer += chunk.toString('utf8')
    while (this.stdoutBuffer.includes('\n')) {
      const newlineIndex = this.stdoutBuffer.indexOf('\n')
      const line = this.stdoutBuffer.slice(0, newlineIndex).replace(/\r$/, '')
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1)
      if (line.length === 0) continue
      if (this.pending === null) continue
      const pending = this.pending
      this.pending = null
      clearTimeout(pending.timer)
      const ok = line === 'NO_IDLE_UI_DUMP_OK'
      const result = {ok, response: line, stderr: this.stderrBuffer}
      appendCommandLog({
        phase: 'device-observation',
        deviceRole: this.target.role,
        label: 'persistent no-idle UI observer request',
        command: 'NoIdleUiDump --server',
        argumentCount: 2,
        status: ok ? 0 : 1,
        result: ok ? 'passed' : 'failed',
        stdoutBytes: Buffer.byteLength(line),
        stderrBytes: Buffer.byteLength(this.stderrBuffer),
        stderr: this.stderrBuffer,
      })
      this.stderrBuffer = ''
      pending.resolve(result)
    }
  }

  onClosed(code, error) {
    if (this.closed) return
    this.closed = true
    this.exitCode = code
    const detail = error?.message ?? `exit ${code}`
    if (this.pending !== null) {
      const pending = this.pending
      this.pending = null
      clearTimeout(pending.timer)
      pending.reject(new RunnerFailure(`${this.target.tag} UI observer`, detail))
    }
  }

  dump(remotePath, rotation) {
    if (this.child === null || this.closed || this.child.stdin.destroyed) {
      return Promise.reject(new RunnerFailure(`${this.target.tag} UI observer`, 'observer is not running'))
    }
    if (this.pending !== null) {
      return Promise.reject(new RunnerFailure(`${this.target.tag} UI observer`, 'concurrent observer request'))
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = null
        reject(new RunnerFailure(`${this.target.tag} UI observer`, `request timeout after ${uiObserverRequestTimeoutMs}ms`))
      }, uiObserverRequestTimeoutMs)
      this.pending = {resolve, reject, timer}
      try {
        this.child.stdin.write(`${remotePath}\t${rotation}\n`)
      } catch (error) {
        clearTimeout(timer)
        this.pending = null
        reject(error)
      }
    })
  }

  async stop() {
    if (this.child === null || this.closed) return true
    const child = this.child
    const closed = new Promise(resolve => child.once('close', () => resolve(true)))
    child.stdin.end()
    const stopped = await Promise.race([closed, sleep(3_000).then(() => false)])
    if (!stopped && !this.closed) child.kill('SIGTERM')
    appendCommandLog({
      phase: 'cleanup',
      deviceRole: this.target.role,
      label: 'stop persistent no-idle UI observer',
      command: 'adb shell app_process NoIdleUiDump --server',
      argumentCount: 0,
      status: stopped ? 0 : 1,
      result: stopped ? 'passed' : 'failed',
      stdoutBytes: 0,
      stderrBytes: Buffer.byteLength(this.stderrBuffer),
      stderr: this.stderrBuffer,
    })
    this.closed = stopped || this.closed
    return stopped
  }
}

const installUiObserver = async (target, dexPath) => {
  adb(target, ['push', dexPath, target.remoteUiObserverDexPath], 'upload no-idle UI observer')
  target.uiObserverDexPushed = true
  target.uiObserver = new PersistentUiObserver(target, dexPath)
  target.uiObserver.start()
}

const parsePid = value => (value.trim().split(/\s+/).find(part => /^\d+$/.test(part)) ?? null)
const processIdentity = target => {
  const pidResult = adb(target, ['shell', 'pidof', target.profile.packageName], 'package PID readback', {allowFailure: true})
  const pid = parsePid(textOf(pidResult))
  if (pid === null) return {pid: null, startTicks: null}
  const statResult = adb(target, ['shell', 'cat', `/proc/${pid}/stat`], 'package process start token', {allowFailure: true})
  const stat = textOf(statResult).trim()
  const endOfComm = stat.lastIndexOf(')')
  const fieldsAfterComm = endOfComm < 0 ? [] : stat.slice(endOfComm + 2).trim().split(/\s+/)
  return {pid, startTicks: fieldsAfterComm[19] ?? null}
}

const bootId = target => textOf(adb(target, ['shell', 'cat', '/proc/sys/kernel/random/boot_id'], 'device boot identity')).trim()

const localApkBinding = profile => {
  if (!fs.existsSync(profile.apk)) return {path: path.relative(repositoryRoot, profile.apk), exists: false}
  const bytes = fs.readFileSync(profile.apk)
  return {
    path: path.relative(repositoryRoot, profile.apk),
    exists: true,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }
}

const installedApkBinding = target => {
  const pathResult = adb(target, ['shell', 'pm', 'path', target.profile.packageName], 'installed APK path', {allowFailure: true})
  const paths = [...textOf(pathResult).matchAll(/^package:(\S+)$/gm)].map(match => match[1])
  if (paths.length !== 1) throw new RunnerFailure(`${target.tag} APK binding`, `expected one base APK, observed ${paths.length}`)
  const installedPath = paths[0]
  const digestResult = adb(target, ['shell', 'sha256sum', installedPath], 'installed APK sha256', {allowFailure: true})
  const sha256 = textOf(digestResult).match(/\b([a-f0-9]{64})\b/i)?.[1]?.toLowerCase() ?? null
  const sizeResult = adb(target, ['shell', 'stat', '-c', '%s', installedPath], 'installed APK size', {allowFailure: true})
  const sizeText = textOf(sizeResult).trim().split(/\s+/).at(-1) ?? ''
  const bytes = /^\d+$/.test(sizeText) ? Number(sizeText) : null
  if (sha256 === null || bytes === null) throw new RunnerFailure(`${target.tag} APK binding`, `incomplete binding for ${installedPath}`)
  return {paths, path: installedPath, bytes, sha256}
}

const assertApkBinding = (local, installed, label) => {
  if (!local.exists) throw new RunnerFailure(label, `release APK missing: ${local.path}`)
  if (installed.bytes !== local.bytes || installed.sha256 !== local.sha256) {
    throw new RunnerFailure(label, 'installed APK does not match the recorded release APK')
  }
}

const displayFragment = (windowsXml, displayId) => {
  const opening = new RegExp(`<display id=["']${displayId}["']>`).exec(windowsXml)
  if (opening === null) return null
  const closing = windowsXml.indexOf('</display>', opening.index + opening[0].length)
  return closing < 0 ? null : windowsXml.slice(opening.index, closing + '</display>'.length)
}

const logicalDisplays = commandText => commandText
  .split('\n')
  .filter(line => /^\s*Display id \d+:/.test(line))
  .map(line => ({
    id: Number(line.match(/Display id (\d+):/)?.[1]),
    width: Number(line.match(/real (\d+) x (\d+)/)?.[1] ?? 0),
    height: Number(line.match(/real (\d+) x (\d+)/)?.[2] ?? 0),
    uniqueId: line.match(/uniqueId "([^"]+)"/)?.[1] ?? null,
    flags: [...line.matchAll(/FLAG_[A-Z_]+/g)].map(match => match[0]),
  }))

const captureDeviceShape = target => {
  const state = textOf(adb(target, ['get-state'], 'device state'))
  if (state.trim() !== 'device') throw new RunnerFailure(`${target.tag} device state`, `unexpected state ${state.trim()}`)
  const displaysResult = adb(target, ['shell', 'cmd', 'display', 'get-displays'], 'logical display inventory')
  const displayDump = adb(target, ['shell', 'dumpsys', 'display'], 'display manager inventory')
  const surfaces = adb(target, ['shell', 'dumpsys', 'SurfaceFlinger', '--displays'], 'SurfaceFlinger inventory')
  const size = textOf(adb(target, ['shell', 'wm', 'size'], 'window size'))
  const density = textOf(adb(target, ['shell', 'wm', 'density'], 'window density'))
  const displays = logicalDisplays(textOf(displaysResult))
  const surfaceText = textOf(surfaces)
  const virtualCount = (surfaceText.match(/^Virtual Display /gm) ?? []).length
  if (displays.length !== 1 || displays[0]?.id !== 0 || displays[0].width <= 0 || displays[0].height <= 0) {
    throw new RunnerFailure(`${target.tag} stage-one shape`, `expected one logical display, observed ${displays.length}`)
  }
  if (virtualCount !== 0) throw new RunnerFailure(`${target.tag} stage-one shape`, `unexpected SurfaceFlinger virtual display count ${virtualCount}`)
  target.displayWidth = displays[0].width
  target.displayHeight = displays[0].height
  writeText(`${target.tag}-shape-get-displays.txt`, textOf(displaysResult))
  writeText(`${target.tag}-shape-dumpsys-display.txt`, textOf(displayDump))
  writeText(`${target.tag}-shape-dumpsys-surfaceflinger.txt`, surfaceText)
  writeText(`${target.tag}-shape-wm-size.txt`, size)
  writeText(`${target.tag}-shape-wm-density.txt`, density)
  return {
    bootId: bootId(target),
    sdk: textOf(adb(target, ['shell', 'getprop', 'ro.build.version.sdk'], 'Android SDK readback')).trim(),
    displays,
    virtualDisplayCount: virtualCount,
    wmSize: size.trim(),
    wmDensity: density.trim(),
    preexistingProcess: processIdentity(target),
  }
}

const captureStage2Shape = (target, expectedShape) => {
  const state = textOf(adb(target, ['get-state'], 'stage-two device state'))
  if (state.trim() !== 'device') throw new RunnerFailure(`${target.tag} device state`, `unexpected state ${state.trim()}`)
  const displaysResult = adb(target, ['shell', 'cmd', 'display', 'get-displays'], 'stage-two logical display inventory')
  const displayDump = adb(target, ['shell', 'dumpsys', 'display'], 'stage-two display manager inventory')
  const surfaces = adb(target, ['shell', 'dumpsys', 'SurfaceFlinger', '--displays'], 'stage-two SurfaceFlinger inventory')
  const size = textOf(adb(target, ['shell', 'wm', 'size'], 'stage-two window size'))
  const density = textOf(adb(target, ['shell', 'wm', 'density'], 'stage-two window density'))
  const displays = logicalDisplays(textOf(displaysResult))
  const surfaceText = textOf(surfaces)
  const virtualCount = (surfaceText.match(/^Virtual Display /gm) ?? []).length
  const primarySurfaceId = surfaceText.match(/^Display (\S+)/m)?.[1] ?? null
  const secondarySurfaceId = surfaceText.match(/^Virtual Display (\S+)/m)?.[1] ?? null
  const primary = displays.find(display => display.id === 0) ?? null
  const secondary = displays.find(display => display.id !== 0) ?? null
  if (primary === null || primary.width <= 0 || primary.height <= 0) {
    throw new RunnerFailure(`${target.tag} stage-two shape`, `primary logical display is incomplete: ${displays.length} display(s)`)
  }
  if (expectedShape === 'dual' && (secondary === null || secondary.width <= 0 || secondary.height <= 0)) {
    throw new RunnerFailure(`${target.tag} stage-two dual shape`, `expected a secondary logical display, observed ${displays.length}`)
  }
  if (expectedShape === 'dual' && displays.length !== 2) {
    throw new RunnerFailure(`${target.tag} stage-two dual shape`, `expected exactly two logical displays, observed ${displays.length}`)
  }
  if (expectedShape === 'mobile' && displays.length !== 1) {
    throw new RunnerFailure(`${target.tag} stage-two mobile shape`, `expected exactly one logical display, observed ${displays.length}`)
  }
  if (primarySurfaceId === null) throw new RunnerFailure(`${target.tag} stage-two shape`, 'SurfaceFlinger primary display id is missing')
  if (expectedShape === 'dual' && secondarySurfaceId === null) throw new RunnerFailure(`${target.tag} stage-two dual shape`, 'SurfaceFlinger virtual display id is missing')
  target.displayWidth = primary.width
  target.displayHeight = primary.height
  target.secondaryDisplayId = secondary?.id ?? null
  target.surfaceDisplayIds.set(0, primarySurfaceId)
  if (secondary !== null && secondarySurfaceId !== null) target.surfaceDisplayIds.set(secondary.id, secondarySurfaceId)
  writeText(`${target.tag}-stage2-shape-get-displays.txt`, textOf(displaysResult))
  writeText(`${target.tag}-stage2-shape-dumpsys-display.txt`, textOf(displayDump))
  writeText(`${target.tag}-stage2-shape-dumpsys-surfaceflinger.txt`, surfaceText)
  writeText(`${target.tag}-stage2-shape-wm-size.txt`, size)
  writeText(`${target.tag}-stage2-shape-wm-density.txt`, density)
  return {
    expectedShape,
    bootId: bootId(target),
    sdk: textOf(adb(target, ['shell', 'getprop', 'ro.build.version.sdk'], 'stage-two Android SDK readback')).trim(),
    displays,
    surfaceDisplayIds: Object.fromEntries(target.surfaceDisplayIds),
    virtualDisplayCount: virtualCount,
    wmSize: size.trim(),
    wmDensity: density.trim(),
    preexistingProcess: processIdentity(target),
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
    enabled: !/\benabled="false"/.test(tag),
  }
}

const nodeText = node => node?.tag.match(/text="([^"]*)"/)?.[1] ?? ''

const readUi = async (target, label) => {
  target.remoteUiCreated = true
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const actionReadyAt = (target.lastUiActionAt ?? 0) + uiActionSettleDelayMs
    const observationReadyAt = Math.max(actionReadyAt, target.nextUiObservationAt ?? 0)
    const waitMs = observationReadyAt - Date.now()
    if (waitMs > 0) await sleep(waitMs)
    // The stock `uiautomator dump` form reads the current hierarchy for the
    // focused application but first waits for the whole device to become idle.
    // React surface transitions can keep that global idle condition false even
    // after the requested screen is visible. The persistent helper retains the
    // same shell-side UiAutomation boundary and reads the active root without
    // creating a new observer connection for every poll. Keep the parser
    // compatible with a window-wrapped response for images that provide one.
    // Never read a previous successful dump after a failed refresh.  `adb`
    // can itself exit successfully while the shell-side uiautomator reports
    // `could not get idle state`; without removing the target first that
    // failure would leave a stale hierarchy that looks like valid business
    // state.
    adb(target, ['shell', 'rm', '-f', target.remoteUiPath], `${label} stale UI dump removal`, {allowFailure: true})
    // The explicit action/recovery slots above remain intentional: after a
    // ReactHost transition the focused root can still be temporarily null.
    // That is a bounded observation retry, not a readiness claim.
    const dump = target.uiObserver === null
      ? {status: 1, stdout: '', stderr: 'persistent no-idle UI observer is not installed'}
      : await target.uiObserver.dump(target.remoteUiPath, target.uiRotation)
    const xmlResult = adb(target, ['exec-out', 'cat', target.remoteUiPath], `${label} UI readback`, {allowFailure: true})
    const windowsXml = textOf(xmlResult)
    const fragment = displayFragment(windowsXml, 0)
    const plainHierarchy = windowsXml.startsWith('<?xml') && windowsXml.includes('<hierarchy')
    const dumpStdout = `${dump.response ?? ''}`
    const dumpFailed = dump.ok !== true
      || /(?:^|\n)\s*(?:ERROR|Exception):/i.test(dumpStdout)
    if (!dumpFailed && plainHierarchy) {
      target.lastWindowsXml = windowsXml
      target.lastUiXml = fragment ?? windowsXml
      target.lastUiActionAt = 0
      target.nextUiObservationAt = Date.now() + uiObservationMinIntervalMs
      return target.lastUiXml
    }
    target.nextUiObservationAt = Date.now() + uiObservationRecoveryDelayMs
  }
  throw new RunnerFailure(`${target.tag} ${label} UI`, 'UI dump/readback did not return display 0 XML')
}

// Stage two needs the whole multi-display window tree. The persistent helper
// intentionally remains a display-0 observer; using the stock --windows dump
// here is the Android-supported way to select a Presentation display and keeps
// display 2 evidence tied to the real device rather than a test abstraction.
const readStage2Ui = async (target, displayId, label) => {
  target.remoteUiCreated = true
  target.stage2UiCreated = true
  for (let attempt = 0; attempt < 5; attempt += 1) {
    adb(target, ['shell', 'rm', '-f', target.remoteWindowsUiPath], `${label} stale windows dump removal`, {allowFailure: true})
    const dump = adb(target, ['shell', 'uiautomator', 'dump', '--windows', target.remoteWindowsUiPath], `${label} windows UI dump`, {allowFailure: true})
    const xmlResult = adb(target, ['exec-out', 'cat', target.remoteWindowsUiPath], `${label} windows UI readback`, {allowFailure: true})
    const windowsXml = textOf(xmlResult)
    const fragment = displayFragment(windowsXml, displayId)
    const plainHierarchy = displayId === 0 && windowsXml.startsWith('<?xml') && windowsXml.includes('<hierarchy')
    const xml = fragment ?? (plainHierarchy ? windowsXml : null)
    if (dump.status === 0 && windowsXml.startsWith('<?xml') && xml !== null && xml.includes('<hierarchy')) {
      target.lastWindowsByDisplay.set(displayId, windowsXml)
      target.lastDisplayUiXml.set(displayId, xml)
      target.lastUiActionAt = 0
      return xml
    }
    await sleep(500)
  }
  throw new RunnerFailure(`${target.tag} ${label} display ${displayId} UI`, 'windows UI dump/readback did not return a fresh hierarchy')
}

const saveStage2Ui = (target, displayId, label, xml) => {
  const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '-')
  writeText(`${target.tag}-display-${displayId}-${String(target.uiSequence++).padStart(3, '0')}-${safeLabel}.xml`, sanitizeDiagnostic(xml))
  writeText(`${target.tag}-display-${displayId}-${safeLabel}-uiautomator-windows.xml`, sanitizeDiagnostic(target.lastWindowsByDisplay.get(displayId) ?? ''))
}

const waitForStage2Node = async (target, displayId, resourceId, predicate = () => true, timeoutMs = 20_000) => {
  const deadline = Date.now() + timeoutMs
  let lastXml = ''
  let lastObservationError = null
  while (Date.now() < deadline) {
    try {
      lastXml = await readStage2Ui(target, displayId, `wait ${resourceId}`)
      lastObservationError = null
    } catch (error) {
      lastObservationError = error
      await sleep(700)
      continue
    }
    const node = nodeForId(lastXml, resourceId)
    if (node !== null && predicate(node, lastXml)) return {xml: lastXml, node}
    await sleep(400)
  }
  saveStage2Ui(target, displayId, `wait-failed-${resourceId}`, lastXml)
  if (lastObservationError !== null && lastXml.length === 0) throw lastObservationError
  throw new RunnerFailure(`${target.tag} wait display ${displayId} ${resourceId}`, 'expected UI state was not reached')
}

const waitForStage2Absent = async (target, displayId, resourceId, timeoutMs = 20_000) => {
  const deadline = Date.now() + timeoutMs
  let lastXml = ''
  while (Date.now() < deadline) {
    lastXml = await readStage2Ui(target, displayId, `wait absent ${resourceId}`)
    if (nodeForId(lastXml, resourceId) === null) return lastXml
    await sleep(400)
  }
  saveStage2Ui(target, displayId, `absent-failed-${resourceId}`, lastXml)
  throw new RunnerFailure(`${target.tag} wait absent display ${displayId} ${resourceId}`, 'UI resource did not disappear')
}

const scrollStage2NodeIntoView = async (target, displayId, resourceId, timeoutMs = 20_000) => {
  const deadline = Date.now() + timeoutMs
  let lastXml = ''
  while (Date.now() < deadline) {
    lastXml = await readStage2Ui(target, displayId, `scroll ${resourceId}`)
    const node = nodeForId(lastXml, resourceId)
    const scroll = nodeForId(lastXml, 'terminal.admin:topology:scroll')
    if (node !== null && scroll !== null) {
      // The Android accessibility bounds already describe the visible
      // ScrollView viewport.  Do not add an artificial inset here: the last
      // reason card is intentionally allowed to end at the viewport edge and
      // remains fully visible above the app's bottom safe-area padding.
      const viewportBottom = scroll.bottom
      const viewportTop = scroll.top
      if (node.top >= viewportTop && node.bottom <= viewportBottom) return {xml: lastXml, node}
      const x = Math.floor((scroll.left + scroll.right) / 2)
      const startY = Math.max(viewportTop + 80, Math.min(viewportBottom - 24, node.bottom > viewportBottom ? viewportBottom - 24 : viewportTop + 260))
      const endY = node.bottom > viewportBottom
        ? Math.max(viewportTop + 40, startY - Math.max(320, node.bottom - viewportBottom + 220))
        : Math.min(viewportBottom - 40, startY + Math.max(320, viewportTop - node.top + 220))
      if (startY !== endY) {
        const displayArgs = displayId === 0 ? [] : ['-d', String(displayId)]
        adb(target, ['shell', 'input', ...displayArgs, 'swipe', String(x), String(Math.floor(startY)), String(x), String(Math.floor(endY)), '350'], `scroll display ${displayId} ${resourceId} into view`)
        target.lastUiActionAt = Date.now()
      }
    } else {
      const displayArgs = displayId === 0 ? [] : ['-d', String(displayId)]
      const x = Math.floor((target.displayWidth ?? 360) / 2)
      const startY = Math.floor((target.displayHeight ?? 640) * 0.78)
      const endY = Math.floor((target.displayHeight ?? 640) * 0.22)
      adb(target, ['shell', 'input', ...displayArgs, 'swipe', String(x), String(startY), String(x), String(endY), '350'], `scroll display ${displayId} ${resourceId} into view without container`)
      target.lastUiActionAt = Date.now()
    }
    await sleep(700)
  }
  saveStage2Ui(target, displayId, `scroll-failed-${resourceId}`, lastXml)
  throw new RunnerFailure(`${target.tag} scroll display ${displayId} ${resourceId}`, 'resource did not become visible in the scroll viewport')
}

const tapStage2Node = async (target, displayId, resourceId, options = {}) => {
  const observed = options.scrollIntoView === true
    ? await scrollStage2NodeIntoView(target, displayId, resourceId)
    : await waitForStage2Node(target, displayId, resourceId, current => current.right > current.left && current.bottom > current.top)
  if (options.requireEnabled !== false && !observed.node.enabled) throw new RunnerFailure(`${target.tag} tap display ${displayId} ${resourceId}`, 'control is disabled')
  const x = Math.floor((observed.node.left + observed.node.right) / 2)
  const y = Math.floor((observed.node.top + observed.node.bottom) / 2)
  const displayArgs = displayId === 0 ? [] : ['-d', String(displayId)]
  adb(target, ['shell', 'input', ...displayArgs, 'tap', String(x), String(y)], `tap display ${displayId} ${resourceId}`)
  target.lastUiActionAt = Date.now()
  return {node: observed.node, x, y}
}

const observeStage2 = async (record, target, displayId, label, expectedIds = [], expectedTexts = []) => {
  const xml = await readStage2Ui(target, displayId, label)
  const missing = expectedIds.filter(resourceId => nodeForId(xml, resourceId) === null)
  if (missing.length > 0) throw new RunnerFailure(`${target.tag} ${label}`, `missing UI nodes: ${missing.join(', ')}`)
  const missingTexts = expectedTexts.filter(value => !xml.includes(value))
  if (missingTexts.length > 0) throw new RunnerFailure(`${target.tag} ${label}`, `missing business state text: ${missingTexts.join(', ')}`)
  const diagnosticTexts = expectedTexts.map(sanitizeDiagnostic)
  saveStage2Ui(target, displayId, label, xml)
  record.steps.push({
    label,
    deviceRole: target.role,
    displayId,
    timestamp: new Date().toISOString(),
    expectedIds,
    expectedTexts: diagnosticTexts,
    observedIds: [...xml.matchAll(/resource-id="([^"]+)"/g)].map(match => match[1]),
    observedText: diagnosticTexts,
  })
  return xml
}

const saveUi = (target, label, xml) => {
  const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '-')
  writeText(`${target.tag}-${String(target.uiSequence++).padStart(3, '0')}-${safeLabel}.xml`, sanitizeDiagnostic(xml))
  writeText(`${target.tag}-${safeLabel}-uiautomator-windows.xml`, sanitizeDiagnostic(target.lastWindowsXml))
}

const waitForNode = async (target, resourceId, predicate = () => true, timeoutMs = 20_000) => {
  const deadline = Date.now() + timeoutMs
  let lastXml = ''
  let lastObservationError = null
  while (Date.now() < deadline) {
    try {
      lastXml = await readUi(target, `wait ${resourceId}`)
      lastObservationError = null
    } catch (error) {
      lastObservationError = error
      if (Date.now() >= deadline) break
      await sleep(Math.min(uiObservationRecoveryDelayMs, Math.max(250, deadline - Date.now())))
      continue
    }
    const node = nodeForId(lastXml, resourceId)
    if (node !== null && predicate(node, lastXml)) return {xml: lastXml, node}
    await sleep(300)
  }
  saveUi(target, `wait-failed-${resourceId}`, lastXml)
  if (lastObservationError !== null && lastXml.length === 0) throw lastObservationError
  throw new RunnerFailure(`${target.tag} wait ${resourceId}`, 'expected UI state was not reached')
}

const waitForAbsent = async (target, resourceId, timeoutMs = 20_000) => {
  const deadline = Date.now() + timeoutMs
  let lastXml = ''
  let lastObservationError = null
  while (Date.now() < deadline) {
    try {
      lastXml = await readUi(target, `wait absent ${resourceId}`)
      lastObservationError = null
    } catch (error) {
      lastObservationError = error
      if (Date.now() >= deadline) break
      await sleep(Math.min(uiObservationRecoveryDelayMs, Math.max(250, deadline - Date.now())))
      continue
    }
    if (nodeForId(lastXml, resourceId) === null) return lastXml
    await sleep(300)
  }
  saveUi(target, `absent-failed-${resourceId}`, lastXml)
  if (lastObservationError !== null && lastXml.length === 0) throw lastObservationError
  throw new RunnerFailure(`${target.tag} wait absent ${resourceId}`, 'UI resource did not disappear')
}

const waitForPairRuntimeReset = async target => waitForNode(
  target,
  'terminal.admin:launcher',
  (_node, xml) => nodeForId(xml, 'terminal.admin:shell') === null
    && nodeForId(xml, 'terminal.admin:login') === null,
)

const scrollNodeIntoView = async (target, resourceId) => {
  const observed = await waitForNode(target, resourceId, current => current.right > current.left && current.bottom > current.top)
  const viewportBottom = (target.displayHeight ?? observed.node.bottom) - 96
  if (observed.node.bottom <= viewportBottom) return observed

  // The topology form is a real scroll surface.  A control at the lower edge
  // can have a clickable UiAutomator node while its center falls below the
  // RN viewport/system inset, so a raw center tap is not a delivered gesture.
  // Scroll using the observed control's x coordinate, then re-read the node;
  // do not reuse its pre-scroll bounds.
  const x = Math.floor((observed.node.left + observed.node.right) / 2)
  const startY = Math.max(220, Math.min(observed.node.top - 48, viewportBottom - 24))
  const endY = Math.max(180, startY - Math.max(480, observed.node.bottom - viewportBottom + 320))
  if (endY >= startY) throw new RunnerFailure(`${target.tag} scroll ${resourceId}`, 'control could not be moved into the viewport')
  adb(target, ['shell', 'input', 'swipe', String(x), String(startY), String(x), String(endY), '350'], `scroll ${resourceId} into view`)
  target.lastUiActionAt = Date.now()
  target.nextUiObservationAt = Math.max(target.nextUiObservationAt ?? 0, target.lastUiActionAt + uiActionSettleDelayMs)
  return waitForNode(target, resourceId, current => current.right > current.left && current.bottom > current.top && current.bottom <= viewportBottom)
}

const tapNode = async (target, resourceId, options = {}) => {
  const observed = options.scrollIntoView === true
    ? await scrollNodeIntoView(target, resourceId)
    : await waitForNode(target, resourceId, current => current.right > current.left && current.bottom > current.top)
  const node = observed.node
  if (options.requireEnabled !== false && !node.enabled) throw new RunnerFailure(`${target.tag} tap ${resourceId}`, 'control is disabled')
  const x = Math.floor((node.left + node.right) / 2)
  const y = Math.floor((node.top + node.bottom) / 2)
  adb(target, ['shell', 'input', 'tap', String(x), String(y)], `tap ${resourceId}`)
  target.lastUiActionAt = Date.now()
  target.nextUiObservationAt = Math.max(target.nextUiObservationAt ?? 0, target.lastUiActionAt + uiActionSettleDelayMs)
  return {node, x, y}
}

const resourceRegion = (xml, resourceId) => {
  const marker = `resource-id="${resourceId}"`
  const start = xml.indexOf(marker)
  return start < 0 ? '' : xml.slice(start, start + 4_096)
}

const observe = async (record, target, label, expectedIds = [], expectedTexts = []) => {
  const xml = await readUi(target, label)
  const missing = expectedIds.filter(resourceId => nodeForId(xml, resourceId) === null)
  if (missing.length > 0) throw new RunnerFailure(`${target.tag} ${label}`, `missing UI nodes: ${missing.join(', ')}`)
  const missingTexts = expectedTexts.filter(value => !xml.includes(value))
  if (missingTexts.length > 0) throw new RunnerFailure(`${target.tag} ${label}`, `missing business state text: ${missingTexts.join(', ')}`)
  const diagnosticTexts = expectedTexts.map(sanitizeDiagnostic)
  saveUi(target, label, xml)
  const step = {
    label,
    deviceRole: target.role,
    timestamp: new Date().toISOString(),
    expectedIds,
    expectedTexts: diagnosticTexts,
    observedIds: [...xml.matchAll(/resource-id="([^"]+)"/g)].map(match => match[1]),
    observedText: diagnosticTexts,
  }
  record.steps.push(step)
  return xml
}

const captureStage2Screenshot = (target, displayId, label) => {
  const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '-')
  const surfaceDisplayId = target.surfaceDisplayIds.get(displayId)
  if (surfaceDisplayId === undefined) throw new RunnerFailure(`${target.tag} display ${displayId} ${label} screenshot`, 'SurfaceFlinger display id mapping is missing')
  const screenshot = adb(target, ['exec-out', 'screencap', '-p', '-d', surfaceDisplayId], `${label} screenshot`, {allowFailure: true, binary: true})
  if (screenshot.status !== 0 || !Buffer.isBuffer(screenshot.stdout) || screenshot.stdout.length === 0) {
    throw new RunnerFailure(`${target.tag} display ${displayId} ${label} screenshot`, 'screenshot is empty')
  }
  const screenshotPath = path.join(currentOutputDirectory, `${target.tag}-display-${displayId}-${safeLabel}.png`)
  writeBinary(`${target.tag}-display-${displayId}-${safeLabel}.png`, screenshot.stdout)
  const fileResult = localRun('file', [screenshotPath], `${label} screenshot metadata`, {allowFailure: true})
  const fileText = textOf(fileResult)
  writeText(`${target.tag}-display-${displayId}-${safeLabel}.file.txt`, fileText)
  const dimensions = fileText.match(/(\d+) x (\d+)/)
  if (!/PNG image data/.test(fileText) || dimensions === null) {
    throw new RunnerFailure(`${target.tag} display ${displayId} ${label} screenshot`, `invalid PNG metadata: ${fileText}`)
  }
  return {path: path.relative(repositoryRoot, screenshotPath), width: Number(dimensions[1]), height: Number(dimensions[2]), fileText}
}

const captureStage1Screenshot = (target, label) => {
  const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '-')
  const screenshot = adb(target, ['exec-out', 'screencap', '-p'], `${label} screenshot`, {allowFailure: true, binary: true})
  if (screenshot.status !== 0 || !Buffer.isBuffer(screenshot.stdout) || screenshot.stdout.length === 0) {
    throw new RunnerFailure(`${target.tag} display 0 ${label} screenshot`, 'screenshot is empty')
  }
  const screenshotPath = path.join(currentOutputDirectory, `${target.tag}-display-0-${safeLabel}.png`)
  writeBinary(`${target.tag}-display-0-${safeLabel}.png`, screenshot.stdout)
  const fileResult = localRun('file', [screenshotPath], `${label} screenshot metadata`, {allowFailure: true})
  const fileText = textOf(fileResult)
  writeText(`${target.tag}-display-0-${safeLabel}.file.txt`, fileText)
  const dimensions = fileText.match(/(\d+) x (\d+)/)
  if (!/PNG image data/.test(fileText) || dimensions === null) {
    throw new RunnerFailure(`${target.tag} display 0 ${label} screenshot`, `invalid PNG metadata: ${fileText}`)
  }
  return {path: path.relative(repositoryRoot, screenshotPath), width: Number(dimensions[1]), height: Number(dimensions[2]), fileText}
}

const progress = (record, label, details = {}) => {
  record.lastKnownGood = label
  record.timeline.push({label, timestamp: new Date().toISOString(), ...details})
  writeJson('progress.json', record)
}

const stage2OpenAdmin = async (record, target) => {
  let current = await readStage2Ui(target, 0, 'stage2 open admin preflight')
  if (nodeForId(current, 'terminal.admin:shell') !== null) return
  if (nodeForId(current, 'terminal.admin:login') === null) {
    const launcher = await waitForStage2Node(target, 0, 'terminal.admin:launcher')
    const x = launcher.node.left + 48
    const y = launcher.node.top + 48
    const started = Date.now()
    for (let index = 0; index < 5; index += 1) {
      adb(target, ['shell', 'input', 'tap', String(x), String(y)], `stage2 admin launcher tap ${index + 1}`)
      await sleep(110)
    }
    if (Date.now() - started >= 1_800) throw new RunnerFailure(`${target.tag} stage2 admin launcher`, 'five-tap gesture exceeded its time window')
    current = (await waitForStage2Node(target, 0, 'terminal.admin:login')).xml
  }
  const password = current.match(/请输入(?:六位)?动态口令（(\d{6})）/)?.[1] ?? null
  if (password === null) throw new RunnerFailure(`${target.tag} stage2 admin login`, 'debug password display was not available')
  for (const digit of password) await tapStage2Node(target, 0, `ui.base.input:virtual-keyboard:text-${digit}`)
  await waitForStage2Node(target, 0, 'terminal.admin:verify', currentNode => currentNode.enabled)
  await tapStage2Node(target, 0, 'terminal.admin:verify')
  await waitForStage2Node(target, 0, 'terminal.admin:shell')
  record.timeline.push({label: 'stage2-admin-authenticated', deviceRole: target.role, timestamp: new Date().toISOString(), debugPasswordObserved: true})
}

const stage2CloseAdmin = async target => {
  const current = await readStage2Ui(target, 0, 'stage2 close admin preflight')
  if (nodeForId(current, 'terminal.admin:close') === null) {
    if (nodeForId(current, 'terminal.admin:shell') === null) return
    throw new RunnerFailure(`${target.tag} stage2 close admin`, 'admin shell is present but close control is not observable')
  }
  await tapStage2Node(target, 0, 'terminal.admin:close')
  await waitForStage2Absent(target, 0, 'terminal.admin:shell')
}

const stage2OpenTopology = async (record, target) => {
  const current = await readStage2Ui(target, 0, 'stage2 topology preflight')
  if (nodeForId(current, 'terminal.admin:topology:form') !== null) return
  await tapStage2Node(target, 0, 'terminal.admin:section:topology')
  await waitForStage2Node(target, 0, 'terminal.admin:topology:form')
  await observeStage2(record, target, 0, 'stage2-topology-open', [
    'terminal.admin:topology:form',
    'terminal.admin:topology:paired',
    'terminal.admin:topology:reachable',
    'terminal.admin:topology:host-status',
  ])
}

const stage2TapVirtualText = async (target, displayId, value) => {
  const normalized = value.toLowerCase()
  if (value !== normalized) await tapStage2Node(target, displayId, 'ui.base.input:virtual-keyboard:shift')
  for (const character of normalized) await tapStage2Node(target, displayId, `ui.base.input:virtual-keyboard:text-${character}`)
}

const stage2FillStaffLogin = async target => {
  await waitForStage2Node(target, 0, 'sample.auth.login')
  await tapStage2Node(target, 0, 'sample.auth.login:operator-name')
  await stage2TapVirtualText(target, 0, 'A001')
  await tapStage2Node(target, 0, 'ui.base.input:virtual-keyboard:complete')
  await tapStage2Node(target, 0, 'sample.auth.login:passcode')
  await stage2TapVirtualText(target, 0, '1111')
  await tapStage2Node(target, 0, 'ui.base.input:virtual-keyboard:complete')
  await tapStage2Node(target, 0, 'sample.auth.login:submit')
  await waitForStage2Node(target, 0, 'sample.desk.member-list')
}

const stage2ColdLaunch = async target => {
  adb(target, ['shell', 'am', 'force-stop', target.profile.packageName], 'stage2 pre-run force-stop')
  adb(target, ['shell', 'pm', 'clear', target.profile.packageName], 'stage2 clear package state')
  adb(target, ['shell', 'am', 'start', '-W', '-n', target.profile.activity], 'stage2 cold launch release app')
  await waitForStage2Node(target, 0, 'terminal.admin:launcher')
  const process = processIdentity(target)
  if (process.pid === null || process.startTicks === null) throw new RunnerFailure(`${target.tag} stage2 process identity`, 'release app PID/start token was not readable')
  return process
}

const stage2RestartAndCheckChief = async (record, target) => {
  adb(target, ['shell', 'am', 'force-stop', target.profile.packageName], 'stage2 dual-screen restart force-stop')
  adb(target, ['shell', 'am', 'start', '-W', '-n', target.profile.activity], 'stage2 dual-screen restart launch')
  await waitForStage2Node(target, 0, 'terminal.admin:launcher')
  await stage2OpenAdmin(record, target)
  await tapStage2Node(target, 0, 'terminal.admin:section:display-context')
  await observeStage2(record, target, 0, 'dual-screen-hydrate-chief', [
    'admin.console.display-context:role',
    'admin.console.display-context:instance',
  ], ['CHIEF', 'MASTER'])
  captureStage2Screenshot(target, 0, 'dual-screen-hydrate-chief')
  progress(record, 'dual-screen-restart-restores-chief-master', {deviceRole: target.role, displayCount: 2, process: processIdentity(target)})
  await stage2CloseAdmin(target)
}

const stage2RunMemberJourney = async (record, target) => {
  const secondaryDisplayId = target.secondaryDisplayId
  if (secondaryDisplayId === null) throw new RunnerFailure(`${target.tag} stage2 member journey`, 'secondary display id is unavailable')
  await stage2CloseAdmin(target)
  await stage2FillStaffLogin(target)
  await observeStage2(record, target, 0, 'local-dual-member-list-before-registration', ['sample.desk.member-list'], ['已登记会员'])
  captureStage2Screenshot(target, 0, 'local-dual-member-list-before-registration')
  const masterList = await readStage2Ui(target, 0, 'stage2 find member add control')
  const addId = nodeForId(masterList, 'sample.desk.member-list:empty-action') === null
    ? 'sample.desk.member-list:add'
    : 'sample.desk.member-list:empty-action'
  await tapStage2Node(target, 0, addId)
  await waitForStage2Node(target, 0, 'sample.desk.member-form')
  await tapStage2Node(target, 0, 'sample.desk.member-form:name')
  await stage2TapVirtualText(target, 0, 'ALICE')
  await waitForStage2Node(target, 0, 'sample.desk.member-form:name', node => nodeText(node).includes('Alice'))
  await tapStage2Node(target, 0, 'ui.base.input:virtual-keyboard:complete')
  await tapStage2Node(target, 0, 'sample.desk.member-form:phone')
  await stage2TapVirtualText(target, 0, '01012345678')
  await waitForStage2Node(target, 0, 'sample.desk.member-form:phone', node => nodeText(node).includes('01012345678'))
  await tapStage2Node(target, 0, 'ui.base.input:virtual-keyboard:complete')
  await tapStage2Node(target, 0, 'sample.desk.member-form:submit')
  await waitForStage2Node(target, 0, 'sample.desk.waiting-confirm')
  await observeStage2(record, target, 0, 'local-dual-member-waiting-on-primary', ['sample.desk.member-list', 'sample.desk.waiting-confirm'], ['已提交，等待顾客确认', 'Alice', '01012345678'])
  captureStage2Screenshot(target, 0, 'local-dual-member-waiting-on-primary')
  await waitForStage2Node(target, secondaryDisplayId, 'sample.desk.customer-member')
  await observeStage2(record, target, secondaryDisplayId, 'local-dual-member-confirmation-on-secondary', ['sample.desk.customer-member'], ['请确认登记', 'Alice', '01012345678'])
  captureStage2Screenshot(target, secondaryDisplayId, 'local-dual-member-confirmation-on-secondary')
  progress(record, 'local-dual-member-pending-state', {primaryPartKey: 'sample.desk.waiting-confirm', secondaryPartKey: 'sample.desk.customer-member', secondaryDisplayId})

  await tapStage2Node(target, secondaryDisplayId, 'sample.desk.customer-member:age')
  await tapStage2Node(target, secondaryDisplayId, 'ui.base.input:virtual-keyboard:text-3')
  await tapStage2Node(target, secondaryDisplayId, 'ui.base.input:virtual-keyboard:text-7')
  await tapStage2Node(target, secondaryDisplayId, 'ui.base.input:virtual-keyboard:complete')
  await tapStage2Node(target, secondaryDisplayId, 'sample.desk.customer-member:confirm')
  await waitForStage2Node(target, 0, 'sample.desk.member-list:row')
  await observeStage2(record, target, 0, 'local-dual-member-confirmed-on-primary', ['sample.desk.member-list', 'sample.desk.member-list:row'], ['已登记会员', 'Alice', '01012345678'])
  captureStage2Screenshot(target, 0, 'local-dual-member-confirmed-on-primary')
  await waitForStage2Node(target, secondaryDisplayId, 'sample.desk.customer-welcome')
  await observeStage2(record, target, secondaryDisplayId, 'local-dual-member-welcome-on-secondary', ['sample.desk.customer-welcome'], ['欢迎，请等待店员操作'])
  captureStage2Screenshot(target, secondaryDisplayId, 'local-dual-member-welcome-on-secondary')
  progress(record, 'local-dual-member-confirmed-state', {primaryPartKey: 'sample.desk.member-list', secondaryPartKey: 'sample.desk.customer-welcome', secondaryDisplayId})

  adb(target, ['shell', 'am', 'force-stop', target.profile.packageName], 'stage2 authenticated cold restart force-stop')
  adb(target, ['shell', 'am', 'start', '-W', '-n', target.profile.activity], 'stage2 authenticated cold restart')
  await waitForStage2Node(target, 0, 'sample.desk.member-list:row')
  await observeStage2(record, target, 0, 'local-dual-authenticated-state-after-cold-restart-primary', ['sample.desk.member-list', 'sample.desk.member-list:row'], ['Alice', '01012345678'])
  await waitForStage2Node(target, secondaryDisplayId, 'sample.desk.customer-welcome')
  await observeStage2(record, target, secondaryDisplayId, 'local-dual-authenticated-state-after-cold-restart-secondary', ['sample.desk.customer-welcome'], ['欢迎，请等待店员操作'])
  captureStage2Screenshot(target, 0, 'local-dual-authenticated-state-after-cold-restart-primary')
  captureStage2Screenshot(target, secondaryDisplayId, 'local-dual-authenticated-state-after-cold-restart-secondary')
  progress(record, 'local-dual-authenticated-state-restored-after-cold-restart', {primaryPartKey: 'sample.desk.member-list', secondaryPartKey: 'sample.desk.customer-welcome', process: processIdentity(target)})
}

const stage1MemberLabels = [
  'member-list-before-registration',
  'member-waiting-on-master',
  'member-confirmation-on-slave',
  'member-confirmed-on-master',
  'member-welcome-on-slave',
  'authenticated-state-after-cold-restart',
]

const loadLatestStage1MemberReference = () => {
  const root = path.join(repositoryRoot, '.runtime/ter-dual-machine-topology/2026-09-17/cp5')
  if (!fs.existsSync(root)) return null
  const candidates = fs.readdirSync(root, {withFileTypes: true})
    .filter(entry => entry.isDirectory() && entry.name.startsWith('stage1-'))
    .map(entry => path.join(root, entry.name))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)
  for (const candidate of candidates) {
    const resultPath = path.join(candidate, 'sample-terminal', 'result.json')
    if (!fs.existsSync(resultPath)) continue
    try {
      const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'))
      const labels = result.steps.filter(step => stage1MemberLabels.includes(step.label)).map(step => step.label)
      if (result.business !== 'PASS' || result.cleanup !== 'PASS' || labels.length !== stage1MemberLabels.length) continue
      return {path: path.relative(repositoryRoot, resultPath), labels}
    } catch {
      continue
    }
  }
  return null
}

const compareStage2MemberJourney = (record) => {
  const reference = loadLatestStage1MemberReference()
  const observed = record.steps.filter(step => step.label.startsWith('local-dual-')).map(step => step.label)
  const required = [
    'local-dual-member-list-before-registration',
    'local-dual-member-waiting-on-primary',
    'local-dual-member-confirmation-on-secondary',
    'local-dual-member-confirmed-on-primary',
    'local-dual-member-welcome-on-secondary',
    'local-dual-authenticated-state-after-cold-restart-primary',
    'local-dual-authenticated-state-after-cold-restart-secondary',
  ]
  const missing = required.filter(label => !observed.includes(label))
  const result = reference !== null && reference.labels.length === stage1MemberLabels.length && missing.length === 0 ? 'MATCHED' : 'OPEN'
  const comparison = {
    result,
    reference,
    stage1Labels: stage1MemberLabels,
    stage2Labels: observed,
    requiredStage2Labels: required,
    missing,
    note: '逐步对照比较业务 partKey/state 的设备观察；不是截图差分或结构 mock。',
  }
  writeJson('stage2-member-stepwise-comparison.json', comparison)
  if (result !== 'MATCHED') throw new RunnerFailure('stage2 member stepwise comparison', `stage1 reference or required local dual steps are incomplete: missing=${missing.join(',') || 'none'}`)
  return comparison
}

const stage2RunMobileTopology = async (record, target) => {
  await stage2OpenAdmin(record, target)
  await stage2OpenTopology(record, target)
  const xml = await observeStage2(record, target, 0, 'mobile-topology-tab-visible', [
    'terminal.admin:topology:form',
    'terminal.admin:topology:title',
    'terminal.admin:topology:query',
  ])
  const controls = ['terminal.admin:topology:query', 'terminal.admin:topology:pair', 'terminal.admin:topology:unpair', 'terminal.admin:topology:enable']
  const disabled = []
  for (const id of controls) {
    await scrollStage2NodeIntoView(target, 0, id)
    const controlXml = await readStage2Ui(target, 0, `mobile control ${id}`)
    const node = nodeForId(controlXml, id)
    disabled.push({id, enabled: node?.enabled ?? null})
    if (node?.enabled !== false) throw new RunnerFailure('mobile topology eligibility', `operation ${id} is not disabled in the real UI`)
  }
  if (disabled.some(item => item.enabled !== false)) throw new RunnerFailure('mobile topology eligibility', `an unsupported topology operation is enabled: ${JSON.stringify(disabled)}`)
  const reasonIds = ['terminal.admin:topology:reason', 'terminal.admin:topology:query-reason', 'terminal.admin:topology:pair-reason']
  for (const id of reasonIds) {
    await scrollStage2NodeIntoView(target, 0, id)
    const reasonXml = await readStage2Ui(target, 0, `mobile reason ${id}`)
    if (!reasonXml.includes('当前机型不支持双机拓扑')) throw new RunnerFailure('mobile topology reason', `${id} did not expose a readable unsupported-form reason`)
    await observeStage2(record, target, 0, `mobile-topology-${id}-readable-reason`, [id], ['当前机型不支持双机拓扑'])
  }
  captureStage2Screenshot(target, 0, 'mobile-topology-tab-visible-disabled')
  progress(record, 'mobile-topology-tab-visible-disabled-with-readable-reason', {deviceRole: target.role, disabled})
  await stage2CloseAdmin(target)
}

const openAdmin = async (record, target) => {
  let current = await readUi(target, 'open admin preflight')
  if (nodeForId(current, 'terminal.admin:shell') !== null) return
  if (nodeForId(current, 'terminal.admin:login') === null) {
    const launcher = await waitForNode(target, 'terminal.admin:launcher')
    // AdminLauncher intentionally accepts only the top-left 96x96 logical
    // gesture area.  A full-screen center tap is outside that contract even
    // though the launcher View itself spans the whole surface.
    const x = launcher.node.left + 48
    const y = launcher.node.top + 48
    const started = Date.now()
    for (let index = 0; index < 5; index += 1) {
      adb(target, ['shell', 'input', 'tap', String(x), String(y)], `admin launcher tap ${index + 1}`)
      await sleep(110)
    }
    if (Date.now() - started >= 1_800) throw new RunnerFailure(`${target.tag} admin launcher`, 'five-tap gesture exceeded its time window')
    current = (await waitForNode(target, 'terminal.admin:login')).xml
  }
  // Android accessibility may flatten the nested debug-password Text node
  // into the instruction node, so the release observation is keyed by the
  // visible six-digit instruction rather than by the nested resource-id.
  const password = current.match(/请输入(?:六位)?动态口令（(\d{6})）/)?.[1] ?? null
  if (password === null) throw new RunnerFailure(`${target.tag} admin login`, 'debug password display was not available in the release app')
  for (const digit of password) {
    await tapNode(target, `ui.base.input:virtual-keyboard:text-${digit}`)
  }
  await waitForNode(target, 'terminal.admin:verify', current => current.enabled)
  await tapNode(target, 'terminal.admin:verify')
  await waitForNode(target, 'terminal.admin:shell')
  record.timeline.push({label: 'admin-authenticated', deviceRole: target.role, timestamp: new Date().toISOString(), debugPasswordObserved: true})
}

const closeAdmin = async target => {
  await tapNode(target, 'terminal.admin:close')
  await waitForAbsent(target, 'terminal.admin:shell')
}

const openTopology = async (record, target) => {
  const current = await readUi(target, 'topology preflight')
  if (nodeForId(current, 'terminal.admin:topology:form') !== null) return
  await tapNode(target, 'terminal.admin:section:topology')
  await waitForNode(target, 'terminal.admin:topology:form')
  await observe(record, target, 'topology-open', [
    'terminal.admin:topology:form',
    'terminal.admin:topology:paired',
    'terminal.admin:topology:reachable',
    'terminal.admin:topology:host-status',
  ])
}

const assertTopologyValue = async (record, target, label, id, text) => {
  await waitForNode(target, id, (_node, xml) => resourceRegion(xml, id).includes(text))
  await observe(record, target, label, [id], [text])
}

const endpointRequest = (method, pathName, body = undefined) => new Promise((resolve, reject) => {
  let settled = false
  const finishResolve = value => {
    if (settled) return
    settled = true
    resolve(value)
  }
  const finishReject = error => {
    if (settled) return
    settled = true
    reject(error)
  }
  const request = http.request({
    host: '127.0.0.1',
    port: hostBridgePort,
    path: `${topologyBasePath}${pathName}`,
    method,
    ...(body === undefined ? {} : {headers: {'content-length': Buffer.byteLength(body)}}),
  }, response => {
    const chunks = []
    response.on('data', chunk => chunks.push(Buffer.from(chunk)))
    response.on('end', () => {
      const responseText = Buffer.concat(chunks).toString('utf8')
      request.destroy()
      finishResolve({status: response.statusCode ?? 0, bodyBytes: Buffer.byteLength(responseText), body: responseText})
    })
    response.on('error', finishReject)
  })
  request.setTimeout(4_000, () => finishReject(new Error('topology endpoint request timeout')))
  request.on('error', finishReject)
  if (body !== undefined) request.write(body)
  request.end()
})

const ensureForward = (master, record) => {
  const forwards = textOf(localRun('adb', ['forward', '--list'], 'ADB forward inventory', {allowFailure: true}))
  if (new RegExp(`\\btcp:${hostBridgePort}\\b`).test(forwards)) {
    throw new RunnerFailure('ADB topology forward preflight', `host bridge port ${hostBridgePort} already has a pre-existing forward`)
  }
  adb(master, ['forward', `tcp:${hostBridgePort}`, `tcp:${topologyPort}`], 'create owned topology forward')
  record.resources.forwardOwned = true
  record.resources.forward = `tcp:${hostBridgePort}->tcp:${topologyPort}`
}

const ensureReverse = (slave, record) => {
  const reverses = textOf(adb(slave, ['reverse', '--list'], 'ADB reverse inventory', {allowFailure: true}))
  if (new RegExp(`\\btcp:${topologyPort}\\b`).test(reverses)) {
    throw new RunnerFailure('ADB topology reverse preflight', `device topology port ${topologyPort} already has a pre-existing reverse`)
  }
  adb(slave, ['reverse', `tcp:${topologyPort}`, `tcp:${hostBridgePort}`], 'create owned slave topology reverse')
  record.resources.reverseOwned = true
  record.resources.reverse = `tcp:${topologyPort}->tcp:${hostBridgePort}`
}

const probeEndpointBoundary = async record => {
  const identity = await endpointRequest('GET', '/status')
  let parsed
  try { parsed = JSON.parse(identity.body) } catch { parsed = null }
  if (identity.status !== 200 || parsed?.type !== 'identity' || parsed?.protocolVersion !== 1 || parsed?.instanceMode !== 'MASTER' || parsed?.displayRole !== 'CHIEF') {
    throw new RunnerFailure('topology identity endpoint', 'status endpoint did not return the expected master identity contract')
  }
  const probes = [{method: 'POST', path: ''}, {method: 'PUT', path: ''}, {method: 'DELETE', path: ''}]
  for (const pathName of ['/start', '/stop', '/pair', '/unpair', '/config']) probes.push({method: 'POST', path: pathName})
  const results = []
  for (const probe of probes) {
    const result = await endpointRequest(probe.method, probe.path)
    if (result.status >= 200 && result.status < 300) throw new RunnerFailure('topology mutation endpoint probe', 'an unauthenticated mutation-like request unexpectedly succeeded')
    results.push({method: probe.method, path: probe.path, status: result.status, bodyBytes: result.bodyBytes})
  }
  record.endpoint = {identity: {status: identity.status, bodyBytes: identity.bodyBytes, type: parsed.type, protocolVersion: parsed.protocolVersion, instanceMode: parsed.instanceMode, displayRole: parsed.displayRole}, mutationProbes: results}
  writeJson('endpoint-probe.json', record.endpoint)
}

const installProfile = async target => {
  const local = localApkBinding(target.profile)
  if (!local.exists) throw new RunnerFailure(`${target.tag} release install`, `APK missing: ${local.path}`)
  const install = adb(target, ['install', '-r', target.profile.apk], 'install release APK')
  writeText(`${target.tag}-release-install.txt`, sanitizeDiagnostic(textOf(install)))
  const installed = installedApkBinding(target)
  assertApkBinding(local, installed, `${target.tag} APK binding`)
  return {local, installed}
}

const coldLaunch = async target => {
  adb(target, ['shell', 'am', 'force-stop', target.profile.packageName], 'pre-run force-stop')
  adb(target, ['shell', 'pm', 'clear', target.profile.packageName], 'clear package state')
  adb(target, ['shell', 'am', 'start', '-W', '-n', target.profile.activity], 'cold launch release app')
  await waitForNode(target, 'terminal.admin:launcher')
  const process = processIdentity(target)
  if (process.pid === null || process.startTicks === null) throw new RunnerFailure(`${target.tag} process identity`, 'release app PID/start token was not readable')
  return process
}

const restartAndCheckHost = async (record, target) => {
  adb(target, ['shell', 'am', 'force-stop', target.profile.packageName], 'JS/runtime restart force-stop')
  adb(target, ['shell', 'am', 'start', '-W', '-n', target.profile.activity], 'JS/runtime restart launch')
  await waitForNode(target, 'terminal.admin:launcher')
  await openAdmin(record, target)
  await openTopology(record, target)
  await assertTopologyValue(record, target, 'host-after-js-restart', 'terminal.admin:topology:host-status', 'running')
  progress(record, 'host-desired-actual-js-restart', {deviceRole: target.role, process: processIdentity(target)})
}

const fillHost = async target => {
  await tapNode(target, 'terminal.admin:topology:host')
  // Topology uses the same terminal-owned virtual keyboard as every other
  // input field. Do not inject through Android's IME: PrimitiveInput
  // deliberately disables the system keyboard, and the shared field is the
  // source of truth for both visible value and input snapshots.
  for (const character of hostAliasForAndroidEmulator) {
    await tapNode(target, `ui.base.input:virtual-keyboard:text-${character}`)
  }
  await tapNode(target, 'ui.base.input:virtual-keyboard:complete')
  await waitForNode(target, 'terminal.admin:topology:query', node => node.enabled)
}

const pairDevices = async (record, master, slave) => {
  await openAdmin(record, master)
  await openTopology(record, master)
  await assertTopologyValue(record, master, 'master-host-initially-stopped', 'terminal.admin:topology:host-status', 'stopped')
  await tapNode(master, 'terminal.admin:topology:enable')
  await assertTopologyValue(record, master, 'master-host-running', 'terminal.admin:topology:host-status', 'running')
  ensureForward(master, record)
  ensureReverse(slave, record)
  await probeEndpointBoundary(record)
  progress(record, 'master-host-started-via-enable-slave-chain', {deviceRole: 'master', process: processIdentity(master)})

  await restartAndCheckHost(record, master)
  await openAdmin(record, slave)
  await openTopology(record, slave)
  await fillHost(slave)
  await tapNode(slave, 'terminal.admin:topology:query')
  await waitForNode(slave, 'terminal.admin:topology:identity', (_node, xml) => {
    const region = resourceRegion(xml, 'terminal.admin:topology:identity')
    return region.includes('MASTER') && region.includes('CHIEF')
  })
  await observe(record, slave, 'slave-identity-before-ws', ['terminal.admin:topology:identity'], ['MASTER', 'CHIEF'])
  await tapNode(slave, 'terminal.admin:topology:pair')
  // Pairing resets the slave JS runtime into its VICE surface.  A clean
  // slave has no active customer workflow, so its post-reset content is the
  // valid content failure `container-empty: main`, not `sample.auth.login`.
  // Wait for the admin shell to be unloaded; openAdmin then deliberately
  // reopens the login flow and authenticates it through the real UI.
  await waitForPairRuntimeReset(slave)
  progress(record, 'identity-before-ws-pair-and-slave-reset', {deviceRole: 'slave', slaveProcess: processIdentity(slave)})

  await openAdmin(record, slave)
  await openTopology(record, slave)
  await assertTopologyValue(record, slave, 'slave-paired', 'terminal.admin:topology:paired', '已配对')
  await assertTopologyValue(record, slave, 'slave-reachable', 'terminal.admin:topology:reachable', '可达')
  await tapNode(slave, 'terminal.admin:section:display-context')
  await observe(record, slave, 'slave-role-after-pair', ['admin.console.display-context:role', 'admin.console.display-context:instance'], ['VICE', 'SLAVE'])
  await tapNode(slave, 'terminal.admin:section:topology')
  await waitForNode(slave, 'terminal.admin:topology:form')

  await assertTopologyValue(record, master, 'master-paired', 'terminal.admin:topology:paired', '已配对')
  await assertTopologyValue(record, master, 'master-peer-reachable', 'terminal.admin:topology:reachable', '可达')
  await probeRoleOccupancy(record)
  await closeAdmin(slave)
  progress(record, 'single-master-single-slave-role-occupancy', {deviceRole: 'master'})
}

const probeRoleOccupancy = async record => {
  const result = await new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${hostBridgePort}${topologyBasePath}/ws`)
    let settled = false
    const finish = value => {
      if (settled) return
      settled = true
      try { socket.close() } catch { /* already closed */ }
      resolve(value)
    }
    socket.on('message', value => {
      try {
        const message = JSON.parse(String(value))
        if (message.type === 'hello-rejected' && message.error?.code === 'TOPOLOGY_ROLE_OCCUPIED') finish({status: 'PASS', messageType: message.type, reasonCode: message.error.code})
      } catch {
        finish({status: 'FAIL', reasonCode: 'TOPOLOGY_PROTOCOL_REJECTED'})
      }
    })
    socket.on('close', (_code, reason) => {
      if (!settled) finish({status: 'FAIL', reasonCode: String(reason).includes('ROLE_OCCUPIED') ? 'TOPOLOGY_ROLE_OCCUPIED' : 'TOPOLOGY_PEER_UNREACHABLE'})
    })
    socket.on('error', error => {
      if (!settled) reject(error)
    })
    setTimeout(() => {
      if (!settled) finish({status: 'FAIL', reasonCode: 'TOPOLOGY_TIMEOUT'})
    }, 5_000)
  })
  record.roleOccupancy = result
  writeJson('role-occupancy.json', result)
  if (result.status !== 'PASS') throw new RunnerFailure('single-master-single-slave role occupancy', `expected ROLE_OCCUPIED, observed ${result.reasonCode}`)
}

const tapVirtualText = async (target, value) => {
  const normalized = value.toLowerCase()
  if (value !== normalized) await tapNode(target, 'ui.base.input:virtual-keyboard:shift')
  for (const character of normalized) {
    await tapNode(target, `ui.base.input:virtual-keyboard:text-${character}`)
  }
}

const fillStaffLogin = async target => {
  await waitForNode(target, 'sample.auth.login')
  await tapNode(target, 'sample.auth.login:operator-name')
  await tapVirtualText(target, 'A001')
  await tapNode(target, 'ui.base.input:virtual-keyboard:complete')
  await tapNode(target, 'sample.auth.login:passcode')
  await tapVirtualText(target, '1111')
  await tapNode(target, 'ui.base.input:virtual-keyboard:complete')
  await tapNode(target, 'sample.auth.login:submit')
  await waitForNode(target, 'sample.desk.member-list')
}

const runMemberJourney = async (record, master, slave) => {
  await closeAdmin(master)
  // A paired single-screen slave is anonymous until the master authenticates,
  // but it still owns the customer-facing logical SECONDARY surface. This
  // observation prevents a missing placement from being mistaken for a
  // normal pre-authentication state.
  await waitForNode(slave, 'sample.desk.customer-welcome')
  await observe(record, slave, 'anonymous-paired-slave-customer-surface', ['sample.desk.customer-welcome'], ['欢迎，请等待店员操作'])
  progress(record, 'paired-anonymous-slave-renders-customer-surface', {deviceRole: 'slave'})
  await fillStaffLogin(master)
  await observe(record, master, 'member-list-before-registration', ['sample.desk.member-list'], ['已登记会员'])
  const masterList = await readUi(master, 'find member add control')
  const addId = nodeForId(masterList, 'sample.desk.member-list:empty-action') === null
    ? 'sample.desk.member-list:add'
    : 'sample.desk.member-list:empty-action'
  await tapNode(master, addId)
  await waitForNode(master, 'sample.desk.member-form')
  await tapNode(master, 'sample.desk.member-form:name')
  await tapVirtualText(master, 'ALICE')
  await waitForNode(master, 'sample.desk.member-form:name', node => nodeText(node).includes('Alice'))
  await tapNode(master, 'ui.base.input:virtual-keyboard:complete')
  await tapNode(master, 'sample.desk.member-form:phone')
  await tapVirtualText(master, '01012345678')
  await waitForNode(master, 'sample.desk.member-form:phone', node => nodeText(node).includes('01012345678'))
  await tapNode(master, 'ui.base.input:virtual-keyboard:complete')
  await tapNode(master, 'sample.desk.member-form:submit')
  await waitForNode(master, 'sample.desk.waiting-confirm')
  await observe(record, master, 'member-waiting-on-master', ['sample.desk.member-list', 'sample.desk.waiting-confirm'], ['已提交，等待顾客确认', 'Alice', '01012345678'])
  await waitForNode(slave, 'sample.desk.customer-member')
  await observe(record, slave, 'member-confirmation-on-slave', ['sample.desk.customer-member'], ['请确认登记', 'Alice', '01012345678'])
  captureStage1Screenshot(slave, 'member-confirmation-on-slave')
  progress(record, 'cross-device-member-pending-state', {masterPartKey: 'sample.desk.waiting-confirm', slavePartKey: 'sample.desk.customer-member'})

  // Reboot the real slave while the peer-owned pending workflow is visible.
  // The post-reconnect assertion is deliberately the business part, not the
  // process start result, so a stale or missing synced pending state fails.
  await adb(slave, ['shell', 'am', 'force-stop', slave.profile.packageName], 'pending slave cold restart force-stop')
  await adb(slave, ['shell', 'am', 'start', '-W', '-n', slave.profile.activity], 'pending slave cold restart')
  await waitForNode(slave, 'sample.desk.customer-member')
  await observe(record, slave, 'pending-state-after-slave-restart', ['sample.desk.customer-member'], ['请确认登记', 'Alice', '01012345678'])
  progress(record, 'pending-customer-workflow-restored-after-slave-restart', {deviceRole: 'slave', process: processIdentity(slave)})

  await tapNode(master, 'sample.desk.waiting-confirm:withdraw')
  await waitForNode(master, 'sample.desk.withdraw-confirm')
  await tapNode(master, 'sample.desk.withdraw-confirm:withdraw')
  await waitForNode(master, 'sample.desk.member-form')
  await waitForNode(slave, 'sample.desk.customer-welcome')
  await waitForAbsent(slave, 'sample.desk.customer-member')
  await observe(record, master, 'withdrawn-state-after-slave-restart', ['sample.desk.member-form'], [])
  await observe(record, slave, 'no-stale-customer-popup-after-reconnect', ['sample.desk.customer-welcome'], ['欢迎，请等待店员操作'])
  progress(record, 'slave-reconnect-clears-cancelled-customer-popup', {masterPartKey: 'sample.desk.member-form', slavePartKey: 'sample.desk.customer-welcome'})

  // Register a second member through the restored master form so the normal
  // confirmation path remains covered after the cancellation scenario.
  await tapNode(master, 'sample.desk.member-form:name')
  await tapVirtualText(master, 'BOB')
  await waitForNode(master, 'sample.desk.member-form:name', node => nodeText(node).includes('Bob'))
  await tapNode(master, 'ui.base.input:virtual-keyboard:complete')
  await tapNode(master, 'sample.desk.member-form:phone')
  await tapVirtualText(master, '01087654321')
  await waitForNode(master, 'sample.desk.member-form:phone', node => nodeText(node).includes('01087654321'))
  await tapNode(master, 'ui.base.input:virtual-keyboard:complete')
  await tapNode(master, 'sample.desk.member-form:submit')
  await waitForNode(master, 'sample.desk.waiting-confirm')
  await waitForNode(slave, 'sample.desk.customer-member')
  await observe(record, master, 'second-member-waiting-after-cancel', ['sample.desk.waiting-confirm'], ['Bob', '01087654321'])
  await observe(record, slave, 'second-member-confirmation-after-cancel', ['sample.desk.customer-member'], ['Bob', '01087654321'])

  await tapNode(slave, 'sample.desk.customer-member:age')
  await tapNode(slave, 'ui.base.input:virtual-keyboard:text-3')
  await tapNode(slave, 'ui.base.input:virtual-keyboard:text-7')
  await tapNode(slave, 'ui.base.input:virtual-keyboard:complete')
  await tapNode(slave, 'sample.desk.customer-member:confirm')
  await waitForNode(master, 'sample.desk.member-list:row')
  await observe(record, master, 'member-confirmed-on-master', ['sample.desk.member-list', 'sample.desk.member-list:row'], ['已登记会员', 'Bob', '01087654321'])
  captureStage1Screenshot(master, 'member-confirmed-on-master')
  await waitForNode(slave, 'sample.desk.customer-welcome')
  await observe(record, slave, 'member-welcome-on-slave', ['sample.desk.customer-welcome'], ['欢迎，请等待店员操作'])
  captureStage1Screenshot(slave, 'member-welcome-on-slave')
  progress(record, 'cross-device-member-confirmed-state', {masterPartKey: 'sample.desk.member-list', slavePartKey: 'sample.desk.customer-welcome'})

  await adb(master, ['shell', 'am', 'force-stop', master.profile.packageName], 'authenticated master cold restart force-stop')
  await adb(master, ['shell', 'am', 'start', '-W', '-n', master.profile.activity], 'authenticated master cold restart')
  await waitForNode(master, 'sample.desk.member-list:row')
  // Alice was deliberately withdrawn before the second registration.  The
  // authenticated restart assertion must follow the member that was actually
  // confirmed and persisted by this journey, rather than the cancelled draft.
  await observe(record, master, 'authenticated-state-after-cold-restart', ['sample.desk.member-list', 'sample.desk.member-list:row'], ['Bob', '01087654321'])
  progress(record, 'authenticated-member-state-restored-after-cold-restart', {deviceRole: 'master', process: processIdentity(master)})
}

const ensureAdminTopology = async (record, target) => {
  const current = await readUi(target, 'ensure topology preflight')
  if (nodeForId(current, 'terminal.admin:topology:form') !== null) return
  await openAdmin(record, target)
  await openTopology(record, target)
}

const runDisconnectRecovery = async (record, master, slave) => {
  if (!record.resources.forwardOwned) throw new RunnerFailure('disconnect/reconnect', 'owned forward was not created')
  await ensureAdminTopology(record, master)
  await ensureAdminTopology(record, slave)
  adb(master, ['forward', '--remove', `tcp:${hostBridgePort}`], 'remove topology forward for disconnect')
  record.resources.forwardOwned = false
  await assertTopologyValue(record, slave, 'paired-during-disconnect', 'terminal.admin:topology:paired', '已配对')
  await assertTopologyValue(record, slave, 'unreachable-during-disconnect', 'terminal.admin:topology:reachable', '重连中')
  await observe(record, master, 'master-paired-during-disconnect', ['terminal.admin:topology:paired'], ['已配对'])
  progress(record, 'disconnect-preserves-paired-and-secondary-semantics', {deviceRole: 'slave'})
  ensureForward(master, record)
  await assertTopologyValue(record, slave, 'reachable-after-reconnect', 'terminal.admin:topology:reachable', '可达')
  await assertTopologyValue(record, master, 'master-reachable-after-reconnect', 'terminal.admin:topology:reachable', '可达')
  progress(record, 'reconnect-full-recovery', {deviceRole: 'slave'})
}

const runUnpairAndStop = async (record, master, slave) => {
  await ensureAdminTopology(record, slave)
  await assertTopologyValue(record, slave, 'slave-unpair-ready', 'terminal.admin:topology:paired', '已配对')
  await tapNode(slave, 'terminal.admin:topology:unpair', {scrollIntoView: true})
  // Do not close the admin surface after the tap. Unpair changes SLAVE back
  // to MASTER, which resets the JS
  // runtime and therefore removes the current admin page. The observable
  // boundary is the real post-reset admin login surface, not a stale topology
  // value; waiting for that login also prevents the runner from claiming a
  // state transition that was only inferred from the tap. Unpair resets the
  // topology runtime into the admin authentication layer; `sample.auth.login`
  // is the customer feature login and is not the post-reset surface here.
  await waitForNode(slave, 'terminal.admin:login')
  // The business surface behind the login is not required to be anonymous: a
  // confirmed customer workflow may remain on its welcome screen after
  // topology unpair. Re-authenticate through the real admin UI, then assert
  // the persisted unpaired state from the fresh topology page.
  await openAdmin(record, slave)
  await openTopology(record, slave)
  await assertTopologyValue(record, slave, 'slave-unpaired', 'terminal.admin:topology:paired', '未配对')
  await tapNode(slave, 'terminal.admin:section:display-context')
  await observe(record, slave, 'slave-role-restored-after-unpair', ['admin.console.display-context:role', 'admin.console.display-context:instance'], ['CHIEF', 'MASTER'])
  await ensureAdminTopology(record, master)
  await assertTopologyValue(record, master, 'master-unpaired-after-peer-event', 'terminal.admin:topology:paired', '未配对')
  await tapNode(master, 'terminal.admin:topology:enable')
  await assertTopologyValue(record, master, 'master-host-stopped', 'terminal.admin:topology:host-status', 'stopped')
  progress(record, 'unpair-order-and-host-stop', {deviceRole: 'master'})
  adb(master, ['forward', '--remove', `tcp:${hostBridgePort}`], 'remove topology forward after host stop', {allowFailure: true})
  record.resources.forwardOwned = false
}

const captureFailure = async (record, targets) => {
  for (const target of targets) {
    try {
      const xml = await readUi(target, 'first-failure')
      saveUi(target, 'first-failure', xml)
    } catch (error) {
      writeText(`${target.tag}-first-failure-ui-error.txt`, sanitizeDiagnostic(error instanceof Error ? error.message : String(error)))
    }
    const screenshot = adb(target, ['exec-out', 'screencap', '-p'], 'first-failure screenshot', {allowFailure: true, binary: true})
    if (screenshot.status === 0 && Buffer.isBuffer(screenshot.stdout) && screenshot.stdout.length > 0) {
      writeBinary(`${target.tag}-first-failure.png`, screenshot.stdout)
    }
    writeText(`${target.tag}-first-failure-logcat.txt`, sanitizeDiagnostic(textOf(adb(target, ['logcat', '-d', '-v', 'epoch'], 'first-failure logcat', {allowFailure: true}))))
    writeText(`${target.tag}-first-failure-window.txt`, sanitizeDiagnostic(textOf(adb(target, ['shell', 'dumpsys', 'window', 'windows'], 'first-failure window', {allowFailure: true}))))
    writeText(`${target.tag}-first-failure-activity.txt`, sanitizeDiagnostic(textOf(adb(target, ['shell', 'dumpsys', 'activity', 'activities'], 'first-failure activity', {allowFailure: true}))))
  }
}

const captureTopologyLogcat = (target, record) => {
  const result = adb(target, ['logcat', '-d', '-v', 'epoch'], 'topology anomaly logcat', {allowFailure: true})
  const processIds = new Set()
  const addProcessId = value => {
    if (typeof value === 'string' && /^\d+$/.test(value)) processIds.add(value)
  }
  addProcessId(record.devices?.[target.role]?.coldLaunchProcess?.pid)
  for (const entry of record.timeline ?? []) {
    if (entry.deviceRole === target.role) {
      addProcessId(entry.process?.pid)
      addProcessId(entry.slaveProcess?.pid)
    }
  }
  const lines = textOf(result).split('\n').filter(line => {
    if (!/topology|websocket|ter-topology|ReactNativeJS/i.test(line)) return false
    if (processIds.size === 0) return true
    return [...processIds].some(pid => new RegExp(`\\s${pid}\\s`).test(line))
  })
  writeText(`${target.tag}-topology-anomaly-logcat.txt`, sanitizeDiagnostic(lines.join('\n')))
}

const cleanupProfile = async (record, targets) => {
  const errors = []
  for (const target of targets) {
    if (target.uiObserver !== null) {
      const stopped = await target.uiObserver.stop()
      if (!stopped) errors.push(`${target.tag} UI observer remains`)
      target.uiObserver = null
    }
    if (target.remoteUiCreated) {
      const removed = adb(target, ['shell', 'rm', '-f', target.remoteUiPath], 'remove UI dump', {allowFailure: true})
      if (removed.status !== 0) errors.push(`${target.tag} UI dump remove`)
      const absent = adb(target, ['shell', 'test', '!', '-e', target.remoteUiPath], 'verify UI dump removal', {allowFailure: true})
      if (absent.status !== 0) errors.push(`${target.tag} UI dump remains`)
    }
    if (target.stage2UiCreated) {
      const removed = adb(target, ['shell', 'rm', '-f', target.remoteWindowsUiPath], 'remove multi-display UI dump', {allowFailure: true})
      if (removed.status !== 0) errors.push(`${target.tag} multi-display UI dump remove`)
      const absent = adb(target, ['shell', 'test', '!', '-e', target.remoteWindowsUiPath], 'verify multi-display UI dump removal', {allowFailure: true})
      if (absent.status !== 0) errors.push(`${target.tag} multi-display UI dump remains`)
    }
    if (target.uiObserverDexPushed) {
      const removed = adb(target, ['shell', 'rm', '-f', target.remoteUiObserverDexPath], 'remove no-idle UI observer', {allowFailure: true})
      if (removed.status !== 0) errors.push(`${target.tag} UI observer removal`)
      const absent = adb(target, ['shell', 'test', '!', '-e', target.remoteUiObserverDexPath], 'verify no-idle UI observer removal', {allowFailure: true})
      if (absent.status !== 0) errors.push(`${target.tag} UI observer remains on device`)
      target.uiObserverDexPushed = false
    }
    adb(target, ['shell', 'am', 'force-stop', target.profile.packageName], 'cleanup package force-stop', {allowFailure: true})
    const process = processIdentity(target)
    if (process.pid !== null) errors.push(`${target.tag} package PID remains`)
  }
  if (record.resources.forwardOwned) {
    const removed = adb(targets[0], ['forward', '--remove', `tcp:${hostBridgePort}`], 'cleanup owned topology forward', {allowFailure: true})
    if (removed.status !== 0) errors.push('owned topology forward removal')
  }
  if (record.resources.reverseOwned) {
    const removed = adb(targets[1], ['reverse', '--remove', `tcp:${topologyPort}`], 'cleanup owned slave topology reverse', {allowFailure: true})
    if (removed.status !== 0) errors.push('owned topology reverse removal')
  }
  const forwards = textOf(localRun('adb', ['forward', '--list'], 'cleanup forward inventory', {allowFailure: true}))
  if (new RegExp(`\\btcp:${hostBridgePort}\\b`).test(forwards)) errors.push('topology forward remains')
  const reverses = textOf(adb(targets[1], ['reverse', '--list'], 'cleanup reverse inventory', {allowFailure: true}))
  if (new RegExp(`\\btcp:${topologyPort}\\b`).test(reverses)) errors.push('topology reverse remains')
  record.resources.forwardOwned = false
  record.resources.reverseOwned = false
  record.cleanupErrors = errors
  record.cleanup = errors.length === 0 ? 'PASS' : 'FAIL'
}

const runProfile = async profile => {
  const profileOutput = path.join(outputDirectory, profile.name)
  fs.mkdirSync(profileOutput, {recursive: true})
  const originalOutputDirectory = currentOutputDirectory
  // All helper artifacts are intentionally profile-scoped.  The binding only
  // controls evidence file placement and never changes repository source.
  currentOutputDirectory = profileOutput
  const record = {
    runId: `ter-dual-${profile.name}-${Date.now()}`,
    tool: 'tools/terminal-topology/run-dual-device.mjs',
    stage: '1',
    profile: profile.name,
    packageName: profile.packageName,
    activity: profile.activity,
    masterSerial,
    slaveSerial,
    emulatorOwnership: 'PREEXISTING_NOT_RUNNER_OWNED',
    startedAt: new Date().toISOString(),
    business: 'NOT_RUN',
    cleanup: 'NOT_RUN',
    firstFailure: null,
    lastKnownGood: null,
    brokenBoundary: null,
    timeline: [],
    steps: [],
    devices: {},
    resources: {forward: null, forwardOwned: false, reverse: null, reverseOwned: false},
    endpoint: null,
    roleOccupancy: null,
  }
  const master = device('master', masterSerial, profile)
  const slave = device('slave', slaveSerial, profile)
  const targets = [master, slave]
  try {
    if (stage !== '1') throw new RunnerFailure('stage gate', 'stage 2 is held until Dexter starts the corresponding single-device dual-screen and mobile virtual machines')
    record.devices.master = captureDeviceShape(master)
    record.devices.slave = captureDeviceShape(slave)
    if (record.devices.master.displays.length !== 1 || record.devices.slave.displays.length !== 1) throw new RunnerFailure('stage-one shape gate', 'stage one requires one display on each device')
    const masterInstall = await installProfile(master)
    const slaveInstall = await installProfile(slave)
    record.apkBinding = {master: masterInstall, slave: slaveInstall}
    writeJson('apk-binding.json', record.apkBinding)
    if (uiObserverDexPath === null) throw new RunnerFailure('no-idle UI observer', 'observer dex was not prepared before profile execution')
    await installUiObserver(master, uiObserverDexPath)
    await installUiObserver(slave, uiObserverDexPath)
    record.uiObserver = {
      source: 'tools/terminal-topology/android/NoIdleUiDump.java',
      mode: 'persistent-shell-side-UiAutomation-without-waitForIdle',
      masterRemoteDexPath: master.remoteUiObserverDexPath,
      slaveRemoteDexPath: slave.remoteUiObserverDexPath,
    }
    writeJson('ui-observer.json', record.uiObserver)
    record.devices.master.coldLaunchProcess = await coldLaunch(master)
    record.devices.slave.coldLaunchProcess = await coldLaunch(slave)
    progress(record, 'both-release-apps-cold-launched', {profile: profile.name})
    await pairDevices(record, master, slave)
    if (profile.memberJourney) await runMemberJourney(record, master, slave)
    await runDisconnectRecovery(record, master, slave)
    await runUnpairAndStop(record, master, slave)
    record.business = 'PASS'
  } catch (error) {
    record.business = 'FAIL'
    record.firstFailure = sanitizeDiagnostic(error instanceof Error ? error.message : String(error))
    record.brokenBoundary = record.lastKnownGood ?? 'before-first-known-good'
    await captureFailure(record, targets)
  } finally {
    for (const target of targets) captureTopologyLogcat(target, record)
    await cleanupProfile(record, targets)
    record.finishedAt = new Date().toISOString()
    writeJson('result.json', record)
    currentOutputDirectory = originalOutputDirectory
  }
  return record
}

const captureStage2Failure = async (record, target) => {
  const displayIds = [0, ...(target.secondaryDisplayId === null ? [] : [target.secondaryDisplayId])]
  for (const displayId of displayIds) {
    try {
      const xml = await readStage2Ui(target, displayId, 'stage2 first-failure')
      saveStage2Ui(target, displayId, 'stage2-first-failure', xml)
    } catch (error) {
      writeText(`${target.tag}-display-${displayId}-stage2-first-failure-ui-error.txt`, sanitizeDiagnostic(error instanceof Error ? error.message : String(error)))
    }
    const surfaceDisplayId = target.surfaceDisplayIds.get(displayId)
    const screenshotArgs = surfaceDisplayId === undefined
      ? ['exec-out', 'screencap', '-p']
      : ['exec-out', 'screencap', '-p', '-d', surfaceDisplayId]
    const screenshot = adb(target, screenshotArgs, `stage2 first-failure display ${displayId} screenshot`, {allowFailure: true, binary: true})
    if (screenshot.status === 0 && Buffer.isBuffer(screenshot.stdout) && screenshot.stdout.length > 0) {
      writeBinary(`${target.tag}-display-${displayId}-stage2-first-failure.png`, screenshot.stdout)
    }
  }
  writeText(`${target.tag}-stage2-first-failure-logcat.txt`, sanitizeDiagnostic(textOf(adb(target, ['logcat', '-d', '-v', 'epoch'], 'stage2 first-failure logcat', {allowFailure: true}))))
  writeText(`${target.tag}-stage2-first-failure-window.txt`, sanitizeDiagnostic(textOf(adb(target, ['shell', 'dumpsys', 'window', 'windows'], 'stage2 first-failure window', {allowFailure: true}))))
  writeText(`${target.tag}-stage2-first-failure-activity.txt`, sanitizeDiagnostic(textOf(adb(target, ['shell', 'dumpsys', 'activity', 'activities'], 'stage2 first-failure activity', {allowFailure: true}))))
}

const cleanupStage2Profile = async (record, target) => {
  const errors = []
  for (const remotePath of [target.remoteUiPath, target.remoteWindowsUiPath]) {
    const removed = adb(target, ['shell', 'rm', '-f', remotePath], 'stage2 cleanup remote UI dump', {allowFailure: true})
    if (removed.status !== 0) errors.push(`remote UI dump removal failed: ${remotePath}`)
    const absent = adb(target, ['shell', 'test', '!', '-e', remotePath], 'stage2 verify remote UI dump removal', {allowFailure: true})
    if (absent.status !== 0) errors.push(`remote UI dump remains: ${remotePath}`)
  }
  adb(target, ['shell', 'am', 'force-stop', target.profile.packageName], 'stage2 cleanup package force-stop', {allowFailure: true})
  const process = processIdentity(target)
  if (process.pid !== null) errors.push(`${target.tag} package PID remains`)
  record.cleanupReadback = {
    appProcess: process,
    runnerProcess: {pid: null, owned: false, note: 'runner is the current orchestrator and did not spawn a child runtime'},
    emulatorOwnership: target.emulatorOwnership ?? 'PREEXISTING_NOT_RUNNER_OWNED',
    remoteUiPaths: [target.remoteUiPath, target.remoteWindowsUiPath],
  }
  record.cleanupErrors = errors
  record.cleanup = errors.length === 0 ? 'PASS' : 'FAIL'
  writeJson('cleanup-result.json', {status: record.cleanup, errors, readback: record.cleanupReadback})
}

const runStage2Profile = async profile => {
  const profileOutput = path.join(outputDirectory, profile.name)
  fs.mkdirSync(profileOutput, {recursive: true})
  const originalOutputDirectory = currentOutputDirectory
  currentOutputDirectory = profileOutput
  const record = {
    runId: `ter-dual-stage2-${stage2Shape}-${profile.name}-${Date.now()}`,
    tool: 'tools/terminal-topology/run-dual-device.mjs',
    stage: '2',
    shape: stage2Shape,
    profile: profile.name,
    packageName: profile.packageName,
    activity: profile.activity,
    serial: stage2Serial,
    emulatorOwnership: 'PREEXISTING_NOT_RUNNER_OWNED',
    startedAt: new Date().toISOString(),
    business: 'NOT_RUN',
    cleanup: 'NOT_RUN',
    firstFailure: null,
    lastKnownGood: null,
    brokenBoundary: null,
    timeline: [],
    steps: [],
    devices: {},
    resources: {forward: null, forwardOwned: false, reverse: null, reverseOwned: false},
  }
  const target = device('stage2', stage2Serial, profile)
  target.emulatorOwnership = 'PREEXISTING_NOT_RUNNER_OWNED'
  try {
    record.devices.stage2 = captureStage2Shape(target, stage2Shape)
    const install = await installProfile(target)
    record.apkBinding = {device: install}
    writeJson('apk-binding.json', record.apkBinding)
    record.devices.stage2.coldLaunchProcess = await stage2ColdLaunch(target)
    progress(record, `stage2-${stage2Shape}-release-app-cold-launched`, {deviceRole: target.role, displayCount: record.devices.stage2.displays.length, process: record.devices.stage2.coldLaunchProcess})
    captureStage2Screenshot(target, 0, 'stage2-cold-launch-primary')
    if (stage2Shape === 'dual') {
      if (target.secondaryDisplayId === null) throw new RunnerFailure('stage2 dual display', 'secondary display id is missing after shape capture')
      captureStage2Screenshot(target, target.secondaryDisplayId, 'stage2-cold-launch-secondary')
      await stage2RestartAndCheckChief(record, target)
      if (profile.memberJourney) {
        await stage2RunMemberJourney(record, target)
        record.stepwiseComparison = compareStage2MemberJourney(record)
      } else {
        await stage2OpenAdmin(record, target)
        await stage2OpenTopology(record, target)
        await observeStage2(record, target, 0, 'dual-wallpaper-topology-smoke', ['terminal.admin:topology:form', 'terminal.admin:topology:title'])
        captureStage2Screenshot(target, 0, 'dual-wallpaper-topology-smoke')
        await stage2CloseAdmin(target)
        progress(record, 'dual-wallpaper-topology-smoke', {deviceRole: target.role})
      }
    } else {
      await stage2RunMobileTopology(record, target)
    }
    record.business = 'PASS'
  } catch (error) {
    record.business = 'FAIL'
    record.firstFailure = sanitizeDiagnostic(error instanceof Error ? error.message : String(error))
    record.brokenBoundary = record.lastKnownGood ?? 'before-first-known-good'
    await captureStage2Failure(record, target)
  } finally {
    await cleanupStage2Profile(record, target)
    record.finishedAt = new Date().toISOString()
    writeJson('result.json', record)
    currentOutputDirectory = originalOutputDirectory
  }
  return record
}

const executeStage2 = async () => {
  const manifest = {
    tool: 'tools/terminal-topology/run-dual-device.mjs',
    stage: '2',
    shape: stage2Shape,
    appSelection,
    serial: stage2Serial,
    productionTopologyPort: topologyPort,
    hostBridgePort,
    topologyBasePath,
    emulatorOwnership: 'PREEXISTING_NOT_RUNNER_OWNED',
    selectedProfiles: selectedProfiles.map(profile => ({name: profile.name, packageName: profile.packageName, apk: path.relative(repositoryRoot, profile.apk)})),
    startedAt: new Date().toISOString(),
    stageOneReference: path.relative(repositoryRoot, path.join(repositoryRoot, '.runtime/ter-dual-machine-topology/2026-09-17/cp5')),
  }
  writeJson('run-manifest.json', manifest)
  const results = []
  for (const profile of selectedProfiles) {
    const profileResult = await runStage2Profile(profile)
    results.push(profileResult)
    writeJson(`${profile.name}-result.json`, profileResult)
  }
  const overall = {
    stage: '2',
    shape: stage2Shape,
    business: results.every(result => result.business === 'PASS') ? 'PASS' : 'FAIL',
    cleanup: results.every(result => result.cleanup === 'PASS') ? 'PASS' : 'FAIL',
    profiles: results.map(result => ({profile: result.profile, business: result.business, cleanup: result.cleanup, firstFailure: result.firstFailure, lastKnownGood: result.lastKnownGood, brokenBoundary: result.brokenBoundary})),
    stageTwoStatus: results.every(result => result.business === 'PASS' && result.cleanup === 'PASS') ? 'CLOSED' : 'OPEN',
    finishedAt: new Date().toISOString(),
  }
  writeJson('overall-result.json', overall)
  console.log(`TERMINAL_TOPOLOGY_STAGE2=${overall.business} CLEANUP=${overall.cleanup} SHAPE=${stage2Shape} OUTPUT=${outputDirectory}`)
  if (overall.business !== 'PASS' || overall.cleanup !== 'PASS') process.exitCode = 1
}

// Helpers resolve artifacts through this binding so that profiles can run
// sequentially while retaining separate evidence directories.
let currentOutputDirectory = outputDirectory
let uiObserverDexPath = null

const execute = async () => {
  if (stage === '2') {
    await executeStage2()
    return
  }
  const manifest = {
    tool: 'tools/terminal-topology/run-dual-device.mjs',
    stage: '1',
    appSelection,
    masterSerial,
    slaveSerial,
    productionTopologyPort: topologyPort,
    hostBridgePort,
    topologyBasePath,
    emulatorOwnership: 'PREEXISTING_NOT_RUNNER_OWNED',
    selectedProfiles: selectedProfiles.map(profile => ({name: profile.name, packageName: profile.packageName, apk: path.relative(repositoryRoot, profile.apk)})),
    startedAt: new Date().toISOString(),
    stageTwoStatus: 'OPEN_WAITING_FOR_DEXTER_VM',
  }
  writeJson('run-manifest.json', manifest)
  try {
    uiObserverDexPath = buildUiObserverDex()
  } catch (error) {
    writeText('no-idle-ui-observer-build-failure.txt', sanitizeDiagnostic(error instanceof Error ? error.stack ?? error.message : String(error)))
    console.error(`TERMINAL_TOPOLOGY_STAGE1=FAIL OBSERVER_BUILD=FAIL OUTPUT=${outputDirectory}`)
    process.exitCode = 1
    return
  }
  const results = []
  for (const profile of selectedProfiles) {
    const profileResult = await runProfile(profile)
    results.push(profileResult)
    writeJson(`${profile.name}-result.json`, profileResult)
  }
  const overall = {
    stage: '1',
    business: results.every(result => result.business === 'PASS') ? 'PASS' : 'FAIL',
    cleanup: results.every(result => result.cleanup === 'PASS') ? 'PASS' : 'FAIL',
    profiles: results.map(result => ({profile: result.profile, business: result.business, cleanup: result.cleanup, firstFailure: result.firstFailure, lastKnownGood: result.lastKnownGood, brokenBoundary: result.brokenBoundary})),
    stage2: 'OPEN_WAITING_FOR_DEXTER_VM',
    finishedAt: new Date().toISOString(),
  }
  writeJson('overall-result.json', overall)
  console.log(`TERMINAL_TOPOLOGY_STAGE1=${overall.business} CLEANUP=${overall.cleanup} STAGE2=OPEN OUTPUT=${outputDirectory}`)
  if (overall.business !== 'PASS' || overall.cleanup !== 'PASS') process.exitCode = 1
}

await execute()
