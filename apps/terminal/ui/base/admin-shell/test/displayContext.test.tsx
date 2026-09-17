import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import {afterEach, describe, expect, it, vi} from 'vitest'
import * as renderHooks from '@catering-v2s/ui-base-render'
import {DisplayContextSection} from '../src/components/sections/DisplayContextSection'
import type {AdminSectionProps} from '../src/types/adminSection'

const context = {
  catalogEntry: {title: '显示上下文'},
  runtimeFacts: {},
  surface: {},
  commandBoundary: {},
} as unknown as AdminSectionProps['context']

const findText = (renderer: ReactTestRenderer, text: string) => renderer.root.findAll(node => node.type === 'Text' && node.props.children === text)

const renderSection = (status: 'created' | 'started') => {
  vi.spyOn(renderHooks, 'useRenderStatus').mockReturnValue(status)
  vi.spyOn(renderHooks, 'useUiStateSelector').mockReturnValue(undefined)
  let renderer: ReactTestRenderer | undefined
  act(() => { renderer = create(<DisplayContextSection context={context} />) })
  return renderer!
}

afterEach(() => vi.restoreAllMocks())

describe('DisplayContextSection lifecycle boundary', () => {
  it('uses runtime status for lifecycle unavailability', () => {
    const renderer = renderSection('created')

    expect(findText(renderer, '运行状态尚未就绪')).toHaveLength(1)
    expect(findText(renderer, '显示上下文暂无数据')).toHaveLength(0)
    renderer.unmount()
  })

  it('keeps missing display data distinct from runtime unavailability after start', () => {
    const renderer = renderSection('started')

    expect(findText(renderer, '运行状态尚未就绪')).toHaveLength(0)
    expect(findText(renderer, '显示上下文暂无数据')).toHaveLength(1)
    renderer.unmount()
  })
})
