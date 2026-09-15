import type {NoOutput, PortResult} from '../types/result';
import type {ScriptCall, ScriptExecutionInput, ScriptExecutionOutput, ScriptPort, ScriptStats} from '../types/script';
import {createUnavailable} from './createUnavailable';

const PORT_DESCRIPTOR_KEY = Symbol.for('catering-v2s.platform-ports.descriptor');
export const unavailableScriptPort: ScriptPort = {
  execute: async (_input: ScriptExecutionInput): Promise<PortResult<ScriptExecutionOutput>> => createUnavailable('script', 'execute'),
  getStats: async (_input: ScriptCall): Promise<PortResult<ScriptStats>> => createUnavailable('script', 'getStats'),
  clearStats: async (_input: ScriptCall): Promise<PortResult<NoOutput>> => createUnavailable('script', 'clearStats'),
};

Object.defineProperty(unavailableScriptPort, PORT_DESCRIPTOR_KEY, {
  value: Object.freeze({
    port: 'script',
    capabilities: Object.freeze([
      'execute', 'getStats', 'clearStats',
    ].map(capability => Object.freeze({capability, state: 'unavailable' as const, source: 'default' as const}))),
  }),
  enumerable: false,
  writable: false,
  configurable: false,
});
