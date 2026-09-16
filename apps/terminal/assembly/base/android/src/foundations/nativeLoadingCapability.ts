import * as SplashScreen from 'expo-splash-screen';
import {requireNativeModule} from 'expo-modules-core';
import type {NativeLoadingCapability} from '@catering-v2s/kernel-base-platform-ports';

let preventFailure: unknown = null;
const preventAutoHide = SplashScreen.preventAutoHideAsync().catch(error => {
  preventFailure = error;
  return false;
});

type NativeLoadingModule = Readonly<{
  readonly beginHide: (reason: string) => Promise<
    Readonly<{
      readonly activityInstanceId: string;
      readonly alreadyHidden: boolean;
      readonly reason: string;
    }>
  >;
  readonly releaseHide: (activityInstanceId: string) => Promise<
    Readonly<{
      readonly activityInstanceId: string;
      readonly hidden: boolean;
    }>
  >;
}>;

let nativeModule: NativeLoadingModule | undefined;
const getNativeModule = (): NativeLoadingModule =>
  (nativeModule ??= requireNativeModule<NativeLoadingModule>('TerminalNativeLoading'));

export const createAndroidNativeLoadingCapability = (): NativeLoadingCapability => {
  return Object.freeze({
    targetPhysicalSurface: Object.freeze({surfaceKey: 'PRIMARY' as const, displayIndex: 0 as const}),
    hideOnce: async (reason: string) => {
      await preventAutoHide;
      if (preventFailure !== null) throw preventFailure;
      const request = await getNativeModule().beginHide(reason);
      if (request.alreadyHidden) return Object.freeze({hidden: false, reason, alreadyHidden: true});
      // Keep Expo's splash gate closed until the custom Activity gate has
      // been released.  If Expo is released first, its pre-draw listener can
      // start the exit animation while this gate is still suppressing the
      // first business frame, exposing the window background as a black
      // intermediate frame on Android.
      await getNativeModule().releaseHide(request.activityInstanceId);
      await SplashScreen.hideAsync();
      return Object.freeze({hidden: true, reason, alreadyHidden: false});
    },
  });
};
