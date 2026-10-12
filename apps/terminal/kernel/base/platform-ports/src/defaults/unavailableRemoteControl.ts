import type {RemoteControlPort} from '../types/remoteControl';
import {createUnavailable} from './createUnavailable';

const PORT_DESCRIPTOR_KEY = Symbol.for('catering-v2s.platform-ports.descriptor');

export const unavailableRemoteControlPort: RemoteControlPort = {
  subscribeEvents: (_listener) => () => undefined,
  readLocalScreens: async (_screens) => createUnavailable('remoteControl', 'readLocalScreens'),
  begin: async (_input) => createUnavailable('remoteControl', 'begin'),
  sendData: async (_input) => createUnavailable('remoteControl', 'sendData'),
  dispatchPointer: async (_input) => createUnavailable('remoteControl', 'dispatchPointer'),
  end: async (_input) => createUnavailable('remoteControl', 'end'),
};

Object.defineProperty(unavailableRemoteControlPort, PORT_DESCRIPTOR_KEY, {
  value: Object.freeze({
    port: 'remoteControl',
    capabilities: Object.freeze(
      ['subscribeEvents', 'readLocalScreens', 'begin', 'sendData', 'dispatchPointer', 'end'].map((capability) =>
        Object.freeze({capability, state: 'unavailable' as const, source: 'default' as const}),
      ),
    ),
  }),
  enumerable: false,
  writable: false,
  configurable: false,
});
