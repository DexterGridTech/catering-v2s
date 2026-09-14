import type {LoggerConsoleBinding} from '../types/platformPorts';

const PORT_DESCRIPTOR_KEY = Symbol.for('catering-v2s.platform-ports.descriptor');
const binding: LoggerConsoleBinding = {kind: 'console'};

if (__DEV__) {
  Object.defineProperty(binding, PORT_DESCRIPTOR_KEY, {
    value: Object.freeze({
      port: 'logger',
      capabilities: Object.freeze([
        Object.freeze({capability: 'write', state: 'real', source: 'default'}),
      ]),
    }),
    enumerable: false,
    writable: false,
    configurable: false,
  });
}

export const consoleLoggerBinding: LoggerConsoleBinding = Object.freeze(binding);
