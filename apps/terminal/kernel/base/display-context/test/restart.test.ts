import {describe, expect, it} from 'vitest'
import {type TimestampMs} from '@catering-v2s/kernel-base-contracts'
import {
  createStateRuntime,
} from '@catering-v2s/kernel-base-state'
import {
  selectRuntimeInstanceMode,
} from '@catering-v2s/kernel-base-runtime'
import {
  createDisplayContextModule,
  selectDisplayRole,
  switchDisplayRoleCommand,
  switchInstanceModeCommand,
} from '../src/index'
import {
  FakeDevicePort,
  createDisplayPlatformPorts,
  createDisplayRuntime,
  primaryRoute,
  requestId,
  succeeded,
  unavailable,
} from './testSupport'
import {displayRoleSlice, displayRoleSliceName} from '../src/features/slices/displayRole'

const persistVice = async () => {
  const device = new FakeDevicePort()
  const first = createDisplayRuntime({device})
  await first.runtime.start()
  await first.runtime.dispatchCommand(switchInstanceModeCommand, {instanceMode: 'SLAVE'}, {requestId: requestId(), routeContext: primaryRoute})
  await first.runtime.dispatchCommand(switchDisplayRoleCommand, {displayRole: 'VICE'}, {requestId: requestId(), routeContext: primaryRoute})
  expect(selectDisplayRole(first.runtime.getState())).toBe('VICE')
  return first
}

describe('display-context restart and sync boundaries', () => {
  it('R-1 display-context-restart-positive keeps persisted VICE after restart on a single physical display', async () => {
    const first = await persistVice()
    const second = createDisplayRuntime({
      device: new FakeDevicePort(),
      plainStorage: first.plainStorage,
      protectedStorage: first.protectedStorage,
      runtimeName: 'display-context-restart-positive',
    })
    await second.runtime.start()
    expect(selectDisplayRole(second.runtime.getState())).toBe('VICE')
    expect(selectRuntimeInstanceMode(second.runtime.getState())).toBe('SLAVE')
  })

  it('R-2 corrects persisted VICE to CHIEF when the restarted device has multiple displays', async () => {
    const first = await persistVice()
    const device = new FakeDevicePort()
    device.displayCount = 2
    const second = createDisplayRuntime({device, plainStorage: first.plainStorage, protectedStorage: first.protectedStorage})
    await second.runtime.start()
    expect(selectDisplayRole(second.runtime.getState())).toBe('CHIEF')
    expect(device.calls.getDisplayInfo).toHaveLength(1)
  })

  it('R-3 corrects persisted VICE to CHIEF when restarted display info is malformed', async () => {
    const first = await persistVice()
    const device = new FakeDevicePort()
    device.displayResults.push(succeeded({displayCount: 0}))
    const second = createDisplayRuntime({device, plainStorage: first.plainStorage, protectedStorage: first.protectedStorage})
    await second.runtime.start()
    expect(selectDisplayRole(second.runtime.getState())).toBe('CHIEF')
    expect(device.calls.getDisplayInfo).toHaveLength(1)
  })

  it('R-4 corrects persisted VICE to CHIEF when restarted display info is unavailable', async () => {
    const first = await persistVice()
    const device = new FakeDevicePort()
    device.displayResults.push(unavailable('getDisplayInfo'))
    const second = createDisplayRuntime({device, plainStorage: first.plainStorage, protectedStorage: first.protectedStorage})
    await second.runtime.start()
    expect(selectDisplayRole(second.runtime.getState())).toBe('CHIEF')
    expect(device.calls.getDisplayInfo).toHaveLength(1)
  })

  it('R-5 skips inbound authoritative sync because display role is isolated', async () => {
    const runtime = await createStateRuntime({
      runtimeName: 'display-context-sync-isolated',
      environmentMode: 'TEST',
      slices: [displayRoleSlice],
      logger: createDisplayPlatformPorts().logger,
      plainStorage: createDisplayPlatformPorts().persistKv,
      protectedStorage: createDisplayPlatformPorts().persistSecure,
      persistenceKey: 'display-context-sync-isolated',
      storageTimeouts: {readMs: 50, writeMs: 50, resetMs: 50},
      persistenceDebounceMs: 0,
    })
    const result = runtime.applyAuthoritativeSync(displayRoleSliceName, {
      mode: 'authoritative',
      replaceMissing: true,
      entries: [{key: 'displayRole', value: {value: 'VICE', updatedAt: 1 as TimestampMs}}],
    })
    expect(result).toEqual({status: 'skipped', sliceName: displayRoleSliceName, reason: 'SYNC_NOT_DECLARED'})
    expect(selectDisplayRole(runtime.getState())).toBe('CHIEF')
  })
})
