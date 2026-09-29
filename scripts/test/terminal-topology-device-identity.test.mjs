import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import test from 'node:test'
import {findImmersiveClingDismissal} from '../../tools/terminal-topology/android-ui-prompts.mjs'
import {
  parseAdbEmulatorInventory,
  parseAvdNameReply,
  parseAvdNames,
  parseWmDensityDpi,
  resolveTopologyAvds,
  validateLaptopDisplayShape,
} from '../../tools/terminal-topology/device-identity.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

test('resolves roles from explicit AVD names and the current adb inventory, not serial defaults', () => {
  const avdNames = parseAvdNames('laptop-main\nlaptop-peer\nmobile\n')
  const devices = parseAdbEmulatorInventory([
    'List of devices attached',
    'emulator-5572 device product:sdk_gphone64 model:laptop_x86_64 transport_id:7',
    'emulator-5580 device product:sdk_gphone64 model:laptop_x86_64 transport_id:8',
    'D409P5C2J0285 device product:foo model:physical transport_id:9',
  ].join('\n'))
  const activeAvds = [
    {serial: 'emulator-5572', avdName: parseAvdNameReply('laptop-peer\nOK\n')},
    {serial: 'emulator-5580', avdName: parseAvdNameReply('laptop-main\nOK\n')},
  ]

  assert.deepEqual(resolveTopologyAvds({
    masterAvdName: 'laptop-main',
    slaveAvdName: 'laptop-peer',
    availableAvdNames: avdNames,
    adbEmulators: devices,
    activeAvds,
  }), {
    master: {avdName: 'laptop-main', serial: 'emulator-5580'},
    slave: {avdName: 'laptop-peer', serial: 'emulator-5572'},
  })
})

test('fails closed for missing, identical, offline, or ambiguously running AVD identities', () => {
  const availableAvdNames = ['laptop-main', 'laptop-peer']
  const adbEmulators = [{serial: 'emulator-5572', state: 'device'}]
  assert.throws(() => resolveTopologyAvds({
    masterAvdName: undefined,
    slaveAvdName: 'laptop-peer',
    availableAvdNames,
    adbEmulators,
    activeAvds: [],
  }), /both master and slave AVD names are required/)
  assert.throws(() => resolveTopologyAvds({
    masterAvdName: 'laptop-main',
    slaveAvdName: 'laptop-main',
    availableAvdNames,
    adbEmulators,
    activeAvds: [],
  }), /must be distinct/)
  assert.throws(() => resolveTopologyAvds({
    masterAvdName: 'laptop-main',
    slaveAvdName: 'laptop-peer',
    availableAvdNames,
    adbEmulators,
    activeAvds: [{serial: 'emulator-5572', avdName: 'laptop-peer'}],
  }), /master AVD is not uniquely online/)
  assert.throws(() => resolveTopologyAvds({
    masterAvdName: 'laptop-main',
    slaveAvdName: 'laptop-peer',
    availableAvdNames,
    adbEmulators: [...adbEmulators, {serial: 'emulator-5580', state: 'device'}],
    activeAvds: [
      {serial: 'emulator-5572', avdName: 'laptop-main'},
      {serial: 'emulator-5580', avdName: 'laptop-main'},
    ],
  }), /master AVD is not uniquely online/)
})

test('accepts only one landscape logical display with at least 600dp shortest edge', () => {
  const accepted = validateLaptopDisplayShape({
    displays: [{id: 0, width: 1920, height: 1080}],
    virtualDisplayCount: 0,
    densityDpi: 240,
  })
  assert.equal(accepted.shortestEdgeDp, 720)

  assert.throws(() => validateLaptopDisplayShape({
    displays: [{id: 0, width: 1080, height: 1920}],
    virtualDisplayCount: 0,
    densityDpi: 240,
  }), /landscape/)
  assert.throws(() => validateLaptopDisplayShape({
    displays: [{id: 0, width: 1080, height: 600}],
    virtualDisplayCount: 0,
    densityDpi: 240,
  }), /shortest logical edge/)
  assert.throws(() => validateLaptopDisplayShape({
    displays: [{id: 0, width: 1920, height: 1080}, {id: 1, width: 1280, height: 720}],
    virtualDisplayCount: 0,
    densityDpi: 240,
  }), /exactly one logical display/)
  assert.throws(() => validateLaptopDisplayShape({
    displays: [{id: 0, width: 1920, height: 1080}],
    virtualDisplayCount: 1,
    densityDpi: 240,
  }), /Virtual Display/)
})

test('stage-one runner refuses to start without explicit current AVD names', () => {
  const result = spawnSync(process.execPath, [
    path.join(repositoryRoot, 'tools/terminal-topology/run-dual-device.mjs'),
    '--output', '.runtime/ter-third-party-usage-remediation/cli-preflight/topology',
  ], {cwd: repositoryRoot, encoding: 'utf8'})
  assert.equal(result.status, 1)
  assert.match(result.stderr, /stage 1 requires current --master-avd-name and --slave-avd-name inputs/)
  assert.doesNotMatch(result.stderr, /emulator-5554|emulator-5556/)
})

test('uses the effective density override when calculating the laptop threshold', () => {
  assert.equal(parseWmDensityDpi('Physical density: 420\nOverride density: 240\n'), 240)
})

test('recognizes only the exact Android immersive full-screen prompt and its Got it button', () => {
  const prompt = '<hierarchy><node resource-id="android:id/immersive_cling_title" text="Viewing full screen"/><node resource-id="android:id/ok" text="Got it" bounds="[40,80][120,140]"/></hierarchy>'
  assert.deepEqual(findImmersiveClingDismissal(prompt), {x: 80, y: 110})
  assert.equal(findImmersiveClingDismissal('<node resource-id="android:id/ok" text="Got it" bounds="[40,80][120,140]"/>'), null)
  assert.equal(findImmersiveClingDismissal(prompt.replace('Viewing full screen', 'Allow access')), null)
})
