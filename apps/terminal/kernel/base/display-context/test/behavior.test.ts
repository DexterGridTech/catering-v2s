import {describe, expect, it, vi} from 'vitest'
import {
  runtimeInstanceModeChangedCommand,
  selectRuntimeInstanceMode,
} from '@catering-v2s/kernel-base-runtime'
import type {DisplayInfo, LogEvent, PortResult} from '@catering-v2s/kernel-base-platform-ports'
import {releaseRuntimeForTest} from '@catering-v2s/kernel-base-runtime/testing'
import {getDisplayRoleChangeEligibility} from '../src/foundations/displayDerivation'
import {
  powerStatusChangedCommand,
  selectDisplayRole,
  switchDisplayRoleCommand,
  switchInstanceModeCommand,
} from '../src/index'
import {
  FakeDevicePort,
  createDisplayRuntime,
  failed,
  primaryRoute,
  requestId,
  secondaryRoute,
  succeeded,
  unavailable,
} from './testSupport'

const startSlaveRuntime = async (device = new FakeDevicePort()) => {
  const fixture = createDisplayRuntime({device})
  await fixture.runtime.start()
  const result = await fixture.runtime.dispatchCommand(
    switchInstanceModeCommand,
    {instanceMode: 'SLAVE'},
    {requestId: requestId(), routeContext: primaryRoute},
  )
  expect(result.status).toBe('completed')
  expect(selectRuntimeInstanceMode(fixture.runtime.getState())).toBe('SLAVE')
  return fixture
}

describe('display-context command actors', () => {
  it('A-1 switchDisplayRole writes VICE on a single primary slave', async () => {
    const {runtime, device} = await startSlaveRuntime()
    const displayInfoCallsBefore = device.calls.getDisplayInfo.length
    const result = await runtime.dispatchCommand(
      switchDisplayRoleCommand,
      {displayRole: 'VICE'},
      {requestId: requestId(), routeContext: primaryRoute},
    )
    expect(result.status).toBe('completed')
    expect(result.actorResults[0]?.result).toMatchObject({changed: true, currentRole: 'VICE'})
    expect(selectDisplayRole(runtime.getState())).toBe('VICE')
    expect(device.calls.getDisplayInfo).toHaveLength(displayInfoCallsBefore + 1)
  })

  it('A-2 switchDisplayRole rejects VICE on a managed secondary', async () => {
    const {runtime} = await startSlaveRuntime()
    const result = await runtime.dispatchCommand(
      switchDisplayRoleCommand,
      {displayRole: 'VICE'},
      {requestId: requestId(), routeContext: secondaryRoute},
    )
    expect(result.status).toBe('error')
    expect(selectDisplayRole(runtime.getState())).toBe('CHIEF')
    expect(result.actorResults[0]?.status).toBe('error')
  })

  it('A-3 switchDisplayRole rejects VICE when display info is unavailable', async () => {
    const device = new FakeDevicePort()
    const {runtime, events} = await startSlaveRuntime(device)
    device.displayResults.push(unavailable('getDisplayInfo'))
    const result = await runtime.dispatchCommand(
      switchDisplayRoleCommand,
      {displayRole: 'VICE'},
      {requestId: requestId(), routeContext: primaryRoute},
    )
    expect(result.status).toBe('error')
    expect(selectDisplayRole(runtime.getState())).toBe('CHIEF')
    expect(events.some(event => event.event === 'display-role.display-info-unavailable')).toBe(true)

    // S-1 regression: exercise the command path with a live multi-display
    // result. The public runtime error intentionally keeps the stable
    // LedgerError shape; reasonCode is asserted at the policy boundary.
    const multiDevice = new FakeDevicePort()
    const multiFixture = await startSlaveRuntime(multiDevice)
    multiDevice.displayCount = 2
    const multiDisplayCallsBefore = multiDevice.calls.getDisplayInfo.length
    const multiResult = await multiFixture.runtime.dispatchCommand(
      switchDisplayRoleCommand,
      {displayRole: 'VICE'},
      {requestId: requestId(), routeContext: primaryRoute},
    )
    expect(multiResult.status).toBe('error')
    expect(multiResult.actorResults[0]?.status).toBe('error')
    expect(multiResult.actorResults[0]?.error?.key).toBe('kernel.base.display-context.transition_rejected')
    expect(selectDisplayRole(multiFixture.runtime.getState())).toBe('CHIEF')
    expect(multiDevice.calls.getDisplayInfo).toHaveLength(multiDisplayCallsBefore + 1)
    expect(multiDevice.calls.getDisplayInfo.at(-1)).toMatchObject({timeoutMs: 1000})
    const eligibility = getDisplayRoleChangeEligibility({
      currentRole: 'CHIEF',
      targetRole: 'VICE',
      instanceMode: 'SLAVE',
      routeDisplayMode: primaryRoute.displayMode,
      displayCount: multiDevice.displayCount,
    })
    expect(eligibility).toEqual({allowed: false, reasonCode: 'multiple-physical-displays'})
    releaseRuntimeForTest(multiFixture.runtime)
  })

  it('A-4 switchDisplayRole rejects malformed display info', async () => {
    const device = new FakeDevicePort()
    const {runtime, events} = await startSlaveRuntime(device)
    device.displayResults.push(succeeded({displayCount: 0}))
    const result = await runtime.dispatchCommand(
      switchDisplayRoleCommand,
      {displayRole: 'VICE'},
      {requestId: requestId(), routeContext: primaryRoute},
    )
    expect(result.status).toBe('error')
    expect(selectDisplayRole(runtime.getState())).toBe('CHIEF')
    expect(events.some(event => event.event === 'display-role.display-info-malformed')).toBe(true)
  })

  it('A-5 switchInstanceMode writes SLAVE through the runtime command on one primary display', async () => {
    const {runtime, device} = createDisplayRuntime()
    await runtime.start()
    const result = await runtime.dispatchCommand(
      switchInstanceModeCommand,
      {instanceMode: 'SLAVE'},
      {requestId: requestId(), routeContext: primaryRoute},
    )
    expect(result.status).toBe('completed')
    expect(result.actorResults[0]?.result).toMatchObject({changed: true, currentMode: 'SLAVE'})
    expect(selectRuntimeInstanceMode(runtime.getState())).toBe('SLAVE')
    expect(device.calls.getDisplayInfo).toHaveLength(1)
  })

  it('A-6 switchInstanceMode rejects SLAVE on multiple physical displays', async () => {
    const device = new FakeDevicePort()
    device.displayCount = 2
    const {runtime} = createDisplayRuntime({device})
    await runtime.start()
    const result = await runtime.dispatchCommand(
      switchInstanceModeCommand,
      {instanceMode: 'SLAVE'},
      {requestId: requestId(), routeContext: primaryRoute},
    )
    expect(result.status).toBe('error')
    expect(selectRuntimeInstanceMode(runtime.getState())).toBe('MASTER')
    expect(result.actorResults[0]?.status).toBe('error')
  })

  it('A-7 switchInstanceMode rejects unavailable display info', async () => {
    const device = new FakeDevicePort()
    device.displayResults.push(unavailable('getDisplayInfo'))
    const {runtime, events} = createDisplayRuntime({device})
    await runtime.start()
    const result = await runtime.dispatchCommand(
      switchInstanceModeCommand,
      {instanceMode: 'SLAVE'},
      {requestId: requestId(), routeContext: primaryRoute},
    )
    expect(result.status).toBe('error')
    expect(selectRuntimeInstanceMode(runtime.getState())).toBe('MASTER')
    expect(events.some(event => event.event === 'instance-mode.display-info-unavailable')).toBe(true)
  })

  it('A-8 switchInstanceMode rejects managed secondary routes', async () => {
    const {runtime} = createDisplayRuntime()
    await runtime.start()
    const result = await runtime.dispatchCommand(
      switchInstanceModeCommand,
      {instanceMode: 'SLAVE'},
      {requestId: requestId(), routeContext: secondaryRoute},
    )
    expect(result.status).toBe('error')
    expect(selectRuntimeInstanceMode(runtime.getState())).toBe('MASTER')
    expect(result.actorResults[0]?.status).toBe('error')
  })

  it('A-9 powerStatusChanged changes SLAVE CHIEF to VICE on external power', async () => {
    const {runtime, device} = await startSlaveRuntime()
    const displayInfoCallsBefore = device.calls.getDisplayInfo.length
    const result = await runtime.dispatchCommand(powerStatusChangedCommand, {powerSource: 'external'})
    expect(result.status).toBe('completed')
    expect(result.actorResults[0]?.result).toMatchObject({changed: true, currentRole: 'VICE'})
    expect(selectDisplayRole(runtime.getState())).toBe('VICE')
    expect(device.calls.getDisplayInfo).toHaveLength(displayInfoCallsBefore + 1)
  })

  it('A-10 powerStatusChanged records no-change when display info is unavailable', async () => {
    const device = new FakeDevicePort()
    const {runtime, events} = await startSlaveRuntime(device)
    device.displayResults.push(unavailable('getDisplayInfo'))
    const result = await runtime.dispatchCommand(powerStatusChangedCommand, {powerSource: 'external'})
    expect(result.status).toBe('completed')
    expect(result.actorResults[0]?.result).toMatchObject({changed: false, reason: 'display-info-unavailable'})
    expect(selectDisplayRole(runtime.getState())).toBe('CHIEF')
    expect(events.some(event => event.event === 'power-status.display-info-unavailable')).toBe(true)
  })

  it('A-11 powerStatusChanged records no-change on malformed display info', async () => {
    const device = new FakeDevicePort()
    const {runtime, events} = await startSlaveRuntime(device)
    device.displayResults.push(succeeded({displayCount: Number.NaN}))
    const result = await runtime.dispatchCommand(powerStatusChangedCommand, {powerSource: 'external'})
    expect(result.status).toBe('completed')
    expect(result.actorResults[0]?.result).toMatchObject({changed: false, reason: 'display-info-malformed'})
    expect(selectDisplayRole(runtime.getState())).toBe('CHIEF')
    expect(events.some(event => event.event === 'power-status.display-info-malformed')).toBe(true)
  })

  it('A-12 roleChanged resets VICE to CHIEF after a runtime role commit', async () => {
    const {runtime} = await startSlaveRuntime()
    await runtime.dispatchCommand(switchDisplayRoleCommand, {displayRole: 'VICE'}, {requestId: requestId(), routeContext: primaryRoute})
    const result = await runtime.dispatchCommand(
      runtimeInstanceModeChangedCommand,
      {previousMode: 'SLAVE', nextMode: 'MASTER'},
    )
    expect(result.status).toBe('completed')
    expect(result.actorResults.some(record =>
      record.status === 'completed'
      && typeof record.result === 'object'
      && record.result !== null
      && Reflect.get(record.result, 'changed') === true
      && Reflect.get(record.result, 'currentRole') === 'CHIEF',
    )).toBe(true)
    expect(selectDisplayRole(runtime.getState())).toBe('CHIEF')
  })

  it('A-13 roleChanged is idempotent and switching back to CHIEF needs no display query', async () => {
    const {runtime, device} = await startSlaveRuntime()
    await runtime.dispatchCommand(
      switchDisplayRoleCommand,
      {displayRole: 'VICE'},
      {requestId: requestId(), routeContext: primaryRoute},
    )
    const displayInfoCallsBefore = device.calls.getDisplayInfo.length
    device.displayResults.push(unavailable('getDisplayInfo'))
    const switchBack = await runtime.dispatchCommand(
      switchDisplayRoleCommand,
      {displayRole: 'CHIEF'},
      {requestId: requestId(), routeContext: primaryRoute},
    )
    expect(switchBack.status).toBe('completed')
    expect(selectDisplayRole(runtime.getState())).toBe('CHIEF')
    expect(device.calls.getDisplayInfo).toHaveLength(displayInfoCallsBefore)
    const result = await runtime.dispatchCommand(
      runtimeInstanceModeChangedCommand,
      {previousMode: 'SLAVE', nextMode: 'MASTER'},
    )
    expect(result.status).toBe('completed')
    expect(result.actorResults.some(record =>
      record.status === 'completed'
      && typeof record.result === 'object'
      && record.result !== null
      && Reflect.get(record.result, 'changed') === false
      && Reflect.get(record.result, 'reason') === 'already-chief',
    )).toBe(true)
    expect(selectDisplayRole(runtime.getState())).toBe('CHIEF')
  })

  it('A-14 roleChanged rejects malformed post-commit payloads', async () => {
    const {runtime} = await startSlaveRuntime()
    const result = await runtime.dispatchCommand(
      runtimeInstanceModeChangedCommand.commandName,
      {previousMode: 'SLAVE', nextMode: 'INVALID'},
    )
    expect(result.status).toBe('error')
    expect(selectDisplayRole(runtime.getState())).toBe('CHIEF')
    expect(result.actorResults[0]?.status).toBe('error')
  })
})

describe('display-context bridge and install lifecycle', () => {
  it('B-1 seeds the first power event without dispatching a role change', async () => {
    const {runtime, device} = await startSlaveRuntime()
    device.emit('external')
    await Promise.resolve()
    expect(selectDisplayRole(runtime.getState())).toBe('CHIEF')
    expect(runtime.journal.list().some(event => event.kind === 'command.started' && event.commandName === powerStatusChangedCommand.commandName)).toBe(false)
  })

  it('B-2 dedupes repeated power events after seeding', async () => {
    const {runtime, device} = await startSlaveRuntime()
    device.emit('external')
    device.emit('external')
    await Promise.resolve()
    expect(selectDisplayRole(runtime.getState())).toBe('CHIEF')
    expect(runtime.journal.list().filter(event => event.kind === 'command.started' && event.commandName === powerStatusChangedCommand.commandName)).toHaveLength(0)
  })

  it('B-3 dispatches one command for a real power transition', async () => {
    const {runtime, device} = await startSlaveRuntime()
    device.emit('battery')
    device.emit('external')
    await vi.waitFor(() => expect(selectDisplayRole(runtime.getState())).toBe('VICE'))
    expect(runtime.journal.list().filter(event => event.kind === 'command.started' && event.commandName === powerStatusChangedCommand.commandName)).toHaveLength(1)
  })

  it('B-4 serializes burst power transitions through the dispatch tail', async () => {
    const {runtime, device} = await startSlaveRuntime()
    await runtime.dispatchCommand(switchDisplayRoleCommand, {displayRole: 'VICE'}, {requestId: requestId(), routeContext: primaryRoute})
    device.emit('external')
    device.emit('battery')
    device.emit('external')
    await vi.waitFor(() => expect(runtime.journal.list().filter(event => event.kind === 'command.completed' && event.commandName === powerStatusChangedCommand.commandName)).toHaveLength(2))
    expect(selectDisplayRole(runtime.getState())).toBe('VICE')
  })

  it('B-5 keeps install successful when the device subscription is unavailable or rejects', async () => {
    const persisted = await startSlaveRuntime()
    await persisted.runtime.dispatchCommand(
      switchDisplayRoleCommand,
      {displayRole: 'VICE'},
      {requestId: requestId(), routeContext: primaryRoute},
    )
    const pendingDevice = new FakeDevicePort()
    let resolveDisplayInfo: (result: PortResult<DisplayInfo>) => void = () => undefined
    pendingDevice.displayInfoPending = new Promise<PortResult<DisplayInfo>>(resolve => {
      resolveDisplayInfo = value => resolve(value)
    })
    const pendingFixture = createDisplayRuntime({
      device: pendingDevice,
      plainStorage: persisted.plainStorage,
      protectedStorage: persisted.protectedStorage,
    })
    let startSettled = false
    const pendingStart = pendingFixture.runtime.start().then(() => { startSettled = true })
    await vi.waitFor(() => expect(pendingDevice.calls.getDisplayInfo).toHaveLength(1))
    expect(startSettled).toBe(false)
    resolveDisplayInfo(succeeded({displayCount: 1}))
    await pendingStart
    expect(startSettled).toBe(true)
    releaseRuntimeForTest(persisted.runtime)
    releaseRuntimeForTest(pendingFixture.runtime)

    const device = new FakeDevicePort()
    device.subscribeResult = unavailable('subscribePowerStatus')
    const {runtime, events} = createDisplayRuntime({device})
    await expect(runtime.start()).resolves.toBeUndefined()
    expect(runtime.status).toBe('started')
    expect(device.calls.unsubscribePowerStatus).toHaveLength(0)
    const unavailableEvent = events.find(event => event.event === 'power-bridge.subscription-unavailable')
    expect(unavailableEvent).toBeDefined()
    expect(unavailableEvent?.data).toMatchObject({
      status: 'unavailable',
      capability: 'subscribePowerStatus',
      reason: 'ADAPTER_NOT_INJECTED',
    })

    const rejectingDevice = new FakeDevicePort()
    rejectingDevice.subscribeError = new Error('subscription rejected in test')
    const rejectingEvents: LogEvent[] = []
    const rejectingFixture = createDisplayRuntime({device: rejectingDevice, events: rejectingEvents})
    await expect(rejectingFixture.runtime.start()).resolves.toBeUndefined()
    expect(rejectingFixture.runtime.status).toBe('started')
    const rejectedEvent = rejectingEvents.find(event => event.event === 'power-bridge.subscription-rejected')
    expect(rejectedEvent).toBeDefined()
    expect(rejectedEvent?.data).toMatchObject({
      status: 'rejected',
      capability: 'subscribePowerStatus',
      errorType: 'Error',
    })
    releaseRuntimeForTest(rejectingFixture.runtime)
  })

  it('B-6 logs subscription onError without changing display role', async () => {
    const {runtime, device, events} = await startSlaveRuntime()
    device.reportError()
    expect(selectDisplayRole(runtime.getState())).toBe('CHIEF')
    expect(events.some(event => event.event === 'power-bridge.subscription-error')).toBe(true)
  })

  it('B-7 release unregisters the native subscription and ignores later events', async () => {
    const {runtime, device} = await startSlaveRuntime()
    expect(releaseRuntimeForTest(runtime)).toBeGreaterThan(0)
    await vi.waitFor(() => expect(device.calls.unsubscribePowerStatus).toHaveLength(1))
    device.emit('external')
    await Promise.resolve()
    expect(selectDisplayRole(runtime.getState())).toBe('CHIEF')
  })

  it('B-8 release is idempotent and never unsubscribes twice', async () => {
    const {runtime, device} = await startSlaveRuntime()
    expect(releaseRuntimeForTest(runtime)).toBeGreaterThan(0)
    expect(releaseRuntimeForTest(runtime)).toBe(0)
    await vi.waitFor(() => expect(device.calls.unsubscribePowerStatus).toHaveLength(1))

    const failureDevice = new FakeDevicePort()
    failureDevice.unsubscribeResult = failed('unsubscribePowerStatus')
    const failureEvents: LogEvent[] = []
    const failureFixture = createDisplayRuntime({device: failureDevice, events: failureEvents})
    await failureFixture.runtime.start()
    expect(releaseRuntimeForTest(failureFixture.runtime)).toBeGreaterThan(0)
    await vi.waitFor(() => expect(failureEvents.find(event => event.event === 'power-bridge.unsubscribe-failed')).toBeDefined())
    expect(failureEvents.find(event => event.event === 'power-bridge.unsubscribe-failed')?.data).toMatchObject({
      status: 'failed',
      capability: 'unsubscribePowerStatus',
      errorCode: 'TEST_DEVICE_FAILURE',
      retryable: true,
    })

    const timeoutDevice = new FakeDevicePort()
    timeoutDevice.unsubscribeResult = Object.freeze({
      status: 'timed-out' as const,
      port: 'device' as const,
      capability: 'unsubscribePowerStatus',
      timeoutMs: 1000,
    })
    const timeoutEvents: LogEvent[] = []
    const timeoutFixture = createDisplayRuntime({device: timeoutDevice, events: timeoutEvents})
    await timeoutFixture.runtime.start()
    expect(releaseRuntimeForTest(timeoutFixture.runtime)).toBeGreaterThan(0)
    await vi.waitFor(() => expect(timeoutEvents.find(event => event.event === 'power-bridge.unsubscribe-failed')).toBeDefined())
    expect(timeoutEvents.find(event => event.event === 'power-bridge.unsubscribe-failed')?.data).toMatchObject({
      status: 'timed-out',
      capability: 'unsubscribePowerStatus',
      timeoutMs: 1000,
    })

    const unavailableDevice = new FakeDevicePort()
    unavailableDevice.unsubscribeResult = unavailable('unsubscribePowerStatus')
    const unavailableEvents: LogEvent[] = []
    const unavailableFixture = createDisplayRuntime({device: unavailableDevice, events: unavailableEvents})
    await unavailableFixture.runtime.start()
    expect(releaseRuntimeForTest(unavailableFixture.runtime)).toBeGreaterThan(0)
    await vi.waitFor(() => expect(unavailableEvents.find(event => event.event === 'power-bridge.unsubscribe-failed')).toBeDefined())
    expect(unavailableEvents.find(event => event.event === 'power-bridge.unsubscribe-failed')?.data).toMatchObject({
      status: 'unavailable',
      capability: 'unsubscribePowerStatus',
      reason: 'ADAPTER_NOT_INJECTED',
    })

    const rejectingDevice = new FakeDevicePort()
    rejectingDevice.unsubscribeError = new Error('unsubscribe rejected in test')
    const rejectingEvents: LogEvent[] = []
    const rejectingFixture = createDisplayRuntime({device: rejectingDevice, events: rejectingEvents})
    await rejectingFixture.runtime.start()
    expect(releaseRuntimeForTest(rejectingFixture.runtime)).toBeGreaterThan(0)
    await vi.waitFor(() => expect(rejectingEvents.find(event => event.event === 'power-bridge.unsubscribe-rejected')).toBeDefined())
    expect(rejectingEvents.find(event => event.event === 'power-bridge.unsubscribe-rejected')?.data).toMatchObject({
      errorType: 'Error',
    })
  })
})
