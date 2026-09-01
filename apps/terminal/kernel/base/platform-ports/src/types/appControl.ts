import type {RequestId} from '@catering-v2s/kernel-base-contracts';
import type {NoOutput, PortActionResult, PortResult} from './result';

export interface AppControlCall { readonly timeoutMs: number }
export interface RuntimeResetInput extends AppControlCall { readonly requestId: RequestId }
export interface ExitApplicationInput extends AppControlCall { readonly requestId: RequestId }
export interface SurfaceActionInput extends AppControlCall { readonly containerKey: string }
export interface SurfaceToggleInput extends SurfaceActionInput { readonly enabled: boolean }
export interface NativeLoadingInput extends SurfaceActionInput { readonly message: string }
export interface ApplicationToggleInput extends AppControlCall { readonly enabled: boolean }
export interface ToggleState { readonly enabled: boolean }
export type RuntimeTransitionObservation = 'SUCCESSOR_RUNTIME_STARTED';
export type ExitTransitionObservation = 'PROCESS_TERMINATED';

export interface AppControlPort {
  resetRuntime(input: RuntimeResetInput): Promise<PortActionResult<NoOutput, RuntimeTransitionObservation>>;
  exitApplication(input: ExitApplicationInput): Promise<PortActionResult<NoOutput, ExitTransitionObservation>>;
  clearHostDataCache(input: AppControlCall): Promise<PortResult<NoOutput>>;
  setFullscreen(input: SurfaceToggleInput): Promise<PortResult<ToggleState>>;
  getFullscreen(input: SurfaceActionInput): Promise<PortResult<ToggleState>>;
  setKioskMode(input: ApplicationToggleInput): Promise<PortResult<ToggleState>>;
  getKioskMode(input: AppControlCall): Promise<PortResult<ToggleState>>;
  showNativeLoading(input: NativeLoadingInput): Promise<PortResult<NoOutput>>;
  hideNativeLoading(input: SurfaceActionInput): Promise<PortResult<NoOutput>>;
}
