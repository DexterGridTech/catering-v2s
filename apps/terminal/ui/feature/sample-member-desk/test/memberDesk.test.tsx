import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import {createElement} from 'react'
import {describe, expect, it} from 'vitest'
import type {LogEvent, LogWriteInput, LogWriteResult, LoggerPort} from '@catering-v2s/kernel-base-platform-ports'
import type {Runtime} from '@catering-v2s/kernel-base-runtime'
import {
  createRendererCatalog,
  RenderProvider,
} from '@catering-v2s/ui-base-render'
import type {RenderProviderProps} from '@catering-v2s/ui-base-render'
import {createUiCatalog} from '@catering-v2s/kernel-base-ui-state'
import {sampleMemberDeskAssembly} from '../src/index'
import {CustomerMember} from '../src/components/CustomerMember'
import {MemberList} from '../src/components/MemberList'

type RuntimeStateRoot = ReturnType<Runtime['getState']>

const createLogger = (): Readonly<{readonly logger: LoggerPort; readonly events: LogWriteInput[]}> => {
  const events: LogWriteInput[] = []
  const write = (input: LogWriteInput): LogWriteResult => {
    events.push(input)
    return {status: 'succeeded', value: {} as LogEvent, completedAt: 0}
  }
  const logger: LoggerPort = {
    debug: write,
    info: write,
    warn: write,
    error: write,
    scope: () => logger,
    withContext: () => logger,
  }
  return {logger, events}
}

const createStateSource = (root: RuntimeStateRoot) => ({
  getStatus: () => 'started' as const,
  getState: () => root,
  subscribe: (_listener: () => void) => () => undefined,
})

const mount = (element: ReturnType<typeof createElement>): ReactTestRenderer => {
  let renderer: ReactTestRenderer | undefined
  act(() => { renderer = create(element) })
  return renderer!
}

const expectTextValue = (renderer: ReactTestRenderer, testID: string, value: string): void => {
  expect(renderer.root.findAllByProps({testID}).some(node =>
    node.children?.filter((child): child is string => typeof child === 'string').join('').includes(value) ?? false,
  )).toBe(true)
}

const memberRoot = (
  pending: Readonly<{name: string; phone: string}>,
  members: readonly Readonly<{memberId: string; name: string; phone: string; registeredAt: number}>[] = [],
): RuntimeStateRoot => Object.freeze({
  'kernel.base.runtime.instance-mode': Object.freeze({instanceMode: 'MASTER'}),
  'kernel.base.display-context.display-role': Object.freeze({displayRole: 'CHIEF'}),
  'kernel.feature.sample-member-registry.members': Object.freeze({
    members: Object.freeze(members),
    pending: Object.freeze(pending),
  }),
}) as RuntimeStateRoot

describe('sample member desk UI feature', () => {
  it('exports one assembly description with six exact parts and two transient variables', () => {
    expect(sampleMemberDeskAssembly.parts.map(part => part.catalogEntry.partKey)).toEqual([
      'sample.desk.member-list',
      'sample.desk.member-form',
      'sample.desk.waiting-confirm',
      'sample.desk.registry-notice',
      'sample.desk.customer-welcome',
      'sample.desk.customer-member',
    ])
    expect(sampleMemberDeskAssembly.variables.map(variable => [variable.key, variable.persistIntent])).toEqual([
      ['sample.member.name', 'never'],
      ['sample.member.phone', 'never'],
    ])
  })

  it('reads confirm data through the owner selector and renders the two actions', () => {
    const {logger} = createLogger()
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: createStateSource(memberRoot({name: 'Alice', phone: '010-1234-5678'})),
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        dispatchCommand: (async () => ({
          requestId: null,
          commandId: 'command_test' as never,
          status: 'completed' as const,
          actorResults: [],
        })) as RenderProviderProps['dispatchCommand'],
        selectUiVariable: (_root, declaration) => declaration.defaultValue,
      },
      createElement(CustomerMember, {mode: 'confirm'}),
    ))

    expectTextValue(renderer, 'sample.desk.customer-member:name', 'Alice')
    expectTextValue(renderer, 'sample.desk.customer-member:phone', '010-1234-5678')
    expect(renderer.root.findByProps({testID: 'sample.desk.customer-member:confirm'})).toBeDefined()
    expect(renderer.root.findByProps({testID: 'sample.desk.customer-member:reject'})).toBeDefined()
    act(() => { renderer.unmount() })
  })

  it('passes the approved member-list row testID into the feature-owned MemberRow', () => {
    const {logger} = createLogger()
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: createStateSource(memberRoot(
          {name: 'Pending', phone: '010-0000-0000'},
          [{memberId: 'member-1', name: 'Alice', phone: '010-1234-5678', registeredAt: 1}],
        )),
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        dispatchCommand: (async () => ({
          requestId: null,
          commandId: 'command_test' as never,
          status: 'completed' as const,
          actorResults: [],
        })) as RenderProviderProps['dispatchCommand'],
        selectUiVariable: (_root, declaration) => declaration.defaultValue,
      },
      createElement(MemberList),
    ))

    expect(renderer.root.findByProps({testID: 'sample.desk.member-list:row'})).toBeDefined()
    expectTextValue(renderer, 'sample.desk.member-list:row:content', 'Alice 010-1234-5678')
    act(() => { renderer.unmount() })
  })

  it('diagnoses infrastructure rejection from a customer decision without treating it as success', async () => {
    const {logger, events} = createLogger()
    const failure = new Error('ledger write failed')
    const dispatchCommand = (async () => { throw failure }) as RenderProviderProps['dispatchCommand']
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: createStateSource(memberRoot({name: 'Pending', phone: '010-0000-0000'})),
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        dispatchCommand,
        selectUiVariable: (_root, declaration) => declaration.defaultValue,
      },
      createElement(CustomerMember, {mode: 'confirm'}),
    ))

    const confirm = renderer.root.findByProps({testID: 'sample.desk.customer-member:confirm'})
    await act(async () => {
      await expect((confirm.props.onPress as () => Promise<unknown>)()).rejects.toBe(failure)
    })
    expect(events).toContainEqual(expect.objectContaining({
      category: 'ui.base.render',
      event: 'command-dispatch-rejected',
      data: {failure: 'promise-rejected'},
    }))
    act(() => { renderer.unmount() })
  })
})
