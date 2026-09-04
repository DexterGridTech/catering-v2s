import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import {describe, expect, it} from 'vitest'
import {releaseRuntimeForTest} from '@catering-v2s/kernel-base-runtime/testing'
import {createSampleAssembly} from '../src'
import {createTestPlatformPorts} from './support'

const mount = (element: Parameters<typeof create>[0]): ReactTestRenderer => {
  let renderer: ReactTestRenderer | undefined
  act(() => { renderer = create(element) })
  return renderer!
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
      renderer = mount(assembly.createSurface('PRIMARY'))
      expect(renderer.root.findByProps({testID: 'sample.auth.login'})).toBeDefined()
      expect(renderer.root.findByProps({testID: 'sample.auth.login:submit'})).toBeDefined()
    } finally {
      if (renderer !== undefined) act(() => { renderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })
})
