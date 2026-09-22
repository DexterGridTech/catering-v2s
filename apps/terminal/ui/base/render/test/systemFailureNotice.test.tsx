import {Pressable, View} from 'react-native'
import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import {createElement} from 'react'
import {describe, expect, it, vi} from 'vitest'
import {SystemFailureNotice, type SystemFailureNoticeProps} from '../src/index'

;(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true

const mount = (element: Parameters<typeof create>[0]): ReactTestRenderer => {
  let renderer: ReactTestRenderer | undefined
  act(() => { renderer = create(element) })
  return renderer!
}

const forbiddenRawNoticeProps: SystemFailureNoticeProps = {
  testIDPrefix: 'sample.system-notice',
  onDismiss: () => undefined,
  // @ts-expect-error Base notice must not accept feature-specific raw operation fields.
  operation: 'login',
}
void forbiddenRawNoticeProps

describe('SystemFailureNotice presentation contract', () => {
  it('preserves safe content and applies only the frozen layout profile', () => {
    const onDismiss = vi.fn()
    const renderer = mount(
      <SystemFailureNotice
        testIDPrefix="sample.system-notice"
        onDismiss={onDismiss}
        title="系统提示"
        message="操作没有完成，请重试"
        presentation={{
          rootStyle: {padding: 16, alignItems: 'stretch'},
          cardStyle: {width: '100%'},
          actionsOrientation: 'column',
          dismissButtonStyle: {width: '100%'},
        }}
      />,
    )

    const root = renderer.root.findAllByProps({testID: 'sample.system-notice'}).find(node => node.type === View)
    const card = renderer.root.findAllByProps({testID: 'sample.system-notice:card'}).find(node => node.type === View)
    const actions = renderer.root.findAllByProps({testID: 'sample.system-notice:actions'}).find(node => node.type === View)
    const dismiss = renderer.root.findAllByProps({testID: 'sample.system-notice:dismiss'}).find(node => node.type === Pressable)

    expect(root?.props.style).toEqual({padding: 16, alignItems: 'stretch'})
    expect(card?.props.style).toEqual([
      {width: '100%'},
      {maxHeight: '100%', minHeight: 0, overflow: 'hidden'},
    ])
    expect(actions?.props.className).toBe('w-full items-center gap-3')
    expect(dismiss?.props.style).toEqual([{width: '100%'}, undefined])
    expect(renderer.root.findByProps({testID: 'sample.system-notice:message'})).toBeDefined()
    act(() => { (dismiss?.props.onPress as (() => void) | undefined)?.() })
    expect(onDismiss).toHaveBeenCalledTimes(1)
    act(() => { renderer.unmount() })
  })

  it('keeps the default copy, alert role, children slot and dismiss label', () => {
    const onDismiss = vi.fn()
    const renderer = mount(
      <SystemFailureNotice
        testIDPrefix="sample.default-notice"
        onDismiss={onDismiss}
        dismissLabel="关闭"
      >
        {createElement('notice-child', {testID: 'sample.default-notice:child'}, '补充说明')}
      </SystemFailureNotice>,
    )

    expect(renderer.root.findByProps({testID: 'sample.default-notice:title'}).props.children).toBe('系统提示')
    expect(renderer.root.findByProps({testID: 'sample.default-notice:message'}).props.children).toBe('操作没有完成，请重试')
    expect(renderer.root.findByProps({testID: 'sample.default-notice:message'}).props.accessibilityRole).toBe('alert')
    expect(renderer.root.findByProps({testID: 'sample.default-notice:child'})).toBeDefined()
    const dismiss = renderer.root.findAllByProps({testID: 'sample.default-notice:dismiss'}).find(node => node.type === Pressable)
    expect(dismiss?.props.accessibilityLabel).toBe('关闭系统提示')
    expect(renderer.root.findAllByProps({children: '关闭'}).length).toBeGreaterThan(0)
    act(() => { (dismiss?.props.onPress as (() => void) | undefined)?.() })
    expect(onDismiss).toHaveBeenCalledTimes(1)
    act(() => { renderer.unmount() })
  })
})
