import {describe, expect, it} from 'vitest'
import {resolveSecondarySurfaceAvailable, readDisplayInfo} from '@catering-v2s/kernel-base-display-context'
import {createWebDevicePort, type SurfaceMode} from '@catering-v2s/ui-base-test-support'

describe('sample-console Web host bindings', () => {
  it('maps the host mode to a display count through the DevicePort seam', async () => {
    let mode: SurfaceMode = 'single'
    const device = createWebDevicePort(() => mode)
    expect(resolveSecondarySurfaceAvailable(await readDisplayInfo(device))).toBe(false)
    mode = 'dual'
    expect(resolveSecondarySurfaceAvailable(await readDisplayInfo(device))).toBe(true)
  })
})
