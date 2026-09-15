import {describe, expect, it, vi} from 'vitest'

const mocks = vi.hoisted(() => ({
  preventAutoHideAsync: vi.fn(() => Promise.resolve(true)),
  hideAsync: vi.fn(() => Promise.resolve(true)),
  beginHide: vi.fn(() => Promise.resolve({
    activityInstanceId: 'native-splash-activity-1',
    alreadyHidden: false,
    reason: 'startup-ready',
  })),
  releaseHide: vi.fn(() => Promise.resolve({
    activityInstanceId: 'native-splash-activity-1',
    hidden: true,
  })),
  requireNativeModule: vi.fn(),
}))

vi.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: mocks.preventAutoHideAsync,
  hideAsync: mocks.hideAsync,
}))

vi.mock('expo-modules-core', () => ({
  requireNativeModule: mocks.requireNativeModule.mockReturnValue({
    beginHide: mocks.beginHide,
    releaseHide: mocks.releaseHide,
  }),
}))

const {createAndroidNativeLoadingCapability} = await import('../src/foundations/nativeLoadingCapability')

describe('Android native loading capability', () => {
  it('prevents process auto-hide and releases the matching Activity gate only after JS hide', async () => {
    expect(mocks.preventAutoHideAsync).toHaveBeenCalledTimes(1)
    const capability = createAndroidNativeLoadingCapability()

    const result = await capability.hideOnce('startup-ready')

    expect(mocks.requireNativeModule).toHaveBeenCalledWith('TerminalNativeLoading')
    expect(mocks.beginHide).toHaveBeenCalledWith('startup-ready')
    expect(mocks.hideAsync).toHaveBeenCalledTimes(1)
    expect(mocks.releaseHide).toHaveBeenCalledWith('native-splash-activity-1')
    expect(result).toEqual({hidden: true, alreadyHidden: false, reason: 'startup-ready'})
  })
})
