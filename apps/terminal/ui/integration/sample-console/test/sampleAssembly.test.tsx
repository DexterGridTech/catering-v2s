import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import {describe, expect, it} from 'vitest'
import {TextInput} from 'react-native'
import {createRequestId} from '@catering-v2s/kernel-base-contracts'
import {switchDisplayRoleCommand, switchInstanceModeCommand} from '@catering-v2s/kernel-base-display-context'
import {releaseRuntimeForTest} from '@catering-v2s/kernel-base-runtime/testing'
import {
  openLayerCommand,
  selectLayers,
  selectScreen,
  showScreenCommand,
} from '@catering-v2s/kernel-base-ui-state'
import {createUiCatalog, selectAvailableParts} from '@catering-v2s/kernel-base-ui-state'
import {
  confirmMemberCommand,
  rejectMemberCommand,
  selectMembers,
  selectPendingMember,
  submitMemberCommand,
} from '@catering-v2s/kernel-feature-sample-member-registry'
import {
  memberRegistrationAbandonedCommand,
  memberRegistrationRetryRequestedCommand,
  memberSubmissionWithdrawnCommand,
} from '../../../../ui/feature/sample-member-desk/src/features/commands/commands'
import {createSampleAssembly, createSurfaceForDisplayIndex} from '../src'
import {createSampleDefinedParts} from '../src/assembly/assembly'
import {adminTestIds} from '@catering-v2s/ui-base-admin-shell'
import {createTestPlatformPorts} from './support'

const LANDSCAPE_PRIMARY_FRAME = {width: 1280, height: 800} as const
const LANDSCAPE_SECONDARY_FRAME = {width: 960, height: 540} as const

type HostMeasurementSnapshot = Readonly<{
  readonly stableHostLogicalSize: Readonly<{readonly width: number; readonly height: number}>
  readonly isHostPrimaryDisplay: boolean
}>

type HostSourceHandle = Readonly<{
  readonly getSnapshot: () => HostMeasurementSnapshot
  readonly subscribe: (listener: (snapshot: HostMeasurementSnapshot) => void) => () => void
  readonly emit: (snapshot: HostMeasurementSnapshot) => void
}>

const createHostSource = (isHostPrimaryDisplay: boolean): HostSourceHandle => {
  let currentSnapshot: HostMeasurementSnapshot = Object.freeze({
    stableHostLogicalSize: Object.freeze({width: 1280, height: 800}),
    isHostPrimaryDisplay,
  })
  const listeners = new Set<(snapshot: HostMeasurementSnapshot) => void>()
  return Object.freeze({
    getSnapshot: () => currentSnapshot,
    subscribe: (listener: (snapshot: HostMeasurementSnapshot) => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    emit: (snapshot: HostMeasurementSnapshot) => {
      currentSnapshot = Object.freeze({
        stableHostLogicalSize: Object.freeze({
          width: snapshot.stableHostLogicalSize.width,
          height: snapshot.stableHostLogicalSize.height,
        }),
        isHostPrimaryDisplay: snapshot.isHostPrimaryDisplay,
      })
      for (const listener of listeners) listener(currentSnapshot)
    },
  })
}

const mount = (
  element: Parameters<typeof create>[0],
  frameLayout: Readonly<{readonly width: number; readonly height: number}> = LANDSCAPE_SECONDARY_FRAME,
): ReactTestRenderer => {
  let renderer: ReactTestRenderer | undefined
  act(() => { renderer = create(element) })
  const frames = renderer!.root.findAllByProps({testID: 'ui.base.input:surface-frame'})
  act(() => {
    for (const frame of frames) {
      ;(frame.props.onLayout as (event: unknown) => void)({nativeEvent: {layout: frameLayout}})
    }
  })
  return renderer!
}

const press = (renderer: ReactTestRenderer, testID: string): (() => unknown) => {
  const instance = renderer.root.findByProps({testID}) as unknown as Readonly<{
    readonly props: Readonly<{readonly onPress: () => unknown}>
  }>
  return instance.props.onPress
}

const pressLauncher = (renderer: ReactTestRenderer): void => {
  const launcher = renderer.root.findByProps({testID: adminTestIds.launcher}) as unknown as Readonly<{
    readonly props: Readonly<{
      readonly onPress: (event: Readonly<{readonly nativeEvent: Readonly<{readonly locationX: number; readonly locationY: number}>}>) => void
    }>
  }>
  launcher.props.onPress({nativeEvent: {locationX: 1, locationY: 1}})
}

type TextInputTestInstance = Readonly<{
  readonly props: Readonly<{
    readonly testID?: unknown
    readonly value?: unknown
    readonly onFocus: (event: Readonly<{readonly nativeEvent: Readonly<Record<string, never>>}>) => void
  }>
}>

const findTextInput = (renderer: ReactTestRenderer, testID: string): TextInputTestInstance => {
  const root = renderer.root as unknown as Readonly<{
    readonly findAllByType: (type: unknown) => readonly TextInputTestInstance[]
  }>
  const input = root.findAllByType(TextInput).find(node => node.props.testID === testID)
  if (input === undefined) throw new Error(`Missing TextInput ${testID}`)
  return input
}

describe('sample-console real assembly', () => {
  it('exposes the injected sample section through the same catalog projection', () => {
    const context = {
      displayMode: 'PRIMARY' as const,
      workspace: 'MAIN' as const,
      instanceMode: 'MASTER' as const,
      surfaceForm: 'laptop' as const,
    }
    const withSample = createUiCatalog(createSampleDefinedParts().map(({catalogEntry}) => catalogEntry))
    const withoutSample = createUiCatalog(createSampleDefinedParts(false).map(({catalogEntry}) => catalogEntry))
    expect(selectAvailableParts(withSample, 'admin.sections', context).map(entry => entry.partKey)).toContain('sample.console.admin-test')
    expect(selectAvailableParts(withoutSample, 'admin.sections', context).map(entry => entry.partKey)).not.toContain('sample.console.admin-test')
  })

  it('opens admin through the real gesture/keypad controls and close/reopen returns to login', async () => {
    const hostSource = createHostSource(true)
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-admin-controls-test-${Date.now()}`,
      surfaceHostSourcesByDisplayIndex: {0: hostSource},
    })
    let renderer: ReactTestRenderer | undefined
    try {
      renderer = mount(createSurfaceForDisplayIndex(assembly, 0), LANDSCAPE_PRIMARY_FRAME)
      for (let index = 0; index < 5; index += 1) {
        await act(async () => {
          pressLauncher(renderer!)
          await new Promise(resolve => setTimeout(resolve, 0))
        })
      }
      expect(renderer.root.findByProps({testID: adminTestIds.login})).toBeDefined()
      expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard:text-1'})).toBeDefined()
      for (const digit of ['1', '2', '3', '4', '5', '6']) {
        await act(async () => {
          press(renderer!, `ui.base.input:virtual-keyboard:text-${digit}`)()
          await new Promise(resolve => setTimeout(resolve, 0))
        })
      }
      await act(async () => {
        press(renderer!, adminTestIds.verify)()
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      expect(renderer.root.findByProps({testID: adminTestIds.shell})).toBeDefined()
      expect(renderer.root.findByProps({testID: adminTestIds.sections.sampleConsole})).toBeDefined()
      await act(async () => {
        press(renderer!, adminTestIds.sections.runtime)()
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      expect(renderer.root.findByProps({testID: 'admin.console.runtime'})).toBeDefined()
      expect(renderer.root.findAllByProps({testID: 'sample.console.admin-test'})).toHaveLength(0)
      await act(async () => {
        hostSource.emit({
          stableHostLogicalSize: {width: 1000, height: 700},
          isHostPrimaryDisplay: true,
        })
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      expect(renderer.root.findByProps({testID: adminTestIds.shell})).toBeDefined()
      expect(renderer.root.findByProps({testID: 'admin.console.runtime'})).toBeDefined()
      await act(async () => {
        press(renderer!, adminTestIds.close)()
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      expect(renderer.root.findAllByProps({testID: adminTestIds.shell})).toHaveLength(0)
      for (let index = 0; index < 5; index += 1) {
        await act(async () => {
          pressLauncher(renderer!)
          await new Promise(resolve => setTimeout(resolve, 0))
        })
      }
      expect(renderer.root.findByProps({testID: adminTestIds.login})).toBeDefined()
    } finally {
      if (renderer !== undefined) act(() => { renderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('keeps admin keyboard ownership while business input remains underneath and restores it on close', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-admin-focus-scope-test-${Date.now()}`,
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true)},
    })
    let renderer: ReactTestRenderer | undefined
    try {
      await assembly.runtime.dispatchCommand(showScreenCommand, {
        displayMode: 'PRIMARY',
        containerKey: 'main',
        partKey: 'sample.desk.member-form',
      }, {
        requestId: createRequestId(),
        routeContext: {workspace: 'MAIN', instanceMode: 'MASTER', displayMode: 'PRIMARY'},
      })
      renderer = mount(createSurfaceForDisplayIndex(assembly, 0), LANDSCAPE_PRIMARY_FRAME)

      const businessInput = findTextInput(renderer, 'sample.desk.member-form:phone')
      act(() => { businessInput.props.onFocus({nativeEvent: {}}) })
      await act(async () => {
        press(renderer!, 'ui.base.input:virtual-keyboard:text-3')()
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      expect(findTextInput(renderer, 'sample.desk.member-form:phone').props.value).toBe('3')

      for (let index = 0; index < 5; index += 1) {
        await act(async () => {
          pressLauncher(renderer!)
          await new Promise(resolve => setTimeout(resolve, 0))
        })
      }
      expect(renderer.root.findByProps({testID: adminTestIds.login})).toBeDefined()

      const businessInputUnderAdmin = findTextInput(renderer, 'sample.desk.member-form:phone')
      act(() => { businessInputUnderAdmin.props.onFocus({nativeEvent: {}}) })
      await act(async () => {
        press(renderer!, 'ui.base.input:virtual-keyboard:text-1')()
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      expect(renderer.root.findByProps({testID: `${adminTestIds.password}:digit:0`}).props.children).toBe('•')
      expect(findTextInput(renderer, 'sample.desk.member-form:phone').props.value).toBe('3')

      await act(async () => {
        press(renderer!, adminTestIds.close)()
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      expect(renderer.root.findAllByProps({testID: adminTestIds.login})).toHaveLength(0)
      const restoredBusinessInput = findTextInput(renderer, 'sample.desk.member-form:phone')
      act(() => { restoredBusinessInput.props.onFocus({nativeEvent: {}}) })
      await act(async () => {
        press(renderer!, 'ui.base.input:virtual-keyboard:text-4')()
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      expect(findTextInput(renderer, 'sample.desk.member-form:phone').props.value).toBe('34')
    } finally {
      if (renderer !== undefined) act(() => { renderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('shows the effective fallback password only when runtime debug mode is enabled', async () => {
    const events: never[] = []
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({events}),
      persistenceKey: `sample-console-admin-debug-password-test-${Date.now()}`,
      startupDebugMode: true,
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true)},
    })
    let renderer: ReactTestRenderer | undefined
    try {
      renderer = mount(createSurfaceForDisplayIndex(assembly, 0), LANDSCAPE_PRIMARY_FRAME)
      for (let index = 0; index < 5; index += 1) {
        await act(async () => {
          pressLauncher(renderer!)
          await new Promise(resolve => setTimeout(resolve, 0))
        })
      }
      const debugPassword = renderer.root.findByProps({testID: adminTestIds.debugPassword})
      expect(debugPassword.props.children).toContain('123456')
      expect(events.some(event => String((event as {readonly event?: unknown}).event) === 'sample.runtime-facts-resolved')).toBe(true)
      expect(events.some(event => JSON.stringify(event).includes('123456'))).toBe(false)
    } finally {
      if (renderer !== undefined) act(() => { renderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('does not expose the admin launcher on a physical non-host surface', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-admin-secondary-test-${Date.now()}`,
      surfaceHostSourcesByDisplayIndex: {1: createHostSource(false)},
    })
    let renderer: ReactTestRenderer | undefined
    try {
      renderer = mount(createSurfaceForDisplayIndex(assembly, 1))
      expect(renderer.root.findAllByProps({testID: adminTestIds.launcher})).toHaveLength(0)
    } finally {
      if (renderer !== undefined) act(() => { renderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('cleans only admin state on a display identity replacement and recomputes canvas geometry', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-admin-replacement-test-${Date.now()}`,
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true)},
    })
    let renderer: ReactTestRenderer | undefined
    try {
      await assembly.runtime.dispatchCommand(openLayerCommand, {
        displayMode: 'PRIMARY',
        layerId: 'business-layer',
        partKey: 'sample.desk.waiting-confirm',
      }, {requestId: createRequestId()})
      renderer = mount(createSurfaceForDisplayIndex(assembly, 0), LANDSCAPE_PRIMARY_FRAME)
      for (let index = 0; index < 5; index += 1) {
        await act(async () => {
          pressLauncher(renderer!)
          await new Promise(resolve => setTimeout(resolve, 0))
        })
      }
      for (const digit of ['1', '2', '3', '4', '5', '6']) {
        await act(async () => {
          press(renderer!, `ui.base.input:virtual-keyboard:text-${digit}`)()
          await new Promise(resolve => setTimeout(resolve, 0))
        })
      }
      await act(async () => {
        press(renderer!, adminTestIds.verify)()
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      expect(selectLayers(assembly.runtime.getState(), 'PRIMARY').map(layer => layer.layerId)).toEqual(expect.arrayContaining([
        'business-layer',
        'admin.console.layer',
      ]))

      await act(async () => {
        await assembly.runtime.dispatchCommand(switchInstanceModeCommand, {instanceMode: 'SLAVE'}, {
          requestId: createRequestId(),
          routeContext: {displayMode: 'PRIMARY'},
        })
        await assembly.runtime.dispatchCommand(switchDisplayRoleCommand, {displayRole: 'VICE'}, {
          requestId: createRequestId(),
          routeContext: {displayMode: 'PRIMARY'},
        })
        ;(renderer as unknown as {readonly update: (element: ReturnType<typeof createSurfaceForDisplayIndex>) => void}).update(createSurfaceForDisplayIndex(assembly, 0))
        await new Promise(resolve => setTimeout(resolve, 0))
      })

      expect(renderer.root.findAllByProps({testID: adminTestIds.shell})).toHaveLength(0)
      expect(selectLayers(assembly.runtime.getState(), 'PRIMARY').map(layer => layer.layerId)).toEqual(['business-layer'])
      const canvas = renderer.root.findByProps({testID: 'ui-base-render:surface-host-canvas'})
      expect(canvas.props.style).toEqual(expect.arrayContaining([
        expect.objectContaining({width: 960, height: 540}),
      ]))
    } finally {
      if (renderer !== undefined) act(() => { renderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })
  it('reads device identity once at assembly startup and exposes only the normalized fact', async () => {
    let deviceInfoCalls = 0
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({
        onGetDeviceInfo: () => { deviceInfoCalls += 1 },
        deviceInfo: {
          deviceId: ' DEVICE-001 ',
          manufacturer: 'Example',
          model: 'Terminal',
          systemName: 'Android',
          systemVersion: '15',
          logicalProcessorCount: 8,
        },
      }),
      persistenceKey: `sample-console-device-identity-test-${Date.now()}`,
    })
    try {
      expect(deviceInfoCalls).toBe(1)
      expect(assembly.runtimeFacts.deviceIdentity).toEqual({available: true, deviceId: 'DEVICE-001'})
      expect(Object.isFrozen(assembly.runtimeFacts)).toBe(true)
      expect(Object.isFrozen(assembly.runtimeFacts.deviceIdentity)).toBe(true)
      createSurfaceForDisplayIndex(assembly, 0)
      createSurfaceForDisplayIndex(assembly, 0)
      expect(deviceInfoCalls).toBe(1)
    } finally {
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('starts the single assembly with all nine input modules and the runtime module', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-test-${Date.now()}`,
    })
    try {
      expect(assembly.runtime.status).toBe('started')
      expect(assembly.runtime.descriptors.map(descriptor => descriptor.moduleName)).toEqual(expect.arrayContaining([
        'kernel.base.runtime',
        'kernel.base.contracts',
        'kernel.base.platform-ports',
        'kernel.base.state',
        'kernel.base.display-context',
        'kernel.base.ui-state',
        'kernel.feature.sample-staff-session',
        'kernel.feature.sample-member-registry',
        'ui.feature.sample-staff-auth',
        'ui.feature.sample-member-desk',
      ]))
      expect(assembly.runtime.descriptors).toHaveLength(10)
    } finally {
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('renders a real catalog part through RenderProvider and SurfaceRoot', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-render-test-${Date.now()}`,
    })
    let renderer: ReactTestRenderer | undefined
    try {
      renderer = mount(createSurfaceForDisplayIndex(assembly, 0), LANDSCAPE_PRIMARY_FRAME)
      expect(renderer.root.findByProps({testID: 'sample.auth.login'})).toBeDefined()
      expect(renderer.root.findByProps({testID: 'sample.auth.login:submit'})).toBeDefined()
    } finally {
      if (renderer !== undefined) act(() => { renderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('maps the secondary display index through display-context ownership', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-secondary-render-test-${Date.now()}`,
    })
    let renderer: ReactTestRenderer | undefined
    try {
      const result = await assembly.runtime.dispatchCommand(showScreenCommand, {
        displayMode: 'SECONDARY',
        containerKey: 'main',
        partKey: 'sample.desk.customer-welcome',
      }, {
        requestId: createRequestId(),
        routeContext: {workspace: 'MAIN', instanceMode: 'MASTER', displayMode: 'PRIMARY'},
      })
      expect(result.status).toBe('completed')
      renderer = mount(createSurfaceForDisplayIndex(assembly, 1), LANDSCAPE_SECONDARY_FRAME)
      expect(renderer.root.findByProps({testID: 'sample.desk.customer-welcome'})).toBeDefined()
    } finally {
      if (renderer !== undefined) act(() => { renderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('closes the dual-screen age journey on withdraw before a late confirm can register', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 2}),
      persistenceKey: `sample-console-age-withdraw-test-${Date.now()}`,
    })
    let primaryRenderer: ReactTestRenderer | undefined
    let secondaryRenderer: ReactTestRenderer | undefined
    try {
      await act(async () => {
        await assembly.runtime.dispatchCommand(submitMemberCommand, {
          name: 'Alice',
          phone: '010-1234-5678',
        }, {requestId: createRequestId()})
      })
      primaryRenderer = mount(createSurfaceForDisplayIndex(assembly, 0), LANDSCAPE_PRIMARY_FRAME)
      secondaryRenderer = mount(createSurfaceForDisplayIndex(assembly, 1), LANDSCAPE_SECONDARY_FRAME)

      const ageInput = findTextInput(secondaryRenderer, 'sample.desk.customer-member:age')
      act(() => { ageInput.props.onFocus({nativeEvent: {}}) })
      expect(secondaryRenderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard'})).toBeDefined()
      act(() => {
        press(secondaryRenderer!, 'ui.base.input:virtual-keyboard:text-3')()
      })

      await act(async () => { await press(primaryRenderer!, 'sample.desk.waiting-confirm:withdraw')() })
      expect(primaryRenderer.root.findByProps({testID: 'sample.desk.withdraw-confirm:withdraw'})).toBeDefined()
      await act(async () => { await press(primaryRenderer!, 'sample.desk.withdraw-confirm:withdraw')() })

      expect(selectPendingMember(assembly.runtime.getState())).toBeNull()
      expect(selectScreen(assembly.runtime.getState(), 'SECONDARY', 'main')).toMatchObject({
        partKey: 'sample.desk.customer-welcome',
      })
      expect(selectLayers(assembly.runtime.getState(), 'PRIMARY')).toHaveLength(0)
      expect(secondaryRenderer.root.findByProps({testID: 'sample.desk.customer-welcome'})).toBeDefined()

      const membersBeforeLateConfirm = selectMembers(assembly.runtime.getState())
      await act(async () => {
        await assembly.runtime.dispatchCommand(confirmMemberCommand, {age: 3}, {requestId: createRequestId()})
      })
      expect(selectPendingMember(assembly.runtime.getState())).toBeNull()
      expect(selectMembers(assembly.runtime.getState())).toEqual(membersBeforeLateConfirm)
    } finally {
      if (primaryRenderer !== undefined) act(() => { primaryRenderer!.unmount() })
      if (secondaryRenderer !== undefined) act(() => { secondaryRenderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('confirms a locally edited secondary age into the member fact only at decision time', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 2}),
      persistenceKey: `sample-console-age-confirm-test-${Date.now()}`,
    })
    let secondaryRenderer: ReactTestRenderer | undefined
    try {
      await assembly.runtime.dispatchCommand(submitMemberCommand, {
        name: 'Alice',
        phone: '010-1234-5678',
      }, {requestId: createRequestId()})
      secondaryRenderer = mount(createSurfaceForDisplayIndex(assembly, 1))
      const ageInput = findTextInput(secondaryRenderer, 'sample.desk.customer-member:age')
      act(() => { ageInput.props.onFocus({nativeEvent: {}}) })
      await act(async () => { await press(secondaryRenderer!, 'ui.base.input:virtual-keyboard:text-3')() })
      await act(async () => { await press(secondaryRenderer!, 'sample.desk.customer-member:confirm')() })
      expect(selectMembers(assembly.runtime.getState())).toContainEqual(expect.objectContaining({
        name: 'Alice',
        phone: '010-1234-5678',
        age: 3,
      }))
      expect(selectPendingMember(assembly.runtime.getState())).toBeNull()
    } finally {
      if (secondaryRenderer !== undefined) act(() => { secondaryRenderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('does not persist locally edited age when the customer rejects', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 2}),
      persistenceKey: `sample-console-age-reject-test-${Date.now()}`,
    })
    let secondaryRenderer: ReactTestRenderer | undefined
    try {
      await assembly.runtime.dispatchCommand(submitMemberCommand, {
        name: 'Alice',
        phone: '010-1234-5678',
      }, {requestId: createRequestId()})
      secondaryRenderer = mount(createSurfaceForDisplayIndex(assembly, 1))
      const ageInput = findTextInput(secondaryRenderer, 'sample.desk.customer-member:age')
      act(() => { ageInput.props.onFocus({nativeEvent: {}}) })
      await act(async () => { await press(secondaryRenderer!, 'ui.base.input:virtual-keyboard:text-4')() })
      await act(async () => { await press(secondaryRenderer!, 'sample.desk.customer-member:reject')() })
      expect(selectMembers(assembly.runtime.getState())).toEqual([])
      expect(selectPendingMember(assembly.runtime.getState())).toEqual({
        name: 'Alice',
        phone: '010-1234-5678',
      })
    } finally {
      if (secondaryRenderer !== undefined) act(() => { secondaryRenderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('retains rejected pending data for retry and clears it only when the notice is abandoned', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 2}),
      persistenceKey: `sample-console-retry-abandon-test-${Date.now()}`,
    })
    try {
      await assembly.runtime.dispatchCommand(submitMemberCommand, {
        name: 'Carol',
        phone: '010-1111-2222',
      }, {requestId: createRequestId()})
      await assembly.runtime.dispatchCommand(rejectMemberCommand, {}, {requestId: createRequestId()})
      expect(selectPendingMember(assembly.runtime.getState())).toEqual({
        name: 'Carol',
        phone: '010-1111-2222',
      })

      await assembly.runtime.dispatchCommand(memberRegistrationRetryRequestedCommand, {
        reasonCode: 'customer-rejected',
      }, {requestId: createRequestId()})
      expect(selectScreen(assembly.runtime.getState(), 'PRIMARY', 'main')).toMatchObject({
        partKey: 'sample.desk.member-form',
      })
      expect(selectPendingMember(assembly.runtime.getState())).toEqual({
        name: 'Carol',
        phone: '010-1111-2222',
      })

      await assembly.runtime.dispatchCommand(rejectMemberCommand, {}, {requestId: createRequestId()})
      await assembly.runtime.dispatchCommand(memberRegistrationAbandonedCommand, {}, {requestId: createRequestId()})
      expect(selectPendingMember(assembly.runtime.getState())).toBeNull()
      expect(selectScreen(assembly.runtime.getState(), 'PRIMARY', 'main')).toMatchObject({
        partKey: 'sample.desk.member-list',
      })
      expect(selectLayers(assembly.runtime.getState(), 'PRIMARY')).toHaveLength(0)
    } finally {
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('returns the single-surface hand-back to the member form without a confirmation layer', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 1}),
      persistenceKey: `sample-console-hand-back-test-${Date.now()}`,
    })
    try {
      await assembly.runtime.dispatchCommand(submitMemberCommand, {
        name: 'Alice',
        phone: '010-1234-5678',
      }, {requestId: createRequestId()})
      expect(selectScreen(assembly.runtime.getState(), 'PRIMARY', 'main')).toMatchObject({
        partKey: 'sample.desk.customer-member',
        props: {mode: 'handheld-confirm'},
      })

      await assembly.runtime.dispatchCommand(memberSubmissionWithdrawnCommand, {}, {requestId: createRequestId()})
      expect(selectPendingMember(assembly.runtime.getState())).toBeNull()
      expect(selectScreen(assembly.runtime.getState(), 'PRIMARY', 'main')).toMatchObject({
        partKey: 'sample.desk.member-form',
      })
    } finally {
      releaseRuntimeForTest(assembly.runtime)
    }
  })
})
