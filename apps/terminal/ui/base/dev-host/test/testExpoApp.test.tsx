import {useEffect} from 'react'
import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import {Text} from 'react-native'
import {describe, expect, it, vi} from 'vitest'
import {createTestExpoApp, type TestExpoAssembly} from '../src'

type Lifecycle = Record<'PRIMARY' | 'SECONDARY', {mounts: number; unmounts: number}>

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

const SurfaceProbe = ({displayMode, lifecycle}: Readonly<{displayMode: 'PRIMARY' | 'SECONDARY'; lifecycle: Lifecycle}>) => {
  useEffect(() => {
    lifecycle[displayMode].mounts += 1
    return () => { lifecycle[displayMode].unmounts += 1 }
  }, [displayMode, lifecycle])
  return <Text testID={`probe:${displayMode}`}>{displayMode}</Text>
}

describe('ui.base.dev-host surface lifecycle', () => {
  it('keeps PRIMARY mounted while toggling the SECONDARY surface', async () => {
    const lifecycle: Lifecycle = {
      PRIMARY: {mounts: 0, unmounts: 0},
      SECONDARY: {mounts: 0, unmounts: 0},
    }
    const assembly: TestExpoAssembly = {
      createSurface: displayMode => <SurfaceProbe displayMode={displayMode} lifecycle={lifecycle} />,
    }
    const createAssembly = vi.fn(async (): Promise<TestExpoAssembly> => assembly)
    const App = createTestExpoApp({
      appName: 'dev-host-test',
      title: '宿主测试',
      terminalSurfaces: {
        layout: 'column',
        scaleToFit: true,
        surfaces: {
          PRIMARY: {width: 1920, height: 1080},
          SECONDARY: {width: 1024, height: 600},
        },
      },
      createAssembly,
      getRuntimeStatus: () => 'started',
    })

    let renderer: ReactTestRenderer | undefined
    act(() => { renderer = create(<App />) })
    const mountedRenderer = renderer!
    await waitFor(mountedRenderer, () => mountedRenderer.root.findAllByProps({testID: 'dev-host-test:test-expo:surface:PRIMARY'}).length > 0)
    const toggle = mountedRenderer.root.findByProps({testID: 'dev-host-test:test-expo:surface-toggle'})
    await act(async () => {
      ;(toggle.props.onPress as () => void)()
      await nextTurn()
    })
    await waitFor(mountedRenderer, () => mountedRenderer.root.findAllByProps({testID: 'dev-host-test:test-expo:surface:SECONDARY'}).length > 0)

    expect(lifecycle.PRIMARY).toEqual({mounts: 1, unmounts: 0})
    expect(lifecycle.SECONDARY).toEqual({mounts: 1, unmounts: 0})
    expect(createAssembly).toHaveBeenCalledTimes(1)
    act(() => { mountedRenderer.unmount() })
    expect(lifecycle.PRIMARY).toEqual({mounts: 1, unmounts: 1})
    expect(lifecycle.SECONDARY).toEqual({mounts: 1, unmounts: 1})
  })
})
