import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {FakeWebStorage} from './support'

vi.mock('expo-status-bar', () => ({StatusBar: () => null}))

vi.mock('../src', async importOriginal => {
  const actual = await importOriginal<typeof import('../src')>()
  return {
    ...actual,
    createSampleAssembly: vi.fn(actual.createSampleAssembly),
  }
})

const nextTurn = async (): Promise<void> => {
  await new Promise<void>(resolve => { setTimeout(resolve, 0) })
}

const waitFor = async (renderer: ReactTestRenderer, predicate: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (predicate()) return
    await act(nextTurn)
  }
  expect(predicate()).toBe(true)
}

describe('test-expo host shell', () => {
  let renderer: ReactTestRenderer | undefined

  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: new FakeWebStorage(),
    })
  })

  afterEach(() => {
    if (renderer !== undefined) act(() => { renderer!.unmount() })
    renderer = undefined
    delete (globalThis as {localStorage?: Storage}).localStorage
  })

  it('mounts one surface, toggles to two, and reuses the same assembly', async () => {
    const {default: App} = await import('../test-expo/App')
    const assemblyModule = await import('../src')
    const createAssembly = vi.mocked(assemblyModule.createSampleAssembly)
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await act(async () => {
      renderer = create(<App />)
      await nextTurn()
    })

    await waitFor(renderer!, () => renderer!.root.findAllByProps({testID: 'sample-console:test-expo:surface:PRIMARY'}).length > 0)
    expect(renderer!.root.findAllByProps({testID: 'sample-console:test-expo:surface:SECONDARY'})).toHaveLength(0)
    expect(renderer!.root.findByProps({testID: 'sample-console:test-expo:surface-toggle'})).toBeDefined()
    expect(renderer!.root.findByProps({testID: 'sample-console:test-expo:header-status'})).toBeDefined()
    expect(renderer!.root.findByProps({testID: 'sample-console:test-expo:surface-summary:PRIMARY'})).toBeDefined()
    expect(renderer!.root.findByProps({testID: 'sample-console:test-expo:surface-summary:SECONDARY'})).toBeDefined()
    expect(renderer!.root.findAllByProps({children: 'TER Sample Console'})).toHaveLength(0)
    expect(renderer!.root.findAllByProps({testID: 'sample-console:test-expo:surface-topology'})).toHaveLength(0)
    expect(createAssembly).toHaveBeenCalledTimes(1)
    expect(info.mock.calls.map(([event]) => (event as {readonly event?: string}).event)).toContain('startup-ready')
    expect(info.mock.calls.map(([event]) => (event as {readonly event?: string}).event)).toContain('surface-decision-ready')
    expect(error.mock.calls.some(([event]) =>
      typeof event === 'object' && event !== null && (event as {readonly event?: string}).event === 'startup-failed',
    )).toBe(false)

    const toggle = renderer!.root.findByProps({testID: 'sample-console:test-expo:surface-toggle'})
    expect(typeof toggle.props.onPress).toBe('function')
    await act(async () => {
      ;(toggle.props.onPress as () => void)()
      await nextTurn()
    })

    await waitFor(renderer!, () => renderer!.root.findAllByProps({testID: 'sample-console:test-expo:surface:SECONDARY'}).length > 0)
    expect(renderer!.root.findAllByProps({testID: 'sample-console:test-expo:surface:PRIMARY'}).length).toBeGreaterThan(0)
    expect(createAssembly).toHaveBeenCalledTimes(1)
  })
})
