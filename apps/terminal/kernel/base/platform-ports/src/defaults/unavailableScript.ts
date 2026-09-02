import type {NoOutput, PortResult} from '../types/result';
import type {ScriptCall, ScriptExecutionInput, ScriptExecutionOutput, ScriptPort, ScriptStats} from '../types/script';
import {createUnavailable} from './createUnavailable';

export const unavailableScriptPort: ScriptPort = {
  execute: async (_input: ScriptExecutionInput): Promise<PortResult<ScriptExecutionOutput>> => createUnavailable('script', 'execute'),
  getStats: async (_input: ScriptCall): Promise<PortResult<ScriptStats>> => createUnavailable('script', 'getStats'),
  clearStats: async (_input: ScriptCall): Promise<PortResult<NoOutput>> => createUnavailable('script', 'clearStats'),
};
