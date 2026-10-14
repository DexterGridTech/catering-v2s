import {requireNativeModule} from 'expo-modules-core';
import {
  unavailableAppControlPort,
  type AppControlPort,
  type NoOutput,
  type PortActionResult,
  type PortFailure,
  type PortResult,
} from '@catering-v2s/kernel-base-platform-ports';

const PORT_DESCRIPTOR_KEY = Symbol.for('catering-v2s.platform-ports.descriptor');

type NativeAppControlResult = Readonly<{
  readonly status: string;
  readonly value?: unknown;
  readonly completedAt?: number;
  readonly requestId?: string;
  readonly acceptedAt?: number;
  readonly terminalObservation?: string;
  readonly port?: string;
  readonly capability?: string;
  readonly reason?: string;
  readonly message?: string;
  readonly timeoutMs?: number;
  readonly error?: Readonly<{readonly code?: string; readonly message?: string; readonly retryable?: boolean}>;
}>;

type NativeAppControlModule = Readonly<{
  readonly resetRuntime: (requestId: string, timeoutMs: number) => Promise<NativeAppControlResult>;
}>;

const nativeAppControl = (): NativeAppControlModule =>
  requireNativeModule<NativeAppControlModule>('TerminalAppControl');

const failed = (code: string, message: string): PortFailure => ({
  status: 'failed',
  port: 'appControl',
  capability: 'resetRuntime',
  error: {code, message, retryable: true},
});

const readActionResult = (
  result: unknown,
  requestId: Parameters<AppControlPort['resetRuntime']>[0]['requestId'],
): PortActionResult<NoOutput, 'SUCCESSOR_RUNTIME_STARTED'> => {
  if (typeof result !== 'object' || result === null || Array.isArray(result))
    return failed('TERMINAL_NATIVE_RESULT_INVALID', 'native result is invalid');
  const value = result as NativeAppControlResult;
  if (
    value.status === 'accepted' &&
    value.requestId === requestId &&
    typeof value.acceptedAt === 'number' &&
    value.terminalObservation === 'SUCCESSOR_RUNTIME_STARTED'
  ) {
    return Object.freeze({
      status: 'accepted',
      requestId,
      acceptedAt: value.acceptedAt,
      terminalObservation: 'SUCCESSOR_RUNTIME_STARTED' as const,
    });
  }
  if (
    value.status === 'succeeded' &&
    'value' in value &&
    typeof value.completedAt === 'number'
  ) return value as unknown as PortResult<NoOutput>;
  if (
    value.status === 'failed' &&
    typeof value.port === 'string' &&
    typeof value.capability === 'string' &&
    typeof value.error?.code === 'string' &&
    typeof value.error.message === 'string' &&
    typeof value.error.retryable === 'boolean'
  ) return value as unknown as PortResult<NoOutput>;
  if (
    value.status === 'unavailable' &&
    typeof value.port === 'string' &&
    typeof value.capability === 'string' &&
    (value.reason === 'ADAPTER_NOT_INJECTED' || value.reason === 'PLATFORM_UNSUPPORTED') &&
    typeof value.message === 'string'
  ) return value as unknown as PortResult<NoOutput>;
  if (
    value.status === 'timed-out' &&
    typeof value.port === 'string' &&
    typeof value.capability === 'string' &&
    typeof value.timeoutMs === 'number'
  ) return value as unknown as PortResult<NoOutput>;
  return failed('TERMINAL_NATIVE_RESULT_INVALID', 'native result is invalid');
};

export const createAndroidAppControlPort = (): AppControlPort => {
  const port: AppControlPort = {
    ...unavailableAppControlPort,
    resetRuntime: async ({requestId, timeoutMs}) => {
      try {
        return readActionResult(await nativeAppControl().resetRuntime(requestId, timeoutMs), requestId);
      } catch {
        return failed('APP_CONTROL_BRIDGE_FAILED', 'app control bridge failed');
      }
    },
  };
  Object.defineProperty(port, PORT_DESCRIPTOR_KEY, {
    value: Object.freeze({
      port: 'appControl',
      capabilities: Object.freeze([
        Object.freeze({capability: 'resetRuntime', state: 'real' as const, source: 'adapter' as const}),
        ...[
          'exitApplication',
          'clearHostDataCache',
          'setFullscreen',
          'getFullscreen',
          'setKioskMode',
          'getKioskMode',
          'showNativeLoading',
          'hideNativeLoading',
        ].map(capability => Object.freeze({capability, state: 'unavailable' as const, source: 'default' as const})),
      ]),
    }),
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return Object.freeze(port);
};
