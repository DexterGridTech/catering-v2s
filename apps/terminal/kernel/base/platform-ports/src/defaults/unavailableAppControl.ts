import type {PortResult, NoOutput, PortActionResult} from '../types/result';
import type {AppControlCall, AppControlPort, ApplicationToggleInput, ExitApplicationInput, NativeLoadingInput, RuntimeResetInput, SurfaceActionInput, SurfaceToggleInput, ToggleState, RuntimeTransitionObservation, ExitTransitionObservation} from '../types/appControl';
import {createUnavailable} from './createUnavailable';

export const unavailableAppControlPort: AppControlPort = {
  resetRuntime: async (_input: RuntimeResetInput): Promise<PortActionResult<NoOutput, RuntimeTransitionObservation>> => createUnavailable('appControl', 'resetRuntime'),
  exitApplication: async (_input: ExitApplicationInput): Promise<PortActionResult<NoOutput, ExitTransitionObservation>> => createUnavailable('appControl', 'exitApplication'),
  clearHostDataCache: async (_input: AppControlCall): Promise<PortResult<NoOutput>> => createUnavailable('appControl', 'clearHostDataCache'),
  setFullscreen: async (_input: SurfaceToggleInput): Promise<PortResult<ToggleState>> => createUnavailable('appControl', 'setFullscreen'),
  getFullscreen: async (_input: SurfaceActionInput): Promise<PortResult<ToggleState>> => createUnavailable('appControl', 'getFullscreen'),
  setKioskMode: async (_input: ApplicationToggleInput): Promise<PortResult<ToggleState>> => createUnavailable('appControl', 'setKioskMode'),
  getKioskMode: async (_input: AppControlCall): Promise<PortResult<ToggleState>> => createUnavailable('appControl', 'getKioskMode'),
  showNativeLoading: async (_input: NativeLoadingInput): Promise<PortResult<NoOutput>> => createUnavailable('appControl', 'showNativeLoading'),
  hideNativeLoading: async (_input: SurfaceActionInput): Promise<PortResult<NoOutput>> => createUnavailable('appControl', 'hideNativeLoading'),
};
