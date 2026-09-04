import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import {Text, TextInput, View} from 'react-native'
import {describe, expect, it} from 'vitest'
import {
  PrimitiveButton,
  PrimitiveContainer,
  PrimitiveHeading,
  PrimitiveInput,
  PrimitiveLabel,
  PrimitiveStatus,
  PrimitiveText,
} from '../src/index'

const mount = (element: Parameters<typeof create>[0]): ReactTestRenderer => {
  let renderer: ReactTestRenderer | undefined
  act(() => { renderer = create(element) })
  return renderer!
}

describe('ui primitives', () => {
  it('renders addressable native controls with required testIDs', () => {
    const renderer = mount(
      <PrimitiveContainer testID="sample:root">
        <PrimitiveHeading testID="sample:heading">标题</PrimitiveHeading>
        <PrimitiveLabel testID="sample:label" nativeID="sample:label">姓名</PrimitiveLabel>
        <PrimitiveInput testID="sample:input" accessibilityLabel="姓名" value="Alice" />
        <PrimitiveText testID="sample:text">内容</PrimitiveText>
        <PrimitiveStatus testID="sample:status">状态</PrimitiveStatus>
        <PrimitiveButton testID="sample:button">确定</PrimitiveButton>
      </PrimitiveContainer>,
    )

    expect(renderer.root.findByProps({testID: 'sample:root'})).toBeDefined()
    expect(renderer.root.findByProps({testID: 'sample:heading'})).toBeDefined()
    expect(renderer.root.findByProps({testID: 'sample:label'})).toBeDefined()
    expect(renderer.root.findByProps({testID: 'sample:label'}).props.nativeID).toBe('sample:label')
    expect(renderer.root.findByProps({testID: 'sample:input'})).toBeDefined()
    expect(renderer.root.findByProps({testID: 'sample:text'})).toBeDefined()
    expect(renderer.root.findByProps({testID: 'sample:status'})).toBeDefined()
    expect(renderer.root.findByProps({testID: 'sample:button'})).toBeDefined()
    expect(renderer.root.findAllByType(View).length).toBeGreaterThan(0)
    expect(renderer.root.findAllByType(Text).length).toBeGreaterThan(0)
    expect(renderer.root.findAllByType(TextInput).length).toBeGreaterThan(0)
    act(() => { renderer.unmount() })
  })

  it('rejects an empty addressability key', () => {
    expect(() => mount(<PrimitiveText testID=" ">内容</PrimitiveText>)).toThrow('testID')
  })

  it('keeps text accessibility roles within feedback semantics', () => {
    const renderer = mount(
      <PrimitiveContainer testID="sample:role-root">
        <PrimitiveText testID="sample:alert" accessibilityRole="alert">提示</PrimitiveText>
        <PrimitiveText testID="sample:status" accessibilityRole="status">状态</PrimitiveText>
      </PrimitiveContainer>,
    )

    const textByTestID = (testID: string) => renderer.root
      .findAllByType(Text)
      .find(node => node.props.testID === testID)
    expect(textByTestID('sample:alert')?.props.role).toBe('alert')
    expect(textByTestID('sample:status')?.props.role).toBe('status')
    act(() => { renderer.unmount() })
  })

  it('rejects control roles at the PrimitiveText type boundary', () => {
    // @ts-expect-error PrimitiveText only accepts feedback roles; controls use dedicated primitives.
    const invalidRole = <PrimitiveText testID="sample:invalid-role" accessibilityRole="button">错误</PrimitiveText>
    void invalidRole
  })
})
