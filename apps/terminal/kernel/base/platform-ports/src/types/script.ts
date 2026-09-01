import type {PortResult, NoOutput} from './result';

export interface NativeFunctionInvocation {
  readonly functionName: string;
  readonly argsJson: string;
  readonly timeoutMs: number;
}
export interface NativeFunctionOutput { readonly resultJson: string }
export type NativeFunctionDispatcher =
  (input: NativeFunctionInvocation) => Promise<PortResult<NativeFunctionOutput>>;
export type ScriptNativeBindings =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'named';
      readonly functionNames: readonly string[];
      readonly invoke: NativeFunctionDispatcher;
    };
export interface ScriptExecutionInput {
  readonly source: string;
  readonly paramsJson: string;
  readonly globalsJson: string;
  readonly native: ScriptNativeBindings;
  readonly timeoutMs: number;
}
export interface ScriptExecutionOutput {
  readonly resultJson: string;
  readonly elapsedMs: number;
}
export interface ScriptStats {
  readonly total: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly averageElapsedMs: number;
}
export interface ScriptCall { readonly timeoutMs: number }
export interface ScriptPort {
  execute(input: ScriptExecutionInput): Promise<PortResult<ScriptExecutionOutput>>;
  getStats(input: ScriptCall): Promise<PortResult<ScriptStats>>;
  clearStats(input: ScriptCall): Promise<PortResult<NoOutput>>;
}
