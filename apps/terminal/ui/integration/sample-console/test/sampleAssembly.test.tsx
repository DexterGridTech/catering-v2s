import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import {describe, expect, it} from 'vitest'
import {TextInput} from 'react-native'
import {createRequestId} from '@catering-v2s/kernel-base-contracts'
import {releaseRuntimeForTest} from '@catering-v2s/kernel-base-runtime/testing'
import {
  selectLayers,
  selectScreen,
  showScreenCommand,
} from '@catering-v2s/kernel-base-ui-state'
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
} from '../../../../ui/feature/sample-member-desk/src/commands'
import {createSampleAssembly, createSurfaceForDisplayIndex} from '../src'
import {createTestPlatformPorts} from './support'

const mount = (element: Parameters<typeof create>[0]): ReactTestRenderer => {
  let renderer: ReactTestRenderer | undefined
  act(() => { renderer = create(element) })
  const frames = renderer!.root.findAllByProps({testID: 'ui.base.input:surface-frame'})
  act(() => {
    for (const frame of frames) {
      ;(frame.props.onLayout as (event: unknown) => void)({nativeEvent: {layout: {width: 962, height: 541}}})
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

type TextInputTestInstance = Readonly<{
  readonly props: Readonly<{
    readonly testID?: unknown
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
      renderer = mount(createSurfaceForDisplayIndex(assembly, 0))
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
      renderer = mount(createSurfaceForDisplayIndex(assembly, 1))
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
      primaryRenderer = mount(createSurfaceForDisplayIndex(assembly, 0))
      secondaryRenderer = mount(createSurfaceForDisplayIndex(assembly, 1))

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
