import {act, create} from 'react-test-renderer'
import {useCallback, useState} from 'react'
import {describe, expect, it, vi} from 'vitest'
import {VirtualKeyboard} from '../src/components/VirtualKeyboard'

const KeyboardHarness = () => {
  const [, setParentRevision] = useState(0)
  const onKey = useCallback(() => {
    setParentRevision(value => value + 1)
  }, [])
  return <VirtualKeyboard
    layout="numeric"
    height={250}
    frameWidth={962}
    cellWidth={310}
    shift={false}
    capsLock={false}
    hasNextField={false}
    onKey={onKey}
  />
}

describe('VirtualKeyboard render boundary', () => {
  it('keeps ordinary key handlers stable while the parent updates', () => {
    let renderer: ReturnType<typeof create> | undefined
    act(() => {
      renderer = create(<KeyboardHarness />)
    })
    const firstKey = renderer!.root.findByProps({testID: 'ui.base.input:virtual-keyboard:text-1'})
    const firstOnPress = firstKey.props.onPress
    act(() => {
      firstKey.props.onPress()
    })
    const secondKey = renderer!.root.findByProps({testID: 'ui.base.input:virtual-keyboard:text-1'})
    expect(secondKey.props.onPress).toBe(firstOnPress)
    act(() => { renderer!.unmount() })
  })

  it.each([
    ['full', ['digits', 'letters', 'actions'], ['text-1', 'text-a', 'shift', 'caps', 'backspace', 'complete']],
    ['alpha', ['letters', 'actions'], ['text-a', 'text-z', 'shift', 'backspace', 'complete']],
    ['numeric', ['digits', 'actions'], ['text-1', 'text-0', 'backspace', 'complete']],
    ['financial', ['digits', 'symbols', 'actions'], ['text-1', 'text-0', 'text--', 'text-.', 'backspace', 'complete']],
  ] as const)('renders %s rows through stable regions and key IDs', (layout, regions, keys) => {
    let renderer: ReturnType<typeof create> | undefined
    act(() => {
      renderer = create(
        <VirtualKeyboard
          layout={layout}
          height={320}
          frameWidth={962}
          cellWidth={100}
          shift={false}
          capsLock={false}
          hasNextField={false}
          onKey={() => undefined}
        />,
      )
    })

    for (const region of regions) {
      expect(renderer!.root.findByProps({testID: `ui.base.input:virtual-keyboard:region:${region}`})).toBeDefined()
    }
    expect(renderer!.root.findAllByProps({testID: 'ui.base.input:virtual-keyboard:region:symbols'}).length)
      .toBe((regions as readonly string[]).includes('symbols') ? 1 : 0)
    for (const key of keys) {
      expect(renderer!.root.findByProps({testID: `ui.base.input:virtual-keyboard:${key}`})).toBeDefined()
    }
    act(() => { renderer!.unmount() })
  })

  it('binds complete to the live next-field result instead of the layout definition', () => {
    const onKey = vi.fn()
    let renderer: ReturnType<typeof create> | undefined
    act(() => {
      renderer = create(
        <VirtualKeyboard
          layout="numeric"
          height={250}
          frameWidth={962}
          cellWidth={310}
          shift={false}
          capsLock={false}
          hasNextField={false}
          onKey={onKey}
        />,
      )
    })
    renderer!.root.findByProps({testID: 'ui.base.input:virtual-keyboard:complete'}).props.onPress()
    expect(onKey).toHaveBeenCalledWith({kind: 'complete', hasNextField: false})
    act(() => { renderer!.unmount() })
  })
})
