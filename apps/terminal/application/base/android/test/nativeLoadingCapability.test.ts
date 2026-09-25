import {describe, expect, it, vi} from 'vitest';

const mocks = vi.hoisted(() => ({
  callOrder: [] as string[],
  preventAutoHideAsync: vi.fn(() => Promise.resolve(true)),
  hideAsync: vi.fn(() => {
    mocks.callOrder.push('hideAsync');
    return Promise.resolve(true);
  }),
  beginHide: vi.fn(() => {
    mocks.callOrder.push('beginHide');
    return Promise.resolve({
      activityInstanceId: 'native-splash-activity-1',
      alreadyHidden: false,
      reason: 'startup-ready',
    });
  }),
  releaseHide: vi.fn(() => {
    mocks.callOrder.push('releaseHide');
    return Promise.resolve({
      activityInstanceId: 'native-splash-activity-1',
      hidden: true,
    });
  }),
  requireNativeModule: vi.fn(),
}));

vi.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: mocks.preventAutoHideAsync,
  hideAsync: mocks.hideAsync,
}));

vi.mock('expo-modules-core', () => ({
  requireNativeModule: mocks.requireNativeModule.mockReturnValue({
    beginHide: mocks.beginHide,
    releaseHide: mocks.releaseHide,
  }),
}));

const {createAndroidNativeLoadingCapability} = await import('../src/foundations/nativeLoadingCapability');

describe('Android native loading capability', () => {
  it('releases the matching Activity gate before starting the Expo splash exit', async () => {
    mocks.callOrder.length = 0;
    expect(mocks.preventAutoHideAsync).toHaveBeenCalledTimes(1);
    const capability = createAndroidNativeLoadingCapability();

    const result = await capability.hideOnce('startup-ready');

    expect(mocks.requireNativeModule).toHaveBeenCalledWith('TerminalNativeLoading');
    expect(mocks.beginHide).toHaveBeenCalledWith('startup-ready');
    expect(mocks.hideAsync).toHaveBeenCalledTimes(1);
    expect(mocks.releaseHide).toHaveBeenCalledWith('native-splash-activity-1');
    expect(mocks.callOrder).toEqual(['beginHide', 'releaseHide', 'hideAsync']);
    expect(result).toEqual({hidden: true, alreadyHidden: false, reason: 'startup-ready'});
  });
});
