import type {NoOutput, PortResult, PortUnavailable} from '../types/result';
import type {ScriptCall, ScriptExecutionInput, ScriptExecutionOutput, ScriptPort, ScriptStats} from '../types/script';

const unavailable = (capability: string): PortUnavailable => ({
  status: 'unavailable',
  port: 'script',
  capability,
  reason: 'ADAPTER_NOT_INJECTED',
  message: `script.${capability}: adapter not injected`,
});

export const unavailableScriptPort: ScriptPort = {
  execute: async (_input: ScriptExecutionInput): Promise<PortResult<ScriptExecutionOutput>> => unavailable('execute'),
  getStats: async (_input: ScriptCall): Promise<PortResult<ScriptStats>> => unavailable('getStats'),
  clearStats: async (_input: ScriptCall): Promise<PortResult<NoOutput>> => unavailable('clearStats'),
};
