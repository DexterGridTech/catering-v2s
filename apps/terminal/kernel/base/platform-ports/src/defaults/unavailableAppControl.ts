import type {PortResult, PortUnavailable, NoOutput, PortActionResult} from '../types/result';
import type {AppControlCall, AppControlPort, ApplicationToggleInput, ExitApplicationInput, NativeLoadingInput, RuntimeResetInput, SurfaceActionInput, SurfaceToggleInput, ToggleState, RuntimeTransitionObservation, ExitTransitionObservation} from '../types/appControl';

const unavailable = (capability: string): PortUnavailable => ({
  status: 'unavailable',
  port: 'appControl',
  capability,
  reason: 'ADAPTER_NOT_INJECTED',
  message: `appControl.${capability}: adapter not injected`,
});

export const unavailableAppControlPort: AppControlPort = {
  resetRuntime: async (_input: RuntimeResetInput): Promise<PortActionResult<NoOutput, RuntimeTransitionObservation>> => unavailable('resetRuntime'),
  exitApplication: async (_input: ExitApplicationInput): Promise<PortActionResult<NoOutput, ExitTransitionObservation>> => unavailable('exitApplication'),
  clearHostDataCache: async (_input: AppControlCall): Promise<PortResult<NoOutput>> => unavailable('clearHostDataCache'),
  setFullscreen: async (_input: SurfaceToggleInput): Promise<PortResult<ToggleState>> => unavailable('setFullscreen'),
  getFullscreen: async (_input: SurfaceActionInput): Promise<PortResult<ToggleState>> => unavailable('getFullscreen'),
  setKioskMode: async (_input: ApplicationToggleInput): Promise<PortResult<ToggleState>> => unavailable('setKioskMode'),
  getKioskMode: async (_input: AppControlCall): Promise<PortResult<ToggleState>> => unavailable('getKioskMode'),
  showNativeLoading: async (_input: NativeLoadingInput): Promise<PortResult<NoOutput>> => unavailable('showNativeLoading'),
  hideNativeLoading: async (_input: SurfaceActionInput): Promise<PortResult<NoOutput>> => unavailable('hideNativeLoading'),
};
